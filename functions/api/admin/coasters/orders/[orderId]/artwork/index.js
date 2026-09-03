import { jsonResponse } from '../../../../../../_lib/shared.js';
import { requireCoasterAdmin } from '../../../../../../_lib/coaster-admin.js';
import { getStoredCoasterObject } from '../../../../../../_lib/coaster-orders.js';
function safe(v){return String(v||'customer-artwork').replace(/["\\\r\n]/g,'_');}
export async function onRequestGet(context){try{requireCoasterAdmin(context);const {object,filename,contentType}=await getStoredCoasterObject(context.env,context.params.orderId,'artwork');return new Response(object.body,{headers:{'Content-Type':contentType||'application/octet-stream','Content-Disposition':`attachment; filename="${safe(filename)}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}catch(error){return jsonResponse({ok:false,message:error.message||'Artwork not available.'},error.status||500);}}
