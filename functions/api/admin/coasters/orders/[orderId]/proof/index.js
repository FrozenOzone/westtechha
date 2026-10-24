import { jsonResponse } from '../../../../../../_lib/shared.js';
import { requireCoasterAdmin } from '../../../../../../_lib/coaster-admin.js';
import { releaseCoasterProof } from '../../../../../../_lib/coaster-orders.js';
import { sendCoasterCustomerEmail } from '../../../../../../_lib/coaster-email.js';
import { createCustomerProofReadyLink } from '../../../../../../_lib/customer-account.js';
function approvalUrl(request,orderId,token){const u=new URL(request.url);return `${u.protocol}//${u.host}/coasters/order-approval.html?order=${encodeURIComponent(orderId)}&approvalToken=${encodeURIComponent(token)}`;}
export async function onRequestPost(context){
  try{requireCoasterAdmin(context);const type=context.request.headers.get('content-type')||'';let result;
    if(type.toLowerCase().includes('application/json')){const body=await context.request.json();if(body?.action!=='refreshLink')return jsonResponse({ok:false,message:'Unsupported proof action.'},400);result=await releaseCoasterProof(context.env,context.params.orderId,{refreshOnly:true});}
    else{const form=await context.request.formData();const source=String(form.get('source')||'SUBMITTED_DESIGN');result=await releaseCoasterProof(context.env,context.params.orderId,{source,proofFile:form.get('proof')});// The proof is already saved: portal-email failures must not roll it back.
      // On token-generation failure, send the sign-in URL rather than a legacy approval link.
      const origin=new URL(context.request.url).origin;
      let portalUrl=`${origin}/account/login.html`;
      try{portalUrl=await createCustomerProofReadyLink(context.env,{order:result.order,requestUrl:context.request.url});}
      catch(error){console.error('Proof-ready customer portal link failed:',error?.message||error);}
      const email=await sendCoasterCustomerEmail(context.env,{type:'PROOF_READY',order:result.order,approvalUrl:portalUrl,requestUrl:context.request.url});return jsonResponse({ok:true,order:result.order,approvalToken:result.approvalToken,email});}
    return jsonResponse({ok:true,order:result.order,approvalToken:result.approvalToken});
  }catch(error){return jsonResponse({ok:false,message:error.message||'Could not release proof.'},error.status||500);}
}
