#!/usr/bin/env node
/* Local-only Stage 5L4 preflight: reads Git and source; NO API requests or mutations. */
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import path from 'node:path';
const root=process.cwd();
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
const baseline=JSON.parse(readFileSync(path.join(root,'scripts/release-5l4/Stage5L4-Audit-Snapshot.json'),'utf8'));
function read(p){return readFileSync(path.join(root,p),'utf8');}
const branch=git('rev-parse','--abbrev-ref','HEAD');
const main=git('rev-parse','main');
const head=git('rev-parse','HEAD');
const paths=git('diff','--name-status','main...HEAD').split(/\r?\n/).filter(Boolean);
const tax=read('functions/_lib/tax.js');
const webhook=read('functions/api/webhooks/resend/index.js');
const logLeak=/console\.log\([\s\S]{0,240}\binputAddress\b|console\.log\([\s\S]{0,240}\bpayload\b|console\.log\([\s\S]{0,240}\bapiAddress\b/.test(tax);
const webhookRequiresSecret=webhook.includes('RESEND_WEBHOOK_SECRET')&&webhook.includes('if(!secret)');
if(branch!=='pickup-stage1-preview')throw Error('STOP: expected Preview branch.');
if(main!==baseline.production_baseline)throw Error('STOP: Production branch changed since audit.');
console.log('STAGE 5L4 READ-ONLY LOCAL AUDIT');
console.log('Preview HEAD: '+head);
console.log('Production main: '+main);
console.log('Changed paths in main...HEAD: '+paths.length+' (current, including any 5L4 files already committed)');
for(const line of paths)console.log('  '+line);
console.log('Existing address-bearing tax log calls detected: '+(logLeak?'YES - HOLD':'NO - retest, manual review required'));
console.log('Webhook code requires production signing secret: '+(webhookRequiresSecret?'YES':'CHECK MANUALLY'));
console.log('Provider secret VALUES and actual email delivery: NOT CHECKED by this offline audit');
console.log('RELEASE DECISION: HOLD - Owner authorization and gates G1-G5 still required.');
