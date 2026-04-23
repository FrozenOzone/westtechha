import { generateAccessToken, paypalBaseUrl } from "../../../_lib/paypal.js";
import { PRODUCT } from "../../../_lib/product.js";
import { jsonResponse, readJsonSafe, sanitizeEnvValue } from "../../../_lib/shared.js";
import { buildTaxQuote } from "../../../_lib/tax.js";

function toPayPalShippingAddress(address) {
  const shipping = {
    name: {
      full_name: address.fullName
    },
    address: {
      address_line_1: address.address1,
      admin_area_2: address.city,
      admin_area_1: address.state,
      postal_code: address.postalCode,
      country_code: address.countryCode
    }
  };

  if (address.address2) {
    shipping.address.address_line_2 = address.address2;
  }

  return shipping;
}

function buildOrderPayload(env, taxQuote) {
  const currency = sanitizeEnvValue(env.PAYPAL_CURRENCY) || PRODUCT.currency;
  const itemValue = PRODUCT.itemAmount;
  const shippingValue = PRODUCT.shippingAmount;
  const taxValue = taxQuote.taxAmount;
  const totalValue = taxQuote.totalAmount;

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
            },
            tax_total: {
              currency_code: currency,
              value: taxValue
            }
          }
        },
        shipping: toPayPalShippingAddress(taxQuote.address),
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
            tax: {
              currency_code: currency,
              value: taxValue
            },
            category: "PHYSICAL_GOODS"
          }
        ]
      }
    ],
    payment_source: {
      paypal: {
        experience_context: {
          shipping_preference: "SET_PROVIDED_ADDRESS",
          user_action: "PAY_NOW"
        }
      }
    }
  };
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const taxQuote = await buildTaxQuote(context.env, body?.shippingAddress || body, {
      taxableAmount: PRODUCT.itemAmount,
      shippingAmount: PRODUCT.shippingAmount
    });

    const accessToken = await generateAccessToken(context.env);
    const response = await fetch(`${paypalBaseUrl(context.env.PAYPAL_ENV)}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Prefer: "return=representation"
      },
      body: JSON.stringify(buildOrderPayload(context.env, taxQuote))
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
      status: data.status || null,
      tax: {
        amount: taxQuote.taxAmount,
        rate: taxQuote.taxRate,
        isColorado: taxQuote.isColorado,
        jurisdictionCode: taxQuote.jurisdictionCode || null
      }
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      message: error.message || "Unexpected error while creating the PayPal order."
    }, 500);
  }
}
