import { jsonResponse, readJsonSafe } from '../../../../../_lib/shared.js';
import { enclosureApprovalView, getEnclosureApprovalByToken, recordEnclosureApprovalAction } from '../../../../../_lib/enclosure-orders.js';
import { ensureEnclosurePayPalOrder, recordEnclosurePayPalFailure } from '../../../../../_lib/enclosure-paypal.js';
import { sendEnclosureAdminProductionEmail, sendEnclosureCustomerEmail } from '../../../../../_lib/enclosure-email.js';

function root(request){const url=new URL(request.url);return `${url.protocol}//${url.host}`;}
export async function onRequestGet(context){
  try{const token=new URL(context.request.url).searchParams.get('token')||'',approval=await getEnclosureApprovalByToken(context.env,context.params.orderId,token);if(!approval)return jsonResponse({ok:false,message:'This approval link is invalid or expired.'},404);return jsonResponse({ok:true,approval});}
  catch(error){return jsonResponse({ok:false,message:error.message||'Could not load this enclosure order.'},error.status||500);}
}
export async function onRequestPost(context){
  try{
    const body=await readJsonSafe(context.request),token=String(body?.token||''),action=String(body?.action||'');let order=await recordEnclosureApprovalAction(context.env,context.params.orderId,token,action,body?.message||''),paymentWarning='';
    if(action==='requestChanges')await sendEnclosureCustomerEmail(context.env,{type:'CHANGES_REQUESTED',order,requestUrl:context.request.url});
    else if(action==='approve'){
      const base=root(context.request),page=`${base}/enclosures/order-approval.html?order=${encodeURIComponent(order.orderId)}&approvalToken=${encodeURIComponent(token)}`;
      try{
        order=await ensureEnclosurePayPalOrder(context.env,order.orderId,{returnUrl:`${page}&payment=return`,cancelUrl:`${page}&payment=cancel`});
        if(order.paymentRequired)await sendEnclosureCustomerEmail(context.env,{type:'PAYMENT_REQUIRED',order,approvalUrl:page,requestUrl:context.request.url});
        else if(String(order.status||'').toUpperCase()==='PRODUCTION_QUEUE')await sendEnclosureAdminProductionEmail(context.env,{order,requestUrl:context.request.url});
      }catch(error){order=await recordEnclosurePayPalFailure(context.env,order.orderId,error);paymentWarning=error.message||'PayPal checkout setup needs WestTech review.';}
    }
    return jsonResponse({ok:true,approval:enclosureApprovalView(order),paymentWarning:paymentWarning||undefined});
  }catch(error){return jsonResponse({ok:false,message:error.message||'Could not update the enclosure approval.'},error.status||500);}
}
