import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const js=readFileSync('js/customer-payment-methods.js','utf8');
const html=readFileSync('account/order.html','utf8');

test('summary displays four rows with a separate emphasized total',()=>{
 for(const [id,label] of [
   ['co-venmo-items-amount','Coaster items'],['co-venmo-shipping-amount','Shipping'],
   ['co-venmo-tax-amount','Sales tax'],['co-venmo-total','Total due now']]){
    assert.equal(html.match(new RegExp(`id="${id}"`,'g'))?.length,1,`single ${id}`);
    assert.ok(html.includes(label));
 }
 assert.match(html,/id="co-venmo-review" class="co-venmo-review"[^>]*hidden/);
 assert.match(html,/class="co-venmo-price-row co-venmo-due"/);
 assert.doesNotMatch(html,/id="co-venmo-total"[^>]*style="display:block;margin-bottom:9px/);
});

test('normal checkbox is labeled and included with the summary and button',()=>{
 assert.equal((html.match(/id="co-venmo-tax-confirm"/g)||[]).length,1);
 assert.match(html,/for="co-venmo-tax-confirm"/);
 assert.match(html,/I confirm the delivery address, sales tax, and final total\./);
 assert.match(html,/#co-payment-methods #co-venmo-tax-confirm\s*\{/);
 assert.match(html,/width: 18px !important/);
 assert.match(html,/height: 18px !important/);
 assert.match(html,/flex: 0 0 18px !important/);
 assert.match(html,/\.co-venmo-confirm-row:focus-within/);
 const row=html.indexOf('co-venmo-due'),box=html.indexOf('id="co-venmo-tax-confirm"'),pay=html.indexOf('id="co-venmo-button"');
 assert.ok(row<box && box<pay);
});

test('showQuote formats the correct item, shipping, tax and total for shipping and pickup',()=>{
 const a=js.indexOf(' function showQuote(q){'),b=js.indexOf(' async function checkoutReady(',a);
 assert.ok(a>=0&&b>a,'showQuote can be inspected');
 const code=js.slice(a,b);
 for(const ship of [true,false]){
  const els=Array.from({length:6},()=>({textContent:''}));
  const [items,shipping,tax,total,review,summary]=els;
  review.hidden=true;
  const make=new Function('itemsEl','shippingAmountEl','taxAmountEl','quoteEl','review','shippingMode','shippingSummary',`let quote=null;${code}\nreturn {showQuote,getQuote:()=>quote};`);
  const scope=make(items,shipping,tax,total,review,ship,summary);
  const q={itemAmount:'29.99',shippingAmount:ship?'8.95':'0.00',taxAmount:'2.92',totalAmount:ship?'41.86':'32.91',address:{fullName:'Test Person',address1:'123 Main St',address2:'',city:'Denver',state:'CO',postalCode:'80202'}};
  scope.showQuote(q);
  assert.equal(items.textContent,'$29.99');assert.equal(shipping.textContent,ship?'$8.95':'$0.00');
  assert.equal(tax.textContent,'$2.92');assert.equal(total.textContent,ship?'$41.86':'$32.91');
  assert.equal(review.hidden,false);assert.equal(scope.getQuote(),q);
  if(ship)assert.match(summary.textContent,/Deliver to: Test Person/);
 }
});

test('address changes hide stale review while clearing confirmation and payment session',()=>{
 assert.match(js,/shippingFields\.forEach\(field=>field\.addEventListener\('input',\(\)=>\{/);
 assert.match(js,/quote=null;confirmedAddress=null;session=null;confirm\.checked=false;setEnabled\(false\);/);
 assert.match(js,/review\.hidden=true;quoteEl\.textContent='';shippingSummary\.textContent='Address changed/);
 assert.match(js,/catch\(err\)\{quote=null;confirmedAddress=null;session=null;review\.hidden=true;setEnabled\(false\)/);
 assert.match(js,/confirmedAddress=result\.quote\.address;showQuote\(result\.quote\);confirm\.checked=false;/);
});

test('unchecked click still reports warning; capture and cancellation wiring unchanged',()=>{
 assert.match(js,/if\(!confirm\.checked\)\{status\('Please approve the tax and total before starting Venmo\.',true\);return;\}/);
 assert.match(js,/post\('startVenmo',\{confirmedTotal:true,expectedTotal:String\(quote\.totalAmount\),/);
 assert.match(js,/shippingMode\?\{shippingAddress:confirmedAddress\}:\{\}/);
 assert.match(js,/onCancel:async\(\)=>\{/);
 assert.match(js,/onApprove:async \(\{orderId:paypalOrderId\}\)=>\{/);
 assert.match(js,/host='pickup-stage1-preview\.westtechha\.pages\.dev'/);
});

test('HTML loads updated JS and legacy regression expectations match',()=>{
 assert.match(html,/customer-payment-methods\.js\?v=20261023-stage5h1/);
 for(const p of ['tests/payment-stage5e-cancel-labels.test.mjs','tests/payment-stage5g-shipping.test.mjs']){
  const t=readFileSync(p,'utf8');
  assert.match(t,/customer-payment-methods\\\.js\\\?v=20261023-stage5h1/);
 }
});
