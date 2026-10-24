import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const guards=read('functions/_lib/coaster-preview-payment-mode.js');
const backend=read('functions/api/customer/orders/[sourceType]/[orderId]/payment/index.js');
const browser=read('js/customer-order.js');
const html=read('account/order.html');
const sdk=read('js/customer-payment-methods.js');
const mode=await import('data:text/javascript;base64,'+Buffer.from(guards).toString('base64'));
const ctx=(host,env={},admin=null)=>({request:{url:'https://'+host+'/api/customer/orders/COASTER/WTCC-20261023-1005/payment'},env,data:admin?{westtechVerifiedAdmin:admin}:undefined});
const sandbox={PAYPAL_ENV:'sandbox',COASTER_PREVIEW_PAYMENT_MODE:'sandbox'};
const live={PAYPAL_ENV:'live',PAYPAL_CLIENT_ID:'id',PAYPAL_CLIENT_SECRET:'secret'};
const stageMode=c=>mode.coasterCustomerPaymentMode(c);
test('Preview stays sandbox even if live credentials are accidentally configured',()=>{
 assert.equal(stageMode(ctx('pickup-stage1-preview.westtechha.pages.dev',sandbox)),'sandbox');
 assert.notEqual(stageMode(ctx('pickup-stage1-preview.westtechha.pages.dev',live)),'live');
 assert.equal(stageMode(ctx('pickup-stage1-preview.westtechha.pages.dev',{...sandbox,PAYPAL_ENV:'live'})),'configuration_error');
});
test('canonical live hosts only enable live with matching env and credentials',()=>{
 for(const h of ['westtechha.com','www.westtechha.com'])assert.equal(stageMode(ctx(h,live)),'live');
 for(const h of ['westtechha.com','www.westtechha.com'])assert.equal(stageMode(ctx(h,sandbox)),'configuration_error');
 assert.equal(stageMode(ctx('westtechha.com',{...live,PAYPAL_CLIENT_SECRET:''})),'configuration_error');
});
test('unrecognized preview hashes, development host and counterfeit host cannot charge',()=>{
 for(const host of ['dev.westtechha.com','b99e012.westtechha.pages.dev','westtechha.com.attacker.example','example.com','westtechha.pages.dev'])assert.equal(stageMode(ctx(host,live)),'unavailable');
});
test('Dev Admin recovery requires signed middleware result and configured Sandbox',()=>{
 const host='dev.westtechha.com';
 assert.equal(mode.isCoasterSandbox(ctx(host,sandbox)),false);
 assert.equal(mode.isCoasterSandbox(ctx(host,sandbox,'admin@example.com')),true);
 assert.equal(mode.isCoasterSandbox(ctx(host,live,'admin@example.com')),false);
 assert.equal(mode.isCoasterSandbox(ctx('westtechha.com',sandbox,'admin@example.com')),false);
 assert.equal(stageMode(ctx(host,sandbox,'admin@example.com')),'unavailable');
});
test('Dev Admin guard documents cryptographic middleware verification',()=>{
 assert.match(guards,/westtechVerifiedAdmin/);
 assert.match(guards,/DEV_ADMIN_HOST='dev\.westtechha\.com'/);
 assert.match(guards,/Cloudflare Access JWT/);
 assert.match(guards,/assertSafePreviewPayment/);
});
test('customer payment endpoint is account-owned, one shared PayPal order, and same-origin JSON only',()=>{
 for(const s of ['requireCustomerSession(context)','customer_account_orders','getCoasterOrderDetail','ensureCoasterPayPalOrder(context.env,order.orderId','captureCoasterPayPalOrderForCustomer','Invalid request origin.','JSON request required.'])assert.ok(backend.includes(s),s);
 assert.match(backend,/const mode=requireMode\(context\)/);
 assert.doesNotMatch(backend,/\bpaypalCall\(|\/capture['"`]/);
});
test('approval URL and checkout mode are locked to provider environment',()=>{
 assert.match(backend,/mode==='sandbox'\?\['www\.sandbox\.paypal\.com','sandbox\.paypal\.com'\]/);
 assert.match(backend,/mode==='live'\?\['www\.paypal\.com','paypal\.com'\]/);
 assert.match(backend,/u\.protocol==='https:'/);
 assert.match(backend,/paypalApprovalUrl\(saved\?\.paypalApprovalUrl,mode\)/);
 const begin=backend.indexOf('function paypalApprovalUrl('),end=backend.indexOf('function requireMode(',begin);
 assert.ok(begin>=0&&end>begin);
 const fn=new Function(backend.slice(begin,end)+';return paypalApprovalUrl;')();
 assert.ok(fn('https://www.paypal.com/checkoutnow?token=X','live'));
 assert.equal(fn('https://www.sandbox.paypal.com/checkoutnow?token=X','live'),null);
 assert.equal(fn('https://www.paypal.com/checkoutnow?token=X','sandbox'),null);
 assert.equal(fn('https://www.paypal.com.evil.test/checkoutnow','live'),null);
 assert.equal(fn('http://www.paypal.com/checkoutnow','live'),null);
});
test('live checkout response is not mislabeled Sandbox, but Preview remains test-only',()=>{
 assert.match(backend,/return respond\(\{ok:true,approvalUrl:url,mode\}\)/);
 assert.match(backend,/\['sandbox','live'\]\.includes\(mode\)/);
 assert.match(browser,/testing\?'PayPal Sandbox — Test Checkout':'PayPal — Secure Checkout'/);
 assert.match(browser,/sandboxMode==='sandbox'\?/);
 assert.match(browser,/data\.mode!==sandboxMode/);
});
test('live portal uses live PayPal URL allowlist, sandbox portal uses sandbox allowlist',()=>{
 assert.match(browser,/\['sandbox\.paypal\.com','www\.sandbox\.paypal\.com'\]/);
 assert.match(browser,/\['paypal\.com','www\.paypal\.com'\]/);
 assert.match(browser,/Unexpected PayPal checkout destination/);
 assert.match(html,/id="co-paypal-heading"/);
 assert.match(html,/id="co-paypal-explainer"/);
 assert.match(html,/customer-order\.js\?v=20261024-stage5l1/);
});
test('Venmo selects the matching live or Sandbox SDK without replacing legacy PayPal',()=>{
 assert.match(sdk,/allowedHosts\.has\(location\.hostname\.toLowerCase\(\)\)/);
 assert.match(sdk,/www\.paypal\.com\/web-sdk\/v6\/core/);
 assert.match(sdk,/www\.sandbox\.paypal\.com\/web-sdk\/v6\/core/);
 assert.match(sdk,/\['sandbox','live'\]\.includes\(data.mode\)/);
 assert.doesNotMatch(backend,/startVenmo|captureVenmo/);
});
test('Stage 5L1 does not alter legacy proof-approval PayPal capture',()=>{
 assert.match(backend,/ensureCoasterPayPalOrder/);
 assert.match(backend,/captureCoasterPayPalOrderForCustomer/);
 assert.match(backend,/if\(!order\.paymentRequired\|\|!order\.paypalOrderId\)/);
 assert.match(backend,/paypalOrderId!==order\.paypalOrderId/);
});
