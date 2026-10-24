// Offline, read-only evidence: local working copy only. No credentials, D1, HTTP or mail.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const git=(...args)=>execFileSync('git',args,{encoding:'utf8'}).trim();
const snap=JSON.parse(readFileSync('scripts/release-5l4/Stage5L4B-Audit-Snapshot.json','utf8'));
const branch=git('rev-parse','--abbrev-ref','HEAD');
if(branch!=='pickup-stage1-preview')throw Error('Must audit the Preview branch.');
if(git('rev-parse','main')!==snap.production_baseline)throw Error('Production baseline moved — re-audit required.');
for(const [p,sha] of [
 ['functions/api/webhooks/resend/index.js',snap.webhook_route_git_blob],
 ['functions/_lib/custom-email.js',snap.custom_email_module_git_blob],
 ['functions/_lib/coaster-email.js',snap.coaster_email_module_git_blob]
]){
 if(git('rev-parse','HEAD:'+p)!==sha)throw Error('Protected source changed: '+p);
 if(git('status','--porcelain','--',p))throw Error('Uncommitted source change: '+p);
}
console.log('Stage 5L4B local audit: protected webhook and senders match audited source blobs.');
console.log('Preview HEAD:',git('rev-parse','HEAD'));
console.log('Production HEAD:',snap.production_baseline);
console.log('Local snapshot (not live verification): Production signing secret setting ABSENT; Preview PRESENT.');
console.log('Custom-order Resend receipts are distinct from coaster EMAIL_SENT events.');
console.log('DECISION: HOLD — operator must confirm Resend dashboard endpoint and Production change approval separately.');
