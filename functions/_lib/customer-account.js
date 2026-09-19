import { requireOrdersDb } from './orders.js';

const EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PREFERENCES=new Set(['EMAIL','SMS']);
const FULFILLMENT=new Set(['UNSET','SHIP','LOCAL_PICKUP']);
const SESSION_COOKIE='wtha_customer_session';

function clean(value,max=500){return String(value??'').trim().slice(0,max);}
function bool(value){return value===true||value===1||String(value).toLowerCase()==='true';}
function email(value){return clean(value,254).toLowerCase();}
function phone(value){return clean(value,40);}
function json(value){try{return JSON.stringify(value??{});}catch{return '{}';}}
function error(message,status=400){return Object.assign(new Error(message),{status});}
function now(){return new Date().toISOString();}
function addMinutes(minutes){const date=new Date();date.setUTCMinutes(date.getUTCMinutes()+minutes);return date.toISOString();}
function addDays(days){const date=new Date();date.setUTCDate(date.getUTCDate()+days);return date.toISOString();}
function token(){const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);return [...bytes].map(value=>value.toString(16).padStart(2,'0')).join('');}
async function sha256(value){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(value)));return [...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('');}
function esc(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
function siteBase(env,requestUrl){const configured=clean(env?.PUBLIC_SITE_URL||env?.SITE_URL,300).replace(/\/+$/,'');if(configured)return configured;const url=new URL(requestUrl);return `${url.protocol}//${url.host}`;}
function fromAddress(env){return clean(env?.COASTER_EMAIL_FROM||'WestTech Home Automation <orders@westtechha.com>',320);}
function replyTo(env){return clean(env?.COASTER_EMAIL_REPLY_TO||env?.ORDERS_EMAIL||'orders@westtechha.com',254);}

function validateContact({displayName,emailAddress,phoneNumber,communicationPreference,smsConsent}){
  const name=clean(displayName,180),mail=email(emailAddress),mobile=phone(phoneNumber),preference=clean(communicationPreference,20).toUpperCase();
  if(name.length<2)throw error('Enter your name.');
  if(!EMAIL_RE.test(mail))throw error('Enter a valid email address.');
  if(mobile.replace(/\D/g,'').length<10)throw error('Enter a valid mobile phone number.');
  if(!PREFERENCES.has(preference))throw error('Choose Email or Text message as your preferred contact method.');
  if(preference==='SMS'&&!bool(smsConsent))throw error('Consent to receive text messages is required when Text message is selected.');
  return {displayName:name,email:mail,phone:mobile,communicationPreference:preference,smsConsent:preference==='SMS'&&bool(smsConsent)};
}

function mapAccount(row){if(!row)return null;return {id:Number(row.id),email:row.email,displayName:row.display_name,phone:row.phone||'',communicationPreference:row.communication_preference||'EMAIL',smsConsent:!!Number(row.sms_consent),defaultFulfillmentMethod:row.default_fulfillment_method||'UNSET',address1:row.address1||'',address2:row.address2||'',city:row.city||'',region:row.region||'',postalCode:row.postal_code||'',country:row.country||'US',emailVerifiedAt:row.email_verified_at||'',pendingEmail:row.pending_email||'',lastLoginAt:row.last_login_at||'',createdAt:row.created_at,updatedAt:row.updated_at};}

async function getAccountById(db,id){return mapAccount(await db.prepare(`SELECT * FROM customer_accounts WHERE id=? AND is_active=1 LIMIT 1`).bind(Number(id)).first());}
async function getAccountByEmail(db,address){return mapAccount(await db.prepare(`SELECT * FROM customer_accounts WHERE email=? COLLATE NOCASE AND is_active=1 LIMIT 1`).bind(email(address)).first());}

async function findOrderIdentity(db,address){return db.prepare(`
  SELECT customer_name AS display_name,customer_phone AS phone,communication_preference,sms_consent,created_at FROM custom_orders WHERE customer_email=? COLLATE NOCASE
  UNION ALL SELECT customer_name,customer_phone,communication_preference,sms_consent,created_at FROM coaster_orders WHERE customer_email=? COLLATE NOCASE
  UNION ALL SELECT customer_name,customer_phone,communication_preference,sms_consent,created_at FROM enclosure_orders WHERE customer_email=? COLLATE NOCASE
  UNION ALL SELECT customer_name,customer_phone,communication_preference,sms_consent,created_at FROM orders WHERE customer_email=? COLLATE NOCASE
  ORDER BY created_at DESC LIMIT 1`).bind(address,address,address,address).first();}

async function ensureAccount(db,{displayName,emailAddress,phoneNumber,communicationPreference='EMAIL',smsConsent=false}){
  const address=email(emailAddress);let account=await getAccountByEmail(db,address);if(account)return account;
  const name=clean(displayName,180)||address.split('@')[0]||'WestTech Customer',mobile=phone(phoneNumber),preference=PREFERENCES.has(clean(communicationPreference,20).toUpperCase())?clean(communicationPreference,20).toUpperCase():'EMAIL',consented=preference==='SMS'&&bool(smsConsent);
  const created=await db.prepare(`INSERT INTO customer_accounts (email,display_name,phone,communication_preference,sms_consent,sms_consented_at) VALUES (?,?,?,?,?,?) RETURNING id`).bind(address,name,mobile,preference,consented?1:0,consented?now():null).first();
  return getAccountById(db,created.id);
}

async function linkOrdersForEmail(db,accountId,address){
  await db.batch([
    db.prepare(`INSERT OR IGNORE INTO customer_account_orders (account_id,source_type,source_order_id) SELECT ?,'CUSTOM',order_id FROM custom_orders WHERE customer_email=? COLLATE NOCASE`).bind(accountId,address),
    db.prepare(`INSERT OR IGNORE INTO customer_account_orders (account_id,source_type,source_order_id) SELECT ?,'COASTER',order_id FROM coaster_orders WHERE customer_email=? COLLATE NOCASE`).bind(accountId,address),
    db.prepare(`INSERT OR IGNORE INTO customer_account_orders (account_id,source_type,source_order_id) SELECT ?,'ENCLOSURE',order_id FROM enclosure_orders WHERE customer_email=? COLLATE NOCASE`).bind(accountId,address),
    db.prepare(`INSERT OR IGNORE INTO customer_account_orders (account_id,source_type,source_order_id) SELECT ?,'STORE',invoice_id FROM orders WHERE customer_email=? COLLATE NOCASE`).bind(accountId,address)
  ]);
}

async function log(db,accountId,eventType,detail={}){await db.prepare(`INSERT INTO customer_account_events (account_id,event_type,detail) VALUES (?,?,?)`).bind(accountId||null,eventType,json(detail)).run();}

async function issueToken(db,accountId,purpose,requestedEmail=''){
  const raw=token(),hash=await sha256(raw),expires=addMinutes(20);
  await db.prepare(`INSERT INTO customer_login_tokens (account_id,purpose,token_hash,requested_email,expires_at) VALUES (?,?,?,?,?)`).bind(accountId,purpose,hash,requestedEmail||null,expires).run();
  return raw;
}

async function sendPortalEmail(env,{account,rawToken,purpose,requestUrl}){
  const root=siteBase(env,requestUrl),verifyUrl=`${root}/api/customer/auth/verify?token=${encodeURIComponent(rawToken)}`,isChange=purpose==='EMAIL_CHANGE',to=isChange?account.pendingEmail:account.email;
  const subject=isChange?'Confirm your new WestTech email address':'Your secure WestTech customer sign-in link';
  const title=isChange?'Confirm your new email address':'Open your WestTech customer dashboard';
  const copy=isChange?'Use the secure button below to confirm this email address for your WestTech customer account.':'Use the secure button below to view your WestTech orders, update your contact information, and request a reorder. This one-time link expires in 20 minutes.';
  const html=`<!doctype html><html><body style="margin:0;background:#f3f6fa;font-family:Arial,Helvetica,sans-serif;color:#152033"><div style="max-width:650px;margin:0 auto;padding:28px 16px"><div style="background:#071426;color:#fff;padding:22px 26px;border-radius:12px 12px 0 0"><div style="font-size:22px;font-weight:800;color:#67aee8">WestTech Home Automation</div><div style="font-size:11px;letter-spacing:1.5px;margin-top:4px;color:#aabbd0">BUILT SMART • MADE CUSTOM</div></div><div style="background:#fff;padding:30px 26px;border:1px solid #dde6f0;border-top:0;border-radius:0 0 12px 12px"><h1 style="font-size:24px;line-height:1.25;margin:0 0 18px">${esc(title)}</h1><p style="font-size:15px;line-height:1.65;color:#42526a">Hi ${esc(account.displayName||'there')},</p><p style="font-size:15px;line-height:1.65;color:#42526a">${esc(copy)}</p><p style="margin:24px 0"><a href="${esc(verifyUrl)}" style="display:inline-block;background:#1677C4;color:#fff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:8px">${isChange?'Confirm Email':'Open My Orders'}</a></p><p style="font-size:13px;line-height:1.6;color:#617187">WestTech will never ask for your PayPal password or store your card information.</p><p style="font-size:14px;line-height:1.6;color:#42526a;margin-top:26px">Thanks,<br><strong>Ed</strong><br>WestTech Home Automation</p></div></div></body></html>`;
  const text=`${title}\n\nHi ${account.displayName||'there'},\n\n${copy}\n\n${verifyUrl}\n\nWestTech will never ask for your PayPal password or store your card information.\n\nThanks,\nEd\nWestTech Home Automation`;
  const apiKey=clean(env?.RESEND_API_KEY,400);if(!apiKey){return {sent:false,reason:'RESEND_API_KEY not configured'};}
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({from:fromAddress(env),to:[to],subject,html,text,reply_to:replyTo(env)})}),data=await response.json().catch(()=>({}));
  if(!response.ok)return {sent:false,reason:clean(data?.message,500)||`Email provider returned ${response.status}.`};
  return {sent:true,id:data?.id||null};
}

export async function requestCustomerLogin(env,emailAddress,requestUrl){
  const db=requireOrdersDb(env),address=email(emailAddress);if(!EMAIL_RE.test(address))return {accepted:true};
  let account=await getAccountByEmail(db,address);const identity=await findOrderIdentity(db,address);if(!account&&!identity)return {accepted:true};
  if(!account)account=await ensureAccount(db,{displayName:identity.display_name,emailAddress:address,phoneNumber:identity.phone,communicationPreference:identity.communication_preference,smsConsent:identity.sms_consent});
  const recent=await db.prepare(`SELECT id FROM customer_login_tokens WHERE account_id=? AND purpose IN ('LOGIN','ACTIVATE') AND used_at IS NULL AND datetime(created_at)>datetime('now','-60 seconds') LIMIT 1`).bind(account.id).first();
  if(recent)return {accepted:true};
  await linkOrdersForEmail(db,account.id,address);const raw=await issueToken(db,account.id,account.emailVerifiedAt?'LOGIN':'ACTIVATE'),delivery=await sendPortalEmail(env,{account,rawToken:raw,purpose:account.emailVerifiedAt?'LOGIN':'ACTIVATE',requestUrl});
  await log(db,account.id,'LOGIN_LINK_REQUESTED',{delivered:delivery.sent===true});return {accepted:true};
}

export async function inviteCustomerForOrder(env,{sourceType,order,requestUrl}){
  if(!order?.customerEmail)return {sent:false,skipped:true,reason:'customer-email-missing'};
  const db=requireOrdersDb(env),account=await ensureAccount(db,{displayName:order.customerName,emailAddress:order.customerEmail,phoneNumber:order.customerPhone,communicationPreference:order.communicationPreference,smsConsent:order.smsConsent});
  await linkOrdersForEmail(db,account.id,account.email);
  const type=clean(sourceType,20).toUpperCase(),key=`${type}:${order.orderId}`,existing=await db.prepare(`SELECT id FROM customer_account_events WHERE account_id=? AND event_type='ACTIVATION_INVITE_SENT' AND instr(detail,?)>0 LIMIT 1`).bind(account.id,key).first();
  if(account.emailVerifiedAt||existing)return {sent:false,skipped:true,reason:account.emailVerifiedAt?'account-already-active':'invite-already-sent'};
  const raw=await issueToken(db,account.id,'ACTIVATE'),delivery=await sendPortalEmail(env,{account,rawToken:raw,purpose:'ACTIVATE',requestUrl});
  await log(db,account.id,'ACTIVATION_INVITE_SENT',{order:key,delivered:delivery.sent===true,providerId:delivery.id||null});return delivery;
}

function readCookie(request,name){const cookie=request.headers.get('Cookie')||'';for(const part of cookie.split(';')){const [key,...value]=part.trim().split('=');if(key===name)return decodeURIComponent(value.join('='));}return '';}
export function clearCustomerSessionCookie(){return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;}

export async function verifyCustomerToken(env,rawToken){
  const db=requireOrdersDb(env),hash=await sha256(clean(rawToken,200)),row=await db.prepare(`SELECT t.*,a.email,a.pending_email FROM customer_login_tokens t JOIN customer_accounts a ON a.id=t.account_id WHERE t.token_hash=? AND t.used_at IS NULL AND datetime(t.expires_at)>CURRENT_TIMESTAMP AND a.is_active=1 LIMIT 1`).bind(hash).first();
  if(!row)throw error('This sign-in link is invalid or expired.',401);
  if(row.purpose==='EMAIL_CHANGE'){
    const next=email(row.requested_email||row.pending_email);if(!EMAIL_RE.test(next))throw error('The pending email address is no longer valid.',409);
    const conflict=await db.prepare(`SELECT id FROM customer_accounts WHERE email=? COLLATE NOCASE AND id<>? LIMIT 1`).bind(next,row.account_id).first();if(conflict)throw error('That email address is already connected to another account.',409);
    await db.prepare(`UPDATE customer_accounts SET email=?,pending_email=NULL,email_verified_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(next,now(),row.account_id).run();await linkOrdersForEmail(db,row.account_id,next);await log(db,row.account_id,'EMAIL_CHANGED',{previousEmail:row.email});
  }else{
    await db.prepare(`UPDATE customer_accounts SET email_verified_at=COALESCE(email_verified_at,?),last_login_at=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(now(),now(),row.account_id).run();await linkOrdersForEmail(db,row.account_id,row.email);await log(db,row.account_id,'CUSTOMER_SIGNED_IN',{});
  }
  await db.prepare(`UPDATE customer_login_tokens SET used_at=? WHERE id=?`).bind(now(),row.id).run();
  const rawSession=token(),sessionHash=await sha256(rawSession);await db.prepare(`INSERT INTO customer_sessions (account_id,session_hash,expires_at) VALUES (?,?,?)`).bind(row.account_id,sessionHash,addDays(7)).run();
  return {cookie:`${SESSION_COOKIE}=${encodeURIComponent(rawSession)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800`,emailChanged:row.purpose==='EMAIL_CHANGE'};
}

export async function requireCustomerSession(context){
  const raw=readCookie(context.request,SESSION_COOKIE);if(!raw)throw error('Sign in to view your WestTech customer account.',401);
  const db=requireOrdersDb(context.env),hash=await sha256(raw),row=await db.prepare(`SELECT a.* FROM customer_sessions s JOIN customer_accounts a ON a.id=s.account_id WHERE s.session_hash=? AND datetime(s.expires_at)>CURRENT_TIMESTAMP AND a.is_active=1 LIMIT 1`).bind(hash).first();
  if(!row)throw error('Your customer session expired. Please sign in again.',401);await db.prepare(`UPDATE customer_sessions SET last_seen_at=CURRENT_TIMESTAMP WHERE session_hash=?`).bind(hash).run();return mapAccount(row);
}

export async function endCustomerSession(context){const raw=readCookie(context.request,SESSION_COOKIE);if(raw){const hash=await sha256(raw);await requireOrdersDb(context.env).prepare(`DELETE FROM customer_sessions WHERE session_hash=?`).bind(hash).run();}}

export async function customerDashboard(env,account){
  const db=requireOrdersDb(env);await linkOrdersForEmail(db,account.id,account.email);
  const result=await db.prepare(`
    SELECT l.source_type,l.source_order_id AS order_id,o.status,o.title,o.created_at,o.updated_at,o.fulfillment_method,o.payment_status,COALESCE(NULLIF(o.payment_total,0),o.final_amount,0) AS total,o.tracking_carrier,o.tracking_number,1 AS can_reorder FROM customer_account_orders l JOIN custom_orders o ON l.source_type='CUSTOM' AND o.order_id=l.source_order_id WHERE l.account_id=?
    UNION ALL
    SELECT l.source_type,l.source_order_id,o.status,printf('%d-Coaster Set',o.total_coasters),o.created_at,o.updated_at,o.fulfillment_method,o.payment_status,COALESCE(NULLIF(o.payment_total,0),o.final_amount,0),o.tracking_carrier,o.tracking_number,1 FROM customer_account_orders l JOIN coaster_orders o ON l.source_type='COASTER' AND o.order_id=l.source_order_id WHERE l.account_id=?
    UNION ALL
    SELECT l.source_type,l.source_order_id,o.status,trim(o.family||' '||o.model),o.created_at,o.updated_at,o.fulfillment_method,o.payment_status,COALESCE(NULLIF(o.payment_total,0),o.final_amount,o.starting_subtotal,0),o.tracking_carrier,o.tracking_number,1 FROM customer_account_orders l JOIN enclosure_orders o ON l.source_type='ENCLOSURE' AND o.order_id=l.source_order_id WHERE l.account_id=?
    UNION ALL
    SELECT l.source_type,l.source_order_id,o.status,COALESCE((SELECT group_concat(product_name,', ') FROM store_order_items i WHERE i.invoice_id=o.invoice_id),'WestTech Store Order'),o.created_at,o.updated_at,'SHIP','PAID',o.total_amount,'','',EXISTS(SELECT 1 FROM store_order_items i WHERE i.invoice_id=o.invoice_id) FROM customer_account_orders l JOIN orders o ON l.source_type='STORE' AND o.invoice_id=l.source_order_id WHERE l.account_id=?
    ORDER BY created_at DESC`).bind(account.id,account.id,account.id,account.id).all();
  return {profile:account,orders:(result?.results||[]).map(row=>({sourceType:row.source_type,orderId:row.order_id,status:row.status,title:row.title,createdAt:row.created_at,updatedAt:row.updated_at,fulfillmentMethod:row.fulfillment_method||'UNSET',paymentStatus:row.payment_status||'NOT_REQUESTED',total:Number(row.total||0),trackingCarrier:row.tracking_carrier||'',trackingNumber:row.tracking_number||'',canReorder:!!Number(row.can_reorder)}))};
}

export async function updateCustomerProfile(env,account,body,requestUrl){
  const db=requireOrdersDb(env),contact=validateContact({displayName:body?.displayName,emailAddress:body?.email||account.email,phoneNumber:body?.phone,communicationPreference:body?.communicationPreference,smsConsent:body?.smsConsent}),fulfillment=clean(body?.defaultFulfillmentMethod,30).toUpperCase()||'UNSET';if(!FULFILLMENT.has(fulfillment))throw error('Choose a valid default fulfillment method.');
  const consentAt=contact.smsConsent?(account.smsConsent?null:now()):null;
  await db.prepare(`UPDATE customer_accounts SET display_name=?,phone=?,communication_preference=?,sms_consent=?,sms_consented_at=CASE WHEN ? IS NOT NULL THEN ? WHEN ?=0 THEN NULL ELSE sms_consented_at END,default_fulfillment_method=?,address1=?,address2=?,city=?,region=?,postal_code=?,country=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(contact.displayName,contact.phone,contact.communicationPreference,contact.smsConsent?1:0,consentAt,consentAt,contact.smsConsent?1:0,fulfillment,clean(body?.address1,180)||null,clean(body?.address2,180)||null,clean(body?.city,100)||null,clean(body?.region,80)||null,clean(body?.postalCode,30)||null,clean(body?.country,2).toUpperCase()||'US',account.id).run();
  let emailChangePending=false;if(contact.email!==account.email){const conflict=await getAccountByEmail(db,contact.email);if(conflict&&conflict.id!==account.id)throw error('That email address is already connected to another account.',409);await db.prepare(`UPDATE customer_accounts SET pending_email=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(contact.email,account.id).run();const current=await getAccountById(db,account.id),raw=await issueToken(db,account.id,'EMAIL_CHANGE',contact.email),delivery=await sendPortalEmail(env,{account:{...current,pendingEmail:contact.email},rawToken:raw,purpose:'EMAIL_CHANGE',requestUrl});if(!delivery.sent)throw error(`Your profile was saved, but the new-email confirmation could not be sent: ${delivery.reason||'email service unavailable'}.`,502);emailChangePending=true;await log(db,account.id,'EMAIL_CHANGE_REQUESTED',{newEmail:contact.email});}
  await log(db,account.id,'PROFILE_UPDATED',{communicationPreference:contact.communicationPreference});return {profile:await getAccountById(db,account.id),emailChangePending};
}

async function allocate(db,counter,prefix){const date=now().slice(0,10).replaceAll('-',''),row=await db.prepare(`INSERT INTO ${counter} (order_date,last_value) VALUES (?,1001) ON CONFLICT(order_date) DO UPDATE SET last_value=last_value+1 RETURNING last_value`).bind(date).first(),sequence=Number(row?.last_value||1001);return {orderId:`${prefix}-${date}-${sequence}`,orderDate:date,sequence};}

export async function reorderCustomerOrder(env,account,sourceType,sourceOrderId){
  const db=requireOrdersDb(env),type=clean(sourceType,20).toUpperCase(),id=clean(sourceOrderId,80),owned=await db.prepare(`SELECT 1 AS ok FROM customer_account_orders WHERE account_id=? AND source_type=? AND source_order_id=? LIMIT 1`).bind(account.id,type,id).first();if(!owned)throw error('That order is not connected to your customer account.',404);
  let created;
  if(type==='COASTER'){
    const source=await db.prepare(`SELECT * FROM coaster_orders WHERE order_id=?`).bind(id).first();if(!source)throw error('The original coaster order is no longer available.',404);const next=await allocate(db,'coaster_order_counters','WTCC');
    await db.prepare(`INSERT INTO coaster_orders (order_id,order_date,daily_sequence,status,customer_name,customer_email,customer_phone,communication_preference,sms_consent,set_size,set_count,total_coasters,top_text,bottom_text,field_color,accent_color,ring_color,text_color,customer_notes,rights_confirmed,artwork_filename,artwork_content_type,artwork_size_bytes,artwork_object_key,design_snapshot_object_key,fulfillment_method,payment_required,base_price,final_amount,estimated_printer_minutes,admin_notes) VALUES (?,?,?,'DESIGN_REVIEW',?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'UNSET',1,NULL,NULL,?,?)`).bind(next.orderId,next.orderDate,next.sequence,account.displayName,account.email,account.phone,account.communicationPreference,account.smsConsent?1:0,source.set_size,source.set_count,source.total_coasters,source.top_text,source.bottom_text,source.field_color,source.accent_color,source.ring_color,source.text_color,`Reorder requested from ${id}.`,source.rights_confirmed,source.artwork_filename,source.artwork_content_type,source.artwork_size_bytes,source.artwork_object_key,source.design_snapshot_object_key,source.estimated_printer_minutes,`Customer portal reorder from ${id}. Reconfirm current pricing and availability.`).run();await db.prepare(`INSERT INTO coaster_order_events (order_id,event_type,detail) VALUES (?,'CUSTOMER_REORDER_REQUESTED',?)`).bind(next.orderId,json({sourceOrderId:id})).run();created=next.orderId;
  }else if(type==='ENCLOSURE'){
    const source=await db.prepare(`SELECT * FROM enclosure_orders WHERE order_id=?`).bind(id).first();if(!source)throw error('The original enclosure order is no longer available.',404);const next=await allocate(db,'enclosure_order_counters','WTE');
    await db.prepare(`INSERT INTO enclosure_orders (order_id,order_date,daily_sequence,status,customer_name,customer_email,customer_phone,communication_preference,sms_consent,sku,family,model,board_variant,offer_type,color,quantity,starting_unit_price,starting_subtotal,loaded_components_json,loaded_components_amount,customer_notes,fulfillment_preference,product_amount,admin_notes,estimated_printer_minutes) VALUES (?,?,?,'REQUEST_RECEIVED',?,?,?,?,?,?,?,?,?,?,?,?,0,0,?,?,?,? ,0,?,?)`).bind(next.orderId,next.orderDate,next.sequence,account.displayName,account.email,account.phone,account.communicationPreference,account.smsConsent?1:0,source.sku,source.family,source.model,source.board_variant,source.offer_type,source.color,source.quantity,source.loaded_components_json||'[]',source.loaded_components_amount||0,`Reorder requested from ${id}.`,source.fulfillment_preference||'DISCUSS',`Customer portal reorder from ${id}. Reconfirm current pricing and availability.`,source.estimated_printer_minutes||0).run();await db.prepare(`INSERT INTO enclosure_order_events (order_id,event_type,detail) VALUES (?,'CUSTOMER_REORDER_REQUESTED',?)`).bind(next.orderId,json({sourceOrderId:id})).run();created=next.orderId;
  }else if(type==='CUSTOM'){
    const source=await db.prepare(`SELECT * FROM custom_orders WHERE order_id=?`).bind(id).first();if(!source)throw error('The original custom order is no longer available.',404);let customer=await db.prepare(`SELECT id FROM custom_customers WHERE email=? COLLATE NOCASE ORDER BY is_active DESC,id LIMIT 1`).bind(account.email).first();if(!customer){customer=await db.prepare(`INSERT INTO custom_customers (display_name,contact_name,email,phone,communication_preference,sms_consent,sms_consented_at,default_fulfillment_method) VALUES (?,?,?,?,?,?,?,?) RETURNING id`).bind(account.displayName,account.displayName,account.email,account.phone,account.communicationPreference,account.smsConsent?1:0,account.smsConsent?now():null,account.defaultFulfillmentMethod).first();}
    const next=await allocate(db,'custom_order_counters','WTX'),items=JSON.parse(source.line_items_json||'[]').map(item=>({...item,unitAmount:0,lineTotal:0}));
    await db.prepare(`INSERT INTO custom_orders (order_id,order_date,daily_sequence,customer_id,status,customer_name,customer_email,customer_phone,communication_preference,sms_consent,title,line_items_json,customer_note,admin_notes,fulfillment_method,payment_required,production_required,subtotal_amount,taxable_amount_before_discount,discount_amount,shipping_amount,final_amount,estimated_printer_minutes,printer_assignment,production_window) VALUES (?,?,?,?, 'DRAFT',?,?,?,?,?,?,?,?,?,'UNSET',1,?,0,0,0,0,0,?,'UNASSIGNED',NULL)`).bind(next.orderId,next.orderDate,next.sequence,customer.id,account.displayName,account.email,account.phone,account.communicationPreference,account.smsConsent?1:0,`Reorder: ${source.title}`,json(items),`Reorder requested from ${id}.`,`Customer portal reorder from ${id}. Reconfirm scope, current pricing, and availability.`,source.production_required===0?0:1,source.estimated_printer_minutes||0).run();await db.prepare(`INSERT INTO custom_order_events (order_id,event_type,detail) VALUES (?,'CUSTOMER_REORDER_REQUESTED',?)`).bind(next.orderId,json({sourceOrderId:id})).run();created=next.orderId;
  }else if(type==='STORE'){
    const rows=await db.prepare(`SELECT product_sku,product_name,color,quantity FROM store_order_items WHERE invoice_id=? ORDER BY id`).bind(id).all(),items=(rows?.results||[]).map(row=>({sku:row.product_sku,name:row.product_name,color:row.color||'White',quantity:Number(row.quantity||1)}));if(!items.length)throw error('This older store order does not contain enough product detail for automatic Buy Again. Please open Enclosures and select the product again.',409);await log(db,account.id,'BUY_AGAIN_STARTED',{sourceType:type,sourceOrderId:id});return {cartItems:items};
  }else throw error('Choose a valid WestTech order type.');
  await db.prepare(`INSERT INTO customer_account_orders (account_id,source_type,source_order_id) VALUES (?,?,?)`).bind(account.id,type,created).run();await log(db,account.id,'REORDER_REQUESTED',{sourceType:type,sourceOrderId:id,newOrderId:created});return {orderId:created};
}
