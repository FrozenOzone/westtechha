import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const lib=fs.readFileSync('functions/_lib/coaster-venmo.js','utf8');
const paypal=fs.readFileSync('functions/_lib/coaster-paypal.js','utf8');
const admin=fs.readFileSync('functions/api/admin/coasters/orders/[orderId]/paypal/index.js','utf8');
const anchor='export async function recoverCompletedCoasterVenmoCapture(';
const start=lib.indexOf(anchor);assert.ok(start>0,'Venmo recovery is present');
const snippet=lib.slice(start).replace(/^export\s+/,'');
const providerId='ABC1234567890',captureId='CAPTURE12345',id='WTCC-20261023-1005';
const address={fullName:'Test Buyer',address1:'11300 Emporia St',address2:'',city:'Commerce City',state:'CO',postalCode:'80640',countryCode:'US'};
const quote={itemAmount:'29.99',shippingAmount:'8.95',taxAmount:'2.92',totalAmount:'41.86',taxRate:0.0975,jurisdictionCode:'TEST',source:'colorado',address};
const clone=x=>JSON.parse(JSON.stringify(x));
const provider={id:providerId,status:'COMPLETED',payment_source:{venmo:{venmo_user_id:'test'}},purchase_units:[{custom_id:id,amount:{currency_code:'USD',value:'41.86'},shipping:{name:{full_name:'Test Buyer'},address:{address_line_1:address.address1,admin_area_2:address.city,admin_area_1:address.state,postal_code:address.postalCode,country_code:'US'}},payments:{captures:[{id:captureId,status:'COMPLETED',amount:{currency_code:'USD',value:'41.86'}}]}}]};
const norm=x=>String(x||'').trim().toUpperCase().replace(/\s+/g,' ');
const shippingMatches=(q,unit)=>{const a=q?.address,b=unit?.shipping?.address;return !!a&&!!b&&['address1','address2','city','state','postalCode','countryCode'].every((key,i)=>norm(a[key])===norm(b[['address_line_1','address_line_2','admin_area_2','admin_area_1','postal_code','country_code'][i]]))&&norm(a.fullName)===norm(unit.shipping.name?.full_name);};
const fail=(message,status=409)=>Object.assign(new Error(message),{status});
function make(overrides={}){
 const order={orderId:id,status:'AWAITING_PAYMENT',proofStatus:'APPROVED',paymentRequired:true,paymentStatus:'CAPTURING_VENMO',fulfillmentMethod:'SHIP',finalAmount:38.94,shippingAmount:8.95,paymentTotal:0,paypalOrderId:null,paypalCaptureId:null,taxAddressJson:null,...overrides};
 let remote=clone(provider),attempt={attempt_id:'AT1',coaster_order_id:id,method:'VENMO',status:'CAPTURING',provider_order_id:providerId,quote_json:JSON.stringify(quote),amount:'41.86'},providerGets=0,writes=0,markCount=0,afterGet=null;
 const db={prepare(sql){return {bind(...args){return {async first(){assert.match(sql,/SELECT \*/);return attempt},async run(){writes++;assert.match(sql,/UPDATE coaster_(?:orders|payment_attempts)/);if(sql.includes('UPDATE coaster_orders')){
    assert.equal(args[0],providerId);assert.equal(args[1],29.99);assert.equal(args[2],2.92);assert.equal(args[10],id);
    if(order.paymentStatus!=='CAPTURING_VENMO')return {meta:{changes:0}};
    order.paypalOrderId=providerId;order.paymentTotal=41.86;order.taxAmount=2.92;order.taxAddressJson=JSON.stringify(quote.address);
    return {meta:{changes:1}};
   }if(sql.includes('UPDATE coaster_payment_attempts')){if(attempt.status!=='CAPTURING')return {meta:{changes:0}};attempt.status='CAPTURED';return {meta:{changes:1}};}
 }};}}}};
 const getFn=new Function('fail','sanitizeEnvValue','requireOrdersDb','getCoasterOrderDetail','api','providerShippingMatches','markCaptured',snippet+'\nreturn recoverCompletedCoasterVenmoCapture;');
 const fn=getFn(fail,x=>String(x||''),()=>db,async()=>clone(order),async(_env,path,opts)=>{assert.equal(opts,undefined,'GET only, no /capture request');assert.equal(path,'/v2/checkout/orders/'+providerId);providerGets++;if(afterGet)afterGet();return remote},shippingMatches,async(_env,orderId,ref,details,captured,options)=>{markCount++;assert.equal(options.method,'VENMO');assert.equal(orderId,id);assert.equal(ref,providerId);assert.equal(order.paypalOrderId,ref);order.paymentStatus='PAID';order.paypalCaptureId=captureId;order.status='PRODUCTION_QUEUE';return {...order}});
 return {fn,env:{PAYPAL_ENV:'sandbox'},order,attempt,changeProvider:fn=>{const p=clone(provider);fn(p);remote=p},changeAttempt:fn=>fn(attempt),onGet:fn=>{afterGet=fn},stats:()=>({providerGets,writes,markCount})};
}
const reject=(v)=>assert.rejects(v,/(?:recovery|quote|capture|order|provider|frozen|lock|Sandbox|Venmo|shipping|total|paid|amount|payment|record|PayPal)/i);
test('completed captured Venmo order is recovered once; never calls provider capture',async()=>{
 const x=make(),r=await x.fn(x.env,id,providerId,captureId);
 assert.equal(r.recovered,true);assert.equal(r.order.paymentStatus,'PAID');assert.equal(x.attempt.status,'CAPTURED');assert.deepEqual(x.stats(),{providerGets:1,writes:2,markCount:1});
 const again=await x.fn(x.env,id,providerId,captureId);assert.equal(again.alreadyPaid,true);assert.deepEqual(x.stats(),{providerGets:1,writes:2,markCount:1});
});
test('an approved but uncaptured provider order never recovers',async()=>{const x=make();x.changeProvider(p=>{p.status='APPROVED';p.purchase_units[0].payments.captures=[]});await reject(x.fn(x.env,id,providerId,captureId));assert.equal(x.stats().writes,0)});
test('rejects non-Venmo, multiple captures, wrong ID and non-USD',async()=>{
 for(const mutation of [p=>delete p.payment_source,p=>p.purchase_units[0].payments.captures.push(clone(p.purchase_units[0].payments.captures[0])),p=>p.purchase_units[0].payments.captures[0].id='DIFFERENTID',p=>p.purchase_units[0].amount.currency_code='EUR',p=>p.purchase_units[0].payments.captures[0].amount.currency_code='EUR']){
  const x=make();x.changeProvider(mutation);await reject(x.fn(x.env,id,providerId,captureId));assert.equal(x.stats().writes,0);
 }
});
test('rejects wrong amount, wrong provider order and wrong order reference',async()=>{
 for(const mutation of [p=>p.purchase_units[0].amount.value='40.00',p=>p.purchase_units[0].payments.captures[0].amount.value='40.00',p=>p.id='WRONGREF123',p=>p.purchase_units[0].custom_id='WTCC-20261023-9999']){
  const x=make();x.changeProvider(mutation);await reject(x.fn(x.env,id,providerId,captureId));assert.equal(x.stats().writes,0);
 }
});
test('shipping, recipient and frozen quote tampering blocks recovery',async()=>{
 for(const mutation of [p=>p.purchase_units[0].shipping.address.postal_code='80202',p=>p.purchase_units[0].shipping.name.full_name='Other Recipient']){
  const x=make();x.changeProvider(mutation);await reject(x.fn(x.env,id,providerId,captureId));assert.equal(x.stats().writes,0);
 }
 const y=make();y.changeAttempt(a=>a.amount='42.00');await reject(y.fn(y.env,id,providerId,captureId));assert.equal(y.stats().providerGets,0);
 const z=make({taxAddressJson:JSON.stringify({...address,postalCode:'99999'})});await reject(z.fn(z.env,id,providerId,captureId));assert.equal(z.stats().providerGets,0);
});
test('other payment statuses cannot recover',async()=>{
 for(const paymentStatus of ['AWAITING_PAYMENT','CAPTURING_PAYPAL','CREATING_PAYPAL_ORDER','PAYPAL_ERROR']){
  const x=make({paymentStatus});await reject(x.fn(x.env,id,providerId,captureId));assert.deepEqual(x.stats(),{providerGets:0,writes:0,markCount:0});
 }
});
test('provider GET race cannot finalize changed order or attempt',async()=>{
 for(const change of [x=>x.order.paymentStatus='CAPTURING_PAYPAL',x=>x.attempt.status='CANCELED',x=>x.order.finalAmount=45]){
  const x=make();x.onGet(()=>change(x));await reject(x.fn(x.env,id,providerId,captureId));assert.equal(x.stats().writes,0);
 }
});
test('Sandbox only, strict identity and references required before provider lookup',async()=>{
 const x=make();await reject(x.fn({PAYPAL_ENV:'live'},id,providerId,captureId));await reject(x.fn(x.env,id,'BAD','CAPTURE12345'));await reject(x.fn(x.env,id,providerId,'BAD'));
 assert.equal(x.stats().providerGets,0);
});
test('paid order from different capture cannot be treated as success',async()=>{
 const x=make({paymentStatus:'PAID',paypalOrderId:providerId,paypalCaptureId:'OTHER123456'});
 await reject(x.fn(x.env,id,providerId,captureId));assert.equal(x.stats().writes,0);
});
test('Admin recovery is explicitly gated; stalled PayPal creation is read-only',()=>{
 assert.match(admin,/requireCoasterAdmin\(context\)/);assert.match(admin,/body\?\.action==='recover-completed-venmo'/);assert.match(admin,/acknowledgeRisk!==true/);assert.match(admin,/!isCoasterSandbox\(context\)/);assert.match(admin,/Invalid recovery request origin/);assert.match(admin,/JSON request required/);
 assert.match(paypal,/creationLockReview='Checkout creation is incomplete/);
 assert.match(paypal,/if\(!ref\|\|ref\.startsWith\('PENDING'\)\)return summary/);
 assert.doesNotMatch(admin,/clear-creation-lock|reset-stuck-creation/);
});
test('recovery does not charge/refund or clear locks and preserves original endpoints',()=>{
 assert.doesNotMatch(snippet,/\/capture['"`]|\/refund|method:'POST'|payment_status='NOT_REQUESTED'|status='CANCELED'/);
 assert.match(snippet,/markCaptured\(env,orderId,ref,provider,provider,\{method:'VENMO'\}\)/);
 assert.match(lib,/export async function captureVenmoPickup/);
 assert.match(admin,/body\?\.action==='recover-completed-paypal'/);
 assert.match(admin,/body\?\.action==='repair-paid-work-order'/);
});
