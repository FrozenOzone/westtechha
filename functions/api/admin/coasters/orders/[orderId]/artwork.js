import { requireWestTechAdmin } from '../../../../../_lib/admin.js';
import { getCoasterOrderDetail, requireCoasterArtworkBucket } from '../../../../../_lib/coaster-orders.js';
import { jsonResponse } from '../../../../../_lib/shared.js';

export async function onRequestGet(context) {
  try {
    requireWestTechAdmin(context);
    const orderId = String(context.params?.orderId || '').trim();
    const order = await getCoasterOrderDetail(context.env, orderId);
    if (!order) return jsonResponse({ ok: false, message: 'Coaster order not found.' }, 404);
    const bucket = requireCoasterArtworkBucket(context.env);
    const object = await bucket.get(order.artworkObjectKey);
    if (!object) return jsonResponse({ ok: false, message: 'Artwork file not found.' }, 404);
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set('Cache-Control', 'private, no-store');
    headers.set('Content-Disposition', `inline; filename="${String(order.artworkFilename || 'artwork').replace(/["\r\n]/g, '')}"`);
    return new Response(object.body, { status: 200, headers });
  } catch (error) {
    return jsonResponse({ ok: false, message: error?.message || 'Could not load artwork.' }, error?.status || 500);
  }
}
