# WestTechHA Stage 5L4 - Production Release Go/No-Go Gate

**Decision: HOLD - Preparation only. No Production mutation authorized.**
**Audit date:** October 24, 2026. This report captures point-in-time results; redo every live check before a release.

## This is an update to an existing live storefront

The existing WestTechHA ESP32/enclosure, custom-order and coaster checkouts already operate on Production. Preserve them. The purpose of 5L4 is to decide whether the new portal/pickup/payment backend can be promoted without breaking existing business operations. A successful installer, read-only audit or passing unit tests **does not authorize Production deployment**.

## Verified point-in-time baseline

| Check | Observation |
| --- | --- |
| GitHub repository | `FrozenOzone/westtechha` |
| Production branch and SHA | `main` at `67dd7dd1a9f4cafa7f76fb50bc51f983c6f49b48` |
| Preview branch and SHA BEFORE this kit | `pickup-stage1-preview` at `69da270505f4be18d8c4fd8918c452988c957a46` |
| Branch delta BEFORE this kit | Preview ahead 64 commits; 94 changed paths; 0 behind |
| Last automated 5L3 regression | 152 tests passed, 0 failed on the owner's Windows machine |
| Cloudflare deployment | Latest audited Preview commit success; Production remained at the baseline above |
| Production Orders D1 | `442f34a2-49bd-4a3b-8e58-75ba9c4d3eb0` |
| Preview Orders D1 | `d09b2358-dfcd-4cb2-9c46-57175732c45c` |
| Production R2 bucket | `westtechha-coaster-artwork` |
| Preview R2 bucket | `westtechha-coaster-artwork-preview` |
| Production D1 counts | 2 coaster orders, 1 manufacturing work order, 0 portal accounts |
| Preview D1 counts | 7 coaster orders, 6 manufacturing work orders, 1 portal account |
| Production new tables | 022 and 023 not applied: 4 pickup tables and 1 payment-attempt table absent |
| Preview new tables | All 5 tables present |
| D1 integrity | Both databases: no foreign-key errors; no unmatched paid coaster work orders |
| Environment secrets | Production has PayPal client ID/secret, environment marker, Resend API key, tax key; values not inspected |

## Release HOLD items - do not wave through

### G1 - Sensitive tax request/response logging - CODE CHANGE REQUIRED

`functions/_lib/tax.js` includes `console.log` of `inputAddress`, the tax API request `payload.address`, returned provider address, and `apiAddress`. Those can contain customers' complete shipping addresses. This same module is in the existing live branch, making it an **existing privacy risk** rather than a new feature regression. Patch in Preview without altering calculations or tax service requests; add tests proving no raw address/customer data reaches application logs; regression-test the existing checkout paths. Plan a separately approved Production promotion. Never log API keys or provider error bodies that may contain personal data.

### G2 - Resend webhook configuration - CONFIGURATION/DELIVERY VERIFICATION

Production Pages variables do not list `RESEND_WEBHOOK_SECRET`; Preview does. `functions/api/webhooks/resend/index.js` returns HTTP 503 for webhook POST without this secret. Verify whether Production actually uses that webhook, and if so create the proper Production-only signing secret and test signature validation/receipt delivery under a separately approved configuration change. Do not copy the Preview secret. `EMAIL_SENT` application events do not prove inbox delivery. If the webhook is intentionally unused in Production, record that disposition instead of misrepresenting it as configured.

### G3 - Live merchant, browser and delivery acceptance - OWNER ACTION

Presence of hidden `PAYPAL_ENV`, `PAYPAL_CLIENT_ID`, and `PAYPAL_CLIENT_SECRET` entries is not proof of their values or of the intended business merchant account. Owner verifies the correct live merchant/environment privately, including the existing live storefront, before any Production promotion. Customer portal, artwork/PDF, return/cancel, order history, shipment/pickup, Dev Admin Cloudflare Access, and customer/Admin email delivery need browser/real-provider evidence. There are no confirmed Preview pickup appointments, so booking UI was **not exercised**. No real payments should be initiated without specific authorization.

### G4 - Full release scope - REVIEW REQUIRED

A 64-commit/94-path delta includes customer/admin pages, layouts, JavaScript, Pages Functions, middleware, tax-adjacent order logic, migrations, tests and tools. The 5L3 cross-storefront tests pin important unchanged modules, but do not constitute human review of every changed executable path. Generate the exact current inventory using the read-only `stage5l4-local-audit.mjs`, then review the entire diff for Production compatibility. Use an auditable release commit/PR. Do not silently merge new Preview-only flags into Production.

### G5 - Backup, migration and rollback - OWNER APPROVAL REQUIRED

Production has migrations 020/021 but not `022_coaster_pickup_scheduling.sql` or `023_coaster_payment_attempts.sql`. The migrations were rehearsed in offline in-memory SQLite; this does **not** replace a real Production backup. Before applying either, verify Production database ID, capture a protected SQL export and a supported D1 Time Travel bookmark, record byte count and SHA-256, confirm restore feasibility, and obtain explicit approval. Apply 022 then validate, apply 023 then validate. No migrations are executed by this kit.

**Rollback:** if the deployed code fails, restore previous known-good Pages deployment while retaining additive tables unless carefully reviewed. Do **not** automatically restore D1: time travel may destroy orders/transactions accepted after a backup; reconcile provider captures and manufacturing first. Never switch `PAYPAL_ENV` to Sandbox on Production; it would also affect existing checkout.

## Read-only operator sequence

1. With a clean `pickup-stage1-preview` checkout, run `node scripts/release-5l4/stage5l4-local-audit.mjs` to print current commits and changed path inventory. Re-run after any code changes. This script does not connect to GitHub or Cloudflare.
2. Run `node --test tests/stage5l4-release-gates.test.mjs` and the Stage 5L3 regression suite. A test reporting expected HOLD is **not** a Production go decision.
3. Fix G1 only in Preview through a separately reviewed code patch; re-run end-to-end tests.
4. Resolve or formally disposition G2 and G3, including screenshot/evidence for otherwise unexercised browser scenarios.
5. Audit complete Production promotion diff, Cloudflare Access, D1/R2 separation, exact live PayPal merchant configuration, sender/webhook setup, production domain and tax policy.
6. Seek **separate, explicit owner authorization** for Production backup, each D1 migration, and the Production deployment. No action is bundled with a generic Stage 5L4 installer.

## Final release decision

**HOLD.** Release may become GO only after G1 through G5 have evidence and no outstanding blocker. No Production files, databases, secrets, checkout sessions, PayPal orders, emails, D1 exports, or Cloudflare settings were mutated by this report/kit. Use Stage 5L2 runbook for detailed migration/rollback procedure.
