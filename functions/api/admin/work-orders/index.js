import { requireWestTechAdmin } from '../../../_lib/admin-auth.js';
import { jsonResponse, readJsonSafe } from '../../../_lib/shared.js';
import { estimateManufacturingWindow, manufacturingDashboard, updateManufacturingSettings, updateManufacturingWorkOrder } from '../../../_lib/manufacturing-work-orders.js';

export async function onRequestGet(context){
  try{
    requireWestTechAdmin(context);
    const url=new URL(context.request.url);
    if(url.searchParams.get('action')==='estimate')return jsonResponse({ok:true,estimate:await estimateManufacturingWindow(context.env,url.searchParams.get('minutes'))});
    return jsonResponse({ok:true,...await manufacturingDashboard(context.env)});
  }catch(error){return jsonResponse({ok:false,message:error.message||'Could not load shared work orders.'},error.status||500);}
}

export async function onRequestPost(context){
  try{
    requireWestTechAdmin(context);const body=await readJsonSafe(context.request),action=String(body?.action||'updateWorkOrder');
    if(action==='updateSettings')return jsonResponse({ok:true,settings:await updateManufacturingSettings(context.env,body),...await manufacturingDashboard(context.env)});
    await updateManufacturingWorkOrder(context.env,body);return jsonResponse({ok:true,...await manufacturingDashboard(context.env)});
  }catch(error){return jsonResponse({ok:false,message:error.message||'Could not update the shared work order.'},error.status||500);}
}
