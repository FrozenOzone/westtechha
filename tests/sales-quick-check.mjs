import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {execFileSync} from 'node:child_process';
const root=process.cwd(),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const ledger=read('functions/_lib/sales-invoices.js'),payment=read('functions/_lib/sales-payment.js'),admin=read('js/sales-admin.js'),buyer=read('js/sales-pay.js');
for(const f of ['js/sales-admin.js','js/sales-pay.js','functions/_lib/sales-invoices.js','functions/_lib/sales-payment.js','functions/api/admin/sales/index.js','functions/api/admin/sales/[id]/index.js','functions/api/sales/checkout/index.js'])execFileSync('node',['--check',f]);
assert.match(ledger,/if\(String\(expectedTotal\)!==dollar\(sale.totalCents\)\)/,'recheck expected totals');
assert.match(ledger,/buildTaxQuote\(env,address/,'server-side tax');
assert.match(ledger,/price>original/,'price override cannot inflate regular');
assert.match(ledger,/sales_invoice_events/,'history');
assert.match(payment,/attempt\.method==='VENMO'&&!details\.payment_source\?\.venmo/,'must verify instrument');
assert.match(payment,/UPDATE sales_invoices SET status='CAPTURING'/,'must lock before capture');
assert.match(payment,/Do not pay again/,'capture errors safe');
assert.match(payment,/getRandomValues|crypto\.randomUUID/,'non-predictable attempt IDs');
assert.match(read('functions/api/admin/sales/index.js'),/requireWestTechAdmin/);
assert.match(read('functions/api/admin/sales/\[id\]/index.js'),/requireWestTechAdmin/);
assert.match(read('functions/api/sales/checkout/index.js'),/Invalid origin/);
assert.match(buyer,/location\.hash\.slice\(1\)/,'token remains in location fragment');
assert.doesNotMatch(buyer,/paypal\.clientSecret/,'must not ship secret');
assert.match(admin,/check-cleared/);assert.match(admin,/Record Cash/);assert.match(admin,/Record Check/);
assert.match(read('migrations/024_sales_invoices.sql'),/CREATE TABLE IF NOT EXISTS sales_invoice_events/);
// Exercise the actual pricing function with a deterministic stub for external Colorado GIS.
const moduleText=ledger.replace(/^import .*;\s*$/gm,'').replace(/\bexport (?=(?:const|function|async))/g,'');
const factory=new Function('requireOrdersDb','buildTaxQuote','validateShippingAddress','generateAccessToken','paypalBaseUrl','readJsonSafe','sanitizeEnvValue',moduleText+'\nreturn {prepareSale,orderPayload};');
const {prepareSale,orderPayload}=factory(()=>{throw Error('No DB in math checks');},async(_env,address,options)=>{
 const tax=Number((options.taxableAmount*0.075).toFixed(2));return {taxRate:0.075,taxAmount:tax.toFixed(2),totalAmount:(options.itemAmount+options.shippingAmount+tax).toFixed(2),source:'stub-GIS',jurisdictionCode:'CO-TEST',salesTax:[]};
},addr=>({fullName:addr.fullName,address1:addr.address1,city:addr.city,state:addr.state,postalCode:addr.postalCode,countryCode:'US'}),()=>{},()=>'',()=>{},v=>String(v||'').trim());
const base={saleType:'INVOICE',customerName:'Test Neighbor',customerEmail:'neighbor@example.com',locationLabel:'Neighbor pickup',address:{fullName:'Test Neighbor',address1:'1 Test Ave',city:'Commerce City',state:'CO',postalCode:'80640'},items:[{description:'4 coaster set',quantity:'1',regularPrice:'29.99',unitPrice:'1.00'}],shipping:'0.00',discountReason:'Neighbor Venmo test'};
const sale=await prepareSale({},base);assert.equal(sale.regularCents,2999);assert.equal(sale.subtotalCents,100);assert.equal(sale.discountCents,2899);assert.equal(sale.taxCents,7);assert.equal(sale.totalCents,107);
await assert.rejects(prepareSale({}, {...base,discountReason:''}),/reason/);
await assert.rejects(prepareSale({}, {...base,items:[{...base.items[0],unitPrice:'29.999'}]}),/Amounts/);
await assert.rejects(prepareSale({}, {...base,items:[{...base.items[0],unitPrice:'30.00'}]}),/regular price/);
await assert.rejects(prepareSale({}, {...base,address:{...base.address,state:'CA'}}),/outside Colorado/);
const exempt=await prepareSale({}, {...base,taxExempt:true,exemptReason:'Verified certificate'});assert.equal(exempt.taxCents,0);
const comp=await prepareSale({}, {...base,items:[{...base.items[0],unitPrice:'0.00'}]});assert.equal(comp.totalCents,0);
const payload=orderPayload({invoice_number:'WTI-000001',subtotal_cents:100,shipping_cents:0,tax_cents:8,total_cents:108},'VENMO','abcd1234');assert.equal(payload.purchase_units[0].amount.value,'1.08');
console.log('PASS: JS syntax, price override and reason, server tax math, exemptions and complimentary sales, payment locks, origin auth, PayPal amount consistency.');

// Sales v2: optional customer details, safe default tax-location and four requested UI changes.
const blank={...base,saleType:'INVOICE',customerName:'',customerPhone:'',customerEmail:'',locationLabel:'',address:{}};
const walkin=await prepareSale({},blank);
assert.equal(walkin.customerName,'');assert.equal(walkin.customerEmail,'');assert.equal(walkin.customerPhone,'');
assert.equal(walkin.locationLabel,'WestTech / Walk-in');
assert.equal(walkin.addressSource,'WESTTECH_PICKUP');
assert.equal(walkin.address.address1,'11300 Emporia St');
assert.equal(walkin.address.postalCode,'80640');
assert.equal(walkin.totalCents,107);
const contact=await prepareSale({},{...blank,customerName:'Neighbor',customerPhone:'720-555-0100',customerEmail:'neighbor@example.com'});
assert.equal(contact.customerPhone,'720-555-0100');
await assert.rejects(prepareSale({},{...blank,address:{state:'CO',postalCode:'80640'}}),/complete Colorado event\/delivery address/);
const html=read('admin/sales.html');
for(const id of ['ws-open','ws-share','ws-email-me','ws-qr','ws-link'])assert.ok(html.includes('id="'+id+'"'),id);
assert.ok(html.includes('name="customerPhone"'));
assert.doesNotMatch(html,/name="(?:address1|city|postalCode)"[^>]*\srequired/);
assert.match(admin,/ESP32 Enclosures/);assert.match(admin,/4-Coaster Set/);assert.match(admin,/8-Coaster Set/);
assert.match(admin,/navigator\.share/);assert.match(admin,/action:'email-owner'/);
assert.match(ledger,/customer_phone/);assert.match(ledger,/WESTTECH_PICKUP/);
const protectedApi=read('functions/api/admin/sales/[id]/index.js');
assert.match(protectedApi,/requireWestTechAdmin\(ctx\)/);assert.match(protectedApi,/emailSaleLinkToOwner\(ctx,id\)/);
assert.match(read('migrations/025_sales_optional_contact.sql'),/ALTER TABLE sales_invoices ADD COLUMN customer_phone/);
console.log('PASS v2: optional contacts, pickup default, precise event address rule, catalog selection, mobile link sharing, protected owner email, phone migration.');


// Recovery regression: only a stale, unapproved and uncaptured provider order
// can be released or voided; capture-stage and mismatched orders remain blocked.
const recoverySource=payment.replace(/^import .*;\s*$/gm,'').replace(/\bexport (?=(?:const|function|async))/g,'');
const recoveryFactory=new Function('requireOrdersDb','byToken','getInvoice','saleError','salesMode','summary','event','paypalRequest','orderPayload',recoverySource+'\nreturn {assessAbandonedSale,reviewAbandonedPayment};');
const {assessAbandonedSale}=recoveryFactory(()=>{},()=>{},()=>{},()=>{},()=>{},()=>{},()=>{},()=>{},()=>{});
const pendingInvoice={id:3,invoice_number:'WTI-000003',status:'PAYMENT_PENDING',total_cents:1645,paypal_capture_id:null,paypal_order_id:null,paid_at:null};
const createdAttempt={attempt_id:'uuid',method:'VENMO',status:'CREATED',provider_order_id:'12345ABCDE678901',created_at:'2026-11-01 22:06:06'};
const providerOrder={id:createdAttempt.provider_order_id,intent:'CAPTURE',status:'CREATED',purchase_units:[{custom_id:'WTI-000003',amount:{currency_code:'USD',value:'16.45'}}]};
const checkTime=Date.parse('2026-11-03T16:00:00Z');
const assessment=(r=pendingInvoice,a=createdAttempt,p=providerOrder)=>assessAbandonedSale(r,a,p,checkTime);
assert.equal(assessment().canRelease,true,'stale, matched unapproved order is releaseable');
for(const st of ['APPROVED','COMPLETED','PAYER_ACTION_REQUIRED','SAVED'])
 assert.equal(assessment(pendingInvoice,createdAttempt,{...providerOrder,status:st}).canRelease,false,'block provider '+st);
assert.equal(assessment(pendingInvoice,createdAttempt,{...providerOrder,purchase_units:[{...providerOrder.purchase_units[0],payments:{captures:[{id:'CAPTURE'}]}}]}).canRelease,false);
assert.equal(assessment(pendingInvoice,createdAttempt,{...providerOrder,purchase_units:[{...providerOrder.purchase_units[0],payments:{authorizations:[{id:'AUTH'}]}}]}).canRelease,false);
assert.equal(assessment(pendingInvoice,createdAttempt,{...providerOrder,purchase_units:[{...providerOrder.purchase_units[0],amount:{currency_code:'USD',value:'16.46'}}]}).canRelease,false);
assert.equal(assessment({...pendingInvoice,paypal_capture_id:'PAYMENT'},createdAttempt,providerOrder).canRelease,false);
assert.equal(assessment(pendingInvoice,{...createdAttempt,status:'CAPTURING'},providerOrder).canRelease,false);
assert.equal(assessment(pendingInvoice,{...createdAttempt,created_at:'2026-11-03 15:55:00'},providerOrder).canRelease,false);
const recoveryRoute=read('functions/api/admin/sales/[id]/index.js');
assert.match(recoveryRoute,/requireWestTechAdmin\(ctx\)/);
assert.match(recoveryRoute,/review-pending/);assert.match(recoveryRoute,/void-abandoned/);
assert.match(admin,/Review Pending Payment/);assert.match(admin,/Release for New Attempt/);assert.match(admin,/Void Abandoned Invoice/);
assert.match(payment,/paypalRequest\(context\.env,'\/v2\/checkout\/orders\/'/,'provider recheck');
assert.match(payment,/status='CREATED' AND EXISTS/,'capture race claim protection');
console.log('PASS recovery: provider identity and amount, no charge, stale age, race claim, admin access, review/void/retry controls.');


// Missing/expired PayPal Order: 404 is NOT proof of no capture.
// Review never writes; only a human-attested VOID is permitted, not a retry.
assert.match(ledger,/error\.providerHttpStatus=response\.status/,'preserve provider error status');
assert.match(ledger,/error\.providerErrorCode=/,'preserve provider error code');
assert.match(payment,/providerHttpStatus===404&&e\.providerErrorCode==='RESOURCE_NOT_FOUND'/,'classify only explicit order not found');
assert.match(admin,/Void After Manual PayPal Check/);
assert.match(admin,/I_VERIFIED_NO_PAYMENT_IN_PAYPAL_ACTIVITY/);
assert.match(recoveryRoute,/void-provider-missing/);
async function simulateMissingProvider(action,providerErrorCode='RESOURCE_NOT_FOUND',manual=null,failClaim=false){
 let row={...pendingInvoice,sent_at:null},attempt={...createdAttempt},writes=0,events=0,providerReads=0;
 const db={prepare(sql){return {bind(...params){return {
  async all(){assert.match(sql,/sales_payment_attempts/);return {results:[attempt]};},
  async run(){writes++;if(sql.startsWith("UPDATE sales_payment_attempts")){if(failClaim)return {meta:{changes:0}};attempt.status='CANCELED';return {meta:{changes:1}};}
   if(sql.startsWith("UPDATE sales_invoices")){row.status=sql.includes("status='VOID'")?'VOID':'DRAFT';return {meta:{changes:1}};}
   throw Error('Unexpected D1 write: '+sql);}
 };}};}};
 const missing=Object.assign(new Error('Resource not found'),{
  providerHttpStatus:404,providerErrorCode,providerIssue:'INVALID_RESOURCE_ID'
 });
 const {reviewAbandonedPayment}=recoveryFactory(
  ()=>db,()=>{},async()=>row,(m,status)=>Object.assign(new Error(m),{status}),
  ()=>{},x=>x,async()=>{events++;},async()=>{providerReads++;throw missing;},()=>{}
 );
 let result,error;try{result=await reviewAbandonedPayment({env:{}},3,action!=='review',action!=='retry',manual);}
 catch(e){error=e.message;}
 return {result,error,row,writes,events,providerReads};
}
const attested={invoiceNumber:'WTI-000003',attestation:'I_VERIFIED_NO_PAYMENT_IN_PAYPAL_ACTIVITY'};
const missingReview=await simulateMissingProvider('review');
assert.equal(missingReview.result.review.requiresManualReconciliation,true);
assert.equal(missingReview.row.status,'PAYMENT_PENDING');assert.equal(missingReview.writes,0);
const missingRetry=await simulateMissingProvider('retry','RESOURCE_NOT_FOUND',attested);
assert.match(missingRetry.error,/Reopening is not allowed/);assert.equal(missingRetry.writes,0);
const missingBlindVoid=await simulateMissingProvider('void');
assert.match(missingBlindVoid.error,/Manual closeout requires/);assert.equal(missingBlindVoid.writes,0);
const missingWrongInvoice=await simulateMissingProvider('void','RESOURCE_NOT_FOUND',{...attested,invoiceNumber:'WTI-000004'});
assert.match(missingWrongInvoice.error,/Manual closeout requires/);assert.equal(missingWrongInvoice.writes,0);
const missingManualVoid=await simulateMissingProvider('void','RESOURCE_NOT_FOUND',attested);
assert.equal(missingManualVoid.row.status,'VOID');assert.equal(missingManualVoid.result.voided,true);
assert.equal(missingManualVoid.writes,2);assert.equal(missingManualVoid.events,1);
const missingWrongProviderError=await simulateMissingProvider('void','INTERNAL_SERVER_ERROR',attested);
assert.match(missingWrongProviderError.error,/Resource not found/);assert.equal(missingWrongProviderError.writes,0);
const missingClaimRace=await simulateMissingProvider('void','RESOURCE_NOT_FOUND',attested,true);
assert.match(missingClaimRace.error,/Checkout changed during review/);
assert.equal(missingClaimRace.row.status,'PAYMENT_PENDING');
console.log('PASS missing-order manual recovery: explicit 404, read-only review, no retry, typed attestation, audit, provider errors and claim race.');


// Apple/Google Pay Dev staging: strict live gate, isolated SDK, and source verification.
const walletClient=read('js/sales-wallets.js'),checkoutPage=read('pay/sale.html');
execFileSync('node',['--check','js/sales-wallets.js']);
assert.match(payment,/SALES_WALLETS_LIVE_ENABLED/);
assert.match(payment,/mode==='sandbox'/);
assert.match(payment,/method==='APPLE_PAY'&&!details\.payment_source\?\.apple_pay/);
assert.match(payment,/method==='GOOGLE_PAY'&&!details\.payment_source\?\.google_pay/);
assert.match(payment,/['"]APPLE_PAY['"],['"]GOOGLE_PAY['"]/);
assert.match(payment,/walletsEnabled:salesWalletsEnabled\(context\)/);
assert.match(ledger,/payment_source:\{google_pay:\{attributes:\{verification:\{method:'SCA_WHEN_REQUIRED'/);
assert.match(read('js/sales-pay.js'),/configure\('PAYPAL',eligibility\.isEligible\('paypal'\)\);configure\('VENMO',eligibility\.isEligible\('venmo'\)\)/,'preserve live legacy buttons');
assert.match(read('js/sales-pay.js'),/window\.WestTechSalesWallets\.init/);
assert.match(walletClient,/googleSession\.confirmOrder/);
assert.match(walletClient,/confirmed\?\.status!=='APPROVED'/,'no Google Pay capture before authorization');
assert.match(walletClient,/apple\.validateMerchant/);
assert.match(walletClient,/apple\.confirmOrder/);
assert.match(walletClient,/window\.ApplePaySession/);
assert.match(walletClient,/if\(!isConfirmed\(\)\)/,'both wallets require customer amount acknowledgment');
assert.match(checkoutPage,/id="wp-wallets" hidden/);
assert.match(checkoutPage,/js\/sales-wallets\.js/);
assert.match(checkoutPage,/id="wp-apple-pay" hidden/);
assert.match(checkoutPage,/id="wp-google-pay" hidden/);
const walletSource=payment.replace(/^import .*;\s*$/gm,'').replace(/\bexport (?=(?:const|function|async))/g,'');
const walletFactory=new Function('requireOrdersDb','byToken','getInvoice','saleError','salesMode','summary','event','paypalRequest','orderPayload',walletSource+'\nreturn {salesWalletsEnabled,beginPayment};');
let testingMode='sandbox',dbTouched=false;
const {salesWalletsEnabled,beginPayment:walletBegin}=walletFactory(
 ()=>{dbTouched=true;throw Error('DB should not be reached for blocked wallet');},
 ()=>{},()=>{},(message,status)=>Object.assign(new Error(message),{status}),
 ()=>testingMode,()=>{},()=>{},()=>{},()=>{}
);
const walletContext=(flag)=>({env:{SALES_WALLETS_LIVE_ENABLED:flag}});
testingMode='sandbox';assert.equal(salesWalletsEnabled(walletContext(undefined)),true);
testingMode='live';assert.equal(salesWalletsEnabled(walletContext(undefined)),false);
assert.equal(salesWalletsEnabled(walletContext('0')),false);
assert.equal(salesWalletsEnabled(walletContext('1')),true);
testingMode='blocked';assert.equal(salesWalletsEnabled(walletContext('1')),false);
testingMode='live';dbTouched=false;
await assert.rejects(walletBegin(walletContext('0'),'bogus','APPLE_PAY'),/Wallet payments are not enabled/);
await assert.rejects(walletBegin(walletContext('0'),'bogus','GOOGLE_PAY'),/Wallet payments are not enabled/);
assert.equal(dbTouched,false);
const walletPayload=orderPayload({invoice_number:'WTI-000003',subtotal_cents:1499,shipping_cents:0,tax_cents:146,total_cents:1645},'GOOGLE_PAY','wallet-123');
assert.equal(walletPayload.payment_source.google_pay.attributes.verification.method,'SCA_WHEN_REQUIRED');
assert.equal(walletPayload.purchase_units[0].amount.value,'16.45');
const paypalLegacyPayload=orderPayload({invoice_number:'WTI-000003',subtotal_cents:1499,shipping_cents:0,tax_cents:146,total_cents:1645},'PAYPAL','wallet-123');
assert.equal(paypalLegacyPayload.payment_source,undefined,'legacy checkout order untouched');
assert.match(walletClient,/then\(finish3DS\)/,'launch 3DS only after Google payment sheet closes');
assert.match(walletClient,/initiatePayerAction\(\{orderId\}\)/,'PayPal 3DS payer action is used');
assert.match(walletClient,/googleAwaiting3DS=orderId/,'store original PayPal order ID for 3DS');
assert.match(walletClient,/\['NO','UNKNOWN'\]\.includes\(outcome\?\.liabilityShift\)/,'block unauthenticated bank outcomes');
assert.match(checkoutPage,/sales-wallets\.js\?v=20261103-wallets-3ds-dev2/,'browser must fetch updated 3DS code');
console.log('PASS wallet 3DS: Google sheet closes before bank authentication; only verified original order can be captured.');
console.log('PASS wallet staging: syntax, SDK component isolation, eligibility guards, original price/locks, live enable flag, funding verification and Google SCA.');


// Regression: customer payment QR/email/share links must use branded Dev, not raw pages.dev.
const publicLinkSource=ledger.match(/export function invoicePublicLink\(context,row\)\{[^\n]+\}/)?.[0];
assert.ok(publicLinkSource,'invoicePublicLink function exists');
const makePublicLink=new Function(publicLinkSource.replace('export function','function')+'\nreturn invoicePublicLink;')();
const exampleInvoice={public_token:'TEST_TOKEN_NOT_REAL'};
for(const host of ['dev.westtechha.com','pickup-stage1-preview.westtechha.pages.dev'])
 assert.equal(makePublicLink({request:{url:'https://'+host+'/api/admin/sales/test'}},exampleInvoice),'https://dev.westtechha.com/pay/sale.html#TEST_TOKEN_NOT_REAL');
assert.equal(makePublicLink({request:{url:'https://westtechha.com/api/admin/sales/test'}},exampleInvoice),'https://westtechha.com/pay/sale.html#TEST_TOKEN_NOT_REAL');
console.log('PASS invoice links: custom Dev domain for preview and production host unchanged.');
