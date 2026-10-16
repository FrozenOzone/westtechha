import { viewCustomerPickup,bookCustomerPickup,requestCustomerAlternative } from '../../../_lib/coaster-pickup-customer.js';
const out=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store, private','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
export async function onRequestPost(context){
  try{
    const origin=context.request.headers.get('Origin');
    if(origin&&origin!==new URL(context.request.url).origin)return out({ok:false,message:'Invalid request origin.'},403);
    if(!String(context.request.headers.get('content-type')||'').toLowerCase().includes('application/json'))return out({ok:false,message:'Expected JSON request.'},415);
    const body=await context.request.json();
    if(!body||typeof body!=='object'||JSON.stringify(body).length>3000)return out({ok:false,message:'Invalid pickup request.'},400);
    if(body.action==='view')return out({ok:true,pickup:await viewCustomerPickup(context.env,body.token)});
    if(body.action==='book')return out({ok:true,...await bookCustomerPickup(context.env,body.token,body.slotId)});
    if(body.action==='request')return out({ok:true,pickup:await requestCustomerAlternative(context.env,body.token,body.first,body.second)});
    return out({ok:false,message:'Unknown scheduling action.'},400);
  }catch(e){return out({ok:false,message:e.message||'Pickup scheduling is unavailable.'},e.status||500);}
}
export async function onRequestGet(){return out({ok:false,message:'Use the private scheduling link provided by WestTech.'},405);}
