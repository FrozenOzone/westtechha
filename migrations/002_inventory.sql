-- WestTech Home Automation component-based inventory.
-- Run this on the same D1 database used by ORDERS_DB, or bind a separate D1 database as INVENTORY_DB.

CREATE TABLE IF NOT EXISTS component_inventory (
  component_sku TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  stock_qty INTEGER NOT NULL DEFAULT 0 CHECK (stock_qty >= 0),
  low_stock_threshold INTEGER NOT NULL DEFAULT 4 CHECK (low_stock_threshold >= 0),
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS product_components (
  product_sku TEXT NOT NULL,
  component_sku TEXT NOT NULL,
  qty_required INTEGER NOT NULL DEFAULT 1 CHECK (qty_required > 0),
  PRIMARY KEY (product_sku, component_sku),
  FOREIGN KEY (component_sku) REFERENCES component_inventory(component_sku)
);

CREATE TABLE IF NOT EXISTS inventory_holds (
  hold_id TEXT PRIMARY KEY,
  invoice_id TEXT,
  paypal_order_id TEXT,
  product_sku TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_inventory_holds_invoice_id ON inventory_holds(invoice_id);
CREATE INDEX IF NOT EXISTS idx_inventory_holds_paypal_order_id ON inventory_holds(paypal_order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_holds_status_expires ON inventory_holds(status, expires_at);

CREATE TABLE IF NOT EXISTS inventory_movements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  movement_type TEXT NOT NULL,
  component_sku TEXT NOT NULL,
  product_sku TEXT,
  quantity_delta INTEGER NOT NULL,
  invoice_id TEXT,
  paypal_order_id TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_inventory_movements_component_sku ON inventory_movements(component_sku);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_invoice_id ON inventory_movements(invoice_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_paypal_order_id ON inventory_movements(paypal_order_id);

INSERT OR IGNORE INTO component_inventory (component_sku, name, stock_qty, low_stock_threshold) VALUES
  ('scout-30-enclosure', 'Scout 30 enclosure with brass inserts', 0, 4),
  ('scout-38-enclosure', 'Scout 38 enclosure with brass inserts', 0, 4),
  ('ranger-30-enclosure', 'Ranger 30 enclosure with brass inserts', 0, 4),
  ('ranger-38-enclosure', 'Ranger 38 enclosure with brass inserts', 0, 4),
  ('ranger-30-bucks-enclosure', 'Ranger Bucks 30 enclosure with brass inserts', 0, 4),
  ('ranger-38-bucks-enclosure', 'Ranger Bucks 38 enclosure with brass inserts', 0, 4),
  ('command-30-enclosure', 'Command Core 30 enclosure with brass inserts', 0, 4),
  ('command-38-enclosure', 'Command Core 38 enclosure with brass inserts', 0, 4),
  ('command-30-gp-enclosure', 'Command-GP 30 Garage Panel enclosure with brass inserts', 0, 4),
  ('command-38-gp-enclosure', 'Command-GP 38 Garage Panel enclosure with brass inserts', 0, 4),
  ('esp32-30-kit', '30-pin ESP32 and matching breakout board', 0, 4),
  ('esp32-38-kit', '38-pin ESP32 and matching breakout board', 0, 4),
  ('relay-module', 'Relay module', 0, 4),
  ('buck-converter', 'Buck converter', 0, 4),
  ('oled-096', 'Optional 0.96 inch OLED display', 0, 4),
  ('buzzer', 'Optional buzzer', 0, 4);

INSERT OR IGNORE INTO product_components (product_sku, component_sku, qty_required) VALUES
  ('scout-30-unloaded', 'scout-30-enclosure', 1),
  ('scout-38-unloaded', 'scout-38-enclosure', 1),
  ('ranger-30-unloaded', 'ranger-30-enclosure', 1),
  ('ranger-38-unloaded', 'ranger-38-enclosure', 1),
  ('ranger-30-bucks-unloaded', 'ranger-30-bucks-enclosure', 1),
  ('ranger-38-bucks-unloaded', 'ranger-38-bucks-enclosure', 1),
  ('command-30-unloaded', 'command-30-enclosure', 1),
  ('command-38-unloaded', 'command-38-enclosure', 1),
  ('command-30-gp-unloaded', 'command-30-gp-enclosure', 1),
  ('command-38-gp-unloaded', 'command-38-gp-enclosure', 1),

  ('scout-30-loaded', 'scout-30-enclosure', 1),
  ('scout-30-loaded', 'esp32-30-kit', 1),
  ('scout-38-loaded', 'scout-38-enclosure', 1),
  ('scout-38-loaded', 'esp32-38-kit', 1),

  ('ranger-30-loaded', 'ranger-30-enclosure', 1),
  ('ranger-30-loaded', 'esp32-30-kit', 1),
  ('ranger-30-loaded', 'relay-module', 1),
  ('ranger-38-loaded', 'ranger-38-enclosure', 1),
  ('ranger-38-loaded', 'esp32-38-kit', 1),
  ('ranger-38-loaded', 'relay-module', 1),

  ('ranger-30-bucks-loaded', 'ranger-30-bucks-enclosure', 1),
  ('ranger-30-bucks-loaded', 'esp32-30-kit', 1),
  ('ranger-30-bucks-loaded', 'buck-converter', 1),
  ('ranger-38-bucks-loaded', 'ranger-38-bucks-enclosure', 1),
  ('ranger-38-bucks-loaded', 'esp32-38-kit', 1),
  ('ranger-38-bucks-loaded', 'buck-converter', 1),

  ('command-30-loaded', 'command-30-enclosure', 1),
  ('command-30-loaded', 'esp32-30-kit', 1),
  ('command-30-loaded', 'relay-module', 1),
  ('command-30-loaded', 'buck-converter', 1),
  ('command-38-loaded', 'command-38-enclosure', 1),
  ('command-38-loaded', 'esp32-38-kit', 1),
  ('command-38-loaded', 'relay-module', 1),
  ('command-38-loaded', 'buck-converter', 1),

  ('command-30-gp-loaded', 'command-30-gp-enclosure', 1),
  ('command-30-gp-loaded', 'esp32-30-kit', 1),
  ('command-30-gp-loaded', 'relay-module', 1),
  ('command-30-gp-loaded', 'buck-converter', 1),
  ('command-38-gp-loaded', 'command-38-gp-enclosure', 1),
  ('command-38-gp-loaded', 'esp32-38-kit', 1),
  ('command-38-gp-loaded', 'relay-module', 1),
  ('command-38-gp-loaded', 'buck-converter', 1);
