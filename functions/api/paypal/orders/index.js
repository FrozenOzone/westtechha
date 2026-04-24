import { generateAccessToken, paypalBaseUrl } from "../../../_lib/paypal.js";
import { getProduct, PRODUCT } from "../../../_lib/product.js";
import { allocateInvoiceId, createInitialOrderRecord, requireOrdersDb, setPayPalCreateFailed, setPayPalOrderCreated } from "../../../_lib/orders.js";
import { jsonResponse, readJsonSafe, sanitizeEnvValue } from "../../../_lib/shared.js";

function baseAmountBreakdown(product, currency) {
  return {
    currency_code: currency,
    value: (Number(product.itemAmount) + Number(product.shippingAmount)).toFixed(2),
    breakdown: {
      item_total: {
        currency_code: currency,
        value: product.itemAmount
      },
      shipping: {
        currency_code: currency,
        value: product.shippingAmount
      },
      tax_total: {
        currency_code: currency,
        value: "0.00"
      }
    }
  };
}

function buildOrderPayload(context, product, orderMeta) {
  const currency = sanitizeEnvValue(context.env.PAYPAL_CURRENCY) || product.currency || PRODUCT.currency;

  return {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: product.sku,
        description: product.description,
        custom_id: product.sku,
        invoice_id: orderMeta.invoiceId,
        amount: baseAmountBreakdown(product, currency),
        items: [
          {
            name: product.name,
            sku: product.sku,
            description: product.description,
            quantity: product.quantity,
            unit_amount: {
              currency_code: currency,
              value: product.itemAmount
            },
            tax: {
              currency_code: currency,
              value: "0.00"
            },
            category: "PHYSICAL_GOODS"
          }
        ]
      }
    ],
    payment_source: {
      paypal: {
        experience_context: {
          shipping_preference: "GET_FROM_FILE",
          user_action: "CONTINUE",
          return_url: new URL("/order-thank-you.html", context.request.url).toString(),
          cancel_url: new URL(checkoutPathForProduct(product), context.request.url).toString()
        }
      }
    }
  };
}

function checkoutPathForProduct(product) {
  return `/checkout-${product.sku}.html`;
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json().catch(() => ({}));
    const requestedSku = sanitizeEnvValue(body?.sku) || PRODUCT.sku;
    const product = getProduct(requestedSku);

    if (!product) {
      return jsonResponse({ ok: false, message: `Unknown product SKU: ${requestedSku}` }, 400);
    }

    const ordersDb = requireOrdersDb(context.env);
    const orderMeta = await allocateInvoiceId(ordersDb);
    await createInitialOrderRecord(ordersDb, {
      ...orderMeta,
      customId: product.sku,
      product,
      status: "CREATING"
    });

    const payload = buildOrderPayload(context, product, orderMeta);
    payload.payment_source.paypal.experience_context.cancel_url = new URL(checkoutPathForProduct(product), context.request.url).toString();

    console.log("[paypal.orders.create] start", JSON.stringify({
      env: (sanitizeEnvValue(context.env.PAYPAL_ENV) || "sandbox").toLowerCase(),
      currency: sanitizeEnvValue(context.env.PAYPAL_CURRENCY) || product.currency,
      hasClientId: Boolean(sanitizeEnvValue(context.env.PAYPAL_CLIENT_ID)),
      hasClientSecret: Boolean(sanitizeEnvValue(context.env.PAYPAL_CLIENT_SECRET)),
      shippingPreference: payload.payment_source?.paypal?.experience_context?.shipping_preference || null,
      userAction: payload.payment_source?.paypal?.experience_context?.user_action || null,
      sku: product.sku,
      invoiceId: orderMeta.invoiceId,
      customId: product.sku,
      baseValue: payload.purchase_units?.[0]?.amount?.value || null
    }));

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
    console.log("[paypal.orders.create] paypal-response", JSON.stringify({
      status: response.status,
      ok: response.ok,
      id: data.id || null,
      orderStatus: data.status || null,
      debugId: data.debug_id || null,
      message: data.message || data.details?.[0]?.description || null,
      links: Array.isArray(data.links) ? data.links.map((link) => ({ rel: link.rel, href: link.href, method: link.method })) : []
    }));

    if (!response.ok || !data.id) {
      await setPayPalCreateFailed(ordersDb, { invoiceId: orderMeta.invoiceId }).catch((error) => console.log("[paypal.orders.create] d1-failed-status-error", JSON.stringify({ message: error.message })));
      return jsonResponse({
        ok: false,
        message: data.message || data.details?.[0]?.description || data.raw || "Could not create the PayPal order.",
        details: data.details || null,
        debug_id: data.debug_id || null
      }, response.status || 500);
    }

    await setPayPalOrderCreated(ordersDb, { invoiceId: orderMeta.invoiceId, paypalOrderId: data.id });

    return jsonResponse({
      ok: true,
      id: data.id,
      status: data.status || null,
      sku: product.sku,
      invoiceId: orderMeta.invoiceId,
      customId: product.sku
    });
  } catch (error) {
    console.log("[paypal.orders.create] error", JSON.stringify({ message: error.message || "Unknown error" }));
    return jsonResponse({
      ok: false,
      message: error.message || "Unexpected error while creating the PayPal order."
    }, 500);
  }
}
