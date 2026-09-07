# WestTechHA Dev Change and Rollback Log

This file records accepted Dev checkpoints and the recovery point created before each complex workflow change. Production remains separate until a Dev version is explicitly accepted and promoted.

## 2026-09-06 — Command display and sensor options

- Pre-change source package: `WestTechHA-Dev-Loaded-Component-Selector-2026-09-06.zip`
- Pre-change package SHA-256: `5e83e94c05ff307dd7fbb2f1121582eef5ae4de8a557bd336759ed2517f94906`
- Scope: add Command-only LCD2004 and DHT11 choices to the existing Loaded component selector for both Command Core and Command-GP; Scout and Ranger compatibility remains unchanged.
- Approved add-on pricing: DHT11 temperature and humidity sensor is $5.00 each; LCD2004 display is $15.00 each. The existing 0.96-inch OLED remains $8.00 and the buzzer remains $3.00.
- Two-display handling: OLED and LCD2004 may both be selected. Selecting the second display opens a required acknowledgement dialog; Cancel leaves the second display at No, while Add Both Displays remains disabled until the customer checks the acknowledgement.
- Server enforcement: a submitted OLED + LCD2004 combination is rejected unless the acknowledgement is present. The acknowledgement is stored inside the existing Loaded component JSON and appears in request emails, admin review/production reference, and the customer approval page.
- Database impact: none beyond the already-pending additive migration `016_enclosure_loaded_components.sql`; that migration is unchanged and no new migration is required.
- External impact: none; GitHub, Cloudflare, Preview D1, Production, and live order records were not changed.

Rollback boundary: restore the complete pre-change source package above. No database restore is required for this Command-option change.

## 2026-09-06 — Loaded enclosure component selector

- Pre-change source package: `WestTechHA-Dev-Global-Centered-Body-2026-09-06.zip`
- Pre-change package SHA-256: `0eccfbec3d95468105ea2cc612c62d8ddb62c9b935d6db425fb2b31155d03f8c`
- Scope: add model-compatible Loaded component choices to the unified enclosure request path while leaving Unloaded behavior unchanged.
- Loaded core: matching ESP32/breakout hardware is included for every model; Ranger Relay includes its relay, Ranger Bucks includes its buck converter, and Command includes both. Required hardware is visible and locked.
- Optional hardware: customers explicitly choose Yes or No for compatible OLED and buzzer add-ons, with live per-unit and quantity-aware pricing.
- Order record: the exact required, added, and declined component choices are stored with the request and shown in admin review, customer approval, order emails, and the production reference.
- Database impact: additive migration `016_enclosure_loaded_components.sql` is included but was not applied to any database in this local package workflow.
- External impact: none; GitHub, Cloudflare, Preview D1, Production, and live order records were not changed.

Rollback boundary: restore the complete pre-change source package above. If migration 016 is later applied, the two additive columns can remain safely unused; no existing order columns or rows are altered by this feature.

## 2026-09-06 — Global centered public-site body width

- Pre-change source package: `WestTechHA-Dev-Pre-Global-Centered-Body-2026-09-06.zip`
- Scope: increase the shared site body canvas from 1200px to 1380px and keep it centered, matching the Coasters index body behavior.
- Header: unchanged at its existing centered 1200px width; the incorrect Home-only header scaling was removed.
- Structure and content: unchanged; internal text alignment, navigation, themes, and responsive behavior remain intact.
- Database impact: none; no API, payment, order, production, or Preview D1 files were changed.

Rollback boundary: restore `index.html` and `css/site-20260824-mobilefix.css` from the pre-change source package. No database restore is required.

## 2026-09-06 — Home-page header/body scale balance

- Pre-change source package: `WestTechHA-Dev-Pre-Homepage-Scale-Balance-2026-09-06.zip`
- Pre-change package SHA-256: `1e8030b4545e9052c032f91852b3a4b78fa1a456ca68a56c1265a0b1aab3784c`
- Scope: make the Home page's desktop site header quieter and more compact while increasing the width and visual scale of the Home page body.
- Preserved: the two-product Home structure, wording, navigation destinations, themes, and responsive mobile header behavior.
- Database impact: none; no API, payment, order, production, or Preview D1 files were changed.

Rollback boundary: restore `index.html` and `css/site-20260824-mobilefix.css` from the pre-change source package. No database restore is required.

## 2026-09-06 — Home-page coaster direction update

- Pre-change source package: `WestTechHA-Dev-Pre-Homepage-Coaster-Direction-2026-09-06.zip`
- Pre-change package SHA-256: `0ca58bc798b0aa595f799913ebcf43e899ce2ce3f66f8568f41802cded07c989`
- Scope: replace the home-page coaster card's older rivalry/team message and artwork with the accepted custom-project direction from the Coasters landing page.
- Customer path: the card and button now lead directly to the custom-project choices at `coasters/index.html#start`.
- Database impact: none; no API, payment, order, production, or Preview D1 files were changed.

Rollback boundary: restore `index.html` and `css/site-20260824-mobilefix.css` from the pre-change source package. No database restore is required.

## 2026-09-05 — Before unified Orders workspace

- Accepted Dev commit: `e170d969a6adf92d51e9618920f9b9c9e682df61`
- Named checkpoint branch: `checkpoint-before-unified-orders-20260905`
- Preview D1 bookmark: `00000058-00000000-000050dd-b11563f336938b1e2022cc12f5ab36ee`
- Private D1 export: `westtechha-preview-before-unified-orders-20260905.sql`
- Export SHA-256: `35f5b1823568aa1f6e500d73399c623bcdf7accf05bbb945bdb2994c1d8b1102`
- Accepted behavior at checkpoint: unified enclosure buying, coaster and enclosure approval/payment workflows, and shared paid/released FIFO manufacturing work orders.

Rollback boundary: restore the Dev branch to the accepted commit for source recovery. Restore the private SQL export only if order data or schema was changed after this checkpoint. The unified Orders workspace itself is designed to require no D1 schema change.

## 2026-09-05 — Unified Orders detail-pane visibility fix

- Pre-fix Dev commit: `7cd2b9f3f12c1f8f6aa0cf8740895047421fcbe0`
- Named checkpoint branch: `checkpoint-before-orders-pane-fix-20260905`
- Scope: CSS visibility correction and stylesheet cache refresh only.
- Cause: the empty-state grid rule overrode the element's `hidden` state, leaving the placeholder above the selected order.
- Database impact: none; Preview D1 schema, data, and order records remain untouched.

Rollback boundary: restore the Dev branch to `7cd2b9f3f12c1f8f6aa0cf8740895047421fcbe0`. No database restore is required for this change.

## 2026-09-05 — Enclosure admin layout parity

- Pre-change Dev commit: `d3356eff465c5bdbe5d981360fe32ce26bb92003`
- Named checkpoint branch: `checkpoint-before-enclosure-layout-parity-20260905`
- Scope: rebuild the enclosure order detail around the accepted coaster admin layout while preserving enclosure-specific fields and workflow behavior.
- Visual parity: large product image, two-column customer overview, matching pricing/terms, fulfillment/notes, production, work-log, approval/payment, and history surfaces.
- Database impact: none; Preview D1 schema, data, and order records remain untouched.

Rollback boundary: restore the Dev branch to `d3356eff465c5bdbe5d981360fe32ce26bb92003`. No database restore is required for this change.

## Rule for future complex changes

1. Record the accepted Dev commit.
2. Create a named checkpoint branch before editing.
3. Export Preview D1 when the change touches database schema, data, or workflow state.
4. Deploy one coherent Dev commit.
5. Record what changed, what stayed untouched, and the exact rollback boundary here.
