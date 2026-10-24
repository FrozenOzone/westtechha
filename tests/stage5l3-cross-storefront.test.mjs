import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const exists=p=>fs.existsSync(path.join(root,p));
function blobSha(p){
 // Git's committed blobs use LF. Windows Git checkouts may contain CRLF.
 // Normalize ONLY line endings; substantive changes still change the hash.
 const raw=fs.readFileSync(path.join(root,p));
 const normalized=Buffer.from(raw.toString('utf8').replace(/\r\n/g,'\n'),'utf8');
 return crypto.createHash('sha1')
  .update(Buffer.from(`blob ${normalized.length}\0`))
  .update(normalized).digest('hex');
}
const critical={
 'functions/_lib/enclosure-paypal.js':'e93ec8f70c9263c918996ce826db7f03581b1efd',
 'functions/_lib/custom-paypal.js':'3f9e214cb46efd4c7f5b3f1985950fc6f5f5966e',
 'functions/_lib/tax.js':'f6dc6652f35b7659dd53ddc6a0c1c14548923ccb',
 'functions/api/coasters/orders/[orderId]/payment/capture/index.js':'fc7dd0bfe24f99b8f93d6d380a8ce67daa727274',
 'functions/api/paypal/config.js':'8b30382b00c701090d1e35766b7325b9f75fe8ec'
};
test('unchanged ESP32, custom, tax and old coaster PayPal adapters match audited Production blobs',()=>{
 for(const [p,sha] of Object.entries(critical))assert.equal(blobSha(p),sha,`${p}: unexpected drift; review live storefront impact`);
});
test('three checkout families retain their original backend payment adapters',()=>{
 for(const p of ['functions/_lib/enclosure-paypal.js','functions/_lib/custom-paypal.js','functions/_lib/coaster-paypal.js']){
  const s=read(p);assert.match(s,/export async function ensure\w*PayPalOrder\(/,p);
  assert.match(s,/PayPal|paypal/);
 }
});
test('existing old proof-token payment callback still uses the same order capture',()=>{
 const s=read('functions/api/coasters/orders/[orderId]/payment/capture/index.js');
 for(const token of ['captureCoasterPayPalOrder','getCoasterApprovalByToken','approvalToken','paypalOrderId','sendCoasterAdminProductionEmail','inviteCustomerForOrder'])assert.ok(s.includes(token),token);
});
test('private portal still requires server-authenticated account ownership for artwork and pickup',()=>{
 for(const p of ['functions/api/customer/orders/[sourceType]/[orderId]/artwork/index.js','functions/api/customer/orders/[sourceType]/[orderId]/pickup/index.js','functions/api/customer/orders/[sourceType]/[orderId]/payment-methods/index.js']){
  const s=read(p);assert.match(s,/requireCustomerSession\(context\)/,p);assert.match(s,/customer_account_orders/,p);
 }
});
test('customer proof decision uses identity and proof-version guards',()=>{
 const p=read('functions/api/customer/orders/[sourceType]/[orderId]/approval/index.js');
 for(const term of ['requireCustomerCoasterProof(context)','proofVersion','Invalid request origin.','JSON request required.','recordCoasterApprovalForCustomer'])assert.ok(p.includes(term),term);
});
test('Venmo uses isolated Preview Sandbox or the verified live Production domain',()=>{
 const p=read('functions/api/customer/orders/[sourceType]/[orderId]/payment-methods/index.js');
 assert.match(p,/coasterCustomerPaymentMode\(context\)/);
 assert.match(p,/if\(!f\.sandbox&&!f\.live\)/);
 assert.match(p,/COASTER_VENMO_SANDBOX_ENABLED/);
 const js=read('js/customer-payment-methods.js');
 assert.match(js,/pickup-stage1-preview\.westtechha\.pages\.dev/);
 assert.match(js,/www\.paypal\.com\/web-sdk\/v6\/core/);
 assert.match(js,/www\.sandbox\.paypal\.com\/web-sdk\/v6\/core/);
});
test('production work order UPSERT remains conditional and idempotent',()=>{
 const s=read('functions/_lib/manufacturing-work-orders.js');
 assert.match(s,/\['PAID','NOT_REQUIRED'\]/);assert.match(s,/ON CONFLICT\(source_type,source_order_id\) DO UPDATE/);
});
test('paid scheduler does not reassign a previously recorded production slot',()=>{
 const s=read('functions/_lib/production-awareness.js');assert.match(s,/PRODUCTION_SLOT_ASSIGNED/);assert.match(s,/alreadyAssigned:true/);
});
test('Resend customer and admin queue sends retain provider idempotency',()=>{
 for(const p of ['functions/_lib/coaster-email.js','functions/_lib/coaster-admin-production-email.js']){
  const s=read(p);assert.match(s,/Idempotency-Key/);assert.match(s,/EMAIL_SENT/);assert.match(s,/EMAIL_FAILED/);
 }
});
test('coaster builder and ESP32 ordering client paths remain present',()=>{
 for(const p of ['js/enclosure-order.js','js/sports-order-checkout.js','coasters/sports-order.html','enclosures/order-request.html'])assert.ok(exists(p),p);
 assert.match(read('js/sports-order-checkout.js'),/\/api\/coasters\/orders/);
});
test('portal includes proof, artwork, customer payment and pickup components',()=>{
 const p=read('account/order.html');for(const token of ['id="co-paypal-sandbox"','id="co-payment-methods"','customer-order.js','customer-payment-methods.js','coaster-pickup-customer.js'])assert.ok(p.includes(token),token);
});
test('protected Admin, private scripts, and public Preview API restrictions remain',()=>{
 const m=read('functions/_middleware.js');for(const token of ['validatedDevAdminEmail','westtechVerifiedAdmin','isInternalSourcePath','/scripts','isAdminPath','Unauthorized'])assert.ok(m.includes(token),token);
 const a=read('functions/_lib/admin-auth.js');assert.match(a,/host==='dev\.westtechha\.com'/);assert.match(a,/westtechVerifiedAdmin/);
});
test('release migration rehearsal covers preserved Production order data',()=>{
 const m=read('scripts/release-5l2/stage5l2-migration-rehearsal.py');assert.match(m,/sqlite3\.connect\(':memory:'\)/);
 const runbook=read('scripts/release-5l2/Stage5L2-Production-Release-Runbook.md');assert.match(runbook,/No Production promotion until ALL/);
});
test('new Stage 5L3 kit has no provider charges or Production database writes',()=>{
 const runbook=read('scripts/release-5l3/Stage5L3-Regression-Runbook.md');
 const smoke=read('scripts/release-5l3/stage5l3-readonly-smoke.mjs');
 assert.match(runbook,/NO PRODUCTION WRITES/);assert.match(runbook,/browser|manual/i);
 assert.doesNotMatch(smoke,/method\s*:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/i);
 assert.doesNotMatch(smoke,/wrangler|\/capture|\/refund/i);
});
