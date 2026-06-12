import { generateAccessToken, paypalBaseUrl } from "../../../_lib/paypal.js";
import { buildCartCheckout, buildCheckoutProduct, PRODUCT } from "../../../_lib/product.js";
import { allocateInvoiceId, createInitialOrderRecord, requireOrdersDb, setPayPalCreateFailed, setPayPalOrderCreated } from "../../../_lib/orders.js";
import { jsonResponse, readJsonSafe, sanitizeEnvValue } from "../../../_lib/shared.js";
import { attachPayPalOrderToInventoryHold, releaseInventoryHold, reserveInventoryForProduct } from "../../../_lib/inventory.js";

function isCartRequest(body) {
  return Array.isArray(body?.items) && body.items.length > 0;
}

function checkoutForBody(body) {
  if (isCartRequest(body)) return buildCartCheckout(body.items);
  const requestedSku = sanitizeEnvValue(body?.sku) || PRODUCT.sku;
  const requestedQuantity = sanitizeEnvValue(body?.quantity) || "1";
  return buildCheckoutProduct(requestedSku, requestedQuantity);
}

function baseAmountBreakdown(checkout, currency) {
  return {
    currency_code: currency,
    value: (Number(checkout.itemAmount) + Number(checkout.shippingAmount)).toFixed(2),
    breakdown: {
      item_total: {
        currency_code: currency,
        value: checkout.itemAmount
      },
      shipping: {
        currency_code: currency,
        value: checkout.shippingAmount
      },
      tax_total: {
        currency_code: currency,
        value: "0.00"
      }
    }
  };
}

function paypalItems(checkout, currency) {
  const lines = Array.isArray(checkout.items) && checkout.items.length ? checkout.items : [checkout];
  return lines.map((line) => ({
    name: line.color ? `${line.name} (${line.color})` : line.name,
    sku: line.sku,
    description: line.description,
    quantity: String(line.quantity || "1"),
    unit_amount: {
      currency_code: currency,
      value: line.unitAmount
    },
    category: "PHYSICAL_GOODS"
  }));
}

function checkoutPathForCheckout(checkout) {
  return checkout?.sku === "cart" ? "/cart.html" : `/checkout-${checkout.sku}.html`;
}

function buildOrderPayload(context, checkout, orderMeta) {
  const currency = sanitizeEnvValue(context.env.PAYPAL_CURRENCY) || checkout.currency || PRODUCT.currency;
  const referenceId = checkout.sku || "cart";

  return {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: referenceId,
        description: checkout.description,
        custom_id: referenceId,
        invoice_id: orderMeta.invoiceId,
        amount: baseAmountBreakdown(checkout, currency),
        items: paypalItems(checkout, currency)
      }
    ],
    payment_source: {
      paypal: {
        experience_context: {
          shipping_preference: "GET_FROM_FILE",
          user_action: "CONTINUE",
          return_url: new URL("/order-thank-you.html", context.request.url).toString(),
          cancel_url: new URL(checkoutPathForCheckout(checkout), context.request.url).toString()
        }
      }
    }
  };
}

async function reserveInventoryForCheckout(context, checkout, invoiceId) {
  const lines = Array.isArray(checkout.items) && checkout.items.length ? checkout.items : [checkout];
  const reservations = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const result = await reserveInventoryForProduct(context.env, line, {
      invoiceId,
      holdId: `hold-${invoiceId}-${index + 1}`
    });

    if (result && result.reserved === false && result.skipped === false) {
      await releaseInventoryHold(context.env, {
        invoiceId,
        status: "RESERVE_FAILED",
        note: "Released cart inventory holds because one cart item could not be reserved."
      }).catch(() => {});
      return result;
    }
    reservations.push(result);
  }

  return { reserved: true, reservations };
}

export async function onRequestPost(context) {
  let orderMeta = null;
  try {
    const body = await context.request.json().catch(() => ({}));
    const checkout = checkoutForBody(body);

    if (!checkout || !checkout.sku) {
      return jsonResponse({ ok: false, message: "Unknown product or cart contents." }, 400);
    }

    if (checkout.customQuoteOnly) {
      return jsonResponse({ ok: false, message: "Direct checkout is available for quantities 1 through 4 only. Please use the custom / email order path for 5+ units." }, 400);
    }

    const ordersDb = requireOrdersDb(context.env);
    orderMeta = await allocateInvoiceId(ordersDb);
    await createInitialOrderRecord(ordersDb, {
      ...orderMeta,
      customId: checkout.sku,
      product: checkout,
      status: "CREATING"
    });

    const inventoryHold = await reserveInventoryForCheckout(context, checkout, orderMeta.invoiceId);
    if (inventoryHold && inventoryHold.reserved === false && inventoryHold.skipped === false) {
      await setPayPalCreateFailed(ordersDb, { invoiceId: orderMeta.invoiceId }).catch(() => {});
      return jsonResponse({ ok: false, message: inventoryHold.message || "One or more items are temporarily unavailable." }, 409);
    }

    const payload = buildOrderPayload(context, checkout, orderMeta);

    const accessToken = await generateAccessToken(context.env);
    const response = await fetch(`${paypalBaseUrl(context.env.PAYPAL_ENV)}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify(payload)
    });

    const data = await readJsonSafe(response);

    if (!response.ok || !data.id) {
      await setPayPalCreateFailed(ordersDb, { invoiceId: orderMeta.invoiceId }).catch(() => {});
      await releaseInventoryHold(context.env, { invoiceId: orderMeta.invoiceId, status: "PAYPAL_CREATE_FAILED", note: "Released inventory hold because PayPal order creation failed." }).catch(() => {});
      return jsonResponse({
        ok: false,
        message: data.message || data.details?.[0]?.description || data.raw || "Could not create the PayPal order.",
        details: data.details || null,
        debug_id: data.debug_id || null
      }, response.status || 500);
    }

    await setPayPalOrderCreated(ordersDb, { invoiceId: orderMeta.invoiceId, paypalOrderId: data.id });
    await attachPayPalOrderToInventoryHold(context.env, { invoiceId: orderMeta.invoiceId, paypalOrderId: data.id }).catch(() => {});

    return jsonResponse({
      ok: true,
      id: data.id,
      status: data.status || null,
      sku: checkout.sku,
      quantity: checkout.quantity,
      invoiceId: orderMeta.invoiceId,
      customId: checkout.sku,
      isCart: checkout.sku === "cart"
    });
  } catch (error) {
    if (orderMeta?.invoiceId) {
      await releaseInventoryHold(context.env, { invoiceId: orderMeta.invoiceId, status: "CREATE_ERROR", note: "Released inventory holds after order creation error." }).catch(() => {});
    }
    return jsonResponse({ ok: false, message: error.message || "Unexpected error while creating the PayPal order." }, 500);
  }
}
