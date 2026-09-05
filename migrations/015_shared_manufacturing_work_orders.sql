ALTER TABLE coaster_orders
ADD COLUMN estimated_printer_minutes INTEGER NOT NULL DEFAULT 0;

ALTER TABLE coaster_orders
ADD COLUMN printer_assignment TEXT;

ALTER TABLE coaster_orders
ADD COLUMN production_window TEXT;

CREATE TABLE manufacturing_capacity_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  active_printers INTEGER NOT NULL DEFAULT 2 CHECK (active_printers BETWEEN 1 AND 8),
  productive_minutes_per_printer_day INTEGER NOT NULL DEFAULT 1200 CHECK (productive_minutes_per_printer_day BETWEEN 60 AND 1440),
  handling_business_days INTEGER NOT NULL DEFAULT 2 CHECK (handling_business_days BETWEEN 0 AND 30),
  window_span_business_days INTEGER NOT NULL DEFAULT 2 CHECK (window_span_business_days BETWEEN 0 AND 30),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO manufacturing_capacity_settings (
  id,
  active_printers,
  productive_minutes_per_printer_day,
  handling_business_days,
  window_span_business_days
) VALUES (1, 2, 1200, 2, 2);

CREATE TABLE manufacturing_work_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_type TEXT NOT NULL CHECK (source_type IN ('COASTER', 'ENCLOSURE')),
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

CREATE INDEX idx_manufacturing_work_orders_fifo
ON manufacturing_work_orders(is_paused, queued_at, id);

CREATE INDEX idx_manufacturing_work_orders_source
ON manufacturing_work_orders(source_type, source_order_id);

INSERT OR IGNORE INTO manufacturing_work_orders (
  source_type,
  source_order_id,
  queued_at,
  estimated_printer_minutes,
  remaining_printer_minutes,
  printer_assignment
)
SELECT
  'COASTER',
  order_id,
  COALESCE(paypal_paid_at, updated_at, created_at),
  CASE WHEN estimated_printer_minutes > 0 THEN estimated_printer_minutes ELSE MAX(1, set_count) * 360 END,
  CASE
    WHEN status IN ('PRODUCTION_QUEUE', 'IN_PRODUCTION')
      THEN CASE WHEN estimated_printer_minutes > 0 THEN estimated_printer_minutes ELSE MAX(1, set_count) * 360 END
    ELSE 0
  END,
  CASE
    WHEN printer_assignment IN ('K2_1', 'K2_2', 'BOTH') THEN printer_assignment
    ELSE 'UNASSIGNED'
  END
FROM coaster_orders
WHERE payment_status IN ('PAID', 'NOT_REQUIRED');

INSERT OR IGNORE INTO manufacturing_work_orders (
  source_type,
  source_order_id,
  queued_at,
  estimated_printer_minutes,
  remaining_printer_minutes,
  printer_assignment
)
SELECT
  'ENCLOSURE',
  order_id,
  COALESCE(paypal_paid_at, updated_at, created_at),
  CASE WHEN estimated_printer_minutes > 0 THEN estimated_printer_minutes ELSE MAX(1, quantity) * 480 END,
  CASE
    WHEN status IN ('PRODUCTION_QUEUE', 'IN_PRODUCTION')
      THEN CASE WHEN estimated_printer_minutes > 0 THEN estimated_printer_minutes ELSE MAX(1, quantity) * 480 END
    ELSE 0
  END,
  CASE
    WHEN printer_assignment IN ('K2_1', 'K2_2', 'BOTH') THEN printer_assignment
    ELSE 'UNASSIGNED'
  END
FROM enclosure_orders
WHERE payment_status IN ('PAID', 'NOT_REQUIRED');

PRAGMA optimize;
