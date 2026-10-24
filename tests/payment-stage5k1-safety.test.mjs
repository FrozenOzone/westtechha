import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const paypal=fs.readFileSync('functions/_lib/coaster-paypal.js','utf8');
const admin=fs.readFileSync('functions/api/admin/coasters/orders/[orderId]/paypal/index.js','utf8');
const start=paypal.indexOf('function verifyCoasterProviderCapture(');
const end=paypal.indexOf('async function reservePayPalCapture(',start);
assert.ok(start>0&&end>start,'Stage 5K1 provider validation is in front of capture lock');
const validate=new Function('money',paypal.slice(start,end)+'\nreturn verifyCoasterProviderCapture;')(
 v=>{const n=Number(v??0);return Number.isFinite(n)&&n>=0?Math.round(n*100)/100:0;});
const ref='3JL385438B430994V',orderId='WTCC-20261023-1006',captureId='30S5889341615220G';
const addr={fullName:'John Doe',address1:'2211 N First St',address2:'',city:'San Jose',state:'CA',postalCode:'95131',countryCode:'US'};
const shipping={name:{full_name:'John Doe'},address:{address_line_1:'2211 N First St',admin_area_2:'San Jose',admin_area_1:'CA',postal_code:'95131',country_code:'US'}};
const order={orderId,fulfillmentMethod:'SHIP',finalAmount:38.94,taxAmount:0,paymentTotal:38.94,taxAddressJson:JSON.stringify(addr)};
const provider={id:ref,status:'COMPLETED',purchase_units:[{custom_id:orderId,amount:{currency_code:'USD',value:'38.94'},shipping,payments:{captures:[{id:captureId,status:'COMPLETED',amount:{currency_code:'USD',value:'38.94'}}]}}]};
const clone=o=>JSON.parse(JSON.stringify(o));
const rejects=(o,p=provider)=>assert.throws(()=>validate(o,ref,p,p),/Do not pay again/);

test('valid completed PayPal shipping capture matches locked order, tax, and destination',()=>{
 assert.deepEqual(validate(order,ref,provider,provider),{captureId,amount:38.94});
});
test('sparse capture response can rely on previously verified provider order details',()=>{
 const captured=clone(provider);delete captured.purchase_units[0].amount;delete captured.purchase_units[0].custom_id;
 assert.equal(validate(order,ref,provider,captured).captureId,captureId);
});
test('pickup Venmo capture validates paid amount and USD without shipping',()=>{
 const pickup={...order,fulfillmentMethod:'LOCAL_PICKUP',finalAmount:29.99,taxAmount:2.92,paymentTotal:32.91,taxAddressJson:''};
 const prov=clone(provider);prov.purchase_units[0].amount.value='32.91';prov.purchase_units[0].payments.captures[0].amount.value='32.91';delete prov.purchase_units[0].shipping;
 assert.equal(validate(pickup,ref,prov,prov).amount,32.91);
});
test('reject incomplete and ambiguous completed responses before recording PAID',()=>{
 for(const change of [
 p=>{p.status='APPROVED'},p=>{delete p.id},p=>{delete p.purchase_units[0].payments.captures[0].id},
 p=>{p.purchase_units[0].payments.captures[0].status='PENDING'},
 p=>{p.purchase_units[0].payments.captures.push(clone(p.purchase_units[0].payments.captures[0]))},
 p=>{p.purchase_units[0].custom_id='OTHER-ORDER'},
 p=>{p.purchase_units[0].amount.value='39.94'},
 p=>{p.purchase_units[0].payments.captures[0].amount.value='39.94'},
 p=>{p.purchase_units[0].amount.currency_code='EUR'},
 p=>{p.purchase_units[0].payments.captures[0].amount.currency_code='EUR'}
 ]){const p=clone(provider);change(p);rejects(order,p)}
});
test('reject changed shipping destination and missing locked tax address',()=>{
 for(const [key,v] of [['address_line_1','999 Changed Ave'],['admin_area_2','Other City'],['admin_area_1','NV'],['postal_code','99999'],['country_code','CA']]){
  const p=clone(provider);p.purchase_units[0].shipping.address[key]=v;rejects(order,p);
 }
 rejects({...order,taxAddressJson:''});
});
test('shared markCaptured verifies before paid update, PayPal and Venmo both use it',()=>{
 const s=paypal.indexOf('export async function markCaptured('),e=paypal.indexOf('export async function captureCoasterPayPalOrder(',s);
 const body=paypal.slice(s,e),v=body.indexOf('verifyCoasterProviderCapture('),w=body.indexOf("payment_status='PAID'");
 assert.ok(s>=0&&v>=0&&w>v,'Provider validation precedes PAID write');
 assert.match(body,/const cap=verified\.captureId/);
 assert.match(paypal,/markCaptured\(env,orderId,paypalOrderId/);
});
test('Admin inspection is gated to Preview Sandbox and authenticated Admin',()=>{
 assert.match(admin,/requireCoasterAdmin\(context\)/);
 assert.match(admin,/body\?\.action==='inspect-recovery'/);
 assert.match(admin,/!isCoasterSandbox\(context\)/);
 assert.match(admin,/inspectCoasterPaymentRecovery\(context\.env,context\.params\.orderId\)/);
 assert.match(admin,/body\?\.action!=='sync'/);
});
test('inspection only fetches provider status and cannot initiate payments or unlock',()=>{
 const a=paypal.indexOf('export async function inspectCoasterPaymentRecovery('),b=paypal.indexOf('export async function syncCoasterPayPalOrder(',a);
 const code=paypal.slice(a,b);
 assert.ok(a>0&&b>a);
 assert.match(code,/paypalCall\(env,/);
 assert.doesNotMatch(code,/method:'POST'|\.run\(|\.batch\(|CAPTURING_PAYPAL'\s*,/);
 assert.doesNotMatch(code,/\/capture|\/refund|UPDATE coaster_orders|UPDATE coaster_payment_attempts/);
});
test('read-only inspection reports a reconciliable provider capture without mutating database',async()=>{
 const a=paypal.indexOf('export async function inspectCoasterPaymentRecovery('),b=paypal.indexOf('export async function syncCoasterPayPalOrder(',a);
 const fn=new Function('getCoasterOrderDetail','requireOrdersDb','usd','money','paypalCall','verifyCoasterProviderCapture',paypal.slice(a,b).replace(/^export\s+/,'')+'\nreturn inspectCoasterPaymentRecovery;')(
  async()=>({...order,status:'PROOF_APPROVED',paymentStatus:'CAPTURING_PAYPAL',paypalOrderId:ref,paypalCaptureId:null}),
  ()=>({prepare:(sql)=>({bind:()=>({first:async()=>null})})}),
  n=>Number(n).toFixed(2),n=>Math.round(Number(n)*100)/100,
  async(_env,path,opts)=>{assert.ok(path.includes(ref));assert.equal(opts,undefined);return {data:provider};},validate
 );
 const inspected=await fn({},orderId);
 assert.equal(inspected.providerStatus,'COMPLETED');
 assert.equal(inspected.providerCaptureReference,captureId);
 assert.equal(inspected.captureVerified,true);
 assert.equal(inspected.needsManualReview,true);
});
