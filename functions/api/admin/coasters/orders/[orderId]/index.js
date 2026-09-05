import { jsonResponse } from '../../../../../_lib/shared.js';
import { requireCoasterAdmin } from '../../../../../_lib/coaster-admin.js';
import { getCoasterOrderDetail, updateCoasterOrderAdmin } from '../../../../../_lib/coaster-orders.js';
import { sendCoasterCustomerEmail } from '../../../../../_lib/coaster-email.js';
import { sendCoasterAdminProductionEmail } from '../../../../../_lib/coaster-admin-production-email.js';
import { requireOrdersDb } from '../../../../../_lib/orders.js';
import { ensureManufacturingWorkOrder } from '../../../../../_lib/manufacturing-work-orders.js';
function previewHostAllowed(context){
  try{
    const host=new URL(context.request.url).hostname.toLowerCase();
    const configured=String(context.env?.PUBLIC_SITE_URL||'').toLowerCase().replace(/\/+$/,'');
    return host==='coasters-v30-preview.westtechha.pages.dev'&&configured==='https://coasters-v30-preview.westtechha.pages.dev';
  }catch(e){return false;}
}
async function markPreviewPaid(context,order){
  if(!previewHostAllowed(context))throw Object.assign(new Error('Preview payment simulation is not available on this site.'),{status:403});
  if(!order.paymentRequired)throw Object.assign(new Error('This order does not require payment.'),{status:409});
  if(String(order.proofStatus||'').toUpperCase()!=='APPROVED')throw Object.assign(new Error('Customer proof approval is required before preview payment can be simulated.'),{status:409});
  if(String(order.paymentStatus||'').toUpperCase()==='PAID')return order;
  if(!['PROOF_APPROVED','AWAITING_PAYMENT'].includes(String(order.status||'').toUpperCase()))throw Object.assign(new Error('This order is not waiting for payment.'),{status:409});
  const db=requireOrdersDb(context.env);const now=new Date().toISOString();const capture=`PREVIEW-TEST-${Date.now().toString(36).toUpperCase()}`;
  if(order.fulfillmentMethod==='SHIP'){
    await db.prepare(`UPDATE coaster_orders SET payment_status='PAID',paypal_order_status='PREVIEW_TEST_PAID',paypal_capture_id=?,paypal_payment_id=?,paypal_paid_at=?,paypal_last_error=NULL,status='PRODUCTION_QUEUE',shipping_name=?,shipping_address1='100 Preview Test Way',shipping_address2='DO NOT SHIP - PREVIEW TEST',shipping_city='Denver',shipping_region='CO',shipping_postal_code='80202',shipping_country='US',updated_at=CURRENT_TIMESTAMP WHERE order_id=?`).bind(capture,capture,now,`${order.customerName||'Test Customer'} - PREVIEW TEST`,order.orderId).run();
  }else{
    await db.prepare(`UPDATE coaster_orders SET payment_status='PAID',paypal_order_status='PREVIEW_TEST_PAID',paypal_capture_id=?,paypal_payment_id=?,paypal_paid_at=?,paypal_last_error=NULL,status='PRODUCTION_QUEUE',updated_at=CURRENT_TIMESTAMP WHERE order_id=?`).bind(capture,capture,now,order.orderId).run();
  }
  await db.prepare(`INSERT INTO coaster_order_events (order_id,event_type,detail) VALUES (?,'PREVIEW_PAYMENT_SIMULATED',?)`).bind(order.orderId,JSON.stringify({paymentStatus:'PAID',status:'PRODUCTION_QUEUE',captureId:capture,paypalCalled:false,testShippingAddress:order.fulfillmentMethod==='SHIP'})).run();
  const updated=await getCoasterOrderDetail(context.env,order.orderId);
  await ensureManufacturingWorkOrder(context.env,'COASTER',updated);
  await sendCoasterCustomerEmail(context.env,{type:'PRODUCTION_QUEUED',order:updated,requestUrl:context.request.url});
  await sendCoasterAdminProductionEmail(context.env,{order:updated,requestUrl:context.request.url});
  return getCoasterOrderDetail(context.env,order.orderId);
}
export async function onRequestGet(context){try{requireCoasterAdmin(context);const order=await getCoasterOrderDetail(context.env,context.params.orderId);if(!order)return jsonResponse({ok:false,message:'Coaster order not found.'},404);return jsonResponse({ok:true,order});}catch(error){return jsonResponse({ok:false,message:error.message||'Could not load coaster order.'},error.status||500);}}
export async function onRequestPost(context){try{requireCoasterAdmin(context);const before=await getCoasterOrderDetail(context.env,context.params.orderId);if(!before)return jsonResponse({ok:false,message:'Coaster order not found.'},404);const body=await context.request.json();const action=String(body?.action||'');if(action==='previewMarkPaid'){const order=await markPreviewPaid(context,before);return jsonResponse({ok:true,order,previewPaymentSimulated:true});}const order=await updateCoasterOrderAdmin(context.env,context.params.orderId,body);if(!['archive','restoreArchive'].includes(action)&&before.status!==order.status&&['IN_PRODUCTION','PREPARING_TO_SHIP','PREPARING_FOR_PICKUP','READY_FOR_PICKUP','SHIPPED','COMPLETED'].includes(order.status))await sendCoasterCustomerEmail(context.env,{type:order.status,order,requestUrl:context.request.url});return jsonResponse({ok:true,order});}catch(error){return jsonResponse({ok:false,message:error.message||'Could not update coaster order.'},error.status||500);}}
