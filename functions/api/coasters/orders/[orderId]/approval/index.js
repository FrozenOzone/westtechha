import { getCoasterApprovalByToken, getCoasterOrderDetail, recordCoasterApprovalAction } from '../../../../../_lib/coaster-orders.js';
import { ensureCoasterPayPalOrder, recordCoasterPayPalFailure } from '../../../../../_lib/coaster-paypal.js';
import { jsonResponse } from '../../../../../_lib/shared.js';
import { sendCoasterCustomerEmail } from '../../../../../_lib/coaster-email.js';

function tokenFrom(request){const url=new URL(request.url);return String(url.searchParams.get('token')||'').trim();}
function customerPaymentUrls(request,orderId,approvalToken){
  const base=new URL('/coasters/order-approval.html',request.url);
  base.searchParams.set('order',orderId);base.searchParams.set('approvalToken',approvalToken);
  const ret=new URL(base);ret.searchParams.set('payment','return');
  const cancel=new URL(base);cancel.searchParams.set('payment','cancel');
  return {returnUrl:ret.toString(),cancelUrl:cancel.toString()};
}

export async function onRequestGet(context){
  try{const orderId=String(context.params?.orderId||'').trim();const token=tokenFrom(context.request);if(!token)return jsonResponse({ok:false,message:'Approval token is required.'},401);const approval=await getCoasterApprovalByToken(context.env,orderId,token);if(!approval)return jsonResponse({ok:false,message:'This approval link is invalid.'},404);return jsonResponse({ok:true,approval});}
  catch(error){return jsonResponse({ok:false,message:error?.message||'Could not load the proof.'},error?.status||500);}
}

export async function onRequestPost(context){
  try{
    const orderId=String(context.params?.orderId||'').trim();const body=await context.request.json();const token=String(body?.token||'').trim();if(!token)return jsonResponse({ok:false,message:'Approval token is required.'},401);
    let approval=await recordCoasterApprovalAction(context.env,orderId,token,body?.action,body?.message);if(!approval)return jsonResponse({ok:false,message:'This approval link is invalid.'},404);
    let paymentWarning='';
    let email=null;
    if(body?.action==='approve'){
      try{
        const urls=customerPaymentUrls(context.request,orderId,token);
        const orderAfterPaymentSetup=await ensureCoasterPayPalOrder(context.env,orderId,urls);
        if(orderAfterPaymentSetup?.paymentRequired!==false && orderAfterPaymentSetup?.paypalApprovalUrl){
          email=await sendCoasterCustomerEmail(context.env,{type:'PAYMENT_REQUIRED',order:orderAfterPaymentSetup,paymentUrl:orderAfterPaymentSetup.paypalApprovalUrl,requestUrl:context.request.url});
        }
      }catch(error){paymentWarning=error?.message||'PayPal checkout setup needs WestTech attention.';await recordCoasterPayPalFailure(context.env,orderId,error).catch(()=>{});}
      approval=await getCoasterApprovalByToken(context.env,orderId,token)||approval;
    }else if(body?.action==='requestChanges'){
      const order=await getCoasterOrderDetail(context.env,orderId);
      if(order)email=await sendCoasterCustomerEmail(context.env,{type:'CHANGES_REQUESTED',order,requestUrl:context.request.url});
    }
    return jsonResponse({ok:true,approval,paymentWarning:paymentWarning||null,email});
  }catch(error){return jsonResponse({ok:false,message:error?.message||'Could not update this proof.'},error?.status||500);}
}
