import { requireWestTechAdmin } from '../../../../_lib/admin.js';
import { listCoasterOrders } from '../../../../_lib/coaster-orders.js';
import { jsonResponse } from '../../../../_lib/shared.js';

export async function onRequestGet(context) {
  try {
    requireWestTechAdmin(context);
    const orders = await listCoasterOrders(context.env, 150);
    return jsonResponse({ ok: true, orders });
  } catch (error) {
    return jsonResponse({ ok: false, message: error?.message || 'Could not load coaster orders.' }, error?.status || 500);
  }
}
