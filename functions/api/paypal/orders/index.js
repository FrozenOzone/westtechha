const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store"
};

const PRODUCT = Object.freeze({
  sku: "scout-30-ready",
  name: "Scout 30 - Ready",
  description: "Scout family launch product with 30-pin ready layout.",
  quantity: "1",
  itemAmount: "35.00",
  shippingAmount: "8.95",
  currency: "USD"
});

function sanitizeEnvValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function paypalBaseUrl(envValue) {
  return sanitizeEnvValue(envValue).toLowerCase() === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

async function readJsonSafe(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

async function generateAccessToken(env) {
  const clientId = sanitizeEnvValue(env.PAYPAL_CLIENT_ID);
  const clientSecret = sanitizeEnvValue(env.PAYPAL_CLIENT_SECRET);

  if (!clientId || !clientSecret) {
    throw new Error("Missing PAYPAL_CLIENT_ID or PAYPAL_CLIENT_SECRET environment variable.");
  }

  const auth = btoa(`${clientId}:${clientSecret}`);
  const response = await fetch(`${paypalBaseUrl(env.PAYPAL_ENV)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body: "grant_type=client_credentials"
  });

  const data = await readJsonSafe(response);

  if (!response.ok || !data.access_token) {
    const detail = data.error_description || data.error || data.message || data.raw || "Failed to generate PayPal access token.";
    throw new Error(`PayPal token request failed (${response.status}): ${detail}`);
  }

  return data.access_token;
}

function buildOrderPayload(env) {
  const currency = sanitizeEnvValue(env.PAYPAL_CURRENCY) || PRODUCT.currency;
  const itemValue = PRODUCT.itemAmount;
  const shippingValue = PRODUCT.shippingAmount;
  const totalValue = (Number(itemValue) + Number(shippingValue)).toFixed(2);

  return {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: PRODUCT.sku,
        description: PRODUCT.description,
        amount: {
          currency_code: currency,
          value: totalValue,
          breakdown: {
            item_total: {
              currency_code: currency,
              value: itemValue
            },
            shipping: {
              currency_code: currency,
              value: shippingValue
            }
          }
        },
        items: [
          {
            name: PRODUCT.name,
            sku: PRODUCT.sku,
            description: PRODUCT.description,
            quantity: PRODUCT.quantity,
            unit_amount: {
              currency_code: currency,
              value: itemValue
            },
            category: "PHYSICAL_GOODS"
          }
        ]
      }
    ]
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
      body: JSON.stringify(buildOrderPayload(context.env))
    });

    const data = await readJsonSafe(response);

    if (!response.ok || !data.id) {
      return new Response(JSON.stringify({
        ok: false,
        message: data.message || data.details?.[0]?.description || data.raw || "Could not create the PayPal order.",
        details: data.details || null,
        debug_id: data.debug_id || null
      }), {
        status: response.status || 500,
        headers: JSON_HEADERS
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      id: data.id,
      status: data.status || null
    }), {
      status: 200,
      headers: JSON_HEADERS
    });
  } catch (error) {
    return new Response(JSON.stringify({
      ok: false,
      message: error.message || "Unexpected error while creating the PayPal order."
    }), {
      status: 500,
      headers: JSON_HEADERS
    });
  }
}
