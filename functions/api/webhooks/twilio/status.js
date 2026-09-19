import { requireOrdersDb } from '../../../_lib/orders.js';

const TABLES={COASTER:'coaster_order_events',ENCLOSURE:'enclosure_order_events',CUSTOM:'custom_order_events'};
function clean(value,max=500){return String(value??'').trim().slice(0,max);}
function base64(bytes){let binary='';for(const byte of new Uint8Array(bytes))binary+=String.fromCharCode(byte);return btoa(binary);}
function same(a,b){const left=String(a||''),right=String(b||'');if(left.length!==right.length)return false;let diff=0;for(let i=0;i<left.length;i++)diff|=left.charCodeAt(i)^right.charCodeAt(i);return diff===0;}
async function validSignature(token,url,form,provided){const pairs=[...new Set([...form.keys()])].sort().flatMap(key=>form.getAll(key).map(value=>`${key}${value}`)),payload=`${url}${pairs.join('')}`,key=await crypto.subtle.importKey('raw',new TextEncoder().encode(token),{name:'HMAC',hash:'SHA-1'},false,['sign']),signature=base64(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(payload)));return same(signature,provided);}

export async function onRequestPost(context){
  const token=clean(context.env?.TWILIO_AUTH_TOKEN,160),signature=clean(context.request.headers.get('X-Twilio-Signature'),300);if(!token||!signature)return new Response('Unauthorized',{status:401});
  const form=await context.request.clone().formData();if(!await validSignature(token,context.request.url,form,signature))return new Response('Unauthorized',{status:401});
  const url=new URL(context.request.url),sourceType=clean(url.searchParams.get('sourceType'),20).toUpperCase(),orderId=clean(url.searchParams.get('orderId'),80),key=clean(url.searchParams.get('key'),240),table=TABLES[sourceType];if(!table||!orderId)return new Response('Bad Request',{status:400});
  const status=clean(form.get('MessageStatus')||form.get('SmsStatus'),40).toLowerCase(),eventType=status==='delivered'?'SMS_DELIVERED':['failed','undelivered'].includes(status)?'SMS_UNDELIVERED':'SMS_STATUS_UPDATED',detail={smsType:'TWILIO_STATUS',status,provider:'TWILIO',providerId:clean(form.get('MessageSid'),80)||null,errorCode:clean(form.get('ErrorCode'),40)||null,errorMessage:clean(form.get('ErrorMessage'),500)||null,idempotencyKey:key};
  await requireOrdersDb(context.env).prepare(`INSERT INTO ${table} (order_id,event_type,detail) VALUES (?,?,?)`).bind(orderId,eventType,JSON.stringify(detail)).run();return new Response(null,{status:204});
}
