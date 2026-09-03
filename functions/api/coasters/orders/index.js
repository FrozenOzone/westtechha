import { jsonResponse } from "../../../_lib/shared.js";
import {
  allocateCoasterOrderId,
  createCoasterOrder,
  getCoasterOrderDetail,
  requireCoasterArtworkBucket
} from "../../../_lib/coaster-orders.js";
import { sendCoasterCustomerEmail } from "../../../_lib/coaster-email.js";

const MAX_ARTWORK_BYTES = 10 * 1024 * 1024;
const MAX_DESIGN_SNAPSHOT_BYTES = 4 * 1024 * 1024;
const ALLOWED_TYPES = new Map([
  ["image/png", "png"],
  ["image/jpeg", "jpg"],
  ["image/webp", "webp"],
  ["image/svg+xml", "svg"]
]);
const ALLOWED_COLORS = new Set([
  "white", "warm-white", "light-gray", "gray", "black", "red", "dark-red",
  "orange", "yellow", "green", "dark-green", "royal-blue", "light-blue",
  "cyan", "purple", "brown"
]);

function text(value, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
}

function safeOriginalFilename(value) {
  const raw = text(value, 180) || "artwork";
  return raw.replace(/[\u0000-\u001f\u007f]/g, "").replace(/[\\/]/g, "-");
}

function field(form, name, max) {
  return text(form.get(name), max);
}

export async function onRequestPost(context) {
  let artworkKey = "";
  let designSnapshotKey = "";
  let bucket = null;

  try {
    const form = await context.request.formData();

    // Quietly accept obvious bot submissions without storing anything.
    if (field(form, "website", 200)) {
      return jsonResponse({ ok: true, ignored: true }, 200);
    }

    const customerName = field(form, "customerName", 120);
    const customerEmail = field(form, "customerEmail", 254).toLowerCase();
    const customerPhone = field(form, "customerPhone", 40);
    const setSize = Number(field(form, "setSize", 2));
    const topText = field(form, "topText", 24);
    const bottomText = field(form, "bottomText", 24);
    const fieldColor = field(form, "fieldColor", 30);
    const accentColor = field(form, "accentColor", 30);
    const ringColor = field(form, "ringColor", 30);
    const textColor = field(form, "textColor", 30);
    const notes = field(form, "notes", 400);
    const rightsConfirmed = field(form, "rightsConfirmed", 10) === "true";
    const artwork = form.get("artwork");
    const designSnapshotRaw = form.get("designSnapshot");
    const designSnapshot = typeof designSnapshotRaw === "string" ? designSnapshotRaw.trim() : "";

    if (customerName.length < 2) {
      return jsonResponse({ ok: false, message: "Please enter your name." }, 400);
    }
    if (!validEmail(customerEmail)) {
      return jsonResponse({ ok: false, message: "Please enter a valid email address." }, 400);
    }
    if (![4, 8].includes(setSize)) {
      return jsonResponse({ ok: false, message: "Choose either the 4-coaster or 8-coaster set." }, 400);
    }
    if (![fieldColor, accentColor, ringColor, textColor].every((value) => ALLOWED_COLORS.has(value))) {
      return jsonResponse({ ok: false, message: "One or more Color Lab selections are invalid." }, 400);
    }
    if (!rightsConfirmed) {
      return jsonResponse({ ok: false, message: "Artwork rights confirmation is required." }, 400);
    }
    if (!artwork || typeof artwork.arrayBuffer !== "function" || !artwork.size) {
      return jsonResponse({ ok: false, message: "Please attach artwork before submitting the request." }, 400);
    }
    if (!designSnapshot || !/^<svg(?:\s|>)/i.test(designSnapshot)) {
      return jsonResponse({ ok: false, message: "Could not capture the submitted coaster design. Please refresh the builder and try again." }, 400);
    }
    if (new TextEncoder().encode(designSnapshot).byteLength > MAX_DESIGN_SNAPSHOT_BYTES) {
      return jsonResponse({ ok: false, message: "The submitted design snapshot is too large. Please try a smaller artwork file." }, 413);
    }
    if (artwork.size > MAX_ARTWORK_BYTES) {
      return jsonResponse({ ok: false, message: "Artwork must be 10 MB or smaller." }, 413);
    }

    const contentType = text(artwork.type, 80).toLowerCase();
    const extension = ALLOWED_TYPES.get(contentType);
    if (!extension) {
      return jsonResponse({ ok: false, message: "Artwork must be PNG, JPG, WEBP, or SVG." }, 415);
    }

    const orderMeta = await allocateCoasterOrderId(context.env);
    bucket = requireCoasterArtworkBucket(context.env);
    artworkKey = `orders/${orderMeta.orderDate}/${orderMeta.orderId}/original.${extension}`;
    designSnapshotKey = `orders/${orderMeta.orderDate}/${orderMeta.orderId}/submitted-design.svg`;
    const originalFilename = safeOriginalFilename(artwork.name);

    await bucket.put(artworkKey, artwork.stream(), {
      httpMetadata: { contentType },
      customMetadata: {
        orderId: orderMeta.orderId,
        originalFilename,
        customerEmail
      }
    });

    await bucket.put(designSnapshotKey, designSnapshot, {
      httpMetadata: { contentType: "image/svg+xml; charset=utf-8" },
      customMetadata: { orderId: orderMeta.orderId, type: "submitted-design" }
    });

    try {
      await createCoasterOrder(context.env, {
        ...orderMeta,
        customerName,
        customerEmail,
        customerPhone,
        setSize,
        topText,
        bottomText,
        fieldColor,
        accentColor,
        ringColor,
        textColor,
        notes,
        artworkFilename: originalFilename,
        artworkContentType: contentType,
        artworkSizeBytes: Number(artwork.size),
        artworkObjectKey: artworkKey,
        designSnapshotObjectKey: designSnapshotKey
      });
    } catch (error) {
      await bucket.delete(artworkKey).catch(() => {});
      await bucket.delete(designSnapshotKey).catch(() => {});
      artworkKey = "";
      designSnapshotKey = "";
      throw error;
    }

    const createdOrder = await getCoasterOrderDetail(context.env, orderMeta.orderId);
    const email = createdOrder ? await sendCoasterCustomerEmail(context.env, {
      type: 'REQUEST_RECEIVED', order: createdOrder, requestUrl: context.request.url
    }) : null;

    return jsonResponse({
      ok: true,
      orderId: orderMeta.orderId,
      status: "DESIGN_REVIEW",
      setSize,
      email
    }, 201);
  } catch (error) {
    if (bucket && artworkKey) await bucket.delete(artworkKey).catch(() => {});
    if (bucket && designSnapshotKey) await bucket.delete(designSnapshotKey).catch(() => {});
    return jsonResponse({
      ok: false,
      message: error?.message || "Could not submit the custom coaster request."
    }, 500);
  }
}
