import { requireCustomerSession, updateCustomerProfile } from '../../../_lib/customer-account.js';
import { jsonResponse, readJsonSafe } from '../../../_lib/shared.js';

export async function onRequestPost(context){try{const account=await requireCustomerSession(context),body=await readJsonSafe(context.request),result=await updateCustomerProfile(context.env,account,body,context.request.url);return jsonResponse({ok:true,...result});}catch(error){return jsonResponse({ok:false,message:error.message||'Could not update your profile.'},error.status||500);}}
