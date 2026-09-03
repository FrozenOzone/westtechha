import { captureCoasterPayPalOrder } from '../../../../../_lib/coaster-paypal.js';
import { getCoasterApprovalByToken } from '../../../../../_lib/coaster-orders.js';
import { jsonResponse } from '../../../../../_lib/shared.js';

export async function onRequestPost(context){
  try{
    const orderId=String(context.params?.orderId||'').trim();const body=await context.request.json().catch(()=>({}));
    const approvalToken=String(body?.approvalToken||'').trim();const paypalOrderId=String(body?.paypalOrderId||'').trim();
    if(!approvalToken)return jsonResponse({ok:false,message:'Approval token is required.'},401);
    if(!paypalOrderId)return jsonResponse({ok:false,message:'PayPal order ID is required.'},400);
    const order=await captureCoasterPayPalOrder(context.env,orderId,approvalToken,paypalOrderId);if(!order)return jsonResponse({ok:false,message:'Coaster order not found.'},404);
    const approval=await getCoasterApprovalByToken(context.env,orderId,approvalToken);
    return jsonResponse({ok:true,approval});
  }catch(error){return jsonResponse({ok:false,message:error?.message||'Could not finalize the PayPal payment.'},error?.status||500);}
}
