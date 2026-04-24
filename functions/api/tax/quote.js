import { buildCheckoutProduct, PRODUCT } from "../../_lib/product.js";
import { jsonResponse } from "../../_lib/shared.js";
import { buildTaxQuote } from "../../_lib/tax.js";

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const product = buildCheckoutProduct(body?.sku || PRODUCT.sku, body?.quantity || "1");

    if (product.customQuoteOnly) {
      return jsonResponse({ ok: false, message: "Direct tax quoting is available for quantities 1 through 4 only." }, 400);
    }

    const taxableAmount = product.itemAmount;
    const shippingAmount = product.shippingAmount;
    const quote = await buildTaxQuote(context.env, body, { taxableAmount, shippingAmount });

    return jsonResponse({ ok: true, sku: product.sku, quantity: product.quantity, ...quote });
  } catch (error) {
    return jsonResponse({ ok: false, message: error.message || "Could not calculate tax for this address." }, 400);
  }
}
