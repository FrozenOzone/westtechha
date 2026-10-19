/* Exact-repeat reorder verification: protected Admin gate (Option A).
 * Reusable payment release lives here for the Preview test. Future automatic
 * checkout (Option B) may call the shared release function after a verified quote.
 * No PayPal calls, payment simulations or production transitions are available
 * through this endpoint on Production hosts.
 */
import { jsonResponse } from '../../../../../_lib/shared.js';
import { requireCoasterAdmin } from '../../../../../_lib/coaster-admin.js';
import { getCoasterOrderDetail } from '../../../../../_lib/coaster-orders.js';
import { requireOrdersDb } from '../../../../../_lib/orders.js';
import { requireArtworkBucket } from '../../../../../_lib/coaster-order-util.js';
import { ensureManufacturingWorkOrder } from '../../../../../_lib/manufacturing-work-orders.js';

const respond=(value,status=200)=>{const r=jsonResponse(value,status);r.headers.set('Cache-Control','private, no-store');return r;};
function fail(message,status=400){const e=new Error(message);e.status=status;return e;}
function previewHost(context){return ['pickup-stage1-preview.westtechha.pages.dev','coasters-v30-preview.westtechha.pages.dev'].includes(new URL(context.request.url).hostname.toLowerCase());}
async function reorderSource(db,orderId){
 const row=await db.prepare("SELECT detail FROM coaster_order_events WHERE order_id=? AND event_type='CUSTOMER_REORDER_REQUESTED' ORDER BY id ASC LIMIT 1").bind(orderId).first();
 if(!row)return null;
 try{const data=JSON.parse(row.detail||'{}');return /^WTCC-\d{8}-\d+$/.test(data.sourceOrderId)?data.sourceOrderId:null;}catch{return null;}
}
async function details(context){
 const db=requireOrdersDb(context.env),order=await getCoasterOrderDetail(context.env,context.params.orderId);
 if(!order)throw fail('Coaster order not found.',404);
 const sourceOrderId=await reorderSource(db,order.orderId);
 if(!sourceOrderId)return {order,sourceOrderId:null,original:null,canVerify:false};
 const original=await getCoasterOrderDetail(context.env,sourceOrderId);
 const eligible=!!original&&['COMPLETED','ARCHIVED'].includes(String(original.status||'').toUpperCase())&&original.proofStatus==='APPROVED'&&!!original.proofObjectKey;
 return {order,sourceOrderId,original:original?{orderId:original.orderId,proofVersion:original.proofVersion,finalAmount:original.finalAmount,status:original.status}:null,canVerify:eligible&&['DESIGN_REVIEW','REORDER_VERIFICATION'].includes(String(order.status||'').toUpperCase())};
}
export async function onRequestGet(context){try{requireCoasterAdmin(context);const info=await details(context);return respond({ok:true,...info});}catch(e){return respond({ok:false,message:e.message||'Could not check reorder.'},e.status||500);}}
export async function onRequestPost(context){
 try{
  requireCoasterAdmin(context);
  if(!previewHost(context))throw fail('Reorder payment handoff is only enabled for Preview testing.',403);
  const origin=context.request.headers.get('Origin');if(origin&&origin!==new URL(context.request.url).origin)throw fail('Invalid request origin.',403);
  if(!/^application\/json(?:;|$)/i.test(context.request.headers.get('Content-Type')||''))throw fail('JSON request required.',415);
  const body=await context.request.json();if(body?.action!=='verifyForPayment'||body?.confirmed!==true)throw fail('Confirm the approved artwork, pricing, and production schedule first.');
  const db=requireOrdersDb(context.env),{order,sourceOrderId,canVerify}=await details(context);
  if(!canVerify)throw fail('Only an unverified reorder of a completed, approved coaster design can proceed.',409);
  if(!['SHIP','LOCAL_PICKUP'].includes(order.fulfillmentMethod))throw fail('Choose Shipping or Local Pickup before payment.',409);
  if(Number(order.estimatedPrinterMinutes||0)<=0||!String(order.productionWindow||'').trim())throw fail('Save the printer minutes and estimated production window first.',409);
  if(order.paymentRequired&&Number(order.finalAmount||0)<=0)throw fail('Confirm a positive current customer price before payment.',409);
  const source=await getCoasterOrderDetail(context.env,sourceOrderId);
  if(!source||source.proofStatus!=='APPROVED'||!source.proofObjectKey)throw fail('Original approved proof is missing; reorder cannot bypass artwork review.',409);
  const object=await requireArtworkBucket(context.env).head(source.proofObjectKey);
  if(!object)throw fail('The approved production proof is not available in artwork storage.',409);
  const status=order.paymentRequired?'AWAITING_PAYMENT':'PRODUCTION_QUEUE';
  const paymentStatus=order.paymentRequired?'PREVIEW_AWAITING_TEST_PAYMENT':'NOT_REQUIRED';
  const result=await db.prepare(`UPDATE coaster_orders SET status=?,payment_status=?,proof_version=?,proof_status='APPROVED',proof_source=?,proof_object_key=?,proof_filename=?,proof_content_type=?,proof_size_bytes=?,paypal_order_id=NULL,paypal_approval_url=NULL,paypal_order_status=NULL,paypal_capture_id=NULL,paypal_paid_at=NULL,paypal_payment_id=NULL,payment_total=0,updated_at=CURRENT_TIMESTAMP WHERE order_id=? AND status IN ('REORDER_VERIFICATION','DESIGN_REVIEW')`).bind(status,paymentStatus,source.proofVersion,source.proofSource,source.proofObjectKey,source.proofFilename,source.proofContentType,source.proofSizeBytes,order.orderId).run();
  if(Number(result?.meta?.changes||0)!==1)throw fail('The reorder changed while being verified. Reload and check its status.',409);
  await db.prepare("INSERT INTO coaster_order_events (order_id,event_type,detail) VALUES (?,'REORDER_VERIFIED',?)").bind(order.orderId,JSON.stringify({sourceOrderId,originalApprovedProofVersion:source.proofVersion,finalAmount:order.finalAmount,fulfillmentMethod:order.fulfillmentMethod,paymentRequired:order.paymentRequired,previewOnly:true,noNewApproval:true})).run();
  const updated=await getCoasterOrderDetail(context.env,order.orderId);
  if(status==='PRODUCTION_QUEUE')await ensureManufacturingWorkOrder(context.env,'COASTER',updated);
  return respond({ok:true,order:updated,previewOnly:true,action:order.paymentRequired?'READY_FOR_PREVIEW_TEST_PAYMENT':'QUEUED_NO_PAYMENT'});
 }catch(e){return respond({ok:false,message:e.message||'Could not verify reorder.'},e.status||500);}
}
