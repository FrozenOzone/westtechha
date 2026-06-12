import { generateAccessToken, paypalBaseUrl } from "../../../../_lib/paypal.js";
import { jsonResponse, readJsonSafe } from "../../../../_lib/shared.js";
import { markOrderCaptured, requireOrdersDb } from "../../../../_lib/orders.js";
import { captureInventoryHold, releaseInventoryHold } from "../../../../_lib/inventory.js";

function extractShippingAddress(data) {
  const shipping = data?.purchase_units?.[0]?.shipping || {};
  const payerName = data?.payer?.name || {};
  return {
    fullName: shipping?.name?.full_name || [payerName.given_name, payerName.surname].filter(Boolean).join(" "),
    address1: shipping?.address?.address_line_1 || "",
    address2: shipping?.address?.address_line_2 || "",
    city: shipping?.address?.admin_area_2 || "",
    state: shipping?.address?.admin_area_1 || "",
    postalCode: shipping?.address?.postal_code || "",
    countryCode: shipping?.address?.country_code || ""
  };
}

function requireUsShippingAddress(address) {
  const countryCode = String(address?.countryCode || "").trim().toUpperCase();
  if (countryCode !== "US") {
    throw new Error("Website checkout currently supports U.S. shipping addresses only.");
  }
  if (!String(address?.address1 || "").trim()) throw new Error("PayPal did not provide a complete shipping street address.");
  if (!String(address?.city || "").trim()) throw new Error("PayPal did not provide a complete shipping city.");
  if (!String(address?.state || "").trim()) throw new Error("PayPal did not provide a complete shipping state.");
  if (!String(address?.postalCode || "").trim()) throw new Error("PayPal did not provide a complete shipping ZIP code.");
  return true;
}

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
    const orderDetailsResponse = await fetch(`${paypalBaseUrl(context.env.PAYPAL_ENV)}/v2/checkout/orders/${encodeURIComponent(orderID)}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json"
      }
    });

    const orderDetails = await readJsonSafe(orderDetailsResponse);

    if (!orderDetailsResponse.ok) {
      return jsonResponse({
        ok: false,
        message: orderDetails.message || orderDetails.details?.[0]?.description || orderDetails.raw || "Could not verify the PayPal shipping address before capture.",
        details: orderDetails.details || null,
        debug_id: orderDetails.debug_id || null
      }, orderDetailsResponse.status || 500);
    }

    try {
      requireUsShippingAddress(extractShippingAddress(orderDetails));
    } catch (addressError) {
      await releaseInventoryHold(context.env, {
        paypalOrderId: orderID,
        status: "ADDRESS_REJECTED",
        note: "Released inventory hold because PayPal shipping address is outside the supported U.S. shipping area."
      }).catch(() => {});
      return jsonResponse({
        ok: false,
        message: addressError.message || "Website checkout currently supports U.S. shipping addresses only."
      }, 400);
    }

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
