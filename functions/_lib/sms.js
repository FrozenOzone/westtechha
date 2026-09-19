import { requireOrdersDb } from './orders.js';

const EVENT_TABLES={COASTER:'coaster_order_events',ENCLOSURE:'enclosure_order_events',CUSTOM:'custom_order_events'};
function clean(value,max=500){return String(value??'').trim().slice(0,max);}
function consented(order){return String(order?.communicationPreference||'').toUpperCase()==='SMS'&&order?.smsConsent===true;}
function normalizePhone(value){const raw=clean(value,40),digits=raw.replace(/\D/g,'');if(digits.length===10)return `+1${digits}`;if(digits.length===11&&digits.startsWith('1'))return `+${digits}`;if(raw.startsWith('+')&&digits.length>=10&&digits.length<=15)return `+${digits}`;return '';}
function credentials(env){return {sid:clean(env?.TWILIO_ACCOUNT_SID,80),token:clean(env?.TWILIO_AUTH_TOKEN,160),from:clean(env?.TWILIO_FROM_NUMBER,30),service:clean(env?.TWILIO_MESSAGING_SERVICE_SID,80)};}
function callbackUrl(env,sourceType,orderId,key){const base=clean(env?.TWILIO_STATUS_CALLBACK_BASE_URL||env?.PUBLIC_SITE_URL||env?.SITE_URL,300).replace(/\/+$/,'');if(!base)return '';const url=new URL(`${base}/api/webhooks/twilio/status`);url.searchParams.set('sourceType',sourceType);url.searchParams.set('orderId',orderId);url.searchParams.set('key',key);return url.toString();}
export function smsConfigured(env){const c=credentials(env);return !!(c.sid&&c.token&&(c.from||c.service));}
async function log(env,sourceType,orderId,eventType,detail){const table=EVENT_TABLES[String(sourceType||'').toUpperCase()];if(!table||!orderId)return;try{await requireOrdersDb(env).prepare(`INSERT INTO ${table} (order_id,event_type,detail) VALUES (?,?,?)`).bind(orderId,eventType,JSON.stringify(detail)).run();}catch{}}
async function alreadySent(env,sourceType,orderId,key){const table=EVENT_TABLES[String(sourceType||'').toUpperCase()];if(!table||!orderId)return false;try{const needle=`\"idempotencyKey\":\"${key}\"`,row=await requireOrdersDb(env).prepare(`SELECT id FROM ${table} WHERE order_id=? AND event_type='SMS_SENT' AND instr(detail,?)>0 LIMIT 1`).bind(orderId,needle).first();return !!row;}catch{return false;}}

export function transactionalSmsText({subject='',orderId='',url=''}){
  const title=clean(subject,230).replace(/\s+[—-]\s+[^—-]+$/,'').replace(/[.!]+$/,'');
  return [`WestTech: ${title||'There is an update to your order'}.`,orderId?`Order ${clean(orderId,80)}.`:'',url?clean(url,500):'','Reply STOP to opt out.'].filter(Boolean).join(' ').slice(0,480);
}

export async function sendTransactionalSms(env,{sourceType,order,eventType,message,idempotencyKey}={}){
  const type=String(sourceType||'').toUpperCase(),orderId=clean(order?.orderId,80),key=clean(idempotencyKey,240),to=normalizePhone(order?.customerPhone||order?.phone);
  if(!EVENT_TABLES[type]||!orderId||!key)return {sent:false,skipped:true,reason:'invalid-sms-event'};
  if(!consented(order))return {sent:false,skipped:true,reason:'sms-not-preferred-or-consented'};
  if(!to){await log(env,type,orderId,'SMS_SKIPPED_INVALID_PHONE',{smsType:eventType,to:clean(order?.customerPhone||order?.phone,40),idempotencyKey:key});return {sent:false,skipped:true,reason:'invalid-mobile-phone',idempotencyKey:key};}
  if(await alreadySent(env,type,orderId,key))return {sent:true,duplicate:true,idempotencyKey:key};
  const c=credentials(env);
  if(!smsConfigured(env)){await log(env,type,orderId,'SMS_NOT_CONFIGURED',{smsType:eventType,to,idempotencyKey:key});return {sent:false,skipped:true,reason:'Twilio is not configured',idempotencyKey:key};}
  const form=new URLSearchParams({To:to,Body:clean(message,480)}),statusCallback=callbackUrl(env,type,orderId,key);if(c.service)form.set('MessagingServiceSid',c.service);else form.set('From',c.from);if(statusCallback)form.set('StatusCallback',statusCallback);
  try{
    const response=await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(c.sid)}/Messages.json`,{method:'POST',headers:{Authorization:`Basic ${btoa(`${c.sid}:${c.token}`)}`,'Content-Type':'application/x-www-form-urlencoded'},body:form.toString()});
    const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(clean(data?.message,500)||`Twilio returned ${response.status}.`);
    await log(env,type,orderId,'SMS_SENT',{smsType:eventType,to,provider:'TWILIO',providerId:data?.sid||null,idempotencyKey:key});return {sent:true,id:data?.sid||null,idempotencyKey:key};
  }catch(error){const detail=clean(error?.message,500)||'SMS delivery failed.';await log(env,type,orderId,'SMS_FAILED',{smsType:eventType,to,provider:'TWILIO',message:detail,idempotencyKey:key});return {sent:false,error:detail,idempotencyKey:key};}
}
