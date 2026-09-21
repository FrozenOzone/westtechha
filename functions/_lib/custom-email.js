import { requireOrdersDb } from './orders.js';
import { sendTransactionalSms, transactionalSmsText } from './sms.js';

const TYPES=new Set(['CUSTOM_ORDER_READY','CUSTOM_ORDER_REMINDER','CHANGES_REQUESTED','PAYMENT_REQUIRED','PRODUCTION_QUEUED','IN_PRODUCTION','PREPARING_TO_SHIP','PREPARING_FOR_PICKUP','READY_FOR_PICKUP','SHIPPED','COMPLETED']);
function clean(value,max=500){return String(value??'').trim().slice(0,max);}
function esc(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}
function money(value){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(value||0));}
function siteBase(env,requestUrl){const configured=clean(env?.PUBLIC_SITE_URL||env?.SITE_URL||'',300).replace(/\/+$/,'');if(configured)return configured;try{const url=new URL(requestUrl||'https://westtechha.com');return `${url.protocol}//${url.host}`;}catch{return 'https://westtechha.com';}}
function fromAddress(env){return clean(env?.COASTER_EMAIL_FROM||'WestTech Home Automation <orders@westtechha.com>',320);}
function replyTo(env){return clean(env?.COASTER_EMAIL_REPLY_TO||env?.ORDERS_EMAIL||'orders@westtechha.com',254);}
function adminTo(env){return clean(env?.COASTER_ADMIN_EMAIL||replyTo(env),254);}
async function log(env,orderId,eventType,detail){try{await requireOrdersDb(env).prepare(`INSERT INTO custom_order_events (order_id,event_type,detail) VALUES (?,?,?)`).bind(orderId,eventType,JSON.stringify(detail)).run();}catch{}}
async function alreadySent(env,orderId,key){try{const needle=`"idempotencyKey":"${key}"`,row=await requireOrdersDb(env).prepare(`SELECT id FROM custom_order_events WHERE order_id=? AND event_type='EMAIL_SENT' AND instr(detail,?)>0 LIMIT 1`).bind(orderId,needle).first();return !!row;}catch{return false;}}
async function receiptByKey(env,key){try{return await requireOrdersDb(env).prepare(`SELECT id,status,provider_email_id FROM custom_order_email_receipts WHERE idempotency_key=? LIMIT 1`).bind(key).first();}catch{return null;}}
async function createReceipt(env,{orderId,emailType,audience,to,subject,idempotencyKey,status='SENDING',error=''}){try{await requireOrdersDb(env).prepare(`INSERT INTO custom_order_email_receipts (order_id,email_type,audience,recipient,subject,idempotency_key,status,last_error,last_event_at) VALUES (?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP) ON CONFLICT(idempotency_key) DO UPDATE SET status=excluded.status,last_error=excluded.last_error,last_event_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP`).bind(orderId,emailType,audience,to,subject,idempotencyKey,status,error||null).run();}catch{}}
async function updateReceipt(env,idempotencyKey,{status,providerEmailId='',error=''}){try{const sent=status==='SENT';await requireOrdersDb(env).prepare(`UPDATE custom_order_email_receipts SET status=?,provider_email_id=COALESCE(NULLIF(?,''),provider_email_id),sent_at=CASE WHEN ? THEN COALESCE(sent_at,CURRENT_TIMESTAMP) ELSE sent_at END,failed_at=CASE WHEN ?='FAILED' THEN CURRENT_TIMESTAMP ELSE failed_at END,last_error=?,last_event_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE idempotency_key=?`).bind(status,providerEmailId,sent?1:0,status,error||null,idempotencyKey).run();}catch{}}
async function send(env,{to,subject,html,text,replyToAddress,idempotencyKey,orderId,emailType,audience='CUSTOMER'}){
  const existing=await receiptByKey(env,idempotencyKey);
  if(existing&&['SENT','DELIVERED','OPENED','CLICKED'].includes(String(existing.status||'').toUpperCase()))return {sent:true,duplicate:true,id:existing.provider_email_id||null,idempotencyKey};
  if(!existing&&await alreadySent(env,orderId,idempotencyKey))return {sent:true,duplicate:true,idempotencyKey};
  const apiKey=clean(env?.RESEND_API_KEY,400);
  if(!apiKey){await createReceipt(env,{orderId,emailType,audience,to,subject,idempotencyKey,status:'NOT_CONFIGURED',error:'RESEND_API_KEY not configured'});await log(env,orderId,'EMAIL_NOT_CONFIGURED',{emailType,to,subject,idempotencyKey});return {sent:false,skipped:true,reason:'RESEND_API_KEY not configured',idempotencyKey};}
  await createReceipt(env,{orderId,emailType,audience,to,subject,idempotencyKey});
  try{
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':idempotencyKey},body:JSON.stringify({from:fromAddress(env),to:[to],subject,html,text,reply_to:replyToAddress})}),data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data?.message||`Email provider returned ${response.status}.`);
    await updateReceipt(env,idempotencyKey,{status:'SENT',providerEmailId:data?.id||''});
    await log(env,orderId,'EMAIL_SENT',{emailType,to,subject,provider:'RESEND',providerId:data?.id||null,idempotencyKey});
    return {sent:true,id:data?.id||null,idempotencyKey};
  }catch(error){
    const message=clean(error?.message,600)||'Email send failed.';
    await updateReceipt(env,idempotencyKey,{status:'FAILED',error:message});
    await log(env,orderId,'EMAIL_FAILED',{emailType,to,subject,message,idempotencyKey});
    return {sent:false,error:message,idempotencyKey};
  }
}
function frame(title,content,customerFacing=false){const inboxNote=customerFacing?`<p style="font-size:12px;line-height:1.5;color:#74839a;margin:12px 0 0;">Missing a WestTech email? Check your Junk/Spam folder or search your mailbox for <strong>orders@westtechha.com</strong>.</p>`:'';return `<!doctype html><html><body style="margin:0;background:#f3f6fa;font-family:Arial,Helvetica,sans-serif;color:#152033;"><div style="max-width:650px;margin:0 auto;padding:28px 16px;"><div style="background:#071426;color:#fff;padding:22px 26px;border-radius:12px 12px 0 0;"><div style="font-size:22px;font-weight:800;color:#67aee8;">WestTech Home Automation</div><div style="font-size:11px;letter-spacing:1.5px;margin-top:4px;color:#aabbd0;">DIRECT CUSTOM WORK • BUILT SMART • MADE CUSTOM</div></div><div style="background:#fff;padding:30px 26px;border:1px solid #dde6f0;border-top:0;border-radius:0 0 12px 12px;"><h1 style="font-size:24px;line-height:1.25;margin:0 0 18px;">${esc(title)}</h1>${content}<p style="font-size:14px;line-height:1.6;color:#42526a;margin:26px 0 0;">Thanks,<br><strong>Ed</strong><br>WestTech Home Automation</p><p style="font-size:12px;line-height:1.5;color:#74839a;margin:18px 0 0;">Questions? Reply to this email or contact orders@westtechha.com.</p>${inboxNote}</div></div></body></html>`;}
function button(label,url){return label&&url?`<div style="margin:24px 0;"><a href="${esc(url)}" style="display:inline-block;background:#1677C4;color:#fff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:8px;">${esc(label)}</a></div>`:'';}
function rows(lines){return `<div style="border-top:1px solid #dfe7f1;margin-top:20px;">${lines.map(line=>`<div style="padding:9px 0;border-bottom:1px solid #dfe7f1;font-size:14px;">${esc(line)}</div>`).join('')}</div>`;}
function itemLines(order){return (order.lineItems||[]).map(item=>`${item.quantity} × ${item.description} @ ${money(item.unitAmount)} — ${money(item.lineTotal)}`);}
function detailLines(order){const lines=[`Order: ${order.orderId}`,`Project: ${order.title}`,...itemLines(order),`Subtotal: ${money(order.subtotalAmount)}`];if(Number(order.discountAmount)>0)lines.push(`Discount / special pricing: −${money(order.discountAmount)}`);if(Number(order.shippingAmount)>0)lines.push(`Shipping: ${money(order.shippingAmount)}`);lines.push(`Approved subtotal before destination tax: ${money(order.finalAmount)}`,`Fulfillment: ${order.fulfillmentMethod==='LOCAL_PICKUP'?'Local Pickup':'Ship Order'}`);if(order.productionRequired===false)lines.push('Production: Already made — no production required');else if(order.productionWindow)lines.push(`Estimated production window: ${order.productionWindow}`);return lines;}
function trackingUrl(carrier,number){const value=encodeURIComponent(clean(number,180)),name=clean(carrier,50).toUpperCase();if(!value)return '';if(name.includes('USPS'))return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${value}`;if(name.includes('UPS'))return `https://www.ups.com/track?loc=en_US&tracknum=${value}`;if(name.includes('FEDEX'))return `https://www.fedex.com/fedextrack/?trknbr=${value}`;if(name.includes('DHL'))return `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${value}`;return '';}
function template(type,order,{approvalUrl=''}) {
  const name=order.customerName||'there',details=detailLines(order),alreadyMade=order.productionRequired===false;
  let subject='',headline='',intro='',process='',action='',label='',url='';
  if(type==='CUSTOM_ORDER_READY'){
    subject=`Your WestTech custom order is ready to review — ${order.orderId}`;
    headline=`Your custom order is ready, ${name}.`;
    intro=alreadyMade?`I’ve put together the order details and special pricing for your already-made item.`:`I’ve put together your custom WestTech order with the work, pricing, fulfillment method, and production estimate we discussed.`;
    process='Please look everything over carefully. Once you approve it, the customer-facing terms become the locked reference for payment and fulfillment. If anything needs changing, use the change-request option instead of approving it.';
    action='Your next step is to review the order and either approve it or request a change. Nothing is charged until after approval.';
    label='Review Custom Order';url=approvalUrl;
  }else if(type==='CUSTOM_ORDER_REMINDER'){
    subject=`A quick reminder: your WestTech order is ready — ${order.orderId}`;
    headline=`A quick reminder about your custom order, ${name}.`;
    intro='I wanted to make sure the private review link for your WestTech order reached you.';
    process='The order is still waiting for your review. Please check the work, pricing, fulfillment method, and production estimate, then approve it or request a change.';
    action='If the earlier email was filtered, please check Spam or Junk and add orders@westtechha.com to your contacts.';
    label='Review Custom Order';url=approvalUrl;
  }else if(type==='CHANGES_REQUESTED'){
    subject=`I received your custom-order changes — ${order.orderId}`;
    headline=`Got it, ${name} — your changes are saved.`;
    intro='I received the changes you requested, and the previous order details are no longer active.';
    process='I’ll review your notes, update the scope or pricing as needed, and send you a fresh private review link when it is ready.';
    action='There’s nothing else you need to do until the revised order arrives.';
    details.push(`Requested change: ${order.customerChangeRequest||'See your request'}`);
  }else if(type==='PAYMENT_REQUIRED'){
    subject=`Order approved — one step left — ${order.orderId}`;
    headline=`Your custom order is approved, ${name}.`;
    intro=alreadyMade?'Your approval is recorded and the agreed scope, pricing, and fulfillment terms for the already-made item are locked in.':'Your approval is recorded and the agreed work, pricing, fulfillment method, and production window are locked in.';
    process=alreadyMade?'Payment is the last step before I prepare the item for pickup or shipping. It will not enter the manufacturing queue because it is already made.':'Payment is the last step before the order enters the WestTech production queue. Paying reserves its FIFO position; it does not mean a printer starts immediately.';
    action='Return to your private order page to continue to PayPal. Colorado destination tax is calculated when applicable before payment is captured.';
    label='View Order & Payment Status';url=approvalUrl;
  }else if(type==='PRODUCTION_QUEUED'){
    subject=`Payment received — your order is in the production queue — ${order.orderId}`;
    headline=`Payment received — you’re in the production queue, ${name}.`;
    intro=order.paymentRequired?'Thanks—your payment is complete and your approved custom order is now in the WestTech production queue.':'Your approved custom order is now in the WestTech production queue, and no payment was required.';
    process='Your order is locked and ready to manufacture. WestTech completes custom work in FIFO order, so it may wait while earlier jobs are finished and the printers are prepared. Manufacturing has not started yet.';
    action='You don’t need to do anything right now. I’ll email you again when the order actually moves into production.';
  }else if(type==='IN_PRODUCTION'){
    subject=`Manufacturing has started — ${order.orderId}`;
    headline=`Good news, ${name} — your custom order is in production.`;
    intro='Your order has moved out of the queue and manufacturing has actually started.';
    process=order.fulfillmentMethod==='LOCAL_PICKUP'?'After printing, I’ll inspect and finish the pieces, then prepare everything for pickup.':'After printing, I’ll inspect and finish the pieces, then package everything for shipment.';
    action='No action is needed from you right now. I’ll send another update when it reaches final preparation.';
  }else if(type==='PREPARING_TO_SHIP'){
    subject=`Your custom order is being prepared to ship — ${order.orderId}`;
    headline=`I’m preparing your order to ship, ${name}.`;
    intro=alreadyMade?'Payment is complete for your already-made item.':'The manufacturing portion of your custom order is complete.';
    process='I’m checking the finished pieces, handling any final cleanup, and packaging the order. This is the last step before it leaves WestTech.';
    action='You don’t need to do anything. I’ll send the shipping confirmation and tracking information once the package is actually on the way.';
  }else if(type==='PREPARING_FOR_PICKUP'){
    subject=`Your custom order is being prepared for pickup — ${order.orderId}`;
    headline=`I’m preparing your order for pickup, ${name}.`;
    intro=alreadyMade?'Your already-made item is paid and now being prepared for pickup.':'The manufacturing portion of your custom order is complete.';
    process='I’m checking the finished pieces, handling any final cleanup, and getting everything packaged. It is not quite Ready for Pickup yet.';
    action='Please wait for the Ready for Pickup email before coming by.';
  }else if(type==='READY_FOR_PICKUP'){
    subject=`Your WestTech custom order is ready for pickup — ${order.orderId}`;
    headline=`Your order is ready for pickup, ${name}.`;
    intro=alreadyMade?'Payment is complete and your already-made item is ready for pickup.':'Manufacturing, final inspection, and packaging are complete.';
    process='The order is finished and waiting for handoff.';
    action='Reply to this email if you need to coordinate pickup details.';
  }else if(type==='SHIPPED'){
    subject=`Your WestTech custom order has shipped — ${order.orderId}`;
    headline=`Your custom order is on the way, ${name}.`;
    intro='Your WestTech order has left the fulfillment workflow and is now with the carrier.';
    process='The manufacturing or inventory preparation, inspection, and packaging are complete.';
    action='Use the tracking information below to follow the shipment.';
    details.push(`Carrier: ${order.trackingCarrier}`,`Tracking number: ${order.trackingNumber}`);
    url=trackingUrl(order.trackingCarrier,order.trackingNumber);label=url?'Track Your Package':'';
  }else if(type==='COMPLETED'){
    subject=`WestTech custom order complete — ${order.orderId}`;
    headline=`That wraps up your custom order, ${name}.`;
    intro='Your WestTech custom order is now complete.';
    process='Every WestTech custom order is handled individually rather than pulled from a generic shelf. That takes a little more coordination, but it is also what lets me build or prepare the order specifically for you.';
    action='Thank you for trusting me with your project. If anything doesn’t look right, just reply to this email and let me know.';
  }
  const paragraphs=[intro,process,action].filter(Boolean).map(value=>`<p style="font-size:15px;line-height:1.65;color:#42526a;margin:0 0 16px;">${esc(value)}</p>`).join('');
  const html=frame(headline,`${paragraphs}${rows(details)}${button(label,url)}`,true);
  const text=[headline,'',intro,'',process,'',action,'',...details,'',url?`${label}: ${url}`:'','', 'Missing a WestTech email? Check your Junk/Spam folder or search your mailbox for orders@westtechha.com.'].filter(Boolean).join('\n');
  return {subject,html,text,smsUrl:url};
}

export async function sendCustomCustomerEmail(env,{type,order,approvalUrl='',requestUrl=''}={}){const normalized=String(type||'').toUpperCase();if(!TYPES.has(normalized)||!order?.orderId)return {sent:false,skipped:true,reason:'invalid-email-event'};const to=clean(order.customerEmail,254).toLowerCase();if(!to)return {sent:false,skipped:true,reason:'customer-email-missing'};const delivery=normalized==='CUSTOM_ORDER_READY'&&order.orderSentAt?`-${String(order.orderSentAt).replace(/[^A-Za-z0-9]/g,'')}`:'',key=`custom-${normalized.toLowerCase().replaceAll('_','-')}-${order.orderId}-v${Math.max(1,Number(order.orderVersion||1))}${delivery}`.slice(0,240),rendered=template(normalized,order,{approvalUrl}),email=await send(env,{to,subject:rendered.subject,html:rendered.html,text:rendered.text,replyToAddress:replyTo(env),idempotencyKey:key,orderId:order.orderId,emailType:normalized}),sms=await sendTransactionalSms(env,{sourceType:'CUSTOM',order,eventType:normalized,message:transactionalSmsText({subject:rendered.subject,orderId:order.orderId,url:rendered.smsUrl}),idempotencyKey:`sms-${key}`});return {...email,sms};}
export async function sendCustomAdminChangeRequestEmail(env,{order,requestUrl=''}={}){if(!order?.orderId)return {sent:false,skipped:true,reason:'order-missing'};const root=siteBase(env,requestUrl),adminUrl=`${root}/admin/custom-orders.html?order=${encodeURIComponent(order.orderId)}`,details=[`Order: ${order.orderId}`,`Customer: ${order.customerName} — ${order.customerEmail}`,`Project: ${order.title}`,`Requested change: ${order.customerChangeRequest||'Open the order for details.'}`],changeKey=String(order.changesRequestedAt||Date.now()).replace(/[^A-Za-z0-9]/g,''),key=`custom-admin-change-${order.orderId}-v${Math.max(1,Number(order.orderVersion||1))}-${changeKey}`.slice(0,240);return send(env,{to:adminTo(env),subject:`CUSTOM ORDER CHANGE REQUEST — ${order.orderId}`,html:frame('A customer requested changes',`${rows(details)}${button('Open Custom Order',adminUrl)}`),text:`CUSTOM ORDER CHANGE REQUEST\n\n${details.join('\n')}\n\nOpen: ${adminUrl}`,replyToAddress:order.customerEmail,idempotencyKey:key,orderId:order.orderId,emailType:'ADMIN_CHANGE_REQUEST',audience:'ADMIN'});}
export async function sendCustomAdminProductionEmail(env,{order,requestUrl=''}={}){if(!order?.orderId)return {sent:false,skipped:true,reason:'order-missing'};const root=siteBase(env,requestUrl),adminUrl=`${root}/admin/custom-orders.html?order=${encodeURIComponent(order.orderId)}`,alreadyMade=order.productionRequired===false,destination=order.fulfillmentMethod==='LOCAL_PICKUP'?'PICKUP':'SHIPPING',details=[`Order: ${order.orderId}`,`Customer: ${order.customerName} — ${order.customerEmail}`,...detailLines(order),`Payment: ${order.paymentStatus}`,`Payment total: ${money(order.paymentTotal||order.finalAmount)}`];if(!alreadyMade)details.push(`Estimated printer time: ${Number(order.estimatedPrinterMinutes||0)} minutes`,`Printer assignment: ${order.printerAssignment||'Unassigned'}`);const subject=alreadyMade?`CUSTOM SALE READY FOR ${destination} — ${order.orderId}`:`CUSTOM ORDER READY FOR PRODUCTION — ${order.orderId}`,headline=alreadyMade?'Already-made custom sale is ready for fulfillment':'Custom order ready for production',key=`custom-admin-${alreadyMade?'fulfillment':'production'}-${order.orderId}-v${Math.max(1,Number(order.orderVersion||1))}`;return send(env,{to:adminTo(env),subject,html:frame(headline,`${rows(details)}${button('Open Custom Order',adminUrl)}`),text:`${subject}\n\n${details.join('\n')}\n\nOpen: ${adminUrl}`,replyToAddress:order.customerEmail,idempotencyKey:key,orderId:order.orderId,emailType:alreadyMade?'ADMIN_FULFILLMENT_READY':'ADMIN_PRODUCTION_READY',audience:'ADMIN'});}
export async function sendCustomAdminFollowUpEmail(env,{order,requestUrl=''}={}){if(!order?.orderId)return {sent:false,skipped:true,reason:'order-missing'};const root=siteBase(env,requestUrl),adminUrl=`${root}/admin/custom-orders.html?order=${encodeURIComponent(order.orderId)}`,details=[`Order: ${order.orderId}`,`Customer: ${order.customerName} — ${order.customerEmail}`,'A single customer reminder was sent because delivery was confirmed but no verified site visit was recorded after 24 hours.'],key=`custom-admin-reminder-${order.orderId}-v${Math.max(1,Number(order.orderVersion||1))}`;return send(env,{to:adminTo(env),subject:`CUSTOM ORDER FOLLOW-UP SENT — ${order.orderId}`,html:frame('Customer follow-up sent',`${rows(details)}${button('Open Custom Order',adminUrl)}`),text:`CUSTOM ORDER FOLLOW-UP SENT\n\n${details.join('\n')}\n\nOpen: ${adminUrl}`,replyToAddress:order.customerEmail,idempotencyKey:key,orderId:order.orderId,emailType:'ADMIN_CUSTOM_ORDER_REMINDER',audience:'ADMIN'});}
export async function sendCustomAdminDeliveryFailureEmail(env,{orderId,recipient,emailType,message='',providerEmailId='',requestUrl=''}={}){if(!orderId)return {sent:false,skipped:true,reason:'order-missing'};const root=siteBase(env,requestUrl),adminUrl=`${root}/admin/custom-orders.html?order=${encodeURIComponent(orderId)}`,details=[`Order: ${orderId}`,`Customer email: ${recipient||'Unknown'}`,`Email: ${String(emailType||'Customer email').replaceAll('_',' ')}`,`Problem: ${message||'The email provider reported a delivery failure.'}`],key=`custom-admin-delivery-failure-${orderId}-${providerEmailId||String(emailType||'email')}`.slice(0,240);return send(env,{to:adminTo(env),subject:`CUSTOMER EMAIL DELIVERY PROBLEM — ${orderId}`,html:frame('A customer email needs attention',`${rows(details)}${button('Open Custom Order',adminUrl)}`),text:`CUSTOMER EMAIL DELIVERY PROBLEM\n\n${details.join('\n')}\n\nOpen: ${adminUrl}`,replyToAddress:replyTo(env),idempotencyKey:key,orderId,emailType:'ADMIN_EMAIL_DELIVERY_FAILURE',audience:'ADMIN'});}
