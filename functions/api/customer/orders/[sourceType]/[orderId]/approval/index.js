/* Step 4: signed-in customer proof approval, no approval token in the browser. */
import { requireCustomerCoasterProof,publicCustomerProof } from '../../../../../../_lib/coaster-customer-proof.js';
import { recordCoasterApprovalForCustomer } from '../../../../../../_lib/coaster-order-proof.js';
import { ensureCoasterPayPalOrder } from '../../../../../../_lib/coaster-paypal.js';
import { sendCoasterCustomerEmail } from '../../../../../../_lib/coaster-email.js';
import { sendCoasterAdminProductionEmail } from '../../../../../../_lib/coaster-admin-production-email.js';
import { jsonResponse } from '../../../../../../_lib/shared.js';

const noStore={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
const respond=(value,status=200)=>{const r=jsonResponse(value,status);for(const [name,v] of Object.entries(noStore))r.headers.set(name,v);return r;};
export async function onRequestGet(context){
  try{const {order}=await requireCustomerCoasterProof(context);return respond({ok:true,proof:publicCustomerProof(order)});}
  catch(error){return respond({ok:false,message:error.status===404?'Order not available.':error.message||'Could not load this proof.'},error.status||500);}
}
export async function onRequestPost(context){
  try{
    // Prevent cross-origin form and fetch submissions against cookie-authenticated accounts.
    const origin=context.request.headers.get('Origin');
    if(origin&&origin!==new URL(context.request.url).origin)return respond({ok:false,message:'Invalid request origin.'},403);
    if(!/^application\/json(?:;|$)/i.test(context.request.headers.get('Content-Type')||''))return respond({ok:false,message:'JSON request required.'},415);
    const {account,order}=await requireCustomerCoasterProof(context);
    const body=await context.request.json();
    const action=String(body?.action||'');
    const version=Number(body?.proofVersion);
    if(!publicCustomerProof(order).canRespond)return respond({ok:false,message:'This proof is no longer awaiting a decision. Refresh your order.'},409);
    const updated=await recordCoasterApprovalForCustomer(context.env,order.orderId,account.id,action,body?.message||'',version);
    let notice='';
    if(action==='requestChanges'){
      try{await sendCoasterCustomerEmail(context.env,{type:'CHANGES_REQUESTED',order:updated,requestUrl:context.request.url});}
      catch(error){notice='Your changes were saved, but the email confirmation could not be sent.';}
    }else if(action==='approve'&&!updated.paymentRequired){
      // Existing no-charge fulfillment path: manufacturing queue + standard notifications.
      try{
        const queued=await ensureCoasterPayPalOrder(context.env,updated.orderId);
        if(String(queued?.status).toUpperCase()==='PRODUCTION_QUEUE')await sendCoasterAdminProductionEmail(context.env,{order:queued,requestUrl:context.request.url});
      }catch(error){notice='Approval was saved. WestTech needs to review production queue setup.';}
    }else if(action==='approve'&&updated.paymentRequired){
      // Payment integration is Step 5. Never create/capture PayPal in Step 4.
      notice='Your proof is approved. WestTech will provide the payment step next.';
    }
    const {order:refreshed}=await requireCustomerCoasterProof(context);
    return respond({ok:true,proof:publicCustomerProof(refreshed),notice});
  }catch(error){return respond({ok:false,message:error.message||'Could not update the proof.'},error.status||500);}
}
