import { jsonResponse, readJsonSafe } from '../../../../../../_lib/shared.js';
import { requireWestTechAdmin } from '../../../../../../_lib/admin-auth.js';
import { syncEnclosurePayPalOrder } from '../../../../../../_lib/enclosure-paypal.js';
import { sendEnclosureAdminProductionEmail } from '../../../../../../_lib/enclosure-email.js';

export async function onRequestPost(context){
  try{
    requireWestTechAdmin(context);const body=await readJsonSafe(context.request);if(body?.action!=='sync')return jsonResponse({ok:false,message:'Unsupported PayPal action.'},400);
    const order=await syncEnclosurePayPalOrder(context.env,context.params.orderId);if(order?._paymentCapturedNow)await sendEnclosureAdminProductionEmail(context.env,{order,requestUrl:context.request.url});
    return jsonResponse({ok:true,order});
  }catch(error){return jsonResponse({ok:false,message:error.message||'Could not sync PayPal.'},error.status||500);}
}
