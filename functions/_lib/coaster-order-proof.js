import { requireOrdersDb } from './orders.js';
import { getCoasterOrderDetail, getStoredCoasterObject, logEvent } from './coaster-order-data.js';
import { clean, isLocked, makeError, newToken, nowIso, number, PROOF_TYPES, requireArtworkBucket, safeFilename, sha256, tokenExpiry } from './coaster-order-util.js';

export async function releaseCoasterProof(env,orderId,{source='SUBMITTED_DESIGN',proofFile=null,refreshOnly=false}={}){
  const db=requireOrdersDb(env),bucket=requireArtworkBucket(env);const order=await getCoasterOrderDetail(env,orderId);if(!order)throw makeError('Coaster order not found.',404);
  if(isLocked(order)||String(order.proofStatus).toUpperCase()==='APPROVED')throw makeError('Approved production order terms are locked.',409);
  if(!refreshOnly&&!['SHIP','LOCAL_PICKUP'].includes(order.fulfillmentMethod))throw makeError('Choose Ship Order or Local Pickup before releasing the proof.',409);
  if(!refreshOnly&&Number(order.estimatedPrinterMinutes||0)<=0)throw makeError('Enter the estimated printer minutes before releasing the proof.',409);
  if(!refreshOnly&&!clean(order.productionWindow,160))throw makeError('Enter the estimated production window before releasing the proof.',409);
  if(!refreshOnly&&order.paymentRequired&&number(order.finalAmount)<=0)throw makeError('Set a customer price, or turn Payment Required off, before releasing the proof.',409);
  if(refreshOnly){
    if(!order.proofVersion||!order.proofObjectKey)throw makeError('Release a proof first.',409);
    const token=newToken(),hash=await sha256(token),expires=tokenExpiry();
    await db.prepare(`UPDATE coaster_orders SET approval_token_hash=?,approval_expires_at=?,updated_at=CURRENT_TIMESTAMP WHERE order_id=?`).bind(hash,expires,order.orderId).run();
    await logEvent(db,order.orderId,'APPROVAL_LINK_REFRESHED',{proofVersion:order.proofVersion});return {order:await getCoasterOrderDetail(env,order.orderId),approvalToken:token};
  }
  let objectKey='',filename='',contentType='',size=0;const proofSource=source==='UPLOADED'?'UPLOADED':'SUBMITTED_DESIGN';
  if(proofSource==='UPLOADED'){
    if(!proofFile||typeof proofFile.arrayBuffer!=='function')throw makeError('Choose a proof file first.');contentType=clean(proofFile.type,100).toLowerCase();if(!PROOF_TYPES.has(contentType))throw makeError('Proof must be PNG, JPG, WEBP, SVG, or PDF.');if(Number(proofFile.size||0)<=0||Number(proofFile.size)>10*1024*1024)throw makeError('Proof must be 10 MB or smaller.');
    filename=safeFilename(proofFile.name,'proof');objectKey=`coasters/${order.orderId}/proofs/v${Number(order.proofVersion||0)+1}-${crypto.randomUUID()}-${filename}`;
    await bucket.put(objectKey,await proofFile.arrayBuffer(),{httpMetadata:{contentType},customMetadata:{orderId:order.orderId,kind:'westtech-proof'}});size=Number(proofFile.size||0);
  }else{
    if(!order.designSnapshotObjectKey)throw makeError('The submitted design snapshot is not available.',409);objectKey=order.designSnapshotObjectKey;filename='submitted-design.svg';contentType='image/svg+xml';const obj=await bucket.head(objectKey);size=Number(obj?.size||0);
  }
  const version=Number(order.proofVersion||0)+1,token=newToken(),hash=await sha256(token),expires=tokenExpiry(),sent=nowIso();
  await db.prepare(`UPDATE coaster_orders SET proof_version=?,proof_status='SENT',proof_source=?,proof_object_key=?,proof_filename=?,proof_content_type=?,proof_size_bytes=?,approval_token_hash=?,approval_expires_at=?,proof_sent_at=?,proof_approved_at=NULL,changes_requested_at=NULL,customer_change_request=NULL,payment_status='NOT_REQUESTED',paypal_order_id=NULL,paypal_approval_url=NULL,paypal_order_status=NULL,paypal_capture_id=NULL,paypal_last_error=NULL,taxable_amount=0,tax_amount=0,tax_rate=0,tax_jurisdiction_code=NULL,tax_source=NULL,tax_address_source=NULL,tax_address_json=NULL,tax_quote_json=NULL,payment_total=0,tax_prepared_at=NULL,tax_confirmed_at=NULL,status='PROOF_SENT',updated_at=CURRENT_TIMESTAMP WHERE order_id=?`).bind(version,proofSource,objectKey,filename,contentType,size,hash,expires,sent,order.orderId).run();
  await logEvent(db,order.orderId,'PROOF_RELEASED',{proofVersion:version,source:proofSource});return {order:await getCoasterOrderDetail(env,order.orderId),approvalToken:token};
}

export function approvalView(order){if(!order)return null;const work=(order.workLog||[]).reduce((s,r)=>s+Number(r.billableAmount||0),0);return {orderId:order.orderId,status:order.status,customerName:order.customerName,setSize:order.setSize,setCount:order.setCount,totalCoasters:order.totalCoasters,basePrice:order.basePrice,artworkCharge:order.artworkCharge,billableWorkTotal:work,otherCharge:order.otherCharge,shippingAmount:order.shippingAmount,discountAmount:order.discountAmount,finalAmount:order.finalAmount,fulfillmentMethod:order.fulfillmentMethod,paymentRequired:order.paymentRequired,customerReviewNote:order.customerReviewNote,estimatedPrinterMinutes:order.estimatedPrinterMinutes,productionWindow:order.productionWindow,proofVersion:order.proofVersion,proofStatus:order.proofStatus,proofSource:order.proofSource,proofContentType:order.proofContentType,proofFilename:order.proofFilename,paymentStatus:order.paymentStatus,paypalOrderId:order.paypalOrderId,paypalApprovalUrl:order.paypalApprovalUrl,paypalOrderStatus:order.paypalOrderStatus,paypalPaidAt:order.paypalPaidAt,taxableAmount:order.taxableAmount,taxAmount:order.taxAmount,taxRate:order.taxRate,taxJurisdictionCode:order.taxJurisdictionCode,taxSource:order.taxSource,taxAddressSource:order.taxAddressSource,taxAddressJson:order.taxAddressJson,paymentTotal:order.paymentTotal,taxPreparedAt:order.taxPreparedAt,taxConfirmedAt:order.taxConfirmedAt,customerChangeRequest:order.customerChangeRequest};}
export async function getCoasterApprovalByToken(env,orderId,token){const db=requireOrdersDb(env),hash=await sha256(clean(token,200));const row=await db.prepare(`SELECT order_id FROM coaster_orders WHERE order_id=? AND approval_token_hash=? AND datetime(approval_expires_at)>CURRENT_TIMESTAMP LIMIT 1`).bind(clean(orderId,80),hash).first();if(!row)return null;return approvalView(await getCoasterOrderDetail(env,row.order_id));}
export async function getCoasterApprovalProof(env,orderId,token){const approval=await getCoasterApprovalByToken(env,orderId,token);if(!approval)throw makeError('This approval link is invalid or expired.',404);return getStoredCoasterObject(env,orderId,'proof');}

export async function recordCoasterApprovalAction(env,orderId,token,action,message=''){
  const db=requireOrdersDb(env),approval=await getCoasterApprovalByToken(env,orderId,token);if(!approval)throw makeError('This approval link is invalid or expired.',404);const current=await getCoasterOrderDetail(env,orderId);if(isLocked(current))throw makeError('This order is already in production and is locked.',409);
  if(action==='requestChanges'){
    const note=clean(message,3000);if(note.length<2)throw makeError('Tell WestTech what you would like changed.');const when=nowIso();
    await db.prepare(`UPDATE coaster_orders SET proof_status='CHANGES_REQUESTED',status='CHANGES_REQUESTED',customer_change_request=?,changes_requested_at=?,updated_at=CURRENT_TIMESTAMP WHERE order_id=?`).bind(note,when,current.orderId).run();
    await logEvent(db,current.orderId,'CUSTOMER_CHANGES_REQUESTED',{proofVersion:current.proofVersion,message:note});return getCoasterOrderDetail(env,current.orderId);
  }
  if(action!=='approve')throw makeError('Unsupported approval action.');const when=nowIso();
  await db.prepare(`UPDATE coaster_orders SET proof_status='APPROVED',status='PROOF_APPROVED',proof_approved_at=?,customer_change_request=NULL,updated_at=CURRENT_TIMESTAMP WHERE order_id=?`).bind(when,current.orderId).run();
  await logEvent(db,current.orderId,'CUSTOMER_PROOF_APPROVED',{proofVersion:current.proofVersion});return getCoasterOrderDetail(env,current.orderId);
}
