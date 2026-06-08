INSERT OR IGNORE INTO component_inventory (component_sku, name, stock_qty, low_stock_threshold, is_active) VALUES ('ranger-30-bucks-enclosure', 'Ranger Bucks 30 enclosure with brass inserts', 0, 4, 1);
INSERT OR IGNORE INTO component_inventory (component_sku, name, stock_qty, low_stock_threshold, is_active) VALUES ('ranger-38-bucks-enclosure', 'Ranger Bucks 38 enclosure with brass inserts', 0, 4, 1);
INSERT OR IGNORE INTO component_inventory (component_sku, name, stock_qty, low_stock_threshold, is_active) VALUES ('esp32-30-kit', '30-pin ESP32 and matching breakout board', 0, 4, 1);
INSERT OR IGNORE INTO component_inventory (component_sku, name, stock_qty, low_stock_threshold, is_active) VALUES ('esp32-38-kit', '38-pin ESP32 and matching breakout board', 0, 4, 1);
INSERT OR IGNORE INTO component_inventory (component_sku, name, stock_qty, low_stock_threshold, is_active) VALUES ('buck-converter', 'Buck converter', 0, 4, 1);

UPDATE component_inventory SET name = 'Ranger Bucks 30 enclosure with brass inserts', is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE component_sku = 'ranger-30-bucks-enclosure';
UPDATE component_inventory SET name = 'Ranger Bucks 38 enclosure with brass inserts', is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE component_sku = 'ranger-38-bucks-enclosure';

INSERT OR IGNORE INTO product_components (product_sku, component_sku, qty_required) VALUES ('ranger-30-bucks-unloaded', 'ranger-30-bucks-enclosure', 1);
INSERT OR IGNORE INTO product_components (product_sku, component_sku, qty_required) VALUES ('ranger-38-bucks-unloaded', 'ranger-38-bucks-enclosure', 1);

INSERT OR IGNORE INTO product_components (product_sku, component_sku, qty_required) VALUES ('ranger-30-bucks-loaded', 'ranger-30-bucks-enclosure', 1);
INSERT OR IGNORE INTO product_components (product_sku, component_sku, qty_required) VALUES ('ranger-30-bucks-loaded', 'esp32-30-kit', 1);
INSERT OR IGNORE INTO product_components (product_sku, component_sku, qty_required) VALUES ('ranger-30-bucks-loaded', 'buck-converter', 1);

INSERT OR IGNORE INTO product_components (product_sku, component_sku, qty_required) VALUES ('ranger-38-bucks-loaded', 'ranger-38-bucks-enclosure', 1);
INSERT OR IGNORE INTO product_components (product_sku, component_sku, qty_required) VALUES ('ranger-38-bucks-loaded', 'esp32-38-kit', 1);
INSERT OR IGNORE INTO product_components (product_sku, component_sku, qty_required) VALUES ('ranger-38-bucks-loaded', 'buck-converter', 1);

UPDATE component_inventory SET stock_qty = 999, is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE component_sku = 'ranger-30-bucks-enclosure';
UPDATE component_inventory SET stock_qty = 999, is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE component_sku = 'ranger-38-bucks-enclosure';
