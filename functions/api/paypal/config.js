const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store"
};

export async function onRequestGet(context) {
  const clientId = context.env.PAYPAL_CLIENT_ID;
  const currency = context.env.PAYPAL_CURRENCY || "USD";
  const env = (context.env.PAYPAL_ENV || "sandbox").toLowerCase();

  if (!clientId) {
    return new Response(JSON.stringify({
      ok: false,
      message: "Missing PAYPAL_CLIENT_ID environment variable."
    }), {
      status: 500,
      headers: JSON_HEADERS
    });
  }

  return new Response(JSON.stringify({
    ok: true,
    clientId,
    currency,
    env
  }), {
    status: 200,
    headers: JSON_HEADERS
  });
}
