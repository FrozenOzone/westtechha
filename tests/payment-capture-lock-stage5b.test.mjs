import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
const read = path=>readFileSync(path,'utf8');
const paypal = read('functions/_lib/coaster-paypal.js');
const venmo = read('functions/_lib/coaster-venmo.js');
const api = read('functions/api/customer/orders/[sourceType]/[orderId]/payment/index.js');

test('capture uses an order-scoped, conditional PayPal lock for both customer and Admin',()=>{
  assert.match(paypal,/async function reservePayPalCapture\(env,orderId,paypalOrderId\)/);
  assert.equal(paypal.match(/await reservePayPalCapture\(/g)?.length,4);
  assert.match(paypal,/payment_status='CAPTURING_PAYPAL'.*paypal_order_id=\?/);
  assert.match(paypal,/payment_required=1 AND payment_status IN/);
  assert.match(paypal,/payment_status=\? AND paypal_order_id=\?/);
  assert.match(paypal,/requiredLock=method==='VENMO'\?'CAPTURING_VENMO':'CAPTURING_PAYPAL'/);
  assert.match(paypal,/if\(Number\(write\?\.meta\?\.changes\|\|0\)!==1\)/);
  assert.match(paypal,/payment_status NOT IN \('PAID','CAPTURING_PAYPAL','CAPTURING_VENMO','CREATING_PAYPAL_ORDER'\)/);
});

test('Venmo capture preserves provider locks and records payment method',()=>{
  assert.match(venmo,/payment_status IN \('AWAITING_PAYMENT','AWAITING_TAX_CONFIRMATION','PREVIEW_AWAITING_TEST_PAYMENT','PAYPAL_ERROR'\)/);
  assert.match(venmo,/WHERE order_id=\? AND payment_status='CAPTURING_VENMO'/);
  assert.match(venmo,/markCaptured\(env,orderId,paypalOrderId,details,captured,\{method:'VENMO'\}\)/);
  assert.match(paypal,/VENMO_ORDER_CAPTURED/);
  assert.match(api,/CAPTURING_PAYPAL/);
});

test('conditional D1 claim permits only one PayPal capturer',async()=>{
  const start=paypal.indexOf('async function reservePayPalCapture(');
  const end=paypal.indexOf('export async function markCaptured(',start);
  assert.ok(start>=0&&end>start);
  const body=paypal.slice(start,end);
  let status='AWAITING_PAYMENT';const seen=[];
  const db={prepare(sql){seen.push(sql);return {bind(orderId,paypalId){return {async run(){
    const ok=orderId==='WTCC-20261023-1'&&paypalId==='FAKEORDER123'&&status==='AWAITING_PAYMENT';
    if(ok)status='CAPTURING_PAYPAL';
    return {meta:{changes:ok?1:0}};
  }}}}}};
  const reserve=new Function('requireOrdersDb',body+'\nreturn reservePayPalCapture;')(()=>db);
  const results=await Promise.allSettled([
    reserve({},'WTCC-20261023-1','FAKEORDER123'),
    reserve({},'WTCC-20261023-1','FAKEORDER123')
  ]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(results.filter(x=>x.status==='rejected').length,1);
  assert.equal(status,'CAPTURING_PAYPAL');
  assert.match(seen[0],/WHERE order_id=\? AND paypal_order_id=\?/);
});
