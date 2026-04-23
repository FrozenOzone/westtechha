# PayPal setup for Scout 30 - Ready

This site is wired for PayPal Standard Checkout using Cloudflare Pages Functions.

## Cloudflare Pages variables/secrets

Set these in **Workers & Pages -> your Pages project -> Settings -> Variables and Secrets**:

### Required
- `PAYPAL_CLIENT_ID` -> your PayPal client ID
- `PAYPAL_CLIENT_SECRET` -> your PayPal client secret (set as a secret)

### Optional
- `PAYPAL_ENV` -> `sandbox` or `live`
- `PAYPAL_CURRENCY` -> defaults to `USD`

## Routes added
- `/api/paypal/config`
- `/api/paypal/orders`
- `/api/paypal/orders/:orderID/capture`

## Files added or updated
- `functions/api/paypal/config.js`
- `functions/api/paypal/orders/index.js`
- `functions/api/paypal/orders/[orderID]/capture.js`
- `js/paypal-scout-ready.js`

## Current pricing logic
The server is authoritative for Scout 30 - Ready:
- Product: $35.00
- Shipping: $8.95
- Tax: not yet calculated in the server order payload

## Notes
Do not put the PayPal client secret in front-end JavaScript.
