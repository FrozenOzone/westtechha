import { jsonResponse, readJsonSafe } from '../../../../../../_lib/shared.js';
import { captureEnclosurePayPalOrder } from '../../../../../../_lib/enclosure-paypal.js';
import { getEnclosureApprovalByToken } from '../../../../../../_lib/enclosure-orders.js';
import { sendEnclosureAdminProductionEmail } from '../../../../../../_lib/enclosure-email.js';

export async function onRequestPost(context){
  try{
    const body=await readJsonSafe(context.request),approvalToken=String(body?.approvalToken||''),paypalOrderId=String(body?.paypalOrderId||'');if(!approvalToken||!paypalOrderId)return jsonResponse({ok:false,message:'Missing PayPal return details.'},400);
    const result=await captureEnclosurePayPalOrder(context.env,context.params.orderId,approvalToken,paypalOrderId,{confirmTax:body?.confirmTax===true});if(result?.capturedNow&&result.order)await sendEnclosureAdminProductionEmail(context.env,{order:result.order,requestUrl:context.request.url});
    const approval=await getEnclosureApprovalByToken(context.env,context.params.orderId,approvalToken);return jsonResponse({ok:true,approval,taxConfirmationRequired:!!result?.taxConfirmationRequired,taxReview:result?.taxReview||undefined});
  }catch(error){return jsonResponse({ok:false,message:error.message||'Could not finalize PayPal payment.'},error.status||500);}
}
