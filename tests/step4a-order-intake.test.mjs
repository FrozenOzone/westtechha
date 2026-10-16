import assert from 'node:assert/strict';
import {test} from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {createCustomerOrderReceiptLink,requestCustomerLogin} from '../functions/_lib/customer-account.js';
import {onRequestGet as verify} from '../functions/api/customer/auth/verify.js';
import {sendCoasterCustomerEmail} from '../functions/_lib/coaster-email.js';

const id='WTCC-20261016-1007';
const other='WTCC-20261016-1008';
const origin='https://pickup-stage1-preview.westtechha.pages.dev';
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
const d1={prepare(sql){return {bind(...args){return {first:async()=>db.prepare(sql).get(...args),run:async()=>db.prepare(sql).run(...args),all:async()=>({results:db.prepare(sql).all(...args)})};}};},async batch(items){for(const stmt of items)await stmt.run();}};
const env={ORDERS_DB:d1,RESEND_API_KEY:'fake-key'};
const order={orderId:id,customerName:'Test Customer',customerEmail:'customer@test.example',customerPhone:'7205551234',mobileCarrier:'OTHER',communicationPreference:'EMAIL',smsConsent:false,setSize:4,setCount:1,totalCoasters:4,finalAmount:29.99,status:'DESIGN_REVIEW'};
let receiptUrl='';
const sent=[];
const originalFetch=globalThis.fetch;
globalThis.fetch=async (_url,options)=>{sent.push(JSON.parse(options.body));return new Response(JSON.stringify({id:'fake-delivery-id'}),{status:200,headers:{'Content-Type':'application/json'}});};

test('creates a linked customer account and one-time access URL scoped to the Preview order',async()=>{
 receiptUrl=await createCustomerOrderReceiptLink(env,{order,requestUrl:origin+'/api/coasters/orders'});
 const url=new URL(receiptUrl);
 assert.equal(url.origin,origin);
 assert.equal(url.pathname,'/api/customer/auth/verify');
 assert.equal(url.searchParams.get('order'),id);
 assert.equal(url.searchParams.get('type'),'COASTER');
 const token=url.searchParams.get('token');assert.ok(token&&token.length===64);
 const stored=db.prepare('SELECT * FROM customer_login_tokens').get();assert.equal(stored.purpose,'ACTIVATE');assert.notEqual(stored.token_hash,token);
 assert.equal(db.prepare('SELECT COUNT(*) AS c FROM customer_account_orders').get().c,1);
});

test('one initial receipt contains the specific order, status, direct link and no payment claim',async()=>{
 const result=await sendCoasterCustomerEmail(env,{type:'REQUEST_RECEIVED',order,receiptUrl,requestUrl:origin+'/api/coasters/orders'});
 assert.equal(result.sent,true);
 assert.equal(sent.length,1,'a separate generic login email is not sent');
 assert.match(sent[0].subject,/received your custom coaster order/i);
 assert.match(sent[0].text,/Status: Design Review/);
 assert.match(sent[0].text,/No payment has been collected/);
 assert.match(sent[0].text,/Open My Order:/);
 assert.ok(sent[0].text.includes(receiptUrl));
 assert.equal(sent[0].to[0],'customer@test.example');
});

test('receipt token signs in and redirects to exactly the customer-owned order',async()=>{
 const response=await verify({env,request:new Request(receiptUrl)});
 assert.equal(response.status,302);
 assert.equal(response.headers.get('location'),`${origin}/account/order.html?type=COASTER&id=${id}`);
 assert.match(response.headers.get('set-cookie'),/HttpOnly; Secure; SameSite=Lax/);
 assert.equal(db.prepare('SELECT COUNT(*) AS c FROM customer_sessions').get().c,1);
 assert.ok(db.prepare('SELECT used_at FROM customer_login_tokens').get().used_at);
});

test('one-time link cannot be used a second time',async()=>{
 const response=await verify({env,request:new Request(receiptUrl)});
 assert.equal(response.status,302);assert.match(response.headers.get('location'),/\/account\/login\.html\?error=/);
 assert.equal(db.prepare('SELECT COUNT(*) AS c FROM customer_sessions').get().c,1);
});

test('customer cannot change URL to a different customer order',async()=>{
 const second=await createCustomerOrderReceiptLink(env,{order,requestUrl:origin+'/api/coasters/orders'});
 const tampered=new URL(second);tampered.searchParams.set('order',other);
 const response=await verify({env,request:new Request(tampered)});
 assert.equal(response.headers.get('location'),`${origin}/account/index.html`);
});

test('receipt URLs reject untrusted hosts',async()=>{
 await assert.rejects(createCustomerOrderReceiptLink(env,{order,requestUrl:'https://evil.test/api/coasters/orders'}),/Unexpected customer portal host/);
});

test('receipt email falls back to sign in when account-link creation is unavailable',async()=>{
 const alt={...order,orderId:'WTCC-20261016-1011'};
 const result=await sendCoasterCustomerEmail(env,{type:'REQUEST_RECEIVED',order:alt,requestUrl:origin+'/api/coasters/orders'});
 assert.equal(result.sent,true);
 const mail=sent.at(-1);assert.ok(mail.text.includes(origin+'/account/login.html'));
 assert.ok(!mail.text.includes('Your one-time access link expires in 20 minutes'));
});

test('existing sign-in request can recover after a used receipt link',async()=>{
 const res=await requestCustomerLogin(env,order.customerEmail,origin+'/api/customer/auth/request');
 assert.equal(res.accepted,true);
 // Existing login endpoint applies an anti-spam 60 second gate.
 // A fresh portal link can be requested after that cooldown.
});

test('real POST handler saves a new order, emails the customer once, and never returns its private link',async()=>{
 const {onRequestPost}=await import('../functions/api/coasters/orders/index.js');
 const additions={order_date:'TEXT',daily_sequence:'INTEGER',status:'TEXT',set_size:'INTEGER',set_count:'INTEGER',total_coasters:'INTEGER',base_price:'REAL',final_amount:'REAL',estimated_printer_minutes:'INTEGER',top_text:'TEXT',bottom_text:'TEXT',field_color:'TEXT',accent_color:'TEXT',ring_color:'TEXT',text_color:'TEXT',customer_notes:'TEXT',rights_confirmed:'INTEGER',artwork_filename:'TEXT',artwork_content_type:'TEXT',artwork_size_bytes:'INTEGER',artwork_object_key:'TEXT',design_snapshot_object_key:'TEXT'};
 for(const [name,type] of Object.entries(additions))db.exec(`ALTER TABLE coaster_orders ADD COLUMN ${name} ${type}`);
 db.exec(`CREATE TABLE coaster_order_counters (order_date TEXT PRIMARY KEY,last_value INTEGER); CREATE TABLE coaster_order_work_log (id INTEGER PRIMARY KEY AUTOINCREMENT,order_id TEXT,work_type TEXT,minutes INTEGER,billable_amount REAL,note TEXT,created_at TEXT);`);
 const objects=new Map();const envSubmit={...env,COASTER_ARTWORK:{async put(key,bytes){objects.set(key,bytes);},async delete(key){objects.delete(key);}}};
 const form=new FormData();
 form.set('customerName','New Test Customer');form.set('customerEmail','new-customer@test.example');form.set('customerPhone','7205559898');
 form.set('mobileCarrier','OTHER');form.set('communicationPreference','EMAIL');form.set('smsConsent','false');
 form.set('rightsConfirmed','true');form.set('setSize','4');form.set('website','');
 form.set('designSnapshot','<svg xmlns="http://www.w3.org/2000/svg"></svg>');
 form.set('artwork',new File([new Uint8Array([137,80,78,71])],'art.png',{type:'image/png'}));
 const before=sent.length;
 const response=await onRequestPost({env:envSubmit,request:new Request(origin+'/api/coasters/orders',{method:'POST',body:form})});
 const payload=await response.json();assert.equal(response.status,201,JSON.stringify(payload));
 assert.equal(payload.ok,true);assert.match(payload.orderId,/^WTCC-\d{8}-\d{4,}$/);
 assert.equal(payload.status,'DESIGN_REVIEW');assert.equal(objects.size,2);
 assert.equal(sent.length,before+2,'exactly a receipt and admin order email; no separate sign-in email');
 const receipt=sent.at(-2),admin=sent.at(-1);
 assert.equal(receipt.to[0],'new-customer@test.example');assert.match(receipt.text,/Open My Order:/);
 assert.match(admin.subject,/NEW CUSTOM COASTER REQUEST/);
 assert.ok(!JSON.stringify(payload).includes('token='));assert.ok(!JSON.stringify(payload).includes('/api/customer/auth/verify'));
 const link=receipt.text.match(/Open My Order: (\S+)/)?.[1];assert.ok(link);
 assert.equal(new URL(link).searchParams.get('order'),payload.orderId);
 assert.equal(db.prepare('SELECT COUNT(*) AS n FROM customer_account_orders WHERE source_order_id=?').get(payload.orderId).n,1);
});
