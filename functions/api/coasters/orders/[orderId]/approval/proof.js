import { getCoasterProofForApproval, requireCoasterArtworkBucket } from '../../../../../_lib/coaster-orders.js';
import { jsonResponse } from '../../../../../_lib/shared.js';

export async function onRequestGet(context) {
  try {
    const orderId = String(context.params?.orderId || '').trim();
    const url = new URL(context.request.url);
    const token = String(url.searchParams.get('token') || '').trim();
    if (!token) return jsonResponse({ok:false,message:'Approval token is required.'},401);
    const proof = await getCoasterProofForApproval(context.env, orderId, token);
    if (!proof) return jsonResponse({ok:false,message:'Proof not found.'},404);
    const bucket = requireCoasterArtworkBucket(context.env);
    const object = await bucket.get(proof.proofObjectKey);
    if (!object) return jsonResponse({ok:false,message:'Proof file not found.'},404);
    const headers = new Headers(); object.writeHttpMetadata(headers);
    headers.set('Content-Type', proof.proofContentType || headers.get('Content-Type') || 'application/octet-stream');
    headers.set('Cache-Control','private, no-store');
    headers.set('X-Content-Type-Options','nosniff');
    return new Response(object.body,{status:200,headers});
  } catch (error) {
    return jsonResponse({ok:false,message:error?.message || 'Could not load proof.'},error?.status || 500);
  }
}
