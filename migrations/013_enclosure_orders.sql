CREATE TABLE IF NOT EXISTS enclosure_order_counters (
  order_date TEXT PRIMARY KEY,
  last_value INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS enclosure_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL UNIQUE,
  order_date TEXT NOT NULL,
  daily_sequence INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'REQUEST_RECEIVED',

  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,

  sku TEXT NOT NULL,
  family TEXT NOT NULL,
  model TEXT NOT NULL,
  board_variant TEXT NOT NULL,
  offer_type TEXT NOT NULL,
  color TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  starting_unit_price REAL NOT NULL DEFAULT 0,
  starting_subtotal REAL NOT NULL DEFAULT 0,
  customer_notes TEXT,

  fulfillment_preference TEXT NOT NULL DEFAULT 'DISCUSS',
  fulfillment_method TEXT NOT NULL DEFAULT 'UNSET',
  payment_required INTEGER NOT NULL DEFAULT 1,
  product_amount REAL,
  custom_charge REAL,
  shipping_amount REAL,
  discount_amount REAL,
  final_amount REAL,
  customer_review_note TEXT,
  admin_notes TEXT,
  review_saved_at TEXT,

  estimated_printer_minutes INTEGER NOT NULL DEFAULT 0,
  printer_assignment TEXT,
  production_window TEXT,

  approval_token_hash TEXT,
  approval_expires_at TEXT,
  configuration_sent_at TEXT,
  configuration_approved_at TEXT,
  changes_requested_at TEXT,
  customer_change_request TEXT,

  paypal_order_id TEXT,
  paypal_approval_url TEXT,
  paypal_order_status TEXT,
  paypal_capture_id TEXT,
  paypal_paid_at TEXT,
  paypal_last_error TEXT,
  payment_status TEXT NOT NULL DEFAULT 'NOT_REQUESTED',

  taxable_amount REAL NOT NULL DEFAULT 0,
  tax_amount REAL NOT NULL DEFAULT 0,
  tax_rate REAL NOT NULL DEFAULT 0,
  tax_jurisdiction_code TEXT,
  tax_source TEXT,
  tax_address_source TEXT,
  tax_address_json TEXT,
  tax_quote_json TEXT,
  payment_total REAL NOT NULL DEFAULT 0,
  tax_prepared_at TEXT,
  tax_confirmed_at TEXT,

  shipping_name TEXT,
  shipping_address1 TEXT,
  shipping_address2 TEXT,
  shipping_city TEXT,
  shipping_region TEXT,
  shipping_postal_code TEXT,
  shipping_country TEXT DEFAULT 'US',
  tracking_carrier TEXT,
  tracking_number TEXT,
  pickup_ready_at TEXT,
  shipped_at TEXT,
  completed_at TEXT,
  archived_at TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS enclosure_order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES enclosure_orders(order_id)
);

CREATE TABLE IF NOT EXISTS enclosure_order_work_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  work_type TEXT NOT NULL,
  minutes INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES enclosure_orders(order_id)
);

CREATE INDEX IF NOT EXISTS idx_enclosure_orders_status_created
ON enclosure_orders(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_enclosure_orders_customer_email
ON enclosure_orders(customer_email);

CREATE INDEX IF NOT EXISTS idx_enclosure_order_events_order_created
ON enclosure_order_events(order_id, created_at);

CREATE INDEX IF NOT EXISTS idx_enclosure_order_work_log_order_created
ON enclosure_order_work_log(order_id, created_at);

PRAGMA optimize;
