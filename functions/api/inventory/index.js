import { PRODUCTS } from "../../_lib/product.js";
import { availabilityForProducts } from "../../_lib/inventory.js";
import { jsonResponse } from "../../_lib/shared.js";

export async function onRequestGet(context) {
  try {
    const availability = await availabilityForProducts(context.env, PRODUCTS, 1);
    return jsonResponse({ ok: true, availability });
  } catch (error) {
    return jsonResponse({ ok: false, message: error.message || "Could not load inventory availability." }, 500);
  }
}
