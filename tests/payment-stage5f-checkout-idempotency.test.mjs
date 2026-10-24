import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';

const lib=readFileSync('functions/_lib/coaster-venmo.js','utf8');
const anchor=lib.indexOf('// D1 serializes each INSERT statement.');
const end=lib.indexOf('// Record a buyer-abandoned Sandbox attempt',anchor);
assert.ok(anchor>0 && end>anchor,'Stage 5F checkout implementation must precede Stage 5E cancellation handler');
const code=lib.slice(anchor,end).replace('export async function startVenmoPickup','async function startVenmoPickup');
const quote={itemAmount:'29.99',taxAmount:'2.92',totalAmount:'32.91',taxRate:0.0973,jurisdictionCode:'CO',source:'TAX',address:{city:'Henderson',state:'CO'}};
const id='WTCC-20261023-1005';
const utc=()=>new Date().toISOString().slice(0,19).replace('T',' ');
function make() {
 const rows=[], events={creates:0,reads:0};
 const order={orderId:id,status:'PROOF_APPROVED',proofStatus:'APPROVED',paymentRequired:true,paymentStatus:'NOT_REQUESTED',fulfillmentMethod:'LOCAL_PICKUP'};
 let providerStatus='CREATED',providerFailure=false,onClaim=null,paidDuringPost=false;
 const db={prepare(sql){return {bind(...a){return {
  async first(){
   if(sql.startsWith('SELECT * FROM coaster_payment_attempts')) return rows.filter(x=>x.coaster_order_id===a[0]&&['CREATING','CREATED','CAPTURING'].includes(x.status)).at(-1)||null;
   if(sql.startsWith('SELECT COUNT(*)'))return {n:rows.filter(x=>x.coaster_order_id===a[0]&&!['ABANDONED','FAILED'].includes(x.status)).length};
   if(sql.startsWith('SELECT status FROM coaster_payment_attempts'))return rows.find(x=>x.attempt_id===a[0])||null;
   throw Error('Unexpected SELECT: '+sql);
  },
  async run(){
   if(sql.startsWith('UPDATE coaster_payment_attempts SET status=\'ABANDONED\'')) {let n=0; for(const x of rows)if(x.coaster_order_id===a[0]&&x.status==='CREATING'&&Date.now()-Date.parse(x.updated_at.replace(' ','T')+'Z')>180000){x.status='ABANDONED';n++}return {meta:{changes:n}};}
   if(sql.startsWith('INSERT INTO coaster_payment_attempts')){
    if(onClaim)onClaim();
    const [attemptId,orderId,pendingRef,amount,quoteJson]=a;
    if(order.paymentStatus==='PAID'||!['PROOF_APPROVED','AWAITING_PAYMENT'].includes(order.status)||rows.some(x=>x.coaster_order_id===orderId&&['CREATING','CREATED','CAPTURING'].includes(x.status)))return {meta:{changes:0}};
    rows.push({attempt_id:attemptId,coaster_order_id:orderId,provider_order_id:pendingRef,amount,quote_json:quoteJson,status:'CREATING',created_at:utc(),updated_at:utc()});return {meta:{changes:1}};
   }
   if(sql.startsWith('UPDATE coaster_payment_attempts SET provider_order_id=')){
    const [providerId,attemptId,pendingRef]=a, r=rows.find(x=>x.attempt_id===attemptId&&x.provider_order_id===pendingRef&&x.status==='CREATING'&&order.paymentStatus!=='PAID');
    if(r){r.provider_order_id=providerId;r.status='CREATED';return {meta:{changes:1}}}return {meta:{changes:0}};
   }
   if(sql.startsWith('UPDATE coaster_payment_attempts SET status=\'FAILED\'')){
    const [attemptId,pendingRef]=a,r=rows.find(x=>x.attempt_id===attemptId&&x.provider_order_id===pendingRef&&x.status==='CREATING');if(r){r.status='FAILED';return {meta:{changes:1}}}return {meta:{changes:0}};
   }
   if(sql.startsWith('UPDATE coaster_payment_attempts SET status=\'VOIDED\'')||sql.startsWith('UPDATE coaster_payment_attempts SET status=\'EXPIRED\'')){
    const r=rows.find(x=>x.attempt_id===a[0]&&x.status==='CREATED');if(r){r.status=sql.includes("'VOIDED'")?'VOIDED':'EXPIRED';return {meta:{changes:1}}}return {meta:{changes:0}};
   }
   throw Error('Unexpected UPDATE: '+sql);
  }
 };}}}};
 const start=new Function('validMoney','sanitizeEnvValue','getCoasterOrderDetail','quoteFor','fail','requireOrdersDb','crypto','api',code+'\nreturn startVenmoPickup;')(
  v=>/^\d+\.\d{2}$/.test(v),
  x=>String(x||''),
  async()=>order,
  async()=>structuredClone(quote),
  (m,s=409)=>Object.assign(new Error(m),{status:s}),
  ()=>db,
  {randomUUID},
  async(_env,path,opts)=>{
   if(opts?.method==='POST'){
    events.creates++;
    await new Promise(r=>setImmediate(r));
    if(providerFailure)throw Object.assign(new Error('PayPal temporarily unavailable'),{status:502});
    if(paidDuringPost)order.paymentStatus='PAID';
    return {id:'ORDER'+String(events.creates).padStart(10,'0')};
   }
   events.reads++;
   return {status:providerStatus,purchase_units:[{custom_id:id,amount:{currency_code:'USD',value:'32.91'}}]};
  });
 const env={PAYPAL_ENV:'sandbox',PAYPAL_CURRENCY:'USD'};
 return {rows,events,order,env,start,provider:(s)=>{providerStatus=s},failure:(v)=>{providerFailure=v},paidDuringPost:(v)=>{paidDuringPost=v},onClaim:(fn)=>{onClaim=fn}};
}

test('Stage 5F has one atomic D1 reservation, checked inside SQL against paid orders',()=>{
 assert.match(code,/INSERT INTO coaster_payment_attempts/);
 assert.match(code,/SELECT \?,\?,'VENMO'/);
 assert.match(code,/NOT EXISTS \(SELECT 1 FROM coaster_payment_attempts WHERE coaster_order_id=\? AND method='VENMO' AND status IN \('CREATING','CREATED','CAPTURING'\)\)/);
 assert.match(code,/WHERE order_id=\? AND payment_required=1 AND proof_status='APPROVED'/);
 assert.match(code,/payment_status IN \('NOT_REQUESTED','AWAITING_PAYMENT'/);
 assert.match(code,/UPDATE coaster_payment_attempts SET provider_order_id=\?,status='CREATED'/);
 assert.match(code,/WHERE attempt_id=\? AND provider_order_id=\? AND status='CREATING'/);
});

test('two simultaneous start calls create only one provider order',async()=>{
 const f=make();const results=await Promise.allSettled([f.start(f.env,id,'32.91'),f.start(f.env,id,'32.91')]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(results.filter(x=>x.status==='rejected').length,1);
 assert.equal(f.events.creates,1);
 assert.equal(f.rows.length,1);
 assert.equal(f.rows[0].status,'CREATED');
 const again=await f.start(f.env,id,'32.91');
 assert.equal(again.orderId,results.find(x=>x.status==='fulfilled').value.orderId);
 assert.equal(again.reused,true);
 assert.equal(f.events.creates,1);
 assert.equal(f.rows.length,1);
});

test('multiple refresh-like starts reuse one checked provider order',async()=>{
 const f=make();const first=await f.start(f.env,id,'32.91');
 for(let i=0;i<4;i++)assert.deepEqual(await f.start(f.env,id,'32.91'),{orderId:first.orderId,reused:true});
 assert.equal(f.events.creates,1);assert.equal(f.rows.length,1);
});

test('after canceled attempt only one fresh provider order is created',async()=>{
 const f=make();await f.start(f.env,id,'32.91');f.rows[0].status='CANCELED';
 const n=await f.start(f.env,id,'32.91');assert.equal(n.reused,false);
 assert.equal(f.rows.length,2);assert.equal(f.events.creates,2);
 assert.equal(f.rows[0].status,'CANCELED');assert.equal(f.rows[1].status,'CREATED');
});

test('provider API failures release reservation without exposing pending IDs',async()=>{
 const f=make();f.failure(true);await assert.rejects(f.start(f.env,id,'32.91'),{status:502});
 assert.equal(f.rows[0].status,'FAILED');f.failure(false);
 const done=await f.start(f.env,id,'32.91');assert.equal(done.reused,false);assert.equal(f.rows[1].status,'CREATED');
});

test('paid order changes between validation and D1 claim cannot create a checkout',async()=>{
 const f=make();f.onClaim(()=>{f.order.paymentStatus='PAID'});
 await assert.rejects(f.start(f.env,id,'32.91'),{status:409});
 assert.equal(f.events.creates,0);assert.equal(f.rows.length,0);
});

test('already approved payment requires reconciliation, never creates another',async()=>{
 const f=make();await f.start(f.env,id,'32.91');f.provider('APPROVED');
 await assert.rejects(f.start(f.env,id,'32.91'),{status:409});assert.equal(f.events.creates,1);
});

test('quote changes, capture in progress, and fresh payment method guards block new checkouts',async()=>{
 const f=make();await f.start(f.env,id,'32.91');
 f.rows[0].amount='88.88';await assert.rejects(f.start(f.env,id,'32.91'),{status:409});
 f.rows[0].amount='32.91';f.rows[0].status='CAPTURING';
 await assert.rejects(f.start(f.env,id,'32.91'),{status:409});assert.equal(f.events.creates,1);
});

test('abandoned old CREATING reservation can be recovered',async()=>{
 const f=make();f.rows.push({attempt_id:'OLD-RESERVATION',coaster_order_id:id,method:'VENMO',provider_order_id:'PENDINGOLD',amount:'32.91',quote_json:JSON.stringify(quote),status:'CREATING',created_at:'2026-01-01 00:00:00',updated_at:'2026-01-01 00:00:00'});
 const a=await f.start(f.env,id,'32.91');assert.equal(a.reused,false);
 assert.equal(f.rows[0].status,'ABANDONED');assert.equal(f.rows[1].status,'CREATED');
});

test('provider result is not exposed if a competing checkout paid during order creation',async()=>{
 const f=make();f.paidDuringPost(true);
 await assert.rejects(f.start(f.env,id,'32.91'),{status:502});
 assert.equal(f.events.creates,1);
 assert.equal(f.rows[0].status,'FAILED');
 assert.equal(f.order.paymentStatus,'PAID');
});
