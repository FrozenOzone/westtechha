#!/usr/bin/env node
/* Stage 5L3: optional public storefront smoke. Strict GET-only; no login, checkout, D1, provider API or mutations. */
const variants={
 '--preview':'https://pickup-stage1-preview.westtechha.pages.dev',
 '--production':'https://westtechha.com'
};
const selected=process.argv.slice(2);
if(selected.length!==1||!Object.hasOwn(variants,selected[0])){
 console.log('No requests made. Opt-in: node scripts/release-5l3/stage5l3-readonly-smoke.mjs --preview');
 console.log('Or: node scripts/release-5l3/stage5l3-readonly-smoke.mjs --production');
 process.exit(selected.length?2:0);
}
const base=variants[selected[0]];
const paths=['/','/coasters/','/enclosures/','/account/login.html','/coasters/order-approval.html','/shipping.html'];
let problems=0;
for(const p of paths){
 const url=new URL(p,base);
 if(url.origin!==base)throw new Error('Unexpected target');
 let outcome;
 try{
  const r=await fetch(url,{method:'GET',redirect:'manual',signal:AbortSignal.timeout(9000),headers:{Accept:'text/html'}});
  const redirect=r.headers.get('location')||'';
  const auth=/cloudflareaccess|cdn-cgi\/access/i.test(redirect)||[401,403].includes(r.status);
  outcome=auth?'ACCESS REQUIRED':(r.status>=200&&r.status<400?'HTTP '+r.status:'ERROR HTTP '+r.status);
  if(!auth&&(r.status<200||r.status>=400))problems++;
 }catch(e){problems++;outcome='ERROR '+String(e?.message||e).slice(0,100);}
 console.log(`${selected[0].slice(2).toUpperCase()} ${p}: ${outcome}`);
}
console.log('GET-only smoke finished. Access-required paths need manual browser validation. No writes/payments performed.');
if(problems)process.exitCode=1;
