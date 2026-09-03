-- WestTech custom coaster order intake.
-- Uses the existing ORDERS_DB D1 binding. Customer artwork itself is stored in
-- the COASTER_ARTWORK R2 bucket; D1 stores only the private object key/metadata.

CREATE TABLE IF NOT EXISTS coaster_order_counters (
  order_date TEXT PRIMARY KEY,
  last_value INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS coaster_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL UNIQUE,
  order_date TEXT NOT NULL,
  daily_sequence INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'DESIGN_REVIEW',

  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,

  set_size INTEGER NOT NULL CHECK (set_size IN (4, 8)),
  set_count INTEGER NOT NULL DEFAULT 1,
  total_coasters INTEGER NOT NULL,

  top_text TEXT,
  bottom_text TEXT,
  field_color TEXT NOT NULL,
  accent_color TEXT NOT NULL,
  ring_color TEXT NOT NULL,
  text_color TEXT NOT NULL,
  customer_notes TEXT,
  rights_confirmed INTEGER NOT NULL DEFAULT 0,

  artwork_filename TEXT NOT NULL,
  artwork_content_type TEXT NOT NULL,
  artwork_size_bytes INTEGER NOT NULL DEFAULT 0,
  artwork_object_key TEXT NOT NULL,

  -- WestTech-controlled commercial fields. These are intentionally not set by
  -- the public builder. The future review/admin screen owns these decisions.
  fulfillment_method TEXT NOT NULL DEFAULT 'UNSET',
  payment_required INTEGER NOT NULL DEFAULT 1,
  base_price REAL,
  artwork_charge REAL,
  other_charge REAL,
  shipping_amount REAL,
  discount_amount REAL,
  final_amount REAL,
  admin_notes TEXT,

  proof_version INTEGER NOT NULL DEFAULT 0,
  proof_status TEXT NOT NULL DEFAULT 'NOT_SENT',
  paypal_invoice_id TEXT,
  paypal_invoice_url TEXT,
  payment_status TEXT NOT NULL DEFAULT 'NOT_REQUESTED',

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_coaster_orders_status
  ON coaster_orders(status, created_at);

CREATE INDEX IF NOT EXISTS idx_coaster_orders_email
  ON coaster_orders(customer_email, created_at);

CREATE TABLE IF NOT EXISTS coaster_order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES coaster_orders(order_id)
);

CREATE INDEX IF NOT EXISTS idx_coaster_order_events_order
  ON coaster_order_events(order_id, created_at);

CREATE TABLE IF NOT EXISTS coaster_order_work_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  work_type TEXT NOT NULL,
  minutes INTEGER NOT NULL DEFAULT 0,
  billable_amount REAL,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES coaster_orders(order_id)
);

CREATE INDEX IF NOT EXISTS idx_coaster_order_work_log_order
  ON coaster_order_work_log(order_id, created_at);
