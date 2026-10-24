-- WestTechHA Sales & Invoices, independent of product orders.
-- Additive: no changes to existing customer, coaster, or PayPal tables.
CREATE TABLE IF NOT EXISTS sales_invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_number TEXT UNIQUE,
  public_token TEXT NOT NULL UNIQUE,
  customer_name TEXT NOT NULL DEFAULT '',
  customer_email TEXT NOT NULL DEFAULT '',
  sale_type TEXT NOT NULL CHECK(sale_type IN ('QUICK_SALE','INVOICE')),
  location_label TEXT NOT NULL,
  address_json TEXT NOT NULL,
  items_json TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  discount_reason TEXT NOT NULL DEFAULT '',
  exempt_reason TEXT NOT NULL DEFAULT '',
  subtotal_cents INTEGER NOT NULL CHECK(subtotal_cents>=0),
  regular_cents INTEGER NOT NULL CHECK(regular_cents>=0),
  discount_cents INTEGER NOT NULL CHECK(discount_cents>=0),
  shipping_cents INTEGER NOT NULL DEFAULT 0 CHECK(shipping_cents>=0),
  taxable_cents INTEGER NOT NULL CHECK(taxable_cents>=0),
  tax_cents INTEGER NOT NULL CHECK(tax_cents>=0),
  total_cents INTEGER NOT NULL CHECK(total_cents>=0),
  tax_rate REAL NOT NULL,
  tax_source TEXT NOT NULL,
  tax_jurisdiction TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','SENDING','SENT','SEND_REVIEW','PAYMENT_PENDING','CAPTURING','PAID','CHECK_PENDING','VOID')),
  payment_method TEXT NOT NULL DEFAULT '',
  paypal_order_id TEXT UNIQUE,
  paypal_capture_id TEXT UNIQUE,
  sent_at TEXT,
  paid_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_status ON sales_invoices(status,created_at);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_customer ON sales_invoices(customer_email,created_at);
CREATE TABLE IF NOT EXISTS sales_payment_attempts (
  attempt_id TEXT PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES sales_invoices(id),
  method TEXT NOT NULL CHECK(method IN ('PAYPAL','VENMO')),
  provider_order_id TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK(status IN ('CREATING','CREATED','CANCELED','CAPTURING','CAPTURED','FAILED')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sales_payment_invoice ON sales_payment_attempts(invoice_id,created_at);
CREATE TABLE IF NOT EXISTS sales_invoice_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES sales_invoices(id),
  event_type TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sales_events_invoice ON sales_invoice_events(invoice_id,created_at);
