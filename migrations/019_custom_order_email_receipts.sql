CREATE TABLE IF NOT EXISTS custom_order_email_receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  email_type TEXT NOT NULL,
  audience TEXT NOT NULL DEFAULT 'CUSTOMER',
  recipient TEXT NOT NULL,
  subject TEXT,
  idempotency_key TEXT NOT NULL UNIQUE,
  provider TEXT NOT NULL DEFAULT 'RESEND',
  provider_email_id TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'SENDING',
  sent_at TEXT,
  delivered_at TEXT,
  opened_at TEXT,
  clicked_at TEXT,
  delayed_at TEXT,
  bounced_at TEXT,
  complained_at TEXT,
  failed_at TEXT,
  last_event_at TEXT,
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES custom_orders(order_id)
);

CREATE INDEX IF NOT EXISTS idx_custom_email_receipts_order
  ON custom_order_email_receipts(order_id, created_at DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_custom_email_receipts_provider
  ON custom_order_email_receipts(provider_email_id);

CREATE TABLE IF NOT EXISTS custom_order_email_webhook_events (
  webhook_id TEXT PRIMARY KEY,
  provider_email_id TEXT,
  event_type TEXT NOT NULL,
  received_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_custom_email_webhook_provider
  ON custom_order_email_webhook_events(provider_email_id, received_at DESC);

CREATE TABLE IF NOT EXISTS custom_order_customer_views (
  order_id TEXT NOT NULL,
  order_version INTEGER NOT NULL,
  first_viewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_viewed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  view_count INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (order_id, order_version),
  FOREIGN KEY (order_id) REFERENCES custom_orders(order_id)
);

INSERT OR IGNORE INTO custom_order_email_receipts (
  order_id,
  email_type,
  audience,
  recipient,
  subject,
  idempotency_key,
  provider,
  provider_email_id,
  status,
  sent_at,
  last_event_at,
  created_at,
  updated_at
)
SELECT
  order_id,
  COALESCE(json_extract(detail, '$.emailType'), 'CUSTOM_ORDER_EMAIL'),
  CASE WHEN COALESCE(json_extract(detail, '$.emailType'), '') LIKE 'ADMIN_%' THEN 'ADMIN' ELSE 'CUSTOMER' END,
  COALESCE(json_extract(detail, '$.to'), ''),
  json_extract(detail, '$.subject'),
  COALESCE(json_extract(detail, '$.idempotencyKey'), 'legacy-' || order_id || '-' || id),
  COALESCE(json_extract(detail, '$.provider'), 'RESEND'),
  json_extract(detail, '$.providerId'),
  'SENT',
  created_at,
  created_at,
  created_at,
  created_at
FROM custom_order_events
WHERE event_type = 'EMAIL_SENT'
  AND json_valid(detail)
  AND COALESCE(json_extract(detail, '$.to'), '') <> '';
