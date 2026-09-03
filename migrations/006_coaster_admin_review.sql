-- WestTech custom coaster admin-review additions.
-- Apply after 005_coaster_orders.sql.

ALTER TABLE coaster_orders ADD COLUMN customer_review_note TEXT;
ALTER TABLE coaster_orders ADD COLUMN review_saved_at TEXT;
