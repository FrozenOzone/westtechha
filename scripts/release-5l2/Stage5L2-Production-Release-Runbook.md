# WestTechHA Stage 5L2 — Production Release Preparation

**Status: PREPARATION ONLY — NOT AUTHORIZED TO DEPLOY OR MIGRATE PRODUCTION.**

This runbook applies to an *existing live* WestTech Home Automation storefront. The ESP32, custom-order, and legacy coaster PayPal purchase paths already operate on Production. This is a backend/portal update; do **not** replace or reset the store.

## Verified baseline (October 24, 2026)

| Item | Verified state |
|---|---|
| Repository | `FrozenOzone/westtechha` |
| Production branch and commit | `main` at `67dd7dd1a9f4cafa7f76fb50bc51f983c6f49b48` |
| Preview branch and commit | `pickup-stage1-preview` at `77b34d5cdff22bdfe602e7e93b8a55779a53190f` |
| Comparison | Preview ahead 62 commits; 86 file paths differ, with 47 added paths; no removed paths |
| Production D1 binding | `ORDERS_DB` -> `442f34a2-49bd-4a3b-8e58-75ba9c4d3eb0` |
| Preview D1 binding | `ORDERS_DB` -> `d09b2358-dfcd-4cb2-9c46-57175732c45c` |
| Production R2 | `COASTER_ARTWORK` -> `westtechha-coaster-artwork` |
| Preview R2 | `COASTER_ARTWORK` -> `westtechha-coaster-artwork-preview` |
| Existing Production data | 2 coaster orders; 1 manufacturing work order; 0 customer accounts at audit time |
| Existing Production baseline | Customer-account tables (020) and `mobile_carrier` columns (021) present |
| Remaining additive migrations | `022_coaster_pickup_scheduling.sql`, then `023_coaster_payment_attempts.sql` |
| Stage 5L1 test result | 108 passed, 0 failed on the user's local machine |

The baseline is point-in-time. Rerun *read-only* checks immediately before any future authorized Production action. The 5L2 installer publishes **only runbook, read-only SQL, and local offline-test files to Preview**. It does not deploy website code, execute any D1 SQL, export customer data, or use Wrangler.

## 1. Release scope and prerequisites

1. Confirm that the current Production `main` and Preview branch heads and the complete comparison are still the audited ones; if not, review the new diff before proceeding.
2. Review the **entire 86-path diff**, not merely payments: account, admin, coasters, CSS, enclosures, Functions, JS, migrations, and tests. Preserve all existing ESP32/enclosure, custom-order and legacy proof approval/PayPal paths. No blanket force push or blind merge.
3. Confirm PayPal live credentials/merchant account **by owner review**. The new customer portal live PayPal path is gated to canonical hosts; Sandbox remains confined to Preview. Venmo stays Sandbox-only until separately approved.
4. Validate authenticated customer ownership, existing approval-token links, original PayPal order reuse, live return/cancel URLs, completed-capture idempotency, and recovery Admin authentication. Test those prior to promotion.
5. Confirm Cloudflare Pages Production custom domain, Access policies for `/admin/*` and `/api/admin/*`, Production R2 binding, Production D1 binding, Resend sender, and tax lookup settings. Never copy Preview secrets, IDs, R2 bucket names or Sandbox flags into Production.
6. Confirm that customer portal and old order data still work when account links are initially empty; no account backfill or email invitation should be assumed to have already occurred.
7. Obtain explicit owner approval **before** any Production backup operations that read customer information, D1 migration, config edit, branch promotion, or real-charge test. Review protection of exported customer information.

## 2. Exact database migration plan (NOT executed by 5L2)

- Existing Production already contains objects from 020 and 021. **Do not reapply 020/021.** Verify columns first using `scripts/release-5l2/Stage5L2-Production-ReadOnly-D1-Checks.sql`.
- 022 creates: `coaster_pickup_slots`, `coaster_pickup_requests`, `coaster_pickup_appointments`, `coaster_pickup_links` and the declared indexes. `coaster_orders` stays unchanged.
- 023 creates: `coaster_payment_attempts` and its index. Existing `coaster_orders`/`manufacturing_work_orders` stay unchanged.
- Both migration SQL files are repository-controlled. Do not regenerate them from Preview database exports and do not rerun unreviewed legacy migrations.
- A **local in-memory rehearsal** is supplied in `scripts/release-5l2/stage5l2-migration-rehearsal.py`: it models two existing orders, applies the actual checked-in migration text, checks unchanged orders and foreign keys, and tests indexes/unique constraints and re-run idempotence. This is *not* a test against the actual Production dataset.

## 3. Explicitly approved later: pre-migration export and checkpoint

At the **future authorized Production maintenance window**, pause *new* checkout attempts briefly or otherwise use an owner-approved consistent snapshot strategy, ensuring existing purchases can finish. Review Cloudflare's D1 export behavior: a running export can block other database requests. Do not run the export as part of 5L2.

Verify that the active Wrangler login and D1 name identify **Production** `442f34a2-49bd-4a3b-8e58-75ba9c4d3eb0` rather than Preview. When authorized, use a deliberately chosen protected local backup path (not source control):

```powershell
# EXAMPLE ONLY - DO NOT EXECUTE UNTIL OWNER APPROVAL
# Choose a protected, private path. Confirm the database identity first.
npx wrangler d1 info westtechha-orders
npx wrangler d1 time-travel info westtechha-orders
npx wrangler d1 export westtechha-orders --remote --output="C:\Users\ewest\Documents\WestTechHA-D1-Backups\<timestamp>-pre-5L-production.sql"
# Then record SHA-256 and byte count; keep SQL out of Git and customer-facing folders.
```

Cloudflare docs: https://developers.cloudflare.com/d1/wrangler-commands/ ; https://developers.cloudflare.com/d1/reference/time-travel/

**Important:** SQL exports contain private customer/order data. Preserve a timestamp, CLI output, file byte count, checksum, and any supported D1 Time Travel bookmark in a separate operator record. Validate backup contents before changing schema; safeguard/encrypt the backup as appropriate. Time Travel history duration depends on plan; do not assume indefinite recoverability.

## 4. Explicitly approved later: migration and post-migration checks

After the backup and explicit migration approval, apply the checked-in 022 file **once**, verify all four tables and intended indexes; then apply 023 **once**, verify the attempts table/index. The exact Wrangler command, environment and database identity must be reviewed at execution time; the installer contains no executable Production D1 migration instructions. Do not use any optional `--local`, `--preview`, or `--remote` combination without rechecking its target.

Repeat the read-only SQL in the accompanying checks file. Existing counts, payment statuses, provider refs, and manufacturing order mappings must be preserved. Require `PRAGMA foreign_key_check` to produce zero rows. Verify no missing/double manufacturing work orders. A schema migration does not authorize sending emails or taking payment.

## 5. Promotion / live validation (future, requires separate authorization)

1. Run full integrated regression tests for portal, coasters, ESP32/enclosures, custom orders, shipping/pickup, tax, recovery, login/email/SMS and security. Include negative paths and expired/legacy approval links.
2. Review all 86 changed paths and any additional commits. Prepare a minimal, auditable Production release commit/PR; no unreviewed force push or deployment from local test files.
3. Approve a deployment window. Record baseline Production deployment ID and the exact rollback target commit.
4. Deploy only following explicit owner approval. Smoke-test unchanged live storefront checkout first, then portal auth, payment quote, approval, artwork, pickup, notices; do not charge a real card without explicit separate authorization.
5. Recheck Production D1 statuses, work-order uniqueness, email/SMS delivery evidence, and R2 artwork access. Keep a short, documented rollback decision window.

## 6. Rollback: distinguish code from customer data

- **Code rollback:** revert the Production Pages deployment to the last known good release, only with owner approval. The two migrations are additive; leaving empty/new tables in place may be safer than destructive schema rollback.
- **Database rollback:** DO NOT automatically restore D1 after live customers have made purchases; a restore can overwrite paid orders, new customers, emails, appointments, and capture data. Capture and reconcile all post-backup transactions with payment-provider records and manufacturing work orders first. Cloudflare Time Travel restore is destructive; owner review/approval is mandatory.
- Never switch `PAYPAL_ENV` to `sandbox` on Production to disable the new portal: **that would affect the already-live legacy PayPal checkout**. Use an authorized code rollback or deliberately designed portal feature switch instead.
- Never import Preview D1 or Preview R2 as if it were Production. Protect the legacy order-approval link until all paid and awaiting-payment orders are reconciled.

## 7. Go/no-go criteria

**No Production promotion until ALL:** (a) backup and bookmark verified; (b) 022/023 migration rehearsal and target-schema checks pass; (c) unchanged live storefront checkout passes; (d) portal + legacy buyer paths coexist without duplicate captures; (e) live-vs-sandbox isolation and Dev Admin Access are verified; (f) rollback and provider reconciliation are documented; (g) the owner explicitly authorizes the specific deployment.

Status after Stage 5L2: release prep documents and offline rehearsal only. **Not Production-ready merely because this installer passes.**

## 8. Internal document handling

The release kit is committed only under `/scripts/release-5l2` and `/tests`. The existing Pages middleware denies HTTP access to `/scripts/*`. Do not move these operator instructions or schema queries to a publicly served `/docs` directory.
