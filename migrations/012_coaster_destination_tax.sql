-- Colorado destination-tax state for custom coaster PayPal checkout.
-- Shipped orders use the PayPal-confirmed address; local pickup uses WestTech's pickup address.
-- Apply after 011_coaster_paypal_orders.sql.

ALTER TABLE coaster_orders ADD COLUMN taxable_amount REAL NOT NULL DEFAULT 0;
ALTER TABLE coaster_orders ADD COLUMN tax_amount REAL NOT NULL DEFAULT 0;
ALTER TABLE coaster_orders ADD COLUMN tax_rate REAL NOT NULL DEFAULT 0;
ALTER TABLE coaster_orders ADD COLUMN tax_jurisdiction_code TEXT;
ALTER TABLE coaster_orders ADD COLUMN tax_source TEXT;
ALTER TABLE coaster_orders ADD COLUMN tax_address_source TEXT;
ALTER TABLE coaster_orders ADD COLUMN tax_address_json TEXT;
ALTER TABLE coaster_orders ADD COLUMN tax_quote_json TEXT;
ALTER TABLE coaster_orders ADD COLUMN payment_total REAL NOT NULL DEFAULT 0;
ALTER TABLE coaster_orders ADD COLUMN tax_prepared_at TEXT;
ALTER TABLE coaster_orders ADD COLUMN tax_confirmed_at TEXT;
