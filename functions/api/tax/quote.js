import { buildCartCheckout, buildCheckoutProduct, PRODUCT } from "../../_lib/product.js";
import { jsonResponse } from "../../_lib/shared.js";
import { buildTaxQuote } from "../../_lib/tax.js";

function checkoutForBody(body) {
  if (Array.isArray(body?.items) && body.items.length > 0) return buildCartCheckout(body.items);
  return buildCheckoutProduct(body?.sku || PRODUCT.sku, body?.quantity || "1");
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const checkout = checkoutForBody(body);

    if (checkout.customQuoteOnly) {
      return jsonResponse({ ok: false, message: "Direct tax quoting is available for quantities 1 through 4 only." }, 400);
    }

    const quote = await buildTaxQuote(context.env, body, {
      taxableAmount: checkout.itemAmount,
      shippingAmount: checkout.shippingAmount
    });

    return jsonResponse({ ok: true, sku: checkout.sku, quantity: checkout.quantity, isCart: checkout.sku === "cart", ...quote });
  } catch (error) {
    return jsonResponse({ ok: false, message: error.message || "Could not calculate tax for this address." }, 400);
  }
}
