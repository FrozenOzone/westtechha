import { requireOrdersDb } from '../../../_lib/orders.js';
import { clean, logCustomEvent } from '../../../_lib/custom-orders.js';
import { sendCustomAdminDeliveryFailureEmail } from '../../../_lib/custom-email.js';
import { jsonResponse } from '../../../_lib/shared.js';

const EVENT_CONFIG={
  'email.sent':{status:'SENT',column:'sent_at',eventType:'EMAIL_PROVIDER_SENT'},
  'email.delivered':{status:'DELIVERED',column:'delivered_at',eventType:'EMAIL_DELIVERED'},
  'email.delivery_delayed':{status:'DELIVERY_DELAYED',column:'delayed_at',eventType:'EMAIL_DELIVERY_DELAYED'},
  'email.opened':{status:'OPENED',column:'opened_at',eventType:'EMAIL_OPENED'},
  'email.clicked':{status:'CLICKED',column:'clicked_at',eventType:'EMAIL_LINK_CLICKED'},
  'email.bounced':{status:'BOUNCED',column:'bounced_at',eventType:'EMAIL_BOUNCED'},
  'email.complained':{status:'COMPLAINED',column:'complained_at',eventType:'EMAIL_COMPLAINED'},
  'email.failed':{status:'FAILED',column:'failed_at',eventType:'EMAIL_FAILED'},
  'email.suppressed':{status:'FAILED',column:'failed_at',eventType:'EMAIL_SUPPRESSED'}
};

function bytesFromBase64(value){const binary=atob(value),bytes=new Uint8Array(binary.length);for(let i=0;i<binary.length;i+=1)bytes[i]=binary.charCodeAt(i);return bytes;}
function constantTimeEqual(a,b){if(a.length!==b.length)return false;let difference=0;for(let i=0;i<a.length;i+=1)difference|=a.charCodeAt(i)^b.charCodeAt(i);return difference===0;}
async function verifySignature(secret,id,timestamp,signature,rawBody){
  if(!secret||!id||!timestamp||!signature)return false;
  const seconds=Number(timestamp),now=Math.floor(Date.now()/1000);
  if(!Number.isFinite(seconds)||Math.abs(now-seconds)>300)return false;
  const encodedSecret=secret.startsWith('whsec_')?secret.slice(6):secret;
  let keyBytes;try{keyBytes=bytesFromBase64(encodedSecret);}catch{return false;}
  const key=await crypto.subtle.importKey('raw',keyBytes,{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const signed=`${id}.${timestamp}.${rawBody}`,digest=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(signed));
  let calculated='';for(const byte of new Uint8Array(digest))calculated+=String.fromCharCode(byte);calculated=btoa(calculated);
  return signature.split(/\s+/).some(part=>{const [version,value]=part.split(',',2);return version==='v1'&&value&&constantTimeEqual(value,calculated);});
}

function eventError(data){return clean(data?.bounce?.message||data?.error||data?.reason||data?.message||'',600);}

export async function onRequestPost(context){
  const secret=clean(context.env?.RESEND_WEBHOOK_SECRET,500);
  if(!secret)return jsonResponse({ok:false,message:'Resend webhook is not configured.'},503);
  const rawBody=await context.request.text(),webhookId=clean(context.request.headers.get('svix-id'),200),timestamp=clean(context.request.headers.get('svix-timestamp'),40),signature=clean(context.request.headers.get('svix-signature'),1000);
  if(!await verifySignature(secret,webhookId,timestamp,signature,rawBody))return jsonResponse({ok:false,message:'Invalid webhook signature.'},401);
  let payload;try{payload=JSON.parse(rawBody);}catch{return jsonResponse({ok:false,message:'Invalid webhook payload.'},400);}
  const type=clean(payload?.type,80).toLowerCase(),config=EVENT_CONFIG[type],providerEmailId=clean(payload?.data?.email_id||payload?.data?.id,200);
  if(!config||!providerEmailId)return jsonResponse({ok:true,ignored:true});
  const db=requireOrdersDb(context.env),receivedAt=clean(payload?.created_at||payload?.data?.created_at,60)||new Date().toISOString();
  const inserted=await db.prepare(`INSERT OR IGNORE INTO custom_order_email_webhook_events (webhook_id,provider_email_id,event_type,received_at) VALUES (?,?,?,?)`).bind(webhookId,providerEmailId,type,receivedAt).run();
  if(Number(inserted?.meta?.changes||0)===0)return jsonResponse({ok:true,duplicate:true});
  const receipt=await db.prepare(`SELECT id,order_id,email_type,audience,recipient,status FROM custom_order_email_receipts WHERE provider_email_id=? LIMIT 1`).bind(providerEmailId).first();
  if(!receipt)return jsonResponse({ok:true,unmatched:true});
  const failure=eventError(payload?.data);
  const terminal=new Set(['BOUNCED','COMPLAINED','FAILED']);
  let nextStatus=config.status;
  if(terminal.has(String(receipt.status||'').toUpperCase())&&!terminal.has(nextStatus))nextStatus=receipt.status;
  if(type==='email.delivery_delayed'&&!['SENDING','SENT','DELIVERY_DELAYED'].includes(String(receipt.status||'').toUpperCase()))nextStatus=receipt.status;
  await db.prepare(`UPDATE custom_order_email_receipts SET status=?,${config.column}=COALESCE(${config.column},?),last_event_at=?,last_error=CASE WHEN ?<>'' THEN ? ELSE last_error END,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(nextStatus,receivedAt,receivedAt,failure,failure,receipt.id).run();
  await logCustomEvent(db,receipt.order_id,config.eventType,{emailType:receipt.email_type,to:receipt.recipient,provider:'RESEND',providerId:providerEmailId,status:nextStatus,message:failure||undefined});
  if(receipt.audience==='CUSTOMER'&&terminal.has(nextStatus))await sendCustomAdminDeliveryFailureEmail(context.env,{orderId:receipt.order_id,recipient:receipt.recipient,emailType:receipt.email_type,message:failure,providerEmailId,requestUrl:context.request.url}).catch(()=>{});
  return jsonResponse({ok:true});
}

export async function onRequestGet(){return jsonResponse({ok:true,service:'WestTech Resend webhook'});}
