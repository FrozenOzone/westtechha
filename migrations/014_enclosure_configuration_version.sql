ALTER TABLE enclosure_orders
ADD COLUMN configuration_version INTEGER NOT NULL DEFAULT 0;

PRAGMA optimize;
