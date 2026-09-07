import { requireOrdersDb } from './orders.js';

const CUSTOMER_TYPES=new Set(['CONFIGURATION_READY','CHANGES_REQUESTED','PAYMENT_REQUIRED','PRODUCTION_QUEUED','IN_PRODUCTION','PREPARING_TO_SHIP','PREPARING_FOR_PICKUP','READY_FOR_PICKUP','SHIPPED','COMPLETED']);
function clean(value,max=500){return typeof value==='string'?value.trim().slice(0,max):'';}
function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function money(value){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(value||0));}
function siteBase(env,requestUrl){const configured=clean(env?.PUBLIC_SITE_URL||env?.SITE_URL||'',300).replace(/\/+$/,'');if(configured)return configured;try{const u=new URL(requestUrl||'https://westtechha.com');return `${u.protocol}//${u.host}`;}catch(e){return 'https://westtechha.com';}}
function fromAddress(env){return clean(env?.COASTER_EMAIL_FROM||'WestTech Home Automation <orders@westtechha.com>',320);}
function replyTo(env){return clean(env?.COASTER_EMAIL_REPLY_TO||env?.ORDERS_EMAIL||'orders@westtechha.com',254);}
function adminTo(env){return clean(env?.COASTER_ADMIN_EMAIL||replyTo(env),254);}
async function log(env,orderId,eventType,detail){try{const db=requireOrdersDb(env);await db.prepare(`INSERT INTO enclosure_order_events (order_id,event_type,detail) VALUES (?,?,?)`).bind(orderId,eventType,JSON.stringify(detail)).run();}catch(e){}}
async function alreadySent(env,orderId,key){try{const db=requireOrdersDb(env),needle=`\"idempotencyKey\":\"${key}\"`,row=await db.prepare(`SELECT id FROM enclosure_order_events WHERE order_id=? AND event_type='EMAIL_SENT' AND instr(detail,?)>0 LIMIT 1`).bind(orderId,needle).first();return !!row;}catch(e){return false;}}
async function send(env,{to,subject,html,text,replyToAddress,idempotencyKey,orderId,emailType}){
  if(await alreadySent(env,orderId,idempotencyKey))return {sent:true,duplicate:true,idempotencyKey};
  const apiKey=clean(env?.RESEND_API_KEY,400);
  if(!apiKey){await log(env,orderId,'EMAIL_NOT_CONFIGURED',{emailType,to,idempotencyKey});return {sent:false,skipped:true,reason:'RESEND_API_KEY not configured',idempotencyKey};}
  try{
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':idempotencyKey},body:JSON.stringify({from:fromAddress(env),to:[to],subject,html,text,reply_to:replyToAddress})});
    let data={};try{data=await response.json();}catch(e){}
    if(!response.ok)throw new Error(data?.message||`Email provider returned ${response.status}.`);
    await log(env,orderId,'EMAIL_SENT',{emailType,to,subject,provider:'RESEND',providerId:data?.id||null,idempotencyKey});
    return {sent:true,id:data?.id||null,idempotencyKey};
  }catch(error){await log(env,orderId,'EMAIL_FAILED',{emailType,to,message:clean(error?.message,600),idempotencyKey});return {sent:false,error:clean(error?.message,600)||'Email send failed.',idempotencyKey};}
}

function frame(title,content,siteUrl=''){
  const footer=siteUrl?`<p style="font-size:12px;line-height:1.5;color:#74839a;margin:18px 0 0;">Questions? Reply to this email or contact <a href="mailto:orders@westtechha.com" style="color:#1677C4;">orders@westtechha.com</a>.<br><a href="${esc(siteUrl)}" style="color:#1677C4;">WestTech ESP32 Enclosures</a></p>`:'';
  return `<!doctype html><html><body style="margin:0;background:#f3f6fa;font-family:Arial,Helvetica,sans-serif;color:#152033;"><div style="max-width:650px;margin:0 auto;padding:28px 16px;"><div style="background:#071426;color:#fff;padding:22px 26px;border-radius:12px 12px 0 0;"><div style="font-size:22px;font-weight:800;color:#67aee8;">WestTech Home Automation</div><div style="font-size:11px;letter-spacing:1.5px;margin-top:4px;color:#aabbd0;">ESP32 ENCLOSURES • BUILT SMART • MADE CUSTOM</div></div><div style="background:#fff;padding:30px 26px;border:1px solid #dde6f0;border-top:0;border-radius:0 0 12px 12px;"><h1 style="font-size:24px;line-height:1.25;margin:0 0 18px;">${esc(title)}</h1>${content}<p style="font-size:14px;line-height:1.6;color:#42526a;margin:26px 0 0;">Thanks,<br><strong>Ed</strong><br>WestTech Home Automation</p>${footer}</div></div></body></html>`;
}
function button(label,url){return label&&url?`<div style="margin:24px 0;"><a href="${esc(url)}" style="display:inline-block;background:#1677C4;color:#fff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:8px;">${esc(label)}</a></div>`:'';}
function detailRows(lines){return `<div style="border-top:1px solid #dfe7f1;margin-top:20px;">${lines.map(line=>`<div style="padding:9px 0;border-bottom:1px solid #dfe7f1;font-size:14px;">${esc(line)}</div>`).join('')}</div>`;}
function summary(order){return `${order.quantity} × ${order.model} — ${order.offerType}, ${order.color}`;}
function componentLines(order){if(order?.offerType!=='Loaded'||!Array.isArray(order?.loadedComponents))return [];const included=order.loadedComponents.filter(component=>component.required||component.selected).map(component=>component.label||component.componentSku).filter(Boolean),dualDisplayAcknowledged=order.loadedComponents.some(component=>component.dualDisplayAcknowledged===true);const lines=included.length?[`Installed components: ${included.join(', ')}`]:[];if(dualDisplayAcknowledged)lines.push('Two-display selection: OLED and LCD2004 combination acknowledged.');return lines;}
function trackingUrl(carrier,number){const n=encodeURIComponent(clean(number,180)),c=clean(carrier,50).toUpperCase();if(!n)return '';if(c.includes('USPS'))return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`;if(c.includes('UPS'))return `https://www.ups.com/track?loc=en_US&tracknum=${n}`;if(c.includes('FEDEX'))return `https://www.fedex.com/fedextrack/?trknbr=${n}`;if(c.includes('DHL'))return `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${n}`;return '';}

export async function sendEnclosureRequestEmails(env,{order,requestUrl=''}){
  const item=summary(order),customerSubject=`We received your enclosure request — ${order.orderId}`;
  const components=componentLines(order),customerContent=`<p style="font-size:15px;line-height:1.65;color:#42526a;">Thanks, ${esc(order.customerName)}. Your enclosure request is in and ready for review.</p><p style="font-size:15px;line-height:1.65;color:#42526a;">I’ll confirm the configuration, current production workload, final price, shipping or pickup terms, and an estimated production window before payment is requested.</p>${detailRows([`Order: ${order.orderId}`,`Configuration: ${item}`,...components,`Starting product subtotal: ${money(order.startingSubtotal)}`])}<p style="font-size:15px;line-height:1.65;color:#42526a;"><strong>No payment has been collected.</strong> You don’t need to do anything until WestTech sends the reviewed configuration and terms.</p>`;
  const customer=await send(env,{to:order.customerEmail,subject:customerSubject,html:frame(`Your enclosure request is in, ${order.customerName}.`,customerContent),text:`Your enclosure request is in.\n\nOrder: ${order.orderId}\nConfiguration: ${item}\n${components.join('\n')}${components.length?'\n':''}Starting product subtotal: ${money(order.startingSubtotal)}\n\nWestTech will review the configuration, final price, workload, and estimated production window before payment. No payment has been collected.`,replyToAddress:replyTo(env),idempotencyKey:`enclosure-customer-request-${order.orderId}`,orderId:order.orderId,emailType:'REQUEST_RECEIVED'});
  const root=siteBase(env,requestUrl),adminUrl=`${root}/admin/enclosure-orders.html?order=${encodeURIComponent(order.orderId)}`;
  const adminContent=`<p style="font-size:15px;line-height:1.65;color:#42526a;">A new enclosure request was submitted. No payment has been collected.</p>${detailRows([`Order: ${order.orderId}`,`Customer: ${order.customerName} — ${order.customerEmail}`,`Configuration: ${item}`,...components,`Customer notes: ${order.customerNotes||'None'}`])}${button('Open Enclosure Request',adminUrl)}`;
  const admin=await send(env,{to:adminTo(env),subject:`NEW ENCLOSURE REQUEST — ${order.orderId} — ${order.customerName}`,html:frame('New enclosure request',adminContent),text:`NEW ENCLOSURE REQUEST\n\nOrder: ${order.orderId}\nCustomer: ${order.customerName} — ${order.customerEmail}\nConfiguration: ${item}\n${components.join('\n')}${components.length?'\n':''}Notes: ${order.customerNotes||'None'}\n\nOpen: ${adminUrl}`,replyToAddress:order.customerEmail,idempotencyKey:`enclosure-admin-request-${order.orderId}`,orderId:order.orderId,emailType:'ADMIN_NEW_ORDER'});
  return {customer,admin};
}

function customerTemplate(type,order,{approvalUrl='',siteUrl=''}){
  const name=order.customerName||'there',item=summary(order),orderId=order.orderId,version=Math.max(1,Number(order.configurationVersion||1));
  let subject='',headline='',intro='',action='',label='',url='',lines=[`Order: ${orderId}`,`Configuration: ${item}`,...componentLines(order)];
  if(type==='CONFIGURATION_READY'){
    subject=`Review your WestTech enclosure configuration — ${orderId}`;headline=`Your enclosure configuration is ready, ${name}.`;intro=`WestTech has reviewed your request and prepared configuration version ${version}, including the final subtotal, fulfillment method, and estimated production window.`;action='Please review and either approve the terms or request a change. No payment is collected until after approval.';label='Review Configuration & Terms';url=approvalUrl;lines.push(`Reviewed subtotal: ${money(order.finalAmount)}`,`Estimated production window: ${order.productionWindow}`);
  }else if(type==='CHANGES_REQUESTED'){
    subject=`We received your enclosure changes — ${orderId}`;headline=`Your requested changes are recorded, ${name}.`;intro='The current configuration is back with WestTech for review.';action='I’ll update the configuration, price, fulfillment details, or production window as needed and send you a fresh private review link.';lines.push(`Requested change: ${order.customerChangeRequest||'See your request'}`);
  }else if(type==='PAYMENT_REQUIRED'){
    subject=`Configuration approved — payment is next — ${orderId}`;headline=`Your enclosure configuration is approved, ${name}.`;intro='Your approved configuration and production window are locked in. Payment is the next step before the order enters the WestTech production queue.';action='Use the button below to return to your private order page. That page always shows the current status and is the correct place to continue to PayPal.';label='View Order & Payment Status';url=approvalUrl;lines.push(`Approved subtotal: ${money(order.finalAmount)}`,`Estimated production window: ${order.productionWindow}`);
  }else if(type==='PRODUCTION_QUEUED'){
    subject=`Your enclosure is in the production queue — ${orderId}`;headline=`Your enclosure order is queued, ${name}.`;intro=order.paymentRequired?'Payment is complete and your approved enclosure order has entered the WestTech production queue.':'Your approved enclosure order has entered the WestTech production queue. No payment was required.';action=`The approved production estimate is ${order.productionWindow}. I’ll send another update when printing begins.`;lines.push(`Order total: ${money(order.paymentTotal||order.finalAmount)}`,`Estimated production window: ${order.productionWindow}`);
  }else if(type==='IN_PRODUCTION'){
    subject=`Your WestTech enclosure is in production — ${orderId}`;headline=`Printing has started, ${name}.`;intro='Your enclosure has moved from the queue into active production.';action='I’ll send another update when it reaches final preparation for shipping or pickup.';lines.push(`Estimated production window: ${order.productionWindow}`);
  }else if(type==='PREPARING_TO_SHIP'){
    subject=`Your enclosure is being prepared to ship — ${orderId}`;headline=`Your enclosure is almost on the way, ${name}.`;intro='Printing is complete and your enclosure is being inspected, finished, and packaged for shipment.';action='I’ll send tracking information as soon as the package ships.';
  }else if(type==='PREPARING_FOR_PICKUP'){
    subject=`Your enclosure is being prepared for pickup — ${orderId}`;headline=`Your enclosure is almost ready, ${name}.`;intro='Printing is complete and your enclosure is being inspected, finished, and packaged for pickup.';action='Please wait for the Ready for Pickup email before coming by.';
  }else if(type==='READY_FOR_PICKUP'){
    subject=`Your WestTech enclosure is ready for pickup — ${orderId}`;headline=`Your enclosure is ready for pickup, ${name}.`;intro='Production, final inspection, and packaging are complete.';action='Reply to this email if you need to coordinate pickup details.';
  }else if(type==='SHIPPED'){
    subject=`Your WestTech enclosure has shipped — ${orderId}`;headline=`Your enclosure is on the way, ${name}.`;intro='Production, inspection, and packaging are complete, and your order has shipped.';const track=trackingUrl(order.trackingCarrier,order.trackingNumber);action='Use the tracking details below to follow the shipment.';if(order.trackingCarrier)lines.push(`Carrier: ${order.trackingCarrier}`);if(order.trackingNumber)lines.push(`Tracking number: ${order.trackingNumber}`);if(track){label='Track Your Package';url=track;}
  }else if(type==='COMPLETED'){
    subject=`WestTech enclosure order complete — ${orderId}`;headline=`Your enclosure order is complete, ${name}.`;intro='Your WestTech enclosure order is now complete.';action='Thank you for trusting me with your project. If anything does not look right, reply to this email and let me know.';
  }
  const paragraphs=[intro,action].filter(Boolean).map(v=>`<p style="font-size:15px;line-height:1.65;color:#42526a;">${esc(v)}</p>`).join('');
  const html=frame(headline,`${paragraphs}${detailRows(lines)}${button(label,url)}`,siteUrl);
  const text=[headline,'',intro,'',action,'',...lines,'',url?`${label}: ${url}`:''].filter(Boolean).join('\n');return {subject,html,text};
}

export async function sendEnclosureCustomerEmail(env,{type,order,approvalUrl='',requestUrl=''}){
  const normalized=String(type||'').toUpperCase();if(!CUSTOMER_TYPES.has(normalized)||!order?.orderId)return {sent:false,skipped:true,reason:'invalid-email-event'};
  const to=clean(order.customerEmail,254).toLowerCase();if(!to)return {sent:false,skipped:true,reason:'customer-email-missing'};
  const versioned=['CONFIGURATION_READY','CHANGES_REQUESTED','PAYMENT_REQUIRED'].includes(normalized),delivery=normalized==='CONFIGURATION_READY'&&order.configurationSentAt?`-${String(order.configurationSentAt).replace(/[^A-Za-z0-9]/g,'')}`:'',key=`enclosure-${normalized.toLowerCase().replaceAll('_','-')}-${order.orderId}${versioned?`-v${Math.max(1,Number(order.configurationVersion||1))}`:''}${delivery}`.slice(0,240);
  const rendered=customerTemplate(normalized,order,{approvalUrl,siteUrl:`${siteBase(env,requestUrl)}/enclosures/`});
  return send(env,{to,subject:rendered.subject,html:rendered.html,text:rendered.text,replyToAddress:replyTo(env),idempotencyKey:key,orderId:order.orderId,emailType:normalized});
}

export async function sendEnclosureAdminProductionEmail(env,{order,requestUrl=''}){
  if(!order?.orderId)return {sent:false,skipped:true,reason:'order-missing'};
  const root=siteBase(env,requestUrl),adminUrl=`${root}/admin/enclosure-orders.html?order=${encodeURIComponent(order.orderId)}`,lines=[`Order: ${order.orderId}`,`Customer: ${order.customerName} — ${order.customerEmail}`,`Configuration: ${summary(order)}`,...componentLines(order),`Fulfillment: ${order.fulfillmentMethod==='LOCAL_PICKUP'?'Local Pickup':'Ship Order'}`,`Payment: ${order.paymentStatus}`,`Order total: ${money(order.paymentTotal||order.finalAmount)}`,`Estimated printer time: ${Number(order.estimatedPrinterMinutes||0)} minutes`,`Printer assignment: ${order.printerAssignment||'Open'}`,`Approved production window: ${order.productionWindow}`];
  const key=`enclosure-admin-production-${order.orderId}-v${Math.max(1,Number(order.configurationVersion||1))}`;
  return send(env,{to:adminTo(env),subject:`ENCLOSURE READY FOR PRODUCTION — ${order.orderId}`,html:frame('Enclosure order ready for production',`${detailRows(lines)}${button('Open Production Order',adminUrl)}`),text:`ENCLOSURE READY FOR PRODUCTION\n\n${lines.join('\n')}\n\nOpen: ${adminUrl}`,replyToAddress:order.customerEmail,idempotencyKey:key,orderId:order.orderId,emailType:'ADMIN_PRODUCTION_READY'});
}
