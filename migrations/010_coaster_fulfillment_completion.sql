-- Shipping + fulfillment lifecycle fields for custom coaster orders.
-- Apply after 009_coaster_paypal_invoicing.sql.

ALTER TABLE coaster_orders ADD COLUMN shipping_name TEXT;
ALTER TABLE coaster_orders ADD COLUMN shipping_address1 TEXT;
ALTER TABLE coaster_orders ADD COLUMN shipping_address2 TEXT;
ALTER TABLE coaster_orders ADD COLUMN shipping_city TEXT;
ALTER TABLE coaster_orders ADD COLUMN shipping_region TEXT;
ALTER TABLE coaster_orders ADD COLUMN shipping_postal_code TEXT;
ALTER TABLE coaster_orders ADD COLUMN shipping_country TEXT DEFAULT 'US';
ALTER TABLE coaster_orders ADD COLUMN tracking_carrier TEXT;
ALTER TABLE coaster_orders ADD COLUMN tracking_number TEXT;
ALTER TABLE coaster_orders ADD COLUMN pickup_ready_at TEXT;
ALTER TABLE coaster_orders ADD COLUMN shipped_at TEXT;
ALTER TABLE coaster_orders ADD COLUMN completed_at TEXT;
