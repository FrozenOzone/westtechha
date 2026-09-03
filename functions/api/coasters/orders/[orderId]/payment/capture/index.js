import { jsonResponse } from '../../../../../../_lib/shared.js';
import { captureCoasterPayPalOrder } from '../../../../../../_lib/coaster-paypal.js';
import { getCoasterApprovalByToken } from '../../../../../../_lib/coaster-orders.js';
import { sendCoasterAdminProductionEmail } from '../../../../../../_lib/coaster-admin-production-email.js';

export async function onRequestPost(context){
  try{
    const body=await context.request.json();
    const approvalToken=String(body?.approvalToken||''),paypalOrderId=String(body?.paypalOrderId||'');
    if(!approvalToken||!paypalOrderId)return jsonResponse({ok:false,message:'Missing PayPal return details.'},400);
    const result=await captureCoasterPayPalOrder(context.env,context.params.orderId,approvalToken,paypalOrderId,{confirmTax:body?.confirmTax===true});
    if(result?.capturedNow&&result.order&&String(result.order.status||'').toUpperCase()==='PRODUCTION_QUEUE')await sendCoasterAdminProductionEmail(context.env,{order:result.order,requestUrl:context.request.url});
    const approval=await getCoasterApprovalByToken(context.env,context.params.orderId,approvalToken);
    return jsonResponse({ok:true,approval,taxConfirmationRequired:!!result?.taxConfirmationRequired,taxReview:result?.taxReview||undefined});
  }catch(error){return jsonResponse({ok:false,message:error.message||'Could not finalize PayPal payment.'},error.status||500);}
}
