import { jsonResponse, readJsonSafe } from '../../../_lib/shared.js';
import { createEnclosureOrder } from '../../../_lib/enclosure-orders.js';
import { sendEnclosureRequestEmails } from '../../../_lib/enclosure-email.js';

export async function onRequestPost(context){
  try{
    const body=await readJsonSafe(context.request);
    const order=await createEnclosureOrder(context.env,body||{});
    const email=await sendEnclosureRequestEmails(context.env,{order,requestUrl:context.request.url});
    return jsonResponse({ok:true,orderId:order.orderId,status:order.status,email},201);
  }catch(error){return jsonResponse({ok:false,message:error.message||'Could not submit the enclosure request.'},error.status||500);}
}
