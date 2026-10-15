import { requireOrdersDb } from './orders.js';
import { clean, makeError } from './coaster-order-util.js';
import { logEvent } from './coaster-order-data.js';

export const PICKUP_TIME_ZONE='America/Denver';
const ACTIVE=new Set(['PRODUCTION_QUEUE','IN_PRODUCTION','PREPARING_FOR_PICKUP','READY_FOR_PICKUP']);
function mountainParts(now=new Date()) {
 const values=new Intl.DateTimeFormat('en-US',{timeZone:PICKUP_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const p=Object.fromEntries(values.filter(v=>v.type!=='literal').map(v=>[v.type,v.value]));
 return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`};
}
export function validatePickupSlot(dateValue,timeValue,now=new Date()) {
 const localDate=clean(dateValue,10),localTime=clean(timeValue,5);
 if(!/^\d{4}-\d{2}-\d{2}$/.test(localDate))throw makeError('Choose a valid pickup date.',400);
 const dt=new Date(localDate+'T12:00:00Z');
 if(!Number.isFinite(dt.getTime())||dt.toISOString().slice(0,10)!==localDate)throw makeError('Choose a valid pickup date.',400);
 if([0,6].includes(dt.getUTCDay()))throw makeError('No weekend pickup appointments are offered.',400);
 if(!/^\d{2}:\d{2}$/.test(localTime))throw makeError('Choose a valid pickup time.',400);
 const [hour,minute]=localTime.split(':').map(Number);
 if(hour<9||hour>16||minute>59||minute%15!==0)throw makeError('Offered times must start between 9:00 AM and 4:45 PM in 15-minute increments.',400);
 const current=mountainParts(now);
 if(localDate<current.date||(localDate===current.date&&localTime<=current.time))throw makeError('Choose a future pickup time.',400);
 if(localDate>new Date(now.getTime()+120*86400000).toISOString().slice(0,10))throw makeError('Pickup slots are limited to 120 days ahead.',400);
 return {localDate,localTime};
}
async function getOrder(db,orderId){
 const order=await db.prepare('SELECT order_id AS orderId,status,fulfillment_method AS fulfillmentMethod FROM coaster_orders WHERE order_id=? LIMIT 1').bind(clean(orderId,80)).first();
 if(!order)throw makeError('Coaster order not found.',404);
 return order;
}
function eligible(order){return order.fulfillmentMethod==='LOCAL_PICKUP'&&ACTIVE.has(String(order.status||'').toUpperCase());}
function requireEligible(order){if(!eligible(order))throw makeError('Only active Local Pickup orders can have offered pickup times.',409);}
export async function getCoasterPickupSlots(env,orderId){
 const db=requireOrdersDb(env),order=await getOrder(db,orderId);
 const rows=await db.prepare("SELECT id,local_date AS localDate,local_time AS localTime,duration_minutes AS durationMinutes,status FROM coaster_pickup_slots WHERE order_id=? AND status != 'WITHDRAWN' ORDER BY local_date,local_time").bind(order.orderId).all();
 return {orderId:order.orderId,status:order.status,fulfillmentMethod:order.fulfillmentMethod,timeZone:PICKUP_TIME_ZONE,durationMinutes:15,enabled:eligible(order),slots:rows.results||[]};
}
export async function addCoasterPickupSlot(env,orderId,body={}){
 const db=requireOrdersDb(env),order=await getOrder(db,orderId);requireEligible(order);
 const {localDate,localTime}=validatePickupSlot(body.date,body.time);
 const taken=await db.prepare("SELECT id FROM coaster_pickup_appointments WHERE local_date=? AND local_time=? AND status='CONFIRMED' LIMIT 1").bind(localDate,localTime).first();
 if(taken)throw makeError('That pickup time is already booked.',409);
 const existing=await db.prepare('SELECT id,status FROM coaster_pickup_slots WHERE order_id=? AND local_date=? AND local_time=?').bind(order.orderId,localDate,localTime).first();
 if(existing&&existing.status!=='WITHDRAWN')throw makeError('That time is already offered for this order.',409);
 if(existing)await db.prepare("UPDATE coaster_pickup_slots SET status='OFFERED',updated_at=CURRENT_TIMESTAMP WHERE id=? AND order_id=? AND status='WITHDRAWN'").bind(existing.id,order.orderId).run();
 else await db.prepare('INSERT INTO coaster_pickup_slots(order_id,local_date,local_time) VALUES(?,?,?)').bind(order.orderId,localDate,localTime).run();
 await logEvent(db,order.orderId,'PICKUP_SLOT_OFFERED',{localDate,localTime,timeZone:PICKUP_TIME_ZONE});
 return getCoasterPickupSlots(env,order.orderId);
}
export async function withdrawCoasterPickupSlot(env,orderId,body={}){
 const db=requireOrdersDb(env),order=await getOrder(db,orderId);requireEligible(order);
 const id=Number(body.slotId);
 if(!Number.isSafeInteger(id)||id<1)throw makeError('Choose a valid pickup slot.',400);
 const existing=await db.prepare('SELECT id,local_date AS localDate,local_time AS localTime,status FROM coaster_pickup_slots WHERE id=? AND order_id=?').bind(id,order.orderId).first();
 if(!existing||existing.status!=='OFFERED')throw makeError('Only offered, unbooked times can be withdrawn.',409);
 await db.prepare("UPDATE coaster_pickup_slots SET status='WITHDRAWN',updated_at=CURRENT_TIMESTAMP WHERE id=? AND order_id=? AND status='OFFERED'").bind(id,order.orderId).run();
 await logEvent(db,order.orderId,'PICKUP_SLOT_WITHDRAWN',{localDate:existing.localDate,localTime:existing.localTime});
 return getCoasterPickupSlots(env,order.orderId);
}
