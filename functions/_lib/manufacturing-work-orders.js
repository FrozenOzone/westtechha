import { requireOrdersDb } from './orders.js';

const SOURCE_TYPES=new Set(['COASTER','ENCLOSURE']);
const PRINTERS=new Set(['UNASSIGNED','K2_1','K2_2','BOTH']);
const PRINTING_STATUSES=new Set(['PRODUCTION_QUEUE','IN_PRODUCTION']);

function clean(value,max=500){return String(value??'').trim().slice(0,max);}
function integer(value,min=0,max=999999){const n=Math.round(Number(value));return Number.isFinite(n)?Math.min(max,Math.max(min,n)):min;}
function bool(value){return value===true||value===1||String(value).toLowerCase()==='true';}
function makeError(message,status=400){return Object.assign(new Error(message),{status});}
function sourceType(value){const type=clean(value,30).toUpperCase();if(!SOURCE_TYPES.has(type))throw makeError('Choose Coaster or Enclosure.');return type;}
function printer(value){const normalized=clean(value,30).toUpperCase().replaceAll('#','').replace(/[ -]/g,'_');const mapped=normalized==='K2_1'||normalized==='K21'?'K2_1':normalized==='K2_2'||normalized==='K22'?'K2_2':normalized==='BOTH'?'BOTH':'UNASSIGNED';if(!PRINTERS.has(mapped))return 'UNASSIGNED';return mapped;}
function fallbackMinutes(type,order){if(type==='COASTER')return Math.max(1,Number(order?.setCount||1))*360;return Math.max(1,Number(order?.quantity||1))*480;}

async function settings(db){
  const row=await db.prepare(`SELECT active_printers,productive_minutes_per_printer_day,handling_business_days,window_span_business_days,updated_at FROM manufacturing_capacity_settings WHERE id=1`).first();
  return {activePrinters:integer(row?.active_printers,1,8),productiveMinutesPerPrinterDay:integer(row?.productive_minutes_per_printer_day,60,1440),handlingBusinessDays:integer(row?.handling_business_days,0,30),windowSpanBusinessDays:integer(row?.window_span_business_days,0,30),updatedAt:row?.updated_at||''};
}

function addBusinessDays(start,count){const date=new Date(start);let left=Math.max(0,integer(count,0,365));while(left>0){date.setUTCDate(date.getUTCDate()+1);const day=date.getUTCDay();if(day!==0&&day!==6)left--;}return date;}
function formatWindow(start,end){const sameYear=start.getUTCFullYear()===end.getUTCFullYear();const left=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',timeZone:'UTC'}).format(start);const right=new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(end);return sameYear?`${left}–${right}`:`${new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'}).format(start)}–${right}`;}
function projectedWindow(config,cumulativeMinutes,from=new Date()){
  const capacity=Math.max(1,config.activePrinters*config.productiveMinutesPerPrinterDay);
  const printDays=Math.max(1,Math.ceil(Math.max(0,cumulativeMinutes)/capacity));
  const startDate=new Date(Date.UTC(from.getUTCFullYear(),from.getUTCMonth(),from.getUTCDate(),12));
  const earliest=addBusinessDays(startDate,printDays+config.handlingBusinessDays);
  const latest=addBusinessDays(earliest,config.windowSpanBusinessDays);
  return {earliest:earliest.toISOString().slice(0,10),latest:latest.toISOString().slice(0,10),label:formatWindow(earliest,latest),printDays};
}

async function workload(db){
  const row=await db.prepare(`
    SELECT COUNT(*) AS active_count,COALESCE(SUM(w.remaining_printer_minutes),0) AS remaining_minutes
    FROM manufacturing_work_orders w
    LEFT JOIN coaster_orders c ON w.source_type='COASTER' AND c.order_id=w.source_order_id
    LEFT JOIN enclosure_orders e ON w.source_type='ENCLOSURE' AND e.order_id=w.source_order_id
    WHERE w.is_paused=0
      AND COALESCE(c.status,e.status) IN ('PRODUCTION_QUEUE','IN_PRODUCTION')
  `).first();
  return {activeOrderCount:Number(row?.active_count||0),remainingPrinterMinutes:Number(row?.remaining_minutes||0)};
}

export async function estimateManufacturingWindow(env,candidateMinutes=0){
  const db=requireOrdersDb(env),config=await settings(db),current=await workload(db),minutes=integer(candidateMinutes,0,1000000),projection=projectedWindow(config,current.remainingPrinterMinutes+minutes);
  return {...current,candidatePrinterMinutes:minutes,queuePosition:current.activeOrderCount+1,capacityMinutesPerDay:config.activePrinters*config.productiveMinutesPerPrinterDay,suggestedProductionWindow:projection.label,suggestedShipStart:projection.earliest,suggestedShipEnd:projection.latest,projectedPrintDays:projection.printDays,settings:config};
}

export async function ensureManufacturingWorkOrder(env,typeValue,order,queuedAt=''){
  const db=requireOrdersDb(env),type=sourceType(typeValue),orderId=clean(order?.orderId,80);if(!orderId)throw makeError('The source order number is required.');
  if(!['PAID','NOT_REQUIRED'].includes(String(order?.paymentStatus||'').toUpperCase()))return null;
  const estimated=integer(order?.estimatedPrinterMinutes,0,1000000)||fallbackMinutes(type,order),assignment=printer(order?.printerAssignment),when=clean(queuedAt||order?.paypalPaidAt||new Date().toISOString(),80);
  await db.prepare(`
    INSERT INTO manufacturing_work_orders (source_type,source_order_id,queued_at,estimated_printer_minutes,remaining_printer_minutes,printer_assignment)
    VALUES (?,?,?,?,?,?)
    ON CONFLICT(source_type,source_order_id) DO UPDATE SET
      estimated_printer_minutes=CASE WHEN manufacturing_work_orders.estimated_printer_minutes=0 THEN excluded.estimated_printer_minutes ELSE manufacturing_work_orders.estimated_printer_minutes END,
      remaining_printer_minutes=CASE WHEN manufacturing_work_orders.remaining_printer_minutes=0 AND manufacturing_work_orders.estimated_printer_minutes=0 THEN excluded.remaining_printer_minutes ELSE manufacturing_work_orders.remaining_printer_minutes END,
      printer_assignment=CASE WHEN manufacturing_work_orders.printer_assignment='UNASSIGNED' THEN excluded.printer_assignment ELSE manufacturing_work_orders.printer_assignment END,
      updated_at=CURRENT_TIMESTAMP
  `).bind(type,orderId,when,estimated,PRINTING_STATUSES.has(String(order?.status||'').toUpperCase())?estimated:0,assignment).run();
  return getManufacturingWorkOrder(env,type,orderId);
}

export async function syncManufacturingWorkOrder(env,typeValue,order){
  const db=requireOrdersDb(env),type=sourceType(typeValue),orderId=clean(order?.orderId,80);if(!orderId)return null;
  let row=await db.prepare(`SELECT id FROM manufacturing_work_orders WHERE source_type=? AND source_order_id=?`).bind(type,orderId).first();
  if(!row&&['PAID','NOT_REQUIRED'].includes(String(order?.paymentStatus||'').toUpperCase())){await ensureManufacturingWorkOrder(env,type,order);row=await db.prepare(`SELECT id FROM manufacturing_work_orders WHERE source_type=? AND source_order_id=?`).bind(type,orderId).first();}
  if(!row)return null;
  const status=String(order?.status||'').toUpperCase(),estimated=integer(order?.estimatedPrinterMinutes,0,1000000),assignment=printer(order?.printerAssignment);
  await db.prepare(`UPDATE manufacturing_work_orders SET estimated_printer_minutes=CASE WHEN ?>0 THEN ? ELSE estimated_printer_minutes END,remaining_printer_minutes=CASE WHEN ? IN ('PRODUCTION_QUEUE','IN_PRODUCTION') THEN remaining_printer_minutes ELSE 0 END,printer_assignment=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(estimated,estimated,status,assignment,row.id).run();
  return getManufacturingWorkOrder(env,type,orderId);
}

export async function getManufacturingWorkOrder(env,typeValue,orderIdValue){
  const type=sourceType(typeValue),orderId=clean(orderIdValue,80),rows=await listManufacturingWorkOrders(env);return rows.find(row=>row.sourceType===type&&row.sourceOrderId===orderId)||null;
}

export async function listManufacturingWorkOrders(env){
  const db=requireOrdersDb(env),config=await settings(db),result=await db.prepare(`
    SELECT w.id AS work_order_id,w.source_type,w.source_order_id,w.queued_at,w.estimated_printer_minutes,w.remaining_printer_minutes,w.printer_assignment,w.is_paused,w.pause_reason,w.created_at,w.updated_at,
      c.status,c.customer_name,c.fulfillment_method,c.payment_status,c.paypal_paid_at,c.production_window,c.completed_at,
      c.set_size,c.set_count,c.total_coasters,NULL AS model,NULL AS board_variant,NULL AS offer_type,NULL AS quantity
    FROM manufacturing_work_orders w JOIN coaster_orders c ON w.source_type='COASTER' AND c.order_id=w.source_order_id
    UNION ALL
    SELECT w.id AS work_order_id,w.source_type,w.source_order_id,w.queued_at,w.estimated_printer_minutes,w.remaining_printer_minutes,w.printer_assignment,w.is_paused,w.pause_reason,w.created_at,w.updated_at,
      e.status,e.customer_name,e.fulfillment_method,e.payment_status,e.paypal_paid_at,e.production_window,e.completed_at,
      NULL AS set_size,NULL AS set_count,NULL AS total_coasters,e.model,e.board_variant,e.offer_type,e.quantity
    FROM manufacturing_work_orders w JOIN enclosure_orders e ON w.source_type='ENCLOSURE' AND e.order_id=w.source_order_id
    ORDER BY queued_at,work_order_id
  `).all();
  let cumulative=0,position=0;
  return (result?.results||[]).map(row=>{
    const status=String(row.status||''),printing=PRINTING_STATUSES.has(status),paused=!!Number(row.is_paused);let projection=null,queuePosition=null;
    if(printing&&!paused){position++;queuePosition=position;cumulative+=Number(row.remaining_printer_minutes||0);projection=projectedWindow(config,cumulative);}
    const itemSummary=row.source_type==='COASTER'?`${Number(row.set_count||1)} × ${Number(row.set_size||4)}-Coaster Set${Number(row.set_count||1)===1?'':'s'}`:`${Number(row.quantity||1)} × ${row.model} ${row.board_variant}-pin ${row.offer_type}`;
    return {id:row.work_order_id,sourceType:row.source_type,sourceOrderId:row.source_order_id,queuedAt:row.queued_at,estimatedPrinterMinutes:Number(row.estimated_printer_minutes||0),remainingPrinterMinutes:Number(row.remaining_printer_minutes||0),printerAssignment:row.printer_assignment||'UNASSIGNED',isPaused:paused,pauseReason:row.pause_reason||'',status,customerName:row.customer_name||'',fulfillmentMethod:row.fulfillment_method||'',paymentStatus:row.payment_status||'',paidAt:row.paypal_paid_at||'',promisedWindow:row.production_window||'',completedAt:row.completed_at||'',itemSummary,queuePosition,projectedWindow:projection?.label||'',projectedShipStart:projection?.earliest||'',projectedShipEnd:projection?.latest||'',createdAt:row.created_at,updatedAt:row.updated_at};
  });
}

export async function updateManufacturingWorkOrder(env,body={}){
  const db=requireOrdersDb(env),type=sourceType(body.sourceType),orderId=clean(body.sourceOrderId,80),existing=await db.prepare(`SELECT * FROM manufacturing_work_orders WHERE source_type=? AND source_order_id=?`).bind(type,orderId).first();if(!existing)throw makeError('Shared work order not found.',404);
  const estimated=integer(body.estimatedPrinterMinutes,0,1000000),remaining=integer(body.remainingPrinterMinutes,0,1000000),assignment=printer(body.printerAssignment),paused=bool(body.isPaused),reason=clean(body.pauseReason,500);
  if(paused&&!reason)throw makeError('Add a brief reason before pausing this work order.');
  await db.prepare(`UPDATE manufacturing_work_orders SET estimated_printer_minutes=?,remaining_printer_minutes=?,printer_assignment=?,is_paused=?,pause_reason=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(estimated,remaining,assignment,paused?1:0,reason||null,existing.id).run();
  const sourceTable=type==='COASTER'?'coaster_orders':'enclosure_orders';
  const eventTable=type==='COASTER'?'coaster_order_events':'enclosure_order_events';
  await db.prepare(`UPDATE ${sourceTable} SET estimated_printer_minutes=?,printer_assignment=?,updated_at=CURRENT_TIMESTAMP WHERE order_id=?`).bind(estimated,assignment,orderId).run();
  await db.prepare(`INSERT INTO ${eventTable} (order_id,event_type,detail) VALUES (?,?,?)`).bind(orderId,'SHARED_WORK_ORDER_UPDATED',JSON.stringify({estimatedPrinterMinutes:estimated,remainingPrinterMinutes:remaining,printerAssignment:assignment,isPaused:paused,pauseReason:reason||'',queuedAt:existing.queued_at})).run();
  return getManufacturingWorkOrder(env,type,orderId);
}

export async function updateManufacturingSettings(env,body={}){
  const db=requireOrdersDb(env),activePrinters=integer(body.activePrinters,1,8),productiveMinutes=integer(body.productiveMinutesPerPrinterDay,60,1440),handling=integer(body.handlingBusinessDays,0,30),span=integer(body.windowSpanBusinessDays,0,30);
  await db.prepare(`UPDATE manufacturing_capacity_settings SET active_printers=?,productive_minutes_per_printer_day=?,handling_business_days=?,window_span_business_days=?,updated_at=CURRENT_TIMESTAMP WHERE id=1`).bind(activePrinters,productiveMinutes,handling,span).run();
  return settings(db);
}

export async function manufacturingDashboard(env){const db=requireOrdersDb(env),config=await settings(db),orders=await listManufacturingWorkOrders(env),current=await workload(db);return {settings:config,summary:{...current,remainingPrinterHours:Math.round(current.remainingPrinterMinutes/6)/10,capacityMinutesPerDay:config.activePrinters*config.productiveMinutesPerPrinterDay},orders};}
