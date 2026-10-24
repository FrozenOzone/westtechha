/* Private customer coaster design preview. Uses the existing R2 artwork; never public. */
import { requireCustomerSession } from '../../../../../../_lib/customer-account.js';
import { requireOrdersDb } from '../../../../../../_lib/orders.js';
import { requireArtworkBucket } from '../../../../../../_lib/coaster-order-util.js';

const IMAGE_TYPES = new Set(['image/png','image/jpeg','image/webp','image/svg+xml']);
const securityHeaders={
  'Cache-Control':'private, no-store, max-age=0',
  'X-Content-Type-Options':'nosniff',
  'Cross-Origin-Resource-Policy':'same-origin',
  'Referrer-Policy':'no-referrer',
  'Content-Security-Policy':"sandbox; default-src 'none'; img-src data:; style-src 'unsafe-inline'"
};
const fail=(status=404)=>new Response('Coaster design unavailable.',{status,headers:{...securityHeaders,'Content-Type':'text/plain; charset=utf-8'}});

export async function onRequestGet(context){
  try{
    const account=await requireCustomerSession(context);
    const type=String(context.params.sourceType||'').toUpperCase();
    const id=String(context.params.orderId||'');
    if(type!=='COASTER'||!/^WTCC-[A-Za-z0-9-]{1,72}$/.test(id))return fail();
    const db=requireOrdersDb(context.env);
    const row=await db.prepare(`SELECT o.design_snapshot_object_key AS designKey,
       o.proof_object_key AS proofKey,o.proof_content_type AS proofType,o.proof_status AS proofStatus
       FROM customer_account_orders a JOIN coaster_orders o
       ON a.source_type='COASTER' AND a.source_order_id=o.order_id
       WHERE a.account_id=? AND o.order_id=? LIMIT 1`).bind(account.id,id).first();
    if(!row)return fail();
    const bucket=requireArtworkBucket(context.env);
    const proofType=String(row.proofType||'').split(';')[0].trim().toLowerCase();
    const candidates=[];
    if(['SENT','APPROVED'].includes(String(row.proofStatus||'').toUpperCase())&&row.proofKey&&IMAGE_TYPES.has(proofType))candidates.push({key:row.proofKey,contentType:proofType});
    if(row.designKey)candidates.push({key:row.designKey,contentType:'image/svg+xml'});
    for(const candidate of candidates){
      const object=await bucket.get(candidate.key);
      if(!object)continue;
      const type=String(object.httpMetadata?.contentType||candidate.contentType).split(';')[0].trim().toLowerCase();
      if(!IMAGE_TYPES.has(type))continue;
      return new Response(object.body,{status:200,headers:{...securityHeaders,'Content-Type':type}});
    }
    return fail();
  }catch(error){return fail(error?.status===401?401:404);}
}
