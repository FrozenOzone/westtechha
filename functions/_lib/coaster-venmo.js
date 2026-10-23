/* Sandbox-only, local-pickup Venmo payment adapter. No change to existing PayPal checkout. */
import { generateAccessToken, paypalBaseUrl } from './paypal.js';
import { getCoasterOrderDetail } from './coaster-orders.js';
import { buildTaxQuote } from './tax.js';
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
  if (order.fulfillmentMethod !== 'LOCAL_PICKUP') throw fail('Venmo testing currently supports local pickup only. Please use PayPal for shipped orders.');
  if (!String(order.productionWindow || '').trim()) throw fail('Production window is not set.');
  if (!(Number(order.finalAmount) > 0)) throw fail('Approved amount is invalid.');
}
async function quoteFor(env, order) {
  requireOrder(order);
  const amount = money(Number(order.finalAmount));
  const quote = await buildTaxQuote(env, PICKUP_ADDRESS, {
    taxableAmount: amount, itemAmount: amount, shippingAmount: 0
  });
  if (!quote.isColorado || !validMoney(String(quote.totalAmount))) throw fail('Could not verify pickup tax quote.', 503);
  return quote;
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
export async function startVenmoPickup(env, orderId, expectedTotal) {
  if (!validMoney(expectedTotal)) throw fail('Confirm a valid final total.', 400);
  if (sanitizeEnvValue(env.PAYPAL_ENV).toLowerCase() !== 'sandbox') throw fail('Venmo Sandbox checkout is not enabled.', 403);
  const order = await getCoasterOrderDetail(env, orderId);
  const quote = await quoteFor(env, order);
  if (String(quote.totalAmount) !== expectedTotal) throw fail('Your tax quote changed. Review the total again.');
  const db = requireOrdersDb(env);
  const count = await db.prepare("SELECT COUNT(*) AS n FROM coaster_payment_attempts WHERE coaster_order_id=? AND created_at > datetime('now','-1 hour')").bind(orderId).first();
  if (Number(count?.n || 0) >= 5) throw fail('Too many payment attempts. Please contact WestTech.', 429);
  const attemptId = crypto.randomUUID();
  const currency = sanitizeEnvValue(env.PAYPAL_CURRENCY) || 'USD';
  if (currency !== 'USD') throw fail('Venmo requires USD.', 403);
  // No payment_source: the JS SDK v6 Venmo session selects the instrument.
  const payload = {intent:'CAPTURE',purchase_units:[{
    reference_id:'CUSTOM_COASTER',custom_id:orderId,
    invoice_id:`${orderId}-V-${attemptId.slice(0,8)}`,
    description:`WestTech custom coasters - ${orderId} - local pickup`,
    amount:{currency_code:'USD',value:String(quote.totalAmount),breakdown:{
      item_total:{currency_code:'USD',value:String(quote.itemAmount)},
      shipping:{currency_code:'USD',value:'0.00'},
      tax_total:{currency_code:'USD',value:String(quote.taxAmount)}
    }},
    items:[{name:'WestTech custom coaster set',quantity:'1',category:'PHYSICAL_GOODS',unit_amount:{currency_code:'USD',value:String(quote.itemAmount)}}]
  }]};
  const created = await api(env, '/v2/checkout/orders', {method:'POST',body:payload,requestId:`WT-VM-${attemptId}`});
  if (!created?.id || !/^[A-Z0-9]{8,32}$/i.test(created.id)) throw fail('PayPal did not return a valid order ID.', 502);
  await db.prepare('INSERT INTO coaster_payment_attempts (attempt_id,coaster_order_id,method,provider_order_id,amount,quote_json) VALUES (?,?,?,?,?,?)')
    .bind(attemptId,orderId,'VENMO',created.id,String(quote.totalAmount),JSON.stringify(quote)).run();
  return {orderId:created.id};
}
export async function captureVenmoPickup(env, orderId, paypalOrderId) {
  if (sanitizeEnvValue(env.PAYPAL_ENV).toLowerCase() !== 'sandbox') throw fail('Venmo Sandbox checkout is not enabled.', 403);
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
  const fresh = await quoteFor(env,current);
  if (String(fresh.totalAmount)!==attempt.amount) throw fail('The tax amount changed. No payment has been captured. Please contact WestTech.',409);
  const details = await api(env,`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`);
  if (details?.status!=='APPROVED' || details.purchase_units?.[0]?.custom_id!==orderId ||
      String(details.purchase_units?.[0]?.amount?.value)!==attempt.amount ||
      details.purchase_units?.[0]?.amount?.currency_code!=='USD') throw fail('PayPal authorization or transaction amount did not match.',409);
  // Venmo instrument must be asserted by PayPal; never trust a browser-provided method.
  if (!details?.payment_source?.venmo) throw fail('PayPal did not confirm Venmo as the funding method. No payment captured.',409);
  // Reserve both this attempt and the WestTech order BEFORE calling PayPal capture.
  // Legacy PayPal capture explicitly rejects CAPTURING_VENMO to avoid double charges.
  const reserved=await db.prepare("UPDATE coaster_payment_attempts SET status='CAPTURING',updated_at=CURRENT_TIMESTAMP WHERE attempt_id=? AND status='CREATED'").bind(attempt.attempt_id).run();
  if (Number(reserved?.meta?.changes||0)!==1) throw fail('Payment already processing.',409);
  const orderLock=await db.prepare("UPDATE coaster_orders SET payment_status='CAPTURING_VENMO',updated_at=CURRENT_TIMESTAMP WHERE order_id=? AND payment_status IN ('AWAITING_PAYMENT','AWAITING_TAX_CONFIRMATION','PREVIEW_AWAITING_TEST_PAYMENT','PAYPAL_ERROR')").bind(orderId).run();
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
  // Preserve existing order lifecycle; use shared markCaptured(), which records
  // events, creates manufacturing work order, and queues production only once.
  const venmoFinalize=await db.prepare(`UPDATE coaster_orders SET paypal_order_id=?,paypal_order_status='COMPLETED',
      tax_amount=?,tax_rate=?,taxable_amount=?,tax_jurisdiction_code=?,tax_source=?,
      tax_address_source='WESTTECH_PICKUP',tax_address_json=?,tax_quote_json=?,
      payment_total=?,tax_confirmed_at=CURRENT_TIMESTAMP
      WHERE order_id=? AND payment_status='CAPTURING_VENMO'`)
    .bind(paypalOrderId,Number(fresh.taxAmount),Number(fresh.taxRate),Number(fresh.taxableAmount),String(fresh.jurisdictionCode||''),String(fresh.source||''),
      JSON.stringify(fresh.address),JSON.stringify(fresh),Number(fresh.totalAmount),orderId).run();
  if(Number(venmoFinalize?.meta?.changes||0)!==1)throw fail('Venmo captured, but the order lock changed. Admin reconciliation required; do not pay again.',502);
  const paid=await markCaptured(env,orderId,paypalOrderId,details,captured,{method:'VENMO'});
  if (!paid || String(paid.paymentStatus||'').toUpperCase()!=='PAID') throw fail('Payment captured, but order needs admin reconciliation. Do not pay again.',502);
  await db.prepare("UPDATE coaster_payment_attempts SET status='CAPTURED',updated_at=CURRENT_TIMESTAMP WHERE attempt_id=?").bind(attempt.attempt_id).run();
  return {order:paid,capturedNow:!!paid._paymentCapturedNow};
}
