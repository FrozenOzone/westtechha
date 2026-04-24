// WestTech order/invoice tracking helpers.
// D1 binding expected in Cloudflare Pages: ORDERS_DB

function utcOrderDateYmd() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function money(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number < 0) return "0.00";
  return number.toFixed(2);
}

export function requireOrdersDb(env) {
  if (!env || !env.ORDERS_DB) {
    throw new Error("Missing ORDERS_DB D1 binding. Add the westtechha-orders D1 database binding to Cloudflare Pages as ORDERS_DB and redeploy.");
  }
  return env.ORDERS_DB;
}

export async function allocateInvoiceId(db) {
  const orderDate = utcOrderDateYmd();

  // Start each day at 1001. INSERT OR IGNORE creates a 1000 seed if today does not exist.
  await db
    .prepare("INSERT OR IGNORE INTO order_counters (order_date, last_value) VALUES (?, ?)")
    .bind(orderDate, 1000)
    .run();

  await db
    .prepare("UPDATE order_counters SET last_value = last_value + 1 WHERE order_date = ?")
    .bind(orderDate)
    .run();

  const row = await db
    .prepare("SELECT last_value FROM order_counters WHERE order_date = ?")
    .bind(orderDate)
    .first();

  const dailySequence = Number(row?.last_value || 1001);
  const invoiceId = `WTHA-${orderDate}-${dailySequence}`;
  return { invoiceId, orderDate, dailySequence };
}

export async function createInitialOrderRecord(db, { invoiceId, customId, orderDate, dailySequence, product, status = "CREATING" }) {
  const itemAmount = money(product?.itemAmount);
  const shippingAmount = money(product?.shippingAmount);
  const taxAmount = "0.00";
  const totalAmount = money(Number(itemAmount) + Number(shippingAmount));

  await db.prepare(`
    INSERT INTO orders (
      invoice_id, custom_id, order_date, daily_sequence,
      status, item_amount, shipping_amount, tax_amount, total_amount
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    invoiceId,
    customId,
    orderDate,
    dailySequence,
    status,
    itemAmount,
    shippingAmount,
    taxAmount,
    totalAmount
  ).run();

  return { invoiceId, customId, itemAmount, shippingAmount, taxAmount, totalAmount };
}

export async function setPayPalOrderCreated(db, { invoiceId, paypalOrderId }) {
  await db.prepare(`
    UPDATE orders
    SET paypal_order_id = ?, status = 'CREATED', updated_at = CURRENT_TIMESTAMP
    WHERE invoice_id = ?
  `).bind(paypalOrderId, invoiceId).run();
}

export async function setPayPalCreateFailed(db, { invoiceId }) {
  await db.prepare(`
    UPDATE orders
    SET status = 'PAYPAL_CREATE_FAILED', updated_at = CURRENT_TIMESTAMP
    WHERE invoice_id = ?
  `).bind(invoiceId).run();
}

export async function getOrderByPayPalOrderId(db, paypalOrderId) {
  if (!paypalOrderId) return null;
  const row = await db.prepare(`
    SELECT
      invoice_id AS invoiceId,
      custom_id AS customId,
      paypal_order_id AS paypalOrderId,
      paypal_capture_id AS captureId,
      status,
      total_amount AS totalAmount
    FROM orders
    WHERE paypal_order_id = ?
    LIMIT 1
  `).bind(paypalOrderId).first();
  return row || null;
}

export async function updateOrderForColorado(db, { paypalOrderId, quote, shippingAddress }) {
  if (!paypalOrderId) return;
  await db.prepare(`
    UPDATE orders
    SET tax_amount = ?, total_amount = ?, shipping_address_json = ?, status = 'TAX_CONFIRMED', updated_at = CURRENT_TIMESTAMP
    WHERE paypal_order_id = ?
  `).bind(
    money(quote?.taxAmount),
    money(quote?.totalAmount),
    JSON.stringify(shippingAddress || {}),
    paypalOrderId
  ).run();
}

function extractCapture(data) {
  const purchaseUnits = Array.isArray(data?.purchase_units) ? data.purchase_units : [];
  for (const unit of purchaseUnits) {
    const captures = unit?.payments?.captures;
    if (Array.isArray(captures) && captures.length) return captures[0];
  }
  return null;
}

function extractShipping(data) {
  const shipping = data?.purchase_units?.[0]?.shipping || {};
  return {
    fullName: shipping?.name?.full_name || "",
    address1: shipping?.address?.address_line_1 || "",
    address2: shipping?.address?.address_line_2 || "",
    city: shipping?.address?.admin_area_2 || "",
    state: shipping?.address?.admin_area_1 || "",
    postalCode: shipping?.address?.postal_code || "",
    countryCode: shipping?.address?.country_code || "US"
  };
}

function extractPurchaseUnitAmount(data) {
  const amount = data?.purchase_units?.[0]?.amount;
  const breakdown = amount?.breakdown || {};
  return {
    itemAmount: money(breakdown?.item_total?.value),
    shippingAmount: money(breakdown?.shipping?.value),
    taxAmount: money(breakdown?.tax_total?.value),
    totalAmount: money(amount?.value)
  };
}

export async function markOrderCaptured(db, { paypalOrderId, captureData }) {
  if (!paypalOrderId) return;

  const capture = extractCapture(captureData);
  const payer = captureData?.payer || {};
  const payerName = payer?.name || {};
  const customerName = [payerName.given_name, payerName.surname].filter(Boolean).join(" ") || extractShipping(captureData).fullName || "";
  const customerEmail = payer?.email_address || "";
  const shippingAddress = extractShipping(captureData);
  const amounts = extractPurchaseUnitAmount(captureData);
  const status = captureData?.status || capture?.status || "COMPLETED";

  await db.prepare(`
    UPDATE orders
    SET paypal_capture_id = ?, status = ?,
        item_amount = ?, shipping_amount = ?, tax_amount = ?, total_amount = ?,
        customer_name = ?, customer_email = ?, shipping_address_json = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE paypal_order_id = ?
  `).bind(
    capture?.id || null,
    status,
    amounts.itemAmount,
    amounts.shippingAmount,
    amounts.taxAmount,
    amounts.totalAmount,
    customerName,
    customerEmail,
    JSON.stringify(shippingAddress),
    paypalOrderId
  ).run();

  return {
    captureId: capture?.id || null,
    invoiceId: captureData?.purchase_units?.[0]?.invoice_id || null,
    customId: captureData?.purchase_units?.[0]?.custom_id || null,
    status
  };
}
