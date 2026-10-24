/* Customer portal proof access. Never expose R2 keys or legacy approval tokens. */
import { requireCustomerSession } from './customer-account.js';
import { requireOrdersDb } from './orders.js';
import { makeError } from './coaster-order-util.js';

export async function requireCustomerCoasterProof(context){
  const account=await requireCustomerSession(context);
  const type=String(context.params.sourceType||'').toUpperCase();
  const id=String(context.params.orderId||'');
  if(type!=='COASTER'||!/^WTCC-[A-Za-z0-9-]{1,72}$/.test(id))throw makeError('Order not available.',404);
  const db=requireOrdersDb(context.env);
  const order=await db.prepare(`SELECT o.order_id AS orderId,o.status,o.proof_status AS proofStatus,o.proof_version AS proofVersion,
    o.proof_source AS proofSource,o.proof_object_key AS proofObjectKey,o.proof_content_type AS proofContentType,
    o.proof_sent_at AS proofSentAt,o.proof_approved_at AS proofApprovedAt,o.approval_expires_at AS approvalExpiresAt,
    o.customer_change_request AS customerChangeRequest,o.customer_review_note AS customerReviewNote,
    o.set_size AS setSize,o.set_count AS setCount,o.total_coasters AS totalCoasters,
    o.fulfillment_method AS fulfillmentMethod,o.production_window AS productionWindow,
    o.final_amount AS finalAmount,o.shipping_amount AS shippingAmount,o.payment_required AS paymentRequired,
    o.base_price AS basePrice,o.artwork_charge AS artworkCharge,o.other_charge AS otherCharge,o.discount_amount AS discountAmount,
    (SELECT COALESCE(SUM(w.billable_amount),0) FROM coaster_order_work_log w WHERE w.order_id=o.order_id) AS billableWorkTotal,
    o.payment_status AS paymentStatus
    FROM customer_account_orders a JOIN coaster_orders o
    ON a.source_type='COASTER' AND a.source_order_id=o.order_id
    WHERE a.account_id=? AND o.order_id=? LIMIT 1`).bind(account.id,id).first();
  if(!order)throw makeError('Order not available in this customer account.',404);
  return {account,order};
}

export function publicCustomerProof(order){
  const status=String(order.status||'').toUpperCase(),proofStatus=String(order.proofStatus||'').toUpperCase();
  const released=Number(order.proofVersion||0)>0&&!!order.proofObjectKey;
  const expiry=order.approvalExpiresAt?Date.parse(String(order.approvalExpiresAt).replace(' ','T').replace(/Z?$/,'Z')):NaN;
  const reviewExpired=!(Number.isFinite(expiry)&&expiry>Date.now());
  return {orderId:order.orderId,status,proofStatus,proofVersion:Number(order.proofVersion||0),
    hasProof:released,reviewExpired,proofIsPdf:String(order.proofContentType||'').toLowerCase().split(';')[0].trim()==='application/pdf',
    proofSentAt:order.proofSentAt||null,proofApprovedAt:order.proofApprovedAt||null,
    customerChangeRequest:order.customerChangeRequest||'',customerReviewNote:order.customerReviewNote||'',
    setSize:Number(order.setSize||4),setCount:Number(order.setCount||1),totalCoasters:Number(order.totalCoasters||4),
    fulfillmentMethod:order.fulfillmentMethod||'UNSET',productionWindow:order.productionWindow||'',
    finalAmount:Number(order.finalAmount||0),shippingAmount:Number(order.shippingAmount||0),
    basePrice:Number(order.basePrice||0),artworkCharge:Number(order.artworkCharge||0),billableWorkTotal:Number(order.billableWorkTotal||0),
    otherCharge:Number(order.otherCharge||0),discountAmount:Number(order.discountAmount||0),
    paymentRequired:!!Number(order.paymentRequired),paymentStatus:order.paymentStatus||'NOT_REQUESTED',
    canRespond:released&&!reviewExpired&&status==='PROOF_SENT'&&proofStatus==='SENT'&&String(order.paymentStatus).toUpperCase()!=='PAID'};
}
