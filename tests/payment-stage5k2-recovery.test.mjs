import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const paypal=readFileSync('functions/_lib/coaster-paypal.js','utf8');
const admin=readFileSync('functions/api/admin/coasters/orders/[orderId]/paypal/index.js','utf8');
const start=paypal.indexOf('export async function recoverCompletedCoasterPayPalCapture(');
assert.ok(start>0,'Stage 5K2 functions are present');
const snippet=paypal.slice(start).replace(/^export\s+/gm,'');
const getFunctions=new Function('sanitizeEnvValue','getCoasterOrderDetail','paypalCall','verifyCoasterProviderCapture','markCaptured','money','ensureManufacturingWorkOrder',snippet+'\nreturn {recoverCompletedCoasterPayPalCapture,repairCoasterPaidWorkOrder};');
const vStart=paypal.indexOf('function verifyCoasterProviderCapture('),vEnd=paypal.indexOf('async function reservePayPalCapture(',vStart);
assert.ok(vStart>0&&vEnd>vStart);
const money=x=>Math.round(Number(x??0)*100)/100;
const verify=new Function('money',paypal.slice(vStart,vEnd)+'\nreturn verifyCoasterProviderCapture;')(money);
const id='WTCC-20261023-1006',providerId='3JL385438B430994V',capId='30S5889341615220G';
const address={fullName:'Test Buyer',address1:'2211 N First St',address2:'',city:'San Jose',state:'CA',postalCode:'95131',countryCode:'US'};
const provider={id:providerId,status:'COMPLETED',purchase_units:[{custom_id:id,amount:{currency_code:'USD',value:'38.94'},shipping:{name:{full_name:'Test Buyer'},address:{address_line_1:'2211 N First St',admin_area_2:'San Jose',admin_area_1:'CA',postal_code:'95131',country_code:'US'}},payments:{captures:[{id:capId,status:'COMPLETED',amount:{currency_code:'USD',value:'38.94'}}]}}]};
const clone=o=>JSON.parse(JSON.stringify(o));
function make(overrides={}){
 const order={orderId:id,proofStatus:'APPROVED',paymentRequired:true,fulfillmentMethod:'SHIP',paymentStatus:'CAPTURING_PAYPAL',status:'AWAITING_PAYMENT',paypalOrderId:providerId,paypalOrderStatus:'APPROVED',paypalCaptureId:null,finalAmount:38.94,paymentTotal:38.94,taxAmount:0,taxAddressJson:JSON.stringify(address),...overrides};
 let state=order,remote=clone(provider),callCount=0,markCount=0,workCount=0,afterGet=null;
 const fn=getFunctions(x=>x,async()=>state,async(_,path,opts)=>{callCount++;assert.equal(opts,undefined,'GET only');assert.equal(path,'/v2/checkout/orders/'+providerId);if(afterGet)afterGet();return {data:remote}},verify,
   async(_env,orderId,ref,details,captured,{method}={})=>{markCount++;assert.equal(method,'PAYPAL');assert.equal(orderId,id);assert.equal(ref,providerId);assert.equal(verify(state,ref,details,captured).captureId,capId);state={...state,paymentStatus:'PAID',status:'PRODUCTION_QUEUE',paypalCaptureId:capId,paypalOrderStatus:'COMPLETED'};return state},money,
   async(_env,type,order)=>{workCount++;assert.equal(type,'COASTER');assert.equal(order.paymentStatus,'PAID');return {id:28};});
 return {...fn,env:{PAYPAL_ENV:'sandbox'},order,states:()=>state,provider:(p)=>{remote=p},beforeRecheck:(f)=>{afterGet=f},stats:()=>({callCount,markCount,workCount})};
}
const fails=(promise)=>assert.rejects(promise,/(?:does not|different|missing|not|review|reconciliation|requires|changed|Sandbox|invalid|capture|Only a recorded)/i);
test('locked PayPal recovery validates exact provider capture then finalizes locally once',async()=>{
 const x=make();const result=await x.recoverCompletedCoasterPayPalCapture(x.env,id,providerId,capId);
 assert.equal(result.recovered,true);assert.equal(result.order.paymentStatus,'PAID');assert.deepEqual(x.stats(),{callCount:1,markCount:1,workCount:0});
});
test('already-paid matching capture returns without any payment operation or provider call',async()=>{
 const x=make({paymentStatus:'PAID',paypalCaptureId:capId});const r=await x.recoverCompletedCoasterPayPalCapture(x.env,id,providerId,capId);
 assert.equal(r.alreadyPaid,true);assert.deepEqual(x.stats(),{callCount:0,markCount:0,workCount:0});
});
test('never recovers an approved but uncompleted PayPal provider order',async()=>{
 const x=make(),p=clone(provider);p.status='APPROVED';p.purchase_units[0].payments.captures=[];x.provider(p);
 await fails(x.recoverCompletedCoasterPayPalCapture(x.env,id,providerId,capId));assert.equal(x.stats().markCount,0);
});
test('wrong captured amount or currency cannot transition to PAID',async()=>{
 for(const patch of [p=>p.purchase_units[0].payments.captures[0].amount.value='40.00',p=>p.purchase_units[0].payments.captures[0].amount.currency_code='EUR']){
  const x=make(),p=clone(provider);patch(p);x.provider(p);await fails(x.recoverCompletedCoasterPayPalCapture(x.env,id,providerId,capId));assert.equal(x.stats().markCount,0);
 }
});
test('changed shipping destination cannot transition to PAID',async()=>{
 const x=make(),p=clone(provider);p.purchase_units[0].shipping.address.postal_code='94102';x.provider(p);
 await fails(x.recoverCompletedCoasterPayPalCapture(x.env,id,providerId,capId));assert.equal(x.stats().markCount,0);
});
test('incorrect provider reference, capture ID, or proof blocks recovery',async()=>{
 const x=make();await fails(x.recoverCompletedCoasterPayPalCapture(x.env,id,'AAAAAAAAAAAA',capId));
 await fails(x.recoverCompletedCoasterPayPalCapture(x.env,id,providerId,'AAAAAAAAAAAA'));
 const y=make({proofStatus:'SENT'});await fails(y.recoverCompletedCoasterPayPalCapture(y.env,id,providerId,capId));
 assert.equal(x.stats().markCount+y.stats().markCount,0);
});
test('never releases other payment states or switches to another payment type',async()=>{
 for(const status of ['AWAITING_PAYMENT','CAPTURING_VENMO','CREATING_PAYPAL_ORDER','PAYPAL_ERROR','NOT_REQUESTED']){
  const x=make({paymentStatus:status});await fails(x.recoverCompletedCoasterPayPalCapture(x.env,id,providerId,capId));assert.deepEqual(x.stats(),{callCount:0,markCount:0,workCount:0});
 }
});
test('provider response cannot finalize if locked order changed while fetching',async()=>{
 const x=make();x.beforeRecheck(()=>{x.order.paymentStatus='CAPTURING_VENMO';});
 await fails(x.recoverCompletedCoasterPayPalCapture(x.env,id,providerId,capId));assert.equal(x.stats().markCount,0);
});
test('Sandbox-only restriction also checked in internal recovery functions',async()=>{
 const x=make();await fails(x.recoverCompletedCoasterPayPalCapture({PAYPAL_ENV:'live'},id,providerId,capId));
 await fails(x.repairCoasterPaidWorkOrder({PAYPAL_ENV:'live'},id,providerId,capId));assert.equal(x.stats().callCount,0);
});
test('work-order repair only for verified already-paid order; no payment capture',async()=>{
 const x=make({paymentStatus:'PAID',paypalOrderStatus:'COMPLETED',paypalCaptureId:capId});
 const r=await x.repairCoasterPaidWorkOrder(x.env,id,providerId,capId);
 assert.equal(r.repaired,true);assert.equal(r.workOrder.id,28);assert.deepEqual(x.stats(),{callCount:1,markCount:0,workCount:1});
});
test('work-order repair refuses unpaid status and mismatched references',async()=>{
 const x=make();await fails(x.repairCoasterPaidWorkOrder(x.env,id,providerId,capId));
 const y=make({paymentStatus:'PAID',paypalOrderStatus:'COMPLETED',paypalCaptureId:capId});
 await fails(y.repairCoasterPaidWorkOrder(y.env,id,'OTHERPROVIDERID',capId));
 await fails(y.repairCoasterPaidWorkOrder(y.env,id,providerId,'BADCAPTURE1234'));
 assert.equal(x.stats().workCount+y.stats().workCount,0);
});
test('Admin endpoint retains auth and Preview Sandbox plus explicit confirmation for mutations',()=>{
 assert.match(admin,/requireCoasterAdmin\(context\)/);assert.match(admin,/body\?\.action==='inspect-recovery'/);
 assert.match(admin,/body\?\.action==='recover-completed-paypal'/);assert.match(admin,/body\?\.action==='repair-paid-work-order'/);
 assert.match(admin,/!isCoasterSandbox\(context\)/);assert.match(admin,/acknowledgeRisk!==true/);
 assert.match(admin,/body\?\.action!=='sync'/);
});
test('recovery never invokes provider capture, refund, or clears locked status',()=>{
 assert.doesNotMatch(snippet,/paypalCall\([^)]*,\s*[^)]*,\s*\{\s*method:/);
 assert.doesNotMatch(snippet,/\/v2\/checkout\/orders\/[^'\n]*\/capture|\/v2\/payments\/captures|refund\(/);
 assert.doesNotMatch(snippet,/UPDATE coaster_orders|UPDATE coaster_payment_attempts/);
 assert.match(snippet,/verifyCoasterProviderCapture/);assert.match(snippet,/markCaptured\(env,orderId,ref,got\.data,got\.data/);
});
