import { jsonResponse, readJsonSafe } from '../../../../../_lib/shared.js';
import { requireWestTechAdmin } from '../../../../../_lib/admin-auth.js';
import { getEnclosureOrderDetail, updateEnclosureOrderAdmin } from '../../../../../_lib/enclosure-orders.js';
import { sendEnclosureCustomerEmail } from '../../../../../_lib/enclosure-email.js';

export async function onRequestGet(context){
  try{requireWestTechAdmin(context);return jsonResponse({ok:true,order:await getEnclosureOrderDetail(context.env,context.params.orderId)});}
  catch(error){return jsonResponse({ok:false,message:error.message||'Could not load the enclosure order.'},error.status||500);}
}

export async function onRequestPost(context){
  try{
    requireWestTechAdmin(context);
    const before=await getEnclosureOrderDetail(context.env,context.params.orderId),body=await readJsonSafe(context.request),order=await updateEnclosureOrderAdmin(context.env,context.params.orderId,body),action=String(body?.action||'saveReview');
    let email=null;
    if(!['archive','restoreArchive','addWork'].includes(action)&&before.status!==order.status&&['IN_PRODUCTION','PREPARING_TO_SHIP','PREPARING_FOR_PICKUP','READY_FOR_PICKUP','SHIPPED','COMPLETED'].includes(order.status))email=await sendEnclosureCustomerEmail(context.env,{type:order.status,order,requestUrl:context.request.url});
    return jsonResponse({ok:true,order,email});
  }catch(error){return jsonResponse({ok:false,message:error.message||'Could not update the enclosure order.'},error.status||500);}
}
