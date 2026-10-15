import { verifyCustomerToken } from '../../../_lib/customer-account.js';

export async function onRequestGet(context){
  const url=new URL(context.request.url),root=`${url.protocol}//${url.host}`;
  try{const result=await verifyCustomerToken(context.env,url.searchParams.get('token')||'');return new Response(null,{status:302,headers:{Location:`${root}/account/index.html${result.emailChanged?'?email=updated':''}`,'Set-Cookie':result.cookie,'Cache-Control':'no-store'}});}
  catch(error){return new Response(null,{status:302,headers:{Location:`${root}/account/login.html?error=${encodeURIComponent(error.message||'This sign-in link is invalid or expired.')}`,'Cache-Control':'no-store'}});}
}
