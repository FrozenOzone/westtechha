# Pricing Change How-To

In the current checkout setup, pricing is centralized in:

`functions/_lib/product.js`

That is the **one place** to change prices.

## What to edit

For each product, update:

- `itemAmount`
- `shippingAmount`

Example:

```js
"scout-30-unloaded": {
  name: "Scout 30 - Unloaded",
  itemAmount: 35.00,
  shippingAmount: 8.95
}
```

## Current product keys

- `scout-30-unloaded`
- `scout-38-unloaded`
- `ranger-30-unloaded`
- `ranger-38-unloaded`

## Pricing change workflow

1. Open:
   `functions/_lib/product.js`

2. Find the product you want to change.

3. Update:
   - `itemAmount`
   - `shippingAmount`

4. Save the file.

5. Push the updated site.

6. Redeploy Cloudflare Pages.

7. Test the checkout page and confirm:
   - product price is correct
   - shipping is correct
   - total is correct
   - PayPal amount matches

## Important note

Because pricing is centralized, do **not** manually change prices in multiple checkout pages unless the pricing system is redesigned later.

## Short version

```text
Pricing file:
functions/_lib/product.js

Change:
itemAmount
shippingAmount

Then:
save -> push -> redeploy -> test checkout
```
