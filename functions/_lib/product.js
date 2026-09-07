// EDIT PRODUCT PRICES HERE.
// This file is the single source of truth for checkout prices, shipping, item names, and PayPal product metadata.
// Change unitAmount here, then redeploy Cloudflare Pages.

export const SHIPPING_TIERS = Object.freeze([
  Object.freeze({ min: 1, max: 1, shippingAmount: "8.95", label: "1 unit" }),
  Object.freeze({ min: 2, max: 2, shippingAmount: "10.95", label: "2 units" }),
  Object.freeze({ min: 3, max: 4, shippingAmount: "14.95", label: "3-4 units" })
]);

export const CUSTOM_QUOTE_MIN_QUANTITY = 5;

// Loaded configuration pricing and compatibility live here so the customer form,
// order creation, admin review, approval page, and PayPal amount all use the same rules.
export const LOADED_OPTION_COMPONENTS = Object.freeze({
  "oled-096": Object.freeze({
    componentSku: "oled-096",
    label: "0.96-inch OLED display",
    description: "Installed and wired for the selected enclosure layout.",
    unitAmount: "8.00"
  }),
  "buzzer": Object.freeze({
    componentSku: "buzzer",
    label: "Buzzer",
    description: "Installed and wired as an audible alert option.",
    unitAmount: "3.00"
  }),
  "lcd2004": Object.freeze({
    componentSku: "lcd2004",
    label: "LCD2004 display",
    description: "20×4 I²C display installed and wired for the selected Command layout.",
    unitAmount: "15.00"
  }),
  "dht11": Object.freeze({
    componentSku: "dht11",
    label: "DHT11 temperature and humidity sensor",
    description: "Installed and wired for temperature and humidity sensing.",
    unitAmount: "5.00"
  })
});

const LOADED_MODEL_OPTIONS = Object.freeze({
  scout: Object.freeze(["buzzer"]),
  "ranger-relay": Object.freeze(["oled-096", "buzzer"]),
  "ranger-bucks": Object.freeze(["oled-096", "buzzer"]),
  "command-core": Object.freeze(["oled-096", "lcd2004", "dht11", "buzzer"]),
  "command-gp": Object.freeze(["oled-096", "lcd2004", "dht11", "buzzer"])
});

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

function loadedModelKey(sku) {
  const value = String(sku || "").toLowerCase();
  if (value.startsWith("ranger-") && value.includes("-bucks-")) return "ranger-bucks";
  if (value.startsWith("ranger-")) return "ranger-relay";
  if (value.startsWith("command-") && value.includes("-gp-")) return "command-gp";
  if (value.startsWith("command-")) return "command-core";
  return "scout";
}

export function loadedComponentsForProduct(sku, selectedSkus = []) {
  const product = getProduct(sku);
  if (!product || product.offerType !== "Loaded") return [];

  const board = String(product.variant || "").includes("38") ? "38" : "30";
  const model = loadedModelKey(product.sku);
  const selected = new Set(Array.isArray(selectedSkus) ? selectedSkus.map((value) => String(value || "").trim().toLowerCase()) : []);
  const required = [{
    componentSku: `esp32-${board}-kit`,
    label: `${board}-pin ESP32 + matching breakout board`,
    description: "Installed, wired, checked, and loaded with WestTech Quick Start firmware.",
    unitAmount: "0.00",
    required: true,
    selected: true
  }];

  if (model === "ranger-relay") required.push({componentSku:"relay-module",label:"Relay module",description:"Installed and wired for the Ranger Relay path.",unitAmount:"0.00",required:true,selected:true});
  if (model === "ranger-bucks") required.push({componentSku:"buck-converter",label:"Buck converter",description:"Installed and wired for the Ranger Bucks power path.",unitAmount:"0.00",required:true,selected:true});
  if (model === "command-core" || model === "command-gp") {
    required.push({componentSku:"relay-module",label:"Relay module",description:"Installed and wired for the Command platform.",unitAmount:"0.00",required:true,selected:true});
    required.push({componentSku:"buck-converter",label:"Buck converter",description:"Installed and wired for the Command power path.",unitAmount:"0.00",required:true,selected:true});
  }

  const optional = (LOADED_MODEL_OPTIONS[model] || []).map((componentSku) => {
    const component = LOADED_OPTION_COMPONENTS[componentSku];
    return {...component, required:false, selected:selected.has(componentSku)};
  });
  return [...required, ...optional];
}

export function buildConfiguredProduct(sku, quantity, selectedComponentSkus = []) {
  const product = buildCheckoutProduct(sku, quantity);
  const loadedComponents = loadedComponentsForProduct(product.sku, selectedComponentSkus);
  const allowedOptional = new Set(loadedComponents.filter((component) => !component.required).map((component) => component.componentSku));
  const requested = Array.isArray(selectedComponentSkus) ? selectedComponentSkus.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean) : [];
  if (requested.some((componentSku) => !allowedOptional.has(componentSku))) {
    const error = new Error("Choose only components compatible with this enclosure.");
    error.status = 400;
    throw error;
  }
  const optionUnitAmount = money(loadedComponents.filter((component) => !component.required && component.selected).reduce((sum, component) => sum + Number(component.unitAmount || 0), 0));
  const qty = normalizeQuantity(quantity);
  return {
    ...product,
    baseUnitAmount: product.unitAmount,
    baseItemAmount: product.itemAmount,
    loadedComponents,
    loadedComponentsAmount: money(Number(optionUnitAmount) * qty),
    unitAmount: money(Number(product.unitAmount) + Number(optionUnitAmount)),
    itemAmount: money((Number(product.unitAmount) + Number(optionUnitAmount)) * qty)
  };
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


export function normalizeCartItems(rawItems) {
  if (!Array.isArray(rawItems)) return [];

  const combined = new Map();
  for (const entry of rawItems) {
    const sku = typeof entry?.sku === "string" ? entry.sku.trim().toLowerCase() : "";
    const product = getProduct(sku);
    if (!product) continue;

    const qty = normalizeQuantity(entry?.quantity || 1);
    const color = String(entry?.color || "White").trim().toLowerCase() === "black" ? "Black" : "White";
    const key = `${sku}::${color}`;
    const existing = combined.get(key) || { sku, color, quantity: 0 };
    existing.quantity += qty;
    combined.set(key, existing);
  }

  return Array.from(combined.values()).map((item) => ({
    sku: item.sku,
    color: item.color,
    quantity: normalizeQuantity(item.quantity)
  }));
}

export function buildCartCheckout(rawItems) {
  const items = normalizeCartItems(rawItems);
  if (!items.length) {
    throw new Error("Your cart is empty.");
  }

  const totalQuantity = items.reduce((sum, item) => sum + normalizeQuantity(item.quantity), 0);
  const shippingAmount = shippingAmountForQuantity(totalQuantity);
  const customQuoteOnly = isCustomQuoteQuantity(totalQuantity) || shippingAmount === null;

  const lines = items.map((item) => {
    const product = buildCheckoutProduct(item.sku, item.quantity);
    return {
      sku: product.sku,
      name: product.name,
      description: product.description,
      color: item.color,
      quantity: String(normalizeQuantity(item.quantity)),
      unitAmount: product.unitAmount,
      itemAmount: product.itemAmount,
      currency: product.currency,
      family: product.family,
      layout: product.layout,
      offerType: product.offerType,
      variant: product.variant
    };
  });

  const itemAmount = money(lines.reduce((sum, line) => sum + Number(line.itemAmount || 0), 0));
  const currency = lines[0]?.currency || PRODUCT.currency || "USD";
  const description = lines.length === 1
    ? `${lines[0].name} (${lines[0].color})`
    : `Mixed WestTech enclosure order (${totalQuantity} items)`;

  return {
    sku: "cart",
    name: lines.length === 1 ? lines[0].name : "WestTech Enclosure Cart",
    description,
    quantity: String(totalQuantity),
    unitAmount: itemAmount,
    itemAmount,
    shippingAmount: customQuoteOnly ? null : shippingAmount,
    currency,
    family: "Mixed",
    layout: "Mixed cart order",
    offerType: "Cart",
    variant: "Cart",
    customQuoteOnly,
    customQuoteMinQuantity: CUSTOM_QUOTE_MIN_QUANTITY,
    shippingTierSummary: shippingTiersSummary(),
    items: lines
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
