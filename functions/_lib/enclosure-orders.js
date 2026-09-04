import { requireOrdersDb } from './orders.js';
import { getProduct } from './product.js';

const STATUSES=new Set(['REQUEST_RECEIVED','UNDER_REVIEW','NEEDS_CUSTOMER_INFO','ON_HOLD']);
const FULFILLMENT_PREFERENCES=new Set(['SHIP','LOCAL_PICKUP','DISCUSS']);
const FULFILLMENT_METHODS=new Set(['UNSET','SHIP','LOCAL_PICKUP']);
const COLORS=new Set(['White','Black']);

function clean(value,max=500){return typeof value==='string'?value.trim().slice(0,max):'';}
function number(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}
function integer(value,min=0,max=999999){return Math.min(max,Math.max(min,Math.round(number(value,min))));}
function money(value){return Math.round(Math.max(0,number(value,0))*100)/100;}
function nowIso(){return new Date().toISOString();}
function utcDate(){return nowIso().slice(0,10).replaceAll('-','');}
function makeError(message,status=400){return Object.assign(new Error(message),{status});}
function jsonDetail(value){try{return JSON.stringify(value??{});}catch(e){return '{}';}}

async function allocateOrderId(db){
  const date=utcDate();
  const row=await db.prepare(`INSERT INTO enclosure_order_counters (order_date,last_value) VALUES (?,1001) ON CONFLICT(order_date) DO UPDATE SET last_value=last_value+1 RETURNING last_value`).bind(date).first();
  const seq=Number(row?.last_value||1001);
  return {orderId:`WTE-${date}-${seq}`,orderDate:date,dailySequence:seq};
}

function mapRow(row){
  if(!row)return null;
  return {
    id:row.id,orderId:row.order_id,orderDate:row.order_date,dailySequence:row.daily_sequence,status:row.status,
    customerName:row.customer_name,customerEmail:row.customer_email,customerPhone:row.customer_phone||'',
    sku:row.sku,family:row.family,model:row.model,boardVariant:row.board_variant,offerType:row.offer_type,
    color:row.color,quantity:Number(row.quantity||1),startingUnitPrice:number(row.starting_unit_price),startingSubtotal:number(row.starting_subtotal),customerNotes:row.customer_notes||'',
    fulfillmentPreference:row.fulfillment_preference||'DISCUSS',fulfillmentMethod:row.fulfillment_method||'UNSET',paymentRequired:!!Number(row.payment_required),
    productAmount:number(row.product_amount),customCharge:number(row.custom_charge),shippingAmount:number(row.shipping_amount),discountAmount:number(row.discount_amount),finalAmount:number(row.final_amount),
    customerReviewNote:row.customer_review_note||'',adminNotes:row.admin_notes||'',reviewSavedAt:row.review_saved_at||'',
    estimatedPrinterMinutes:Number(row.estimated_printer_minutes||0),printerAssignment:row.printer_assignment||'',productionWindow:row.production_window||'',
    paymentStatus:row.payment_status||'NOT_REQUESTED',paypalOrderId:row.paypal_order_id||'',paypalCaptureId:row.paypal_capture_id||'',paypalPaidAt:row.paypal_paid_at||'',
    taxableAmount:number(row.taxable_amount),taxAmount:number(row.tax_amount),taxRate:number(row.tax_rate),paymentTotal:number(row.payment_total),
    shippingName:row.shipping_name||'',shippingAddress1:row.shipping_address1||'',shippingAddress2:row.shipping_address2||'',shippingCity:row.shipping_city||'',shippingRegion:row.shipping_region||'',shippingPostalCode:row.shipping_postal_code||'',shippingCountry:row.shipping_country||'US',
    trackingCarrier:row.tracking_carrier||'',trackingNumber:row.tracking_number||'',pickupReadyAt:row.pickup_ready_at||'',shippedAt:row.shipped_at||'',completedAt:row.completed_at||'',archivedAt:row.archived_at||'',
    createdAt:row.created_at,updatedAt:row.updated_at
  };
}

async function logEvent(db,orderId,eventType,detail){
  await db.prepare(`INSERT INTO enclosure_order_events (order_id,event_type,detail) VALUES (?,?,?)`).bind(orderId,eventType,jsonDetail(detail)).run();
}

async function eventsFor(db,orderId){
  const result=await db.prepare(`SELECT id,event_type,detail,created_at FROM enclosure_order_events WHERE order_id=? ORDER BY created_at DESC,id DESC`).bind(orderId).all();
  return (result?.results||[]).map(row=>({id:row.id,eventType:row.event_type,detail:row.detail||'',createdAt:row.created_at}));
}

async function workFor(db,orderId){
  const result=await db.prepare(`SELECT id,work_type,minutes,note,created_at FROM enclosure_order_work_log WHERE order_id=? ORDER BY created_at DESC,id DESC`).bind(orderId).all();
  return (result?.results||[]).map(row=>({id:row.id,workType:row.work_type,minutes:Number(row.minutes||0),note:row.note||'',createdAt:row.created_at}));
}

export async function getEnclosureOrderDetail(env,orderId){
  const db=requireOrdersDb(env);
  const row=await db.prepare(`SELECT * FROM enclosure_orders WHERE order_id=? LIMIT 1`).bind(clean(orderId,80)).first();
  if(!row)throw makeError('Enclosure order not found.',404);
  const order=mapRow(row);
  order.events=await eventsFor(db,order.orderId);
  order.workLog=await workFor(db,order.orderId);
  return order;
}

export async function listEnclosureOrders(env,limit=150){
  const db=requireOrdersDb(env);
  const result=await db.prepare(`SELECT * FROM enclosure_orders ORDER BY created_at DESC,id DESC LIMIT ?`).bind(integer(limit,1,250)).all();
  return (result?.results||[]).map(mapRow);
}

export async function createEnclosureOrder(env,body){
  const db=requireOrdersDb(env);
  if(clean(body?.website,200))throw makeError('Could not submit the request.');
  const customerName=clean(body?.customerName,120);
  const customerEmail=clean(body?.customerEmail,254).toLowerCase();
  if(customerName.length<2)throw makeError('Enter your name.');
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail))throw makeError('Enter a valid email address.');
  if(body?.requestConfirmed!==true)throw makeError('Confirm that this is a review request and that payment comes later.');
  const sku=clean(body?.sku,100).toLowerCase();
  const product=getProduct(sku);
  if(!product)throw makeError('Choose a valid WestTech enclosure configuration.');
  const quantity=integer(body?.quantity,1,50);
  const color=clean(body?.color,20);
  if(!COLORS.has(color))throw makeError('Choose White or Black.');
  const preference=clean(body?.fulfillmentPreference,30).toUpperCase();
  if(!FULFILLMENT_PREFERENCES.has(preference))throw makeError('Choose shipping, local pickup, or discuss during review.');
  const unitPrice=money(product.unitAmount);
  const startingSubtotal=money(unitPrice*quantity);
  const {orderId,orderDate,dailySequence}=await allocateOrderId(db);
  const model=clean(body?.modelLabel,100)||clean(product.variant,100)||clean(product.family,80);
  await db.prepare(`INSERT INTO enclosure_orders (order_id,order_date,daily_sequence,status,customer_name,customer_email,customer_phone,sku,family,model,board_variant,offer_type,color,quantity,starting_unit_price,starting_subtotal,customer_notes,fulfillment_preference,product_amount) VALUES (?,?,?,'REQUEST_RECEIVED',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
    orderId,orderDate,dailySequence,customerName,customerEmail,clean(body?.customerPhone,60),sku,clean(product.family,80),model,clean(product.variant,80).includes('38')?'38':'30',clean(product.offerType,40),color,quantity,unitPrice,startingSubtotal,clean(body?.customerNotes,2500),preference,startingSubtotal
  ).run();
  await logEvent(db,orderId,'REQUEST_SUBMITTED',{status:'REQUEST_RECEIVED',sku,quantity,color,fulfillmentPreference:preference,startingSubtotal});
  return getEnclosureOrderDetail(env,orderId);
}

export async function updateEnclosureOrderAdmin(env,orderId,body){
  const db=requireOrdersDb(env);
  const current=await getEnclosureOrderDetail(env,orderId);
  const status=clean(body?.status,40).toUpperCase()||current.status;
  if(!STATUSES.has(status))throw makeError('Choose a valid review status.');
  const fulfillment=clean(body?.fulfillmentMethod,30).toUpperCase()||'UNSET';
  if(!FULFILLMENT_METHODS.has(fulfillment))throw makeError('Choose a valid fulfillment method.');
  const productAmount=money(body?.productAmount);
  const customCharge=money(body?.customCharge);
  const shippingAmount=money(body?.shippingAmount);
  const discountAmount=money(body?.discountAmount);
  const finalAmount=money(Math.max(0,productAmount+customCharge+shippingAmount-discountAmount));
  const estimatedPrinterMinutes=integer(body?.estimatedPrinterMinutes,0,100000);
  const updatedAt=nowIso();
  await db.prepare(`UPDATE enclosure_orders SET status=?,fulfillment_method=?,product_amount=?,custom_charge=?,shipping_amount=?,discount_amount=?,final_amount=?,customer_review_note=?,admin_notes=?,estimated_printer_minutes=?,printer_assignment=?,production_window=?,review_saved_at=?,updated_at=? WHERE order_id=?`).bind(
    status,fulfillment,productAmount,customCharge,shippingAmount,discountAmount,finalAmount,clean(body?.customerReviewNote,2500),clean(body?.adminNotes,5000),estimatedPrinterMinutes,clean(body?.printerAssignment,80),clean(body?.productionWindow,160),updatedAt,updatedAt,current.orderId
  ).run();
  await logEvent(db,current.orderId,'REVIEW_SAVED',{status,fulfillmentMethod:fulfillment,finalAmount,estimatedPrinterMinutes,productionWindow:clean(body?.productionWindow,160)});
  return getEnclosureOrderDetail(env,current.orderId);
}
