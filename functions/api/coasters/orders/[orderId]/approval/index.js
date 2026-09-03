import { jsonResponse } from '../../../../../_lib/shared.js';
import { getCoasterApprovalByToken, recordCoasterApprovalAction, approvalView } from '../../../../../_lib/coaster-orders.js';
import { ensureCoasterPayPalOrder, recordCoasterPayPalFailure } from '../../../../../_lib/coaster-paypal.js';
import { sendCoasterCustomerEmail } from '../../../../../_lib/coaster-email.js';
import { sendCoasterAdminProductionEmail } from '../../../../../_lib/coaster-admin-production-email.js';
function base(request){const u=new URL(request.url);return `${u.protocol}//${u.host}`;}
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
      const root=base(context.request);const encodedOrder=encodeURIComponent(order.orderId),encodedToken=encodeURIComponent(token);
      const returnUrl=`${root}/coasters/order-approval.html?order=${encodedOrder}&approvalToken=${encodedToken}&payment=return`;
      const cancelUrl=`${root}/coasters/order-approval.html?order=${encodedOrder}&approvalToken=${encodedToken}&payment=cancel`;
      try{
        order=await ensureCoasterPayPalOrder(context.env,order.orderId,{returnUrl,cancelUrl});
        if(order.paymentRequired)await sendCoasterCustomerEmail(context.env,{type:'PAYMENT_REQUIRED',order,paymentUrl:order.paypalApprovalUrl,requestUrl:context.request.url});
        else if(String(order.status||'').toUpperCase()==='PRODUCTION_QUEUE')await sendCoasterAdminProductionEmail(context.env,{order,requestUrl:context.request.url});
      }catch(error){order=await recordCoasterPayPalFailure(context.env,order.orderId,error);paymentWarning=error.message||'PayPal checkout setup needs WestTech review.';}
    }
    return jsonResponse({ok:true,approval:approvalView(order),paymentWarning:paymentWarning||undefined});
  }catch(error){return jsonResponse({ok:false,message:error.message||'Could not update the proof.'},error.status||500);}
}
