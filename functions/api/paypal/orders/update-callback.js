import { getProduct, PRODUCT } from "../../../_lib/product.js";
import { sanitizeEnvValue } from "../../../_lib/shared.js";

function summarizeIncomingBody(body) {
  const firstUnit = Array.isArray(body?.purchase_units) ? body.purchase_units[0] : null;
  return {
    id: body?.id || null,
    referenceId: firstUnit?.reference_id || null,
    hasShippingAddress: Boolean(body?.shipping_address),
    shippingAddress: {
      address_line_1: body?.shipping_address?.address_line_1 || null,
      address_line_2: body?.shipping_address?.address_line_2 || null,
      admin_area_2: body?.shipping_address?.admin_area_2 || null,
      admin_area_1: body?.shipping_address?.admin_area_1 || null,
      postal_code: body?.shipping_address?.postal_code || null,
      country_code: body?.shipping_address?.country_code || null
    },
    hasPurchaseUnits: Array.isArray(body?.purchase_units),
    purchaseUnitCount: Array.isArray(body?.purchase_units) ? body.purchase_units.length : 0
  };
}

function successResponse(orderId, product, currency, note = null) {
  return new Response(JSON.stringify({
    id: orderId,
    purchase_units: [
      {
        reference_id: product.sku,
        amount: {
          currency_code: currency,
          value: (Number(product.itemAmount) + Number(product.shippingAmount)).toFixed(2),
          breakdown: {
            item_total: { currency_code: currency, value: product.itemAmount },
            tax_total: { currency_code: currency, value: "0.00" },
            shipping: { currency_code: currency, value: product.shippingAmount }
          }
        }
      }
    ]
  }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...(note ? { "X-WestTech-Note": note } : {})
    }
  });
}

export async function onRequestPost(context) {
  const body = await context.request.json();
  const summary = summarizeIncomingBody(body);
  const product = getProduct(summary.referenceId) || PRODUCT;
  const currency = (sanitizeEnvValue(context.env.PAYPAL_CURRENCY) || product.currency) || PRODUCT.currency;

  console.log("[paypal.orders.update-callback] incoming", JSON.stringify({
    env: (sanitizeEnvValue(context.env.PAYPAL_ENV) || "sandbox").toLowerCase(),
    hasGisKey: Boolean(sanitizeEnvValue(context.env.CO_GIS_API_KEY)),
    hasProductServiceId: Boolean(sanitizeEnvValue(context.env.CO_GIS_PRODUCT_SERVICE_ID)),
    sku: product.sku,
    payload: summary
  }));

  const state = (summary.shippingAddress.admin_area_1 || "").toUpperCase();
  const note = state === "CO"
    ? "Colorado order will be finalized on the merchant site after address confirmation."
    : null;

  console.log("[paypal.orders.update-callback] passthrough", JSON.stringify({ orderId: summary.id, state, sku: product.sku, note }));
  return successResponse(summary.id || "", product, currency, note);
}
