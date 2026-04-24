import { generateAccessToken, paypalBaseUrl } from "../../../../_lib/paypal.js";
import { jsonResponse, readJsonSafe } from "../../../../_lib/shared.js";

function extractAddress(data) {
  const shipping = data?.purchase_units?.[0]?.shipping || {};
  const payerName = data?.payer?.name || {};
  return {
    fullName: shipping?.name?.full_name || [payerName.given_name, payerName.surname].filter(Boolean).join(" "),
    address1: shipping?.address?.address_line_1 || "",
    address2: shipping?.address?.address_line_2 || "",
    city: shipping?.address?.admin_area_2 || "",
    state: shipping?.address?.admin_area_1 || "",
    postalCode: shipping?.address?.postal_code || "",
    countryCode: shipping?.address?.country_code || "US"
  };
}

export async function onRequestGet(context) {
  const orderID = context.params.orderID;
  if (!orderID) {
    return jsonResponse({ ok: false, message: "Missing PayPal order ID." }, 400);
  }

  try {
    const accessToken = await generateAccessToken(context.env);
    const response = await fetch(`${paypalBaseUrl(context.env.PAYPAL_ENV)}/v2/checkout/orders/${encodeURIComponent(orderID)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json"
      }
    });
    const data = await readJsonSafe(response);
    console.log("[paypal.orders.details] paypal-response", JSON.stringify({
      status: response.status,
      ok: response.ok,
      id: data.id || null,
      orderStatus: data.status || null,
      shipping: extractAddress(data)
    }));

    if (!response.ok) {
      return jsonResponse({
        ok: false,
        message: data.message || data.details?.[0]?.description || data.raw || "Could not load the PayPal order.",
        details: data.details || null,
        debug_id: data.debug_id || null
      }, response.status || 500);
    }

    return jsonResponse({
      ok: true,
      id: data.id,
      status: data.status || null,
      shippingAddress: extractAddress(data),
      payer: data.payer || null
    });
  } catch (error) {
    return jsonResponse({ ok: false, message: error.message || "Unexpected error while loading order details." }, 500);
  }
}
