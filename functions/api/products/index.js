import { allPublicProducts, PRODUCTS } from "../../_lib/product.js";
import { availabilityForProducts } from "../../_lib/inventory.js";
import { jsonResponse } from "../../_lib/shared.js";

export async function onRequestGet(context) {
  const products = allPublicProducts();

  try {
    const availability = await availabilityForProducts(context.env, PRODUCTS, 1);
    for (const [sku, inventory] of Object.entries(availability || {})) {
      if (products[sku]) products[sku].availability = inventory;
    }
  } catch (error) {
    console.warn("[products.index] inventory unavailable", error && error.message ? error.message : error);
  }

  return jsonResponse({
    ok: true,
    products
  });
}
