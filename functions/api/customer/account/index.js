import { customerDashboard, requireCustomerSession } from '../../../_lib/customer-account.js';
import { jsonResponse } from '../../../_lib/shared.js';

export async function onRequestGet(context){try{const account=await requireCustomerSession(context);return jsonResponse({ok:true,...await customerDashboard(context.env,account)});}catch(error){return jsonResponse({ok:false,message:error.message||'Sign in to view your customer account.'},error.status||500);}}
