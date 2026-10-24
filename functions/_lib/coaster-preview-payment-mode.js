/* Stage 5L1: canonical live PayPal and isolated Sandbox Preview. */
const PREVIEW_HOSTS=new Set(['pickup-stage1-preview.westtechha.pages.dev']);
const LIVE_HOSTS=new Set(['westtechha.com','www.westtechha.com']);
const DEV_ADMIN_HOST='dev.westtechha.com';
function hostname(context){try{return new URL(context.request.url).hostname.toLowerCase();}catch{return '';}}
function setting(context,name){return String(context?.env?.[name]||'').trim().toLowerCase();}
export function isCoasterPreview(context){return PREVIEW_HOSTS.has(hostname(context));}
export function previewSandboxRequested(context){
 return isCoasterPreview(context)&&setting(context,'COASTER_PREVIEW_PAYMENT_MODE')==='sandbox';
}
export function isCoasterSandbox(context){
 // Dev Admin receives this marker only after middleware cryptographically verifies Cloudflare Access JWT.
 // Never treat a public Pages preview hostname as an authenticated Admin context.
 const protectedDevAdmin=hostname(context)===DEV_ADMIN_HOST&&
   typeof context?.data?.westtechVerifiedAdmin==='string'&&!!context.data.westtechVerifiedAdmin.trim();
 return (previewSandboxRequested(context)||
   (protectedDevAdmin&&setting(context,'COASTER_PREVIEW_PAYMENT_MODE')==='sandbox'))&&
   setting(context,'PAYPAL_ENV')==='sandbox';
}
export function coasterCustomerPaymentMode(context){
 const h=hostname(context);
 if(PREVIEW_HOSTS.has(h)){
  if(isCoasterSandbox(context))return 'sandbox';
  return setting(context,'COASTER_PREVIEW_PAYMENT_MODE')==='sandbox'?'configuration_error':'unavailable';
 }
 if(LIVE_HOSTS.has(h)){
  // Fail closed; never route live customer payments to Sandbox (or vice versa).
  if(setting(context,'PAYPAL_ENV')!=='live')return 'configuration_error';
  if(!String(context?.env?.PAYPAL_CLIENT_ID||'').trim()||!String(context?.env?.PAYPAL_CLIENT_SECRET||'').trim())return 'configuration_error';
  return 'live';
 }
 return 'unavailable';
}
export function assertSafePreviewPayment(context){
 if(!isCoasterSandbox(context))throw Object.assign(new Error('Sandbox checkout is unavailable. Check the Preview-only payment settings.'),{status:403});
}
