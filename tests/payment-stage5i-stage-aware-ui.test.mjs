import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(p,'utf8');
const js=read('js/customer-order.js');
const html=read('account/order.html');
const css=read('css/customer-order.css');
const pay=read('js/customer-payment-methods.js');
const classifyCode=js.slice(js.indexOf(' function isFocusedCheckout('),js.indexOf(' // Stage-specific workspace uses the same step() mapping'));
const checkout=new Function(classifyCode+'\nreturn isFocusedCheckout;')();
const order=(status,paymentStatus='NOT_REQUESTED',extra={})=>({sourceType:'COASTER',status,paymentStatus,paymentRequired:true,paymentSimulated:false,...extra});

test('approved, unpaid payment-required coasters receive focused checkout',()=>{
 for(const status of ['PROOF_APPROVED','AWAITING_PAYMENT','PAYMENT_PENDING','APPROVED']){
  assert.equal(checkout(order(status)),true,`checkout for ${status}`);
 }
});
test('paid, captured, no-charge, and simulated orders return to existing dashboard',()=>{
 for(const p of ['PAID','CAPTURED','COMPLETED','NOT_REQUIRED']){
  assert.equal(checkout(order('AWAITING_PAYMENT',p)),false,`dashboard for ${p}`);
 }
 assert.equal(checkout(order('PROOF_APPROVED','NOT_REQUESTED',{paymentSimulated:true})),false);
 assert.equal(checkout(order('PROOF_APPROVED','NOT_REQUESTED',{paymentRequired:false})),false);
});
test('review, production, shipping and completed orders keep dashboard',()=>{
 for(const s of ['DESIGN_REVIEW','PROOF_SENT','CHANGES_REQUESTED','PRODUCTION_QUEUE','IN_PRODUCTION','PREPARING_TO_SHIP','SHIPPED','READY_FOR_PICKUP','COMPLETED','ARCHIVED']){
  assert.equal(checkout(order(s)),false,`dashboard for ${s}`);
 }
 assert.equal(checkout(order('PROOF_APPROVED','NOT_REQUESTED',{sourceType:'CUSTOM'})),false);
});
test('only checkout hides dashboard panels and timeline, with preserved DOM for paid states',()=>{
 assert.match(css,/\.customer-order-main\.co-checkout-mode #co-content \{display:none!important;\}/);
 assert.match(js,/\.classList\.toggle\('co-checkout-mode',checkoutMode\)/);
 assert.match(html,/id="co-content"/);
 assert.match(html,/id="co-timeline"/);
 assert.match(html,/id="co-stage-workspace"/);
 assert.match(js,/content\.hidden=false/);
});
test('checkout displays full approved proof, including PDFs, instead of hidden dashboard artwork',()=>{
 assert.match(js,/const topArtwork=approved&&!p\.proofIsPdf&&!isFocusedCheckout\(order\)/);
 assert.match(js,/const url=proofUrl\(\)\+'\/proof'/);
 assert.match(js,/proofHost\.classList\.toggle\('customer-order-approved-terms'/);
 assert.match(js,/\$\('#co-proof-terms-details'\)\.open=!!p\.canRespond\|\|approved/);
});
test('checkout is equal 50/50 and responsive at smaller widths',()=>{
 assert.match(css,/\.customer-order-main\.co-checkout-mode #co-stage-workspace \{\s*grid-template-columns:minmax\(0,1fr\) minmax\(0,1fr\)/);
 assert.match(css,/@media \(max-width:950px\)[\s\S]*?\.customer-order-main\.co-checkout-mode #co-stage-workspace \{grid-template-columns:minmax\(0,1fr\)/);
});
test('heading and subtotal label are phase aware without changing order totals',()=>{
 assert.match(html,/id="co-page-eyebrow"/);
 assert.match(html,/id="co-page-title"/);
 assert.match(html,/Approved subtotal \(before tax\)/);
 assert.match(js,/checkoutMode\?'WESTTECH CHECKOUT':'WESTTECH CUSTOMER DASHBOARD'/);
 assert.match(js,/checkoutMode\?'Complete your payment\.':'Order details\.'/);
 assert.match(js,/\$text\('#co-stage-amount',money\(order\.total\)\)/);
});
test('paid order dashboard still receives the original artwork, summary and progress',()=>{
 assert.match(js,/renderCoasterDesign\(order\);/);
 assert.match(js,/const paymentRecorded=order\.paymentSimulated===true/);
 assert.match(js,/\$text\('#co-next-title',headline\)/);
 assert.match(js,/timeline\.replaceChildren\(\)/);
 assert.match(js,/renderShipping\(order\)/);
});
test('payment, cancel, capture, address/tax verification and pickup scheduler remain wired unchanged',()=>{
 for(const anchor of ["post('startVenmo'","post('captureVenmo'","post('cancelVenmo'","post('quoteVenmoShipping'"])assert.ok(pay.includes(anchor),anchor);
 assert.match(js,/renderSandboxPayment\(order\);/);
 assert.match(js,/window\.wtPickupPortalInit\(order\)/);
 assert.match(html,/id="co-paypal-sandbox"/);
 assert.match(html,/id="co-payment-methods"/);
 assert.match(html,/id="co-venmo-review"/);
 assert.match(html,/customer-payment-methods\.js\?v=20261023-stage5h1/);
});
test('checkout CSS and JS have their own cache versions, existing payment component does not',()=>{
 assert.match(html,/customer-order\.css\?v=20261023-stage5i1/);
 assert.match(html,/customer-order\.js\?v=20261024-stage5l1/);
 assert.match(html,/customer-payment-methods\.js\?v=20261023-stage5h1/);
});
