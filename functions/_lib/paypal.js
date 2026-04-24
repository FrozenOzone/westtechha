import { readJsonSafe, sanitizeEnvValue } from "./shared.js";

export function paypalBaseUrl(envValue) {
  return sanitizeEnvValue(envValue).toLowerCase() === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";
}

export async function generateAccessToken(env) {
  const clientId = sanitizeEnvValue(env.PAYPAL_CLIENT_ID);
  const clientSecret = sanitizeEnvValue(env.PAYPAL_CLIENT_SECRET);
  const envName = (sanitizeEnvValue(env.PAYPAL_ENV) || "sandbox").toLowerCase();

  console.log("[paypal.generateAccessToken] start", JSON.stringify({
    env: envName,
    hasClientId: Boolean(clientId),
    hasClientSecret: Boolean(clientSecret),
    baseUrl: paypalBaseUrl(envName)
  }));

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
  console.log("[paypal.generateAccessToken] response", JSON.stringify({
    status: response.status,
    ok: response.ok,
    hasAccessToken: Boolean(data.access_token),
    error: data.error || null,
    errorDescription: data.error_description || null,
    message: data.message || data.raw || null
  }));

  if (!response.ok || !data.access_token) {
    const detail = data.error_description || data.error || data.message || data.raw || "Failed to generate PayPal access token.";
    throw new Error(`PayPal token request failed (${response.status}): ${detail}`);
  }

  return data.access_token;
}
