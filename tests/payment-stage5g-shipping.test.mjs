import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
const get=p=>readFileSync(p,'utf8');
const lib=get('functions/_lib/coaster-venmo.js');
const api=get('functions/api/customer/orders/[sourceType]/[orderId]/payment-methods/index.js');
const buyer=get('js/customer-payment-methods.js');
const html=get('account/order.html');
const fail=(message,status=409)=>Object.assign(new Error(message),{status});
const order={orderId:'WTCC-20261023-1006',proofStatus:'APPROVED',status:'PROOF_APPROVED',paymentStatus:'NOT_REQUESTED',paymentRequired:true,fulfillmentMethod:'SHIP',productionWindow:'Nov 2–3, 2026',finalAmount:39.99,shippingAmount:7};
const address={fullName:'Test Buyer',address1:'123 Main St',address2:'Apt 7',city:'Denver',state:'CO',postalCode:'80202',countryCode:'US'};
const validMoney=v=>/^\d{1,7}\.\d{2}$/.test(v);
function quoteTest(){
 const a=lib.indexOf('function requireOrder('),b=lib.indexOf('export async function getVenmoShippingQuote(',a);
 assert.ok(a>=0&&b>a);
 const body=lib.slice(a,b);
 let received=null;
 const env={};
 const apiFn=new Function('fail','validMoney','validateShippingAddress','money','buildTaxQuote','PICKUP_ADDRESS',body+'\nreturn quoteFor;')(
 fail,validMoney,
 x=>{if(!x?.address1||!x?.city||!x?.state||!x?.postalCode||x?.countryCode!=='US')throw fail('Invalid destination',400);return {...x};},
 v=>Number(Number(v).toFixed(2)),
 async(_env,ship,opt)=>{received={ship,opt};const tax=ship.state==='CO'?3.21:0;return {address:ship,itemAmount:opt.itemAmount.toFixed(2),shippingAmount:opt.shippingAmount.toFixed(2),taxAmount:tax.toFixed(2),totalAmount:(opt.itemAmount+opt.shippingAmount+tax).toFixed(2),isColorado:ship.state==='CO'};},
 address
 );
 return {apiFn,env,received:()=>received};
}
test('shipping totals derive from approved order, including already-approved shipping; no double shipping',async()=>{
 const m=quoteTest();const q=await m.apiFn(m.env,{...order},address);
 assert.equal(m.received().opt.itemAmount,32.99);
 assert.equal(m.received().opt.shippingAmount,7);
 assert.equal(m.received().opt.taxableAmount,32.99);
 assert.equal(q.totalAmount,'43.20');
 assert.equal(q.address.address1,'123 Main St');
});
test('out-of-state destination uses existing tax service without assuming Colorado tax',async()=>{
 const m=quoteTest();const q=await m.apiFn(m.env,{...order},{...address,state:'UT'});
 assert.equal(q.taxAmount,'0.00');assert.equal(q.totalAmount,'39.99');
});
test('shipping cannot be quoted without complete address, named recipient or approved shipping charge',async()=>{
 const m=quoteTest();
 await assert.rejects(m.apiFn(m.env,{...order},null),{status:400});
 await assert.rejects(m.apiFn(m.env,{...order},{...address,fullName:''}),{status:400});
 await assert.rejects(m.apiFn(m.env,{...order},{...address,countryCode:'CA'}),{status:400});
 await assert.rejects(m.apiFn(m.env,{...order,shippingAmount:100},address),{status:409});
});
test('pickup quote remains independent of shipping address',async()=>{
 const m=quoteTest();const q=await m.apiFn(m.env,{...order,fulfillmentMethod:'LOCAL_PICKUP',finalAmount:29.99},null);
 assert.equal(q.shippingAmount,'0.00');assert.equal(q.isColorado,true);assert.equal(q.totalAmount,'33.20');
});
test('no Venmo shipping unless separately enabled on Preview',()=>{
 assert.match(api,/isCoasterSandbox\(context\)/);
 assert.match(api,/COASTER_VENMO_SHIPPING_SANDBOX_ENABLED/);
 assert.match(api,/order.fulfillmentMethod==='SHIP'/);
 assert.match(api,/requireCustomerSession\(context\)/);
 assert.match(api,/customer_account_orders/);
 assert.match(api,/if\(action==='quoteVenmoShipping'\)/);
 assert.match(api,/getVenmoShippingQuote\(context.env,order.orderId,body.shippingAddress\)/);
 assert.match(api,/startVenmoPickup\(context.env,order.orderId,String\(body.expectedTotal\|\|''\),order.fulfillmentMethod==='SHIP'\?body.shippingAddress:null\)/);
});
test('server computes final shipping quote before creating provider order',()=>{
 assert.match(lib,/shippingAddress=null/);
 assert.match(lib,/quoteFor\(env,order,shippingAddress\)/);
 assert.match(lib,/String\(quote.totalAmount\)!==expectedTotal/);
 assert.match(lib,/shipping_preference:'SET_PROVIDED_ADDRESS'/);
 assert.match(lib,/user_action:'PAY_NOW'/);
 assert.match(lib,/address_line_1:quote.address.address1/);
 assert.match(lib,/shipping:\{currency_code:'USD',value:String\(quote.shippingAmount\)\}/);
 assert.match(lib,/tax_total:\{currency_code:'USD',value:String\(quote.taxAmount\)\}/);
});
test('capture verifies locked amount, provider Venmo and exact shipping before charging',()=>{
 const body=lib.slice(lib.indexOf('export async function captureVenmoPickup('));
 const idx=body.indexOf('const reserved=await db.prepare('), before=body.slice(0,idx);
 assert.ok(idx>0);
 assert.match(before,/sameVenmoQuote\(attempt,fresh\)/);
 assert.match(before,/details\?\.payment_source\?\.venmo/);
 assert.match(before,/providerShippingMatches\(fresh,details.purchase_units\?\.\[0\]\)/);
 assert.match(body,/payment_status='CAPTURING_VENMO'/);
 assert.match(body,/markCaptured\(env,orderId,paypalOrderId,details,captured,\{method:'VENMO'\}\)/);
 assert.match(body,/Capture succeeded but the provider shipping address changed/);
});
test('shipping address matcher rejects a changed provider destination or recipient',()=>{
 const a=lib.indexOf('function providerShippingMatches('),b=lib.indexOf('export async function getVenmoPickupQuote(',a);
 assert.ok(a>0&&b>a);const fn=new Function(lib.slice(a,b)+'\nreturn providerShippingMatches;')();
 const unit={shipping:{name:{full_name:'Test Buyer'},address:{address_line_1:'123 Main St',address_line_2:'Apt 7',admin_area_2:'Denver',admin_area_1:'CO',postal_code:'80202',country_code:'US'}}};
 assert.equal(fn({address},unit),true);
 assert.equal(fn({address}, {...unit,shipping:{...unit.shipping,address:{...unit.shipping.address,postal_code:'85001'}}}),false);
 assert.equal(fn({address}, {...unit,shipping:{...unit.shipping,name:{full_name:'Other Person'}}}),false);
 assert.equal(fn({address}, {...unit,shipping:{...unit.shipping,address:{...unit.shipping.address,address_line_1:'456 Main St'}}}),false);
 assert.equal(fn({address},{}),false);
});
test('buyer requires quote, preserves tax confirmation and invalidates edits',()=>{
 assert.match(buyer,/quoteVenmoShipping/);
 assert.match(buyer,/confirm.checked=false/);
 assert.match(buyer,/shippingFields.forEach\(field=>field.addEventListener\('input'/);
 assert.match(buyer,/shippingAddress:confirmedAddress/);
 assert.match(buyer,/if\(!confirm.checked\)/);
 assert.match(html,/id="co-venmo-shipping"/);
 assert.match(html,/id="co-venmo-ship-quote"/);
 assert.match(html,/customer-payment-methods\.js\?v=20261023-stage5h1/);
});
test('payment labels and existing local-pickup route are unchanged',()=>{
 assert.match(lib,/export async function getVenmoPickupQuote/);
 assert.match(lib,/if\(!ship && !quote.isColorado\)/);
 assert.match(lib,/current.fulfillmentMethod==='SHIP'\?'VENMO_SHIPPING':'WESTTECH_PICKUP'/);
 assert.match(api,/order.fulfillmentMethod==='LOCAL_PICKUP'/);
 assert.match(buyer,/onCancel:async/);
});
