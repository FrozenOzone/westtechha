import { jsonResponse } from '../../../../../../_lib/shared.js';
import { requireCoasterAdmin } from '../../../../../../_lib/coaster-admin.js';
import { syncCoasterPayPalOrder, inspectCoasterPaymentRecovery, recoverCompletedCoasterPayPalCapture, repairCoasterPaidWorkOrder } from '../../../../../../_lib/coaster-paypal.js';
import { isCoasterSandbox } from '../../../../../../_lib/coaster-preview-payment-mode.js';
export async function onRequestPost(context){try{requireCoasterAdmin(context);const body=await context.request.json();if(body?.action==='inspect-recovery'){if(!isCoasterSandbox(context))return jsonResponse({ok:false,message:'Recovery inspection is Preview Sandbox only.'},403);const report=await inspectCoasterPaymentRecovery(context.env,context.params.orderId);return jsonResponse({ok:true,report});}if(body?.action==='recover-completed-paypal'||body?.action==='repair-paid-work-order'){
 if(!isCoasterSandbox(context))return jsonResponse({ok:false,message:'Recovery is Preview Sandbox only.'},403);
 if(body?.acknowledgeRisk!==true)return jsonResponse({ok:false,message:'Explicit recovery confirmation is required.'},400);
 const providerOrderId=String(body?.providerOrderId||''),captureId=String(body?.captureId||'');
 const result=body.action==='recover-completed-paypal'?
  await recoverCompletedCoasterPayPalCapture(context.env,context.params.orderId,providerOrderId,captureId):
  await repairCoasterPaidWorkOrder(context.env,context.params.orderId,providerOrderId,captureId);
 return jsonResponse({ok:true,...result});
}if(body?.action!=='sync')return jsonResponse({ok:false,message:'Unsupported PayPal action.'},400);const order=await syncCoasterPayPalOrder(context.env,context.params.orderId);if(!order)return jsonResponse({ok:false,message:'Coaster order not found.'},404);return jsonResponse({ok:true,order});}catch(error){return jsonResponse({ok:false,message:error.message||'Could not sync PayPal checkout.'},error.status||500);}}
