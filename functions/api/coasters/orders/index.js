import { jsonResponse } from '../../../_lib/shared.js';
import { createCoasterOrder } from '../../../_lib/coaster-orders.js';
import { sendCoasterCustomerEmail } from '../../../_lib/coaster-email.js';
export async function onRequestPost(context){
  try{
    const type=context.request.headers.get('content-type')||'';if(!type.toLowerCase().includes('multipart/form-data'))return jsonResponse({ok:false,message:'Custom coaster requests must include artwork.'},415);
    const form=await context.request.formData();const order=await createCoasterOrder(context.env,form);
    const email=await sendCoasterCustomerEmail(context.env,{type:'REQUEST_RECEIVED',order,requestUrl:context.request.url});
    return jsonResponse({ok:true,orderId:order.orderId,status:order.status,email},201);
  }catch(error){return jsonResponse({ok:false,message:error.message||'Could not submit the custom coaster request.'},error.status||500);}
}
