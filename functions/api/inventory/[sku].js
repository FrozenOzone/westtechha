import { availabilityForProduct } from "../../_lib/inventory.js";
import { jsonResponse, sanitizeEnvValue } from "../../_lib/shared.js";

export async function onRequestGet(context) {
  try {
    const sku = sanitizeEnvValue(context.params.sku);
    const quantity = sanitizeEnvValue(new URL(context.request.url).searchParams.get("quantity")) || "1";
    const availability = await availabilityForProduct(context.env, sku, quantity);
    return jsonResponse({ ok: true, sku, availability });
  } catch (error) {
    return jsonResponse({ ok: false, message: error.message || "Could not load inventory availability." }, 500);
  }
}
