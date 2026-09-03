import { getCoasterApprovalProof } from '../../../../../../_lib/coaster-orders.js';
import { jsonResponse } from '../../../../../../_lib/shared.js';
export async function onRequestGet(context){
  try{const token=new URL(context.request.url).searchParams.get('token')||'';const {object,contentType}=await getCoasterApprovalProof(context.env,context.params.orderId,token);const headers={'Content-Type':contentType||'application/octet-stream','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};if(String(contentType).includes('svg'))headers['Content-Security-Policy']="default-src 'none'; img-src data:; style-src 'unsafe-inline'; sandbox";return new Response(object.body,{headers});}
  catch(error){return jsonResponse({ok:false,message:error.message||'Proof not available.'},error.status||500);}
}
