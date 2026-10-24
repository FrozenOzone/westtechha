import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const sql22=read('migrations/022_coaster_pickup_scheduling.sql');
const sql23=read('migrations/023_coaster_payment_attempts.sql');
const runbook=read('scripts/release-5l2/Stage5L2-Production-Release-Runbook.md');
const checks=read('scripts/release-5l2/Stage5L2-Production-ReadOnly-D1-Checks.sql');
const rehearsal=read('scripts/release-5l2/stage5l2-migration-rehearsal.py');
const guard=read('functions/_lib/coaster-preview-payment-mode.js');
const customerPayment=read('functions/api/customer/orders/[sourceType]/[orderId]/payment/index.js');

test('022 only creates additive pickup tables and indexes',()=>{
 for(const name of ['coaster_pickup_slots','coaster_pickup_requests','coaster_pickup_appointments','coaster_pickup_links'])
  assert.match(sql22,new RegExp(`CREATE TABLE IF NOT EXISTS ${name}\\s*\\(`));
 assert.doesNotMatch(sql22,/\b(?:DROP|ALTER|DELETE|UPDATE|REPLACE|TRUNCATE|INSERT)\s+(?:TABLE|INTO|FROM|coaster_orders)\b/i);
});
test('022 retains private links and exclusive confirmed booking uniqueness',()=>{
 assert.match(sql22,/token_hash TEXT NOT NULL UNIQUE/);
 assert.match(sql22,/UNIQUE INDEX IF NOT EXISTS idx_coaster_pickup_appointments_unique_active[\s\S]*?WHERE status='CONFIRMED'/);
 assert.match(sql22,/REFERENCES coaster_orders\(order_id\)/);
});
test('023 only adds independent payment attempt ledger',()=>{
 assert.match(sql23,/CREATE TABLE IF NOT EXISTS coaster_payment_attempts/);
 assert.match(sql23,/provider_order_id TEXT NOT NULL UNIQUE/);
 assert.match(sql23,/method TEXT NOT NULL CHECK\(method IN \('VENMO'\)\)/);
 assert.match(sql23,/CREATE INDEX IF NOT EXISTS idx_coaster_payment_attempts_order/);
 assert.doesNotMatch(sql23.split('\n').filter(line=>!line.trim().startsWith('--')).join('\n'),/\b(?:DROP|ALTER|DELETE|UPDATE|REPLACE|TRUNCATE)\b/i);
});
test('no payment or charge operation is included in migration SQL',()=>{
 assert.doesNotMatch(sql22+sql23,/\/v2\/checkout|paypal\.com|payment_status\s*=\s*'PAID'|paypal_capture_id\s*=/i);
});
test('Production/Preview D1 and R2 remain separate in the release plan',()=>{
 const prod=runbook.match(/\| Production D1 binding \| `ORDERS_DB` -> `([a-f0-9-]{36})`/);
 const preview=runbook.match(/\| Preview D1 binding \| `ORDERS_DB` -> `([a-f0-9-]{36})`/);
 assert.ok(prod&&preview,'Both D1 binding IDs documented');
 assert.notEqual(prod[1],preview[1],'Production and Preview must not use the same D1');
 assert.match(runbook,/Production R2/);
 assert.match(runbook,/Preview R2/);
});
test('release gate requires explicit owner approval for production mutations',()=>{
 assert.match(runbook,/NOT AUTHORIZED TO DEPLOY OR MIGRATE PRODUCTION/);
 assert.match(runbook,/owner approval/i);
 assert.match(runbook,/No Production promotion until ALL/i);
});
test('release plan covers both old storefront and new portal',()=>{
 for(const word of ['ESP32','legacy','PayPal','portal','pickup','Venmo','Admin'])assert.ok(runbook.includes(word),word);
});
test('rollback distinguishes code rollback from destructive D1 restore',()=>{
 assert.match(runbook,/Code rollback/);
 assert.match(runbook,/Database rollback/);
 assert.match(runbook,/post-backup transactions/);
 assert.match(runbook,/Never switch `PAYPAL_ENV` to `sandbox`/);
});
test('backup instructions are examples only, not executable installer operations',()=>{
 assert.match(runbook,/DO NOT EXECUTE UNTIL OWNER APPROVAL/);
 assert.match(runbook,/d1 export westtechha-orders --remote/);
 assert.match(runbook,/d1 time-travel info westtechha-orders/);
});
test('read-only SQL cannot mutate database',()=>{
 const uncommented=checks.split('\n').filter(x=>!x.trim().startsWith('--')).join('\n');
 assert.doesNotMatch(uncommented,/\b(?:INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|REPLACE|VACUUM|ATTACH|DETACH|REINDEX)\b/i);
 assert.match(uncommented,/PRAGMA foreign_key_check/);
 assert.match(uncommented,/duplicate_manufacturing_work_orders/);
 assert.match(uncommented,/stuck_capture_or_creation/);
});
test('offline rehearsal uses SQLite memory exclusively and preserves existing orders',()=>{
 assert.match(rehearsal,/sqlite3\.connect\(':memory:'\)/);
 assert.match(rehearsal,/before = cx\.execute/);
 assert.match(rehearsal,/assert cx\.execute\('SELECT \* FROM coaster_orders/);
 assert.doesNotMatch(rehearsal,/wrangler|cloudflare\.com|https?:\/\//i);
});
test('Stage 5L1 host separation is unchanged',()=>{
 assert.match(guard,/westtechVerifiedAdmin/);
 assert.match(guard,/LIVE_HOSTS/);
 assert.match(customerPayment,/captureCoasterPayPalOrderForCustomer/);
 assert.match(customerPayment,/ensureCoasterPayPalOrder/);
 assert.doesNotMatch(customerPayment,/startVenmo|captureVenmo/);
});
