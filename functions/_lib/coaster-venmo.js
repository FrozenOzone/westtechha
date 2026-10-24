/* Sandbox-only Venmo adapter: local pickup + gated shipping. Existing PayPal checkout unchanged. */
import { generateAccessToken, paypalBaseUrl } from './paypal.js';
import { getCoasterOrderDetail } from './coaster-orders.js';
import { buildTaxQuote, validateShippingAddress } from './tax.js';
import { requireOrdersDb } from './orders.js';
import { readJsonSafe, sanitizeEnvValue } from './shared.js';
import { markCaptured } from './coaster-paypal.js';

const PICKUP_ADDRESS = {
  fullName: 'WestTech Home Automation, LLC', address1: '11300 Emporia St',
  city: 'Henderson', state: 'CO', postalCode: '80640', countryCode: 'US'
};
const money = value => Number(Number(value).toFixed(2));
const fail = (message, status = 409) => Object.assign(new Error(message), { status });
const validMoney = value => typeof value === 'string' && /^\d{1,7}\.\d{2}$/.test(value);
function requireOrder(order) {
  if (!order || !/^WTCC-\d{8}-\d{1,6}$/.test(String(order.orderId || ''))) throw fail('Order not found.', 404);
  if (order.paymentRequired !== true || order.proofStatus !== 'APPROVED' ||
    !['PROOF_APPROVED', 'AWAITING_PAYMENT'].includes(String(order.status || '').toUpperCase()) ||
    ['PAID','CAPTURING_VENMO','CAPTURING_PAYPAL','CREATING_PAYPAL_ORDER'].includes(String(order.paymentStatus || '').toUpperCase())) throw fail('Payment is not available for this order.');
  if (order.fulfillmentMethod !== 'LOCAL_PICKUP' && order.fulfillmentMethod !== 'SHIP') throw fail('Unsupported Venmo fulfillment method.');
  if (!String(order.productionWindow || '').trim()) throw fail('Production window is not set.');
  if (!(Number(order.finalAmount) > 0)) throw fail('Approved amount is invalid.');
}
async function quoteFor(env, order, shippingAddress=null) {
  requireOrder(order);
  const ship=order.fulfillmentMethod==='SHIP';
  if(ship && (!shippingAddress || typeof shippingAddress!=='object' || Array.isArray(shippingAddress)))
    throw fail('Enter and confirm a shipping address before starting Venmo.',400);
  const address=ship?validateShippingAddress(shippingAddress):PICKUP_ADDRESS;
  if(ship && (!String(address.fullName||'').trim() || String(address.fullName).length>200))
    throw fail('Enter a shipping recipient name.',400);
  if(ship){
    for(const [key,max] of [['address1',200],['address2',200],['city',120],['postalCode',15]])
      if(String(address[key]||'').length>max)throw fail('Shipping address field is too long.',400);
    if(!/^\d{5}(?:-\d{4})?$/.test(String(address.postalCode)))
      throw fail('Enter a valid U.S. ZIP code.',400);
  }
  const subtotal=money(Number(order.finalAmount));
  const shippingAmount=ship?money(Number(order.shippingAmount||0)):0;
  if(ship && (!Number.isFinite(Number(order.shippingAmount)) || shippingAmount<0 || shippingAmount>=subtotal))
    throw fail('Approved shipping charge is invalid. Contact WestTech.',409);
  const itemAmount=money(subtotal-shippingAmount);
  const quote=await buildTaxQuote(env,address,{taxableAmount:itemAmount,itemAmount,shippingAmount});
  if(!validMoney(String(quote.totalAmount)))throw fail('Could not verify the final Venmo tax quote.',503);
  if(!ship && !quote.isColorado)throw fail('Could not verify pickup tax quote.',503);
  return quote;
}
export async function getVenmoShippingQuote(env,orderId,shippingAddress) {
  const order=await getCoasterOrderDetail(env,orderId);
  if(order?.fulfillmentMethod!=='SHIP')throw fail('Shipping quote only for shipped orders.',400);
  return quoteFor(env,order,shippingAddress);
}
// No trust in browser addresses at capture: match PayPal's chosen shipping to our locked quote.
function providerShippingMatches(quote, unit) {
  const a=quote?.address,b=unit?.shipping?.address;
  if(!a||!b)return false;
  const norm=s=>String(s??'').trim().toUpperCase().replace(/\s+/g,' ');
  const equal=(left,right)=>norm(left)===norm(right);
  return equal(a.address1,b.address_line_1)&&equal(a.address2,b.address_line_2)&&
    equal(a.city,b.admin_area_2)&&equal(a.state,b.admin_area_1)&&
    equal(a.postalCode,b.postal_code)&&equal(a.countryCode,b.country_code)&&
    equal(a.fullName,unit?.shipping?.name?.full_name);
}
export async function getVenmoPickupQuote(env, orderId) {
  const order = await getCoasterOrderDetail(env, orderId);
  return quoteFor(env, order);
}
async function api(env, url, opts = {}) {
  const token = await generateAccessToken(env);
  const r = await fetch(`${paypalBaseUrl(env.PAYPAL_ENV)}${url}`, {
    method: opts.method || 'GET',
    headers: {Authorization: `Bearer ${token}`, Accept: 'application/json',
      ...(opts.body ? {'Content-Type': 'application/json'} : {}),
      ...(opts.requestId ? {'PayPal-Request-Id': opts.requestId} : {})},
    body: opts.body ? JSON.stringify(opts.body) : undefined
  });
  const data = await readJsonSafe(r);
  if (!r.ok) throw fail(data?.details?.[0]?.description || data?.message || `PayPal failed (${r.status}).`, r.status >= 500 ? 502 : 409);
  return data;
}
// D1 serializes each INSERT statement. This reservation is the authoritative
// cross-tab/cross-worker checkout-creation lock (not a browser-only guard).
// No schema change: payment attempts already allow interim status values.
const ACTIVE_VENMO_STATES = "('CREATING','CREATED','CAPTURING')";
async function activeVenmoCheckout(db, orderId) {
  return db.prepare("SELECT * FROM coaster_payment_attempts WHERE coaster_order_id=? AND method='VENMO' AND status IN " + ACTIVE_VENMO_STATES + " ORDER BY created_at DESC LIMIT 1")
    .bind(orderId).first();
}
function sameVenmoQuote(attempt, fresh) {
  if (String(attempt?.amount) !== String(fresh.totalAmount)) return false;
  let prior;
  try { prior=JSON.parse(attempt.quote_json); } catch { return false; }
  return ['itemAmount','taxAmount','totalAmount','taxRate','jurisdictionCode','source']
    .every(key=>String(prior?.[key]??'')===String(fresh[key]??'')) &&
    JSON.stringify(prior?.address??null)===JSON.stringify(fresh.address??null);
}
async function reuseVenmoCheckout(env,db,orderId,quote,attempt) {
  if(attempt.status==='CREATING')throw fail('Venmo checkout is being prepared. Please wait a moment before trying again.',409);
  if(attempt.status==='CAPTURING')throw fail('A Venmo payment is being captured. Do not submit another payment.',409);
  if(attempt.status!=='CREATED')return null;
  if(!sameVenmoQuote(attempt,quote))throw fail('The pending Venmo checkout has different tax or order terms. Contact WestTech before retrying.',409);
  // Never silently reuse an already-authorized or completed provider order.
  const details=await api(env,`/v2/checkout/orders/${encodeURIComponent(attempt.provider_order_id)}`);
  const unit=details?.purchase_units?.[0];
  if(unit?.custom_id!==orderId || unit?.amount?.currency_code!=='USD' ||
     String(unit?.amount?.value)!==String(quote.totalAmount))
    throw fail('The pending Venmo transaction does not match this order. Contact WestTech.',409);
  const state=String(details?.status||'').toUpperCase();
  if(state==='VOIDED') {
    await db.prepare("UPDATE coaster_payment_attempts SET status='VOIDED',updated_at=CURRENT_TIMESTAMP WHERE attempt_id=? AND status='CREATED'")
      .bind(attempt.attempt_id).run();
    return null;
  }
  if(!['CREATED','PAYER_ACTION_REQUIRED'].includes(state))
    throw fail('A previous Venmo authorization may exist. Contact WestTech to verify it before retrying.',409);
  // After the standard provider window, retire only a still-unapproved checkout.
  // PayPal's default redirect limit is 6 hours; allow a buffer for clock skew.
  const createdUtc=Date.parse(String(attempt.created_at||'').replace(' ','T')+'Z');
  if(Number.isFinite(createdUtc) && Date.now()-createdUtc>7*60*60*1000) {
    await db.prepare("UPDATE coaster_payment_attempts SET status='EXPIRED',updated_at=CURRENT_TIMESTAMP WHERE attempt_id=? AND status='CREATED'")
      .bind(attempt.attempt_id).run();
    return null;
  }
  // Recheck after the network call; a different tab may have canceled it.
  const still=await db.prepare("SELECT status FROM coaster_payment_attempts WHERE attempt_id=? LIMIT 1")
    .bind(attempt.attempt_id).first();
  return still?.status==='CREATED'?{orderId:attempt.provider_order_id,reused:true}:null;
}
export async function startVenmoPickup(env, orderId, expectedTotal, shippingAddress=null) {
  if (!validMoney(expectedTotal)) throw fail('Confirm a valid final total.', 400);
  if (!['sandbox','live'].includes(sanitizeEnvValue(env.PAYPAL_ENV).toLowerCase())) throw fail('Venmo checkout is not enabled.', 403);
  const order=await getCoasterOrderDetail(env,orderId);
  const quote=await quoteFor(env,order,shippingAddress);
  if(String(quote.totalAmount)!==expectedTotal)throw fail('Your tax quote changed. Review the total again.');
  const currency=sanitizeEnvValue(env.PAYPAL_CURRENCY)||'USD';
  if(currency!=='USD')throw fail('Venmo requires USD.',403);
  const db=requireOrdersDb(env);
  // Clear abandoned reservations after a worker interrupted checkout creation.
  // A late creator cannot finalize after its reservation has been abandoned.
  await db.prepare("UPDATE coaster_payment_attempts SET status='ABANDONED',updated_at=CURRENT_TIMESTAMP WHERE coaster_order_id=? AND method='VENMO' AND status='CREATING' AND updated_at < datetime('now','-3 minutes')")
    .bind(orderId).run();
  for(let step=0;step<3;step++) {
    const active=await activeVenmoCheckout(db,orderId);
    if(active){
      const reused=await reuseVenmoCheckout(env,db,orderId,quote,active);
      if(reused)return reused;
      continue;
    }
    // Only actual new reservations count toward the abuse limit. Reusing a
    // checkout (including page refreshes) does not use another attempt.
    const count=await db.prepare("SELECT COUNT(*) AS n FROM coaster_payment_attempts WHERE coaster_order_id=? AND created_at > datetime('now','-1 hour') AND status NOT IN ('ABANDONED','FAILED')")
      .bind(orderId).first();
    if(Number(count?.n||0)>=12)throw fail('Too many new Venmo checkouts this hour. Please contact WestTech.',429);
    const attemptId=crypto.randomUUID();
    const pendingRef='PENDING'+attemptId.replaceAll('-','').toUpperCase();
    // One conditional SQL write wins across concurrent Cloudflare Workers.
    // Revalidate payment eligibility *inside* the statement to close the
    // race with a concurrent PayPal/Venmo payment capture.
    const claim=await db.prepare("INSERT INTO coaster_payment_attempts (attempt_id,coaster_order_id,method,provider_order_id,amount,quote_json,status) SELECT ?,?,'VENMO',?,?,?,'CREATING' WHERE EXISTS (SELECT 1 FROM coaster_orders WHERE order_id=? AND payment_required=1 AND proof_status='APPROVED' AND (fulfillment_method='LOCAL_PICKUP' OR fulfillment_method='SHIP') AND status IN ('PROOF_APPROVED','AWAITING_PAYMENT') AND payment_status IN ('NOT_REQUESTED','AWAITING_PAYMENT','AWAITING_TAX_CONFIRMATION','PREVIEW_AWAITING_TEST_PAYMENT','PAYPAL_ERROR')) AND NOT EXISTS (SELECT 1 FROM coaster_payment_attempts WHERE coaster_order_id=? AND method='VENMO' AND status IN ('CREATING','CREATED','CAPTURING'))")
      .bind(attemptId,orderId,pendingRef,String(quote.totalAmount),JSON.stringify(quote),orderId,orderId).run();
    if(Number(claim?.meta?.changes||0)!==1){
      // Either another request won, or the order was paid/locked meanwhile.
      const other=await activeVenmoCheckout(db,orderId);
      if(other){const reused=await reuseVenmoCheckout(env,db,orderId,quote,other);if(reused)return reused;}
      throw fail('Checkout changed while processing. Refresh the order before trying again.',409);
    }
    // No payment_source: SDK v6 selects Venmo at authorization.
    const payload={intent:'CAPTURE',purchase_units:[{
      reference_id:'CUSTOM_COASTER',custom_id:orderId,
      invoice_id:`${orderId}-V-${attemptId.slice(0,8)}`,
      description:`WestTech custom coasters - ${orderId} - ${order.fulfillmentMethod==='SHIP'?'shipping':'local pickup'}`,
      amount:{currency_code:'USD',value:String(quote.totalAmount),breakdown:{
        item_total:{currency_code:'USD',value:String(quote.itemAmount)},
        shipping:{currency_code:'USD',value:String(quote.shippingAmount)},
        tax_total:{currency_code:'USD',value:String(quote.taxAmount)}
      }},
      items:[{name:'WestTech custom coaster set',quantity:'1',category:'PHYSICAL_GOODS',unit_amount:{currency_code:'USD',value:String(quote.itemAmount)}}],
      ...(order.fulfillmentMethod==='SHIP'?{shipping:{
        name:{full_name:quote.address.fullName},
        address:{address_line_1:quote.address.address1,
          ...(quote.address.address2?{address_line_2:quote.address.address2}:{}),
          admin_area_2:quote.address.city,admin_area_1:quote.address.state,
          postal_code:quote.address.postalCode,country_code:'US'}
      }}:{})
    }],
    ...(order.fulfillmentMethod==='SHIP'?{payment_source:{venmo:{experience_context:{
      shipping_preference:'SET_PROVIDED_ADDRESS',user_action:'PAY_NOW'
    }}}}:{})};
    try {
      const created=await api(env,'/v2/checkout/orders',{method:'POST',body:payload,requestId:`WT-VM-${attemptId}`});
      if(!created?.id||!/^[A-Z0-9]{8,32}$/i.test(created.id))throw fail('PayPal did not return a valid order ID.',502);
      const completed=await db.prepare("UPDATE coaster_payment_attempts SET provider_order_id=?,status='CREATED',updated_at=CURRENT_TIMESTAMP WHERE attempt_id=? AND provider_order_id=? AND status='CREATING' AND EXISTS (SELECT 1 FROM coaster_orders WHERE order_id=? AND payment_required=1 AND payment_status IN ('NOT_REQUESTED','AWAITING_PAYMENT','AWAITING_TAX_CONFIRMATION','PREVIEW_AWAITING_TEST_PAYMENT','PAYPAL_ERROR'))")
        .bind(created.id,attemptId,pendingRef,orderId).run();
      if(Number(completed?.meta?.changes||0)!==1)throw fail('Venmo checkout reservation changed; review the order before retrying.',502);
      return {orderId:created.id,reused:false};
    } catch(e) {
      // If PayPal returned a network error, the unexposed pending provider
      // order cannot be approved by this buyer. Release only our reservation.
      await db.prepare("UPDATE coaster_payment_attempts SET status='FAILED',updated_at=CURRENT_TIMESTAMP WHERE attempt_id=? AND status='CREATING' AND provider_order_id=?")
        .bind(attemptId,pendingRef).run();
      throw e;
    }
  }
  throw fail('Venmo checkout state changed repeatedly. Check your order before retrying.',409);
}

// Record a buyer-abandoned Sandbox attempt without changing the coaster order.
// A CAPTURING or CAPTURED attempt can never be downgraded to CANCELED.
export async function cancelVenmoPickup(env, orderId, paypalOrderId) {
  if (!['sandbox','live'].includes(sanitizeEnvValue(env.PAYPAL_ENV).toLowerCase())) throw fail('Venmo cancellation unavailable.',403);
  const db=requireOrdersDb(env);
  const changed=await db.prepare("UPDATE coaster_payment_attempts SET status='CANCELED',updated_at=CURRENT_TIMESTAMP WHERE coaster_order_id=? AND method='VENMO' AND provider_order_id=? AND status='CREATED'")
    .bind(orderId,paypalOrderId).run();
  if(Number(changed?.meta?.changes||0)===1)return {canceled:true};
  const row=await db.prepare("SELECT status FROM coaster_payment_attempts WHERE coaster_order_id=? AND method='VENMO' AND provider_order_id=? LIMIT 1")
    .bind(orderId,paypalOrderId).first();
  if(!row)throw fail('Payment attempt not found.',404);
  if(row.status==='CANCELED')return {canceled:true};
  throw fail('Payment is processing or completed; cancellation is not allowed. Check your order before retrying.',409);
}
export async function captureVenmoPickup(env, orderId, paypalOrderId) {
  if (!['sandbox','live'].includes(sanitizeEnvValue(env.PAYPAL_ENV).toLowerCase())) throw fail('Venmo checkout is not enabled.', 403);
  const db = requireOrdersDb(env);
  const attempt = await db.prepare("SELECT * FROM coaster_payment_attempts WHERE coaster_order_id=? AND method='VENMO' AND provider_order_id=? LIMIT 1")
    .bind(orderId,paypalOrderId).first();
  if (!attempt) throw fail('Venmo transaction does not match this order.',404);
  const current = await getCoasterOrderDetail(env,orderId);
  if (String(current?.paymentStatus||'').toUpperCase()==='PAID') {
    // Idempotent only for this exact captured attempt; never treat a different paid method as Venmo success.
    if (attempt.status==='CAPTURED') return {order:current,capturedNow:false};
    throw fail('Order was already paid through another checkout. Contact WestTech.');
  }
  requireOrder(current);
  if (attempt.status!=='CREATED') throw fail('Payment is already being processed. Contact WestTech before retrying.',409);
  let locked;
  try{locked=JSON.parse(attempt.quote_json);}catch{throw fail('Venmo quote record is invalid. Contact WestTech.',409);}
  const fresh=await quoteFor(env,current,current.fulfillmentMethod==='SHIP'?locked.address:null);
  if(!sameVenmoQuote(attempt,fresh))throw fail('Shipping address or tax quote changed. No payment captured. Contact WestTech.',409);
  if (String(fresh.totalAmount)!==attempt.amount) throw fail('The tax amount changed. No payment has been captured. Please contact WestTech.',409);
  const details = await api(env,`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`);
  if (details?.status!=='APPROVED' || details.purchase_units?.[0]?.custom_id!==orderId ||
      String(details.purchase_units?.[0]?.amount?.value)!==attempt.amount ||
      details.purchase_units?.[0]?.amount?.currency_code!=='USD') throw fail('PayPal authorization or transaction amount did not match.',409);
  // Venmo instrument must be asserted by PayPal; never trust a browser-provided method.
  if (!details?.payment_source?.venmo) throw fail('PayPal did not confirm Venmo as the funding method. No payment captured.',409);
  if (current.fulfillmentMethod==='SHIP' && !providerShippingMatches(fresh,details.purchase_units?.[0]))
    throw fail('Venmo shipping address does not match the confirmed address. No payment captured. Contact WestTech.',409);
  // Reserve both this attempt and the WestTech order BEFORE calling PayPal capture.
  // Legacy PayPal capture explicitly rejects CAPTURING_VENMO to avoid double charges.
  const reserved=await db.prepare("UPDATE coaster_payment_attempts SET status='CAPTURING',updated_at=CURRENT_TIMESTAMP WHERE attempt_id=? AND status='CREATED'").bind(attempt.attempt_id).run();
  if (Number(reserved?.meta?.changes||0)!==1) throw fail('Payment already processing.',409);
  const orderLock=await db.prepare("UPDATE coaster_orders SET payment_status='CAPTURING_VENMO',updated_at=CURRENT_TIMESTAMP WHERE order_id=? AND payment_required=1 AND proof_status='APPROVED' AND (fulfillment_method='LOCAL_PICKUP' OR fulfillment_method='SHIP') AND status IN ('PROOF_APPROVED','AWAITING_PAYMENT') AND payment_status IN ('NOT_REQUESTED','AWAITING_PAYMENT','AWAITING_TAX_CONFIRMATION','PREVIEW_AWAITING_TEST_PAYMENT','PAYPAL_ERROR')").bind(orderId).run();
  if (Number(orderLock?.meta?.changes||0)!==1) {
    await db.prepare("UPDATE coaster_payment_attempts SET status='CANCELED',updated_at=CURRENT_TIMESTAMP WHERE attempt_id=? AND status='CAPTURING'").bind(attempt.attempt_id).run();
    throw fail('Another payment is already processing. Contact WestTech.',409);
  }
  let captured;
  try {
    captured=await api(env,`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`,{method:'POST',body:{},requestId:`WT-VM-${attempt.attempt_id}-CAPTURE`});
  } catch (e) {
    // Leave CAPTURING pending manual reconciliation; capture may have succeeded despite a network error.
    throw fail('Capture needs verification. Do not pay again; contact WestTech with your order number.',502);
  }
  const cap=captured?.purchase_units?.[0]?.payments?.captures?.[0];
  if (captured?.status!=='COMPLETED' || !cap?.id || cap?.status!=='COMPLETED' ||
      String(cap?.amount?.value)!==attempt.amount || cap?.amount?.currency_code!=='USD')
    throw fail('Capture response needs reconciliation. Do not pay again.',502);
  if(current.fulfillmentMethod==='SHIP' && captured?.purchase_units?.[0]?.shipping &&
     !providerShippingMatches(fresh,captured.purchase_units[0]))
    throw fail('Capture succeeded but the provider shipping address changed. Manual reconciliation required. Do not pay again.',502);
  // Preserve existing order lifecycle; use shared markCaptured(), which records
  // events, creates manufacturing work order, and queues production only once.
  const venmoFinalize=await db.prepare(`UPDATE coaster_orders SET paypal_order_id=?,paypal_order_status='COMPLETED',
      tax_amount=?,tax_rate=?,taxable_amount=?,tax_jurisdiction_code=?,tax_source=?,
      tax_address_source=?,tax_address_json=?,tax_quote_json=?,
      payment_total=?,tax_confirmed_at=CURRENT_TIMESTAMP
      WHERE order_id=? AND payment_status='CAPTURING_VENMO'`)
    .bind(paypalOrderId,Number(fresh.taxAmount),Number(fresh.taxRate),Number(fresh.taxableAmount),String(fresh.jurisdictionCode||''),String(fresh.source||''),
      current.fulfillmentMethod==='SHIP'?'VENMO_SHIPPING':'WESTTECH_PICKUP',JSON.stringify(fresh.address),JSON.stringify(fresh),Number(fresh.totalAmount),orderId).run();
  if(Number(venmoFinalize?.meta?.changes||0)!==1)throw fail('Venmo captured, but the order lock changed. Admin reconciliation required; do not pay again.',502);
  const paid=await markCaptured(env,orderId,paypalOrderId,details,captured,{method:'VENMO'});
  if (!paid || String(paid.paymentStatus||'').toUpperCase()!=='PAID') throw fail('Payment captured, but order needs admin reconciliation. Do not pay again.',502);
  await db.prepare("UPDATE coaster_payment_attempts SET status='CAPTURED',updated_at=CURRENT_TIMESTAMP WHERE attempt_id=?").bind(attempt.attempt_id).run();
  return {order:paid,capturedNow:!!paid._paymentCapturedNow};
}


// Stage 5K3: explicit, Sandbox-only Admin recovery for a provider-COMPLETED Venmo
// capture. GET provider details only: NEVER requests a capture, refund, or unlock.
// Requires the original CAPTURING attempt and frozen total/address to agree.
export async function recoverCompletedCoasterVenmoCapture(env,orderId,providerOrderId,expectedCaptureId){
 const stop=(message,status=409)=>{throw fail(message,status);};
 if(sanitizeEnvValue(env.PAYPAL_ENV).toLowerCase()!=='sandbox')stop('Venmo recovery is Sandbox-only.',403);
 if(!/^WTCC-\d{8}-\d{1,6}$/.test(String(orderId||'')))stop('Invalid coaster order.',400);
 const ref=String(providerOrderId||'').trim(),capture=String(expectedCaptureId||'').trim();
 if(!/^[A-Z0-9]{8,32}$/i.test(ref)||!/^[A-Za-z0-9-]{8,120}$/.test(capture))stop('Valid provider and capture references are required.',400);
 const db=requireOrdersDb(env),current=await getCoasterOrderDetail(env,orderId);
 if(!current)stop('Order not found.',404);
 const attempt=await db.prepare("SELECT * FROM coaster_payment_attempts WHERE coaster_order_id=? AND method='VENMO' AND provider_order_id=? LIMIT 1")
   .bind(orderId,ref).first();
 if(!attempt)stop('Venmo payment attempt not found.');
 if(String(current.paymentStatus||'').toUpperCase()==='PAID'){
  if(current.paypalOrderId===ref&&current.paypalCaptureId===capture&&attempt.status==='CAPTURED')
   return {order:current,recovered:false,alreadyPaid:true};
  stop('Already paid or incomplete finalization. Inspect manually; do not pay again.');
 }
 if(current.paymentStatus!=='CAPTURING_VENMO'||attempt.status!=='CAPTURING')stop('Only an existing locked Venmo capture is recoverable.');
 if(current.paymentRequired!==true||current.proofStatus!=='APPROVED'||
    !['PROOF_APPROVED','AWAITING_PAYMENT'].includes(String(current.status||''))||
    !['SHIP','LOCAL_PICKUP'].includes(current.fulfillmentMethod))stop('Approved payment terms are not recoverable.');
 if(current.paypalOrderId&&current.paypalOrderId!==ref)stop('Different provider order was previously recorded.');
 if(current.paypalCaptureId)stop('Capture already recorded; manual review required.');
 let locked;
 try{locked=JSON.parse(String(attempt.quote_json||''));}catch{stop('Frozen Venmo quote is invalid.');}
 const exact=v=>typeof v==='string'&&/^\d{1,7}\.\d{2}$/.test(v);
 if(!exact(String(attempt.amount||''))||!exact(locked?.totalAmount)||!exact(locked?.itemAmount)||
    !exact(locked?.shippingAmount)||!exact(locked?.taxAmount)||
    String(locked.totalAmount)!==String(attempt.amount)||
    Math.abs(Number(locked.itemAmount)+Number(locked.shippingAmount)+Number(locked.taxAmount)-Number(locked.totalAmount))>.001||
    Math.abs(Number(locked.itemAmount)+Number(locked.shippingAmount)-Number(current.finalAmount))>.001||
    (current.fulfillmentMethod==='LOCAL_PICKUP'&&Number(locked.shippingAmount)!==0)||
    (current.fulfillmentMethod==='SHIP'&&Math.abs(Number(locked.shippingAmount)-Number(current.shippingAmount))>.001))
    stop('Frozen quote and approved order do not match.');
 if(current.fulfillmentMethod==='SHIP'&&(!locked.address||!locked.address.fullName))stop('Frozen shipping address is missing.');
 // Do not let an earlier PayPal tax record silently override this locked quote.
 if(Number(current.paymentTotal||0)>0&&Math.abs(Number(current.paymentTotal)-Number(locked.totalAmount))>.001)
  stop('Existing payment total conflicts with frozen Venmo quote.');
 if(current.taxAddressJson){
  let prior;try{prior=JSON.parse(current.taxAddressJson);}catch{stop('Recorded tax address is invalid.');}
  const norm=x=>String(x||'').trim().toUpperCase().replace(/\s+/g,' ');
  const fields=['address1','address2','city','state','postalCode','countryCode'];
  if(fields.some(k=>norm(prior[k])!==norm(locked.address?.[k])))stop('Recorded tax address conflicts with frozen Venmo quote.');
 }
 const provider=await api(env,'/v2/checkout/orders/'+encodeURIComponent(ref)); // GET only
 const units=provider?.purchase_units||[],unit=units[0],caps=unit?.payments?.captures||[],cap=caps[0];
 if(provider?.id!==ref||provider?.status!=='COMPLETED'||units.length!==1||
    unit?.custom_id!==orderId||!provider?.payment_source?.venmo||caps.length!==1||
    cap?.status!=='COMPLETED'||cap?.id!==capture||
    cap?.amount?.currency_code!=='USD'||unit?.amount?.currency_code!=='USD'||
    String(cap?.amount?.value)!==String(attempt.amount)||
    String(unit?.amount?.value)!==String(attempt.amount))
    stop('PayPal did not verify the exact completed Venmo charge. Do not pay again.');
 if(current.fulfillmentMethod==='SHIP'&&!providerShippingMatches(locked,unit))
    stop('Provider shipping destination or recipient differs from frozen quote.');
 const fresh=await getCoasterOrderDetail(env,orderId);
 const again=await db.prepare("SELECT * FROM coaster_payment_attempts WHERE coaster_order_id=? AND method='VENMO' AND provider_order_id=? LIMIT 1")
   .bind(orderId,ref).first();
 if(!fresh||!again||fresh.paymentStatus!=='CAPTURING_VENMO'||again.status!=='CAPTURING'||
    String(again.attempt_id)!==String(attempt.attempt_id)||again.quote_json!==attempt.quote_json||
    again.amount!==attempt.amount||fresh.proofStatus!=='APPROVED'||fresh.paymentRequired!==true||
    fresh.fulfillmentMethod!==current.fulfillmentMethod||fresh.status!==current.status||
    Math.abs(Number(fresh.finalAmount)-Number(current.finalAmount))>.001||
    Math.abs(Number(fresh.shippingAmount||0)-Number(current.shippingAmount||0))>.001||
    String(fresh.paypalOrderId||'')!==String(current.paypalOrderId||''))
    stop('Locked order or payment attempt changed during verification.');
 // Mirrors the ordinary Venmo finalization and leaves the capture lock in place.
 // An interrupted finalization remains locked; never resets status to retryable.
 const write=await db.prepare("UPDATE coaster_orders SET paypal_order_id=?,paypal_order_status='COMPLETED',taxable_amount=?,tax_amount=?,tax_rate=?,tax_jurisdiction_code=?,tax_source=?,tax_address_source=?,tax_address_json=?,tax_quote_json=?,payment_total=?,tax_confirmed_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE order_id=? AND payment_status='CAPTURING_VENMO' AND payment_required=1 AND proof_status='APPROVED' AND (paypal_order_id IS NULL OR paypal_order_id=?) AND paypal_capture_id IS NULL AND final_amount=? AND shipping_amount=?")
   .bind(ref,Number(locked.itemAmount),Number(locked.taxAmount),Number(locked.taxRate||0),String(locked.jurisdictionCode||''),String(locked.source||''),
     fresh.fulfillmentMethod==='SHIP'?'VENMO_SHIPPING':'WESTTECH_PICKUP',JSON.stringify(locked.address),JSON.stringify(locked),Number(locked.totalAmount),orderId,ref,Number(fresh.finalAmount),Number(fresh.shippingAmount||0)).run();
 if(Number(write?.meta?.changes||0)!==1)stop('Verified capture is still locked; Admin must inspect the changed order.');
 const paid=await markCaptured(env,orderId,ref,provider,provider,{method:'VENMO'});
 if(!paid||String(paid.paymentStatus||'').toUpperCase()!=='PAID')stop('Provider capture verified, but local finalization needs manual review.',502);
 const finished=await db.prepare("UPDATE coaster_payment_attempts SET status='CAPTURED',updated_at=CURRENT_TIMESTAMP WHERE attempt_id=? AND status='CAPTURING'")
   .bind(attempt.attempt_id).run();
 if(Number(finished?.meta?.changes||0)!==1)stop('Payment is paid, but attempt ledger needs manual reconciliation.',502);
 return {order:paid,recovered:true,alreadyPaid:false};
}
