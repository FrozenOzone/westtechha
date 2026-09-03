-- PayPal Orders / Checkout state for custom coaster payments.
-- Reuses the same GET_FROM_FILE shipping-address model as the Enclosures checkout.
-- Apply after 010_coaster_fulfillment_completion.sql.

ALTER TABLE coaster_orders ADD COLUMN paypal_order_id TEXT;
ALTER TABLE coaster_orders ADD COLUMN paypal_approval_url TEXT;
ALTER TABLE coaster_orders ADD COLUMN paypal_order_status TEXT;
ALTER TABLE coaster_orders ADD COLUMN paypal_capture_id TEXT;

CREATE INDEX IF NOT EXISTS idx_coaster_orders_paypal_order_id
  ON coaster_orders(paypal_order_id);
