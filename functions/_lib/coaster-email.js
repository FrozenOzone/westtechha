import { requireOrdersDb } from './orders.js';

const EMAIL_TYPES = new Set([
  'REQUEST_RECEIVED','PROOF_READY','CHANGES_REQUESTED','PAYMENT_REQUIRED',
  'IN_PRODUCTION','READY_FOR_PICKUP','SHIPPED','COMPLETED'
]);

function esc(value){
  return String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function money(value){
  const n=Number(value||0);return Number.isFinite(n)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n):'$0.00';
}
function clean(value,max=500){return typeof value==='string'?value.trim().slice(0,max):'';}
function setSummary(order){
  const setSize=Math.max(1,Number(order?.setSize||4));const setCount=Math.max(1,Number(order?.setCount||1));
  const total=Math.max(1,Number(order?.totalCoasters||setSize*setCount));
  return `${setCount} × ${setSize}-Coaster Set${setCount===1?'':'s'} • ${total} coaster${total===1?'':'s'}`;
}
function siteBase(env,requestUrl){
  const configured=clean(env?.PUBLIC_SITE_URL||env?.SITE_URL||'',300).replace(/\/+$/,'');
  if(configured)return configured;
  try{const u=new URL(requestUrl||'https://westtechha.com');return `${u.protocol}//${u.host}`;}catch(e){return 'https://westtechha.com';}
}
function replyTo(env){return clean(env?.COASTER_EMAIL_REPLY_TO||env?.ORDERS_EMAIL||'orders@westtechha.com',254);}
function fromAddress(env){return clean(env?.COASTER_EMAIL_FROM||'WestTech Home Automation <orders@westtechha.com>',320);}
function bccList(env){return clean(env?.COASTER_EMAIL_BCC||'',600).split(',').map(v=>v.trim()).filter(Boolean).slice(0,10);}
function safeLink(value){try{const u=new URL(String(value||''));return ['https:','http:'].includes(u.protocol)?u.toString():'';}catch(e){return '';}}

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
  let subject='',headline='',intro='',details=[],buttonLabel='',buttonUrl='',closing='Thank you for choosing WestTech.';

  if(type==='REQUEST_RECEIVED'){
    subject=`Custom coaster request received — ${orderId}`;
    headline='We received your custom coaster request.';
    intro=`Hi ${name}, your design request is now in WestTech design review. No payment has been collected.`;
    details=[`Order: ${orderId}`,summary];
  }else if(type==='PROOF_READY'){
    subject=`Your WestTech coaster proof is ready — ${orderId}`;
    headline='Your coaster proof is ready to review.';
    intro=`Hi ${name}, WestTech has finished reviewing your request and your proof and final order terms are ready.`;
    details=[`Order: ${orderId}`,summary,`Final total: ${finalTotal}`];
    buttonLabel='Review Proof & Terms';buttonUrl=approvalUrl;
  }else if(type==='CHANGES_REQUESTED'){
    subject=`We received your coaster changes — ${orderId}`;
    headline='Your requested changes are saved.';
    intro=`Hi ${name}, WestTech received your change request. We’ll review it and send a new proof when it’s ready.`;
    details=[`Order: ${orderId}`,`Proof version: ${Number(order?.proofVersion||1)}`];
  }else if(type==='PAYMENT_REQUIRED'){
    subject=`Design approved — complete payment — ${orderId}`;
    headline='Your design is approved.';
    intro=`Hi ${name}, your proof approval is recorded. Complete payment to release the order to production.`;
    details=[`Order: ${orderId}`,summary,`Approved total: ${finalTotal}`];
    if(order?.fulfillmentMethod==='SHIP')details.push('Shipping address: choose or confirm it in PayPal. WestTech will import the PayPal-confirmed address after payment.');
    buttonLabel='Continue to PayPal';buttonUrl=paymentUrl;
  }else if(type==='IN_PRODUCTION'){
    subject=`Your WestTech coaster order is in production — ${orderId}`;
    headline='Your coaster order is now in production.';
    intro=`Hi ${name}, your approved order has been released to WestTech production.`;
    details=[`Order: ${orderId}`,summary,order?.paymentRequired===false?'Payment: Not required':`Paid total: ${finalTotal}`];
  }else if(type==='READY_FOR_PICKUP'){
    subject=`Your WestTech coaster order is ready for pickup — ${orderId}`;
    headline='Your coaster order is ready for pickup.';
    intro=`Hi ${name}, your order is finished and marked Ready for Pickup.`;
    details=[`Order: ${orderId}`,summary,'Reply to this email if you need to coordinate pickup details.'];
  }else if(type==='SHIPPED'){
    subject=`Your WestTech coaster order has shipped — ${orderId}`;
    headline='Your coaster order has shipped.';
    intro=`Hi ${name}, your WestTech custom coaster order is on the way.`;
    details=[`Order: ${orderId}`,summary];
    if(carrier||tracking)details.push(`Tracking: ${[carrier,tracking].filter(Boolean).join(' • ')}`);
  }else if(type==='COMPLETED'){
    subject=`WestTech coaster order completed — ${orderId}`;
    headline='Your custom coaster order is complete.';
    intro=`Hi ${name}, WestTech has marked your custom coaster order complete.`;
    details=[`Order: ${orderId}`,summary];
  }

  const detailHtml=details.map(v=>`<div style="padding:8px 0;border-bottom:1px solid #dfe7f1;color:#182437;font-size:14px;">${esc(v)}</div>`).join('');
  const button=buttonLabel&&buttonUrl?`<div style="margin:26px 0;"><a href="${esc(buttonUrl)}" style="display:inline-block;background:#1677C4;color:#fff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:8px;">${esc(buttonLabel)}</a></div>`:'';
  const html=`<!doctype html><html><body style="margin:0;background:#f3f6fa;font-family:Arial,Helvetica,sans-serif;color:#152033;"><div style="max-width:640px;margin:0 auto;padding:28px 16px;"><div style="background:#071426;color:#fff;padding:22px 26px;border-radius:12px 12px 0 0;"><div style="font-size:22px;font-weight:800;color:#67aee8;">WestTech Home Automation</div><div style="font-size:11px;letter-spacing:1.5px;margin-top:4px;color:#aabbd0;">CUSTOM COASTERS • BUILT SMART • MADE CUSTOM</div></div><div style="background:#fff;padding:30px 26px;border:1px solid #dde6f0;border-top:0;border-radius:0 0 12px 12px;"><h1 style="font-size:24px;line-height:1.2;margin:0 0 16px;">${esc(headline)}</h1><p style="font-size:15px;line-height:1.6;color:#42526a;margin:0 0 18px;">${esc(intro)}</p><div style="border-top:1px solid #dfe7f1;">${detailHtml}</div>${button}<p style="font-size:14px;line-height:1.6;color:#42526a;margin:24px 0 0;">${esc(closing)}</p><p style="font-size:12px;line-height:1.5;color:#74839a;margin:18px 0 0;">Questions? Reply to this email or contact orders@westtechha.com.<br><a href="${esc(siteUrl)}" style="color:#1677C4;">WestTech Custom Coasters</a></p></div></div></body></html>`;
  const text=[headline,'',intro,'',...details,'',buttonUrl?`${buttonLabel}: ${buttonUrl}`:'',closing,'','Questions: orders@westtechha.com',siteUrl].filter(v=>v!==undefined&&v!==null).join('\n');
  return {subject,html,text};
}

function idempotencyKey(type,order){
  const id=clean(order?.orderId,80).replace(/[^A-Za-z0-9_.:-]/g,'-');
  const suffix=(type==='PROOF_READY'||type==='CHANGES_REQUESTED'||type==='PAYMENT_REQUIRED')?`-v${Math.max(1,Number(order?.proofVersion||1))}`:'';
  return `coaster-${type.toLowerCase().replaceAll('_','-')}-${id}${suffix}`.slice(0,240);
}
async function hasSent(env,orderId,key){
  const db=requireOrdersDb(env);
  const row=await db.prepare(`SELECT id FROM coaster_order_events WHERE order_id=? AND event_type='EMAIL_SENT' AND detail LIKE ? LIMIT 1`).bind(orderId,`%\"idempotencyKey\":\"${key}\"%`).first();
  return !!row;
}
async function logEvent(env,orderId,eventType,detail){
  try{const db=requireOrdersDb(env);await db.prepare(`INSERT INTO coaster_order_events (order_id,event_type,detail) VALUES (?,?,?)`).bind(orderId,eventType,JSON.stringify(detail)).run();}catch(e){}
}

export async function sendCoasterCustomerEmail(env,{type,order,approvalUrl='',paymentUrl='',requestUrl=''}={}){
  const normalized=String(type||'').toUpperCase();
  if(!EMAIL_TYPES.has(normalized)||!order?.orderId)return {sent:false,skipped:true,reason:'invalid-email-event'};
  const to=clean(order.customerEmail,254).toLowerCase();
  if(!to)return {sent:false,skipped:true,reason:'customer-email-missing'};
  const key=idempotencyKey(normalized,order);
  if(await hasSent(env,order.orderId,key))return {sent:true,duplicate:true,idempotencyKey:key};
  const rendered=template(normalized,order,{approvalUrl,paymentUrl,siteUrl:`${siteBase(env,requestUrl)}/coasters/`});
  const apiKey=clean(env?.RESEND_API_KEY,400);
  if(!apiKey){
    await logEvent(env,order.orderId,'EMAIL_NOT_CONFIGURED',{emailType:normalized,to,subject:rendered.subject,idempotencyKey:key});
    return {sent:false,skipped:true,reason:'RESEND_API_KEY not configured',idempotencyKey:key};
  }
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
