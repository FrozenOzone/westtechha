/* Customer Portal Stage 3 Step 2: signed-in, order-owned pickup scheduling. */
import { requireCustomerSession } from '../../../../../../_lib/customer-account.js';
import { requireOrdersDb } from '../../../../../../_lib/orders.js';
import { viewPortalPickup,bookPortalPickup,requestPortalPickupAlternative } from '../../../../../../_lib/coaster-pickup-customer.js';

const reply=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'private, no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
async function authorize(context){
  // Never trust the order ID in the URL by itself; check the authenticated
  // customer's durable account -> order ownership mapping on every request.
  const account=await requireCustomerSession(context);
  const type=String(context.params.sourceType||'').toUpperCase();
  const orderId=String(context.params.orderId||'');
  if(type!=='COASTER'||!/^WTCC-[A-Za-z0-9-]{1,72}$/.test(orderId))throw Object.assign(new Error('This order is not available in your account.'),{status:404});
  const db=requireOrdersDb(context.env);
  const owned=await db.prepare("SELECT 1 AS ok FROM customer_account_orders WHERE account_id=? AND source_type='COASTER' AND source_order_id=? LIMIT 1").bind(account.id,orderId).first();
  if(!owned)throw Object.assign(new Error('This order is not available in your account.'),{status:404});
  return orderId;
}
export async function onRequestGet(context){
  try{const id=await authorize(context);return reply({ok:true,pickup:await viewPortalPickup(context.env,id)});}
  catch(e){return reply({ok:false,message:e.message||'Pickup scheduling is unavailable.'},e.status||500);}
}
export async function onRequestPost(context){
  try{
    const origin=context.request.headers.get('Origin');
    if(origin&&origin!==new URL(context.request.url).origin)return reply({ok:false,message:'Invalid request origin.'},403);
    if(!String(context.request.headers.get('content-type')||'').toLowerCase().includes('application/json'))return reply({ok:false,message:'Expected JSON request.'},415);
    const id=await authorize(context);
    const body=await context.request.json();
    if(!body||typeof body!=='object'||Array.isArray(body)||JSON.stringify(body).length>3000)return reply({ok:false,message:'Invalid pickup request.'},400);
    if(body.action==='book')return reply({ok:true,...await bookPortalPickup(context.env,id,body.slotId)});
    if(body.action==='request')return reply({ok:true,pickup:await requestPortalPickupAlternative(context.env,id,body.first,body.second)});
    return reply({ok:false,message:'Unsupported scheduling action.'},400);
  }catch(e){return reply({ok:false,message:e.message||'Pickup scheduling is unavailable.'},e.status||500);}
}
