import { requireWestTechAdmin } from '../../../_lib/admin-auth.js';
import { createCustomOrder, listCustomOrders, repeatCustomOrder } from '../../../_lib/custom-orders.js';
import { jsonResponse } from '../../../_lib/shared.js';

export async function onRequestGet(context){try{requireWestTechAdmin(context);return jsonResponse({ok:true,orders:await listCustomOrders(context.env)});}catch(error){return jsonResponse({ok:false,message:error.message||'Could not load custom orders.'},error.status||500);}}
export async function onRequestPost(context){try{requireWestTechAdmin(context);const body=await context.request.json(),order=body?.action==='repeatOrder'?await repeatCustomOrder(context.env,body?.orderId):await createCustomOrder(context.env,body);return jsonResponse({ok:true,order});}catch(error){return jsonResponse({ok:false,message:error.message||'Could not create custom order.'},error.status||500);}}
