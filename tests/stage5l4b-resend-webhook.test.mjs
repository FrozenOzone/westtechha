import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createHmac, webcrypto } from 'node:crypto';

const root=process.cwd();
const source=fs.readFileSync(path.join(root,'functions/api/webhooks/resend/index.js'),'utf8');
const customEmail=fs.readFileSync(path.join(root,'functions/_lib/custom-email.js'),'utf8');
const coasterEmail=fs.readFileSync(path.join(root,'functions/_lib/coaster-email.js'),'utf8');
const memo=fs.readFileSync(path.join(root,'scripts/release-5l4/Stage5L4B-Resend-Webhook-Readiness.md'),'utf8');
const snapshot=JSON.parse(fs.readFileSync(path.join(root,'scripts/release-5l4/Stage5L4B-Audit-Snapshot.json'),'utf8'));
const SIGNING_SECRET='whsec_'+Buffer.from('fictional-stage5l4b-test-only-key').toString('base64');

// Execute the real route body with D1 and email dependencies replaced by in-memory stubs.
// No network, no Cloudflare writes, no email and no real signing secret.
function harness(initialReceipt={id:7,order_id:'WTCO-TEST',email_type:'PAYMENT_REQUIRED',audience:'CUSTOMER',recipient:'customer@example.test',status:'SENT',provider_email_id:'email_test'} ){
  const state={ids:new Set(),receipt:initialReceipt?{...initialReceipt}:null,updates:[],events:[],alerts:[],calls:0};
  const db={
    prepare(sql){
      return {
        bind(...args){
          return {
            async run(){
              state.calls++;
              if(sql.includes('INSERT OR IGNORE INTO custom_order_email_webhook_events')){
                const id=args[0];
                if(state.ids.has(id))return {meta:{changes:0}};
                state.ids.add(id);return {meta:{changes:1}};
              }
              if(sql.includes('UPDATE custom_order_email_receipts')){
                state.updates.push([...args]);
                if(state.receipt){state.receipt.status=args[0];state.receipt.last_error=args[3]||null;}
                return {meta:{changes:1}};
              }
              throw Error('Unexpected D1 write in webhook fixture: '+sql.slice(0,85));
            },
            async first(){
              state.calls++;
              if(!sql.includes('SELECT id,order_id,email_type,audience,recipient,status FROM custom_order_email_receipts'))throw Error('Unexpected D1 SELECT in fixture');
              return state.receipt?.provider_email_id===args[0]?{...state.receipt}:null;
            }
          };
        }
      };
    }
  };
  const injected={
    crypto:webcrypto,atob,btoa,TextEncoder,TextDecoder,Date,Response,Set,
    clean:(v,max=500)=>String(v??'').trim().slice(0,max),
    requireOrdersDb:env=>env.ORDERS_DB,
    logCustomEvent:async (_db,id,type,detail)=>{state.events.push({id,type,detail});},
    sendCustomAdminDeliveryFailureEmail:async(_env,data)=>{state.alerts.push(data);},
    jsonResponse:(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}})
  };
  const stripped=source.replace(/^import [^\n]+\r?\n/gm,'').replace(/\bexport\s+(?=async function)/g,'');
  assert.doesNotMatch(stripped,/^import /m,'test harness needs to replace route imports');
  const context=vm.createContext(injected);
  new vm.Script(stripped+'\n;globalThis.handlers={onRequestPost,onRequestGet};',{filename:'actual-resend-route.js'}).runInContext(context);
  return {state,handlers:context.handlers,db};
}
function makeRequest({payload={type:'email.delivered',created_at:new Date().toISOString(),data:{email_id:'email_test'}},secret=SIGNING_SECRET,id='evt_example_01',timestamp=String(Math.floor(Date.now()/1000)),invalid=false,rawOverride}={}){
  const raw=rawOverride??JSON.stringify(payload);
  const key=Buffer.from(secret.slice(6),'base64');
  const sig=createHmac('sha256',key).update(`${id}.${timestamp}.${raw}`,'utf8').digest('base64');
  const headers=new Headers({'svix-id':id,'svix-timestamp':timestamp,'svix-signature':'v1,'+(invalid?'intentionally-invalid':sig)});
  return {request:{headers,url:'https://westtechha.com/api/webhooks/resend',text:async()=>raw},raw,headers};
}
const post=async(h,req,secret=SIGNING_SECRET)=>h.handlers.onRequestPost({env:{RESEND_WEBHOOK_SECRET:secret,ORDERS_DB:h.db},request:req.request});

test('live route rejects webhook POST when signing secret is missing, without D1 work',async()=>{
  const h=harness();const r=await post(h,makeRequest(),'');assert.equal(r.status,503);assert.equal(h.state.calls,0);
});
test('missing or incorrect signature is unauthorized, without D1 work',async()=>{
  const h=harness();const a=makeRequest({invalid:true});assert.equal((await post(h,a)).status,401);
  a.request.headers.delete('svix-signature');assert.equal((await post(h,a)).status,401);assert.equal(h.state.calls,0);
});
test('payload tampering invalidates the signature before any database update',async()=>{
  const h=harness();const a=makeRequest();a.request.text=async()=>a.raw+' ';assert.equal((await post(h,a)).status,401);assert.equal(h.state.calls,0);
});
test('expired and future signatures are rejected by the five-minute window',async()=>{
  const h=harness();for(const delta of [-360,360])assert.equal((await post(h,makeRequest({timestamp:String(Math.floor(Date.now()/1000)+delta),id:'evt_'+delta}))).status,401);assert.equal(h.state.calls,0);
});
test('wrong signing secret fails even if the supplied signature is structurally valid',async()=>{
  const h=harness();const other='whsec_'+Buffer.from('another-test-only-signing-secret').toString('base64');assert.equal((await post(h,makeRequest(),other)).status,401);assert.equal(h.state.calls,0);
});
test('correct signed delivery updates custom-order receipt and records one event',async()=>{
  const h=harness();const r=await post(h,makeRequest());assert.equal(r.status,200);assert.equal(h.state.receipt.status,'DELIVERED');assert.equal(h.state.events.length,1);assert.equal(h.state.events[0].type,'EMAIL_DELIVERED');assert.equal(h.state.alerts.length,0);
});
test('duplicate webhook event ID is idempotent, no duplicate receipt event',async()=>{
  const h=harness();const request=makeRequest();assert.equal((await post(h,request)).status,200);const r=await post(h,request);assert.equal(r.status,200);assert.equal((await r.json()).duplicate,true);assert.equal(h.state.updates.length,1);assert.equal(h.state.events.length,1);
});
test('a correctly signed event with unmatched custom receipt does not falsely mark delivered',async()=>{
  const h=harness(null);const r=await post(h,makeRequest());assert.equal(r.status,200);assert.equal((await r.json()).unmatched,true);assert.equal(h.state.events.length,0);assert.equal(h.state.updates.length,0);
});
test('signed unsupported event is ignored without D1 work',async()=>{
  const h=harness();const r=await post(h,makeRequest({payload:{type:'unrelated.status',data:{email_id:'email_test'}}}));assert.equal(r.status,200);assert.equal((await r.json()).ignored,true);assert.equal(h.state.calls,0);
});
test('signed bounce marks failed delivery and notifies Admin once through mocked sender',async()=>{
  const h=harness();const req=makeRequest({payload:{type:'email.bounced',data:{email_id:'email_test',bounce:{message:'Synthetic test bounce'}}}});assert.equal((await post(h,req)).status,200);assert.equal(h.state.receipt.status,'BOUNCED');assert.equal(h.state.events[0].type,'EMAIL_BOUNCED');assert.equal(h.state.alerts.length,1);assert.equal((await post(h,req)).status,200);assert.equal(h.state.alerts.length,1);
});
test('GET health does not report configured secret or provider credential',async()=>{
  const h=harness();const r=await h.handlers.onRequestGet();assert.equal(r.status,200);const obj=await r.json();assert.equal(obj.ok,true);assert.equal(JSON.stringify(obj).includes('whsec_'),false);
});
test('webhook uses custom order receipt table and is not proof of coaster delivery',()=>{
  assert.match(source,/custom_order_email_receipts/);assert.match(source,/custom_order_email_webhook_events/);
  assert.match(customEmail,/custom_order_email_receipts/);assert.match(coasterEmail,/coaster_order_events/);
  assert.doesNotMatch(coasterEmail,/custom_order_email_receipts/);
  assert.match(memo,/custom-order receipts only/i);
});
test('snapshot separates configured Resend API key from missing Production signing secret',()=>{
  assert.equal(snapshot.stage,'5L4B');assert.equal(snapshot.production.resend_api_key_setting_present,true);
  assert.equal(snapshot.production.webhook_signing_secret_setting_present,false);
  assert.equal(snapshot.preview.webhook_signing_secret_setting_present,true);
  assert.equal(snapshot.release_decision,'HOLD');assert.equal(snapshot.production_changes_authorized,false);
  assert.ok(snapshot.production.custom_email_sent_receipts>=1);
  assert.equal(snapshot.production.webhook_event_count,0);
});
