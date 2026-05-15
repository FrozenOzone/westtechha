import { PRODUCTS } from "./product.js";

const LOW_STOCK_MAX = 4;
const HOLD_MINUTES = 90;

function normalizeQuantity(quantity) {
  const parsed = Number.parseInt(quantity, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return 1;
  return parsed;
}

function inventoryStatus(maxAvailable) {
  const qty = Number(maxAvailable);
  if (!Number.isFinite(qty) || qty < 1) {
    return { status: "temporarily-unavailable", label: "Temporarily unavailable" };
  }
  if (qty <= LOW_STOCK_MAX) {
    return { status: "low-stock", label: "Low stock" };
  }
  return { status: "in-stock", label: "In stock" };
}

function isoDateMinutesFromNow(minutes) {
  return new Date(Date.now() + Number(minutes || 0) * 60 * 1000).toISOString();
}

function isMissingTableError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return message.includes("no such table") || message.includes("not found") || message.includes("does not exist");
}

export function getInventoryDb(env) {
  return env?.INVENTORY_DB || env?.ORDERS_DB || null;
}

export function inventoryUnavailable(message = "Inventory is not configured yet.") {
  return {
    configured: false,
    enforced: false,
    status: "unknown",
    label: "Availability pending",
    canFulfill: true,
    maxAvailable: null,
    message
  };
}

async function loadRequirements(db, productSku) {
  const result = await db.prepare(`
    SELECT
      pc.product_sku AS productSku,
      pc.component_sku AS componentSku,
      pc.qty_required AS qtyRequired,
      ci.name AS componentName,
      ci.stock_qty AS stockQty,
      ci.is_active AS isActive
    FROM product_components pc
    LEFT JOIN component_inventory ci ON ci.component_sku = pc.component_sku
    WHERE pc.product_sku = ?
    ORDER BY pc.component_sku
  `).bind(productSku).all();

  return Array.isArray(result?.results) ? result.results : [];
}

export async function releaseExpiredInventoryHolds(db) {
  if (!db) return { released: 0 };

  const expiredResult = await db.prepare(`
    SELECT hold_id AS holdId, invoice_id AS invoiceId, paypal_order_id AS paypalOrderId,
           product_sku AS productSku, quantity AS quantity
    FROM inventory_holds
    WHERE status = 'ACTIVE' AND expires_at <= CURRENT_TIMESTAMP
    LIMIT 50
  `).all();

  const holds = Array.isArray(expiredResult?.results) ? expiredResult.results : [];
  let released = 0;

  for (const hold of holds) {
    await releaseInventoryHold(db, {
      invoiceId: hold.invoiceId,
      paypalOrderId: hold.paypalOrderId,
      status: "EXPIRED",
      note: "Released expired PayPal checkout inventory hold."
    });
    released += 1;
  }

  return { released };
}

export async function availabilityForProduct(envOrDb, productSku, quantity = 1) {
  const db = typeof envOrDb?.prepare === "function" ? envOrDb : getInventoryDb(envOrDb);
  if (!db) return inventoryUnavailable();

  const sku = typeof productSku === "string" ? productSku.trim().toLowerCase() : "";
  if (!PRODUCTS[sku]) {
    return {
      configured: true,
      enforced: false,
      status: "unknown",
      label: "Availability pending",
      canFulfill: false,
      maxAvailable: 0,
      message: `Unknown product SKU: ${sku || "missing"}`
    };
  }

  try {
    await releaseExpiredInventoryHolds(db).catch(() => {});
    const requirements = await loadRequirements(db, sku);

    if (!requirements.length) {
      return inventoryUnavailable("No inventory recipe exists for this product yet.");
    }

    const maxAvailable = requirements.reduce((currentMax, row) => {
      const active = Number(row.isActive ?? 1) === 1;
      const stockQty = active ? Number(row.stockQty ?? 0) : 0;
      const qtyRequired = Number(row.qtyRequired ?? 0);
      const componentAvailable = qtyRequired > 0 ? Math.floor(stockQty / qtyRequired) : 0;
      return Math.min(currentMax, componentAvailable);
    }, Number.POSITIVE_INFINITY);

    const safeMax = Number.isFinite(maxAvailable) ? Math.max(0, maxAvailable) : 0;
    const status = inventoryStatus(safeMax);
    const requestedQty = normalizeQuantity(quantity);

    return {
      configured: true,
      enforced: true,
      status: status.status,
      label: status.label,
      canFulfill: safeMax >= requestedQty,
      maxAvailable: safeMax,
      requestedQuantity: requestedQty,
      lowStockMax: LOW_STOCK_MAX,
      components: requirements.map((row) => ({
        sku: row.componentSku,
        name: row.componentName || row.componentSku,
        qtyRequired: Number(row.qtyRequired || 0),
        stockQty: Number(row.stockQty || 0)
      }))
    };
  } catch (error) {
    if (isMissingTableError(error)) {
      return inventoryUnavailable("Inventory tables are not installed yet.");
    }
    throw error;
  }
}

export async function availabilityForProducts(envOrDb, products = PRODUCTS, quantity = 1) {
  const db = typeof envOrDb?.prepare === "function" ? envOrDb : getInventoryDb(envOrDb);
  if (!db) return Object.fromEntries(Object.keys(products).map((sku) => [sku, inventoryUnavailable()]));

  const entries = [];
  for (const sku of Object.keys(products)) {
    entries.push([sku, await availabilityForProduct(db, sku, quantity)]);
  }
  return Object.fromEntries(entries);
}

async function updateComponentStock(db, componentSku, delta) {
  const row = await db.prepare("SELECT stock_qty AS stockQty FROM component_inventory WHERE component_sku = ? LIMIT 1")
    .bind(componentSku)
    .first();

  if (!row) return false;

  const next = Number(row.stockQty || 0) + Number(delta || 0);
  if (!Number.isFinite(next) || next < 0) return false;

  await db.prepare("UPDATE component_inventory SET stock_qty = ?, updated_at = CURRENT_TIMESTAMP WHERE component_sku = ?")
    .bind(next, componentSku)
    .run();

  return true;
}

export async function reserveInventoryForProduct(envOrDb, product, meta = {}) {
  const db = typeof envOrDb?.prepare === "function" ? envOrDb : getInventoryDb(envOrDb);
  if (!db) return { reserved: false, skipped: true, message: "Inventory database is not configured." };

  const productSku = String(product?.sku || "").trim().toLowerCase();
  const quantity = normalizeQuantity(product?.quantity || meta.quantity || 1);
  const invoiceId = meta.invoiceId || null;
  const holdId = meta.holdId || (invoiceId ? `hold-${invoiceId}` : `hold-${Date.now()}`);
  const expiresAt = isoDateMinutesFromNow(HOLD_MINUTES);

  await releaseExpiredInventoryHolds(db).catch(() => {});

  const availability = await availabilityForProduct(db, productSku, quantity);
  if (!availability.configured || !availability.enforced) {
    return { reserved: false, skipped: true, availability, message: availability.message || "Inventory is not enforced for this product." };
  }

  if (!availability.canFulfill) {
    return {
      reserved: false,
      skipped: false,
      availability,
      message: `${product?.name || "This product"} is temporarily unavailable or does not have enough stock for the selected quantity.`
    };
  }

  const reservedComponents = [];

  try {
    for (const requirement of availability.components || []) {
      const needed = Number(requirement.qtyRequired || 0) * quantity;
      if (needed <= 0) continue;
      const ok = await updateComponentStock(db, requirement.sku, -needed);
      if (!ok) throw new Error(`Not enough inventory for ${requirement.name || requirement.sku}.`);
      reservedComponents.push({ ...requirement, quantity: needed });

      await db.prepare(`
        INSERT INTO inventory_movements (
          movement_type, component_sku, product_sku, quantity_delta,
          invoice_id, paypal_order_id, note
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(
        "RESERVE",
        requirement.sku,
        productSku,
        -needed,
        invoiceId,
        meta.paypalOrderId || null,
        `Reserved for ${product?.name || productSku}`
      ).run();
    }

    await db.prepare(`
      INSERT INTO inventory_holds (
        hold_id, invoice_id, paypal_order_id, product_sku, quantity, status, expires_at
      ) VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)
    `).bind(holdId, invoiceId, meta.paypalOrderId || null, productSku, quantity, expiresAt).run();

    return { reserved: true, skipped: false, holdId, invoiceId, productSku, quantity, expiresAt, components: reservedComponents };
  } catch (error) {
    for (const component of reservedComponents) {
      await updateComponentStock(db, component.sku, component.quantity).catch(() => {});
    }
    throw error;
  }
}

export async function attachPayPalOrderToInventoryHold(envOrDb, { invoiceId, paypalOrderId }) {
  const db = typeof envOrDb?.prepare === "function" ? envOrDb : getInventoryDb(envOrDb);
  if (!db || !invoiceId || !paypalOrderId) return;

  await db.prepare(`
    UPDATE inventory_holds
    SET paypal_order_id = ?, updated_at = CURRENT_TIMESTAMP
    WHERE invoice_id = ? AND status = 'ACTIVE'
  `).bind(paypalOrderId, invoiceId).run();

  await db.prepare(`
    UPDATE inventory_movements
    SET paypal_order_id = ?
    WHERE invoice_id = ? AND paypal_order_id IS NULL
  `).bind(paypalOrderId, invoiceId).run();
}

export async function releaseInventoryHold(envOrDb, { invoiceId, paypalOrderId, status = "RELEASED", note = "Released inventory hold." }) {
  const db = typeof envOrDb?.prepare === "function" ? envOrDb : getInventoryDb(envOrDb);
  if (!db) return { released: false, skipped: true };

  let hold = null;
  if (invoiceId) {
    hold = await db.prepare(`
      SELECT hold_id AS holdId, invoice_id AS invoiceId, paypal_order_id AS paypalOrderId,
             product_sku AS productSku, quantity AS quantity
      FROM inventory_holds
      WHERE invoice_id = ? AND status = 'ACTIVE'
      LIMIT 1
    `).bind(invoiceId).first();
  }

  if (!hold && paypalOrderId) {
    hold = await db.prepare(`
      SELECT hold_id AS holdId, invoice_id AS invoiceId, paypal_order_id AS paypalOrderId,
             product_sku AS productSku, quantity AS quantity
      FROM inventory_holds
      WHERE paypal_order_id = ? AND status = 'ACTIVE'
      LIMIT 1
    `).bind(paypalOrderId).first();
  }

  if (!hold) return { released: false, skipped: false };

  const requirements = await loadRequirements(db, hold.productSku);
  const quantity = normalizeQuantity(hold.quantity);

  for (const requirement of requirements) {
    const restoreQty = Number(requirement.qtyRequired || 0) * quantity;
    if (restoreQty <= 0) continue;
    await updateComponentStock(db, requirement.componentSku, restoreQty);
    await db.prepare(`
      INSERT INTO inventory_movements (
        movement_type, component_sku, product_sku, quantity_delta,
        invoice_id, paypal_order_id, note
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      status,
      requirement.componentSku,
      hold.productSku,
      restoreQty,
      hold.invoiceId,
      hold.paypalOrderId || paypalOrderId || null,
      note
    ).run();
  }

  await db.prepare(`
    UPDATE inventory_holds
    SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE hold_id = ?
  `).bind(status, hold.holdId).run();

  return { released: true, holdId: hold.holdId, status };
}

export async function captureInventoryHold(envOrDb, { paypalOrderId, invoiceId }) {
  const db = typeof envOrDb?.prepare === "function" ? envOrDb : getInventoryDb(envOrDb);
  if (!db) return { captured: false, skipped: true };

  const hold = paypalOrderId
    ? await db.prepare("SELECT hold_id AS holdId FROM inventory_holds WHERE paypal_order_id = ? AND status = 'ACTIVE' LIMIT 1").bind(paypalOrderId).first()
    : invoiceId
      ? await db.prepare("SELECT hold_id AS holdId FROM inventory_holds WHERE invoice_id = ? AND status = 'ACTIVE' LIMIT 1").bind(invoiceId).first()
      : null;

  if (!hold) return { captured: false, skipped: false };

  await db.prepare(`
    UPDATE inventory_holds
    SET status = 'CAPTURED', updated_at = CURRENT_TIMESTAMP
    WHERE hold_id = ?
  `).bind(hold.holdId).run();

  return { captured: true, holdId: hold.holdId };
}
