import { PRODUCT } from "../../_lib/product.js";
import { jsonResponse } from "../../_lib/shared.js";
import { buildTaxQuote } from "../../_lib/tax.js";

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    console.log("[tax.quote] incoming", JSON.stringify(body));
    const quote = await buildTaxQuote(context.env, body, {
      taxableAmount: PRODUCT.itemAmount,
      shippingAmount: PRODUCT.shippingAmount
    });

    console.log("[tax.quote] success", JSON.stringify({
      source: quote.source,
      isColorado: quote.isColorado,
      taxAmount: quote.taxAmount,
      totalAmount: quote.totalAmount,
      apiAddress: quote.apiAddress,
      jurisdictionCode: quote.jurisdictionCode
    }));

    return jsonResponse({
      ok: true,
      ...quote
    });
  } catch (error) {
    console.log("[tax.quote] error", JSON.stringify({
      message: error.message || "Could not calculate tax for this address."
    }));
    return jsonResponse({
      ok: false,
      message: error.message || "Could not calculate tax for this address."
    }, 400);
  }
}
