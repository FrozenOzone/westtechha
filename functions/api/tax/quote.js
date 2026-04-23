import { PRODUCT } from "../../_lib/product.js";
import { jsonResponse } from "../../_lib/shared.js";
import { buildTaxQuote } from "../../_lib/tax.js";

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const quote = await buildTaxQuote(context.env, body, {
      taxableAmount: PRODUCT.itemAmount,
      shippingAmount: PRODUCT.shippingAmount
    });

    return jsonResponse({
      ok: true,
      ...quote
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      message: error.message || "Could not calculate tax for this address."
    }, 400);
  }
}
