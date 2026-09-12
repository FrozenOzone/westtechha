import { requireWestTechAdmin } from '../../../_lib/admin-auth.js';
import { listCustomCustomers, saveCustomCustomer } from '../../../_lib/custom-orders.js';
import { jsonResponse } from '../../../_lib/shared.js';

export async function onRequestGet(context){try{requireWestTechAdmin(context);return jsonResponse({ok:true,customers:await listCustomCustomers(context.env,{includeInactive:true})});}catch(error){return jsonResponse({ok:false,message:error.message||'Could not load customers.'},error.status||500);}}
export async function onRequestPost(context){try{requireWestTechAdmin(context);const customer=await saveCustomCustomer(context.env,await context.request.json());return jsonResponse({ok:true,customer,customers:await listCustomCustomers(context.env,{includeInactive:true})});}catch(error){return jsonResponse({ok:false,message:error.message||'Could not save customer.'},error.status||500);}}
