#!/usr/bin/env python3
"""Offline-only SQLite migration rehearsal. No network, no D1, no production files.

Run from repository root with: python scripts/release-5l2/stage5l2-migration-rehearsal.py
Uses an IN-MEMORY representative two-order fixture, NOT actual live customer data.
"""
from pathlib import Path
import sqlite3

root = Path(__file__).resolve().parents[2]
migrations = [
    root / 'migrations' / '022_coaster_pickup_scheduling.sql',
    root / 'migrations' / '023_coaster_payment_attempts.sql',
]
for p in migrations:
    assert p.is_file(), f'Missing checked-in migration: {p}'

cx = sqlite3.connect(':memory:')
cx.execute('PRAGMA foreign_keys=ON')
cx.executescript('''
CREATE TABLE coaster_orders (order_id TEXT PRIMARY KEY, status TEXT, payment_status TEXT);
CREATE TABLE manufacturing_work_orders (id INTEGER PRIMARY KEY, source_type TEXT, source_order_id TEXT);
INSERT INTO coaster_orders VALUES ('WTCC-20261001-1001','PRODUCTION_QUEUE','NOT_REQUIRED');
INSERT INTO coaster_orders VALUES ('WTCC-20261001-1002','AWAITING_PAYMENT','AWAITING_PAYMENT');
INSERT INTO manufacturing_work_orders (source_type,source_order_id)
 VALUES ('COASTER','WTCC-20261001-1001');
''')
before = cx.execute('SELECT * FROM coaster_orders ORDER BY order_id').fetchall()
work_before = cx.execute('SELECT * FROM manufacturing_work_orders').fetchall()
for p in migrations:
    cx.executescript(p.read_text(encoding='utf-8-sig'))
expected = {
    'coaster_pickup_slots', 'coaster_pickup_requests', 'coaster_pickup_appointments',
    'coaster_pickup_links', 'coaster_payment_attempts',
}
actual = {x[0] for x in cx.execute('SELECT name FROM sqlite_master WHERE type="table"')}
assert expected.issubset(actual), f'Missing new tables: {expected - actual}'
assert cx.execute('SELECT * FROM coaster_orders ORDER BY order_id').fetchall() == before
assert cx.execute('SELECT * FROM manufacturing_work_orders').fetchall() == work_before
assert cx.execute('PRAGMA foreign_key_check').fetchall() == []
# Constraints must prevent duplicate appointment times and duplicate provider references.
cx.execute("INSERT INTO coaster_pickup_appointments (order_id,start_at_utc,end_at_utc,local_date,local_time) VALUES (?,?,?,?,?)",
           (before[0][0],'2026-11-03T14:00:00Z','2026-11-03T14:15:00Z','2026-11-03','07:00'))
try:
    cx.execute("INSERT INTO coaster_pickup_appointments (order_id,start_at_utc,end_at_utc,local_date,local_time) VALUES (?,?,?,?,?)",
               (before[1][0],'2026-11-03T14:00:00Z','2026-11-03T14:15:00Z','2026-11-03','07:00'))
    raise AssertionError('Duplicate active pickup appointment was accepted')
except sqlite3.IntegrityError:
    pass
cx.execute("INSERT INTO coaster_payment_attempts (attempt_id,coaster_order_id,method,provider_order_id,amount,quote_json) VALUES (?,?,?,?,?,?)",
           ('attempt-1',before[0][0],'VENMO','PROVIDERORDER12345','29.99','{}'))
try:
    cx.execute("INSERT INTO coaster_payment_attempts (attempt_id,coaster_order_id,method,provider_order_id,amount,quote_json) VALUES (?,?,?,?,?,?)",
               ('attempt-2',before[1][0],'VENMO','PROVIDERORDER12345','29.99','{}'))
    raise AssertionError('Duplicate provider order reference was accepted')
except sqlite3.IntegrityError:
    pass
for p in migrations:
    cx.executescript(p.read_text(encoding='utf-8-sig'))
assert cx.execute('SELECT * FROM coaster_orders ORDER BY order_id').fetchall() == before
assert cx.execute('SELECT * FROM manufacturing_work_orders').fetchall() == work_before
assert cx.execute('PRAGMA foreign_key_check').fetchall() == []
print('STAGE 5L2 OFFLINE REHEARSAL PASSED: two orders/work order preserved; five additive tables; keys, constraints and rerun verified.')
