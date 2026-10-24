-- WestTechHA Stage 5: independent provider payment attempts.
-- Never replace an already-issued PayPal order simply because a customer explores Venmo.
CREATE TABLE IF NOT EXISTS coaster_payment_attempts (
  attempt_id TEXT PRIMARY KEY,
  coaster_order_id TEXT NOT NULL,
  method TEXT NOT NULL CHECK(method IN ('VENMO')),
  provider TEXT NOT NULL DEFAULT 'PAYPAL_ORDERS',
  provider_order_id TEXT NOT NULL UNIQUE,
  amount TEXT NOT NULL,
  quote_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'CREATED',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_coaster_payment_attempts_order ON coaster_payment_attempts(coaster_order_id,created_at);
