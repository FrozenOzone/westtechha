/* WestTech Production Date Awareness - Stage A.
 * Advisory only: never changes promised dates, payment or queue order.
 * Dates are business days (Monday-Friday), interpreted in America/Denver.
 */
import { requireOrdersDb } from './orders.js';
import { manufacturingDashboard, estimateManufacturingWindow } from './manufacturing-work-orders.js';

const ZONE='America/Denver';
const ACTIVE=new Set(['PROOF_SENT','PROOF_APPROVED','AWAITING_PAYMENT','REORDER_VERIFICATION','PRODUCTION_QUEUE','IN_PRODUCTION']);
const PRINTING=new Set(['PRODUCTION_QUEUE','IN_PRODUCTION']);
const MONTHS=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const clean=(s,max=100)=>String(s??'').trim().slice(0,max);
const int=(v,min,max)=>{const n=Number(v);return Number.isFinite(n)?Math.min(max,Math.max(min,Math.trunc(n))):min;};
const isoParts=s=>{const m=String(s||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return null;const y=+m[1],mo=+m[2],d=+m[3],test=new Date(Date.UTC(y,mo-1,d,12));return test.getUTCFullYear()===y&&test.getUTCMonth()+1===mo&&test.getUTCDate()===d?{y,mo,d}:null;};
const iso=(y,m,d)=>{const v=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;return isoParts(v)?v:'';};
const month=s=>MONTHS.findIndex(m=>m.toLowerCase()===String(s).slice(0,3).toLowerCase())+1;
const utc=s=>new Date(`${s}T12:00:00.000Z`);
const isWeekend=s=>[0,6].includes(utc(s).getUTCDay());
export function addBusinessDays(start,n){let d=utc(start),days=int(n,0,365);while(days>0){d.setUTCDate(d.getUTCDate()+1);if(![0,6].includes(d.getUTCDay()))days--;}return d.toISOString().slice(0,10);}
export function nextBusinessDay(start){return addBusinessDays(start,1);}
export function normalizeBusinessDay(start){let d=start;while(isWeekend(d))d=nextBusinessDay(d);return d;}
export function todayMountain(at=new Date()){const chunks=new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(at);const obj=Object.fromEntries(chunks.map(c=>[c.type,c.value]));return `${obj.year}-${obj.month}-${obj.day}`;}
export function formatDate(date,withYear=true){const p=isoParts(date);return p?`${MONTHS[p.mo-1]} ${p.d}${withYear?`, ${p.y}`:''}`:'';}
export function formatWindow(start,end){if(!start)return '';if(!end||end===start)return formatDate(start);const a=isoParts(start),b=isoParts(end);if(!a||!b)return '';if(a.y===b.y&&a.mo===b.mo)return `${MONTHS[a.mo-1]} ${a.d}–${b.d}, ${a.y}`;if(a.y===b.y)return `${MONTHS[a.mo-1]} ${a.d}–${MONTHS[b.mo-1]} ${b.d}, ${a.y}`;return `${formatDate(start)}–${formatDate(end)}`;}
export function parseWindow(value){
  const s=clean(value,160).replace(/\s+/g,' ');if(!s)return null;
  if(isoParts(s))return {start:s,end:s};
  let m=s.match(/^(\d{4}-\d{2}-\d{2})\s*(?:–|—|\-|to)\s*(\d{4}-\d{2}-\d{2})$/i);
  if(m&&isoParts(m[1])&&isoParts(m[2])&&m[1]<=m[2])return {start:m[1],end:m[2]};
  m=s.match(/^([A-Za-z]{3,9})\s+(\d{1,2})(?:\s*[–—-]\s*(\d{1,2}))?,\s*(\d{4})$/);
  if(m){const mm=month(m[1]),a=iso(+m[4],mm,+m[2]),b=iso(+m[4],mm,+(m[3]||m[2]));if(a&&b&&a<=b)return {start:a,end:b};}
  m=s.match(/^([A-Za-z]{3,9})\s+(\d{1,2})\s*[–—-]\s*([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})$/);
  if(m){const a=iso(+m[5],month(m[1]),+m[2]),b=iso(+m[5],month(m[3]),+m[4]);if(a&&b&&a<=b)return {start:a,end:b};}
  m=s.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})\s*[–—-]\s*([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})$/);
  if(m){const a=iso(+m[3],month(m[1]),+m[2]),b=iso(+m[6],month(m[4]),+m[5]);if(a&&b&&a<=b)return {start:a,end:b};}
  m=s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s*(?:–|—|\-|to)\s*(\d{1,2})\/(\d{1,2})\/(\d{4}))?$/i);
  if(m){const a=iso(+m[3],+m[1],+m[2]),b=m[4]?iso(+m[6],+m[4],+m[5]):a;if(a&&b&&a<=b)return {start:a,end:b};}
  return null;
}
export function daysForCoaster(setSize=4,setCount=1){const size=int(setSize,1,100),count=int(setCount,1,100);return (size===4?2:size===8?3:Math.max(2,Math.ceil(size/4)*2))*count;}
export function awarenessForQueue(orders=[],today=todayMountain()){
  return orders.filter(row=>PRINTING.has(String(row.status||'').toUpperCase())).map(row=>{
    const promised=parseWindow(row.promisedWindow),projected=isoParts(row.projectedShipEnd)?row.projectedShipEnd:null;
    let state='ON_TRACK',detail='The projection fits inside the saved window.';
    if(row.isPaused){state='PAUSED';detail='Paused production needs an updated estimate before a customer promise can be checked.';}
    else if(!promised){state='NO_WINDOW';detail='No readable committed production window.';}
    else if(promised.end<today){state='OVERDUE';detail='The committed production window has passed.';}
    else if(projected&&projected>promised.end){state='AT_RISK';detail=`Current queue projection reaches ${formatDate(projected)}, after the committed ${formatDate(promised.end)}.`;}
    else if(promised.end===today){state='DUE_TODAY';detail='Production window ends today.';}
    return {sourceType:clean(row.sourceType,20),sourceOrderId:clean(row.sourceOrderId,80),status:state,detail,promisedWindow:clean(row.promisedWindow,160),projectedWindow:clean(row.projectedWindow,160),projectedEnd:projected||'',paused:!!row.isPaused,itemSummary:clean(row.itemSummary,120)};
  });
}
export function suggestWindow({today,commitments=[],capacityEnd='',setSize=4,setCount=1,orderId='',sourceType='COASTER'}){
  const key=`${sourceType}:${orderId}`;
  let lastEnd='',unreadable=0,checked=0;
  for(const row of commitments){if(!ACTIVE.has(String(row.status||'').toUpperCase()))continue;if(row.sourceType+':'+row.orderId===key)continue;
    if(!clean(row.productionWindow))continue;
    const w=parseWindow(row.productionWindow);if(!w){unreadable++;continue;}
    checked++;if(w.end>lastEnd)lastEnd=w.end;
  }
  // One workday after the latest committed end. This is conservative: it
  // deliberately doesn't double-book simultaneous printer capacity.
  const start=nextBusinessDay(lastEnd>today?lastEnd:today);
  const allowanceDays=daysForCoaster(setSize,setCount);
  let end=addBusinessDays(start,allowanceDays-1);
  const validCapacity=isoParts(capacityEnd)?capacityEnd:'';
  const capacityExtended=!!validCapacity&&validCapacity>end;
  if(capacityExtended)end=validCapacity;
  return {start,end,label:formatWindow(start,end),allowanceBusinessDays:allowanceDays,lastCommittedEnd:lastEnd||null,capacityEnd:validCapacity||null,capacityExtended,commitmentsChecked:checked,unreadableWindows:unreadable,businessDaysOnly:true,advisory:true};
}
export async function getProductionAwareness(env,{setSize=4,setCount=1,minutes=650,orderId='',sourceType='COASTER'}={}){
  const size=int(setSize,1,100),count=int(setCount,1,100),candidateMinutes=int(minutes,1,1000000),id=clean(orderId,80),type=clean(sourceType,20).toUpperCase();
  const db=requireOrdersDb(env);
  const [dashboard,estimate,committed]=await Promise.all([
    manufacturingDashboard(env),estimateManufacturingWindow(env,candidateMinutes),
    db.prepare(`SELECT 'COASTER' AS source_type,order_id,status,production_window FROM coaster_orders WHERE production_window IS NOT NULL AND production_window<>''
      UNION ALL SELECT 'ENCLOSURE',order_id,status,production_window FROM enclosure_orders WHERE production_window IS NOT NULL AND production_window<>''
      UNION ALL SELECT 'CUSTOM',order_id,status,production_window FROM custom_orders WHERE production_window IS NOT NULL AND production_window<>''`).all()
  ]);
  const commitments=(committed.results||[]).map(x=>({sourceType:x.source_type,orderId:x.order_id,status:x.status,productionWindow:x.production_window}));
  const today=todayMountain(),alerts=awarenessForQueue(dashboard.orders||[],today);
  const suggested=suggestWindow({today,commitments,capacityEnd:estimate.suggestedShipEnd,setSize:size,setCount:count,orderId:id,sourceType:type});
  return {today,suggested,alerts,summary:{atRisk:alerts.filter(x=>x.status==='AT_RISK').length,overdue:alerts.filter(x=>x.status==='OVERDUE').length,missing:alerts.filter(x=>x.status==='NO_WINDOW').length,dueToday:alerts.filter(x=>x.status==='DUE_TODAY').length,paused:alerts.filter(x=>x.status==='PAUSED').length,active:alerts.length},capacity:{activePrinters:dashboard.settings.activePrinters,remainingPrinterMinutes:dashboard.summary.remainingPrinterMinutes,queuePosition:estimate.queuePosition},config:{setSize:size,setCount:count,minutes:candidateMinutes}};
}
