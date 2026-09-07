ALTER TABLE enclosure_orders ADD COLUMN loaded_components_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE enclosure_orders ADD COLUMN loaded_components_amount REAL NOT NULL DEFAULT 0;

PRAGMA optimize;
