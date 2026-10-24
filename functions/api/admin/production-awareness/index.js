import { requireWestTechAdmin } from '../../../_lib/admin-auth.js';
import { jsonResponse } from '../../../_lib/shared.js';
import { getProductionAwareness } from '../../../_lib/production-awareness.js';
export async function onRequestGet(context){
  try{
    requireWestTechAdmin(context);
    const q=new URL(context.request.url).searchParams;
    const value=await getProductionAwareness(context.env,{
      setSize:q.get('setSize')||4,setCount:q.get('setCount')||1,
      minutes:q.get('minutes')||650,orderId:q.get('orderId')||'',sourceType:'COASTER'
    });
    const response=jsonResponse({ok:true,...value});response.headers.set('Cache-Control','private, no-store');return response;
  }catch(error){const r=jsonResponse({ok:false,message:error.message||'Could not calculate production awareness.'},error.status||500);r.headers.set('Cache-Control','no-store');return r;}
}
