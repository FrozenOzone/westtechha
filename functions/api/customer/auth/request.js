import { requestCustomerLogin } from '../../../_lib/customer-account.js';
import { jsonResponse, readJsonSafe } from '../../../_lib/shared.js';

export async function onRequestPost(context){
  try{const body=await readJsonSafe(context.request);await requestCustomerLogin(context.env,body?.email,context.request.url);return jsonResponse({ok:true,message:'If that email is connected to a WestTech order, a secure sign-in link is on the way.'});}
  catch{return jsonResponse({ok:true,message:'If that email is connected to a WestTech order, a secure sign-in link is on the way.'});}
}
