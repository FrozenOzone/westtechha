// EDIT PRODUCT PRICES HERE.
// This file is the single source of truth for checkout prices, shipping, item names, and PayPal product metadata.
// Change unitAmount here, then redeploy Cloudflare Pages.

export const SHIPPING_TIERS = Object.freeze([
  Object.freeze({ min: 1, max: 1, shippingAmount: "8.95", label: "1 unit" }),
  Object.freeze({ min: 2, max: 2, shippingAmount: "10.95", label: "2 units" }),
  Object.freeze({ min: 3, max: 4, shippingAmount: "14.95", label: "3-4 units" })
]);

export const CUSTOM_QUOTE_MIN_QUANTITY = 5;

function money(value) {
  const number = Number(value || 0);
  if (!Number.isFinite(number) || number < 0) return "0.00";
  return number.toFixed(2);
}

function normalizeQuantity(quantity) {
  const parsed = Number.parseInt(quantity, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

export function shippingAmountForQuantity(quantity) {
  const qty = normalizeQuantity(quantity);
  const tier = SHIPPING_TIERS.find((entry) => qty >= entry.min && qty <= entry.max);
  return tier ? money(tier.shippingAmount) : null;
}

export function isCustomQuoteQuantity(quantity) {
  return normalizeQuantity(quantity) >= CUSTOM_QUOTE_MIN_QUANTITY;
}

export function shippingTiersSummary() {
  return "1 unit: $8.95 • 2 units: $10.95 • 3-4 units: $14.95 • 5+ units: custom / email order";
}

export const PRODUCTS = Object.freeze({
  "scout-30-unloaded": Object.freeze({
    sku: "scout-30-unloaded",
    name: "Scout 30 - Unloaded",
    description: "Scout family standard product with 30-pin unloaded layout.",
    quantity: "1",
    unitAmount: "35.00",
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
    unitAmount: "35.00",
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
    unitAmount: "35.00",
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
    unitAmount: "35.00",
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

export function buildCheckoutProduct(sku, quantity) {
  const baseProduct = getProductOrDefault(sku);
  const qty = normalizeQuantity(quantity);
  const unitAmount = money(baseProduct.unitAmount || baseProduct.itemAmount);
  const itemAmount = money(Number(unitAmount) * qty);
  const shippingAmount = shippingAmountForQuantity(qty);
  const customQuoteOnly = isCustomQuoteQuantity(qty) || shippingAmount === null;

  return {
    ...baseProduct,
    quantity: String(qty),
    unitAmount,
    itemAmount,
    shippingAmount: customQuoteOnly ? null : shippingAmount,
    customQuoteOnly,
    shippingTierSummary: shippingTiersSummary()
  };
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
    unitAmount: money(product.unitAmount || product.itemAmount),
    itemAmount: money(product.itemAmount),
    shippingAmount: money(product.shippingAmount),
    currency: product.currency,
    family: product.family,
    layout: product.layout,
    shippingTierSummary: shippingTiersSummary(),
    customQuoteMinQuantity: CUSTOM_QUOTE_MIN_QUANTITY,
    shippingTiers: SHIPPING_TIERS
  };
}
