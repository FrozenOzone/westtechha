import { requireCustomerSession, inviteCustomerForOrder } from '../../../../../../_lib/customer-account.js';
import { getCoasterOrderDetail } from '../../../../../../_lib/coaster-orders.js';
import { ensureCoasterPayPalOrder, captureCoasterPayPalOrderForCustomer } from '../../../../../../_lib/coaster-paypal.js';
import { sendCoasterAdminProductionEmail } from '../../../../../../_lib/coaster-admin-production-email.js';
import { requireOrdersDb } from '../../../../../../_lib/orders.js';
import { jsonResponse } from '../../../../../../_lib/shared.js';
import { isCoasterSandbox, coasterCustomerPaymentMode } from '../../../../../../_lib/coaster-preview-payment-mode.js';

function respond(value,status=200){const r=jsonResponse(value,status);r.headers.set('Cache-Control','private, no-store');r.headers.set('X-Content-Type-Options','nosniff');return r;}
function fail(message,status=400){return Object.assign(new Error(message),{status});}
async function owned(context){
 const account=await requireCustomerSession(context);
 if(String(context.params.sourceType||'').toUpperCase()!=='COASTER')throw fail('Only coaster orders are supported here.',400);
 const id=String(context.params.orderId||'');if(!/^WTCC-\d{8}-\d{1,6}$/.test(id))throw fail('Invalid order.',400);
 const db=requireOrdersDb(context.env);
 const link=await db.prepare("SELECT 1 AS owned FROM customer_account_orders WHERE account_id=? AND source_type='COASTER' AND source_order_id=? LIMIT 1").bind(account.id,id).first();
 if(!link)throw fail('Order not available.',404);
 const order=await getCoasterOrderDetail(context.env,id);if(!order)throw fail('Order not available.',404);
 return {account,order};
}
function paypalApprovalUrl(raw,mode){
 try{
  const u=new URL(raw);
  const approved=mode==='sandbox'?['www.sandbox.paypal.com','sandbox.paypal.com']:
   mode==='live'?['www.paypal.com','paypal.com']:[];
  return u.protocol==='https:'&&approved.includes(u.hostname.toLowerCase())?u.href:null;
 }catch{return null;}
}
function requireMode(context){
 const mode=coasterCustomerPaymentMode(context);
 if(!['sandbox','live'].includes(mode))throw fail('PayPal checkout is not available in this environment. Contact WestTech.',403);
 return mode;
}
export async function onRequestGet(context){
 try{
  const {order}=await owned(context);
  const mode=coasterCustomerPaymentMode(context);
  return respond({ok:true,mode,
   paymentRequired:!!order.paymentRequired,paymentStatus:order.paymentStatus,status:order.status,
   canCheckout:['sandbox','live'].includes(mode)&&!!order.paymentRequired&&order.proofStatus==='APPROVED'&&['PROOF_APPROVED','AWAITING_PAYMENT'].includes(order.status)&&!['PAID','CAPTURING_VENMO','CAPTURING_PAYPAL','CREATING_PAYPAL_ORDER'].includes(String(order.paymentStatus||'').toUpperCase())});
 }catch(e){return respond({ok:false,message:e.message||'Could not load payment status.'},e.status||500);}
}
export async function onRequestPost(context){
 try{
  const mode=requireMode(context);
  const origin=context.request.headers.get('Origin');if(origin&&origin!==new URL(context.request.url).origin)throw fail('Invalid request origin.',403);
  if(!/^application\/json(?:;|$)/i.test(context.request.headers.get('Content-Type')||''))throw fail('JSON request required.',415);
  const {order}=await owned(context);const body=await context.request.json();const action=String(body?.action||'');
  if(action==='startCheckout'){
   if(!order.paymentRequired||order.proofStatus!=='APPROVED'||!['PROOF_APPROVED','AWAITING_PAYMENT'].includes(order.status)||['PAID','CAPTURING_VENMO','CAPTURING_PAYPAL','CREATING_PAYPAL_ORDER'].includes(String(order.paymentStatus||'').toUpperCase()))throw fail('This order is not eligible for checkout. Review the existing payment status before retrying.',409);
   if(!['LOCAL_PICKUP','SHIP'].includes(order.fulfillmentMethod))throw fail('Fulfillment is not confirmed.',409);
   if(!String(order.productionWindow||'').trim())throw fail('Production window has not been saved.',409);
   const root=new URL(context.request.url).origin;
   const uri='/account/order?type=COASTER&id='+encodeURIComponent(order.orderId);
   const saved=await ensureCoasterPayPalOrder(context.env,order.orderId,{returnUrl:root+uri+'&payment=return',cancelUrl:root+uri+'&payment=cancel'});
   const url=paypalApprovalUrl(saved?.paypalApprovalUrl,mode);if(!url)throw fail('PayPal returned an unexpected checkout destination. Do not pay again; contact WestTech.',502);
   return respond({ok:true,approvalUrl:url,mode});
  }
  if(action==='capture'){
   if(!order.paymentRequired||!order.paypalOrderId)throw fail('This order has no PayPal checkout.',409);
   const paypalOrderId=String(body?.paypalOrderId||'');
   if(!paypalOrderId||paypalOrderId!==order.paypalOrderId)throw fail('The returned PayPal checkout does not match this order.',409);
   const result=await captureCoasterPayPalOrderForCustomer(context.env,order.orderId,paypalOrderId,{confirmTax:body.confirmTax===true});
   if(result?.capturedNow&&result.order){
    if(result.order.status==='PRODUCTION_QUEUE')await sendCoasterAdminProductionEmail(context.env,{order:result.order,requestUrl:context.request.url});
    await inviteCustomerForOrder(context.env,{sourceType:'COASTER',order:result.order,requestUrl:context.request.url});
   }
   return respond({ok:true,paid:result?.order?.paymentStatus==='PAID',taxConfirmationRequired:!!result?.taxConfirmationRequired,taxReview:result?.taxReview||null});
  }
  throw fail('Unsupported payment action.',400);
 }catch(e){return respond({ok:false,message:e.message||'PayPal payment could not be completed.',retryable:e.status>=500},e.status||500);}
}
