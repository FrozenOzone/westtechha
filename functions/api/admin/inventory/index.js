import { getInventoryDb } from "../../../_lib/inventory.js";
import { jsonResponse, sanitizeEnvValue } from "../../../_lib/shared.js";

function requireAdmin(context) {
  const expected = sanitizeEnvValue(context.env.WESTTECH_ADMIN_TOKEN);
  const header = sanitizeEnvValue(context.request.headers.get("Authorization"));
  const provided = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";

  if (!expected) {
    throw new Error("Missing WESTTECH_ADMIN_TOKEN secret.");
  }
  if (!provided || provided !== expected) {
    const error = new Error("Unauthorized inventory request.");
    error.status = 401;
    throw error;
  }
}

async function listInventory(db) {
  const result = await db.prepare(`
    SELECT component_sku AS componentSku, name, stock_qty AS stockQty,
           low_stock_threshold AS lowStockThreshold, is_active AS isActive, updated_at AS updatedAt
    FROM component_inventory
    ORDER BY component_sku
  `).all();

  return Array.isArray(result?.results) ? result.results : [];
}

async function updateInventory(db, item) {
  const componentSku = sanitizeEnvValue(item?.componentSku || item?.component_sku);
  const stockQty = Number.parseInt(item?.stockQty ?? item?.stock_qty, 10);

  if (!componentSku) throw new Error("Missing componentSku.");
  if (!Number.isFinite(stockQty) || stockQty < 0) throw new Error(`Invalid stockQty for ${componentSku}.`);

  const existing = await db.prepare("SELECT component_sku FROM component_inventory WHERE component_sku = ? LIMIT 1")
    .bind(componentSku)
    .first();

  if (!existing) throw new Error(`Unknown component SKU: ${componentSku}`);

  await db.prepare(`
    UPDATE component_inventory
    SET stock_qty = ?, updated_at = CURRENT_TIMESTAMP
    WHERE component_sku = ?
  `).bind(stockQty, componentSku).run();

  return { componentSku, stockQty };
}

export async function onRequestGet(context) {
  try {
    requireAdmin(context);
    const db = getInventoryDb(context.env);
    if (!db) return jsonResponse({ ok: false, message: "Missing INVENTORY_DB or ORDERS_DB D1 binding." }, 500);

    return jsonResponse({ ok: true, inventory: await listInventory(db) });
  } catch (error) {
    return jsonResponse({ ok: false, message: error.message || "Could not load inventory." }, error.status || 500);
  }
}

export async function onRequestPost(context) {
  try {
    requireAdmin(context);
    const db = getInventoryDb(context.env);
    if (!db) return jsonResponse({ ok: false, message: "Missing INVENTORY_DB or ORDERS_DB D1 binding." }, 500);

    const body = await context.request.json();
    const items = Array.isArray(body?.items) ? body.items : [body];
    const updated = [];

    for (const item of items) {
      updated.push(await updateInventory(db, item));
    }

    return jsonResponse({ ok: true, updated, inventory: await listInventory(db) });
  } catch (error) {
    return jsonResponse({ ok: false, message: error.message || "Could not update inventory." }, error.status || 500);
  }
}
