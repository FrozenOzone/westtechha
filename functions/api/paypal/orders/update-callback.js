import { PRODUCT } from "../../../_lib/product.js";
import { sanitizeEnvValue } from "../../../_lib/shared.js";

function summarizeIncomingBody(body) {
  return {
    id: body?.id || null,
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

function successResponse(orderId, currency, note = null) {
  return new Response(JSON.stringify({
    id: orderId,
    purchase_units: [
      {
        reference_id: PRODUCT.sku,
        amount: {
          currency_code: currency,
          value: (Number(PRODUCT.itemAmount) + Number(PRODUCT.shippingAmount)).toFixed(2),
          breakdown: {
            item_total: { currency_code: currency, value: PRODUCT.itemAmount },
            tax_total: { currency_code: currency, value: "0.00" },
            shipping: { currency_code: currency, value: PRODUCT.shippingAmount }
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
  const currency = (sanitizeEnvValue(context.env.PAYPAL_CURRENCY) || PRODUCT.currency) || PRODUCT.currency;
  const summary = summarizeIncomingBody(body);
  console.log("[paypal.orders.update-callback] incoming", JSON.stringify({
    env: (sanitizeEnvValue(context.env.PAYPAL_ENV) || "sandbox").toLowerCase(),
    hasGisKey: Boolean(sanitizeEnvValue(context.env.CO_GIS_API_KEY)),
    hasProductServiceId: Boolean(sanitizeEnvValue(context.env.CO_GIS_PRODUCT_SERVICE_ID)),
    payload: summary
  }));

  const state = (summary.shippingAddress.admin_area_1 || "").toUpperCase();
  const note = state === "CO"
    ? "Colorado order will be finalized on the merchant site after address confirmation."
    : null;

  console.log("[paypal.orders.update-callback] passthrough", JSON.stringify({ orderId: summary.id, state, note }));
  return successResponse(summary.id || "", currency, note);
}
