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
    unitAmount: "27.99",
    itemAmount: "27.99",
    shippingAmount: "8.95",
    currency: "USD",
    family: "Scout",
    layout: "30-pin unloaded layout",
    offerType: "Unloaded",
    variant: "30"
  }),
  "scout-38-unloaded": Object.freeze({
    sku: "scout-38-unloaded",
    name: "Scout 38 - Unloaded",
    description: "Scout family standard product with 38-pin unloaded layout.",
    quantity: "1",
    unitAmount: "27.99",
    itemAmount: "27.99",
    shippingAmount: "8.95",
    currency: "USD",
    family: "Scout",
    layout: "38-pin unloaded layout",
    offerType: "Unloaded",
    variant: "38"
  }),
  "ranger-30-unloaded": Object.freeze({
    sku: "ranger-30-unloaded",
    name: "Ranger Relay 30 - Unloaded",
    description: "Ranger Relay family standard product with 30-pin unloaded layout.",
    quantity: "1",
    unitAmount: "29.99",
    itemAmount: "29.99",
    shippingAmount: "8.95",
    currency: "USD",
    family: "Ranger",
    layout: "Ranger Relay 30-pin unloaded layout",
    offerType: "Unloaded",
    variant: "Ranger Relay 30"
  }),
  "ranger-38-unloaded": Object.freeze({
    sku: "ranger-38-unloaded",
    name: "Ranger Relay 38 - Unloaded",
    description: "Ranger Relay family standard product with 38-pin unloaded layout.",
    quantity: "1",
    unitAmount: "29.99",
    itemAmount: "29.99",
    shippingAmount: "8.95",
    currency: "USD",
    family: "Ranger",
    layout: "Ranger Relay 38-pin unloaded layout",
    offerType: "Unloaded",
    variant: "Ranger Relay 38"
  }),
  "ranger-30-bucks-unloaded": Object.freeze({
    sku: "ranger-30-bucks-unloaded",
    name: "Ranger Bucks 30 - Unloaded",
    description: "Ranger Bucks child option with 30-pin unloaded layout.",
    quantity: "1",
    unitAmount: "29.99",
    itemAmount: "29.99",
    shippingAmount: "8.95",
    currency: "USD",
    family: "Ranger",
    layout: "Ranger Bucks 30-pin unloaded layout",
    offerType: "Unloaded",
    variant: "Ranger Bucks 30"
  }),
  "ranger-38-bucks-unloaded": Object.freeze({
    sku: "ranger-38-bucks-unloaded",
    name: "Ranger Bucks 38 - Unloaded",
    description: "Ranger Bucks child option with 38-pin unloaded layout.",
    quantity: "1",
    unitAmount: "29.99",
    itemAmount: "29.99",
    shippingAmount: "8.95",
    currency: "USD",
    family: "Ranger",
    layout: "Ranger Bucks 38-pin unloaded layout",
    offerType: "Unloaded",
    variant: "Ranger Bucks 38"
  }),
  "command-30-unloaded": Object.freeze({
    sku: "command-30-unloaded",
    name: "Command Core 30 - Unloaded",
    description: "Command Core child option with 30-pin unloaded layout.",
    quantity: "1",
    unitAmount: "32.99",
    itemAmount: "32.99",
    shippingAmount: "8.95",
    currency: "USD",
    family: "Command",
    layout: "Command Core 30-pin unloaded layout",
    offerType: "Unloaded",
    variant: "Command Core 30"
  }),
  "command-30-gp-unloaded": Object.freeze({
    sku: "command-30-gp-unloaded",
    name: "Command-GP 30 - Unloaded",
    description: "Command-GP Garage Panel child option with 30-pin unloaded layout.",
    quantity: "1",
    unitAmount: "32.99",
    itemAmount: "32.99",
    shippingAmount: "8.95",
    currency: "USD",
    family: "Command",
    layout: "Command-GP 30-pin unloaded layout",
    offerType: "Unloaded",
    variant: "Command-GP 30"
  }),
  "command-38-unloaded": Object.freeze({
    sku: "command-38-unloaded",
    name: "Command Core 38 - Unloaded",
    description: "Command Core child option with 38-pin unloaded layout.",
    quantity: "1",
    unitAmount: "34.99",
    itemAmount: "34.99",
    shippingAmount: "8.95",
    currency: "USD",
    family: "Command",
    layout: "Command Core 38-pin unloaded layout",
    offerType: "Unloaded",
    variant: "Command Core 38"
  }),
  "command-38-gp-unloaded": Object.freeze({
    sku: "command-38-gp-unloaded",
    name: "Command-GP 38 - Unloaded",
    description: "Command-GP Garage Panel child option with 38-pin unloaded layout.",
    quantity: "1",
    unitAmount: "34.99",
    itemAmount: "34.99",
    shippingAmount: "8.95",
    currency: "USD",
    family: "Command",
    layout: "Command-GP 38-pin unloaded layout",
    offerType: "Unloaded",
    variant: "Command-GP 38"
  }),
  "scout-30-loaded": Object.freeze({
    sku: "scout-30-loaded",
    name: "Scout 30 - Loaded",
    description: "Scout family loaded product with 30-pin layout.",
    quantity: "1",
    unitAmount: "42.99",
    itemAmount: "42.99",
    shippingAmount: "8.95",
    currency: "USD",
    family: "Scout",
    layout: "30-pin loaded layout",
    offerType: "Loaded",
    variant: "30"
  }),
  "scout-38-loaded": Object.freeze({
    sku: "scout-38-loaded",
    name: "Scout 38 - Loaded",
    description: "Scout family loaded product with 38-pin layout.",
    quantity: "1",
    unitAmount: "42.99",
    itemAmount: "42.99",
    shippingAmount: "8.95",
    currency: "USD",
    family: "Scout",
    layout: "38-pin loaded layout",
    offerType: "Loaded",
    variant: "38"
  }),
  "ranger-30-loaded": Object.freeze({
    sku: "ranger-30-loaded",
    name: "Ranger Relay 30 - Loaded",
    description: "Ranger Relay family loaded product with 30-pin layout.",
    quantity: "1",
    unitAmount: "46.99",
    itemAmount: "46.99",
    shippingAmount: "8.95",
    currency: "USD",
    family: "Ranger",
    layout: "Ranger Relay 30-pin loaded layout",
    offerType: "Loaded",
    variant: "Ranger Relay 30"
  }),
  "ranger-38-loaded": Object.freeze({
    sku: "ranger-38-loaded",
    name: "Ranger Relay 38 - Loaded",
    description: "Ranger Relay family loaded product with 38-pin layout.",
    quantity: "1",
    unitAmount: "46.99",
    itemAmount: "46.99",
    shippingAmount: "8.95",
    currency: "USD",
    family: "Ranger",
    layout: "Ranger Relay 38-pin loaded layout",
    offerType: "Loaded",
    variant: "Ranger Relay 38"
  }),
  "ranger-30-bucks-loaded": Object.freeze({
    sku: "ranger-30-bucks-loaded",
    name: "Ranger Bucks 30 - Loaded",
    description: "Ranger Bucks child option with 30-pin loaded layout.",
    quantity: "1",
    unitAmount: "49.99",
    itemAmount: "49.99",
    shippingAmount: "8.95",
    currency: "USD",
    family: "Ranger",
    layout: "Ranger Bucks 30-pin loaded layout",
    offerType: "Loaded",
    variant: "Ranger Bucks 30"
  }),
  "ranger-38-bucks-loaded": Object.freeze({
    sku: "ranger-38-bucks-loaded",
    name: "Ranger Bucks 38 - Loaded",
    description: "Ranger Bucks child option with 38-pin loaded layout.",
    quantity: "1",
    unitAmount: "49.99",
    itemAmount: "49.99",
    shippingAmount: "8.95",
    currency: "USD",
    family: "Ranger",
    layout: "Ranger Bucks 38-pin loaded layout",
    offerType: "Loaded",
    variant: "Ranger Bucks 38"
  }),
  "command-30-loaded": Object.freeze({
    sku: "command-30-loaded",
    name: "Command Core 30 - Loaded",
    description: "Command Core child option with 30-pin loaded layout.",
    quantity: "1",
    unitAmount: "54.99",
    itemAmount: "54.99",
    shippingAmount: "8.95",
    currency: "USD",
    family: "Command",
    layout: "Command Core 30-pin loaded layout",
    offerType: "Loaded",
    variant: "Command Core 30"
  }),
  "command-30-gp-loaded": Object.freeze({
    sku: "command-30-gp-loaded",
    name: "Command-GP 30 - Loaded",
    description: "Command-GP Garage Panel child option with 30-pin loaded layout.",
    quantity: "1",
    unitAmount: "54.99",
    itemAmount: "54.99",
    shippingAmount: "8.95",
    currency: "USD",
    family: "Command",
    layout: "Command-GP 30-pin loaded layout",
    offerType: "Loaded",
    variant: "Command-GP 30"
  }),
  "command-38-loaded": Object.freeze({
    sku: "command-38-loaded",
    name: "Command Core 38 - Loaded",
    description: "Command Core child option with 38-pin loaded layout.",
    quantity: "1",
    unitAmount: "59.99",
    itemAmount: "59.99",
    shippingAmount: "8.95",
    currency: "USD",
    family: "Command",
    layout: "Command Core 38-pin loaded layout",
    offerType: "Loaded",
    variant: "Command Core 38"
  }),
  "command-38-gp-loaded": Object.freeze({
    sku: "command-38-gp-loaded",
    name: "Command-GP 38 - Loaded",
    description: "Command-GP Garage Panel child option with 38-pin loaded layout.",
    quantity: "1",
    unitAmount: "59.99",
    itemAmount: "59.99",
    shippingAmount: "8.95",
    currency: "USD",
    family: "Command",
    layout: "Command-GP 38-pin loaded layout",
    offerType: "Loaded",
    variant: "Command-GP 38"
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
    offerType: product.offerType,
    variant: product.variant,
    shippingTierSummary: shippingTiersSummary(),
    customQuoteMinQuantity: CUSTOM_QUOTE_MIN_QUANTITY,
    shippingTiers: SHIPPING_TIERS
  };
}
