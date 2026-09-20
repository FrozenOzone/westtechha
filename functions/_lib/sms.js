import { requireOrdersDb } from './orders.js';
import { mobileCarrierLabel, mobileGatewayAddress, normalizeMobileCarrier, normalizeUsMobile } from './mobile-carriers.js';

const EVENT_TABLES={COASTER:'coaster_order_events',ENCLOSURE:'enclosure_order_events',CUSTOM:'custom_order_events'};
function clean(value,max=500){return String(value??'').trim().slice(0,max);}
function consented(order){return String(order?.communicationPreference||'').toUpperCase()==='SMS'&&order?.smsConsent===true;}
function resendConfigured(env){return !!clean(env?.RESEND_API_KEY,400);}
function fromAddress(env){return clean(env?.COASTER_EMAIL_FROM||'WestTech Home Automation <orders@westtechha.com>',320);}
function replyTo(env){return clean(env?.COASTER_EMAIL_REPLY_TO||env?.ORDERS_EMAIL||'orders@westtechha.com',254);}
async function log(env,sourceType,orderId,eventType,detail){const table=EVENT_TABLES[String(sourceType||'').toUpperCase()];if(!table||!orderId)return;try{await requireOrdersDb(env).prepare(`INSERT INTO ${table} (order_id,event_type,detail) VALUES (?,?,?)`).bind(orderId,eventType,JSON.stringify(detail)).run();}catch{}}
async function alreadySent(env,sourceType,orderId,key){const table=EVENT_TABLES[String(sourceType||'').toUpperCase()];if(!table||!orderId)return false;try{const needle=`\"idempotencyKey\":\"${key}\"`,row=await requireOrdersDb(env).prepare(`SELECT id FROM ${table} WHERE order_id=? AND event_type='TEXT_GATEWAY_SENT' AND instr(detail,?)>0 LIMIT 1`).bind(orderId,needle).first();return !!row;}catch{return false;}}

export function smsConfigured(env){return resendConfigured(env);}
export function transactionalSmsText({subject='',orderId=''}={}){
  const title=clean(subject,120).replace(/\s+[—-]\s+[^—-]+$/,'').replace(/[.!]+$/,'');
  return [`WestTech: ${title||'Your order has an update'}.`,orderId?`Order ${clean(orderId,80)}.`:'','Full details were sent to your email.'].filter(Boolean).join(' ').slice(0,300);
}

export async function sendTransactionalSms(env,{sourceType,order,eventType,message,idempotencyKey}={}){
  const type=String(sourceType||'').toUpperCase(),orderId=clean(order?.orderId,80),key=clean(idempotencyKey,240),carrier=normalizeMobileCarrier(order?.mobileCarrier),digits=normalizeUsMobile(order?.customerPhone||order?.phone),to=mobileGatewayAddress(order?.customerPhone||order?.phone,carrier);
  if(!EVENT_TABLES[type]||!orderId||!key)return {sent:false,skipped:true,reason:'invalid-text-gateway-event'};
  if(!consented(order))return {sent:false,skipped:true,reason:'text-not-preferred-or-consented'};
  if(!digits){await log(env,type,orderId,'TEXT_GATEWAY_SKIPPED_INVALID_PHONE',{messageType:eventType,idempotencyKey:key});return {sent:false,skipped:true,reason:'invalid-mobile-phone',idempotencyKey:key};}
  if(!to){await log(env,type,orderId,'TEXT_GATEWAY_UNSUPPORTED',{messageType:eventType,carrier:carrier||'UNKNOWN',carrierLabel:mobileCarrierLabel(carrier)||'Unknown',idempotencyKey:key});return {sent:false,skipped:true,reason:'carrier-gateway-unavailable',idempotencyKey:key};}
  if(await alreadySent(env,type,orderId,key))return {sent:true,duplicate:true,idempotencyKey:key};
  if(!resendConfigured(env)){await log(env,type,orderId,'TEXT_GATEWAY_NOT_CONFIGURED',{messageType:eventType,carrier,idempotencyKey:key});return {sent:false,skipped:true,reason:'email service is not configured',idempotencyKey:key};}
  try{
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${clean(env.RESEND_API_KEY,400)}`,'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify({from:fromAddress(env),to:[to],subject:'WestTech order update',text:clean(message,300),reply_to:replyTo(env)})});
    const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(clean(data?.message,500)||`Email provider returned ${response.status}.`);
    await log(env,type,orderId,'TEXT_GATEWAY_SENT',{messageType:eventType,carrier,carrierLabel:mobileCarrierLabel(carrier),provider:'EMAIL_TO_TEXT_GATEWAY',providerId:data?.id||null,idempotencyKey:key});return {sent:true,id:data?.id||null,idempotencyKey:key};
  }catch(error){const detail=clean(error?.message,500)||'Carrier gateway delivery failed.';await log(env,type,orderId,'TEXT_GATEWAY_FAILED',{messageType:eventType,carrier,provider:'EMAIL_TO_TEXT_GATEWAY',message:detail,idempotencyKey:key});return {sent:false,error:detail,idempotencyKey:key};}
}
