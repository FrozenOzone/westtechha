import { getProduct, publicProduct } from "../../_lib/product.js";
import { jsonResponse, sanitizeEnvValue } from "../../_lib/shared.js";

export async function onRequestGet(context) {
  const sku = sanitizeEnvValue(context.params.sku);
  const product = getProduct(sku);

  if (!product) {
    return jsonResponse({
      ok: false,
      message: `Unknown product SKU: ${sku || "missing"}`
    }, 404);
  }

  return jsonResponse({
    ok: true,
    product: publicProduct(product)
  });
}
