import { PRODUCT } from "../../../_lib/product.js";
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

function declineResponse(issue) {
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
    const orderId = body?.id || "";
    const shippingAddress = normalizeCallbackAddress(body?.shipping_address || {});
    const currency = (context.env.PAYPAL_CURRENCY || PRODUCT.currency).trim() || PRODUCT.currency;

    if ((shippingAddress.countryCode || "US").toUpperCase() !== "US") {
      return declineResponse("COUNTRY_ERROR");
    }

    if (!shippingAddress.state) {
      return declineResponse("STATE_ERROR");
    }

    if (!shippingAddress.postalCode) {
      return declineResponse("ZIP_ERROR");
    }

    if (shippingAddress.state.toUpperCase() === "CO" && !shippingAddress.address1) {
      return declineResponse("ADDRESS_ERROR");
    }

    const quote = await buildTaxQuote(context.env, shippingAddress, {
      taxableAmount: PRODUCT.itemAmount,
      shippingAmount: PRODUCT.shippingAmount
    });

    return successResponse(orderId, quote, currency);
  } catch (error) {
    const message = (error && error.message) || "";

    if (message.includes("United States")) {
      return declineResponse("COUNTRY_ERROR");
    }
    if (message.includes("contiguous") || message.includes("state")) {
      return declineResponse("STATE_ERROR");
    }
    if (message.includes("ZIP")) {
      return declineResponse("ZIP_ERROR");
    }
    if (message.includes("street address") || message.includes("Colorado tax lookup")) {
      return declineResponse("ADDRESS_ERROR");
    }

    return declineResponse("ADDRESS_ERROR");
  }
}
