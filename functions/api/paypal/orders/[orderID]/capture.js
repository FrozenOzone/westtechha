const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store"
};

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

export async function onRequestPost(context) {
  const orderID = context.params.orderID;

  if (!orderID) {
    return new Response(JSON.stringify({
      ok: false,
      message: "Missing PayPal order ID."
    }), {
      status: 400,
      headers: JSON_HEADERS
    });
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
      return new Response(JSON.stringify({
        ok: false,
        message: data.message || data.details?.[0]?.description || data.raw || "Could not capture the PayPal order.",
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
      status: data.status || null,
      payer: data.payer || null,
      purchase_units: data.purchase_units || null
    }), {
      status: 200,
      headers: JSON_HEADERS
    });
  } catch (error) {
    return new Response(JSON.stringify({
      ok: false,
      message: error.message || "Unexpected error while capturing the PayPal order."
    }), {
      status: 500,
      headers: JSON_HEADERS
    });
  }
}
