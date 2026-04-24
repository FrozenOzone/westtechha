// EDIT PRODUCT PRICES HERE.
// This file is the single source of truth for checkout prices, shipping, item names, and PayPal product metadata.
// Change itemAmount/shippingAmount here, then redeploy Cloudflare Pages.

export const PRODUCTS = Object.freeze({
  "scout-30-unloaded": Object.freeze({
    sku: "scout-30-unloaded",
    name: "Scout 30 - Unloaded",
    description: "Scout family standard product with 30-pin unloaded layout.",
    quantity: "1",
    itemAmount: "35.00",
    shippingAmount: "8.95",
    currency: "USD",
    family: "Scout",
    layout: "30-pin unloaded layout"
  }),
  "scout-38-unloaded": Object.freeze({
    sku: "scout-38-unloaded",
    name: "Scout 38 - Unloaded",
    description: "Scout family standard product with 38-pin unloaded layout.",
    quantity: "1",
    itemAmount: "35.00",
    shippingAmount: "8.95",
    currency: "USD",
    family: "Scout",
    layout: "38-pin unloaded layout"
  }),
  "ranger-30-unloaded": Object.freeze({
    sku: "ranger-30-unloaded",
    name: "Ranger 30 - Unloaded",
    description: "Ranger family standard product with 30-pin unloaded layout.",
    quantity: "1",
    itemAmount: "35.00",
    shippingAmount: "8.95",
    currency: "USD",
    family: "Ranger",
    layout: "30-pin unloaded layout"
  }),
  "ranger-38-unloaded": Object.freeze({
    sku: "ranger-38-unloaded",
    name: "Ranger 38 - Unloaded",
    description: "Ranger family standard product with 38-pin unloaded layout.",
    quantity: "1",
    itemAmount: "35.00",
    shippingAmount: "8.95",
    currency: "USD",
    family: "Ranger",
    layout: "38-pin unloaded layout"
  })
});

export const DEFAULT_PRODUCT_SKU = "scout-30-unloaded";
export const PRODUCT = PRODUCTS[DEFAULT_PRODUCT_SKU];

export function getProduct(sku) {
  const key = typeof sku === "string" ? sku.trim().toLowerCase() : "";
  return PRODUCTS[key] || null;
}

export function getProductOrDefault(sku) {
  return getProduct(sku) || PRODUCT;
}

export function allPublicProducts() {
  return Object.fromEntries(Object.entries(PRODUCTS).map(([sku, product]) => [sku, publicProduct(product)]));
}

export function publicProduct(product) {
  return {
    sku: product.sku,
    name: product.name,
    description: product.description,
    quantity: product.quantity,
    itemAmount: product.itemAmount,
    shippingAmount: product.shippingAmount,
    currency: product.currency,
    family: product.family,
    layout: product.layout
  };
}
