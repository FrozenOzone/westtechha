const PRODUCTION_STATUSES = new Set(['IN_PRODUCTION','READY_FOR_PICKUP','SHIPPED','COMPLETED']);
const FROZEN_STATUSES = new Set(['PROOF_SENT','PROOF_APPROVED','AWAITING_PAYMENT','IN_PRODUCTION','READY_FOR_PICKUP','SHIPPED','COMPLETED']);
export const ART_TYPES = new Set(['image/png','image/jpeg','image/webp','image/svg+xml']);
export const PROOF_TYPES = new Set(['image/png','image/jpeg','image/webp','image/svg+xml','application/pdf']);

export function clean(value,max=1000){return String(value??'').trim().slice(0,max);}
export function number(value,min=0,max=1e9){const n=Number(value);if(!Number.isFinite(n))return min;return Math.min(max,Math.max(min,n));}
export function integer(value,min=0,max=1e9){return Math.round(number(value,min,max));}
export function bool(value){return value===true||value===1||value==='1'||String(value).toLowerCase()==='true';}
export function nowIso(){return new Date().toISOString();}
export function utcDate(){const d=new Date();return `${d.getUTCFullYear()}${String(d.getUTCMonth()+1).padStart(2,'0')}${String(d.getUTCDate()).padStart(2,'0')}`;}
export function safeFilename(value,fallback='file'){return clean(value,180).replace(/[\\/:*?"<>|\r\n]+/g,'_').replace(/^\.+/,'').trim()||fallback;}
export function jsonDetail(value){try{return JSON.stringify(value);}catch(e){return String(value??'');}}
export function makeError(message,status=400){const e=new Error(message);e.status=status;return e;}
export function requireArtworkBucket(env){if(!env?.COASTER_ARTWORK)throw new Error('Missing COASTER_ARTWORK R2 binding.');return env.COASTER_ARTWORK;}
export function isLocked(order){return String(order?.paymentStatus||'').toUpperCase()==='PAID'||PRODUCTION_STATUSES.has(String(order?.status||'').toUpperCase());}
export function termsFrozen(order){if(isLocked(order))return true;const status=String(order?.status||'').toUpperCase();const proof=String(order?.proofStatus||'').toUpperCase();if(status==='CHANGES_REQUESTED'||proof==='CHANGES_REQUESTED')return false;return FROZEN_STATUSES.has(status)||['SENT','APPROVED'].includes(proof);}

export async function sha256(value){const data=new TextEncoder().encode(String(value));const digest=await crypto.subtle.digest('SHA-256',data);return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');}
export function newToken(){const a=new Uint8Array(32);crypto.getRandomValues(a);return [...a].map(b=>b.toString(16).padStart(2,'0')).join('');}
export function tokenExpiry(days=30){const d=new Date();d.setUTCDate(d.getUTCDate()+days);return d.toISOString();}

export function sanitizeSvgSnapshot(svg){
  let value=String(svg||'').trim();
  if(!value||value.length>3_500_000)throw makeError('The submitted design snapshot is missing or too large.');
  if(!/^<svg\b/i.test(value)||!/<\/svg>\s*$/i.test(value))throw makeError('The submitted design snapshot is invalid.');
  value=value.replace(/<script\b[\s\S]*?<\/script\s*>/gi,'').replace(/<foreignObject\b[\s\S]*?<\/foreignObject\s*>/gi,'').replace(/<(?:iframe|object|embed)\b[\s\S]*?<\/(?:iframe|object|embed)\s*>/gi,'');
  value=value.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,'');
  if(/javascript\s*:/i.test(value))throw makeError('The submitted design snapshot contains unsupported content.');
  const hrefs=[...value.matchAll(/(?:href|xlink:href)\s*=\s*["']([^"']+)["']/gi)].map(m=>m[1]);
  if(hrefs.some(h=>!/^(?:data:image\/(?:png|jpeg|webp);base64,|#)/i.test(h)))throw makeError('The submitted design snapshot contains an external image reference.');
  return value;
}

export function calcTotal({basePrice,setCount,artworkCharge,workTotal,otherCharge,shippingAmount,discountAmount}){
  return Math.max(0,number(basePrice)*Math.max(1,integer(setCount,1,125))+number(artworkCharge)+number(workTotal)+number(otherCharge)+number(shippingAmount)-number(discountAmount));
}
