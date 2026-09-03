import { jsonResponse } from '../../../../../../_lib/shared.js';
import { requireCoasterAdmin } from '../../../../../../_lib/coaster-admin.js';
import { syncCoasterPayPalOrder } from '../../../../../../_lib/coaster-paypal.js';
export async function onRequestPost(context){try{requireCoasterAdmin(context);const body=await context.request.json();if(body?.action!=='sync')return jsonResponse({ok:false,message:'Unsupported PayPal action.'},400);const order=await syncCoasterPayPalOrder(context.env,context.params.orderId);if(!order)return jsonResponse({ok:false,message:'Coaster order not found.'},404);return jsonResponse({ok:true,order});}catch(error){return jsonResponse({ok:false,message:error.message||'Could not sync PayPal checkout.'},error.status||500);}}
