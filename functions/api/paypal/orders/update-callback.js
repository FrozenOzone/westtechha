import { PRODUCT } from "../../../_lib/product.js";
import { sanitizeEnvValue } from "../../../_lib/shared.js";
import { buildTaxQuote } from "../../../_lib/tax.js";

function normalizeCallbackAddress(shippingAddress) {
  return {
    address1: shippingAddress?.address_line_1 || "",
    address2: shippingAddress?.address_line_2 || "",
    city: shippingAddress?.admin_area_2 || "",
    state: shippingAddress?.admin_area_1 || "",
    postalCode: shippingAddress?.postal_code || "",
    countryCode: shippingAddress?.country_code || "US"
  };
}

function summarizeIncomingBody(body) {
  return {
    id: body?.id || null,
    hasShippingAddress: Boolean(body?.shipping_address),
    shippingAddress: {
      address_line_1: body?.shipping_address?.address_line_1 || null,
      address_line_2: body?.shipping_address?.address_line_2 || null,
      admin_area_2: body?.shipping_address?.admin_area_2 || null,
      admin_area_1: body?.shipping_address?.admin_area_1 || null,
      postal_code: body?.shipping_address?.postal_code || null,
      country_code: body?.shipping_address?.country_code || null
    },
    payerId: body?.payer?.payer_id || null,
    hasPurchaseUnits: Array.isArray(body?.purchase_units),
    purchaseUnitCount: Array.isArray(body?.purchase_units) ? body.purchase_units.length : 0
  };
}

function successResponse(orderId, quote, currency) {
  return new Response(JSON.stringify({
    id: orderId,
    purchase_units: [
      {
        reference_id: PRODUCT.sku,
        amount: {
          currency_code: currency,
          value: quote.totalAmount,
          breakdown: {
            item_total: {
              currency_code: currency,
              value: quote.taxableAmount
            },
            tax_total: {
              currency_code: currency,
              value: quote.taxAmount
            },
            shipping: {
              currency_code: currency,
              value: quote.shippingAmount
            }
          }
        },
        shipping_options: [
          {
            id: "flat-shipping",
            amount: {
              currency_code: currency,
              value: quote.shippingAmount
            },
            type: "SHIPPING",
            label: "Flat Shipping",
            selected: true
          }
        ]
      }
    ]
  }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}

function declineResponse(issue, extra = {}) {
  console.log("[paypal.orders.update-callback] decline", JSON.stringify({ issue, ...extra }));
  return new Response(JSON.stringify({
    name: "UNPROCESSABLE_ENTITY",
    details: [{ issue }]
  }), {
    status: 422,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    console.log("[paypal.orders.update-callback] incoming", JSON.stringify({
      env: (sanitizeEnvValue(context.env.PAYPAL_ENV) || "sandbox").toLowerCase(),
      hasGisKey: Boolean(sanitizeEnvValue(context.env.CO_GIS_API_KEY)),
      hasProductServiceId: Boolean(sanitizeEnvValue(context.env.CO_GIS_PRODUCT_SERVICE_ID)),
      payload: summarizeIncomingBody(body)
    }));

    const orderId = body?.id || "";
    const shippingAddress = normalizeCallbackAddress(body?.shipping_address || {});
    const currency = (sanitizeEnvValue(context.env.PAYPAL_CURRENCY) || PRODUCT.currency) || PRODUCT.currency;

    console.log("[paypal.orders.update-callback] normalized-address", JSON.stringify(shippingAddress));

    if ((shippingAddress.countryCode || "US").toUpperCase() !== "US") {
      return declineResponse("COUNTRY_ERROR", { shippingAddress });
    }

    if (!shippingAddress.state) {
      return declineResponse("STATE_ERROR", { shippingAddress });
    }

    if (!shippingAddress.postalCode) {
      return declineResponse("ZIP_ERROR", { shippingAddress });
    }

    if (shippingAddress.state.toUpperCase() === "CO" && !shippingAddress.address1) {
      return declineResponse("ADDRESS_ERROR", { reason: "Missing address1 for Colorado", shippingAddress });
    }

    const quote = await buildTaxQuote(context.env, shippingAddress, {
      taxableAmount: PRODUCT.itemAmount,
      shippingAmount: PRODUCT.shippingAmount
    });

    console.log("[paypal.orders.update-callback] quote", JSON.stringify({
      orderId,
      currency,
      quote: {
        source: quote.source,
        isColorado: quote.isColorado,
        apiAddress: quote.apiAddress,
        jurisdictionCode: quote.jurisdictionCode,
        productService: quote.productService,
        taxRate: quote.taxRate,
        taxAmount: quote.taxAmount,
        subtotal: quote.subtotal,
        totalAmount: quote.totalAmount,
        salesTaxCount: Array.isArray(quote.salesTax) ? quote.salesTax.length : 0
      }
    }));

    console.log("[paypal.orders.update-callback] responding-success", JSON.stringify({
      orderId,
      totalAmount: quote.totalAmount,
      taxAmount: quote.taxAmount,
      shippingAmount: quote.shippingAmount
    }));
    return successResponse(orderId, quote, currency);
  } catch (error) {
    const message = (error && error.message) || "";
    console.log("[paypal.orders.update-callback] error", JSON.stringify({ message }));

    if (message.includes("United States")) {
      return declineResponse("COUNTRY_ERROR", { message });
    }
    if (message.includes("contiguous") || message.includes("state")) {
      return declineResponse("STATE_ERROR", { message });
    }
    if (message.includes("ZIP")) {
      return declineResponse("ZIP_ERROR", { message });
    }
    if (message.includes("street address") || message.includes("Colorado tax lookup")) {
      return declineResponse("ADDRESS_ERROR", { message });
    }

    return declineResponse("ADDRESS_ERROR", { message });
  }
}
