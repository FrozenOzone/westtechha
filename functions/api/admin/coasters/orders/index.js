import { jsonResponse } from '../../../../_lib/shared.js';
import { requireCoasterAdmin } from '../../../../_lib/coaster-admin.js';
import { listCoasterOrders } from '../../../../_lib/coaster-orders.js';
export async function onRequestGet(context){try{requireCoasterAdmin(context);return jsonResponse({ok:true,orders:await listCoasterOrders(context.env,150)});}catch(error){return jsonResponse({ok:false,message:error.message||'Could not load coaster orders.'},error.status||500);}}
