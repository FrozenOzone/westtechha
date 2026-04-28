WestTech Home Automation - Google Merchant Center Feed Update

What this adds:
  /feeds/google-merchant-products.tsv

Why this exists:
  Google Merchant Center needs a public product feed file so it can fetch your product data automatically.
  This avoids manually maintaining the same product information in Google Sheets.

After you upload/deploy it, the public feed URL should be:
  https://westtechha.com/feeds/google-merchant-products.tsv

In Google Merchant Center Next:
  1. Stay on "Add products from a file".
  2. Choose "Enter a link to your file".
  3. Paste:
     https://westtechha.com/feeds/google-merchant-products.tsv
  4. Keep the daily schedule.
  5. Continue.

Feed notes:
  - Current launch feed includes 4 direct purchase products:
      scout-30-unloaded
      scout-38-unloaded
      ranger-30-unloaded
      ranger-38-unloaded
  - Prices were taken from functions/_lib/product.js in the uploaded site.
  - Product links point to the matching checkout pages.
  - Image links point to existing product images already in the site.
  - Color is intentionally not split into separate Google rows yet because the live checkout pages let the customer choose White or Black on the product checkout page.
  - Shipping is set as the 1-unit launch shipping amount: 8.95 USD. Keep Merchant Center shipping settings aligned with the website checkout.

Upload instruction:
  Copy the included feeds folder into the root of your website folder, beside css, images, js, docs, etc.
