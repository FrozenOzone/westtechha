-- Stage 5L2: READ-ONLY schema/order checks for a separately authorized operator.
-- Run against the intended D1 database only after confirming the database ID.
-- NO statements in this file change data, schema, environment or payments.
-- Capture results before and after any separately approved migration.

SELECT name FROM sqlite_master WHERE type='table' AND name IN
('coaster_orders','coaster_order_events','manufacturing_work_orders',
 'customer_accounts','customer_login_tokens','customer_sessions','customer_account_orders',
 'coaster_pickup_slots','coaster_pickup_requests','coaster_pickup_appointments','coaster_pickup_links',
 'coaster_payment_attempts') ORDER BY name;

SELECT name, tbl_name FROM sqlite_master WHERE type='index' AND
(name LIKE 'idx_coaster_pickup_%' OR name LIKE 'idx_coaster_payment_%') ORDER BY name;

PRAGMA table_info(coaster_orders);
PRAGMA table_info(customer_accounts);
PRAGMA foreign_key_check;

SELECT 'coaster_orders' AS metric, COUNT(*) AS total FROM coaster_orders
UNION ALL SELECT 'manufacturing_work_orders', COUNT(*) FROM manufacturing_work_orders
UNION ALL SELECT 'customer_accounts', COUNT(*) FROM customer_accounts;

SELECT payment_status, COUNT(*) AS n FROM coaster_orders GROUP BY payment_status ORDER BY payment_status;

SELECT COUNT(*) AS paid_missing_work_orders FROM coaster_orders c
WHERE c.payment_status='PAID' AND NOT EXISTS
(SELECT 1 FROM manufacturing_work_orders w WHERE w.source_type='COASTER' AND w.source_order_id=c.order_id);

SELECT COUNT(*) AS duplicate_manufacturing_work_orders FROM
(SELECT source_type,source_order_id FROM manufacturing_work_orders
 GROUP BY source_type,source_order_id HAVING COUNT(*)>1);

SELECT COUNT(*) AS stuck_capture_or_creation FROM coaster_orders
WHERE payment_status IN ('CAPTURING_PAYPAL','CAPTURING_VENMO','CREATING_PAYPAL_ORDER');

-- Optional after 022/023 only; do NOT run this next query before the migrations exist:
-- SELECT COUNT(*) AS total_venmo_attempts FROM coaster_payment_attempts;
