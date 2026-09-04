import { jsonResponse, readJsonSafe } from '../../../../../_lib/shared.js';
import { requireWestTechAdmin } from '../../../../../_lib/admin-auth.js';
import { getEnclosureOrderDetail, updateEnclosureOrderAdmin } from '../../../../../_lib/enclosure-orders.js';

export async function onRequestGet(context){
  try{requireWestTechAdmin(context);return jsonResponse({ok:true,order:await getEnclosureOrderDetail(context.env,context.params.orderId)});}
  catch(error){return jsonResponse({ok:false,message:error.message||'Could not load the enclosure order.'},error.status||500);}
}

export async function onRequestPost(context){
  try{
    requireWestTechAdmin(context);
    const body=await readJsonSafe(context.request);
    if(body?.action!=='saveReview')return jsonResponse({ok:false,message:'Unsupported enclosure order action.'},400);
    return jsonResponse({ok:true,order:await updateEnclosureOrderAdmin(context.env,context.params.orderId,body)});
  }catch(error){return jsonResponse({ok:false,message:error.message||'Could not update the enclosure order.'},error.status||500);}
}
