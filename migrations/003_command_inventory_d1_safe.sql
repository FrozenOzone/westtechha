INSERT OR IGNORE INTO component_inventory (component_sku, name, stock_qty, low_stock_threshold, is_active) VALUES ('command-30-enclosure', 'Command Core 30 enclosure with brass inserts', 0, 4, 1);
INSERT OR IGNORE INTO component_inventory (component_sku, name, stock_qty, low_stock_threshold, is_active) VALUES ('command-38-enclosure', 'Command Core 38 enclosure with brass inserts', 0, 4, 1);
INSERT OR IGNORE INTO component_inventory (component_sku, name, stock_qty, low_stock_threshold, is_active) VALUES ('command-30-gp-enclosure', 'Command-GP 30 Garage Panel enclosure with brass inserts', 0, 4, 1);
INSERT OR IGNORE INTO component_inventory (component_sku, name, stock_qty, low_stock_threshold, is_active) VALUES ('command-38-gp-enclosure', 'Command-GP 38 Garage Panel enclosure with brass inserts', 0, 4, 1);
INSERT OR IGNORE INTO component_inventory (component_sku, name, stock_qty, low_stock_threshold, is_active) VALUES ('esp32-30-kit', '30-pin ESP32 and matching breakout board', 0, 4, 1);
INSERT OR IGNORE INTO component_inventory (component_sku, name, stock_qty, low_stock_threshold, is_active) VALUES ('esp32-38-kit', '38-pin ESP32 and matching breakout board', 0, 4, 1);
INSERT OR IGNORE INTO component_inventory (component_sku, name, stock_qty, low_stock_threshold, is_active) VALUES ('relay-module', 'Relay module', 0, 4, 1);
INSERT OR IGNORE INTO component_inventory (component_sku, name, stock_qty, low_stock_threshold, is_active) VALUES ('buck-converter', 'Buck converter', 0, 4, 1);

UPDATE component_inventory SET name = 'Command Core 30 enclosure with brass inserts', is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE component_sku = 'command-30-enclosure';
UPDATE component_inventory SET name = 'Command Core 38 enclosure with brass inserts', is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE component_sku = 'command-38-enclosure';
UPDATE component_inventory SET name = 'Command-GP 30 Garage Panel enclosure with brass inserts', is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE component_sku = 'command-30-gp-enclosure';
UPDATE component_inventory SET name = 'Command-GP 38 Garage Panel enclosure with brass inserts', is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE component_sku = 'command-38-gp-enclosure';

INSERT OR IGNORE INTO product_components (product_sku, component_sku, qty_required) VALUES ('command-30-unloaded', 'command-30-enclosure', 1);
INSERT OR IGNORE INTO product_components (product_sku, component_sku, qty_required) VALUES ('command-38-unloaded', 'command-38-enclosure', 1);
INSERT OR IGNORE INTO product_components (product_sku, component_sku, qty_required) VALUES ('command-30-gp-unloaded', 'command-30-gp-enclosure', 1);
INSERT OR IGNORE INTO product_components (product_sku, component_sku, qty_required) VALUES ('command-38-gp-unloaded', 'command-38-gp-enclosure', 1);

INSERT OR IGNORE INTO product_components (product_sku, component_sku, qty_required) VALUES ('command-30-loaded', 'command-30-enclosure', 1);
INSERT OR IGNORE INTO product_components (product_sku, component_sku, qty_required) VALUES ('command-30-loaded', 'esp32-30-kit', 1);
INSERT OR IGNORE INTO product_components (product_sku, component_sku, qty_required) VALUES ('command-30-loaded', 'relay-module', 1);
INSERT OR IGNORE INTO product_components (product_sku, component_sku, qty_required) VALUES ('command-30-loaded', 'buck-converter', 1);

INSERT OR IGNORE INTO product_components (product_sku, component_sku, qty_required) VALUES ('command-38-loaded', 'command-38-enclosure', 1);
INSERT OR IGNORE INTO product_components (product_sku, component_sku, qty_required) VALUES ('command-38-loaded', 'esp32-38-kit', 1);
INSERT OR IGNORE INTO product_components (product_sku, component_sku, qty_required) VALUES ('command-38-loaded', 'relay-module', 1);
INSERT OR IGNORE INTO product_components (product_sku, component_sku, qty_required) VALUES ('command-38-loaded', 'buck-converter', 1);

INSERT OR IGNORE INTO product_components (product_sku, component_sku, qty_required) VALUES ('command-30-gp-loaded', 'command-30-gp-enclosure', 1);
INSERT OR IGNORE INTO product_components (product_sku, component_sku, qty_required) VALUES ('command-30-gp-loaded', 'esp32-30-kit', 1);
INSERT OR IGNORE INTO product_components (product_sku, component_sku, qty_required) VALUES ('command-30-gp-loaded', 'relay-module', 1);
INSERT OR IGNORE INTO product_components (product_sku, component_sku, qty_required) VALUES ('command-30-gp-loaded', 'buck-converter', 1);

INSERT OR IGNORE INTO product_components (product_sku, component_sku, qty_required) VALUES ('command-38-gp-loaded', 'command-38-gp-enclosure', 1);
INSERT OR IGNORE INTO product_components (product_sku, component_sku, qty_required) VALUES ('command-38-gp-loaded', 'esp32-38-kit', 1);
INSERT OR IGNORE INTO product_components (product_sku, component_sku, qty_required) VALUES ('command-38-gp-loaded', 'relay-module', 1);
INSERT OR IGNORE INTO product_components (product_sku, component_sku, qty_required) VALUES ('command-38-gp-loaded', 'buck-converter', 1);

UPDATE component_inventory SET stock_qty = 999, is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE component_sku = 'command-30-enclosure';
UPDATE component_inventory SET stock_qty = 999, is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE component_sku = 'command-38-enclosure';
UPDATE component_inventory SET stock_qty = 999, is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE component_sku = 'command-30-gp-enclosure';
UPDATE component_inventory SET stock_qty = 999, is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE component_sku = 'command-38-gp-enclosure';
