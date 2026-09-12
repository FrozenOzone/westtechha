ALTER TABLE custom_orders
ADD COLUMN production_required INTEGER NOT NULL DEFAULT 1
CHECK (production_required IN (0, 1));

PRAGMA optimize;
