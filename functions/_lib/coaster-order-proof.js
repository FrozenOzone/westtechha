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

// Both private email links and signed-in customer accounts use the same guarded
// proof mutation. A stale proof, repeated click, or post-payment action is rejected.
async function applyCoasterApprovalAction(env,orderId,action,message='',{accountId=null,expectedVersion=null}={}){
  const db=requireOrdersDb(env),current=await getCoasterOrderDetail(env,orderId);
  if(!current)throw makeError('Coaster order not found.',404);
  if(isLocked(current))throw makeError('This order is already paid or in production and is locked.',409);
  if(String(current.status).toUpperCase()!=='PROOF_SENT'||String(current.proofStatus).toUpperCase()!=='SENT')throw makeError('This proof is no longer awaiting a decision. Refresh your order details.',409);
  if(!current.approvalExpiresAt||!(Date.parse(String(current.approvalExpiresAt).replace(' ','T').replace(/Z?$/,'Z'))>Date.now()))throw makeError('The 30-day proof review window has expired. Contact WestTech for a fresh approval link.',409);
  if(expectedVersion!==null&&Number(expectedVersion)!==Number(current.proofVersion))throw makeError('WestTech has released a newer proof. Refresh and review it before approving.',409);
  if(!current.proofObjectKey||Number(current.proofVersion)<1)throw makeError('A released proof is required before approval.',409);
  if(!['approve','requestChanges'].includes(action))throw makeError('Unsupported approval action.');
  const note=action==='requestChanges'?clean(message,3000):'';
  if(action==='requestChanges'&&note.length<2)throw makeError('Tell WestTech what you would like changed.');
  const when=nowIso(),toStatus=action==='approve'?'PROOF_APPROVED':'CHANGES_REQUESTED',toProof=action==='approve'?'APPROVED':'CHANGES_REQUESTED';
  const authorized=accountId===null?'':` AND EXISTS (SELECT 1 FROM customer_account_orders a WHERE a.account_id=? AND a.source_type='COASTER' AND a.source_order_id=coaster_orders.order_id)`;
  const args=[toProof,toStatus,action==='approve'?when:null,action==='requestChanges'?when:null,note||null,current.orderId,current.proofVersion];
  if(accountId!==null)args.push(accountId);
  const result=await db.prepare(`UPDATE coaster_orders SET proof_status=?,status=?,proof_approved_at=?,changes_requested_at=?,customer_change_request=?,updated_at=CURRENT_TIMESTAMP WHERE order_id=? AND proof_version=? AND proof_status='SENT' AND status='PROOF_SENT' AND COALESCE(payment_status,'')<>'PAID' AND datetime(approval_expires_at)>CURRENT_TIMESTAMP${authorized}`).bind(...args).run();
  if(Number(result?.meta?.changes||0)!==1)throw makeError('This proof was updated or is no longer available. Refresh your order details.',409);
  await logEvent(db,current.orderId,action==='approve'?'CUSTOMER_PROOF_APPROVED':'CUSTOMER_CHANGES_REQUESTED',action==='approve'?{proofVersion:current.proofVersion}:{proofVersion:current.proofVersion,message:note});
  return getCoasterOrderDetail(env,current.orderId);
}

export async function recordCoasterApprovalAction(env,orderId,token,action,message=''){
  const approval=await getCoasterApprovalByToken(env,orderId,token);
  if(!approval)throw makeError('This approval link is invalid or expired.',404);
  return applyCoasterApprovalAction(env,orderId,action,message);
}

// Only called after requireCustomerSession plus order ownership checks.
// The SQL guard also re-verifies account/order ownership at mutation time.
export async function recordCoasterApprovalForCustomer(env,orderId,accountId,action,message='',proofVersion){
  if(!Number.isSafeInteger(Number(accountId))||Number(accountId)<=0)throw makeError('Sign in to review this proof.',401);
  if(!Number.isSafeInteger(Number(proofVersion))||Number(proofVersion)<1)throw makeError('Refresh the proof before responding.',400);
  return applyCoasterApprovalAction(env,orderId,action,message,{accountId:Number(accountId),expectedVersion:Number(proofVersion)});
}
