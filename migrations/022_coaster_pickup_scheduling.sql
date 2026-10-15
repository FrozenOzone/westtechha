-- WestTech coaster local pickup scheduling; additive migration after 021.
-- Customer-facing booking and address delivery are NOT enabled by this migration.
CREATE TABLE IF NOT EXISTS coaster_pickup_slots (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 order_id TEXT NOT NULL REFERENCES coaster_orders(order_id),
 local_date TEXT NOT NULL,
 local_time TEXT NOT NULL,
 duration_minutes INTEGER NOT NULL DEFAULT 15 CHECK(duration_minutes=15),
 status TEXT NOT NULL DEFAULT 'OFFERED' CHECK(status IN ('OFFERED','WITHDRAWN','BOOKED')),
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(order_id,local_date,local_time)
);
CREATE INDEX IF NOT EXISTS idx_coaster_pickup_slots_order ON coaster_pickup_slots(order_id,local_date,local_time);

-- Reserved for upcoming customer alternative requests: first required, second optional.
CREATE TABLE IF NOT EXISTS coaster_pickup_requests (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 order_id TEXT NOT NULL REFERENCES coaster_orders(order_id),
 first_date TEXT NOT NULL,
 first_time TEXT NOT NULL,
 second_date TEXT,
 second_time TEXT,
 status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','COUNTER_OFFERED','APPROVED','CLOSED')),
 admin_note TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_coaster_pickup_requests_order ON coaster_pickup_requests(order_id,status,created_at);

-- A pickup request is not an appointment. Only CONFIRMED appointments reserve a time.
CREATE TABLE IF NOT EXISTS coaster_pickup_appointments (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 order_id TEXT NOT NULL REFERENCES coaster_orders(order_id),
 slot_id INTEGER REFERENCES coaster_pickup_slots(id),
 start_at_utc TEXT NOT NULL,
 end_at_utc TEXT NOT NULL,
 local_date TEXT NOT NULL,
 local_time TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'CONFIRMED' CHECK(status IN ('CONFIRMED','CANCELLED')),
 confirmed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 cancelled_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_coaster_pickup_appointments_unique_active ON coaster_pickup_appointments(start_at_utc) WHERE status='CONFIRMED';
CREATE INDEX IF NOT EXISTS idx_coaster_pickup_appointments_order ON coaster_pickup_appointments(order_id,status);

-- Public private-order links will store hashes only, never raw tokens or home address.
CREATE TABLE IF NOT EXISTS coaster_pickup_links (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 order_id TEXT NOT NULL REFERENCES coaster_orders(order_id),
 token_hash TEXT NOT NULL UNIQUE,
 expires_at TEXT NOT NULL,
 revoked_at TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_coaster_pickup_links_order ON coaster_pickup_links(order_id,expires_at);
