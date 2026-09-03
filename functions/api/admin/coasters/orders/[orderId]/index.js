import { requireWestTechAdmin } from '../../../../../_lib/admin.js';
import { addCoasterWorkLog, getCoasterOrderDetail, saveCoasterReview } from '../../../../../_lib/coaster-orders.js';
import { jsonResponse } from '../../../../../_lib/shared.js';
import { sendCoasterCustomerEmail } from '../../../../../_lib/coaster-email.js';

export async function onRequestGet(context) {
  try {
    requireWestTechAdmin(context);
    const orderId = String(context.params?.orderId || '').trim();
    const order = await getCoasterOrderDetail(context.env, orderId);
    if (!order) return jsonResponse({ ok: false, message: 'Coaster order not found.' }, 404);
    delete order.artworkObjectKey;
    delete order.designSnapshotObjectKey;
    delete order.proofObjectKey;
    return jsonResponse({ ok: true, order });
  } catch (error) {
    return jsonResponse({ ok: false, message: error?.message || 'Could not load the coaster order.' }, error?.status || 500);
  }
}

export async function onRequestPost(context) {
  try {
    requireWestTechAdmin(context);
    const orderId = String(context.params?.orderId || '').trim();
    const body = await context.request.json();
    const before = body?.action === 'saveReview' ? await getCoasterOrderDetail(context.env, orderId) : null;
    let order = null;
    let email = null;
    if (body?.action === 'saveReview') {
      order = await saveCoasterReview(context.env, orderId, body);
      if(order && before && String(order.status)!==String(before.status)){
        const type = order.status==='READY_FOR_PICKUP'?'READY_FOR_PICKUP':order.status==='SHIPPED'?'SHIPPED':order.status==='COMPLETED'?'COMPLETED':'';
        if(type)email=await sendCoasterCustomerEmail(context.env,{type,order,requestUrl:context.request.url});
      }
    }
    else if (body?.action === 'addWork') order = await addCoasterWorkLog(context.env, orderId, body);
    else return jsonResponse({ ok: false, message: 'Unknown admin action.' }, 400);
    if (!order) return jsonResponse({ ok: false, message: 'Coaster order not found.' }, 404);
    if(email)order=await getCoasterOrderDetail(context.env, orderId)||order;
    delete order.artworkObjectKey;
    delete order.designSnapshotObjectKey;
    delete order.proofObjectKey;
    return jsonResponse({ ok: true, order, email });
  } catch (error) {
    return jsonResponse({ ok: false, message: error?.message || 'Could not update the coaster order.' }, error?.status || 500);
  }
}
