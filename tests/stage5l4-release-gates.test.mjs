import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const text=p=>fs.readFileSync(path.join(root,p),'utf8');
const report=text('scripts/release-5l4/Stage5L4-Production-GoNoGo.md');
const audit=JSON.parse(text('scripts/release-5l4/Stage5L4-Audit-Snapshot.json'));
const local=text('scripts/release-5l4/stage5l4-local-audit.mjs');
const tax=text('functions/_lib/tax.js');
const webhook=text('functions/api/webhooks/resend/index.js');
const guard=text('functions/_lib/coaster-preview-payment-mode.js');
const sql22=text('migrations/022_coaster_pickup_scheduling.sql');
const sql23=text('migrations/023_coaster_payment_attempts.sql');
test('release is held pending independent owner approval, never green from tests alone',()=>{
 assert.equal(audit.release_decision,'HOLD');assert.equal(audit.write_authorized,false);
 assert.match(report,/Production mutation authorized/);assert.match(report,/\*\*Decision: HOLD/);
});
test('complete verified baseline is pinned, and Production and Preview D1 IDs differ',()=>{
 assert.match(audit.production_baseline,/^[a-f0-9]{40}$/);
 assert.match(audit.preview_baseline_before_kit,/^[a-f0-9]{40}$/);
 assert.notEqual(audit.database_ids.production,audit.database_ids.preview);
 assert.equal(audit.branch_difference_before_kit.ahead_commits,64);
 assert.equal(audit.branch_difference_before_kit.changed_paths,94);
});
test('current tax address exposure is explicitly detected and remains a release blocker',()=>{
 assert.match(tax,/console\.log\("\[tax\.buildTaxQuote\] start"/);
 assert.match(tax,/\binputAddress\b/);
 assert.match(report,/G1 - Sensitive tax request\/response logging/);
 assert.match(audit.known_hold_gates[0].action,/Redact/);
});
test('webhook requires a signing secret; Production discrepancy cannot be silently waived',()=>{
 assert.match(webhook,/RESEND_WEBHOOK_SECRET/);
 assert.match(webhook,/if\(!secret\)return jsonResponse\(\{ok:false,message:'Resend webhook is not configured.'\},503\)/);
 assert.match(report,/G2 - Resend webhook configuration/);
});
test('pending migrations are additive and only independently approved later',()=>{
 assert.match(sql22,/CREATE TABLE IF NOT EXISTS coaster_pickup_slots/);
 assert.match(sql23,/CREATE TABLE IF NOT EXISTS coaster_payment_attempts/);
 assert.deepEqual(audit.migrations_pending,['022_coaster_pickup_scheduling.sql','023_coaster_payment_attempts.sql']);
 assert.match(report,/Production backup/);
});
test('existing live checkout must not be routed to Sandbox and Venmo remains Preview only',()=>{
 assert.match(guard,/LIVE_HOSTS/);
 assert.match(guard,/setting\(context,'PAYPAL_ENV'\)!=='live'/);
 assert.match(report,/Never switch `PAYPAL_ENV` to Sandbox on Production/);
});
test('the local operator audit is offline and cannot deploy, migrate or create a transaction',()=>{
 assert.match(local,/execFileSync\('git'/);
 assert.doesNotMatch(local,/(?:fetch\(|https:\/\/|wrangler|child_process.*spawn|git\('push'|d1\s+(?:execute|export)|paypal\.com)/);
 assert.match(local,/RELEASE DECISION: HOLD/);
});
test('evidence distinguishes code tests from browser, provider and email receipt verification',()=>{
 for(const token of ['browser','merchant','delivery','94-path','64-commit','D1','Rollback'])assert.ok(report.toLowerCase().includes(token.toLowerCase()),token);
 assert.equal(audit.known_hold_gates.length,5);
});
