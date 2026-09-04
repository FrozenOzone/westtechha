import { jsonResponse } from '../../../../../_lib/shared.js';
import { getCoasterApprovalByToken, recordCoasterApprovalAction, approvalView, getCoasterOrderDetail } from '../../../../../_lib/coaster-orders.js';
import { ensureCoasterPayPalOrder, recordCoasterPayPalFailure } from '../../../../../_lib/coaster-paypal.js';
import { sendCoasterCustomerEmail } from '../../../../../_lib/coaster-email.js';
import { sendCoasterAdminProductionEmail } from '../../../../../_lib/coaster-admin-production-email.js';
import { requireOrdersDb } from '../../../../../_lib/orders.js';
function base(request){const u=new URL(request.url);return `${u.protocol}//${u.host}`;}
function previewPaymentBypass(context){
  try{
    const host=new URL(context.request.url).hostname.toLowerCase();
    const configured=String(context.env?.PUBLIC_SITE_URL||'').toLowerCase().replace(/\/+$/,'');
    const preview='https://coasters-v30-preview.westtechha.pages.dev';
    const paypalReady=!!(context.env?.PAYPAL_CLIENT_ID&&context.env?.PAYPAL_CLIENT_SECRET&&context.env?.PAYPAL_ENV);
    return host==='coasters-v30-preview.westtechha.pages.dev'&&configured===preview&&!paypalReady;
  }catch(e){return false;}
}
async function stagePreviewAwaitingPayment(context,order){
  const db=requireOrdersDb(context.env);
  await db.prepare(`UPDATE coaster_orders SET status='AWAITING_PAYMENT',payment_status='PREVIEW_AWAITING_TEST_PAYMENT',paypal_last_error=NULL,updated_at=CURRENT_TIMESTAMP WHERE order_id=?`).bind(order.orderId).run();
  await db.prepare(`INSERT INTO coaster_order_events (order_id,event_type,detail) VALUES (?,'PREVIEW_PAYMENT_BYPASS_READY',?)`).bind(order.orderId,JSON.stringify({status:'AWAITING_PAYMENT',paymentStatus:'PREVIEW_AWAITING_TEST_PAYMENT',paypalCalled:false})).run();
  return getCoasterOrderDetail(context.env,order.orderId);
}
export async function onRequestGet(context){
  try{const token=new URL(context.request.url).searchParams.get('token')||'';const approval=await getCoasterApprovalByToken(context.env,context.params.orderId,token);if(!approval)return jsonResponse({ok:false,message:'This approval link is invalid or expired.'},404);return jsonResponse({ok:true,approval});}
  catch(error){return jsonResponse({ok:false,message:error.message||'Could not load this proof.'},error.status||500);}
}
export async function onRequestPost(context){
  try{
    const body=await context.request.json();const token=String(body?.token||'');const action=String(body?.action||'');let order=await recordCoasterApprovalAction(context.env,context.params.orderId,token,action,body?.message||'');let paymentWarning='';
    if(action==='requestChanges'){
      await sendCoasterCustomerEmail(context.env,{type:'CHANGES_REQUESTED',order,requestUrl:context.request.url});
    }else if(action==='approve'){
      if(order.paymentRequired&&previewPaymentBypass(context)){
        order=await stagePreviewAwaitingPayment(context,order);
        paymentWarning='Preview test mode: no PayPal checkout was created. WestTech can use the Preview Payment Test page to mark this order paid and continue the shipping workflow.';
      }else{
        const root=base(context.request);const encodedOrder=encodeURIComponent(order.orderId),encodedToken=encodeURIComponent(token);
        const orderPageUrl=`${root}/coasters/order-approval.html?order=${encodedOrder}&approvalToken=${encodedToken}`;
        const returnUrl=`${orderPageUrl}&payment=return`;
        const cancelUrl=`${orderPageUrl}&payment=cancel`;
        try{
          order=await ensureCoasterPayPalOrder(context.env,order.orderId,{returnUrl,cancelUrl});
          if(order.paymentRequired)await sendCoasterCustomerEmail(context.env,{type:'PAYMENT_REQUIRED',order,approvalUrl:orderPageUrl,paymentUrl:order.paypalApprovalUrl,requestUrl:context.request.url});
          else if(String(order.status||'').toUpperCase()==='PRODUCTION_QUEUE')await sendCoasterAdminProductionEmail(context.env,{order,requestUrl:context.request.url});
        }catch(error){order=await recordCoasterPayPalFailure(context.env,order.orderId,error);paymentWarning=error.message||'PayPal checkout setup needs WestTech review.';}
      }
    }
    return jsonResponse({ok:true,approval:approvalView(order),paymentWarning:paymentWarning||undefined});
  }catch(error){return jsonResponse({ok:false,message:error.message||'Could not update the proof.'},error.status||500);}
}
