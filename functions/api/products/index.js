import { allPublicProducts } from "../../_lib/product.js";
import { jsonResponse } from "../../_lib/shared.js";

export async function onRequestGet() {
  return jsonResponse({
    ok: true,
    products: allPublicProducts()
  });
}
