import { requireCustomerSession } from '../../../../../../_lib/customer-account.js';
import { requireOrdersDb } from '../../../../../../_lib/orders.js';
import { getCoasterOrderDetail } from '../../../../../../_lib/coaster-orders.js';
import { jsonResponse, sanitizeEnvValue } from '../../../../../../_lib/shared.js';
import { isCoasterSandbox } from '../../../../../../_lib/coaster-preview-payment-mode.js';
import { getVenmoPickupQuote, startVenmoPickup, captureVenmoPickup, cancelVenmoPickup } from '../../../../../../_lib/coaster-venmo.js';
import { sendCoasterAdminProductionEmail } from '../../../../../../_lib/coaster-admin-production-email.js';
import { inviteCustomerForOrder } from '../../../../../../_lib/customer-account.js';

const fail=(m,s=400)=>Object.assign(new Error(m),{status:s});
function reply(data,status=200){const r=jsonResponse(data,status);r.headers.set('Cache-Control','private, no-store');r.headers.set('X-Content-Type-Options','nosniff');return r;}
async function owned(context){
 const account=await requireCustomerSession(context);
 if(String(context.params.sourceType||'').toUpperCase()!=='COASTER')throw fail('Only coaster orders supported.',400);
 const id=String(context.params.orderId||'');if(!/^WTCC-\d{8}-\d{1,6}$/.test(id))throw fail('Invalid order.',400);
 const db=requireOrdersDb(context.env);
 const link=await db.prepare("SELECT 1 AS owned FROM customer_account_orders WHERE account_id=? AND source_type='COASTER' AND source_order_id=? LIMIT 1").bind(account.id,id).first();
 if(!link)throw fail('Order not available.',404);
 const order=await getCoasterOrderDetail(context.env,id);if(!order)throw fail('Order not available.',404);
 return order;
}
function flags(context,order){
 const sandbox=isCoasterSandbox(context);
 const pending=order.paymentRequired===true && order.proofStatus==='APPROVED' &&
   ['PROOF_APPROVED','AWAITING_PAYMENT'].includes(String(order.status||'').toUpperCase()) &&
   String(order.paymentStatus||'').toUpperCase()!=='PAID';
 return {sandbox,pending,
   venmo:sandbox && pending && order.fulfillmentMethod==='LOCAL_PICKUP' &&
     sanitizeEnvValue(context.env.COASTER_VENMO_SANDBOX_ENABLED)==='1' &&
     sanitizeEnvValue(context.env.PAYPAL_CURRENCY)==='USD' &&
     !!sanitizeEnvValue(context.env.PAYPAL_CLIENT_ID)};
}
export async function onRequestGet(context){
 try{
  const order=await owned(context);const f=flags(context,order);
  if(!f.sandbox)return reply({ok:true,mode:'unavailable',methods:[]});
  const methods=[{id:'paypal',label:'PayPal',enabled:f.pending},
    {id:'venmo',label:'Venmo',enabled:f.venmo,reason:order.fulfillmentMethod!=='LOCAL_PICKUP'?'Venmo shipping checkout needs further verification.':null}];
  let quote=null;
  if(f.venmo){const q=await getVenmoPickupQuote(context.env,order.orderId);
   quote={taxableAmount:q.taxableAmount,taxAmount:q.taxAmount,totalAmount:q.totalAmount,taxRate:q.taxRate,shippingAmount:q.shippingAmount};}
  return reply({ok:true,mode:'sandbox',methods,clientId:f.venmo?sanitizeEnvValue(context.env.PAYPAL_CLIENT_ID):null,quote});
 }catch(e){return reply({ok:false,message:e.message||'Could not load payment methods.'},e.status||500);}
}
export async function onRequestPost(context){
 try{
  if(!isCoasterSandbox(context))throw fail('Venmo is available only in Sandbox Preview.',403);
  const origin=context.request.headers.get('Origin');if(origin&&origin!==new URL(context.request.url).origin)throw fail('Invalid origin.',403);
  if(!/^application\/json(?:;|$)/i.test(context.request.headers.get('Content-Type')||''))throw fail('JSON required.',415);
  const order=await owned(context);const f=flags(context,order);if(!f.venmo)throw fail('Venmo is not enabled for this order.',403);
  const body=await context.request.json();const action=String(body?.action||'');
  if(action==='startVenmo'){
   if(body?.confirmedTotal!==true)throw fail('Confirm the displayed tax and final total.',400);
   const result=await startVenmoPickup(context.env,order.orderId,String(body.expectedTotal||''));
   return reply({ok:true,...result});
  }
  if(action==='cancelVenmo'){
   const id=String(body.paypalOrderId||'');if(!/^[A-Z0-9]{8,32}$/i.test(id))throw fail('Invalid payment reference.',400);
   const result=await cancelVenmoPickup(context.env,order.orderId,id);
   return reply({ok:true,...result});
  }
  if(action==='captureVenmo'){
   const id=String(body.paypalOrderId||'');if(!/^[A-Z0-9]{8,32}$/i.test(id))throw fail('Invalid payment reference.',400);
   const result=await captureVenmoPickup(context.env,order.orderId,id);
   if(result.capturedNow && result.order){
    if(result.order.status==='PRODUCTION_QUEUE')await sendCoasterAdminProductionEmail(context.env,{order:result.order,requestUrl:context.request.url});
    await inviteCustomerForOrder(context.env,{sourceType:'COASTER',order:result.order,requestUrl:context.request.url});
   }
   return reply({ok:true,paid:result.order?.paymentStatus==='PAID'});
  }
  throw fail('Unsupported payment action.',400);
 }catch(e){return reply({ok:false,message:e.message||'Venmo payment failed. Check your order before retrying.'},e.status||500);}
}
