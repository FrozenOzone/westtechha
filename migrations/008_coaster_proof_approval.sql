-- WestTech custom coaster proof + customer approval workflow.
-- Apply after 007_coaster_design_snapshot.sql.

ALTER TABLE coaster_orders ADD COLUMN proof_source TEXT;
ALTER TABLE coaster_orders ADD COLUMN proof_object_key TEXT;
ALTER TABLE coaster_orders ADD COLUMN proof_filename TEXT;
ALTER TABLE coaster_orders ADD COLUMN proof_content_type TEXT;
ALTER TABLE coaster_orders ADD COLUMN proof_size_bytes INTEGER;
ALTER TABLE coaster_orders ADD COLUMN approval_token_hash TEXT;
ALTER TABLE coaster_orders ADD COLUMN approval_expires_at TEXT;
ALTER TABLE coaster_orders ADD COLUMN proof_sent_at TEXT;
ALTER TABLE coaster_orders ADD COLUMN proof_approved_at TEXT;
ALTER TABLE coaster_orders ADD COLUMN changes_requested_at TEXT;
ALTER TABLE coaster_orders ADD COLUMN customer_change_request TEXT;
