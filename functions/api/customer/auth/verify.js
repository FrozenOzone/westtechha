import { verifyCustomerToken } from '../../../_lib/customer-account.js';
import { requireOrdersDb } from '../../../_lib/orders.js';

// A receipt may specify one coaster order. Never trust a URL-provided destination.
export async function onRequestGet(context){
  const url=new URL(context.request.url),root=url.origin;
  try{
    const result=await verifyCustomerToken(context.env,url.searchParams.get('token')||'');
    let destination=`${root}/account/index.html${result.emailChanged?'?email=updated':''}`;
    const id=url.searchParams.get('order')||'';
    if(!result.emailChanged&&url.searchParams.get('type')==='COASTER'&&/^WTCC-\d{8}-\d{4,}$/.test(id)){
      const allowed=await requireOrdersDb(context.env).prepare(`SELECT 1 AS allowed FROM customer_account_orders WHERE account_id=? AND source_type='COASTER' AND source_order_id=? LIMIT 1`).bind(result.accountId,id).first();
      if(allowed)destination=`${root}/account/order.html?type=COASTER&id=${encodeURIComponent(id)}`;
    }
    return new Response(null,{status:302,headers:{Location:destination,'Set-Cookie':result.cookie,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
  }catch(error){
    return new Response(null,{status:302,headers:{Location:`${root}/account/login.html?error=${encodeURIComponent(error.message||'This sign-in link is invalid or expired.')}`,'Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
  }
}
