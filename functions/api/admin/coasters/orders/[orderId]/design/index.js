import { jsonResponse } from '../../../../../../_lib/shared.js';
import { requireCoasterAdmin } from '../../../../../../_lib/coaster-admin.js';
import { getStoredCoasterObject } from '../../../../../../_lib/coaster-orders.js';
export async function onRequestGet(context){try{requireCoasterAdmin(context);const {object}=await getStoredCoasterObject(context.env,context.params.orderId,'design');return new Response(object.body,{headers:{'Content-Type':'image/svg+xml','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox"}});}catch(error){return jsonResponse({ok:false,message:error.message||'Submitted design not available.'},error.status||500);}}
