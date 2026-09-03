import { requireOrdersDb } from './orders.js';

const EMAIL_TYPES = new Set([
  'REQUEST_RECEIVED','PROOF_READY','CHANGES_REQUESTED','PAYMENT_REQUIRED',
  'PRODUCTION_QUEUED','IN_PRODUCTION','PREPARING_TO_SHIP','PREPARING_FOR_PICKUP',
  'READY_FOR_PICKUP','SHIPPED','COMPLETED'
]);

function esc(value){return String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function money(value){const n=Number(value||0);return Number.isFinite(n)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n):'$0.00';}
function clean(value,max=500){return typeof value==='string'?value.trim().slice(0,max):'';}
function setSummary(order){const setSize=Math.max(1,Number(order?.setSize||4));const setCount=Math.max(1,Number(order?.setCount||1));const total=Math.max(1,Number(order?.totalCoasters||setSize*setCount));return `${setCount} × ${setSize}-Coaster Set${setCount===1?'':'s'} • ${total} coaster${total===1?'':'s'}`;}
function siteBase(env,requestUrl){const configured=clean(env?.PUBLIC_SITE_URL||env?.SITE_URL||'',300).replace(/\/+$/,'');if(configured)return configured;try{const u=new URL(requestUrl||'https://westtechha.com');return `${u.protocol}//${u.host}`;}catch(e){return 'https://westtechha.com';}}
function replyTo(env){return clean(env?.COASTER_EMAIL_REPLY_TO||env?.ORDERS_EMAIL||'orders@westtechha.com',254);}
function fromAddress(env){return clean(env?.COASTER_EMAIL_FROM||'WestTech Home Automation <orders@westtechha.com>',320);}
function bccList(env){return clean(env?.COASTER_EMAIL_BCC||'',600).split(',').map(v=>v.trim()).filter(Boolean).slice(0,10);}
function safeLink(value){try{const u=new URL(String(value||''));return ['https:','http:'].includes(u.protocol)?u.toString():'';}catch(e){return '';}}
function trackingLink(carrier,tracking){
  const code=clean(carrier,80).toUpperCase().replace(/[^A-Z0-9]/g,'');
  const number=clean(tracking,160).replace(/\s+/g,'');
  if(!number)return '';
  const q=encodeURIComponent(number);
  if(code==='USPS')return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${q}`;
  if(code==='UPS')return `https://www.ups.com/track?loc=en_US&tracknum=${q}`;
  if(code==='FEDEX')return `https://www.fedex.com/fedextrack/?trknbr=${q}`;
  if(code==='DHL')return `https://www.dhl.com/us-en/home/tracking.html?awb=${q}&brand=dhl`;
  return '';
}

function template(type,order,links={}){
  const name=clean(order?.customerName,120)||'there';
  const orderId=clean(order?.orderId,80)||'WestTech order';
  const summary=setSummary(order);
  const finalTotal=money(order?.finalAmount);
  const approvalUrl=safeLink(links.approvalUrl);
  const paymentUrl=safeLink(links.paymentUrl||order?.paypalApprovalUrl);
  const siteUrl=safeLink(links.siteUrl)||'https://westtechha.com/coasters/';
  const tracking=clean(order?.trackingNumber,160);
  const carrier=clean(order?.trackingCarrier,80);
  const trackingUrl=safeLink(trackingLink(carrier,tracking));
  let subject='',headline='',intro='',process='',action='',details=[],buttonLabel='',buttonUrl='';

  if(type==='REQUEST_RECEIVED'){
    subject=`We received your custom coaster request — ${orderId}`;
    headline=`Thanks, ${name} — your coaster request is in.`;
    intro='I’ve got your artwork and order details, and I’ll review everything before anything moves into production.';
    process='Next I’ll check the artwork, wording, colors, quantity, and whether anything needs to be adjusted for a clean manufactured result. When that review is finished, I’ll send you a proof with the final order terms.';
    action='You don’t need to do anything right now. No payment has been collected.';
    details=[`Order: ${orderId}`,summary];
  }else if(type==='PROOF_READY'){
    subject=`Your WestTech coaster proof is ready — ${orderId}`;
    headline=`Your proof is ready, ${name}.`;
    intro='I’ve reviewed your request and prepared the design that WestTech will use for your order.';
    process='Please check the artwork, wording, quantity, fulfillment method, and final total. Once you approve the proof, those customer-facing terms become the production reference. If something needs changing, use the change-request option instead of approving it.';
    action='Your next step is to review the proof and either approve it or request changes.';
    details=[`Order: ${orderId}`,summary,`Final total: ${finalTotal}`];
    buttonLabel='Review Proof & Terms';buttonUrl=approvalUrl;
  }else if(type==='CHANGES_REQUESTED'){
    subject=`I received your coaster changes — ${orderId}`;
    headline=`Got it, ${name} — your changes are saved.`;
    intro='I received the changes you requested and the previous proof is no longer the active production version.';
    process='I’ll review your notes, update the design as needed, and send you a fresh proof when it’s ready.';
    action='There’s nothing else you need to do until the updated proof arrives.';
    details=[`Order: ${orderId}`,`Current proof version: ${Number(order?.proofVersion||1)}`];
  }else if(type==='PAYMENT_REQUIRED'){
    subject=`Design approved — one step left — ${orderId}`;
    headline=`Your design is approved, ${name}.`;
    intro='Your proof approval is recorded and the design is locked in. Payment is the last step before your order enters the WestTech production queue.';
    process='Paying does not mean a printer starts immediately. WestTech manufactures custom work in small batches, so paid orders enter the production queue first and I’ll send another update when manufacturing actually begins.';
    action='Your next step is to complete payment through PayPal.';
    details=[`Order: ${orderId}`,summary,`Approved total: ${finalTotal}`];
    if(order?.fulfillmentMethod==='SHIP')details.push('Shipping address: choose or confirm it in PayPal. WestTech will use the PayPal-confirmed address for this order.');
    buttonLabel='Continue to PayPal';buttonUrl=paymentUrl;
  }else if(type==='PRODUCTION_QUEUED'){
    const paid=String(order?.paymentStatus||'').toUpperCase()==='PAID';
    subject=paid?`Payment received — your order is in the production queue — ${orderId}`:`Your order is in the production queue — ${orderId}`;
    headline=paid?`Payment received — you’re in the production queue.`:`Your approved order is in the production queue.`;
    intro=paid?`Thanks, ${name}. Your payment is complete and your approved coaster order is now in the WestTech production queue.`:`Thanks, ${name}. Your approved coaster order is now in the WestTech production queue, and no payment is required for this order.`;
    process='This means your design and order details are locked and ready to manufacture. Because WestTech produces custom work in small batches, your order may wait while earlier jobs are completed and the equipment is prepared for your print. Manufacturing has not started yet.';
    action='You don’t need to do anything right now. I’ll email you again when your order actually moves into production.';
    details=[`Order: ${orderId}`,summary,paid?`Paid total: ${finalTotal}`:'Payment: Not required'];
  }else if(type==='IN_PRODUCTION'){
    subject=`Manufacturing has started — ${orderId}`;
    headline=`Good news, ${name} — your coaster order is in production.`;
    intro='Your order has moved out of the production queue and manufacturing has actually started.';
    process=order?.fulfillmentMethod==='LOCAL_PICKUP'?'Once the print work is complete, I’ll inspect the pieces and prepare the order for pickup. You’ll get another update before it is marked Ready for Pickup.':'Once the print work is complete, I’ll inspect the pieces and prepare the order for shipment. You’ll get another update before it is marked Shipped.';
    action='No action is needed from you right now.';
    details=[`Order: ${orderId}`,summary,order?.paymentRequired===false?'Payment: Not required':`Paid total: ${finalTotal}`];
  }else if(type==='PREPARING_TO_SHIP'){
    subject=`Your coaster order is being prepared to ship — ${orderId}`;
    headline=`Manufacturing is finished — I’m preparing your order to ship.`;
    intro=`Hi ${name}, the manufacturing portion of your coaster order is complete.`;
    process='I’m now checking the finished pieces, handling any final cleanup, organizing the set, and packaging it for shipment. This is the final preparation stage before the package leaves WestTech.';
    action='You don’t need to do anything. I’ll send the shipping confirmation and tracking information once the package is actually on the way.';
    details=[`Order: ${orderId}`,summary];
  }else if(type==='PREPARING_FOR_PICKUP'){
    subject=`Your coaster order is being prepared for pickup — ${orderId}`;
    headline=`Manufacturing is finished — I’m preparing your order for pickup.`;
    intro=`Hi ${name}, the manufacturing portion of your coaster order is complete.`;
    process='I’m now checking the finished pieces, handling any final cleanup, organizing the set, and getting everything packaged for pickup. It is not quite Ready for Pickup yet.';
    action='You don’t need to come by yet. I’ll send another email as soon as the order is fully ready for pickup.';
    details=[`Order: ${orderId}`,summary];
  }else if(type==='READY_FOR_PICKUP'){
    subject=`Your WestTech coaster order is ready for pickup — ${orderId}`;
    headline=`Your order is ready for pickup, ${name}.`;
    intro='Manufacturing, final inspection, and packaging are complete. Your custom coaster order is now marked Ready for Pickup.';
    process='At this point the production work is finished and the order is waiting for handoff.';
    action='Reply to this email if you need to coordinate pickup details.';
    details=[`Order: ${orderId}`,summary];
  }else if(type==='SHIPPED'){
    subject=`Your WestTech coaster order has shipped — ${orderId}`;
    headline=`Your coaster order is on the way, ${name}.`;
    intro='Manufacturing, inspection, and packaging are complete, and your WestTech custom coaster order has now shipped.';
    process='The order has left the WestTech production workflow and is now with the carrier.';
    action=trackingUrl?'Use the tracking information below or the Track Your Package button to follow the shipment.':'Use the tracking information below to follow the shipment.';
    details=[`Order: ${orderId}`,summary];
    if(carrier)details.push(`Carrier: ${carrier}`);
    if(tracking)details.push(`Tracking number: ${tracking}`);
    if(trackingUrl){buttonLabel='Track Your Package';buttonUrl=trackingUrl;}
  }else if(type==='COMPLETED'){
    subject=`WestTech coaster order complete — ${orderId}`;
    headline=`That wraps up your custom coaster order, ${name}.`;
    intro='Your WestTech custom coaster order is now complete.';
    process='Thanks for trusting me with your project. Custom work takes a little more back-and-forth than something pulled from a shelf, but that is also what lets us make the piece specifically for you.';
    action='If anything about the finished order doesn’t look right, just reply to this email and let me know.';
    details=[`Order: ${orderId}`,summary];
  }

  const detailHtml=details.map(v=>{
    const value=String(v||'');
    if(trackingUrl&&value.startsWith('Tracking number: ')){
      const number=value.slice('Tracking number: '.length);
      return `<div style="padding:8px 0;border-bottom:1px solid #dfe7f1;color:#182437;font-size:14px;">Tracking number: <a href="${esc(trackingUrl)}" style="color:#1677C4;font-weight:700;text-decoration:underline;">${esc(number)}</a></div>`;
    }
    return `<div style="padding:8px 0;border-bottom:1px solid #dfe7f1;color:#182437;font-size:14px;">${esc(value)}</div>`;
  }).join('');
  const button=buttonLabel&&buttonUrl?`<div style="margin:26px 0;"><a href="${esc(buttonUrl)}" style="display:inline-block;background:#1677C4;color:#fff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:8px;">${esc(buttonLabel)}</a></div>`:'';
  const paragraph=v=>v?`<p style="font-size:15px;line-height:1.65;color:#42526a;margin:0 0 16px;">${esc(v)}</p>`:'';
  const html=`<!doctype html><html><body style="margin:0;background:#f3f6fa;font-family:Arial,Helvetica,sans-serif;color:#152033;"><div style="max-width:640px;margin:0 auto;padding:28px 16px;"><div style="background:#071426;color:#fff;padding:22px 26px;border-radius:12px 12px 0 0;"><div style="font-size:22px;font-weight:800;color:#67aee8;">WestTech Home Automation</div><div style="font-size:11px;letter-spacing:1.5px;margin-top:4px;color:#aabbd0;">CUSTOM COASTERS • BUILT SMART • MADE CUSTOM</div></div><div style="background:#fff;padding:30px 26px;border:1px solid #dde6f0;border-top:0;border-radius:0 0 12px 12px;"><h1 style="font-size:24px;line-height:1.2;margin:0 0 18px;">${esc(headline)}</h1>${paragraph(intro)}${paragraph(process)}${paragraph(action)}<div style="border-top:1px solid #dfe7f1;margin-top:20px;">${detailHtml}</div>${button}<p style="font-size:14px;line-height:1.6;color:#42526a;margin:26px 0 0;">Thanks,<br><strong>Ed</strong><br>WestTech Home Automation</p><p style="font-size:12px;line-height:1.5;color:#74839a;margin:18px 0 0;">Questions? Reply to this email or contact orders@westtechha.com.<br><a href="${esc(siteUrl)}" style="color:#1677C4;">WestTech Custom Coasters</a></p></div></div></body></html>`;
  const text=[headline,'',intro,'',process,'',action,'',...details,'',buttonUrl?`${buttonLabel}: ${buttonUrl}`:'','Thanks,','Ed','WestTech Home Automation','','Questions: orders@westtechha.com',siteUrl].filter(v=>v!==undefined&&v!==null&&v!=='').join('\n');
  return {subject,html,text};
}

function idempotencyKey(type,order){const id=clean(order?.orderId,80).replace(/[^A-Za-z0-9_.:-]/g,'-');const suffix=(type==='PROOF_READY'||type==='CHANGES_REQUESTED'||type==='PAYMENT_REQUIRED')?`-v${Math.max(1,Number(order?.proofVersion||1))}`:'';return `coaster-${type.toLowerCase().replaceAll('_','-')}-${id}${suffix}`.slice(0,240);}
async function hasSent(env,orderId,key){try{const db=requireOrdersDb(env);const needle=`\"idempotencyKey\":\"${key}\"`;const row=await db.prepare(`SELECT id FROM coaster_order_events WHERE order_id=? AND event_type='EMAIL_SENT' AND instr(detail,?)>0 LIMIT 1`).bind(orderId,needle).first();return !!row;}catch(e){return false;}}
async function logEvent(env,orderId,eventType,detail){try{const db=requireOrdersDb(env);await db.prepare(`INSERT INTO coaster_order_events (order_id,event_type,detail) VALUES (?,?,?)`).bind(orderId,eventType,JSON.stringify(detail)).run();}catch(e){}}

export async function sendCoasterCustomerEmail(env,{type,order,approvalUrl='',paymentUrl='',requestUrl=''}={}){
  const normalized=String(type||'').toUpperCase();
  if(!EMAIL_TYPES.has(normalized)||!order?.orderId)return {sent:false,skipped:true,reason:'invalid-email-event'};
  const to=clean(order.customerEmail,254).toLowerCase();
  if(!to)return {sent:false,skipped:true,reason:'customer-email-missing'};
  const key=idempotencyKey(normalized,order);
  if(await hasSent(env,order.orderId,key))return {sent:true,duplicate:true,idempotencyKey:key};
  const rendered=template(normalized,order,{approvalUrl,paymentUrl,siteUrl:`${siteBase(env,requestUrl)}/coasters/`});
  const apiKey=clean(env?.RESEND_API_KEY,400);
  if(!apiKey){await logEvent(env,order.orderId,'EMAIL_NOT_CONFIGURED',{emailType:normalized,to,subject:rendered.subject,idempotencyKey:key});return {sent:false,skipped:true,reason:'RESEND_API_KEY not configured',idempotencyKey:key};}
  const payload={from:fromAddress(env),to:[to],subject:rendered.subject,html:rendered.html,text:rendered.text,reply_to:replyTo(env)};
  const bcc=bccList(env);if(bcc.length)payload.bcc=bcc;
  try{
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify(payload)});
    let data={};try{data=await response.json();}catch(e){}
    if(!response.ok)throw new Error(data?.message||data?.name||`Email provider returned ${response.status}.`);
    await logEvent(env,order.orderId,'EMAIL_SENT',{emailType:normalized,to,subject:rendered.subject,provider:'RESEND',providerId:data?.id||null,idempotencyKey:key});
    return {sent:true,id:data?.id||null,idempotencyKey:key};
  }catch(error){
    await logEvent(env,order.orderId,'EMAIL_FAILED',{emailType:normalized,to,subject:rendered.subject,message:clean(error?.message,600),idempotencyKey:key});
    return {sent:false,error:clean(error?.message,600)||'Email send failed.',idempotencyKey:key};
  }
}