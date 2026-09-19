-- WestTech customer portal, contact preference, and durable order ownership.

ALTER TABLE custom_customers ADD COLUMN communication_preference TEXT NOT NULL DEFAULT 'EMAIL'
  CHECK (communication_preference IN ('EMAIL', 'SMS'));
ALTER TABLE custom_customers ADD COLUMN sms_consent INTEGER NOT NULL DEFAULT 0
  CHECK (sms_consent IN (0, 1));
ALTER TABLE custom_customers ADD COLUMN sms_consented_at TEXT;

ALTER TABLE custom_orders ADD COLUMN communication_preference TEXT NOT NULL DEFAULT 'EMAIL'
  CHECK (communication_preference IN ('EMAIL', 'SMS'));
ALTER TABLE custom_orders ADD COLUMN sms_consent INTEGER NOT NULL DEFAULT 0
  CHECK (sms_consent IN (0, 1));

ALTER TABLE coaster_orders ADD COLUMN communication_preference TEXT NOT NULL DEFAULT 'EMAIL'
  CHECK (communication_preference IN ('EMAIL', 'SMS'));
ALTER TABLE coaster_orders ADD COLUMN sms_consent INTEGER NOT NULL DEFAULT 0
  CHECK (sms_consent IN (0, 1));

ALTER TABLE enclosure_orders ADD COLUMN communication_preference TEXT NOT NULL DEFAULT 'EMAIL'
  CHECK (communication_preference IN ('EMAIL', 'SMS'));
ALTER TABLE enclosure_orders ADD COLUMN sms_consent INTEGER NOT NULL DEFAULT 0
  CHECK (sms_consent IN (0, 1));

ALTER TABLE orders ADD COLUMN customer_phone TEXT;
ALTER TABLE orders ADD COLUMN communication_preference TEXT NOT NULL DEFAULT 'EMAIL'
  CHECK (communication_preference IN ('EMAIL', 'SMS'));
ALTER TABLE orders ADD COLUMN sms_consent INTEGER NOT NULL DEFAULT 0
  CHECK (sms_consent IN (0, 1));

CREATE TABLE store_order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id TEXT NOT NULL,
  product_sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  color TEXT,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_amount REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES orders(invoice_id)
);

CREATE INDEX idx_store_order_items_invoice ON store_order_items(invoice_id,id);

CREATE TABLE customer_accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL COLLATE NOCASE UNIQUE,
  pending_email TEXT COLLATE NOCASE,
  display_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  communication_preference TEXT NOT NULL DEFAULT 'EMAIL'
    CHECK (communication_preference IN ('EMAIL', 'SMS')),
  sms_consent INTEGER NOT NULL DEFAULT 0 CHECK (sms_consent IN (0, 1)),
  sms_consented_at TEXT,
  default_fulfillment_method TEXT NOT NULL DEFAULT 'UNSET'
    CHECK (default_fulfillment_method IN ('UNSET', 'SHIP', 'LOCAL_PICKUP')),
  address1 TEXT,
  address2 TEXT,
  city TEXT,
  region TEXT,
  postal_code TEXT,
  country TEXT NOT NULL DEFAULT 'US',
  email_verified_at TEXT,
  last_login_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customer_accounts_phone ON customer_accounts(phone);

CREATE TABLE customer_login_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('LOGIN', 'ACTIVATE', 'EMAIL_CHANGE')),
  token_hash TEXT NOT NULL UNIQUE,
  requested_email TEXT,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES customer_accounts(id)
);

CREATE INDEX idx_customer_login_tokens_account
ON customer_login_tokens(account_id, created_at DESC);

CREATE TABLE customer_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL,
  session_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES customer_accounts(id)
);

CREATE INDEX idx_customer_sessions_account
ON customer_sessions(account_id, expires_at);

CREATE TABLE customer_account_orders (
  account_id INTEGER NOT NULL,
  source_type TEXT NOT NULL CHECK (source_type IN ('CUSTOM', 'COASTER', 'ENCLOSURE', 'STORE')),
  source_order_id TEXT NOT NULL,
  linked_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (source_type, source_order_id),
  FOREIGN KEY (account_id) REFERENCES customer_accounts(id)
);

CREATE INDEX idx_customer_account_orders_account
ON customer_account_orders(account_id, linked_at DESC);

CREATE TABLE customer_account_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER,
  event_type TEXT NOT NULL,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (account_id) REFERENCES customer_accounts(id)
);

CREATE INDEX idx_customer_account_events_account
ON customer_account_events(account_id, created_at DESC);

PRAGMA optimize;
