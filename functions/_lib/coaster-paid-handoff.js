/* Stage 5K4: Preview Admin-only post-payment inspection and completion.
 * Never creates/captures/refunds a provider order or resets a payment lock.
 * Mutations require an existing PAID order and independently verified provider capture.
 */
import { getCoasterOrderDetail } from './coaster-orders.js';
import { requireOrdersDb } from './orders.js';
import { sanitizeEnvValue } from './shared.js';
import { repairCoasterPaidWorkOrder } from './coaster-paypal.js';
import { assignPaidCoasterSlot } from './production-awareness.js';
import { sendCoasterCustomerEmail } from './coaster-email.js';
import { sendCoasterAdminProductionEmail } from './coaster-admin-production-email.js';
import { inviteCustomerForOrder } from './customer-account.js';

const stop=(message,status=409)=>{throw Object.assign(new Error(message),{status});};
const paidStatuses=new Set(['PRODUCTION_QUEUE']);
const capturedEvents=new Set(['PAYPAL_ORDER_CAPTURED','VENMO_ORDER_CAPTURED']);
const trim=v=>String(v||'').trim();
function parseEvent(e){try{return JSON.parse(e.detail||'{}');}catch{return {};}}
function emailRecorded(events,key){return events.some(e=>e.event_type==='EMAIL_SENT'&&parseEvent(e).idempotencyKey===key);}

export async function inspectCoasterPaidHandoff(env,orderId){
 if(!/^WTCC-\d{8}-\d{1,6}$/.test(String(orderId||'')))stop('Invalid coaster order.',400);
 const order=await getCoasterOrderDetail(env,orderId);
 if(!order)stop('Coaster order not found.',404);
 const db=requireOrdersDb(env);
 const rows=await db.prepare("SELECT event_type,detail FROM coaster_order_events WHERE order_id=? AND event_type IN ('PAYPAL_ORDER_CAPTURED','VENMO_ORDER_CAPTURED','PRODUCTION_QUEUED','PRODUCTION_SLOT_ASSIGNED','EMAIL_SENT')")
  .bind(orderId).all();
 const events=rows?.results||[];
 const work=await db.prepare("SELECT id FROM manufacturing_work_orders WHERE source_type='COASTER' AND source_order_id=? LIMIT 1").bind(orderId).first();
 const attempt=await db.prepare("SELECT status FROM coaster_payment_attempts WHERE coaster_order_id=? AND method='VENMO' AND provider_order_id=? ORDER BY created_at DESC LIMIT 1")
  .bind(orderId,trim(order.paypalOrderId)).first();
 const paymentMethod=attempt?'VENMO':'PAYPAL';
 const captures=events.filter(e=>capturedEvents.has(e.event_type));
 const confirmedCapture=trim(order.paypalCaptureId);
 const capturedEvent=paymentMethod==='VENMO'?'VENMO_ORDER_CAPTURED':'PAYPAL_ORDER_CAPTURED';
 const validCaptureEvents=captures.every(e=>e.event_type===capturedEvent&&trim(parseEvent(e).captureId)===confirmedCapture);
 const ready=order.paymentStatus==='PAID'&&order.paypalOrderStatus==='COMPLETED'&&paidStatuses.has(order.status)&&
  !!trim(order.paypalOrderId)&&!!confirmedCapture&&validCaptureEvents&&captures.length<=1&&(!attempt||attempt.status==='CAPTURED');
 return {orderId,orderStatus:order.status,paymentStatus:order.paymentStatus,paymentMethod,
  providerOrderId:trim(order.paypalOrderId),captureId:confirmedCapture,venmoAttemptStatus:attempt?.status||null,
  eligible:ready,hasCaptureEvent:captures.length===1,hasQueueEvent:events.some(e=>e.event_type==='PRODUCTION_QUEUED'),
  hasProductionSlot:events.some(e=>e.event_type==='PRODUCTION_SLOT_ASSIGNED'),hasWorkOrder:!!work,
  customerEmailSent:emailRecorded(events,`coaster-production-queued-${orderId}`),
  adminEmailSent:emailRecorded(events,`coaster-admin-production-queue-${orderId}`),
  needsManualReview:!ready};
}

async function insertMissingEvent(db,orderId,providerOrderId,captureId,eventType,detail){
 // One conditional D1 statement: two Admin requests cannot insert the same event.
 const result=await db.prepare(`INSERT INTO coaster_order_events (order_id,event_type,detail)
 SELECT ?,?,? WHERE EXISTS (SELECT 1 FROM coaster_orders WHERE order_id=? AND payment_status='PAID' AND paypal_order_id=? AND paypal_capture_id=? AND status='PRODUCTION_QUEUE')
 AND NOT EXISTS (SELECT 1 FROM coaster_order_events WHERE order_id=? AND event_type=?)`)
  .bind(orderId,eventType,JSON.stringify(detail),orderId,providerOrderId,captureId,orderId,eventType).run();
 return Number(result?.meta?.changes||0)===1;
}

export async function repairCoasterPaidHandoff(env,orderId,providerOrderId,captureId,requestUrl=''){
 if(sanitizeEnvValue(env.PAYPAL_ENV).toLowerCase()!=='sandbox')stop('Handoff repair is Sandbox-only.',403);
 const before=await inspectCoasterPaidHandoff(env,orderId);
 const ref=trim(providerOrderId),cap=trim(captureId);
 if(!before.eligible||!ref||!cap||ref!==before.providerOrderId||cap!==before.captureId)
  stop('Paid order, capture ledger or exact payment references need manual review. No repair performed.');
 // This Stage 5K2 function independently GETs PayPal and verifies the exact
 // completed amount, currency, capture, and tax-locked shipping destination.
 // Its manufacturing UPSERT is idempotent. It NEVER calls provider /capture.
 const verified=await repairCoasterPaidWorkOrder(env,orderId,ref,cap);
 if(!verified?.order||verified.order.paymentStatus!=='PAID')stop('Provider payment verification failed.');
 const checked=await inspectCoasterPaidHandoff(env,orderId);
 if(!checked.eligible||checked.providerOrderId!==ref||checked.captureId!==cap||checked.paymentMethod!==before.paymentMethod)
  stop('Order or Venmo attempt changed during verification; nothing else repaired.');
 const db=requireOrdersDb(env),method=checked.paymentMethod;
 const captureEvent=method==='VENMO'?'VENMO_ORDER_CAPTURED':'PAYPAL_ORDER_CAPTURED';
 const addedCapture=await insertMissingEvent(db,orderId,ref,cap,captureEvent,
  {method,paypalOrderId:ref,captureId:cap,paymentStatus:'PAID',approvedSubtotal:Number(verified.order.finalAmount),
   taxAmount:Number(verified.order.taxAmount),paymentTotal:Number(verified.order.paymentTotal),recoveredHandoff:true});
 const addedQueue=await insertMissingEvent(db,orderId,ref,cap,'PRODUCTION_QUEUED',
  {reason:'PAYMENT_RECEIVED',paypalOrderId:ref,captureId:cap,recoveredHandoff:true});
 // Schedule only if the original post-payment assignment did not finish.
 // An existing PRODUCTION_SLOT_ASSIGNED event is never changed.
 let slot={alreadyAssigned:true};
 if(!checked.hasProductionSlot){
  try{slot=await assignPaidCoasterSlot(env,orderId);}
  catch(error){slot={assigned:false,reviewRequired:true,reason:trim(error?.message).slice(0,300)};}
 }
 if(slot.reviewRequired){
  return {repaired:false,partial:true,addedCaptureEvent:addedCapture,addedQueueEvent:addedQueue,
   workOrder:verified.workOrder?.id||null,slot,notificationsDeferred:true,
   report:await inspectCoasterPaidHandoff(env,orderId)};
 }
 const latest=await getCoasterOrderDetail(env,orderId);
 if(!latest||latest.paymentStatus!=='PAID'||latest.paypalOrderId!==ref||latest.paypalCaptureId!==cap||latest.status!=='PRODUCTION_QUEUE')
  stop('Paid order changed before notifications. Inspect the order manually.');
 // Existing senders use stable Resend Idempotency-Key and EMAIL_SENT ledger checks.
 // Only send missing notifications, not emails already recorded as sent.
 const afterEvents=await inspectCoasterPaidHandoff(env,orderId);
 let customerEmail={sent:false,skipped:true,reason:'already-sent'};
 let adminEmail={sent:false,skipped:true,reason:'already-sent'};
 let accountInvite={sent:false,skipped:true,reason:'not-requested'};
 if(!afterEvents.customerEmailSent){
  try{customerEmail=await sendCoasterCustomerEmail(env,{type:'PRODUCTION_QUEUED',order:latest,requestUrl});}
  catch(e){customerEmail={sent:false,error:trim(e?.message).slice(0,300)};}
 }
 if(!afterEvents.adminEmailSent){
  try{adminEmail=await sendCoasterAdminProductionEmail(env,{order:latest,requestUrl});}
  catch(e){adminEmail={sent:false,error:trim(e?.message).slice(0,300)};}
 }
 try{accountInvite=await inviteCustomerForOrder(env,{sourceType:'COASTER',order:latest,requestUrl});}
 catch(e){accountInvite={sent:false,error:trim(e?.message).slice(0,300)};}
 const after=await inspectCoasterPaidHandoff(env,orderId);
 return {repaired:true,addedCaptureEvent:addedCapture,addedQueueEvent:addedQueue,
  workOrder:verified.workOrder?.id||null,slot,customerEmail,adminEmail,accountInvite,report:after};
}
