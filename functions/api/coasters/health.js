import { jsonResponse } from '../../_lib/shared.js';

export async function onRequestGet(context) {
  const result = {
    ok: true,
    environment: 'coaster-preview-health',
    ordersDbBound: !!context.env?.ORDERS_DB,
    artworkBucketBound: !!context.env?.COASTER_ARTWORK,
    resendConfigured: !!context.env?.RESEND_API_KEY,
    paypalConfigured: !!(context.env?.PAYPAL_CLIENT_ID && context.env?.PAYPAL_CLIENT_SECRET),
    adminTokenConfigured: !!context.env?.WESTTECH_ADMIN_TOKEN,
    schemaOk: false,
    coasterTables: []
  };

  if (result.ordersDbBound) {
    try {
      const rows = await context.env.ORDERS_DB.prepare(
        "SELECT name FROM sqlite_schema WHERE type='table' AND name LIKE 'coaster_%' ORDER BY name"
      ).all();
      result.coasterTables = (rows?.results || []).map(row => row.name);
      const required = [
        'coaster_order_counters',
        'coaster_order_events',
        'coaster_order_work_log',
        'coaster_orders',
        'coaster_paypal_webhook_events'
      ];
      result.schemaOk = required.every(name => result.coasterTables.includes(name));
    } catch (error) {
      result.ok = false;
      result.dbError = String(error?.message || error).slice(0, 300);
    }
  }

  result.ok = result.ok && result.ordersDbBound && result.artworkBucketBound && result.schemaOk;
  return jsonResponse(result, result.ok ? 200 : 503);
}
