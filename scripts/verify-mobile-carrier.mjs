import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createCoasterOrder } from '../functions/_lib/coaster-order-data.js';
import { createEnclosureOrder } from '../functions/_lib/enclosure-orders.js';
import { createCustomOrder, saveCustomCustomer } from '../functions/_lib/custom-orders.js';
import { sendTransactionalSms } from '../functions/_lib/sms.js';
import { reorderCustomerOrder, updateCustomerProfile } from '../functions/_lib/customer-account.js';

const sqlite=new DatabaseSync(':memory:');
for(const file of fs.readdirSync('migrations').filter(name=>/^\d{3}_.*\.sql$/.test(name)).sort())sqlite.exec(fs.readFileSync(path.join('migrations',file),'utf8'));
class Statement{
  constructor(sql){this.sql=sql;this.values=[];}
  bind(...values){this.values=values;return this;}
  async run(){return sqlite.prepare(this.sql).run(...this.values);}
  async first(){return sqlite.prepare(this.sql).get(...this.values)||null;}
  async all(){return {results:sqlite.prepare(this.sql).all(...this.values)};}
}
const db={prepare:sql=>new Statement(sql),batch:statements=>Promise.all(statements.map(statement=>statement.run()))};
const bucket={put:async()=>{},delete:async()=>{},get:async()=>null};
const env={ORDERS_DB:db,COASTER_ARTWORK:bucket,RESEND_API_KEY:'test-key'};

const customer=await saveCustomCustomer(env,{displayName:'Carrier Test',email:'carrier@example.com',phone:'7205550100',mobileCarrier:'VERIZON',communicationPreference:'SMS',smsConsent:true});
assert.equal(customer.mobileCarrier,'VERIZON');
const custom=await createCustomOrder(env,{customerId:customer.id,title:'Gateway test',lineItems:[{description:'Test item',quantity:1,unitAmount:10}],estimatedPrinterMinutes:60});
assert.equal(custom.mobileCarrier,'VERIZON');

const enclosure=await createEnclosureOrder(env,{customerName:'Carrier Test',customerEmail:'carrier@example.com',customerPhone:'7205550100',mobileCarrier:'TMOBILE',communicationPreference:'SMS',smsConsent:true,requestConfirmed:true,sku:'scout-30-unloaded',modelLabel:'Scout',color:'White',quantity:1,loadedComponentSkus:[],fulfillmentPreference:'SHIP'});
assert.equal(enclosure.mobileCarrier,'TMOBILE');

const form=new FormData();
for(const [key,value] of Object.entries({customerName:'Carrier Test',customerEmail:'carrier@example.com',customerPhone:'7205550100',mobileCarrier:'VERIZON',communicationPreference:'SMS',smsConsent:'true',rightsConfirmed:'true',setSize:'4',topText:'TEST',bottomText:'ORDER',fieldColor:'orange',accentColor:'royal-blue',ringColor:'white',textColor:'royal-blue',notes:'Carrier test',website:''}))form.set(key,value);
form.set('artwork',new File(['image'],'test.png',{type:'image/png'}));
form.set('designSnapshot','<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4"/></svg>');
const coaster=await createCoasterOrder(env,form);
assert.equal(coaster.mobileCarrier,'VERIZON');

const accountId=Number((await db.prepare(`INSERT INTO customer_accounts (email,display_name,phone,mobile_carrier,communication_preference,sms_consent,email_verified_at) VALUES (?,?,?,?,?,?,CURRENT_TIMESTAMP) RETURNING id`).bind('portal@example.com','Portal Test','7205550101','VERIZON','EMAIL',0).first()).id);
let account={id:accountId,email:'portal@example.com',displayName:'Portal Test',phone:'7205550101',mobileCarrier:'VERIZON',communicationPreference:'EMAIL',smsConsent:false,defaultFulfillmentMethod:'UNSET'};
const profile=await updateCustomerProfile(env,account,{displayName:'Portal Test',email:'portal@example.com',phone:'7205550101',mobileCarrier:'TMOBILE',communicationPreference:'SMS',smsConsent:true,defaultFulfillmentMethod:'SHIP',country:'US'},'https://preview.example/account/');
assert.equal(profile.profile.mobileCarrier,'TMOBILE');account=profile.profile;
await db.prepare(`INSERT INTO customer_account_orders (account_id,source_type,source_order_id) VALUES (?,?,?)`).bind(accountId,'CUSTOM',custom.orderId).run();

const previousFetch=globalThis.fetch;let gatewayRecipient='';
globalThis.fetch=async(_url,options)=>{gatewayRecipient=JSON.parse(options.body).to[0];return new Response(JSON.stringify({id:'gateway-test-id'}),{status:200,headers:{'Content-Type':'application/json'}});};
const reorder=await reorderCustomerOrder(env,account,'CUSTOM',custom.orderId,'https://preview.example/account/');
const reordered=await db.prepare(`SELECT mobile_carrier,communication_preference,sms_consent FROM custom_orders WHERE order_id=?`).bind(reorder.orderId).first();
assert.equal(reordered.mobile_carrier,'TMOBILE');assert.equal(reordered.communication_preference,'SMS');assert.equal(reordered.sms_consent,1);
const sent=await sendTransactionalSms(env,{sourceType:'CUSTOM',order:{...custom,customerPhone:'7205550100',mobileCarrier:'VERIZON',communicationPreference:'SMS',smsConsent:true},eventType:'TEST',message:'WestTech test',idempotencyKey:'gateway-test'});
assert.equal(sent.sent,true);assert.equal(gatewayRecipient,'7205550100@vtext.com');
const duplicate=await sendTransactionalSms(env,{sourceType:'CUSTOM',order:{...custom,customerPhone:'7205550100',mobileCarrier:'VERIZON',communicationPreference:'SMS',smsConsent:true},eventType:'TEST',message:'WestTech test',idempotencyKey:'gateway-test'});
assert.equal(duplicate.duplicate,true);
const unsupported=await sendTransactionalSms(env,{sourceType:'CUSTOM',order:{...custom,customerPhone:'7205550100',mobileCarrier:'ATT',communicationPreference:'SMS',smsConsent:true},eventType:'TEST',message:'WestTech test',idempotencyKey:'gateway-unsupported'});
assert.equal(unsupported.reason,'carrier-gateway-unavailable');
globalThis.fetch=previousFetch;

console.log('PASS migrations 001-021');
console.log('PASS Custom, Enclosure, and Coaster carrier persistence');
console.log('PASS Customer Portal profile and reorder carrier persistence');
console.log('PASS Verizon gateway recipient and duplicate suppression');
console.log('PASS unsupported-carrier email fallback');
