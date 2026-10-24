/* WestTech coaster pickup Stage 2: private, token-scoped scheduling.
 * No address, email delivery, PayPal, or order-status transitions here.
 */
import { requireOrdersDb } from './orders.js';
import { makeError, clean, newToken, sha256, tokenExpiry } from './coaster-order-util.js';
import { logEvent } from './coaster-order-data.js';
import { validatePickupSlot } from './coaster-pickup-slots.js';

const ZONE='America/Denver';
const ACTIVE=new Set(['PRODUCTION_QUEUE','IN_PRODUCTION','PREPARING_FOR_PICKUP','READY_FOR_PICKUP']);
function rows(x){return x?.results||[];}
function mountainParts(instant=new Date()){
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-US',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(instant).filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  return {date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}`,p};
}
function utcForMountain(date,time){
  const [y,m,d]=date.split('-').map(Number),[h,min]=time.split(':').map(Number);
  const desired=Date.UTC(y,m-1,d,h,min,0);
  let guess=desired;
  for(let i=0;i<4;i++){
    const p=mountainParts(new Date(guess)).p;
    const apparent=Date.UTC(Number(p.year),Number(p.month)-1,Number(p.day),Number(p.hour),Number(p.minute),0);
    const next=guess+(desired-apparent);
    if(next===guess)break;
    guess=next;
  }
  const v=mountainParts(new Date(guess));
  if(v.date!==date||v.time!==time)throw makeError('That date and time is not available. Please choose another.',400);
  return new Date(guess).toISOString();
}
function validateAlternative(dateValue,timeValue,now=new Date()){
  const date=clean(dateValue,10),time=clean(timeValue,5);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw makeError('Choose a valid weekday date.',400);
  const day=new Date(date+'T12:00:00Z');
  if(!Number.isFinite(day.getTime())||day.toISOString().slice(0,10)!==date)throw makeError('Choose a valid weekday date.',400);
  if(day.getUTCDay()===0||day.getUTCDay()===6)throw makeError('Weekend pickups are not available.',400);
  if(!/^\d{2}:\d{2}$/.test(time))throw makeError('Choose a valid time.',400);
  const [h,m]=time.split(':').map(Number);
  if(h<8||h>18||m>59||m%15!==0||(h===18&&m!==0))throw makeError('Choose a time from 8:00 AM to 6:00 PM in 15-minute increments.',400);
  const current=mountainParts(now);
  if(date<current.date||(date===current.date&&time<=current.time))throw makeError('Choose a future pickup time.',400);
  if(date>mountainParts(new Date(now.getTime()+120*86400000)).date)throw makeError('Pickup requests are limited to 120 days ahead.',400);
  utcForMountain(date,time);
  return {date,time};
}
async function orderFor(db,id){
  const row=await db.prepare('SELECT order_id AS orderId,status,fulfillment_method AS fulfillmentMethod FROM coaster_orders WHERE order_id=? LIMIT 1').bind(clean(id,80)).first();
  if(!row)throw makeError('Order not found.',404);
  return row;
}
function requireLocal(order){if(order.fulfillmentMethod!=='LOCAL_PICKUP'||!ACTIVE.has(order.status))throw makeError('Pickup scheduling is not available for this order.',409);}
function requireReady(order){if(order.fulfillmentMethod!=='LOCAL_PICKUP'||order.status!=='READY_FOR_PICKUP')throw makeError('Pickup scheduling opens when your order is Ready for Pickup.',409);}
async function appointmentFor(db,id){return db.prepare("SELECT id,local_date AS localDate,local_time AS localTime,start_at_utc AS startAtUtc,status FROM coaster_pickup_appointments WHERE order_id=? AND status='CONFIRMED' ORDER BY id DESC LIMIT 1").bind(id).first();}
async function requestsFor(db,id){
  const requests=rows(await db.prepare("SELECT id,first_date AS firstDate,first_time AS firstTime,second_date AS secondDate,second_time AS secondTime,status,created_at AS createdAt FROM coaster_pickup_requests WHERE order_id=? ORDER BY id DESC LIMIT 25").bind(id).all());
  // Each round's offered appointments are snapshotted in the existing order-history
  // event table. No new D1 migration and no ambiguity when newer slots are added.
  const events=rows(await db.prepare("SELECT detail FROM coaster_order_events WHERE order_id=? AND event_type='PICKUP_ALTERNATIVE_COUNTER_OFFERED' ORDER BY id DESC LIMIT 200").bind(id).all());
  const byRequest=new Map();
  for(const event of events){
    try{
      const detail=JSON.parse(event.detail||'{}');
      if(Number.isSafeInteger(detail.requestId)&&Array.isArray(detail.slots)&&!byRequest.has(detail.requestId)){
        byRequest.set(detail.requestId,detail.slots.filter(s=>Number.isSafeInteger(s.id)&&/^\d{4}-\d{2}-\d{2}$/.test(s.localDate)&&/^\d{2}:\d{2}$/.test(s.localTime)).slice(0,100));
      }
    }catch(_){/* Older event details may be plain text. */}
  }
  return requests.map(r=>({...r,counterSlots:byRequest.get(r.id)||null}));
}
async function slotsFor(db,id){
  const now=mountainParts();
  return rows(await db.prepare("SELECT s.id,s.local_date AS localDate,s.local_time AS localTime FROM coaster_pickup_slots s WHERE s.order_id=? AND s.status='OFFERED' AND s.local_date>=? AND NOT EXISTS(SELECT 1 FROM coaster_pickup_appointments a WHERE a.local_date=s.local_date AND a.local_time=s.local_time AND a.status='CONFIRMED') ORDER BY s.local_date,s.local_time LIMIT 100").bind(id,now.date).all()).filter(x=>x.localDate>now.date||x.localTime>now.time);
}
async function bookDate(db,order,date,time,slotId=null,source='CUSTOMER'){
  requireReady(order);
  const current=await appointmentFor(db,order.orderId);
  if(current)throw makeError('This order already has a confirmed pickup appointment.',409);
  const start=utcForMountain(date,time),end=new Date(Date.parse(start)+15*60000).toISOString();
  // INSERT ... SELECT serializes one confirmed appointment per order; the existing
  // unique active start_at_utc index additionally protects against double booking.
  try{
    const inserted=await db.prepare("INSERT INTO coaster_pickup_appointments (order_id,slot_id,start_at_utc,end_at_utc,local_date,local_time) SELECT ?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM coaster_pickup_appointments WHERE order_id=? AND status='CONFIRMED')").bind(order.orderId,slotId,start,end,date,time,order.orderId).run();
    if(Number(inserted?.meta?.changes||0)!==1)throw makeError('A pickup appointment has already been booked for this order.',409);
  }catch(e){if(/UNIQUE|constraint/i.test(String(e.message||'')))throw makeError('That pickup time was just booked. Please choose another.',409);throw e;}
  if(slotId)await db.prepare("UPDATE coaster_pickup_slots SET status='BOOKED',updated_at=CURRENT_TIMESTAMP WHERE id=? AND order_id=? AND status='OFFERED'").bind(slotId,order.orderId).run();
  await logEvent(db,order.orderId,'PICKUP_CONFIRMED',{localDate:date,localTime:time,timeZone:ZONE,source});
  return appointmentFor(db,order.orderId);
}
async function resolved(env,raw){
  const token=clean(raw,128).toLowerCase();
  if(!/^[a-f0-9]{64}$/.test(token))throw makeError('This scheduling link is invalid or expired. Please contact WestTech.',404);
  const db=requireOrdersDb(env),hash=await sha256(token);
  const row=await db.prepare("SELECT l.order_id AS orderId FROM coaster_pickup_links l WHERE l.token_hash=? AND l.revoked_at IS NULL AND datetime(l.expires_at)>CURRENT_TIMESTAMP AND l.id=(SELECT MAX(id) FROM coaster_pickup_links WHERE order_id=l.order_id) LIMIT 1").bind(hash).first();
  if(!row)throw makeError('This scheduling link is invalid or expired. Please contact WestTech.',404);
  const order=await orderFor(db,row.orderId);
  if(order.fulfillmentMethod!=='LOCAL_PICKUP')throw makeError('This scheduling link is not available.',404);
  return {db,order};
}
export async function createAdminPickupLink(env,orderId,siteUrl){
  const db=requireOrdersDb(env),order=await orderFor(db,orderId);requireLocal(order);
  const token=newToken(),hash=await sha256(token);
  await db.prepare('UPDATE coaster_pickup_links SET revoked_at=CURRENT_TIMESTAMP WHERE order_id=? AND revoked_at IS NULL').bind(order.orderId).run();
  await db.prepare('INSERT INTO coaster_pickup_links(order_id,token_hash,expires_at) VALUES (?,?,?)').bind(order.orderId,hash,tokenExpiry(30)).run();
  await logEvent(db,order.orderId,'PICKUP_LINK_CREATED',{expiresInDays:30});
  // Only the one-time admin response ever contains the secret. Store the hash in D1.
  return `${clean(siteUrl,400).replace(/\/+$/,'')}/coasters/schedule-pickup.html#key=${token}`;
}
export async function adminPickupExtra(env,orderId){
  const db=requireOrdersDb(env),order=await orderFor(db,orderId);
  const link=await db.prepare('SELECT expires_at AS expiresAt FROM coaster_pickup_links WHERE order_id=? AND revoked_at IS NULL AND datetime(expires_at)>CURRENT_TIMESTAMP ORDER BY id DESC LIMIT 1').bind(order.orderId).first();
  return {appointment:await appointmentFor(db,order.orderId),requests:await requestsFor(db,order.orderId),linkActive:!!link,linkExpiresAt:link?.expiresAt||'',canCreateLink:order.fulfillmentMethod==='LOCAL_PICKUP'&&ACTIVE.has(order.status)};
}
async function viewPickupForOrder(db,order){
  const ready=order.status==='READY_FOR_PICKUP';
  const appointment=await appointmentFor(db,order.orderId);
  const requests=await requestsFor(db,order.orderId);
  const currentRequest=requests.find(x=>['PENDING','COUNTER_OFFERED'].includes(x.status))||null;
  let slots=ready&&!appointment?await slotsFor(db,order.orderId):[];
  // For a counter-offer, display only the slots WestTech selected for that
  // round. Old Stage 2 requests have no snapshot, so remain backward-compatible.
  if(currentRequest?.status==='COUNTER_OFFERED'&&Array.isArray(currentRequest.counterSlots)){
    const selected=new Set(currentRequest.counterSlots.map(s=>s.id));
    slots=slots.filter(s=>selected.has(s.id));
  }
  return {orderId:order.orderId,ready,orderStatus:order.status,timezone:ZONE,appointment,request:currentRequest,slots,today:mountainParts().date,needsAddressConfirmation:true};
}
async function bookPickupForOrder(db,order,slotId){
  requireReady(order);
  const id=Number(slotId);if(!Number.isSafeInteger(id)||id<1)throw makeError('Choose an available pickup time.',400);
  const requests=await requestsFor(db,order.orderId);
  if(requests.some(x=>x.status==='PENDING'))throw makeError('An alternate-time request is awaiting WestTech review.',409);
  const counter=requests.find(x=>x.status==='COUNTER_OFFERED');
  if(counter&&Array.isArray(counter.counterSlots)&&!counter.counterSlots.some(s=>s.id===id))throw makeError('That time is not part of WestTech’s latest counter-offer. Please refresh your scheduling page.',409);
  const slot=await db.prepare("SELECT id,local_date AS localDate,local_time AS localTime FROM coaster_pickup_slots WHERE id=? AND order_id=? AND status='OFFERED'").bind(id,order.orderId).first();
  if(!slot)throw makeError('That pickup slot is no longer available.',409);
  validatePickupSlot(slot.localDate,slot.localTime);
  const appointment=await bookDate(db,order,slot.localDate,slot.localTime,id);
  await db.prepare("UPDATE coaster_pickup_requests SET status='CLOSED',updated_at=CURRENT_TIMESTAMP WHERE order_id=? AND status='COUNTER_OFFERED'").bind(order.orderId).run();
  return {appointment,view:await viewPickupForOrder(db,order)};
}
async function requestAlternativeForOrder(db,order,first,second){
  requireReady(order);
  if(await appointmentFor(db,order.orderId))throw makeError('A pickup appointment is already confirmed.',409);
  const existing=await requestsFor(db,order.orderId);
  if(existing.some(x=>x.status==='PENDING'))throw makeError('An alternate-time request is already awaiting WestTech review.',409);
  const a=validateAlternative(first?.date,first?.time),b=second?.date||second?.time?validateAlternative(second?.date,second?.time):null;
  if(b&&a.date===b.date&&a.time===b.time)throw makeError('Choose a different second-choice appointment.',400);
  const previous=existing.find(x=>x.status==='COUNTER_OFFERED');
  // Closing the previous counter-offer and creating the next pending round
  // are a single D1 batch/transaction. Old rows and event history remain.
  const commands=[];
  if(previous)commands.push(db.prepare("UPDATE coaster_pickup_requests SET status='CLOSED',updated_at=CURRENT_TIMESTAMP WHERE order_id=? AND status='COUNTER_OFFERED'").bind(order.orderId));
  commands.push(db.prepare("INSERT INTO coaster_pickup_requests(order_id,first_date,first_time,second_date,second_time) SELECT ?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM coaster_pickup_requests WHERE order_id=? AND status IN ('PENDING','COUNTER_OFFERED'))").bind(order.orderId,a.date,a.time,b?.date||null,b?.time||null,order.orderId));
  const results=await db.batch(commands);
  const saved=results[results.length-1];
  if(Number(saved?.meta?.changes||0)!==1)throw makeError('An alternate-time request is already being reviewed.',409);
  await logEvent(db,order.orderId,previous?'PICKUP_ALTERNATIVE_REVISED':'PICKUP_ALTERNATIVE_REQUESTED',{first:a,second:b,previousRequestId:previous?.id||null});
  return viewPickupForOrder(db,order);
}

// Token-based Stage 2 scheduling and session-verified Stage 3 portal both use
// the same ordering, counter-offer, validation and booking rules.
export async function viewCustomerPickup(env,token){
  const {db,order}=await resolved(env,token);return viewPickupForOrder(db,order);
}
export async function bookCustomerPickup(env,token,slotId){
  const {db,order}=await resolved(env,token);return bookPickupForOrder(db,order,slotId);
}
export async function requestCustomerAlternative(env,token,first,second){
  const {db,order}=await resolved(env,token);return requestAlternativeForOrder(db,order,first,second);
}
export async function viewPortalPickup(env,orderId){
  const db=requireOrdersDb(env),order=await orderFor(db,orderId);return viewPickupForOrder(db,order);
}
export async function bookPortalPickup(env,orderId,slotId){
  const db=requireOrdersDb(env),order=await orderFor(db,orderId);return bookPickupForOrder(db,order,slotId);
}
export async function requestPortalPickupAlternative(env,orderId,first,second){
  const db=requireOrdersDb(env),order=await orderFor(db,orderId);return requestAlternativeForOrder(db,order,first,second);
}
export async function decideAdminPickupRequest(env,orderId,requestId,decision,selectedSlotIds=[]){
  const db=requireOrdersDb(env),order=await orderFor(db,orderId);requireReady(order);
  const id=Number(requestId);if(!Number.isSafeInteger(id)||id<1)throw makeError('Invalid pickup request.',400);
  const r=await db.prepare("SELECT id,first_date AS firstDate,first_time AS firstTime,second_date AS secondDate,second_time AS secondTime,status FROM coaster_pickup_requests WHERE id=? AND order_id=?").bind(id,order.orderId).first();
  if(!r||r.status!=='PENDING')throw makeError('This request is no longer awaiting review.',409);
  if(decision==='first'||decision==='second'){
    const d=decision==='first'?r.firstDate:r.secondDate,t=decision==='first'?r.firstTime:r.secondTime;
    if(!d||!t)throw makeError('That requested time is missing.',400);
    validateAlternative(d,t);
    await bookDate(db,order,d,t,null,'ADMIN_ALTERNATIVE');
    await db.prepare("UPDATE coaster_pickup_requests SET status='APPROVED',updated_at=CURRENT_TIMESTAMP WHERE id=? AND order_id=? AND status='PENDING'").bind(id,order.orderId).run();
    await logEvent(db,order.orderId,'PICKUP_ALTERNATIVE_APPROVED',{choice:decision,localDate:d,localTime:t});
  }else if(decision==='counter'){
    const offered=await slotsFor(db,order.orderId);
    if(!Array.isArray(selectedSlotIds)||!selectedSlotIds.length||selectedSlotIds.length>100)throw makeError('Select at least one offered time for this counter-offer.',400);
    const ids=selectedSlotIds.map(Number);
    if(ids.some(x=>!Number.isSafeInteger(x)||x<1)||new Set(ids).size!==ids.length)throw makeError('Please select valid pickup slots.',400);
    const selected=offered.filter(x=>ids.includes(x.id));
    if(selected.length!==ids.length)throw makeError('One of those pickup times is no longer available. Refresh and try again.',409);
    const slots=selected.map(x=>({id:x.id,localDate:x.localDate,localTime:x.localTime}));
    const updated=await db.batch([
      db.prepare("UPDATE coaster_pickup_requests SET status='COUNTER_OFFERED',updated_at=CURRENT_TIMESTAMP WHERE id=? AND order_id=? AND status='PENDING'").bind(id,order.orderId),
      db.prepare("INSERT INTO coaster_order_events(order_id,event_type,detail) VALUES (?,'PICKUP_ALTERNATIVE_COUNTER_OFFERED',?)").bind(order.orderId,JSON.stringify({requestId:id,slots,offeredCount:slots.length}))
    ]);
    if(Number(updated?.[0]?.meta?.changes||0)!==1)throw makeError('This request was already handled. Refresh scheduling.',409);
  }else throw makeError('Choose an approval option or counter-offer.',400);
  return adminPickupExtra(env,order.orderId);
}
