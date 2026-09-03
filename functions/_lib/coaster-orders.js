import { requireOrdersDb } from "./orders.js";

function utcOrderDateYmd() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export function requireCoasterArtworkBucket(env) {
  if (!env || !env.COASTER_ARTWORK) {
    throw new Error("Missing COASTER_ARTWORK R2 binding. Bind a private R2 bucket to Cloudflare Pages as COASTER_ARTWORK and redeploy.");
  }
  return env.COASTER_ARTWORK;
}

export async function allocateCoasterOrderId(env) {
  const db = requireOrdersDb(env);
  const orderDate = utcOrderDateYmd();

  await db
    .prepare("INSERT OR IGNORE INTO coaster_order_counters (order_date, last_value) VALUES (?, ?)")
    .bind(orderDate, 1000)
    .run();

  await db
    .prepare("UPDATE coaster_order_counters SET last_value = last_value + 1 WHERE order_date = ?")
    .bind(orderDate)
    .run();

  const row = await db
    .prepare("SELECT last_value FROM coaster_order_counters WHERE order_date = ?")
    .bind(orderDate)
    .first();

  const dailySequence = Number(row?.last_value || 1001);
  return {
    orderId: `WTCC-${orderDate}-${dailySequence}`,
    orderDate,
    dailySequence
  };
}

export async function createCoasterOrder(env, order) {
  const db = requireOrdersDb(env);
  const result = await db.prepare(`
    INSERT INTO coaster_orders (
      order_id, order_date, daily_sequence, status,
      customer_name, customer_email, customer_phone,
      set_size, set_count, total_coasters,
      top_text, bottom_text,
      field_color, accent_color, ring_color, text_color,
      customer_notes, rights_confirmed,
      artwork_filename, artwork_content_type, artwork_size_bytes, artwork_object_key,
      design_snapshot_object_key
    ) VALUES (?, ?, ?, 'DESIGN_REVIEW', ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
  `).bind(
    order.orderId,
    order.orderDate,
    order.dailySequence,
    order.customerName,
    order.customerEmail,
    order.customerPhone || null,
    order.setSize,
    order.setSize,
    order.topText || "",
    order.bottomText || "",
    order.fieldColor,
    order.accentColor,
    order.ringColor,
    order.textColor,
    order.notes || null,
    order.artworkFilename,
    order.artworkContentType,
    order.artworkSizeBytes,
    order.artworkObjectKey,
    order.designSnapshotObjectKey || null
  ).run();

  await db.prepare(`
    INSERT INTO coaster_order_events (order_id, event_type, detail)
    VALUES (?, 'REQUEST_SUBMITTED', ?)
  `).bind(
    order.orderId,
    JSON.stringify({ source: "CUSTOM_BUILDER", setSize: order.setSize })
  ).run();

  return result;
}

const REVIEW_STATUSES = new Set([
  'DESIGN_REVIEW','PROOF_READY','PROOF_SENT','CHANGES_REQUESTED','PROOF_APPROVED',
  'AWAITING_PAYMENT','IN_PRODUCTION','READY_FOR_PICKUP','SHIPPED','COMPLETED','CANCELLED'
]);
const FULFILLMENT_METHODS = new Set(['UNSET','SHIP','LOCAL_PICKUP']);
const PRODUCTION_STATUSES = new Set(['IN_PRODUCTION','READY_FOR_PICKUP','SHIPPED','COMPLETED']);

function commercialTermsLocked(order) {
  if (!order) return false;
  return String(order.paymentStatus || '').toUpperCase() === 'PAID' || PRODUCTION_STATUSES.has(String(order.status || '').toUpperCase());
}

function customerTermsFrozen(order) {
  if (!order) return false;
  if (commercialTermsLocked(order)) return true;
  const status = String(order.status || '').toUpperCase();
  const proof = String(order.proofStatus || '').toUpperCase();
  if (status === 'CHANGES_REQUESTED' || proof === 'CHANGES_REQUESTED') return false;
  return ['PROOF_SENT','PROOF_APPROVED','AWAITING_PAYMENT'].includes(status) || ['SENT','APPROVED'].includes(proof);
}

function safeMoney(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n < 0 || n > 100000) return 0;
  return Math.round(n * 100) / 100;
}

function cleanText(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function proofStatusForOrderStatus(status, currentProofStatus) {
  if (status === 'PROOF_READY') return 'READY';
  if (status === 'PROOF_SENT') return 'SENT';
  if (status === 'CHANGES_REQUESTED') return 'CHANGES_REQUESTED';
  if (['PROOF_APPROVED','AWAITING_PAYMENT','IN_PRODUCTION','READY_FOR_PICKUP','SHIPPED','COMPLETED'].includes(status)) return 'APPROVED';
  return currentProofStatus || 'NOT_SENT';
}

export async function listCoasterOrders(env, limit = 100) {
  const db = requireOrdersDb(env);
  const result = await db.prepare(`
    SELECT order_id AS orderId, status, customer_name AS customerName,
           customer_email AS customerEmail, set_size AS setSize,
           fulfillment_method AS fulfillmentMethod, final_amount AS finalAmount,
           proof_status AS proofStatus, payment_status AS paymentStatus,
           artwork_filename AS artworkFilename,
           created_at AS createdAt, updated_at AS updatedAt
    FROM coaster_orders
    ORDER BY created_at DESC
    LIMIT ?
  `).bind(Math.min(Math.max(Number(limit) || 100, 1), 250)).all();
  return Array.isArray(result?.results) ? result.results : [];
}

export async function getCoasterOrderDetail(env, orderId) {
  const db = requireOrdersDb(env);
  const order = await db.prepare(`
    SELECT
      order_id AS orderId, order_date AS orderDate, daily_sequence AS dailySequence, status,
      customer_name AS customerName, customer_email AS customerEmail, customer_phone AS customerPhone,
      set_size AS setSize, set_count AS setCount, total_coasters AS totalCoasters,
      top_text AS topText, bottom_text AS bottomText,
      field_color AS fieldColor, accent_color AS accentColor, ring_color AS ringColor, text_color AS textColor,
      customer_notes AS customerNotes, rights_confirmed AS rightsConfirmed,
      artwork_filename AS artworkFilename, artwork_content_type AS artworkContentType,
      artwork_size_bytes AS artworkSizeBytes, artwork_object_key AS artworkObjectKey,
      design_snapshot_object_key AS designSnapshotObjectKey,
      proof_source AS proofSource, proof_object_key AS proofObjectKey,
      proof_filename AS proofFilename, proof_content_type AS proofContentType, proof_size_bytes AS proofSizeBytes,
      approval_expires_at AS approvalExpiresAt, proof_sent_at AS proofSentAt, proof_approved_at AS proofApprovedAt,
      changes_requested_at AS changesRequestedAt, customer_change_request AS customerChangeRequest,
      fulfillment_method AS fulfillmentMethod, payment_required AS paymentRequired,
      shipping_name AS shippingName, shipping_address1 AS shippingAddress1, shipping_address2 AS shippingAddress2,
      shipping_city AS shippingCity, shipping_region AS shippingRegion, shipping_postal_code AS shippingPostalCode, shipping_country AS shippingCountry,
      tracking_carrier AS trackingCarrier, tracking_number AS trackingNumber, pickup_ready_at AS pickupReadyAt, shipped_at AS shippedAt, completed_at AS completedAt,
      base_price AS basePrice, artwork_charge AS artworkCharge, other_charge AS otherCharge,
      shipping_amount AS shippingAmount, discount_amount AS discountAmount, final_amount AS finalAmount,
      admin_notes AS adminNotes, customer_review_note AS customerReviewNote,
      proof_version AS proofVersion, proof_status AS proofStatus,
      paypal_invoice_id AS paypalInvoiceId, paypal_invoice_url AS paypalInvoiceUrl,
      paypal_invoice_status AS paypalInvoiceStatus, paypal_invoicer_url AS paypalInvoicerUrl,
      paypal_invoice_sent_at AS paypalInvoiceSentAt, paypal_paid_at AS paypalPaidAt,
      paypal_payment_id AS paypalPaymentId, paypal_last_error AS paypalLastError,
      paypal_order_id AS paypalOrderId, paypal_approval_url AS paypalApprovalUrl,
      paypal_order_status AS paypalOrderStatus, paypal_capture_id AS paypalCaptureId,
      payment_status AS paymentStatus, review_saved_at AS reviewSavedAt,
      created_at AS createdAt, updated_at AS updatedAt
    FROM coaster_orders WHERE order_id = ? LIMIT 1
  `).bind(orderId).first();
  if (!order) return null;

  const [workResult, eventResult] = await Promise.all([
    db.prepare(`
      SELECT id, work_type AS workType, minutes, billable_amount AS billableAmount,
             note, created_at AS createdAt
      FROM coaster_order_work_log WHERE order_id = ? ORDER BY created_at ASC, id ASC
    `).bind(orderId).all(),
    db.prepare(`
      SELECT id, event_type AS eventType, detail, created_at AS createdAt
      FROM coaster_order_events WHERE order_id = ? ORDER BY created_at ASC, id ASC
    `).bind(orderId).all()
  ]);

  order.paymentRequired = Number(order.paymentRequired) !== 0;
  order.rightsConfirmed = Number(order.rightsConfirmed) !== 0;
  order.workLog = Array.isArray(workResult?.results) ? workResult.results : [];
  order.billableWorkTotal = Math.round(order.workLog.reduce((sum, row) => sum + safeMoney(row.billableAmount), 0) * 100) / 100;
  order.events = Array.isArray(eventResult?.results) ? eventResult.results : [];
  return order;
}

export async function saveCoasterReview(env, orderId, review) {
  const db = requireOrdersDb(env);
  const existing = await db.prepare(`
    SELECT proof_status AS proofStatus, status, payment_status AS paymentStatus
    FROM coaster_orders WHERE order_id = ? LIMIT 1
  `).bind(orderId).first();
  if (!existing) return null;

  if (commercialTermsLocked(existing)) {
    const nextStatus = PRODUCTION_STATUSES.has(review?.status) ? review.status : existing.status;
    const adminNotes = cleanText(review?.adminNotes, 1600) || null;
    const trackingCarrier = cleanText(review?.trackingCarrier, 80) || null;
    const trackingNumber = cleanText(review?.trackingNumber, 160) || null;
    const currentOrder = await db.prepare(`
      SELECT fulfillment_method AS fulfillmentMethod, pickup_ready_at AS pickupReadyAt,
             shipped_at AS shippedAt, completed_at AS completedAt
      FROM coaster_orders WHERE order_id = ? LIMIT 1
    `).bind(orderId).first();
    if (nextStatus === 'READY_FOR_PICKUP' && currentOrder?.fulfillmentMethod !== 'LOCAL_PICKUP') {
      const error = new Error('Ready for Pickup is only valid for a Local Pickup order.'); error.status = 400; throw error;
    }
    if (nextStatus === 'SHIPPED' && currentOrder?.fulfillmentMethod !== 'SHIP') {
      const error = new Error('Shipped is only valid for a Ship Order.'); error.status = 400; throw error;
    }
    await db.prepare(`
      UPDATE coaster_orders
      SET status = ?, admin_notes = ?, tracking_carrier = ?, tracking_number = ?,
          pickup_ready_at = CASE WHEN ? = 'READY_FOR_PICKUP' THEN COALESCE(pickup_ready_at, CURRENT_TIMESTAMP) ELSE pickup_ready_at END,
          shipped_at = CASE WHEN ? = 'SHIPPED' THEN COALESCE(shipped_at, CURRENT_TIMESTAMP) ELSE shipped_at END,
          completed_at = CASE WHEN ? = 'COMPLETED' THEN COALESCE(completed_at, CURRENT_TIMESTAMP) ELSE completed_at END,
          updated_at = CURRENT_TIMESTAMP
      WHERE order_id = ?
    `).bind(nextStatus, adminNotes, trackingCarrier, trackingNumber, nextStatus, nextStatus, nextStatus, orderId).run();
    await db.prepare(`
      INSERT INTO coaster_order_events (order_id, event_type, detail)
      VALUES (?, 'PRODUCTION_UPDATED', ?)
    `).bind(orderId, JSON.stringify({ status: nextStatus, trackingCarrier, trackingNumber, customerTermsLocked: true })).run();
    return getCoasterOrderDetail(env, orderId);
  }

  if (customerTermsFrozen(existing)) {
    const adminNotes = cleanText(review?.adminNotes, 1600) || null;
    await db.prepare(`
      UPDATE coaster_orders SET admin_notes = ?, updated_at = CURRENT_TIMESTAMP WHERE order_id = ?
    `).bind(adminNotes, orderId).run();
    await db.prepare(`
      INSERT INTO coaster_order_events (order_id, event_type, detail)
      VALUES (?, 'INTERNAL_NOTE_UPDATED', ?)
    `).bind(orderId, JSON.stringify({ customerTermsLocked: true })).run();
    return getCoasterOrderDetail(env, orderId);
  }

  const status = REVIEW_STATUSES.has(review?.status) ? review.status : 'DESIGN_REVIEW';
  const fulfillmentMethod = FULFILLMENT_METHODS.has(review?.fulfillmentMethod) ? review.fulfillmentMethod : 'UNSET';
  const paymentRequired = review?.paymentRequired === false ? 0 : 1;
  const basePrice = safeMoney(review?.basePrice);
  const artworkCharge = safeMoney(review?.artworkCharge);
  const otherCharge = safeMoney(review?.otherCharge);
  const workTotalRow = await db.prepare(`
    SELECT COALESCE(SUM(billable_amount), 0) AS billableWorkTotal
    FROM coaster_order_work_log WHERE order_id = ?
  `).bind(orderId).first();
  const billableWorkTotal = safeMoney(workTotalRow?.billableWorkTotal);
  const shippingAmount = fulfillmentMethod === 'LOCAL_PICKUP' ? 0 : safeMoney(review?.shippingAmount);
  const discountAmount = safeMoney(review?.discountAmount);
  const requested = await db.prepare('SELECT set_size AS setSize FROM coaster_orders WHERE order_id = ? LIMIT 1').bind(orderId).first();
  const setSize = Number(requested?.setSize || 4);
  const setCount = Math.min(Math.max(Number.parseInt(review?.setCount ?? 1, 10) || 1, 1), Math.max(1, Math.floor(500 / setSize)));
  const totalCoasters = setSize * setCount;
  const subtotal = (basePrice * setCount) + artworkCharge + billableWorkTotal + otherCharge + shippingAmount;
  const finalAmount = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);
  const adminNotes = cleanText(review?.adminNotes, 1600) || null;
  const customerReviewNote = cleanText(review?.customerReviewNote, 800) || null;
  const proofStatus = proofStatusForOrderStatus(status, existing.proofStatus);

  await db.prepare(`
    UPDATE coaster_orders
    SET status = ?, fulfillment_method = ?, payment_required = ?, total_coasters = ?, set_count = ?,
        base_price = ?, artwork_charge = ?, other_charge = ?, shipping_amount = ?,
        discount_amount = ?, final_amount = ?, admin_notes = ?, customer_review_note = ?,
        proof_status = ?, review_saved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
    WHERE order_id = ?
  `).bind(
    status, fulfillmentMethod, paymentRequired, totalCoasters, setCount,
    basePrice, artworkCharge, otherCharge, shippingAmount,
    discountAmount, finalAmount, adminNotes, customerReviewNote,
    proofStatus, orderId
  ).run();

  await db.prepare(`
    INSERT INTO coaster_order_events (order_id, event_type, detail)
    VALUES (?, 'REVIEW_SAVED', ?)
  `).bind(orderId, JSON.stringify({ status, fulfillmentMethod, paymentRequired: !!paymentRequired, setCount, totalCoasters, billableWorkTotal, finalAmount })).run();

  return getCoasterOrderDetail(env, orderId);
}

export async function addCoasterWorkLog(env, orderId, work) {
  const db = requireOrdersDb(env);
  const exists = await db.prepare(`
    SELECT order_id AS orderId, status, payment_status AS paymentStatus, proof_status AS proofStatus
    FROM coaster_orders WHERE order_id = ? LIMIT 1
  `).bind(orderId).first();
  if (!exists) return null;

  const locked = customerTermsFrozen(exists);
  const workType = cleanText(work?.workType, 80) || 'Other';
  const minutes = Math.min(Math.max(Number.parseInt(work?.minutes ?? 0, 10) || 0, 0), 24 * 60);
  const billableAmount = locked ? 0 : safeMoney(work?.billableAmount);
  const note = cleanText(work?.note, 240) || null;

  await db.prepare(`
    INSERT INTO coaster_order_work_log (order_id, work_type, minutes, billable_amount, note)
    VALUES (?, ?, ?, ?, ?)
  `).bind(orderId, workType, minutes, billableAmount, note).run();

  await db.prepare(`
    INSERT INTO coaster_order_events (order_id, event_type, detail)
    VALUES (?, 'WORK_LOGGED', ?)
  `).bind(orderId, JSON.stringify({ workType, minutes, billableAmount, customerPriceLocked: locked })).run();

  await db.prepare('UPDATE coaster_orders SET updated_at = CURRENT_TIMESTAMP WHERE order_id = ?').bind(orderId).run();
  return getCoasterOrderDetail(env, orderId);
}


function bytesToHex(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

async function hashApprovalToken(token) {
  const data = new TextEncoder().encode(String(token || ''));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return bytesToHex(new Uint8Array(digest));
}

function createApprovalToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = '';
  bytes.forEach(b => { binary += String.fromCharCode(b); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function isoAfterDays(days) {
  return new Date(Date.now() + (days * 24 * 60 * 60 * 1000)).toISOString();
}

export async function releaseCoasterProof(env, orderId, proof) {
  const db = requireOrdersDb(env);
  const existing = await db.prepare(`
    SELECT order_id AS orderId, design_snapshot_object_key AS designSnapshotObjectKey,
           proof_version AS proofVersion, fulfillment_method AS fulfillmentMethod,
           payment_required AS paymentRequired, final_amount AS finalAmount,
           status, payment_status AS paymentStatus
    FROM coaster_orders WHERE order_id = ? LIMIT 1
  `).bind(orderId).first();
  if (!existing) return null;
  if (commercialTermsLocked(existing)) {
    const error = new Error('This order is already in production. Approved proof and customer terms are locked.');
    error.status = 409; throw error;
  }
  if (!['SHIP','LOCAL_PICKUP'].includes(existing.fulfillmentMethod)) {
    const error = new Error('Choose Ship Order or Local Pickup and save the order before releasing a proof.');
    error.status = 400; throw error;
  }
  if (Number(existing.paymentRequired) !== 0 && Number(existing.finalAmount || 0) <= 0) {
    const error = new Error('Set a final customer price greater than $0, or turn Payment Required off, before releasing a proof.');
    error.status = 400; throw error;
  }

  const source = proof?.source === 'UPLOADED' ? 'UPLOADED' : 'SUBMITTED_DESIGN';
  const objectKey = source === 'UPLOADED' ? cleanText(proof?.objectKey, 500) : existing.designSnapshotObjectKey;
  if (!objectKey) {
    const error = new Error('A proof file or submitted design snapshot is required.');
    error.status = 400; throw error;
  }

  const token = createApprovalToken();
  const tokenHash = await hashApprovalToken(token);
  const version = Math.max(0, Number(existing.proofVersion || 0)) + 1;
  const expiresAt = isoAfterDays(30);
  const filename = source === 'UPLOADED' ? cleanText(proof?.filename, 180) : 'submitted-design.svg';
  const contentType = source === 'UPLOADED' ? cleanText(proof?.contentType, 100) : 'image/svg+xml';
  const sizeBytes = source === 'UPLOADED' ? Math.max(0, Number(proof?.sizeBytes || 0)) : 0;

  await db.prepare(`
    UPDATE coaster_orders
    SET proof_version = ?, proof_status = 'SENT', status = 'PROOF_SENT',
        proof_source = ?, proof_object_key = ?, proof_filename = ?, proof_content_type = ?, proof_size_bytes = ?,
        approval_token_hash = ?, approval_expires_at = ?, proof_sent_at = CURRENT_TIMESTAMP,
        proof_approved_at = NULL, changes_requested_at = NULL, customer_change_request = NULL,
        updated_at = CURRENT_TIMESTAMP
    WHERE order_id = ?
  `).bind(version, source, objectKey, filename, contentType, sizeBytes, tokenHash, expiresAt, orderId).run();

  await db.prepare(`
    INSERT INTO coaster_order_events (order_id, event_type, detail)
    VALUES (?, 'PROOF_RELEASED', ?)
  `).bind(orderId, JSON.stringify({ proofVersion: version, source, expiresAt })).run();

  return { order: await getCoasterOrderDetail(env, orderId), approvalToken: token };
}

export async function refreshCoasterApprovalToken(env, orderId) {
  const db = requireOrdersDb(env);
  const existing = await db.prepare(`
    SELECT order_id AS orderId, proof_version AS proofVersion, proof_status AS proofStatus,
           proof_object_key AS proofObjectKey, status, payment_status AS paymentStatus
    FROM coaster_orders WHERE order_id = ? LIMIT 1
  `).bind(orderId).first();
  if (!existing || !existing.proofObjectKey || Number(existing.proofVersion || 0) < 1) return null;
  if (commercialTermsLocked(existing)) {
    const error = new Error('This order is already in production. Approval-link actions are locked.');
    error.status = 409; throw error;
  }
  const token = createApprovalToken();
  const tokenHash = await hashApprovalToken(token);
  const expiresAt = isoAfterDays(30);
  await db.prepare(`
    UPDATE coaster_orders SET approval_token_hash = ?, approval_expires_at = ?, updated_at = CURRENT_TIMESTAMP
    WHERE order_id = ?
  `).bind(tokenHash, expiresAt, orderId).run();
  await db.prepare(`INSERT INTO coaster_order_events (order_id, event_type, detail) VALUES (?, 'APPROVAL_LINK_REFRESHED', ?)`)
    .bind(orderId, JSON.stringify({ proofVersion: Number(existing.proofVersion || 0), expiresAt })).run();
  return { order: await getCoasterOrderDetail(env, orderId), approvalToken: token };
}

export async function getCoasterApprovalByToken(env, orderId, token) {
  const db = requireOrdersDb(env);
  const row = await db.prepare(`
    SELECT order_id AS orderId, customer_name AS customerName,
           set_size AS setSize, set_count AS setCount, total_coasters AS totalCoasters,
           base_price AS basePrice, artwork_charge AS artworkCharge, other_charge AS otherCharge,
           shipping_amount AS shippingAmount, discount_amount AS discountAmount, final_amount AS finalAmount,
           fulfillment_method AS fulfillmentMethod, payment_required AS paymentRequired,
           shipping_name AS shippingName, shipping_address1 AS shippingAddress1, shipping_address2 AS shippingAddress2,
           shipping_city AS shippingCity, shipping_region AS shippingRegion, shipping_postal_code AS shippingPostalCode, shipping_country AS shippingCountry,
           customer_review_note AS customerReviewNote,
           proof_version AS proofVersion, proof_status AS proofStatus, proof_source AS proofSource,
           proof_object_key AS proofObjectKey, proof_filename AS proofFilename, proof_content_type AS proofContentType,
           approval_token_hash AS approvalTokenHash, approval_expires_at AS approvalExpiresAt,
           proof_sent_at AS proofSentAt, proof_approved_at AS proofApprovedAt,
           customer_change_request AS customerChangeRequest,
           status, payment_status AS paymentStatus, paypal_invoice_id AS paypalInvoiceId,
           paypal_invoice_url AS paypalInvoiceUrl, paypal_invoice_status AS paypalInvoiceStatus,
           paypal_order_id AS paypalOrderId, paypal_approval_url AS paypalApprovalUrl,
           paypal_order_status AS paypalOrderStatus, paypal_capture_id AS paypalCaptureId, paypal_paid_at AS paypalPaidAt
    FROM coaster_orders WHERE order_id = ? LIMIT 1
  `).bind(orderId).first();
  if (!row || !row.approvalTokenHash) return null;
  const incomingHash = await hashApprovalToken(token);
  if (incomingHash !== row.approvalTokenHash) return null;
  if (row.approvalExpiresAt && new Date(row.approvalExpiresAt).getTime() < Date.now()) {
    const error = new Error('This approval link has expired. Please contact WestTech for a new link.');
    error.status = 410; throw error;
  }
  const workTotalRow = await db.prepare(`
    SELECT COALESCE(SUM(billable_amount), 0) AS billableWorkTotal
    FROM coaster_order_work_log WHERE order_id = ?
  `).bind(orderId).first();
  row.billableWorkTotal = safeMoney(workTotalRow?.billableWorkTotal);
  row.paymentRequired = Number(row.paymentRequired) !== 0;
  delete row.approvalTokenHash;
  delete row.proofObjectKey;
  return row;
}

export async function getCoasterProofForApproval(env, orderId, token) {
  const db = requireOrdersDb(env);
  const row = await db.prepare(`
    SELECT proof_object_key AS proofObjectKey, proof_content_type AS proofContentType,
           proof_filename AS proofFilename, approval_token_hash AS approvalTokenHash,
           approval_expires_at AS approvalExpiresAt
    FROM coaster_orders WHERE order_id = ? LIMIT 1
  `).bind(orderId).first();
  if (!row || !row.proofObjectKey || !row.approvalTokenHash) return null;
  const incomingHash = await hashApprovalToken(token);
  if (incomingHash !== row.approvalTokenHash) return null;
  if (row.approvalExpiresAt && new Date(row.approvalExpiresAt).getTime() < Date.now()) {
    const error = new Error('This approval link has expired.'); error.status = 410; throw error;
  }
  return row;
}

export async function recordCoasterApprovalAction(env, orderId, token, action, message, shippingAddress = null) {
  const db = requireOrdersDb(env);
  const approval = await getCoasterApprovalByToken(env, orderId, token);
  if (!approval) return null;
  if (commercialTermsLocked(approval)) {
    const error = new Error('This order has already been released to production. The approved design and terms are locked.');
    error.status = 409; throw error;
  }
  const normalized = action === 'requestChanges' ? 'requestChanges' : action === 'approve' ? 'approve' : '';
  if (!normalized) { const error = new Error('Unknown approval action.'); error.status = 400; throw error; }

  if (normalized === 'approve') {
    await db.prepare(`
      UPDATE coaster_orders SET status = 'PROOF_APPROVED', proof_status = 'APPROVED',
          proof_approved_at = CURRENT_TIMESTAMP, changes_requested_at = NULL, customer_change_request = NULL,
          updated_at = CURRENT_TIMESTAMP WHERE order_id = ?
    `).bind(orderId).run();
    await db.prepare(`INSERT INTO coaster_order_events (order_id, event_type, detail) VALUES (?, 'CUSTOMER_PROOF_APPROVED', ?)` )
      .bind(orderId, JSON.stringify({ proofVersion: approval.proofVersion, shippingSource: approval.fulfillmentMethod === 'SHIP' ? 'PAYPAL' : 'NONE' })).run();
  } else {
    const note = cleanText(message, 1200);
    if (note.length < 2) { const error = new Error('Please describe the change you would like.'); error.status = 400; throw error; }
    await db.prepare(`
      UPDATE coaster_orders SET status = 'CHANGES_REQUESTED', proof_status = 'CHANGES_REQUESTED',
          changes_requested_at = CURRENT_TIMESTAMP, customer_change_request = ?, updated_at = CURRENT_TIMESTAMP
      WHERE order_id = ?
    `).bind(note, orderId).run();
    await db.prepare(`INSERT INTO coaster_order_events (order_id, event_type, detail) VALUES (?, 'CUSTOMER_CHANGES_REQUESTED', ?)`)
      .bind(orderId, JSON.stringify({ proofVersion: approval.proofVersion, message: note })).run();
  }
  return getCoasterApprovalByToken(env, orderId, token);
}
