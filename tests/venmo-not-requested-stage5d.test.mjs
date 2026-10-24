import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const source = readFileSync(join(process.cwd(),'functions/_lib/coaster-venmo.js'),'utf8');
const match=source.match(/const orderLock=await db\.prepare\("([^"]+)"\)\.bind\(orderId\)\.run\(\);/);
assert.ok(match,'Venmo capture must use a single conditional D1 order claim');
const sql=match[1];
const getInList = column => {
 const m=sql.match(new RegExp('\\b'+column+' IN \\(([^)]+)\\)'));
 assert.ok(m,`${column} must use a constrained list`);
 return m[1].split(',').map(v=>v.trim().replace(/^'|'$/g,''));
};
const allowedPaymentStates=getInList('payment_status');
const allowedOrderStates=getInList('status');

test('newly proof-approved, NOT_REQUESTED local pickup can claim Venmo payment lock',()=>{
 assert.ok(allowedPaymentStates.includes('NOT_REQUESTED'));
 assert.ok(allowedOrderStates.includes('PROOF_APPROVED'));
 assert.match(sql,/payment_required=1/);
 assert.match(sql,/proof_status='APPROVED'/);
 assert.match(sql,/fulfillment_method='LOCAL_PICKUP'/);
 assert.match(sql,/WHERE order_id=\?/);
});

test('paying and paid states remain excluded from competing claims',()=>{
 for(const state of ['PAID','CAPTURING_PAYPAL','CAPTURING_VENMO','CREATING_PAYPAL_ORDER']){
  assert.ok(!allowedPaymentStates.includes(state),`must block ${state}`);
 }
 for(const state of ['IN_PRODUCTION','PRODUCTION_QUEUE','COMPLETED']){
  assert.ok(!allowedOrderStates.includes(state),`must block ${state}`);
 }
});

test('PayPal still requires an independent conditional capture lock',()=>{
 const paypal=readFileSync(join(process.cwd(),'functions/_lib/coaster-paypal.js'),'utf8');
 assert.match(paypal,/CAPTURING_PAYPAL/);
 assert.match(paypal,/payment_status='CAPTURING_PAYPAL'/);
 assert.match(paypal,/payment_status=\?/);
});

test('Venmo capture rejects stale checkout and requires verified provider payment source',()=>{
 assert.match(source,/payment_source\?\.venmo/);
 assert.match(source,/attempt\.status!=='CREATED'/);
 assert.match(source,/fresh\.totalAmount/);
 assert.match(source,/markCaptured\(env,orderId,paypalOrderId,details,captured,\{method:'VENMO'\}\)/);
});
