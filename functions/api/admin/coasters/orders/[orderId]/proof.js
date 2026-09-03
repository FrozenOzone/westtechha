import { requireWestTechAdmin } from '../../../../../_lib/admin.js';
import {
  getCoasterOrderDetail,
  refreshCoasterApprovalToken,
  releaseCoasterProof,
  requireCoasterArtworkBucket
} from '../../../../../_lib/coaster-orders.js';
import { jsonResponse } from '../../../../../_lib/shared.js';
import { sendCoasterCustomerEmail } from '../../../../../_lib/coaster-email.js';

const MAX_PROOF_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Map([
  ['image/png','png'],['image/jpeg','jpg'],['image/webp','webp'],['image/svg+xml','svg'],['application/pdf','pdf']
]);

function safeName(value) {
  return String(value || 'proof').trim().slice(0,180).replace(/[\u0000-\u001f\u007f]/g,'').replace(/[\\/]/g,'-');
}

export async function onRequestPost(context) {
  let uploadedKey = '';
  let bucket = null;
  try {
    requireWestTechAdmin(context);
    const orderId = String(context.params?.orderId || '').trim();
    const contentType = String(context.request.headers.get('content-type') || '');

    if (contentType.includes('application/json')) {
      const body = await context.request.json();
      if (body?.action !== 'refreshLink') return jsonResponse({ ok:false, message:'Unknown proof action.' },400);
      const result = await refreshCoasterApprovalToken(context.env, orderId);
      if (!result) return jsonResponse({ ok:false, message:'No released proof is available for this order.' },400);
      delete result.order.artworkObjectKey; delete result.order.designSnapshotObjectKey; delete result.order.proofObjectKey;
      return jsonResponse({ ok:true, order:result.order, approvalToken:result.approvalToken });
    }

    const form = await context.request.formData();
    const source = String(form.get('source') || 'SUBMITTED_DESIGN').trim().toUpperCase();
    const existing = await getCoasterOrderDetail(context.env, orderId);
    if (!existing) return jsonResponse({ ok:false, message:'Coaster order not found.' },404);

    let proofMeta = { source:'SUBMITTED_DESIGN' };
    if (source === 'UPLOADED') {
      const proof = form.get('proof');
      if (!proof || typeof proof.arrayBuffer !== 'function' || !proof.size) return jsonResponse({ ok:false, message:'Choose a WestTech proof file first.' },400);
      if (proof.size > MAX_PROOF_BYTES) return jsonResponse({ ok:false, message:'Proof files must be 10 MB or smaller.' },413);
      const proofType = String(proof.type || '').toLowerCase();
      const ext = ALLOWED.get(proofType);
      if (!ext) return jsonResponse({ ok:false, message:'Proof must be PNG, JPG, WEBP, SVG, or PDF.' },415);
      const nextVersion = Math.max(0, Number(existing.proofVersion || 0)) + 1;
      bucket = requireCoasterArtworkBucket(context.env);
      uploadedKey = `orders/${existing.orderDate}/${orderId}/proofs/v${nextVersion}.${ext}`;
      await bucket.put(uploadedKey, proof.stream(), {
        httpMetadata:{ contentType:proofType },
        customMetadata:{ orderId, proofVersion:String(nextVersion), originalFilename:safeName(proof.name) }
      });
      proofMeta = { source:'UPLOADED', objectKey:uploadedKey, filename:safeName(proof.name), contentType:proofType, sizeBytes:Number(proof.size) };
    }

    let result;
    try { result = await releaseCoasterProof(context.env, orderId, proofMeta); }
    catch (error) { if (uploadedKey && bucket) await bucket.delete(uploadedKey).catch(()=>{}); throw error; }
    if (!result) return jsonResponse({ ok:false, message:'Coaster order not found.' },404);
    const approvalUrl = new URL('/coasters/order-approval.html', context.request.url);
    approvalUrl.searchParams.set('order', orderId);
    approvalUrl.searchParams.set('approvalToken', result.approvalToken);
    const email = await sendCoasterCustomerEmail(context.env, {
      type:'PROOF_READY', order:result.order, approvalUrl:approvalUrl.toString(), requestUrl:context.request.url
    });
    const refreshedOrder = await getCoasterOrderDetail(context.env, orderId) || result.order;
    delete refreshedOrder.artworkObjectKey; delete refreshedOrder.designSnapshotObjectKey; delete refreshedOrder.proofObjectKey;
    return jsonResponse({ ok:true, order:refreshedOrder, approvalToken:result.approvalToken, email });
  } catch (error) {
    return jsonResponse({ ok:false, message:error?.message || 'Could not release the proof.' }, error?.status || 500);
  }
}
