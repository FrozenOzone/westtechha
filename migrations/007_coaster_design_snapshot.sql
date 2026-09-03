-- Exact customer-submitted coaster design snapshot.
-- Apply after 006_coaster_admin_review.sql.
-- The SVG snapshot itself is stored privately in COASTER_ARTWORK (R2).

ALTER TABLE coaster_orders ADD COLUMN design_snapshot_object_key TEXT;
