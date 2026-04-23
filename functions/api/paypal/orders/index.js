import { generateAccessToken, paypalBaseUrl } from "../../../_lib/paypal.js";
import { PRODUCT } from "../../../_lib/product.js";
import { jsonResponse, readJsonSafe, sanitizeEnvValue } from "../../../_lib/shared.js";

function baseAmountBreakdown(currency) {
  return {
    currency_code: currency,
    value: (Number(PRODUCT.itemAmount) + Number(PRODUCT.shippingAmount)).toFixed(2),
    breakdown: {
      item_total: {
        currency_code: currency,
        value: PRODUCT.itemAmount
      },
      shipping: {
        currency_code: currency,
        value: PRODUCT.shippingAmount
      },
      tax_total: {
        currency_code: currency,
        value: "0.00"
      }
    }
  };
}

function buildOrderPayload(context) {
  const currency = sanitizeEnvValue(context.env.PAYPAL_CURRENCY) || PRODUCT.currency;
  const callbackUrl = new URL("/api/paypal/orders/update-callback", context.request.url).toString();

  return {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: PRODUCT.sku,
        description: PRODUCT.description,
        amount: baseAmountBreakdown(currency),
        items: [
          {
            name: PRODUCT.name,
            sku: PRODUCT.sku,
            description: PRODUCT.description,
            quantity: PRODUCT.quantity,
            unit_amount: {
              currency_code: currency,
              value: PRODUCT.itemAmount
            },
            tax: {
              currency_code: currency,
              value: "0.00"
            },
            category: "PHYSICAL_GOODS"
          }
        ]
      }
    ],
    payment_source: {
      paypal: {
        experience_context: {
          shipping_preference: "GET_FROM_FILE",
          user_action: "PAY_NOW",
          order_update_callback_config: {
            callback_events: ["SHIPPING_ADDRESS"],
            callback_url: callbackUrl
          }
        }
      }
    }
  };
}

export async function onRequestPost(context) {
  try {
    const accessToken = await generateAccessToken(context.env);
    const response = await fetch(`${paypalBaseUrl(context.env.PAYPAL_ENV)}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify(buildOrderPayload(context))
    });

    const data = await readJsonSafe(response);

    if (!response.ok || !data.id) {
      return jsonResponse({
        ok: false,
        message: data.message || data.details?.[0]?.description || data.raw || "Could not create the PayPal order.",
        details: data.details || null,
        debug_id: data.debug_id || null
      }, response.status || 500);
    }

    return jsonResponse({
      ok: true,
      id: data.id,
      status: data.status || null
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      message: error.message || "Unexpected error while creating the PayPal order."
    }, 500);
  }
}
