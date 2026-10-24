import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const read=p=>fs.readFileSync(path.join(process.cwd(),p),'utf8');
const route=read('functions/api/customer/orders/[sourceType]/[orderId]/payment/index.js');
const guard=read('functions/_lib/coaster-preview-payment-mode.js');
const {coasterCustomerPaymentMode,isCoasterSandbox}=await import('data:text/javascript;base64,'+Buffer.from(guard).toString('base64'));
const deps=['requireCustomerSession','inviteCustomerForOrder','getCoasterOrderDetail','ensureCoasterPayPalOrder','captureCoasterPayPalOrderForCustomer','sendCoasterAdminProductionEmail','requireOrdersDb','jsonResponse','isCoasterSandbox','coasterCustomerPaymentMode'];
const compiled=route.replace(/^import [^\n]*\n/gm,'').replace(/^export async function /gm,'async function ');
assert.doesNotMatch(compiled,/^import /m);
const factory=new Function('d',`const {${deps.join(',')}}=d;\n${compiled}\nreturn {onRequestGet,onRequestPost};`);
const id='WTCC-20261023-1005';
const original={orderId:id,paymentRequired:true,paymentStatus:'AWAITING_PAYMENT',status:'AWAITING_PAYMENT',proofStatus:'APPROVED',fulfillmentMethod:'LOCAL_PICKUP',productionWindow:'Nov 4-5, 2026',paypalOrderId:'PROVIDER1234',paypalApprovalUrl:'https://www.sandbox.paypal.com/checkoutnow?token=PROVIDER1234'};
function fixture(options={}){
 const host=options.host||'pickup-stage1-preview.westtechha.pages.dev';
 const env=options.env||{PAYPAL_ENV:'sandbox',COASTER_PREVIEW_PAYMENT_MODE:'sandbox'};
 const order={...original,...options.order};
 const counts={session:0,db:0,links:0,lookup:0,created:0,captured:0,adminEmail:0,invite:0};
 let providerUrl=options.providerUrl??(env.PAYPAL_ENV==='live'?'https://www.paypal.com/checkoutnow?token=PROVIDER1234':'https://www.sandbox.paypal.com/checkoutnow?token=PROVIDER1234');
 const d={
   async requireCustomerSession(){counts.session++;if(options.noSession)throw Object.assign(new Error('Sign in required.'),{status:401});return {id:72};},
   async getCoasterOrderDetail(){counts.lookup++;return options.noOrder?null:order;},
   requireOrdersDb(){counts.db++;return {prepare(sql){assert.match(sql,/customer_account_orders/);return {bind(accountId,orderId){assert.equal(accountId,72);assert.equal(orderId,id);return {async first(){counts.links++;return options.noLink?null:{owned:1};}};}}}};},
   async ensureCoasterPayPalOrder(_env,orderId,{returnUrl,cancelUrl}){counts.created++;assert.equal(orderId,id);assert.match(returnUrl,/account\/order\?type=COASTER/);assert.match(returnUrl,/payment=return/);assert.match(cancelUrl,/payment=cancel/);return {...order,paypalApprovalUrl:providerUrl};},
   async captureCoasterPayPalOrderForCustomer(_env,orderId,providerId,{confirmTax}){counts.captured++;assert.equal(orderId,id);assert.equal(providerId,original.paypalOrderId);if(options.taxReview)return {order, taxConfirmationRequired:true,taxReview:{taxAmount:'2.92'}};return {order:{...order,paymentStatus:'PAID',status:'PRODUCTION_QUEUE'},capturedNow:options.capturedNow!==false};},
   async sendCoasterAdminProductionEmail(){counts.adminEmail++;},
   async inviteCustomerForOrder(){counts.invite++;},
   jsonResponse(payload,status=200){return new Response(JSON.stringify(payload),{status,headers:{'Content-Type':'application/json'}});},
   isCoasterSandbox,coasterCustomerPaymentMode
 };
 const api=factory(d);
 const run=async(method='GET',body=null,opts={})=>{
   const url='https://'+host+'/api/customer/orders/COASTER/'+id+'/payment';
   const headers=new Headers({'Accept':'application/json',...(method==='POST'?{'Content-Type':'application/json'}:{}),...opts.headers});
   const context={env,params:{sourceType:opts.sourceType||'COASTER',orderId:opts.orderId||id},request:{url,headers,json:async()=>body}};
   const response=await(method==='GET'?api.onRequestGet(context):api.onRequestPost(context));
   assert.equal(response.headers.get('cache-control'),'private, no-store');
   assert.equal(response.headers.get('x-content-type-options'),'nosniff');
   return {status:response.status,data:await response.json()};
 };
 return {run,counts,order,setProviderUrl:x=>providerUrl=x};
}
test('unauthenticated portal cannot query payment status or order IDs',async()=>{
 const x=fixture({noSession:true});const r=await x.run();assert.equal(r.status,401);assert.equal(x.counts.db,0);assert.equal(x.counts.created,0);
});
test('customer ownership controls cross-order access',async()=>{
 const x=fixture({noLink:true});const r=await x.run();assert.equal(r.status,404);assert.equal(x.counts.lookup,0);
});
test('payment route rejects incorrect source and invalid identifiers',async()=>{
 const x=fixture();assert.equal((await x.run('GET',null,{sourceType:'ENCLOSURE'})).status,400);
 assert.equal((await x.run('GET',null,{orderId:'../admin'})).status,400);
 assert.equal(x.counts.lookup,0);
});
test('missing order cannot expose payment status',async()=>{
 const x=fixture({noOrder:true});assert.equal((await x.run()).status,404);
});
test('eligible Sandbox GET is read-only and checkout-ready',async()=>{
 const x=fixture();const r=await x.run();assert.equal(r.status,200);assert.equal(r.data.mode,'sandbox');assert.equal(r.data.canCheckout,true);assert.equal(x.counts.created,0);assert.equal(x.counts.captured,0);
});
test('canonical live mode is eligible with live credentials but makes no provider call on GET',async()=>{
 const x=fixture({host:'westtechha.com',env:{PAYPAL_ENV:'live',PAYPAL_CLIENT_ID:'live-id',PAYPAL_CLIENT_SECRET:'live-secret'}});
 const r=await x.run();assert.equal(r.data.mode,'live');assert.equal(r.data.canCheckout,true);assert.equal(x.counts.created,0);
});
test('paid or capturing order cannot start another checkout',async()=>{
 for(const state of ['PAID','CAPTURING_PAYPAL','CAPTURING_VENMO','CREATING_PAYPAL_ORDER']){
   const x=fixture({order:{paymentStatus:state}});const r=await x.run('POST',{action:'startCheckout'});
   assert.equal(r.status,409,state);assert.equal(x.counts.created,0,state);
 }
});
test('ineligible proof or order phase is blocked',async()=>{
 for(const patch of [{proofStatus:'PENDING'},{status:'IN_PRODUCTION'},{paymentRequired:false}]){
   const x=fixture({order:patch});const r=await x.run('POST',{action:'startCheckout'});assert.equal(r.status,409);assert.equal(x.counts.created,0);
 }
});
test('missing fulfillment or production window fails before provider checkout',async()=>{
 for(const patch of [{fulfillmentMethod:'UNSET'},{productionWindow:''}]){
   const x=fixture({order:patch});const r=await x.run('POST',{action:'startCheckout'});assert.equal(r.status,409);assert.equal(x.counts.created,0);
 }
});
test('cross-origin POST rejected before session and provider work',async()=>{
 const x=fixture();const r=await x.run('POST',{action:'capture',paypalOrderId:original.paypalOrderId},{headers:{Origin:'https://evil.example'}});
 assert.equal(r.status,403);assert.equal(x.counts.session,0);assert.equal(x.counts.captured,0);
});
test('non-JSON POST rejected before session and provider work',async()=>{
 const x=fixture();const r=await x.run('POST',{action:'startCheckout'},{headers:{'Content-Type':'text/plain'}});
 assert.equal(r.status,415);assert.equal(x.counts.session,0);assert.equal(x.counts.created,0);
});
test('Sandbox creates or reuses exactly one provider checkout and has portal return URLs',async()=>{
 const x=fixture();const r=await x.run('POST',{action:'startCheckout'});
 assert.equal(r.status,200);assert.equal(r.data.mode,'sandbox');assert.match(r.data.approvalUrl,/sandbox\.paypal\.com/);assert.equal(x.counts.created,1);assert.equal(x.counts.captured,0);
});
test('live accepts only live HTTPS PayPal destination',async()=>{
 const env={PAYPAL_ENV:'live',PAYPAL_CLIENT_ID:'id',PAYPAL_CLIENT_SECRET:'secret'};
 for(const url of ['https://www.sandbox.paypal.com/checkoutnow','https://www.paypal.com.evil.example/pay','http://www.paypal.com/checkoutnow']){
  const x=fixture({host:'westtechha.com',env,providerUrl:url});const r=await x.run('POST',{action:'startCheckout'});assert.equal(r.status,502,url);assert.equal(x.counts.captured,0);
 }
 const x=fixture({host:'westtechha.com',env});const r=await x.run('POST',{action:'startCheckout'});assert.equal(r.status,200);assert.equal(r.data.mode,'live');assert.match(r.data.approvalUrl,/www\.paypal\.com/);
});
test('Preview environment mismatch cannot call PayPal or capture',async()=>{
 const x=fixture({env:{PAYPAL_ENV:'live',PAYPAL_CLIENT_ID:'id',PAYPAL_CLIENT_SECRET:'secret',COASTER_PREVIEW_PAYMENT_MODE:'sandbox'}});
 const r=await x.run('POST',{action:'startCheckout'});assert.equal(r.status,403);assert.equal(x.counts.session,0);assert.equal(x.counts.created,0);assert.equal(x.counts.captured,0);
});
test('legacy callback reference cannot be replaced by a different provider order',async()=>{
 const x=fixture();const r=await x.run('POST',{action:'capture',paypalOrderId:'DIFFERENT'});assert.equal(r.status,409);assert.equal(x.counts.captured,0);
});
test('capturedNow drives a single notification handoff; retry does not repeat',async()=>{
 const x=fixture();const r=await x.run('POST',{action:'capture',paypalOrderId:original.paypalOrderId});assert.equal(r.status,200);assert.equal(r.data.paid,true);
 assert.deepEqual([x.counts.captured,x.counts.adminEmail,x.counts.invite],[1,1,1]);
 const repeat=fixture({capturedNow:false});await repeat.run('POST',{action:'capture',paypalOrderId:original.paypalOrderId});assert.deepEqual([repeat.counts.captured,repeat.counts.adminEmail,repeat.counts.invite],[1,0,0]);
});
test('tax confirmation is returned to buyer without premature follow-up emails',async()=>{
 const x=fixture({taxReview:true});const r=await x.run('POST',{action:'capture',paypalOrderId:original.paypalOrderId,confirmTax:false});
 assert.equal(r.status,200);assert.equal(r.data.taxConfirmationRequired,true);assert.deepEqual(r.data.taxReview,{taxAmount:'2.92'});assert.equal(x.counts.adminEmail,0);
});
test('invalid POST action fails safely without invoking payment provider',async()=>{
 const x=fixture();const r=await x.run('POST',{action:'refund'});assert.equal(r.status,400);assert.equal(x.counts.created,0);assert.equal(x.counts.captured,0);
});
