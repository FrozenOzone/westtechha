import { requireOrdersDb } from './orders.js';

function clean(value,max=500){return typeof value==='string'?value.trim().slice(0,max):'';}
function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function siteBase(env,requestUrl){
  const configured=clean(env?.PUBLIC_SITE_URL||env?.SITE_URL||'',300).replace(/\/+$/,'');
  if(configured)return configured;
  try{const u=new URL(requestUrl||'https://westtechha.com');return `${u.protocol}//${u.host}`;}catch(e){return 'https://westtechha.com';}
}
function fromAddress(env){return clean(env?.COASTER_EMAIL_FROM||'WestTech Home Automation <orders@westtechha.com>',320);}
function adminAddress(env){return clean(env?.COASTER_ADMIN_EMAIL||env?.COASTER_EMAIL_REPLY_TO||env?.ORDERS_EMAIL||'orders@westtechha.com',254);}
async function hasSent(env,orderId,key){
  try{
    const db=requireOrdersDb(env);
    const row=await db.prepare(`SELECT id FROM coaster_order_events WHERE order_id=? AND event_type='EMAIL_SENT' AND detail LIKE ? LIMIT 1`).bind(orderId,`%\"idempotencyKey\":\"${key}\"%`).first();
    return !!row;
  }catch(e){return false;}
}
async function logEvent(env,orderId,eventType,detail){
  try{const db=requireOrdersDb(env);await db.prepare(`INSERT INTO coaster_order_events (order_id,event_type,detail) VALUES (?,?,?)`).bind(orderId,eventType,JSON.stringify(detail)).run();}catch(e){}
}

export async function sendCoasterAdminNewOrderEmail(env,{order,requestUrl=''}={}){
  if(!order?.orderId)return {sent:false,skipped:true,reason:'order-missing'};
  const to=adminAddress(env);
  if(!to)return {sent:false,skipped:true,reason:'admin-email-missing'};
  const apiKey=clean(env?.RESEND_API_KEY,400);
  const key=`coaster-admin-new-order-${clean(order.orderId,80).replace(/[^A-Za-z0-9_.:-]/g,'-')}`.slice(0,240);
  if(await hasSent(env,order.orderId,key))return {sent:true,duplicate:true,idempotencyKey:key};
  if(!apiKey){
    await logEvent(env,order.orderId,'EMAIL_NOT_CONFIGURED',{emailType:'ADMIN_NEW_ORDER',to,idempotencyKey:key});
    return {sent:false,skipped:true,reason:'RESEND_API_KEY not configured',idempotencyKey:key};
  }

  const root=siteBase(env,requestUrl);
  const adminUrl=`${root}/admin/coaster-orders.html?order=${encodeURIComponent(order.orderId)}`;
  const setCount=Math.max(1,Number(order.setCount||1));
  const setSize=Math.max(1,Number(order.setSize||4));
  const total=Math.max(1,Number(order.totalCoasters||setCount*setSize));
  const subject=`NEW CUSTOM COASTER REQUEST — ${order.orderId} — ${clean(order.customerName,120)}`;
  const rows=[
    ['Order',order.orderId],
    ['Customer',order.customerName],
    ['Email',order.customerEmail],
    ['Phone',order.customerPhone||'—'],
    ['Request',`${setCount} × ${setSize}-Coaster Set${setCount===1?'':'s'} • ${total} coasters`],
    ['Artwork',order.artworkFilename||'—'],
    ['Top text',order.topText||'(none)'],
    ['Bottom text',order.bottomText||'(none)'],
    ['Customer notes',order.customerNotes||'(none)']
  ];
  const rowHtml=rows.map(([label,value])=>`<tr><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:700;color:#334155;vertical-align:top;">${esc(label)}</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;color:#0f172a;">${esc(value)}</td></tr>`).join('');
  const html=`<!doctype html><html><body style="margin:0;background:#f3f6fa;font-family:Arial,Helvetica,sans-serif;color:#152033;"><div style="max-width:680px;margin:0 auto;padding:28px 16px;"><div style="background:#071426;color:#fff;padding:22px 26px;border-radius:12px 12px 0 0;"><div style="font-size:22px;font-weight:800;color:#67aee8;">WestTech Home Automation</div><div style="font-size:11px;letter-spacing:1.5px;margin-top:4px;color:#aabbd0;">INTERNAL ORDER ALERT</div></div><div style="background:#fff;padding:28px 26px;border:1px solid #dde6f0;border-top:0;border-radius:0 0 12px 12px;"><h1 style="font-size:24px;margin:0 0 8px;">New custom coaster request</h1><p style="margin:0 0 20px;color:#475569;">A customer just submitted a new Custom Coaster request. No payment has been collected.</p><table style="width:100%;border-collapse:collapse;font-size:14px;">${rowHtml}</table><div style="margin:26px 0 6px;"><a href="${esc(adminUrl)}" style="display:inline-block;background:#1677C4;color:#fff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:8px;">Open Order in WestTech Admin</a></div></div></div></body></html>`;
  const text=[
    'NEW CUSTOM COASTER REQUEST','',
    `Order: ${order.orderId}`,
    `Customer: ${order.customerName}`,
    `Email: ${order.customerEmail}`,
    `Phone: ${order.customerPhone||'—'}`,
    `Request: ${setCount} x ${setSize}-Coaster Set${setCount===1?'':'s'} • ${total} coasters`,
    `Artwork: ${order.artworkFilename||'—'}`,
    `Top text: ${order.topText||'(none)'}`,
    `Bottom text: ${order.bottomText||'(none)'}`,
    `Customer notes: ${order.customerNotes||'(none)'}`,'',
    `Open order: ${adminUrl}`
  ].join('\n');

  try{
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify({from:fromAddress(env),to:[to],subject,html,text,reply_to:clean(order.customerEmail,254)||to})});
    let data={};try{data=await response.json();}catch(e){}
    if(!response.ok)throw new Error(data?.message||data?.name||`Email provider returned ${response.status}.`);
    await logEvent(env,order.orderId,'EMAIL_SENT',{emailType:'ADMIN_NEW_ORDER',to,subject,provider:'RESEND',providerId:data?.id||null,idempotencyKey:key});
    return {sent:true,id:data?.id||null,idempotencyKey:key};
  }catch(error){
    await logEvent(env,order.orderId,'EMAIL_FAILED',{emailType:'ADMIN_NEW_ORDER',to,subject,message:clean(error?.message,600),idempotencyKey:key});
    return {sent:false,error:clean(error?.message,600)||'Admin email send failed.',idempotencyKey:key};
  }
}
