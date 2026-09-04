import { jsonResponse } from '../../../../_lib/shared.js';
import { requireWestTechAdmin } from '../../../../_lib/admin-auth.js';
import { listEnclosureOrders } from '../../../../_lib/enclosure-orders.js';

export async function onRequestGet(context){
  try{requireWestTechAdmin(context);return jsonResponse({ok:true,orders:await listEnclosureOrders(context.env,200)});}
  catch(error){return jsonResponse({ok:false,message:error.message||'Could not load enclosure orders.'},error.status||500);}
}
