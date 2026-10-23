import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const lib=read('functions/_lib/coaster-venmo.js');
const api=read('functions/api/customer/orders/[sourceType]/[orderId]/payment-methods/index.js');
const buyer=read('js/customer-payment-methods.js');
const admin=read('js/coaster-admin.js');
const html=read('admin/coaster-orders.html');
const customerHtml=read('account/order.html');

test('cancellation only changes an attempt from CREATED to CANCELED, never an order',async()=>{
 const a=lib.indexOf('export async function cancelVenmoPickup(');
 const b=lib.indexOf('export async function captureVenmoPickup(',a);
 assert.ok(a>0 && b>a);
 const body=lib.slice(a,b);
 assert.match(body,/WHERE coaster_order_id=\? AND method='VENMO' AND provider_order_id=\? AND status='CREATED'/);
 assert.doesNotMatch(body,/UPDATE coaster_orders/);
 const make=(initial)=>{
  let state=initial;
  const db={prepare(sql){return {bind(...args){return {
   async run(){assert.match(sql,/UPDATE coaster_payment_attempts/);assert.equal(args[0],'WTCC-20261023-1003');assert.equal(args[1],'PROVIDER123456');if(state==='CREATED'){state='CANCELED';return {meta:{changes:1}}}return {meta:{changes:0}}},
   async first(){assert.match(sql,/SELECT status FROM coaster_payment_attempts/);return {status:state}}};}}}};
  const fn=new Function('sanitizeEnvValue','requireOrdersDb','fail',body.replace(/^export\s+/, '')+'\nreturn cancelVenmoPickup;')(x=>String(x||''),()=>db,(m,s)=>Object.assign(new Error(m),{status:s}));
  return {fn,state:()=>state};
 };
 for(const original of ['CREATED','CANCELED']){
  const x=make(original);
  assert.deepEqual(await x.fn({PAYPAL_ENV:'sandbox'},'WTCC-20261023-1003','PROVIDER123456'),{canceled:true});
  assert.equal(x.state(),'CANCELED');
 }
 for(const original of ['CAPTURING','CAPTURED']){
  const x=make(original);
  await assert.rejects(x.fn({PAYPAL_ENV:'sandbox'},'WTCC-20261023-1003','PROVIDER123456'),{status:409});
  assert.equal(x.state(),original);
 }
});

test('cancel endpoint requires Sandbox, authenticated ownership, and accepts matching provider ID',()=>{
 assert.match(api,/requireCustomerSession\(context\)/);
 assert.match(api,/customer_account_orders/);
 assert.match(api,/if\(!isCoasterSandbox\(context\)\)/);
 assert.match(api,/if\(action==='cancelVenmo'\)/);
 assert.match(api,/cancelVenmoPickup\(context.env,order.orderId,id\)/);
 assert.match(api,/if\(origin&&origin!==new URL\(context.request.url\).origin\)/);
});

test('buyer cancellation is persisted, approval is not canceled',()=>{
 assert.match(buyer,/onCancel:async\(\)=>\{/);
 assert.match(buyer,/await post\('cancelVenmo',\{paypalOrderId:id\}\)/);
 assert.match(buyer,/activeCreate=promise/);
 assert.match(buyer,/activeOrderId=data.orderId/);
 const a=buyer.indexOf('onApprove:async');const b=buyer.indexOf('onCancel:async',a);
 assert.ok(a>0&&b>a);
 assert.doesNotMatch(buyer.slice(a,b),/cancelVenmo/);
});

test('order capture guards and no duplicate production queue remain in place',()=>{
 assert.match(lib,/payment_status IN \('NOT_REQUESTED','AWAITING_PAYMENT','AWAITING_TAX_CONFIRMATION','PREVIEW_AWAITING_TEST_PAYMENT','PAYPAL_ERROR'\)/);
 assert.match(lib,/if \(attempt.status!=='CREATED'\)/);
 assert.match(lib,/WHERE attempt_id=\? AND status='CREATED'/);
 assert.match(lib,/WHERE order_id=\? AND payment_status='CAPTURING_VENMO'/);
 assert.match(lib,/markCaptured\(env,orderId,paypalOrderId,details,captured,\{method:'VENMO'\}\)/);
});

test('Admin renders actual method while retaining PayPal processing reference',()=>{
 const a=admin.indexOf('function paymentMethodLabel(');const b=admin.indexOf('function renderProductionWorkOrder()',a);
 assert.ok(a>0&&b>a);
 const fn=new Function('current',admin.slice(a,b)+'\nreturn paymentMethodLabel;')(null);
 assert.equal(fn({events:[{eventType:'VENMO_ORDER_CAPTURED'}],paypalOrderId:'ORDER123'}),'Venmo');
 assert.equal(fn({events:[{eventType:'PAYPAL_ORDER_CAPTURED'}],paypalOrderId:'ORDER123'}),'PayPal');
 assert.equal(fn({events:[],paypalOrderId:'ORDER123'}),'PayPal');
 assert.equal(fn({events:[]}), 'Not recorded');
 assert.match(admin,/Processed by PayPal/);
 assert.match(html,/PROCESSOR REFERENCE/);
 assert.match(html,/coaster-admin\.js\?v=20261023-stage5e1/);
 assert.match(customerHtml,/customer-payment-methods\.js\?v=20261023-stage5h1/);
});
