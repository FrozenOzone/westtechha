import { requireOrdersDb } from './orders.js';

function clean(value,max=500){return typeof value==='string'?value.trim().slice(0,max):'';}
function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function money(value){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(value||0));}
function siteBase(env,requestUrl){const configured=clean(env?.PUBLIC_SITE_URL||env?.SITE_URL||'',300).replace(/\/+$/,'');if(configured)return configured;try{const u=new URL(requestUrl||'https://westtechha.com');return `${u.protocol}//${u.host}`;}catch(e){return 'https://westtechha.com';}}
function fromAddress(env){return clean(env?.COASTER_EMAIL_FROM||'WestTech Home Automation <orders@westtechha.com>',320);}
function replyTo(env){return clean(env?.COASTER_EMAIL_REPLY_TO||env?.ORDERS_EMAIL||'orders@westtechha.com',254);}
async function log(env,orderId,eventType,detail){try{const db=requireOrdersDb(env);await db.prepare(`INSERT INTO enclosure_order_events (order_id,event_type,detail) VALUES (?,?,?)`).bind(orderId,eventType,JSON.stringify(detail)).run();}catch(e){}}
async function send(env,{to,subject,html,text,replyToAddress,idempotencyKey,orderId,emailType}){
  const apiKey=clean(env?.RESEND_API_KEY,400);
  if(!apiKey){await log(env,orderId,'EMAIL_NOT_CONFIGURED',{emailType,to,idempotencyKey});return {sent:false,skipped:true,reason:'RESEND_API_KEY not configured'};}
  try{
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':idempotencyKey},body:JSON.stringify({from:fromAddress(env),to:[to],subject,html,text,reply_to:replyToAddress})});
    let data={};try{data=await response.json();}catch(e){}
    if(!response.ok)throw new Error(data?.message||`Email provider returned ${response.status}.`);
    await log(env,orderId,'EMAIL_SENT',{emailType,to,subject,provider:'RESEND',providerId:data?.id||null,idempotencyKey});
    return {sent:true,id:data?.id||null};
  }catch(error){await log(env,orderId,'EMAIL_FAILED',{emailType,to,message:clean(error?.message,600),idempotencyKey});return {sent:false,error:clean(error?.message,600)||'Email send failed.'};}
}

function frame(title,content){return `<!doctype html><html><body style="margin:0;background:#f3f6fa;font-family:Arial,Helvetica,sans-serif;color:#152033;"><div style="max-width:650px;margin:0 auto;padding:28px 16px;"><div style="background:#071426;color:#fff;padding:22px 26px;border-radius:12px 12px 0 0;"><div style="font-size:22px;font-weight:800;color:#67aee8;">WestTech Home Automation</div><div style="font-size:11px;letter-spacing:1.5px;margin-top:4px;color:#aabbd0;">ESP32 ENCLOSURES • BUILT SMART • MADE CUSTOM</div></div><div style="background:#fff;padding:30px 26px;border:1px solid #dde6f0;border-top:0;border-radius:0 0 12px 12px;"><h1 style="font-size:24px;line-height:1.25;margin:0 0 18px;">${esc(title)}</h1>${content}<p style="font-size:14px;line-height:1.6;color:#42526a;margin:26px 0 0;">Thanks,<br><strong>Ed</strong><br>WestTech Home Automation</p></div></div></body></html>`;}

export async function sendEnclosureRequestEmails(env,{order,requestUrl=''}){
  const summary=`${order.quantity} × ${order.model} — ${order.offerType}, ${order.color}`;
  const customerSubject=`We received your enclosure request — ${order.orderId}`;
  const customerContent=`<p style="font-size:15px;line-height:1.65;color:#42526a;">Thanks, ${esc(order.customerName)}. Your enclosure request is in and ready for review.</p><p style="font-size:15px;line-height:1.65;color:#42526a;">I’ll confirm the configuration, current production workload, final price, shipping or pickup terms, and an estimated production window before payment is requested.</p><div style="border-top:1px solid #dfe7f1;margin-top:20px;"><div style="padding:9px 0;border-bottom:1px solid #dfe7f1;"><strong>Order:</strong> ${esc(order.orderId)}</div><div style="padding:9px 0;border-bottom:1px solid #dfe7f1;"><strong>Configuration:</strong> ${esc(summary)}</div><div style="padding:9px 0;border-bottom:1px solid #dfe7f1;"><strong>Starting product subtotal:</strong> ${esc(money(order.startingSubtotal))}</div></div><p style="font-size:15px;line-height:1.65;color:#42526a;"><strong>No payment has been collected.</strong> You don’t need to do anything until WestTech sends the reviewed configuration and terms.</p>`;
  const customer=await send(env,{to:order.customerEmail,subject:customerSubject,html:frame(`Your enclosure request is in, ${order.customerName}.`,customerContent),text:`Your enclosure request is in.\n\nOrder: ${order.orderId}\nConfiguration: ${summary}\nStarting product subtotal: ${money(order.startingSubtotal)}\n\nWestTech will review the configuration, final price, workload, and estimated production window before payment. No payment has been collected.`,replyToAddress:replyTo(env),idempotencyKey:`enclosure-customer-request-${order.orderId}`,orderId:order.orderId,emailType:'REQUEST_RECEIVED'});

  const root=siteBase(env,requestUrl);
  const adminUrl=`${root}/admin/enclosure-orders.html?order=${encodeURIComponent(order.orderId)}`;
  const adminTo=replyTo(env);
  const adminContent=`<p style="font-size:15px;line-height:1.65;color:#42526a;">A new enclosure request was submitted. No payment has been collected.</p><div style="border-top:1px solid #dfe7f1;"><div style="padding:9px 0;border-bottom:1px solid #dfe7f1;"><strong>Order:</strong> ${esc(order.orderId)}</div><div style="padding:9px 0;border-bottom:1px solid #dfe7f1;"><strong>Customer:</strong> ${esc(order.customerName)} — ${esc(order.customerEmail)}</div><div style="padding:9px 0;border-bottom:1px solid #dfe7f1;"><strong>Configuration:</strong> ${esc(summary)}</div><div style="padding:9px 0;border-bottom:1px solid #dfe7f1;"><strong>Customer notes:</strong> ${esc(order.customerNotes||'None')}</div></div><div style="margin:24px 0;"><a href="${esc(adminUrl)}" style="display:inline-block;background:#1677C4;color:#fff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:8px;">Open Enclosure Request</a></div>`;
  const admin=await send(env,{to:adminTo,subject:`NEW ENCLOSURE REQUEST — ${order.orderId} — ${order.customerName}`,html:frame('New enclosure request',adminContent),text:`NEW ENCLOSURE REQUEST\n\nOrder: ${order.orderId}\nCustomer: ${order.customerName} — ${order.customerEmail}\nConfiguration: ${summary}\nNotes: ${order.customerNotes||'None'}\n\nOpen: ${adminUrl}`,replyToAddress:order.customerEmail,idempotencyKey:`enclosure-admin-request-${order.orderId}`,orderId:order.orderId,emailType:'ADMIN_NEW_ORDER'});
  return {customer,admin};
}
