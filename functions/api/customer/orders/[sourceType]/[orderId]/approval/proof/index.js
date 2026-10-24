/* Serve the exact WestTech-released proof, including PDF, under customer session auth. */
import { requireCustomerCoasterProof } from '../../../../../../../_lib/coaster-customer-proof.js';
import { requireArtworkBucket, PROOF_TYPES } from '../../../../../../../_lib/coaster-order-util.js';
const headers={'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff','Cross-Origin-Resource-Policy':'same-origin','Referrer-Policy':'no-referrer'};
export async function onRequestGet(context){
  try{
    const {order}=await requireCustomerCoasterProof(context);
    if(!order.proofObjectKey||Number(order.proofVersion)<1||!['SENT','APPROVED','CHANGES_REQUESTED'].includes(String(order.proofStatus||'').toUpperCase()))return new Response('Proof unavailable.',{status:404,headers});
    const type=String(order.proofContentType||'').toLowerCase().split(';')[0].trim();
    if(!PROOF_TYPES.has(type))return new Response('Proof unavailable.',{status:404,headers});
    const object=await requireArtworkBucket(context.env).get(order.proofObjectKey);
    if(!object)return new Response('Proof unavailable.',{status:404,headers});
    const contentType=String(object.httpMetadata?.contentType||type).toLowerCase().split(';')[0].trim();
    if(!PROOF_TYPES.has(contentType)||contentType!==type)return new Response('Proof unavailable.',{status:404,headers});
    const h={...headers,'Content-Type':type,'Content-Disposition':'inline'};
    if(type==='image/svg+xml')h['Content-Security-Policy']="sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'";
    return new Response(object.body,{status:200,headers:h});
  }catch(error){return new Response(error?.status===401?'Sign in first.':'Proof unavailable.',{status:error?.status===401?401:404,headers});}
}
