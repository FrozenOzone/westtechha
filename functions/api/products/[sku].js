import { buildCheckoutProduct, publicProduct } from "../../_lib/product.js";
import { jsonResponse, sanitizeEnvValue } from "../../_lib/shared.js";

export async function onRequestGet(context) {
  const sku = sanitizeEnvValue(context.params.sku);
  const quantity = sanitizeEnvValue(new URL(context.request.url).searchParams.get("quantity")) || "1";
  const product = buildCheckoutProduct(sku, quantity);

  if (!product || !product.sku) {
    return jsonResponse({
      ok: false,
      message: `Unknown product SKU: ${sku || "missing"}`
    }, 404);
  }

  return jsonResponse({
    ok: true,
    product: {
      ...publicProduct(product),
      quantity: product.quantity,
      itemAmount: product.itemAmount,
      shippingAmount: product.shippingAmount,
      customQuoteOnly: product.customQuoteOnly
    }
  });
}
