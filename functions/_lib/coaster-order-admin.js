import { requireOrdersDb } from './orders.js';
import { billableTotal, getCoasterOrderDetail, logEvent } from './coaster-order-data.js';
import { bool, calcTotal, clean, integer, isLocked, makeError, nowIso, number, termsFrozen } from './coaster-order-util.js';

const PRODUCTION_STATUSES = new Set(['PRODUCTION_QUEUE','IN_PRODUCTION','READY_FOR_PICKUP','SHIPPED','COMPLETED']);

export async function updateCoasterOrderAdmin(env,orderId,payload={}){
  const db=requireOrdersDb(env);const order=await getCoasterOrderDetail(env,orderId);if(!order)throw makeError('Coaster order not found.',404);
  const action=clean(payload.action,40)||'saveReview';
  if(action==='addWork'){
    const frozen=termsFrozen(order),minutes=integer(payload.minutes,0,100000),amount=frozen?0:number(payload.billableAmount,0,100000),workType=clean(payload.workType,80)||'DESIGN_WORK',note=clean(payload.note,1000);
    if(!minutes&&!amount&&!note)throw makeError('Add minutes, a note, or a billable amount.');
    await db.prepare(`INSERT INTO coaster_order_work_log (order_id,work_type,minutes,billable_amount,note) VALUES (?,?,?,?,?)`).bind(order.orderId,workType,minutes,amount,note).run();
    if(!frozen){const workTotal=await billableTotal(db,order.orderId),final=calcTotal({...order,workTotal});await db.prepare(`UPDATE coaster_orders SET final_amount=?,updated_at=CURRENT_TIMESTAMP WHERE order_id=?`).bind(final,order.orderId).run();}
    await logEvent(db,order.orderId,'WORK_LOGGED',{workType,minutes,billableAmount:amount,customerPriceLocked:frozen});return getCoasterOrderDetail(env,order.orderId);
  }
  if(action!=='saveReview')throw makeError('Unsupported admin action.');
  const locked=isLocked(order),frozen=termsFrozen(order);
  if(locked){
    const status=clean(payload.status,40)||order.status;if(!PRODUCTION_STATUSES.has(status))throw makeError('Approved production orders can only use production statuses.',409);
    if(status==='READY_FOR_PICKUP'&&order.fulfillmentMethod!=='LOCAL_PICKUP')throw makeError('Ready for Pickup is only valid for Local Pickup orders.');
    if(status==='SHIPPED'&&order.fulfillmentMethod!=='SHIP')throw makeError('Shipped is only valid for shipped orders.');
    const now=nowIso();
    await db.prepare(`UPDATE coaster_orders SET status=?,admin_notes=?,tracking_carrier=?,tracking_number=?,pickup_ready_at=CASE WHEN ?='READY_FOR_PICKUP' THEN COALESCE(pickup_ready_at,?) ELSE pickup_ready_at END,shipped_at=CASE WHEN ?='SHIPPED' THEN COALESCE(shipped_at,?) ELSE shipped_at END,completed_at=CASE WHEN ?='COMPLETED' THEN COALESCE(completed_at,?) ELSE completed_at END,updated_at=CURRENT_TIMESTAMP WHERE order_id=?`).bind(status,clean(payload.adminNotes,4000),clean(payload.trackingCarrier,100),clean(payload.trackingNumber,180),status,now,status,now,status,now,order.orderId).run();
    await logEvent(db,order.orderId,'PRODUCTION_UPDATED',{status,trackingCarrier:clean(payload.trackingCarrier,100),trackingNumber:clean(payload.trackingNumber,180),previousStatus:order.status});
    const updated=await getCoasterOrderDetail(env,order.orderId);updated._statusChanged=order.status!==status;return updated;
  }
  if(frozen){
    await db.prepare(`UPDATE coaster_orders SET admin_notes=?,updated_at=CURRENT_TIMESTAMP WHERE order_id=?`).bind(clean(payload.adminNotes,4000),order.orderId).run();
    await logEvent(db,order.orderId,'INTERNAL_NOTE_UPDATED','Customer proof/payment terms remained locked.');return getCoasterOrderDetail(env,order.orderId);
  }
  const setCount=integer(payload.setCount??order.setCount,1,125),totalCoasters=integer(payload.totalCoasters??setCount*order.setSize,1,500);if(totalCoasters!==setCount*order.setSize)throw makeError('Total coaster quantity does not match the selected set count.');
  const fulfillment=clean(payload.fulfillmentMethod,30)==='LOCAL_PICKUP'?'LOCAL_PICKUP':'SHIP',basePrice=number(payload.basePrice,0,100000),artworkCharge=number(payload.artworkCharge,0,100000),otherCharge=number(payload.otherCharge,0,100000),shipping=fulfillment==='LOCAL_PICKUP'?0:number(payload.shippingAmount,0,100000),discount=number(payload.discountAmount,0,100000),workTotal=await billableTotal(db,order.orderId),final=calcTotal({basePrice,setCount,artworkCharge,workTotal,otherCharge,shippingAmount:shipping,discountAmount:discount});
  const allowed=new Set(['DESIGN_REVIEW','CHANGES_REQUESTED']),candidate=clean(payload.status,40),status=allowed.has(candidate)?candidate:'DESIGN_REVIEW';
  await db.prepare(`UPDATE coaster_orders SET base_price=?,artwork_charge=?,other_charge=?,shipping_amount=?,discount_amount=?,final_amount=?,set_count=?,total_coasters=?,fulfillment_method=?,payment_required=?,status=?,customer_review_note=?,admin_notes=?,review_saved_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE order_id=?`).bind(basePrice,artworkCharge,otherCharge,shipping,discount,final,setCount,totalCoasters,fulfillment,bool(payload.paymentRequired)?1:0,status,clean(payload.customerReviewNote,3000),clean(payload.adminNotes,4000),order.orderId).run();
  await logEvent(db,order.orderId,'REVIEW_SAVED',{status,fulfillmentMethod:fulfillment,totalCoasters,finalAmount:final,paymentRequired:bool(payload.paymentRequired)});return getCoasterOrderDetail(env,order.orderId);
}
