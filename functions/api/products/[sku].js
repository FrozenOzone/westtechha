import { buildConfiguredProduct, publicProduct } from "../../_lib/product.js";
import { availabilityForProduct } from "../../_lib/inventory.js";
import { jsonResponse, sanitizeEnvValue } from "../../_lib/shared.js";

export async function onRequestGet(context) {
  const sku = sanitizeEnvValue(context.params.sku);
  const search = new URL(context.request.url).searchParams;
  const quantity = sanitizeEnvValue(search.get("quantity")) || "1";
  const selectedComponents = sanitizeEnvValue(search.get("components") || "").split(",").map((value) => value.trim()).filter(Boolean);
  let product;
  try {
    product = buildConfiguredProduct(sku, quantity, selectedComponents);
  } catch (error) {
    return jsonResponse({ok:false,message:error.message || "Invalid enclosure components."}, error.status || 400);
  }

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
      baseUnitAmount: product.baseUnitAmount,
      baseItemAmount: product.baseItemAmount,
      loadedComponents: product.loadedComponents,
      loadedComponentsAmount: product.loadedComponentsAmount,
      availability
    }
  });
}
