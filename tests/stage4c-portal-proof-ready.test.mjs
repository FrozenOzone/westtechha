import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createCustomerProofReadyLink} from '../functions/_lib/customer-account.js';
import {onRequestGet as verify} from '../functions/api/customer/auth/verify.js';
import {sendCoasterCustomerEmail} from '../functions/_lib/coaster-email.js';

const origin='https://pickup-stage1-preview.westtechha.pages.dev';
const id='WTCC-20261016-1099';
const other='WTCC-20261016-1098';
const db=new DatabaseSync(':memory:');
db.exec(`
CREATE TABLE customer_accounts(id INTEGER PRIMARY KEY AUTOINCREMENT,email TEXT UNIQUE,display_name TEXT,phone TEXT,mobile_carrier TEXT,communication_preference TEXT,sms_consent INTEGER,sms_consented_at TEXT,default_fulfillment_method TEXT,address1 TEXT,address2 TEXT,city TEXT,region TEXT,postal_code TEXT,country TEXT,email_verified_at TEXT,pending_email TEXT,last_login_at TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,updated_at TEXT DEFAULT CURRENT_TIMESTAMP,is_active INTEGER DEFAULT 1);
CREATE TABLE customer_login_tokens(id INTEGER PRIMARY KEY AUTOINCREMENT,account_id INTEGER,purpose TEXT,token_hash TEXT,requested_email TEXT,expires_at TEXT,used_at TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE customer_account_orders(account_id INTEGER,source_type TEXT,source_order_id TEXT,UNIQUE(account_id,source_type,source_order_id));
CREATE TABLE customer_account_events(id INTEGER PRIMARY KEY AUTOINCREMENT,account_id INTEGER,event_type TEXT,detail TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE customer_sessions(account_id INTEGER,session_hash TEXT,expires_at TEXT,last_seen_at TEXT);
CREATE TABLE custom_orders(customer_email TEXT,order_id TEXT,customer_name TEXT,customer_phone TEXT,mobile_carrier TEXT,communication_preference TEXT,sms_consent INTEGER,created_at TEXT);
CREATE TABLE coaster_orders(customer_email TEXT,order_id TEXT,customer_name TEXT,customer_phone TEXT,mobile_carrier TEXT,communication_preference TEXT,sms_consent INTEGER,created_at TEXT);
CREATE TABLE enclosure_orders(customer_email TEXT,order_id TEXT,customer_name TEXT,customer_phone TEXT,mobile_carrier TEXT,communication_preference TEXT,sms_consent INTEGER,created_at TEXT);
CREATE TABLE orders(customer_email TEXT,invoice_id TEXT,customer_name TEXT,customer_phone TEXT,mobile_carrier TEXT,communication_preference TEXT,sms_consent INTEGER,created_at TEXT);
CREATE TABLE coaster_order_events(id INTEGER PRIMARY KEY AUTOINCREMENT,order_id TEXT,event_type TEXT,detail TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);
db.prepare(`INSERT INTO coaster_orders(customer_email,order_id,customer_name,customer_phone,mobile_carrier,communication_preference,sms_consent) VALUES ('customer@test.example',?,?,?,'OTHER','EMAIL',0)`).run(id,'Test Customer','7205551234');
db.prepare(`INSERT INTO coaster_orders(customer_email,order_id,customer_name,customer_phone,mobile_carrier,communication_preference,sms_consent) VALUES ('other@test.example',?,?,?,'OTHER','EMAIL',0)`).run(other,'Other Customer','7205555678');
const env={
  ORDERS_DB:{
    prepare(sql){return {bind(...args){return {first:async()=>db.prepare(sql).get(...args),run:async()=>db.prepare(sql).run(...args),all:async()=>({results:db.prepare(sql).all(...args)})};}};},
    async batch(items){for(const item of items)await item.run();}
  },
  RESEND_API_KEY:'fake-key'
};
const order={orderId:id,customerName:'Test Customer',customerEmail:'customer@test.example',customerPhone:'7205551234',mobileCarrier:'OTHER',communicationPreference:'EMAIL',smsConsent:false,setSize:4,setCount:1,totalCoasters:4,finalAmount:29.99,productionWindow:'Oct 16–17, 2026',proofVersion:1,status:'PROOF_SENT'};
const sent=[];
globalThis.fetch=async(_url,opts)=>{sent.push(JSON.parse(opts.body));return new Response(JSON.stringify({id:'email-123'}),{status:200,headers:{'Content-Type':'application/json'}});};
let link;

test('proof-ready link is authenticated, single-use, Preview scoped and order-specific',async()=>{
  link=await createCustomerProofReadyLink(env,{order,requestUrl:origin+'/api/admin/coasters/orders/'+id+'/proof'});
  const u=new URL(link);
  assert.equal(u.origin,origin);
  assert.equal(u.pathname,'/api/customer/auth/verify');
  assert.equal(u.searchParams.get('type'),'COASTER');
  assert.equal(u.searchParams.get('order'),id);
  assert.equal(u.searchParams.get('token')?.length,64);
  assert.equal(db.prepare('SELECT event_type FROM customer_account_events LIMIT 1').get().event_type,'PROOF_READY_ACCESS_CREATED');
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM customer_account_orders').get().n,1);
  assert.notEqual(db.prepare('SELECT token_hash FROM customer_login_tokens LIMIT 1').get().token_hash,u.searchParams.get('token'));
});

test('proof-ready email promotes the portal, not the standalone approval page',async()=>{
  const response=await sendCoasterCustomerEmail(env,{type:'PROOF_READY',order,approvalUrl:link,requestUrl:origin+'/api/admin/coasters/orders/'+id+'/proof'});
  assert.equal(response.sent,true);
  assert.equal(sent.length,1,'one proof email, no separate sign-in email');
  assert.match(sent[0].subject,/proof is ready/i);
  assert.match(sent[0].text,/Open My Order:/);
  assert.match(sent[0].text,/20 minutes/);
  assert.match(sent[0].text,/approve it or request changes/i);
  assert.ok(sent[0].text.includes(link));
  assert.ok(!sent[0].text.includes('/coasters/order-approval'));
  assert.equal(sent[0].to[0],'customer@test.example');
});

test('proof link opens the correct signed-in customer order and cannot be reused',async()=>{
  const first=await verify({env,request:new Request(link)});
  assert.equal(first.status,302);
  assert.equal(first.headers.get('Location'),`${origin}/account/order.html?type=COASTER&id=${id}`);
  assert.match(first.headers.get('Set-Cookie'),/HttpOnly; Secure; SameSite=Lax/);
  const again=await verify({env,request:new Request(link)});
  assert.match(again.headers.get('Location'),/\/account\/login\.html\?error=/);
});

test('tampered proof link cannot open another customer order',async()=>{
  const correct=await createCustomerProofReadyLink(env,{order,requestUrl:origin+'/api/admin/coasters/orders/'+id+'/proof'});
  const fake=new URL(correct);fake.searchParams.set('order',other);
  const response=await verify({env,request:new Request(fake)});
  assert.equal(response.headers.get('Location'),origin+'/account/index.html');
});

test('proof-ready link rejects untrusted hosts',async()=>{
  await assert.rejects(createCustomerProofReadyLink(env,{order,requestUrl:'https://evil.example/api/admin/coasters/orders/'+id+'/proof'}),/Unexpected customer portal host/);
});

test('proof email falls back to Customer Portal sign-in if one-time access fails',async()=>{
  const alt={...order,orderId:'WTCC-20261016-1097',proofVersion:2};
  const response=await sendCoasterCustomerEmail(env,{type:'PROOF_READY',order:alt,approvalUrl:origin+'/account/login.html',requestUrl:origin+'/api/admin/coasters/orders/'+alt.orderId+'/proof'});
  assert.equal(response.sent,true);
  const msg=sent.at(-1).text;
  assert.match(msg,/Customer Portal Sign-In:/);
  assert.ok(msg.includes(origin+'/account/login.html'));
  assert.ok(!msg.includes('expires in 20 minutes'));
});

test('Stage4B artwork row CSS no longer changes the Order Details article layout',()=>{
  const css=readFileSync(new URL('../css/customer-account.css',import.meta.url),'utf8');
  assert.match(css,/\.customer-order \.customer-order-primary\s*\{display:flex/);
  assert.doesNotMatch(css,/(?:^|\n)\.customer-order-primary\s*\{/);
  const html=readFileSync(new URL('../account/order.html',import.meta.url),'utf8');
  assert.match(html,/customer-order-detail-grid/);
  assert.match(html,/stage4c-layout1/);
});

test('live admin hides legacy copy/open approval-token controls',()=>{
  const js=readFileSync(new URL('../js/coaster-admin.js',import.meta.url),'utf8');
  assert.match(js,/!lastApprovalUrl\|\|!isLocal/);
  assert.match(js,/!version\|\|!isLocal/);
  assert.match(js,/customer received a private link to this order in My Orders/);
});

test('proof release endpoint generates private portal link and does not email the old approval token',()=>{
  const route=readFileSync(new URL('../functions/api/admin/coasters/orders/[orderId]/proof/index.js',import.meta.url),'utf8');
  assert.match(route,/createCustomerProofReadyLink/);
  assert.match(route,/approvalUrl:portalUrl/);
  assert.doesNotMatch(route,/approvalUrl:url,requestUrl/);
});
