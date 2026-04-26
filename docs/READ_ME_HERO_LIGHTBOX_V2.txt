Hero Lightbox v2
================

Changed:
- js/gallery-lightbox.js

This version explicitly targets hero images by:

  img[data-product-hero-image]

It also still targets the normal gallery images.

Why this version:
- The previous version relied on the hero being inside .product-gallery.
- Your live/local pages are still only making the gallery clickable.
- This version does not depend on the wrapper; it binds directly to the hero image attribute.

Copy into your local site:

  js/gallery-lightbox.js

Then hard refresh the browser:
- Ctrl + F5
- Or close/reopen the page
- Or clear browser cache for the local/site page

No GitHub changes.
