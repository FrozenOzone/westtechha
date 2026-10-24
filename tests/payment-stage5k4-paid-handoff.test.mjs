import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const lib=readFileSync('functions/_lib/coaster-paid-handoff.js','utf8');
const admin=readFileSync('functions/api/admin/coasters/orders/[orderId]/paypal/index.js','utf8');
const core=lib.replace(/^import .*;\r?\n/gm,'').replace(/export (?=async function|function)/g,'');
function make(opts={}){
 const id='WTCC-20261023-1006',ref='3JL385438B430994V',capture='30S5889341615220G';
 const order={orderId:id,status:'PRODUCTION_QUEUE',paymentStatus:'PAID',paypalOrderStatus:'COMPLETED',paypalOrderId:ref,
  paypalCaptureId:capture,finalAmount:38.94,paymentTotal:38.94,taxAmount:0};
 Object.assign(order,opts.order||{});
 const events=(opts.events||[]).map(e=>({...e}));let work=!!opts.work;const calls={provider:0,insert:0,slot:0,customer:0,admin:0,invite:0};
 const attempt=opts.venmo?{status:opts.venmo}:null;
 const keyC=`coaster-production-queued-${id}`,keyA=`coaster-admin-production-queue-${id}`;
 const insert=(event_type,detail)=>{if(events.some(x=>x.event_type===event_type))return {meta:{changes:0}};events.push({event_type,detail});calls.insert++;return {meta:{changes:1}}};
 const db={prepare(sql){return {bind(...args){return {
  async all(){if(sql.includes('FROM coaster_order_events'))return {results:events};throw Error('Unexpected all: '+sql);},
  async first(){if(sql.includes('FROM manufacturing_work_orders'))return work?{id:28}:null;
   if(sql.includes('FROM coaster_payment_attempts'))return attempt;throw Error('Unexpected first: '+sql);},
  async run(){if(sql.includes('INSERT INTO coaster_order_events')){
    if(order.paymentStatus!=='PAID'||order.status!=='PRODUCTION_QUEUE'||order.paypalOrderId!==args[4]||order.paypalCaptureId!==args[5])return {meta:{changes:0}};
    return insert(args[1],args[2]);}throw Error('Unexpected run: '+sql);}
  };}};}};
 const dependencies=[
  ()=>order,()=>db, v=>String(v??''),
  async(_env,id2,r,c)=>{calls.provider++;if(opts.providerError)throw Error('PayPal mismatch');
   if(id2!==id||r!==ref||c!==capture)throw Error('Wrong capture');
   if(opts.race)order.paypalCaptureId='CHANGED';work=true;return {order:{...order},workOrder:{id:28}};},
  async()=>{calls.slot++;if(opts.slotError)throw Error('Scheduling needs review');
   insert('PRODUCTION_SLOT_ASSIGNED',JSON.stringify({productionWindow:'Nov 6–9, 2026'}));return {assigned:true};},
  async()=>{calls.customer++;if(opts.customerError)return {sent:false,error:'Email provider unavailable'};
   events.push({event_type:'EMAIL_SENT',detail:JSON.stringify({idempotencyKey:keyC})});return {sent:true};},
  async()=>{calls.admin++;events.push({event_type:'EMAIL_SENT',detail:JSON.stringify({idempotencyKey:keyA})});return {sent:true};},
  async()=>{calls.invite++;return {skipped:true,reason:'account-already-active'}}
 ];
 const factory=new Function('getCoasterOrderDetail','requireOrdersDb','sanitizeEnvValue','repairCoasterPaidWorkOrder',
  'assignPaidCoasterSlot','sendCoasterCustomerEmail','sendCoasterAdminProductionEmail','inviteCustomerForOrder',core+'\nreturn {inspectCoasterPaidHandoff,repairCoasterPaidHandoff};');
 const funcs=factory(...dependencies);
 return {...funcs,id,ref,capture,order,events,calls,db,async inspect(){return funcs.inspectCoasterPaidHandoff({},id)},
  async repair(r=ref,c=capture){return funcs.repairCoasterPaidHandoff({PAYPAL_ENV:'sandbox'},id,r,c,'https://pickup-stage1-preview.westtechha.pages.dev/account/order.html')}};
}
const evt=(event_type,detail={})=>({event_type,detail:JSON.stringify(detail)});
test('inspect detects missing production handoff without writing to D1 or PayPal',async()=>{
 const f=make();const report=await f.inspect();assert.equal(report.eligible,true);
 assert.equal(report.hasCaptureEvent,false);assert.equal(report.hasQueueEvent,false);assert.equal(report.hasWorkOrder,false);
 assert.equal(report.customerEmailSent,false);assert.equal(report.adminEmailSent,false);
 assert.deepEqual(f.calls,{provider:0,insert:0,slot:0,customer:0,admin:0,invite:0});
});
test('recover interrupted PayPal handoff once; repeat does not duplicate events, work or email',async()=>{
 const f=make();const first=await f.repair();assert.equal(first.repaired,true);assert.equal(first.addedCaptureEvent,true);
 assert.equal(first.addedQueueEvent,true);assert.equal(first.report.hasProductionSlot,true);
 assert.equal(first.report.hasWorkOrder,true);assert.equal(first.report.customerEmailSent,true);assert.equal(first.report.adminEmailSent,true);
 assert.equal(f.calls.provider,1);assert.equal(f.calls.customer,1);assert.equal(f.calls.admin,1);
 const second=await f.repair();assert.equal(second.addedCaptureEvent,false);assert.equal(second.addedQueueEvent,false);
 assert.equal(f.calls.provider,2);assert.equal(f.calls.customer,1);assert.equal(f.calls.admin,1);assert.equal(f.calls.slot,1);
 assert.equal(f.events.filter(x=>x.event_type==='PRODUCTION_QUEUED').length,1);
});
test('completed Venmo handoff uses VENMO event only, when ledger attempt is CAPTURED',async()=>{
 const f=make({venmo:'CAPTURED'});await f.repair();assert.equal(f.events.some(x=>x.event_type==='VENMO_ORDER_CAPTURED'),true);
 assert.equal(f.events.some(x=>x.event_type==='PAYPAL_ORDER_CAPTURED'),false);
});
test('Venmo CAPTURING attempt with already paid order requires manual review',async()=>{
 const f=make({venmo:'CAPTURING'});await assert.rejects(f.repair(),/manual review/);
 assert.equal(f.calls.provider,0);assert.equal(f.calls.insert,0);
});
test('unpaid and pending orders cannot send messages or backfill production',async()=>{
 for(const status of ['CAPTURING_PAYPAL','AWAITING_PAYMENT','CAPTURING_VENMO','CREATING_PAYPAL_ORDER']){
  const f=make({order:{paymentStatus:status}});await assert.rejects(f.repair(),/manual review/);
  assert.equal(f.calls.provider,0);assert.equal(f.calls.customer,0);
 }
});
test('wrong references and mismatched capture identity fail before provider call',async()=>{
 const f=make();await assert.rejects(f.repair('DIFFERENT',f.capture),/manual review/);
 await assert.rejects(f.repair(f.ref,'DIFFERENT'),/manual review/);
 assert.equal(f.calls.provider,0);
});
test('conflicting existing capture event blocks all repairs',async()=>{
 const f=make({events:[evt('VENMO_ORDER_CAPTURED',{captureId:'WRONG'})]});await assert.rejects(f.repair(),/manual review/);
 assert.equal(f.calls.provider,0);assert.equal(f.calls.insert,0);
});
test('provider verification failure never mutates records or mails',async()=>{
 const f=make({providerError:true});await assert.rejects(f.repair(),/PayPal mismatch/);
 assert.equal(f.calls.insert,0);assert.equal(f.calls.customer,0);assert.equal(f.calls.slot,0);
});
test('race changing local capture while provider is queried fails closed',async()=>{
 const f=make({race:true});await assert.rejects(f.repair(),/changed during verification/);
 assert.equal(f.calls.insert,0);assert.equal(f.calls.customer,0);
});
test('already sent emails are not sent again',async()=>{
 const f=make({work:true,events:[evt('PAYPAL_ORDER_CAPTURED',{captureId:'30S5889341615220G'}),
  evt('PRODUCTION_QUEUED'),evt('PRODUCTION_SLOT_ASSIGNED'),
  evt('EMAIL_SENT',{idempotencyKey:'coaster-production-queued-WTCC-20261023-1006'}),
  evt('EMAIL_SENT',{idempotencyKey:'coaster-admin-production-queue-WTCC-20261023-1006'})]});
 await f.repair();assert.equal(f.calls.customer,0);assert.equal(f.calls.admin,0);assert.equal(f.calls.slot,0);
});
test('provider email delivery failure is reported and safe to retry',async()=>{
 const f=make({customerError:true});const out=await f.repair();assert.equal(out.customerEmail.sent,false);
 assert.equal(out.report.customerEmailSent,false);assert.equal(out.report.adminEmailSent,true);
 await f.repair();assert.equal(f.calls.customer,2);assert.equal(f.calls.admin,1);
});
test('scheduling errors are reported without unlocking or creating a charge',async()=>{
 const f=make({slotError:true});const out=await f.repair();assert.equal(out.slot.reviewRequired,true);
 assert.equal(out.report.hasProductionSlot,false);assert.equal(out.notificationsDeferred,true);assert.equal(f.calls.customer,0);assert.equal(f.calls.admin,0);
});
test('repair refuses later order status to avoid stale production-queue emails',async()=>{
 for(const status of ['IN_PRODUCTION','SHIPPED','COMPLETED']){
  const f=make({order:{status}});await assert.rejects(f.repair(),/manual review/);
  assert.equal(f.calls.admin,0);
 }
});
test('Admin endpoint requires Admin, Preview Sandbox, same-origin JSON, and explicit confirmation',()=>{
 assert.match(admin,/requireCoasterAdmin\(context\)/);
 assert.match(admin,/body\?\.action==='inspect-paid-handoff'\|\|body\?\.action==='repair-paid-handoff'/);
 assert.match(admin,/if\(!isCoasterSandbox\(context\)\)/);
 assert.match(admin,/Invalid recovery request origin/);
 assert.match(admin,/JSON request required/);
 assert.match(admin,/body\.acknowledgeRisk!==true/);
});
test('new K4 helper does not call capture, refund, reset locks, or mark paid',()=>{
 assert.doesNotMatch(lib,/fetch\(|paypalCall\(|UPDATE coaster_orders SET payment_status/);
 assert.match(lib,/repairCoasterPaidWorkOrder\(env,orderId,ref,cap\)/);
 assert.match(lib,/NOT EXISTS \(SELECT 1 FROM coaster_order_events/);
 assert.match(lib,/sendCoasterCustomerEmail/);
 assert.match(lib,/sendCoasterAdminProductionEmail/);
});
