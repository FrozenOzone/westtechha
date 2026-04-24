CREATE TABLE IF NOT EXISTS order_counters (
  order_date TEXT PRIMARY KEY,
  last_value INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id TEXT NOT NULL UNIQUE,
  custom_id TEXT NOT NULL,
  order_date TEXT NOT NULL,
  daily_sequence INTEGER NOT NULL,
  paypal_order_id TEXT,
  paypal_capture_id TEXT,
  status TEXT NOT NULL DEFAULT 'CREATED',
  item_amount REAL NOT NULL DEFAULT 0,
  shipping_amount REAL NOT NULL DEFAULT 0,
  tax_amount REAL NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL DEFAULT 0,
  customer_name TEXT,
  customer_email TEXT,
  shipping_address_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
