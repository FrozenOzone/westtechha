import { requireOrdersDb } from './orders.js';
import { getProduct } from './product.js';

const REVIEW_STATUSES=new Set(['REQUEST_RECEIVED','UNDER_REVIEW','NEEDS_CUSTOMER_INFO','ON_HOLD','CHANGES_REQUESTED']);
const PRODUCTION_STATUSES=new Set(['PRODUCTION_QUEUE','IN_PRODUCTION','PREPARING_TO_SHIP','PREPARING_FOR_PICKUP','READY_FOR_PICKUP','SHIPPED','COMPLETED']);
const FROZEN_STATUSES=new Set(['CONFIGURATION_SENT','CONFIGURATION_APPROVED','AWAITING_PAYMENT',...PRODUCTION_STATUSES]);
const FULFILLMENT_PREFERENCES=new Set(['SHIP','LOCAL_PICKUP','DISCUSS']);
const FULFILLMENT_METHODS=new Set(['UNSET','SHIP','LOCAL_PICKUP']);
const COLORS=new Set(['White','Black']);
const TRACKING_CARRIERS=new Map([['USPS','USPS'],['UPS','UPS'],['FEDEX','FedEx'],['DHL','DHL']]);
const FORWARD_STATUS={
  PRODUCTION_QUEUE:'IN_PRODUCTION',
  IN_PRODUCTION:{SHIP:'PREPARING_TO_SHIP',LOCAL_PICKUP:'PREPARING_FOR_PICKUP'},
  PREPARING_TO_SHIP:'SHIPPED',
  PREPARING_FOR_PICKUP:'READY_FOR_PICKUP',
  SHIPPED:'COMPLETED',
  READY_FOR_PICKUP:'COMPLETED'
};

export function clean(value,max=500){return typeof value==='string'?value.trim().slice(0,max):String(value??'').trim().slice(0,max);}
export function number(value,fallback=0){const n=Number(value);return Number.isFinite(n)?n:fallback;}
export function integer(value,min=0,max=999999){return Math.min(max,Math.max(min,Math.round(number(value,min))));}
export function money(value){return Math.round(Math.max(0,number(value,0))*100)/100;}
export function nowIso(){return new Date().toISOString();}
function normalizeTrackingCarrier(value){return TRACKING_CARRIERS.get(clean(value,100).toUpperCase().replace(/[^A-Z0-9]/g,''))||'';}
function utcDate(){return nowIso().slice(0,10).replaceAll('-','');}
export function makeError(message,status=400){return Object.assign(new Error(message),{status});}
function jsonDetail(value){try{return JSON.stringify(value??{});}catch(e){return '{}';}}
export async function sha256(value){const data=new TextEncoder().encode(String(value));const digest=await crypto.subtle.digest('SHA-256',data);return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');}
function newToken(){const a=new Uint8Array(32);crypto.getRandomValues(a);return [...a].map(b=>b.toString(16).padStart(2,'0')).join('');}
function tokenExpiry(days=90){const d=new Date();d.setUTCDate(d.getUTCDate()+days);return d.toISOString();}
export function isEnclosureOrderLocked(order){return String(order?.paymentStatus||'').toUpperCase()==='PAID'||PRODUCTION_STATUSES.has(String(order?.status||'').toUpperCase());}
export function areEnclosureTermsFrozen(order){if(isEnclosureOrderLocked(order))return true;const status=String(order?.status||'').toUpperCase();if(status==='CHANGES_REQUESTED')return false;return FROZEN_STATUSES.has(status);}

async function allocateOrderId(db){
  const date=utcDate();
  const row=await db.prepare(`INSERT INTO enclosure_order_counters (order_date,last_value) VALUES (?,1001) ON CONFLICT(order_date) DO UPDATE SET last_value=last_value+1 RETURNING last_value`).bind(date).first();
  const seq=Number(row?.last_value||1001);return {orderId:`WTE-${date}-${seq}`,orderDate:date,dailySequence:seq};
}

function mapRow(row){
  if(!row)return null;
  return {
    id:row.id,orderId:row.order_id,orderDate:row.order_date,dailySequence:row.daily_sequence,status:row.status,
    customerName:row.customer_name,customerEmail:row.customer_email,customerPhone:row.customer_phone||'',
    sku:row.sku,family:row.family,model:row.model,boardVariant:row.board_variant,offerType:row.offer_type,color:row.color,quantity:Number(row.quantity||1),startingUnitPrice:number(row.starting_unit_price),startingSubtotal:number(row.starting_subtotal),customerNotes:row.customer_notes||'',
    fulfillmentPreference:row.fulfillment_preference||'DISCUSS',fulfillmentMethod:row.fulfillment_method||'UNSET',paymentRequired:!!Number(row.payment_required),productAmount:number(row.product_amount),customCharge:number(row.custom_charge),shippingAmount:number(row.shipping_amount),discountAmount:number(row.discount_amount),finalAmount:number(row.final_amount),customerReviewNote:row.customer_review_note||'',adminNotes:row.admin_notes||'',reviewSavedAt:row.review_saved_at||'',
    estimatedPrinterMinutes:Number(row.estimated_printer_minutes||0),printerAssignment:row.printer_assignment||'',productionWindow:row.production_window||'',configurationVersion:Number(row.configuration_version||0),approvalExpiresAt:row.approval_expires_at||'',configurationSentAt:row.configuration_sent_at||'',configurationApprovedAt:row.configuration_approved_at||'',changesRequestedAt:row.changes_requested_at||'',customerChangeRequest:row.customer_change_request||'',
    paymentStatus:row.payment_status||'NOT_REQUESTED',paypalOrderId:row.paypal_order_id||'',paypalApprovalUrl:row.paypal_approval_url||'',paypalOrderStatus:row.paypal_order_status||'',paypalCaptureId:row.paypal_capture_id||'',paypalPaidAt:row.paypal_paid_at||'',paypalLastError:row.paypal_last_error||'',taxableAmount:number(row.taxable_amount),taxAmount:number(row.tax_amount),taxRate:number(row.tax_rate),taxJurisdictionCode:row.tax_jurisdiction_code||'',taxSource:row.tax_source||'',taxAddressSource:row.tax_address_source||'',taxAddressJson:row.tax_address_json||'',taxQuoteJson:row.tax_quote_json||'',paymentTotal:number(row.payment_total),taxPreparedAt:row.tax_prepared_at||'',taxConfirmedAt:row.tax_confirmed_at||'',
    shippingName:row.shipping_name||'',shippingAddress1:row.shipping_address1||'',shippingAddress2:row.shipping_address2||'',shippingCity:row.shipping_city||'',shippingRegion:row.shipping_region||'',shippingPostalCode:row.shipping_postal_code||'',shippingCountry:row.shipping_country||'US',trackingCarrier:row.tracking_carrier||'',trackingNumber:row.tracking_number||'',pickupReadyAt:row.pickup_ready_at||'',shippedAt:row.shipped_at||'',completedAt:row.completed_at||'',archivedAt:row.archived_at||'',createdAt:row.created_at,updatedAt:row.updated_at
  };
}

export async function logEnclosureEvent(db,orderId,eventType,detail){await db.prepare(`INSERT INTO enclosure_order_events (order_id,event_type,detail) VALUES (?,?,?)`).bind(orderId,eventType,jsonDetail(detail)).run();}
async function eventsFor(db,orderId){const result=await db.prepare(`SELECT id,event_type,detail,created_at FROM enclosure_order_events WHERE order_id=? ORDER BY created_at DESC,id DESC`).bind(orderId).all();return (result?.results||[]).map(row=>({id:row.id,eventType:row.event_type,detail:row.detail||'',createdAt:row.created_at}));}
async function workFor(db,orderId){const result=await db.prepare(`SELECT id,work_type,minutes,note,created_at FROM enclosure_order_work_log WHERE order_id=? ORDER BY created_at DESC,id DESC`).bind(orderId).all();return (result?.results||[]).map(row=>({id:row.id,workType:row.work_type,minutes:Number(row.minutes||0),note:row.note||'',createdAt:row.created_at}));}

export async function getEnclosureOrderDetail(env,orderId){
  const db=requireOrdersDb(env),row=await db.prepare(`SELECT * FROM enclosure_orders WHERE order_id=? LIMIT 1`).bind(clean(orderId,80)).first();
  if(!row)throw makeError('Enclosure order not found.',404);const order=mapRow(row);order.events=await eventsFor(db,order.orderId);order.workLog=await workFor(db,order.orderId);return order;
}
export async function listEnclosureOrders(env,limit=150){const db=requireOrdersDb(env),result=await db.prepare(`SELECT * FROM enclosure_orders ORDER BY created_at DESC,id DESC LIMIT ?`).bind(integer(limit,1,250)).all();return (result?.results||[]).map(mapRow);}

export async function createEnclosureOrder(env,body){
  const db=requireOrdersDb(env);if(clean(body?.website,200))throw makeError('Could not submit the request.');
  const customerName=clean(body?.customerName,120),customerEmail=clean(body?.customerEmail,254).toLowerCase();if(customerName.length<2)throw makeError('Enter your name.');if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail))throw makeError('Enter a valid email address.');if(body?.requestConfirmed!==true)throw makeError('Confirm that this is a review request and that payment comes later.');
  const sku=clean(body?.sku,100).toLowerCase(),product=getProduct(sku);if(!product)throw makeError('Choose a valid WestTech enclosure configuration.');
  const quantity=integer(body?.quantity,1,50),color=clean(body?.color,20);if(!COLORS.has(color))throw makeError('Choose White or Black.');const preference=clean(body?.fulfillmentPreference,30).toUpperCase();if(!FULFILLMENT_PREFERENCES.has(preference))throw makeError('Choose shipping, local pickup, or discuss during review.');
  const unitPrice=money(product.unitAmount),startingSubtotal=money(unitPrice*quantity),{orderId,orderDate,dailySequence}=await allocateOrderId(db),model=clean(body?.modelLabel,100)||clean(product.variant,100)||clean(product.family,80);
  await db.prepare(`INSERT INTO enclosure_orders (order_id,order_date,daily_sequence,status,customer_name,customer_email,customer_phone,sku,family,model,board_variant,offer_type,color,quantity,starting_unit_price,starting_subtotal,customer_notes,fulfillment_preference,product_amount) VALUES (?,?,?,'REQUEST_RECEIVED',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).bind(orderId,orderDate,dailySequence,customerName,customerEmail,clean(body?.customerPhone,60),sku,clean(product.family,80),model,clean(product.variant,80).includes('38')?'38':'30',clean(product.offerType,40),color,quantity,unitPrice,startingSubtotal,clean(body?.customerNotes,2500),preference,startingSubtotal).run();
  await logEnclosureEvent(db,orderId,'REQUEST_SUBMITTED',{status:'REQUEST_RECEIVED',sku,quantity,color,fulfillmentPreference:preference,startingSubtotal});return getEnclosureOrderDetail(env,orderId);
}

function assertForwardProductionStatus(order,status){const current=String(order.status||'').toUpperCase(),configured=FORWARD_STATUS[current],next=typeof configured==='string'?configured:configured?.[order.fulfillmentMethod];if(status!==current&&status!==next)throw makeError(next?`Order status can only remain ${current} or move forward to ${next}.`:`Order status cannot move backward from ${current}.`,409);}

export async function updateEnclosureOrderAdmin(env,orderId,body={}){
  const db=requireOrdersDb(env),current=await getEnclosureOrderDetail(env,orderId),action=clean(body?.action,40)||'saveReview';
  if(action==='addWork'){
    if(String(current.status).toUpperCase()==='ARCHIVED')throw makeError('Restore the archived order before adding work.',409);
    const minutes=integer(body?.minutes,0,100000),workType=clean(body?.workType,80)||'PRINT_PREP',note=clean(body?.note,1200);if(!minutes&&!note)throw makeError('Add minutes or a work note.');
    await db.prepare(`INSERT INTO enclosure_order_work_log (order_id,work_type,minutes,note) VALUES (?,?,?,?)`).bind(current.orderId,workType,minutes,note).run();await logEnclosureEvent(db,current.orderId,'WORK_LOGGED',{workType,minutes,note});return getEnclosureOrderDetail(env,current.orderId);
  }
  if(action==='archive'){
    if(String(current.status).toUpperCase()!=='COMPLETED')throw makeError('Only completed orders can be archived.',409);const when=nowIso();await db.prepare(`UPDATE enclosure_orders SET status='ARCHIVED',archived_at=?,updated_at=CURRENT_TIMESTAMP WHERE order_id=?`).bind(when,current.orderId).run();await logEnclosureEvent(db,current.orderId,'ORDER_ARCHIVED',{previousStatus:'COMPLETED',status:'ARCHIVED'});return getEnclosureOrderDetail(env,current.orderId);
  }
  if(action==='restoreArchive'){
    if(String(current.status).toUpperCase()!=='ARCHIVED')throw makeError('Only archived orders can be restored.',409);await db.prepare(`UPDATE enclosure_orders SET status='COMPLETED',archived_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE order_id=?`).bind(current.orderId).run();await logEnclosureEvent(db,current.orderId,'ORDER_RESTORED',{previousStatus:'ARCHIVED',status:'COMPLETED'});return getEnclosureOrderDetail(env,current.orderId);
  }
  if(String(current.status).toUpperCase()==='ARCHIVED')throw makeError('Restore the archived order before changing it.',409);
  if(action!=='saveReview')throw makeError('Unsupported enclosure order action.');
  if(isEnclosureOrderLocked(current)){
    const status=(clean(body?.status,40)||current.status).toUpperCase();if(!PRODUCTION_STATUSES.has(status))throw makeError('Approved enclosure orders can only use production statuses.',409);assertForwardProductionStatus(current,status);
    if(['PREPARING_FOR_PICKUP','READY_FOR_PICKUP'].includes(status)&&current.fulfillmentMethod!=='LOCAL_PICKUP')throw makeError('That status is only valid for Local Pickup orders.');if(['PREPARING_TO_SHIP','SHIPPED'].includes(status)&&current.fulfillmentMethod!=='SHIP')throw makeError('That status is only valid for shipped orders.');
    const suppliedCarrier=clean(body?.trackingCarrier,100),trackingCarrier=normalizeTrackingCarrier(suppliedCarrier),trackingNumber=clean(body?.trackingNumber,180);
    if(suppliedCarrier&&!trackingCarrier)throw makeError('Choose USPS, UPS, FedEx, or DHL as the shipping carrier.');
    if(status==='SHIPPED'&&(!trackingCarrier||!trackingNumber))throw makeError('Choose the carrier and enter the tracking number before marking the order Shipped.');
    const when=nowIso();await db.prepare(`UPDATE enclosure_orders SET status=?,admin_notes=?,printer_assignment=?,tracking_carrier=?,tracking_number=?,pickup_ready_at=CASE WHEN ?='READY_FOR_PICKUP' THEN COALESCE(pickup_ready_at,?) ELSE pickup_ready_at END,shipped_at=CASE WHEN ?='SHIPPED' THEN COALESCE(shipped_at,?) ELSE shipped_at END,completed_at=CASE WHEN ?='COMPLETED' THEN COALESCE(completed_at,?) ELSE completed_at END,updated_at=CURRENT_TIMESTAMP WHERE order_id=?`).bind(status,clean(body?.adminNotes,5000),clean(body?.printerAssignment,80),trackingCarrier,trackingNumber,status,when,status,when,status,when,current.orderId).run();
    await logEnclosureEvent(db,current.orderId,'PRODUCTION_UPDATED',{previousStatus:current.status,status,printerAssignment:clean(body?.printerAssignment,80),trackingCarrier,trackingNumber});const updated=await getEnclosureOrderDetail(env,current.orderId);updated._statusChanged=current.status!==status;return updated;
  }
  if(areEnclosureTermsFrozen(current)){
    await db.prepare(`UPDATE enclosure_orders SET admin_notes=?,updated_at=CURRENT_TIMESTAMP WHERE order_id=?`).bind(clean(body?.adminNotes,5000),current.orderId).run();await logEnclosureEvent(db,current.orderId,'INTERNAL_NOTE_UPDATED',{customerTermsLocked:true});return getEnclosureOrderDetail(env,current.orderId);
  }
  const candidate=clean(body?.status,40).toUpperCase()||current.status;if(!REVIEW_STATUSES.has(candidate))throw makeError('Choose a valid review status.');const fulfillment=clean(body?.fulfillmentMethod,30).toUpperCase()||'UNSET';if(!FULFILLMENT_METHODS.has(fulfillment))throw makeError('Choose a valid fulfillment method.');
  const productAmount=money(body?.productAmount),customCharge=money(body?.customCharge),shippingAmount=fulfillment==='LOCAL_PICKUP'?0:money(body?.shippingAmount),discountAmount=money(body?.discountAmount),finalAmount=money(Math.max(0,productAmount+customCharge+shippingAmount-discountAmount)),estimatedPrinterMinutes=integer(body?.estimatedPrinterMinutes,0,100000),updatedAt=nowIso();
  await db.prepare(`UPDATE enclosure_orders SET status=?,fulfillment_method=?,payment_required=?,product_amount=?,custom_charge=?,shipping_amount=?,discount_amount=?,final_amount=?,customer_review_note=?,admin_notes=?,estimated_printer_minutes=?,printer_assignment=?,production_window=?,review_saved_at=?,updated_at=? WHERE order_id=?`).bind(candidate,fulfillment,body?.paymentRequired===false?0:1,productAmount,customCharge,shippingAmount,discountAmount,finalAmount,clean(body?.customerReviewNote,2500),clean(body?.adminNotes,5000),estimatedPrinterMinutes,clean(body?.printerAssignment,80),clean(body?.productionWindow,160),updatedAt,updatedAt,current.orderId).run();
  await logEnclosureEvent(db,current.orderId,'REVIEW_SAVED',{status:candidate,fulfillmentMethod:fulfillment,paymentRequired:body?.paymentRequired!==false,finalAmount,estimatedPrinterMinutes,productionWindow:clean(body?.productionWindow,160)});return getEnclosureOrderDetail(env,current.orderId);
}

export async function releaseEnclosureTerms(env,orderId,{refreshOnly=false}={}){
  const db=requireOrdersDb(env),order=await getEnclosureOrderDetail(env,orderId),status=String(order.status||'').toUpperCase();if(isEnclosureOrderLocked(order)||['CONFIGURATION_APPROVED','AWAITING_PAYMENT'].includes(status))throw makeError('Approved production order terms are locked.',409);
  if(refreshOnly){if(status!=='CONFIGURATION_SENT'||!order.configurationVersion||!order.configurationSentAt)throw makeError('Only a configuration awaiting customer approval can receive a refreshed link.',409);const token=newToken(),hash=await sha256(token),expires=tokenExpiry(),sent=nowIso();await db.prepare(`UPDATE enclosure_orders SET approval_token_hash=?,approval_expires_at=?,configuration_sent_at=?,updated_at=CURRENT_TIMESTAMP WHERE order_id=?`).bind(hash,expires,sent,order.orderId).run();await logEnclosureEvent(db,order.orderId,'APPROVAL_LINK_REFRESHED',{configurationVersion:order.configurationVersion,sentAt:sent});return {order:await getEnclosureOrderDetail(env,order.orderId),approvalToken:token};}
  if(!REVIEW_STATUSES.has(status))throw makeError('Return this order to the review phase before sending new customer terms.',409);
  if(!['SHIP','LOCAL_PICKUP'].includes(order.fulfillmentMethod))throw makeError('Choose Ship Order or Local Pickup before sending the configuration.',409);if(!clean(order.productionWindow,160))throw makeError('Enter the estimated production window before sending the configuration.',409);if(order.paymentRequired&&money(order.finalAmount)<=0)throw makeError('Set the reviewed subtotal, or turn Payment Required off, before sending the configuration.',409);
  const token=newToken(),hash=await sha256(token),expires=tokenExpiry(),sent=nowIso(),version=Math.max(0,Number(order.configurationVersion||0))+1;
  await db.prepare(`UPDATE enclosure_orders SET configuration_version=?,approval_token_hash=?,approval_expires_at=?,configuration_sent_at=?,configuration_approved_at=NULL,changes_requested_at=NULL,customer_change_request=NULL,payment_status='NOT_REQUESTED',paypal_order_id=NULL,paypal_approval_url=NULL,paypal_order_status=NULL,paypal_capture_id=NULL,paypal_paid_at=NULL,paypal_last_error=NULL,taxable_amount=0,tax_amount=0,tax_rate=0,tax_jurisdiction_code=NULL,tax_source=NULL,tax_address_source=NULL,tax_address_json=NULL,tax_quote_json=NULL,payment_total=0,tax_prepared_at=NULL,tax_confirmed_at=NULL,status='CONFIGURATION_SENT',updated_at=CURRENT_TIMESTAMP WHERE order_id=?`).bind(version,hash,expires,sent,order.orderId).run();
  await logEnclosureEvent(db,order.orderId,'CONFIGURATION_RELEASED',{configurationVersion:version,finalAmount:order.finalAmount,productionWindow:order.productionWindow});return {order:await getEnclosureOrderDetail(env,order.orderId),approvalToken:token};
}

export function enclosureApprovalView(order){if(!order)return null;return {orderId:order.orderId,status:order.status,customerName:order.customerName,sku:order.sku,family:order.family,model:order.model,boardVariant:order.boardVariant,offerType:order.offerType,color:order.color,quantity:order.quantity,fulfillmentMethod:order.fulfillmentMethod,paymentRequired:order.paymentRequired,productAmount:order.productAmount,customCharge:order.customCharge,shippingAmount:order.shippingAmount,discountAmount:order.discountAmount,finalAmount:order.finalAmount,customerReviewNote:order.customerReviewNote,estimatedPrinterMinutes:order.estimatedPrinterMinutes,productionWindow:order.productionWindow,configurationVersion:order.configurationVersion,configurationSentAt:order.configurationSentAt,configurationApprovedAt:order.configurationApprovedAt,customerChangeRequest:order.customerChangeRequest,paymentStatus:order.paymentStatus,paypalOrderId:order.paypalOrderId,paypalApprovalUrl:order.paypalApprovalUrl,paypalOrderStatus:order.paypalOrderStatus,paypalPaidAt:order.paypalPaidAt,taxableAmount:order.taxableAmount,taxAmount:order.taxAmount,taxRate:order.taxRate,taxJurisdictionCode:order.taxJurisdictionCode,taxSource:order.taxSource,taxAddressSource:order.taxAddressSource,taxAddressJson:order.taxAddressJson,paymentTotal:order.paymentTotal,taxPreparedAt:order.taxPreparedAt,taxConfirmedAt:order.taxConfirmedAt,trackingCarrier:order.trackingCarrier,trackingNumber:order.trackingNumber};}
export async function getEnclosureApprovalByToken(env,orderId,token){const db=requireOrdersDb(env),hash=await sha256(clean(token,200)),row=await db.prepare(`SELECT order_id FROM enclosure_orders WHERE order_id=? AND approval_token_hash=? AND datetime(approval_expires_at)>CURRENT_TIMESTAMP LIMIT 1`).bind(clean(orderId,80),hash).first();if(!row)return null;return enclosureApprovalView(await getEnclosureOrderDetail(env,row.order_id));}
export async function recordEnclosureApprovalAction(env,orderId,token,action,message=''){
  const db=requireOrdersDb(env),approval=await getEnclosureApprovalByToken(env,orderId,token);if(!approval)throw makeError('This approval link is invalid or expired.',404);const current=await getEnclosureOrderDetail(env,orderId);if(isEnclosureOrderLocked(current))throw makeError('This order is already queued or in production and is locked.',409);
  if(action==='requestChanges'){if(String(current.status).toUpperCase()!=='CONFIGURATION_SENT')throw makeError('This configuration is no longer awaiting a decision.',409);const note=clean(message,2500);if(note.length<2)throw makeError('Tell WestTech what you would like changed.');const when=nowIso();await db.prepare(`UPDATE enclosure_orders SET status='CHANGES_REQUESTED',payment_status='NOT_REQUESTED',customer_change_request=?,changes_requested_at=?,updated_at=CURRENT_TIMESTAMP WHERE order_id=?`).bind(note,when,current.orderId).run();await logEnclosureEvent(db,current.orderId,'CUSTOMER_CHANGES_REQUESTED',{configurationVersion:current.configurationVersion,message:note});return getEnclosureOrderDetail(env,current.orderId);}
  if(action!=='approve')throw makeError('Unsupported approval action.');const status=String(current.status).toUpperCase();if(status==='CONFIGURATION_APPROVED'&&String(current.paymentStatus).toUpperCase()==='PAYPAL_ERROR')return current;if(status!=='CONFIGURATION_SENT')throw makeError('This configuration is no longer awaiting approval.',409);const when=nowIso();await db.prepare(`UPDATE enclosure_orders SET status='CONFIGURATION_APPROVED',configuration_approved_at=?,customer_change_request=NULL,updated_at=CURRENT_TIMESTAMP WHERE order_id=?`).bind(when,current.orderId).run();await logEnclosureEvent(db,current.orderId,'CUSTOMER_CONFIGURATION_APPROVED',{configurationVersion:current.configurationVersion,finalAmount:current.finalAmount,productionWindow:current.productionWindow});return getEnclosureOrderDetail(env,current.orderId);
}
