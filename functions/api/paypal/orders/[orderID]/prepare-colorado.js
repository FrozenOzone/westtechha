import { generateAccessToken, paypalBaseUrl } from "../../../../_lib/paypal.js";
import { getProduct, PRODUCT } from "../../../../_lib/product.js";
import { requireOrdersDb, updateOrderForColorado } from "../../../../_lib/orders.js";
import { buildTaxQuote, validateShippingAddress } from "../../../../_lib/tax.js";
import { jsonResponse, readJsonSafe, sanitizeEnvValue } from "../../../../_lib/shared.js";

function patchBody(referenceId, quote, currency, shippingAddress, product) {
  return [
    {
      op: "replace",
      path: `/purchase_units/@reference_id=='${referenceId}'/amount`,
      value: {
        currency_code: currency,
        value: quote.totalAmount,
        breakdown: {
          item_total: { currency_code: currency, value: quote.taxableAmount },
          shipping: { currency_code: currency, value: quote.shippingAmount },
          tax_total: { currency_code: currency, value: quote.taxAmount }
        }
      }
    },
    {
      op: "replace",
      path: `/purchase_units/@reference_id=='${referenceId}'/items`,
      value: [
        {
          name: product.name,
          sku: product.sku,
          description: product.description,
          quantity: product.quantity,
          unit_amount: { currency_code: currency, value: product.itemAmount },
          tax: { currency_code: currency, value: quote.taxAmount },
          category: "PHYSICAL_GOODS"
        }
      ]
    },
    {
      op: "replace",
      path: `/purchase_units/@reference_id=='${referenceId}'/shipping/address`,
      value: {
        address_line_1: shippingAddress.address1,
        address_line_2: shippingAddress.address2 || undefined,
        admin_area_2: shippingAddress.city,
        admin_area_1: shippingAddress.state,
        postal_code: shippingAddress.postalCode,
        country_code: shippingAddress.countryCode
      }
    },
    {
      op: "replace",
      path: `/purchase_units/@reference_id=='${referenceId}'/shipping/name`,
      value: {
        full_name: shippingAddress.fullName || "PayPal Buyer"
      }
    }
  ];
}

export async function onRequestPost(context) {
  const orderID = context.params.orderID;
  if (!orderID) {
    return jsonResponse({ ok: false, message: "Missing PayPal order ID." }, 400);
  }

  try {
    const body = await context.request.json();
    const requestedSku = sanitizeEnvValue(body?.sku) || PRODUCT.sku;
    const product = getProduct(requestedSku);

    if (!product) {
      return jsonResponse({ ok: false, message: `Unknown product SKU: ${requestedSku}` }, 400);
    }

    const shippingAddress = validateShippingAddress({
      fullName: body?.fullName,
      address1: body?.address1,
      address2: body?.address2,
      city: body?.city,
      state: body?.state,
      postalCode: body?.postalCode,
      countryCode: body?.countryCode || "US"
    });

    if (shippingAddress.state !== "CO") {
      return jsonResponse({ ok: false, message: "Colorado confirmation is only required for Colorado addresses." }, 400);
    }

    const quote = await buildTaxQuote(context.env, shippingAddress, {
      taxableAmount: product.itemAmount,
      shippingAmount: product.shippingAmount
    });

    const currency = sanitizeEnvValue(context.env.PAYPAL_CURRENCY) || product.currency;
    const referenceId = product.sku || "default";
    const accessToken = await generateAccessToken(context.env);
    const patch = patchBody(referenceId, quote, currency, shippingAddress, product);

    console.log("[paypal.orders.prepare-colorado] patch-request", JSON.stringify({
      orderID,
      sku: product.sku,
      shippingAddress,
      quote: { taxAmount: quote.taxAmount, totalAmount: quote.totalAmount },
      patch
    }));

    const response = await fetch(`${paypalBaseUrl(context.env.PAYPAL_ENV)}/v2/checkout/orders/${encodeURIComponent(orderID)}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(patch)
    });

    const data = await readJsonSafe(response);
    console.log("[paypal.orders.prepare-colorado] patch-response", JSON.stringify({
      status: response.status,
      ok: response.ok,
      data
    }));

    if (!response.ok) {
      return jsonResponse({
        ok: false,
        message: data.message || data.details?.[0]?.description || data.raw || "Could not update the PayPal order for Colorado tax.",
        details: data.details || null,
        debug_id: data.debug_id || null
      }, response.status || 500);
    }

    const ordersDb = requireOrdersDb(context.env);
    await updateOrderForColorado(ordersDb, { paypalOrderId: orderID, quote, shippingAddress });

    return jsonResponse({ ok: true, quote, shippingAddress, sku: product.sku });
  } catch (error) {
    return jsonResponse({ ok: false, message: error.message || "Unexpected error while preparing the Colorado order." }, 500);
  }
}
