/* Preview-only payment testing: Never select live PayPal from a Preview hostname. */
const PREVIEW_HOSTS=new Set(['pickup-stage1-preview.westtechha.pages.dev']);
export function isCoasterPreview(context){
 try{return PREVIEW_HOSTS.has(new URL(context.request.url).hostname.toLowerCase());}catch{return false;}
}
export function previewSandboxRequested(context){
 return isCoasterPreview(context)&&String(context.env.COASTER_PREVIEW_PAYMENT_MODE||'').trim().toLowerCase()==='sandbox';
}
export function isCoasterSandbox(context){
 return previewSandboxRequested(context)&&String(context.env.PAYPAL_ENV||'').trim().toLowerCase()==='sandbox';
}
export function assertSafePreviewPayment(context){
 if(!isCoasterSandbox(context))throw Object.assign(new Error('Sandbox checkout is unavailable. Check the Preview-only payment settings.'),{status:403});
}
