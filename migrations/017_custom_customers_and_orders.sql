CREATE TABLE custom_customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  display_name TEXT NOT NULL,
  company_name TEXT,
  contact_name TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  default_fulfillment_method TEXT NOT NULL DEFAULT 'UNSET'
    CHECK (default_fulfillment_method IN ('UNSET', 'SHIP', 'LOCAL_PICKUP')),
  pricing_notes TEXT,
  internal_notes TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_custom_customers_name
ON custom_customers(display_name, company_name, id);

CREATE INDEX idx_custom_customers_email
ON custom_customers(email);

CREATE TABLE custom_order_counters (
  order_date TEXT PRIMARY KEY,
  last_value INTEGER NOT NULL
);

CREATE TABLE custom_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL UNIQUE,
  order_date TEXT NOT NULL,
  daily_sequence INTEGER NOT NULL,
  customer_id INTEGER,
  status TEXT NOT NULL DEFAULT 'DRAFT',

  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,
  title TEXT NOT NULL,
  line_items_json TEXT NOT NULL DEFAULT '[]',
  customer_note TEXT,
  admin_notes TEXT,

  fulfillment_method TEXT NOT NULL DEFAULT 'UNSET'
    CHECK (fulfillment_method IN ('UNSET', 'SHIP', 'LOCAL_PICKUP')),
  payment_required INTEGER NOT NULL DEFAULT 1 CHECK (payment_required IN (0, 1)),
  subtotal_amount REAL NOT NULL DEFAULT 0,
  taxable_amount_before_discount REAL NOT NULL DEFAULT 0,
  discount_amount REAL NOT NULL DEFAULT 0,
  shipping_amount REAL NOT NULL DEFAULT 0,
  final_amount REAL NOT NULL DEFAULT 0,

  estimated_printer_minutes INTEGER NOT NULL DEFAULT 360,
  printer_assignment TEXT,
  production_window TEXT,

  order_version INTEGER NOT NULL DEFAULT 0,
  approval_token_hash TEXT,
  approval_expires_at TEXT,
  order_sent_at TEXT,
  order_approved_at TEXT,
  changes_requested_at TEXT,
  customer_change_request TEXT,

  payment_status TEXT NOT NULL DEFAULT 'NOT_REQUESTED',
  paypal_order_id TEXT,
  paypal_approval_url TEXT,
  paypal_order_status TEXT,
  paypal_capture_id TEXT,
  paypal_paid_at TEXT,
  paypal_last_error TEXT,

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
  shipping_country TEXT,
  tracking_carrier TEXT,
  tracking_number TEXT,
  pickup_ready_at TEXT,
  shipped_at TEXT,
  completed_at TEXT,
  archived_at TEXT,

  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_custom_orders_status_created
ON custom_orders(status, created_at, id);

CREATE INDEX idx_custom_orders_customer
ON custom_orders(customer_id, created_at, id);

CREATE TABLE custom_order_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_custom_order_events_order
ON custom_order_events(order_id, created_at, id);

CREATE TABLE custom_order_work_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  work_type TEXT NOT NULL,
  minutes INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_custom_order_work_log_order
ON custom_order_work_log(order_id, created_at, id);

CREATE TABLE manufacturing_work_orders_v2 (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL CHECK (source_type IN ('COASTER', 'ENCLOSURE', 'CUSTOM')),
  source_order_id TEXT NOT NULL,
  queued_at TEXT NOT NULL,
  estimated_printer_minutes INTEGER NOT NULL DEFAULT 0 CHECK (estimated_printer_minutes >= 0),
  remaining_printer_minutes INTEGER NOT NULL DEFAULT 0 CHECK (remaining_printer_minutes >= 0),
  printer_assignment TEXT NOT NULL DEFAULT 'UNASSIGNED'
    CHECK (printer_assignment IN ('UNASSIGNED', 'K2_1', 'K2_2', 'BOTH')),
  is_paused INTEGER NOT NULL DEFAULT 0 CHECK (is_paused IN (0, 1)),
  pause_reason TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (source_type, source_order_id)
);

INSERT INTO manufacturing_work_orders_v2 (
  id, source_type, source_order_id, queued_at, estimated_printer_minutes,
  remaining_printer_minutes, printer_assignment, is_paused, pause_reason,
  created_at, updated_at
)
SELECT
  id, source_type, source_order_id, queued_at, estimated_printer_minutes,
  remaining_printer_minutes, printer_assignment, is_paused, pause_reason,
  created_at, updated_at
FROM manufacturing_work_orders;

DROP TABLE manufacturing_work_orders;
ALTER TABLE manufacturing_work_orders_v2 RENAME TO manufacturing_work_orders;

CREATE INDEX idx_manufacturing_work_orders_fifo
ON manufacturing_work_orders(is_paused, queued_at, id);

CREATE INDEX idx_manufacturing_work_orders_source
ON manufacturing_work_orders(source_type, source_order_id);

PRAGMA optimize;
