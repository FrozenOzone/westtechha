# WestTechHA Dev Change and Rollback Log

This file records accepted Dev checkpoints and the recovery point created before each complex workflow change. Production remains separate until a Dev version is explicitly accepted and promoted.

## 2026-09-20 — Transactional SMS across every customer order path

- Source baseline: Preview commit `3e5e0719fa0270f2e9826cfb771149697b641ad8`; Production remains unchanged at `c753a0d65e29efbf161624faf5a89d09b3efe694`.
- One shared Twilio delivery module now serves Coaster, Enclosure, Custom, and customer-portal reorder notifications instead of page-specific placeholder behavior.
- Texting occurs only when the customer selected Text message, recorded explicit transactional consent, and has a valid mobile number. Duplicate provider sends are prevented with per-event idempotency keys.
- Email remains mandatory for secure links, approvals, receipts, and delivery fallback. An SMS failure never suppresses the corresponding email.
- Accepted, delivered, undelivered, provider-failed, invalid-number, and provider-not-configured outcomes are written to each order's existing history table. Signed Twilio status callbacks record final carrier delivery results.
- Customer Portal, Coaster request, Enclosure request, and admin-managed Custom customer wording now use the same preference and consent language.
- Preview activation requires `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and either `TWILIO_FROM_NUMBER` or `TWILIO_MESSAGING_SERVICE_SID`. `TWILIO_STATUS_CALLBACK_BASE_URL` may be set explicitly; otherwise the configured public site URL is used.
- Database impact: none. Existing consent, order, and event tables are reused; no order rows are modified by deployment.

Rollback boundary: restore source commit `3e5e0719fa0270f2e9826cfb771149697b641ad8`. No database rollback is required.

## 2026-09-19 — Editable prior pricing on customer reorders

- Customer-portal reorders now copy the original order's editable price, discount, shipping, fulfillment, payment-required setting, and product details into the new review draft.
- Coaster reorders fall back to the standard 4-set price/time (`$29.99`, 650 minutes) or 8-set price/time (`$39.99`, 992 minutes) only when the original values are missing.
- Enclosure reorders fall back to the shared Scout/Ranger/Command product catalog and shared shipping tiers only when the original values are missing.
- Custom/special reorders retain the exact prior line-item pricing as a starting estimate and clearly state that WestTech will review it before customer approval.
- Reorder drafts remain editable, uncharged, outside manufacturing, and free of prior PayPal references.
- The customer dashboard now states plainly that SMS is not active yet: the preference and consent are recorded, while security, reorder confirmations, and receipts continue by email.
- Preview data repair is limited to zero-dollar Draft `WTX-20260919-1001`; sent/approved reorder `WTX-20260919-1002` is intentionally unchanged.

Rollback boundary: restore source commit `ecf2fd44ec9575b845dc5e31bc512213afe40d2d`. Preview D1 bookmark before the one-draft repair: `000000cb-00000000-000050eb-6dbc31988c64d12cbee99405f04b5520`. No schema rollback is required.

## 2026-09-19 — Customer reorder confirmation and dashboard width

- Reorders remain review drafts and do not enter manufacturing until the normal approval/payment or no-charge release workflow completes.
- Each new Custom, Coaster, or Enclosure reorder now emails a receipt to the customer and a separate actionable notification to WestTech. Both emails identify the original and new order numbers and explicitly state that the draft is not charged or in production.
- The customer dashboard reports email-delivery status immediately and now uses the same approximately 97%-wide application canvas as the admin workspaces.
- Database impact: none. Existing reorder `WTX-20260919-1001` remains a Draft and was confirmed absent from `manufacturing_work_orders`.

Rollback boundary: restore source commit `dc877dd62910f8850b97ed49a92ee5aa1cf070ac`. No database restore is required.

## 2026-09-19 — Customer accounts and all-order dashboard

- Source baseline: Preview and Production commit `c753a0d65e29efbf161624faf5a89d09b3efe694`.
- Customer authentication: separate passwordless customer accounts with 20-minute one-time email links and seven-day HTTP-only sessions. Customer authentication does not share Cloudflare Admin Access or the legacy admin token.
- Contact capture: email and mobile phone are required for new Coaster, Enclosure, and admin-created Custom customers. Email or Text message is a required preference; selecting Text requires a separately recorded transactional-SMS consent.
- Customer dashboard: verified customers can see linked Store, Coaster, Enclosure, and Custom orders; edit contact, delivery, and preference data; request verified email changes; sign out; and start a reorder.
- Reorder safety: Custom, Coaster, and Enclosure reorders create fresh review drafts with old PayPal references removed and pricing requiring reconfirmation. Direct Store orders rebuild the cart from preserved SKU, color, and quantity so current catalog pricing is used.
- PayPal boundary: WestTech stores order/payment references only. Card and PayPal credentials remain with PayPal.
- Account activation: a successful PayPal capture creates or links the customer account and sends a one-time activation invitation. Existing order customers can also request a secure sign-in link using the email already recorded on an order.
- Database impact: additive migration `020_customer_accounts.sql` adds contact-preference columns, customer account/session/token/order-link/event tables, and exact Store order item snapshots. Existing order and payment values are not rewritten.
- Local verification: all JavaScript syntax checks, the full 001–020 migration sequence, contact validation, four-source order linking, profile updates, activation/session issuance, fresh-draft reorders, and exact Store Buy Again cart reconstruction passed against an in-memory D1-compatible test harness.

Rollback boundary: restore source commit `c753a0d65e29efbf161624faf5a89d09b3efe694`. Migration 020 is additive and its new tables/columns may remain unused during a source rollback; do not drop them if customer accounts have been activated.

## 2026-09-12 — Customers and direct custom orders

- Verified recovery baseline: `WestTechHA-Dev-Command-Display-Sensor-Options-2026-09-06(2).zip`.
- Recovery baseline SHA-256: `5c12488e2c3a37ed44a5cfb3644e0520135b1892498495de3b8f3d8d08fefc49`.
- Baseline verification: all 610 packaged files match both GitHub `main` and `coasters-v30-preview` at commit `626600002a8094e8ea286dddb95f0f0cec1f5120`.
- Admin scope: add reusable customer records and a Customers & Custom Orders workspace. WestTech controls line items, taxable flags, quantities, unit prices, special-pricing discounts, shipping, fulfillment, payment-required status, customer terms, internal notes, printer time, production window, and tracking.
- Repeat work: any prior custom order can create a new editable draft without changing or deleting the original order.
- Customer scope: each sent order receives a private, expiring review link. The customer can approve the exact version or request changes; customer-facing terms lock after approval.
- Payment: approval automatically creates PayPal Checkout when payment is required. Deliberate no-charge orders bypass PayPal only after customer approval and are clearly recorded as `NOT_REQUIRED`.
- Colorado tax: taxable and non-taxable line items are supported. Discounts are allocated proportionally for the taxable base. Colorado destination tax uses the PayPal-confirmed shipping address, or the locked WestTech pickup address, and capture is blocked until the customer confirms the calculated address and total.
- Manufacturing: paid and deliberately released custom orders join the existing shared FIFO as source type `CUSTOM`; existing coaster and enclosure queue rows retain their queue timestamps and printer state.
- Lifecycle: custom orders use forward-only production and fulfillment status changes, then Completion, Archive, and Restore. There is no destructive delete action.
- Database impact: migration `017_custom_customers_and_orders.sql` adds customer, custom-order, event, and work-log tables, and rebuilds only the shared work-order CHECK constraint to admit `CUSTOM` while copying existing rows unchanged.
- Verification: full migration sequence, migration row preservation, JavaScript syntax and module imports, customer/order creation, mixed-taxability pricing, discounts, repeatable locking rules, no-charge release, mocked PayPal create/capture, out-of-state tax handling, Colorado confirmation gate, and FIFO integration passed locally.
- External impact at package time: Production and live D1 remain untouched. Apply migration 017 to Preview D1 before updating the Preview branch because the unified Orders workspace now reads custom orders.

Rollback boundary: source can return to commit `626600002a8094e8ea286dddb95f0f0cec1f5120`. If migration 017 has been applied, leave the new tables and expanded shared-work CHECK in place during a source rollback; existing coaster/enclosure behavior and rows remain compatible. Export Preview D1 immediately before applying migration 017.

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
