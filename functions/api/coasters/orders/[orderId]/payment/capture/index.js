import { jsonResponse } from '../../../../../../_lib/shared.js';
import { captureCoasterPayPalOrder } from '../../../../../../_lib/coaster-paypal.js';
import { getCoasterApprovalByToken } from '../../../../../../_lib/coaster-orders.js';
export async function onRequestPost(context){
  try{const body=await context.request.json();const approvalToken=String(body?.approvalToken||'');const paypalOrderId=String(body?.paypalOrderId||'');if(!approvalToken||!paypalOrderId)return jsonResponse({ok:false,message:'Missing PayPal return details.'},400);await captureCoasterPayPalOrder(context.env,context.params.orderId,approvalToken,paypalOrderId);const approval=await getCoasterApprovalByToken(context.env,context.params.orderId,approvalToken);return jsonResponse({ok:true,approval});}
  catch(error){return jsonResponse({ok:false,message:error.message||'Could not finalize PayPal payment.'},error.status||500);}
}
