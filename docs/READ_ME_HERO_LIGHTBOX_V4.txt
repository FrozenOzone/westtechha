Hero Lightbox v4 - Actual Structure Fix
======================================

Replace:
  js/gallery-lightbox.js

What I found in the structure:
- Product pages load:
  js/gallery-lightbox.js
  js/product-photo-toggle.js?v=2 or ?v=3

- Gallery images were working because the old script selected:
  .product-gallery figure img

- The hero image structure is different:
  <figure class="product-gallery">
    <img data-product-hero-image ...>
  </figure>

That means the original selector did not include the hero image.

What this v4 does:
- Detects product images by actual image/source context.
- Includes img[data-product-hero-image].
- Includes any image using images/products/.
- Includes images inside product cards and checkout product image areas.
- Uses capture-phase document click handling so the hero click is caught even if another script is involved.
- Sets cursor/role/tabindex directly in JS so the hero image behaves like a clickable product image.

No GitHub changes.
