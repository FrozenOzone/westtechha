Scout Toggle Shared Caption Fix
===============================

Problem fixed:
- When switching to Scout 38 Black, gallery captions were changing to placeholders like:
  "Scout 38 Black photo 1."

Fix:
- Gallery captions now remain shared/static between Scout 30 White and Scout 38 Black.
- The toggle swaps gallery images only.
- product-scout.html also has the Scout 38 Black JSON captions corrected, so placeholder text is gone even if an older script tries to read the captions.

Files included:
- product-scout.html
- js/product-photo-toggle.js

Copy these into your local website root and overwrite.

No GitHub changes.
