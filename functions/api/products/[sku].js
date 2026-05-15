import { buildCheckoutProduct, publicProduct } from "../../_lib/product.js";
import { availabilityForProduct } from "../../_lib/inventory.js";
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

  let availability = null;
  try {
    availability = await availabilityForProduct(context.env, product.sku, product.quantity);
  } catch (error) {
    console.warn("[products.sku] inventory unavailable", error && error.message ? error.message : error);
  }

  return jsonResponse({
    ok: true,
    product: {
      ...publicProduct(product),
      quantity: product.quantity,
      itemAmount: product.itemAmount,
      shippingAmount: product.shippingAmount,
      customQuoteOnly: product.customQuoteOnly,
      availability
    }
  });
}
