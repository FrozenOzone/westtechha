-- PayPal payment-state fields introduced during the invoicing prototype.
-- v24+ uses PayPal Orders/Checkout (see 011); these shared timestamps/error fields remain in use.
-- Apply after 008_coaster_proof_approval.sql.

ALTER TABLE coaster_orders ADD COLUMN paypal_invoice_status TEXT;
ALTER TABLE coaster_orders ADD COLUMN paypal_invoicer_url TEXT;
ALTER TABLE coaster_orders ADD COLUMN paypal_invoice_sent_at TEXT;
ALTER TABLE coaster_orders ADD COLUMN paypal_paid_at TEXT;
ALTER TABLE coaster_orders ADD COLUMN paypal_payment_id TEXT;
ALTER TABLE coaster_orders ADD COLUMN paypal_last_error TEXT;

CREATE TABLE IF NOT EXISTS coaster_paypal_webhook_events (
  event_id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  paypal_invoice_id TEXT,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_coaster_paypal_webhook_invoice
  ON coaster_paypal_webhook_events(paypal_invoice_id, received_at);
