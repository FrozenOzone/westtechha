# Stage 5L4A — Tax log privacy correction (Preview only)

This patch removes four diagnostic `console.log()` calls in `functions/_lib/tax.js`, preventing full shipping addresses, names, provider address echoes and raw provider messages from reaching runtime logs. It does not change the tax request payload, address validation, Colorado rate lookup, tax rounding, quote contents or payment behavior.

## Verified scope

- `functions/_lib/tax.js` — remove the four address-bearing logs only.
- `tests/stage5l3-cross-storefront.test.mjs` — update **only** the intentional tax.js Git-blob pin; keep every other live adapter's pin.
- `tests/stage5l4-release-gates.test.mjs` — verify leak is absent on Preview while preserving historical HOLD documentation.
- `tests/stage5l4a-tax-log-privacy.test.mjs` — offline mock-provider tests for Colorado tax, out-of-state tax, provider payload and no console PII.
- This note; no other application or provider files.

## Release impact and gates

- On Preview, this fixes G1 of the Stage 5L4 release-readiness audit. That audit remains historically correct (as of its creation) and **HOLD** because remaining gates are open.
- Production retains its current tax module until separate explicit owner authorization for promotion; this installer never updates Production.
- Resend webhook Production signing-secret configuration is still unverified. Do not add or alter secrets in this stage.
- Remove historical log entries under applicable retention policies separately if necessary; code changes cannot erase existing logs.
- Validate full regression suite and isolated new tests. Confirm relevant Preview Cloudflare deployment after operator push.
- Any live merchant-account, payment, migration, or Production deployment action requires separate authorization.
