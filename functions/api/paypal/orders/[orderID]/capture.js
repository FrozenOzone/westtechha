import { generateAccessToken, paypalBaseUrl } from "../../../../_lib/paypal.js";
import { jsonResponse, readJsonSafe } from "../../../../_lib/shared.js";
import { markOrderCaptured, requireOrdersDb } from "../../../../_lib/orders.js";
import { captureInventoryHold } from "../../../../_lib/inventory.js";

export async function onRequestPost(context) {
  const orderID = context.params.orderID;

  if (!orderID) {
    return jsonResponse({
      ok: false,
      message: "Missing PayPal order ID."
    }, 400);
  }

  try {
    const accessToken = await generateAccessToken(context.env);
    const response = await fetch(`${paypalBaseUrl(context.env.PAYPAL_ENV)}/v2/checkout/orders/${encodeURIComponent(orderID)}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      }
    });

    const data = await readJsonSafe(response);

    if (!response.ok) {
      return jsonResponse({
        ok: false,
        message: data.message || data.details?.[0]?.description || data.raw || "Could not capture the PayPal order.",
        details: data.details || null,
        debug_id: data.debug_id || null
      }, response.status || 500);
    }

    const ordersDb = requireOrdersDb(context.env);
    const orderRecord = await markOrderCaptured(ordersDb, { paypalOrderId: orderID, captureData: data });
    await captureInventoryHold(context.env, { paypalOrderId: orderID, invoiceId: orderRecord?.invoiceId || null }).catch(() => {});

    return jsonResponse({
      ok: true,
      id: data.id,
      status: data.status || null,
      invoiceId: orderRecord?.invoiceId || null,
      customId: orderRecord?.customId || null,
      captureId: orderRecord?.captureId || null,
      payer: data.payer || null,
      purchase_units: data.purchase_units || null
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      message: error.message || "Unexpected error while capturing the PayPal order."
    }, 500);
  }
}
