# WestTechHA Stage 5L3 — Storefront and Customer-Portal Regression

**Status: PREVIEW TEST PREPARATION ONLY — NO PRODUCTION WRITES.**

WestTechHA already has a live ESP32/enclosure, custom-order and coaster storefront. This stage *does not* launch a store, touch existing live purchases, issue a new PayPal/Venmo capture, migrate D1, copy customer data, or change configuration.

## 1. Automated local tests (no internet and no transactions)

The installer runs:

- **Stage 5L3 payment-handler behavioral tests**: exercise actual customer payment endpoint with mocked providers, session/ownership, SQL link, return URLs and response objects. No real PayPal call or D1 mutation.
- **Stage 5L3 cross-storefront contract checks**: pin five existing live PayPal/tax modules to audited Git blobs; verify links, artwork, checkout, new portal, production scheduling, email idempotency, Admin Access and migration rehearsal protections.
- **All earlier Stage 5A–5L2 regression checks** including payment races, Venmo shipping, frozen quotes, customer portal behavior, recovery protections and migration rehearsal.

**Pass criteria:** zero test failures, no new modifications to shared live ESP32/custom PayPal modules; the installer selectively stages only the four Stage 5L3 test/operator files.

These tests are strong regression coverage **but not a substitute for actual authenticated browser walkthroughs, email delivery, or live provider integration.** An automated fixture calling the actual endpoint is NOT a real provider end-to-end checkout.

## 2. Optional public GET-only smoke

After the install, the following are optional explicit operator actions. They make *only safe GET requests* to static public pages (no POST, no customer ID or login token):

```powershell
cd "$env:USERPROFILE\Documents\westtechha"
node scripts/release-5l3/stage5l3-readonly-smoke.mjs --preview
node scripts/release-5l3/stage5l3-readonly-smoke.mjs --production
```

Expected: successful public page status or protected Cloudflare Access redirect. A 404 on the public Pages-host alias may mean Access/routing rather than an application failure; verify in the intended browser/domain before signing off. The installer does **not** run either network smoke automatically.

## 3. Required authenticated browser/manual workflow — Preview only

Do not create a real charge merely to complete the checklist. Use existing Sandbox-paid orders and existing test orders. Before testing, record page screenshots and observed outcomes; never paste actual approval tokens, passwords, customer addresses, phone numbers or complete capture identifiers in a shared issue.

| Flow | Procedure | Expected outcome | Evidence |
|---|---|---|---|
| Existing public storefront | Visit ESP32/Enclosures, Coasters, shipping/returns, login | Pages render, routes and prices consistent, no blocked assets | Screenshot and URL |
| Sports order | Open existing Single/House Divided builder and checkout review without submitting a new purchase | Artwork preview and set-count/price are correct | Screenshot |
| Proof approval | Use an existing authorized Preview order in proof-ready state; inspect proof and approved terms | Proof image/PDF visible, version and dates accurate; old proof link still serves its proper scope | Screenshot/status, no token |
| Portal access | Sign into a Preview customer account | Only owned orders listed; private artwork renders or gives safe placeholder | Screenshot |
| Awaiting payment | Inspect existing unpaid approved order; **do not** create duplicate provider checkout | PayPal Sandbox/Venmo availability matches eligible status and shipping mode | Screenshot |
| Paid order | View existing Sandbox-paid PayPal and Venmo orders in the portal | Shows Paid, correct method/total, queue and artwork; no payment button | Screenshot |
| Admin overview | From `dev.westtechha.com` behind Cloudflare Access, review order, payment and manufacturing work order | Same order IDs, one work order/order, timeline, no customer data exposed to unauthenticated users | Screenshot |
| Pickup | Inspect an existing local-pickup test order with a valid slot, if available | Allowed slot and times only; no duplicate confirmed appointments | Screenshot |
| Email/SMS | Review existing logged email events, and actual receipt where possible | Expected customer/Admin message and no duplicate; distinguish sent vs delivered | Event status and sanitized copy |
| Security | Open `/admin/` and `/api/admin/` on public preview alias unauthenticated | Denied; normal `dev.westtechha.com` routes require Access | HTTP status and URL |
| Existing legacy checkout | Inspect old coaster proof and payment-return pages **without clicking Pay/PayPal capture** | Old paths still render and preserve existing order reference | Screenshot |

**Do not manually trigger `recover-*`, `repair-*`, `sync` payment actions, capture, cancel, resend or any Production Admin mutation during this pass.** They require their own deliberate test plan.

## 4. Evidence and launch blockers

For each flow, mark PASS, FAIL or NOT EXERCISED. A missing eligible order is **NOT EXERCISED**, not a pass. If any flow fails, capture URL, time, browser console error and expected/actual results; redact customer data. Fix only in Preview via an independently reviewed patch.

Outstanding requirements before 5L4: all applicable browser flows completed, no blocker-level failures, actual customer/Admin email delivery confirmed separately, Production migration and backup approval gates kept intact, live PayPal identity/configuration reviewed, 62+ commit diff reviewed in release scope, exact Production promotion explicitly authorized by owner. Venmo live is still excluded.

## 5. Scope and rollback

- Repo Preview branch `pickup-stage1-preview` only; baseline `ef6d5037e4f5a9d28b56bd759fd5046e874b82d2`.
- Production `main` remains at audited `67dd7dd1a9f4cafa7f76fb50bc51f983c6f49b48` until separately verified and authorized.
- The installer publishes only this runbook, optional GET-only smoke script and two test files. No customer-facing script, PayPal code, database schema, Cloudflare config or Production is changed.
- Internal test/operator files live under `/scripts/release-5l3` or `/tests`. The existing website middleware denies external HTTP access to `/scripts/`. Do not move the runbook to publicly served `/docs`.
- Continue to use Stage 5L2 Production Release Runbook for independently approved D1 backups, migrations, rollback, and go/no-go procedure.
