import { requireOrdersDb } from './orders.js';
import { ART_TYPES, bool, clean, integer, jsonDetail, makeError, requireArtworkBucket, safeFilename, sanitizeSvgSnapshot, utcDate } from './coaster-order-util.js';

async function allocateOrderId(db){
  const date=utcDate();
  const row=await db.prepare(`INSERT INTO coaster_order_counters (order_date,last_value) VALUES (?,1001) ON CONFLICT(order_date) DO UPDATE SET last_value=last_value+1 RETURNING last_value`).bind(date).first();
  const seq=Number(row?.last_value||1001);return {orderId:`WTCC-${date}-${seq}`,orderDate:date,dailySequence:seq};
}

function mapRow(r){if(!r)return null;return {
  id:r.id,orderId:r.order_id,orderDate:r.order_date,dailySequence:r.daily_sequence,status:r.status,
  customerName:r.customer_name,customerEmail:r.customer_email,customerPhone:r.customer_phone||'',
  setSize:Number(r.set_size||0),setCount:Number(r.set_count||1),totalCoasters:Number(r.total_coasters||0),
  topText:r.top_text||'',bottomText:r.bottom_text||'',fieldColor:r.field_color||'',accentColor:r.accent_color||'',ringColor:r.ring_color||'',textColor:r.text_color||'',customerNotes:r.customer_notes||'',rightsConfirmed:!!Number(r.rights_confirmed),
  artworkFilename:r.artwork_filename||'',artworkContentType:r.artwork_content_type||'',artworkSizeBytes:Number(r.artwork_size_bytes||0),artworkObjectKey:r.artwork_object_key||'',designSnapshotObjectKey:r.design_snapshot_object_key||'',
  fulfillmentMethod:r.fulfillment_method||'UNSET',paymentRequired:!!Number(r.payment_required),basePrice:Number(r.base_price||0),artworkCharge:Number(r.artwork_charge||0),otherCharge:Number(r.other_charge||0),shippingAmount:Number(r.shipping_amount||0),discountAmount:Number(r.discount_amount||0),finalAmount:Number(r.final_amount||0),adminNotes:r.admin_notes||'',customerReviewNote:r.customer_review_note||'',reviewSavedAt:r.review_saved_at||'',
  proofVersion:Number(r.proof_version||0),proofStatus:r.proof_status||'NOT_SENT',proofSource:r.proof_source||'',proofObjectKey:r.proof_object_key||'',proofFilename:r.proof_filename||'',proofContentType:r.proof_content_type||'',proofSizeBytes:Number(r.proof_size_bytes||0),approvalExpiresAt:r.approval_expires_at||'',proofSentAt:r.proof_sent_at||'',proofApprovedAt:r.proof_approved_at||'',changesRequestedAt:r.changes_requested_at||'',customerChangeRequest:r.customer_change_request||'',
  paymentStatus:r.payment_status||'NOT_REQUESTED',paypalInvoiceId:r.paypal_invoice_id||'',paypalInvoiceUrl:r.paypal_invoice_url||'',paypalInvoiceStatus:r.paypal_invoice_status||'',paypalInvoicerUrl:r.paypal_invoicer_url||'',paypalInvoiceSentAt:r.paypal_invoice_sent_at||'',paypalPaidAt:r.paypal_paid_at||'',paypalPaymentId:r.paypal_payment_id||'',paypalLastError:r.paypal_last_error||'',paypalOrderId:r.paypal_order_id||'',paypalApprovalUrl:r.paypal_approval_url||'',paypalOrderStatus:r.paypal_order_status||'',paypalCaptureId:r.paypal_capture_id||'',
  taxableAmount:Number(r.taxable_amount||0),taxAmount:Number(r.tax_amount||0),taxRate:Number(r.tax_rate||0),taxJurisdictionCode:r.tax_jurisdiction_code||'',taxSource:r.tax_source||'',taxAddressSource:r.tax_address_source||'',taxAddressJson:r.tax_address_json||'',taxQuoteJson:r.tax_quote_json||'',paymentTotal:Number(r.payment_total||0),taxPreparedAt:r.tax_prepared_at||'',taxConfirmedAt:r.tax_confirmed_at||'',
  shippingName:r.shipping_name||'',shippingAddress1:r.shipping_address1||'',shippingAddress2:r.shipping_address2||'',shippingCity:r.shipping_city||'',shippingRegion:r.shipping_region||'',shippingPostalCode:r.shipping_postal_code||'',shippingCountry:r.shipping_country||'US',trackingCarrier:r.tracking_carrier||'',trackingNumber:r.tracking_number||'',pickupReadyAt:r.pickup_ready_at||'',shippedAt:r.shipped_at||'',completedAt:r.completed_at||'',
  createdAt:r.created_at,updatedAt:r.updated_at
};}

async function eventsFor(db,orderId){const x=await db.prepare(`SELECT event_type AS eventType,detail,created_at AS createdAt FROM coaster_order_events WHERE order_id=? ORDER BY id`).bind(orderId).all();return x?.results||[];}
async function workFor(db,orderId){const x=await db.prepare(`SELECT work_type AS workType,minutes,billable_amount AS billableAmount,note,created_at AS createdAt FROM coaster_order_work_log WHERE order_id=? ORDER BY id`).bind(orderId).all();return (x?.results||[]).map(r=>({...r,billableAmount:Number(r.billableAmount||0),minutes:Number(r.minutes||0)}));}
export async function logEvent(db,orderId,type,detail=''){await db.prepare(`INSERT INTO coaster_order_events (order_id,event_type,detail) VALUES (?,?,?)`).bind(orderId,type,typeof detail==='string'?detail:jsonDetail(detail)).run();}
export async function billableTotal(db,orderId){const r=await db.prepare(`SELECT COALESCE(SUM(billable_amount),0) AS total FROM coaster_order_work_log WHERE order_id=?`).bind(orderId).first();return Number(r?.total||0);}

export async function getCoasterOrderDetail(env,orderId){const db=requireOrdersDb(env);const row=await db.prepare(`SELECT * FROM coaster_orders WHERE order_id=? LIMIT 1`).bind(clean(orderId,80)).first();const order=mapRow(row);if(!order)return null;order.events=await eventsFor(db,order.orderId);order.workLog=await workFor(db,order.orderId);return order;}
export async function listCoasterOrders(env,limit=100){const db=requireOrdersDb(env);const x=await db.prepare(`SELECT * FROM coaster_orders ORDER BY created_at DESC,id DESC LIMIT ?`).bind(integer(limit,1,250)).all();return (x?.results||[]).map(mapRow);}

export async function createCoasterOrder(env,form){
  const db=requireOrdersDb(env),bucket=requireArtworkBucket(env);
  const website=clean(form.get('website'),200);if(website)throw makeError('Could not submit the request.',400);
  const artwork=form.get('artwork');if(!artwork||typeof artwork.arrayBuffer!=='function')throw makeError('Choose an artwork file first.');
  const contentType=clean(artwork.type,100).toLowerCase();if(!ART_TYPES.has(contentType))throw makeError('Artwork must be a PNG, JPG, WEBP, or SVG file.');
  if(Number(artwork.size||0)<=0||Number(artwork.size)>10*1024*1024)throw makeError('Artwork must be 10 MB or smaller.');
  const customerName=clean(form.get('customerName'),120),customerEmail=clean(form.get('customerEmail'),254).toLowerCase();if(customerName.length<2)throw makeError('Enter your name.');if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail))throw makeError('Enter a valid email address.');
  if(!bool(form.get('rightsConfirmed')))throw makeError('Artwork ownership or permission must be confirmed.');
  const setSize=integer(form.get('setSize'),0,8);if(![4,8].includes(setSize))throw makeError('Choose a 4- or 8-coaster set.');
  const snapshot=sanitizeSvgSnapshot(form.get('designSnapshot'));
  const {orderId,orderDate,dailySequence}=await allocateOrderId(db);
  const filename=safeFilename(artwork.name,'customer-artwork'),key=`coasters/${orderId}/artwork/${crypto.randomUUID()}-${filename}`,designKey=`coasters/${orderId}/design/submitted-design.svg`;
  try{
    await bucket.put(key,await artwork.arrayBuffer(),{httpMetadata:{contentType},customMetadata:{orderId,kind:'customer-artwork',originalFilename:filename}});
    await bucket.put(designKey,new TextEncoder().encode(snapshot),{httpMetadata:{contentType:'image/svg+xml'},customMetadata:{orderId,kind:'submitted-design'}});
    await db.prepare(`INSERT INTO coaster_orders (order_id,order_date,daily_sequence,status,customer_name,customer_email,customer_phone,set_size,set_count,total_coasters,top_text,bottom_text,field_color,accent_color,ring_color,text_color,customer_notes,rights_confirmed,artwork_filename,artwork_content_type,artwork_size_bytes,artwork_object_key,design_snapshot_object_key) VALUES (?,?,?,'DESIGN_REVIEW',?,?,?,?,1,?,?,?,?,?,?,?,?,1,?,?,?,?,?)`).bind(orderId,orderDate,dailySequence,customerName,customerEmail,clean(form.get('customerPhone'),60),setSize,setSize,clean(form.get('topText'),80),clean(form.get('bottomText'),80),clean(form.get('fieldColor'),40),clean(form.get('accentColor'),40),clean(form.get('ringColor'),40),clean(form.get('textColor'),40),clean(form.get('notes'),2000),filename,contentType,Number(artwork.size||0),key,designKey).run();
    await logEvent(db,orderId,'REQUEST_SUBMITTED',{status:'DESIGN_REVIEW',totalCoasters:setSize,artworkFilename:filename});
  }catch(error){try{await bucket.delete(key);await bucket.delete(designKey);}catch(e){}throw error;}
  return getCoasterOrderDetail(env,orderId);
}

export async function getStoredCoasterObject(env,orderId,kind){
  const order=await getCoasterOrderDetail(env,orderId);if(!order)throw makeError('Coaster order not found.',404);
  let key='',filename='',contentType='application/octet-stream';
  if(kind==='artwork'){key=order.artworkObjectKey;filename=order.artworkFilename;contentType=order.artworkContentType;}
  else if(kind==='design'){key=order.designSnapshotObjectKey;filename='submitted-design.svg';contentType='image/svg+xml';}
  else if(kind==='proof'){key=order.proofObjectKey;filename=order.proofFilename||'proof';contentType=order.proofContentType;}
  if(!key)throw makeError('Requested file is not available.',404);const object=await requireArtworkBucket(env).get(key);if(!object)throw makeError('Requested file is not available.',404);
  return {object,filename,contentType:object.httpMetadata?.contentType||contentType};
}
