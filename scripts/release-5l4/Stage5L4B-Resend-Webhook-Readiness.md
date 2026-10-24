# WestTechHA Stage 5L4B — Resend Webhook Readiness

**Decision: HOLD — Preview-only regression and operating instructions; no Production mutation authorization.**

## Verified current design (2026-10-24, read-only)

- Existing live storefront sends transactional email via `RESEND_API_KEY`, which is **present** in both Cloudflare Pages environments. The API key is *not* the webhook signing secret.
- `POST /api/webhooks/resend` uses signed Svix/Resend headers and `RESEND_WEBHOOK_SECRET`; without the signing secret, it returns HTTP 503. The handler does not change email sending behavior.
- The existing webhook records **custom-order receipts only** in `custom_order_email_receipts` and `custom_order_email_webhook_events`; it does *not* update coaster `EMAIL_SENT` events. Coaster delivery tracking is a separate capability and **not established by this stage**.
- Production Pages currently has no `RESEND_WEBHOOK_SECRET` setting, though `RESEND_API_KEY` is configured. Production D1: 1 custom email receipt recorded `SENT`, 0 webhook events; 13 coaster `EMAIL_SENT` events. These are send records, *not evidence of inbox delivery*.
- Preview has a configured signing-secret setting and 31 recorded webhook events; event records alone do not establish successful matching of every customer receipt.
- Production Orders D1 `442f34a2-49bd-4a3b-8e58-75ba9c4d3eb0`, Preview Orders D1 `d09b2358-dfcd-4cb2-9c46-57175732c45c` stay separate. No credentials were read or exported.
- The Resend dashboard's actual registered Production webhook endpoint, event subscriptions, signature secret, and observed provider delivery remain **unverified**; Cloudflare Pages settings alone cannot prove these.

## Official Resend signature requirements

Signature verification requires `svix-id`, `svix-timestamp`, `svix-signature`, original request body, and the endpoint-specific `whsec_...` secret. The code checks HMAC-SHA256 signatures within a ±5-minute time window and deduplicates event IDs in D1. Documentation: https://resend.com/docs/dashboard/webhooks/introduction ; https://github.com/resend/resend-skills/blob/main/skills/resend/references/webhooks.md

## Safe Production setup procedure — operator approval required

1. **Do not create a second webhook blindly.** In the <https://resend.com/webhooks> dashboard, identify any existing Production endpoint. Check its status, allowed event types, and callback URL `https://westtechha.com/api/webhooks/resend`. If no Production endpoint exists and delivery tracking is desired, plan a **new, separately approved** endpoint. No Preview signing secret should be reused for Production.
2. The production webhook must be reachable publicly by Resend (no Cloudflare Access login screen) and must retain raw request-body data for HMAC verification. Keep the endpoint protected by signature verification, not by hiding it.
3. If an existing endpoint is correctly configured, obtain **that endpoint's** signing secret securely from Resend. If a new Production endpoint is explicitly approved, record its generated `whsec_` secret safely. Never paste the value into chat, ZIP, logs, screenshots, or Git.
4. In Cloudflare Pages **Production** environment settings, configure `RESEND_WEBHOOK_SECRET` as an **encrypted secret** only after separate owner authorization. Preserve `PAYPAL_ENV`, PayPal credentials, `RESEND_API_KEY`, D1/R2 bindings, and all existing live checkout settings. Some Pages config changes need a fresh Production deployment to take effect; this is a separate explicit decision.
5. In a planned, separately authorized test window, use Resend's webhook test/send event capability for the registered endpoint. Verify real `2xx` delivery acknowledgement for a correctly signed supported event, rejected invalid signatures, idempotent retries, and the corresponding D1 custom-order receipt transition where a matching receipt exists. A synthetic unmatched event must not be described as proof of actual customer inbox delivery.
6. Document email delivery from a real test inbox separately (or provider-delivered status plus owner mailbox review), without sending duplicate customer notifications. Confirm no customer or Admin address or signing secret appears in shared evidence.
7. If Production intentionally does *not* use webhooks, explicitly record **DISABLED BY DESIGN**, distinguish `SENT` from `DELIVERED` in operational reports, and decide whether delivery tracking is a hard requirement before lifting gate G2.

## Current scope / regression contract

This 5L4B package installs **only** four internal Preview files: this note, a non-secret audit snapshot, an offline audit script, and an isolated route regression test. The tests execute the actual checked-out webhook handler with **in-memory** D1, email, and crypto test fixtures—never real Resend, customer emails or Cloudflare resources. They assert no-secret=503, invalid/expired/tampered signature=401, authenticated delivery=receipt update, duplicate event idempotency, unknown receipt handling, bounce routing, and coaster/custom scope separation. They cannot prove live Resend registration or actual delivery.

## Release gate

**G2 status: awaiting provider endpoint evidence and explicit Production configuration disposition.** Keep Stage 5L4 Production release at **HOLD** until all remaining G1–G5 gates are reviewed; G1 was fixed in Preview Stage 5L4A but not yet promoted to Production. No Production database migration, secret update, webhook registration, payment or email send may be triggered by this kit.
