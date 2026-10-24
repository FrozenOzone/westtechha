import { requireOrdersDb } from './orders.js';
import { buildTaxQuote, validateShippingAddress } from './tax.js';
import { generateAccessToken, paypalBaseUrl } from './paypal.js';
import { readJsonSafe, sanitizeEnvValue } from './shared.js';

export const saleError=(message,status=400)=>Object.assign(new Error(message),{status});
const clean=(v,n=240)=>String(v??'').trim().slice(0,n);
const dollar=(c)=> (c/100).toFixed(2);
function cents(value){const str=String(value??'');if(!/^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/.test(str))throw saleError('Amounts must be nonnegative dollars with at most two decimals.');const [a,b='']=str.split('.');return Number(a)*100+Number((b+'00').slice(0,2));}
const money=(v)=>cents(v);
const dbFor=(env)=>requireOrdersDb(env);
function randomToken(){const a=new Uint8Array(32);crypto.getRandomValues(a);return [...a].map(x=>x.toString(16).padStart(2,'0')).join('');}
export function salesMode(context){const host=new URL(context.request.url).hostname.toLowerCase(),env=clean(context.env.PAYPAL_ENV).toLowerCase();if(['westtechha.com','www.westtechha.com'].includes(host))return env==='live'?'live':'blocked';if(host==='pickup-stage1-preview.westtechha.pages.dev'||host==='dev.westtechha.com')return env==='sandbox'?'sandbox':'blocked';return 'blocked';}
export function invoicePublicLink(context,row){const host=new URL(context.request.url).hostname.toLowerCase();const origin=host==='dev.westtechha.com'||host==='pickup-stage1-preview.westtechha.pages.dev'?'https://pickup-stage1-preview.westtechha.pages.dev':'https://westtechha.com';return origin+'/pay/sale.html#'+row.public_token;}
function safeCustomer(row){const {public_token,...rest}=row;return {...rest,items:JSON.parse(row.items_json),address:JSON.parse(row.address_json)};}
export function summary(row){return {...safeCustomer(row),subtotal:dollar(row.subtotal_cents),regular:dollar(row.regular_cents),discount:dollar(row.discount_cents),taxable:dollar(row.taxable_cents),tax:dollar(row.tax_cents),shipping:dollar(row.shipping_cents),total:dollar(row.total_cents)};}
export async function getInvoice(env,id){return dbFor(env).prepare('SELECT * FROM sales_invoices WHERE id=?').bind(id).first();}
export async function byToken(env,token){if(!/^[a-f0-9]{64}$/.test(String(token||'')))throw saleError('Invalid invoice link.',404);const r=await dbFor(env).prepare('SELECT * FROM sales_invoices WHERE public_token=?').bind(token).first();if(!r)throw saleError('Invoice link not found.',404);return r;}
export async function event(db,id,type,detail={}){await db.prepare('INSERT INTO sales_invoice_events (invoice_id,event_type,detail_json) VALUES (?,?,?)').bind(id,type,JSON.stringify(detail)).run();}
export async function prepareSale(env,input){
 if(!input||!Array.isArray(input.items)||input.items.length<1||input.items.length>20)throw saleError('Enter 1-20 invoice items.');
 const saleType=input.saleType==='INVOICE'?'INVOICE':'QUICK_SALE',name=clean(input.customerName,140),email=clean(input.customerEmail,254).toLowerCase();
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw saleError('Enter a valid customer email.');
 if(saleType==='INVOICE'&&!email)throw saleError('An emailed invoice needs a customer email.');
 const address=validateShippingAddress({...input.address,fullName:name||'WestTech customer'});
 // No silent assumption of zero tax on out-of-state or special-event transactions.
 if(address.state!=='CO')throw saleError('Sales outside Colorado require separate tax-jurisdiction setup. Not available in Quick Sales yet.');
 const label=clean(input.locationLabel,120);if(!label)throw saleError('Enter a sale location or craft-fair name.');
 let subtotal=0,regular=0;
 const items=input.items.map((line,i)=>{
  const description=clean(line.description,160),qty=Number(line.quantity),original=money(line.regularPrice),price=money(line.unitPrice);
  if(!description||!/^[1-9]\d{0,2}$/.test(String(line.quantity))||!Number.isInteger(qty))throw saleError('Enter a description and quantity of 1-999 for each item.');
  if(price>original)throw saleError('Override price may not exceed the regular price. Update regular price first.',400);
  regular+=original*qty;subtotal+=price*qty;
  return {description,quantity:qty,regularPrice:dollar(original),unitPrice:dollar(price),lineTotal:dollar(price*qty),discount:dollar((original-price)*qty)};
 });
 if(subtotal>100000000||regular>100000000)throw saleError('Sale exceeds the supported amount.');
 const discountReason=clean(input.discountReason,240);if(regular>subtotal&&!discountReason)throw saleError('Enter a reason for the price override or discount.');
 const shipping=money(input.shipping||'0.00');const exempt=Boolean(input.taxExempt),reason=exempt?clean(input.exemptReason,240):'';
 if(exempt&&!reason)throw saleError('A tax exemption requires a recorded reason.');
 const quote=await buildTaxQuote(env,address,{itemAmount:subtotal/100,taxableAmount:exempt?0:subtotal/100,shippingAmount:shipping/100});
 const tax=money(quote.taxAmount),total=subtotal+shipping+tax;
 if(total>100000000)throw saleError('Total exceeds supported limit.');
 return {saleType,customerName:name,customerEmail:email,locationLabel:label,address,items,notes:clean(input.notes,1000),discountReason,exemptReason:reason,
  subtotalCents:subtotal,regularCents:regular,discountCents:regular-subtotal,shippingCents:shipping,taxableCents:exempt?0:subtotal,taxCents:tax,totalCents:total,
  taxRate:Number(quote.taxRate),taxSource:exempt?'exempt:'+quote.source:quote.source,taxJurisdiction:clean(quote.jurisdictionCode,120),salesTax:quote.salesTax};
}
export async function createSale(env,input,expectedTotal){const sale=await prepareSale(env,input),db=dbFor(env),token=randomToken();
 if(String(expectedTotal)!==dollar(sale.totalCents))throw saleError('Sales tax or total has changed. Recalculate and approve before saving.',409);
 const result=await db.prepare(`INSERT INTO sales_invoices (public_token,customer_name,customer_email,sale_type,location_label,address_json,items_json,notes,discount_reason,exempt_reason,subtotal_cents,regular_cents,discount_cents,shipping_cents,taxable_cents,tax_cents,total_cents,tax_rate,tax_source,tax_jurisdiction) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
 .bind(token,sale.customerName,sale.customerEmail,sale.saleType,sale.locationLabel,JSON.stringify(sale.address),JSON.stringify(sale.items),sale.notes,sale.discountReason,sale.exemptReason,sale.subtotalCents,sale.regularCents,sale.discountCents,sale.shippingCents,sale.taxableCents,sale.taxCents,sale.totalCents,sale.taxRate,sale.taxSource,sale.taxJurisdiction).run();
 const id=Number(result.meta?.last_row_id);if(!id)throw saleError('Invoice was not saved.',500);
 const number='WTI-'+String(id).padStart(6,'0');await db.prepare('UPDATE sales_invoices SET invoice_number=? WHERE id=?').bind(number,id).run();await event(db,id,'CREATED',{total:dollar(sale.totalCents),saleType:sale.saleType,location:sale.locationLabel});return getInvoice(env,id);
}
export async function listSales(env){const db=dbFor(env);const rows=await db.prepare('SELECT * FROM sales_invoices ORDER BY id DESC LIMIT 250').all();
 const report=await db.prepare(`SELECT COUNT(*) AS count,
 COALESCE(SUM(CASE WHEN status='PAID' AND payment_method!='COMPLIMENTARY' THEN total_cents ELSE 0 END),0) AS paid,
 COALESCE(SUM(CASE WHEN status='PAID' AND payment_method!='COMPLIMENTARY' THEN tax_cents ELSE 0 END),0) AS tax,
 COALESCE(SUM(CASE WHEN status='PAID' THEN discount_cents ELSE 0 END),0) AS discount,
 COALESCE(SUM(CASE WHEN status IN ('DRAFT','SENT','PAYMENT_PENDING','CAPTURING','SEND_REVIEW') THEN total_cents ELSE 0 END),0) AS unpaid,
 COALESCE(SUM(CASE WHEN status='CHECK_PENDING' THEN total_cents ELSE 0 END),0) AS checks FROM sales_invoices`).first();
 const totals={count:Number(report?.count||0),paidCents:dollar(Number(report?.paid||0)),taxCents:dollar(Number(report?.tax||0)),discountCents:dollar(Number(report?.discount||0)),unpaidCents:dollar(Number(report?.unpaid||0)),checkPendingCents:dollar(Number(report?.checks||0))};
 return {invoices:(rows.results||[]).map(summary),totals,note:'Totals cover the complete ledger; the detail list and CSV contain the newest 250 invoices. Tax figures are not filed tax returns.'};
}
export async function recordManual(env,id,action){const db=dbFor(env),r=await getInvoice(env,id);if(!r)throw saleError('Invoice not found.',404);
 if(action==='void'){if(['PAID','CHECK_PENDING','CAPTURING','PAYMENT_PENDING','SENDING','SEND_REVIEW'].includes(r.status))throw saleError('A paid, pending, or in-flight payment cannot be voided.');const x=await db.prepare("UPDATE sales_invoices SET status='VOID',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('DRAFT','SENT')").bind(id).run();if(!x.meta?.changes)throw saleError('Invoice state changed.',409);await event(db,id,'VOID');return getInvoice(env,id);}
 if(action==='comp'){if(r.total_cents!==0||r.status!=='DRAFT')throw saleError('Complimentary closeout requires a zero-dollar draft.');const x=await db.prepare("UPDATE sales_invoices SET status='PAID',payment_method='COMPLIMENTARY',paid_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='DRAFT' AND total_cents=0").bind(id).run();if(!x.meta?.changes)throw saleError('Invoice state changed.',409);await event(db,id,'COMPLIMENTARY');return getInvoice(env,id);}
 if(action==='check-cleared'){if(r.status!=='CHECK_PENDING')throw saleError('Check is not awaiting clearance.');const x=await db.prepare("UPDATE sales_invoices SET status='PAID',paid_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='CHECK_PENDING'").bind(id).run();if(!x.meta?.changes)throw saleError('Check status changed.',409);await event(db,id,'CHECK_CLEARED');return getInvoice(env,id);}
 if(!['cash','check'].includes(action))throw saleError('Unsupported action.');if(!['DRAFT','SENT'].includes(r.status))throw saleError('Cannot record payment for this invoice.');
 const status=action==='cash'?'PAID':'CHECK_PENDING';const method=action.toUpperCase();
 const x=await db.prepare("UPDATE sales_invoices SET status=?,payment_method=?,paid_at=CASE WHEN ?='PAID' THEN CURRENT_TIMESTAMP ELSE NULL END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('DRAFT','SENT') AND NOT EXISTS (SELECT 1 FROM sales_payment_attempts WHERE invoice_id=?)").bind(status,method,status,id,id).run();
 if(!x.meta?.changes)throw saleError('A payment may already be processing. Refresh.',409);await event(db,id,status,{method});return getInvoice(env,id);
}
function esc(v){return String(v||'').replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));}
export async function sendSaleInvoice(context,id){const db=dbFor(context.env),r=await getInvoice(context.env,id);if(!r)throw saleError('Invoice not found.',404);
 if(r.status!=='DRAFT'||!r.customer_email||r.total_cents===0)throw saleError('Only an unpaid draft with a customer email and nonzero total can be sent.');
 const k=await db.prepare("UPDATE sales_invoices SET status='SENDING',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='DRAFT'").bind(id).run();if(k.meta?.changes!==1)throw saleError('Invoice sending state changed.',409);
 const link=invoicePublicLink(context,r),html=`<div style="font:16px/1.5 Arial,sans-serif"><h2>WestTech Home Automation</h2><p>Hello ${esc(r.customer_name||'there')},</p><p>Here is your invoice <strong>${esc(r.invoice_number)}</strong> for <strong>$${dollar(r.total_cents)}</strong>.</p><p><a href="${esc(link)}">View and pay your invoice securely</a></p><p>You can pay by PayPal or Venmo if your device/account is eligible.</p><p>Questions? Reply to this email.</p></div>`;
 try{const key=clean(context.env.RESEND_API_KEY,500);if(!key)throw Error('Resend not configured.');
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json','Idempotency-Key':'sales-invoice-'+r.id+'-v1'},body:JSON.stringify({from:clean(context.env.COASTER_EMAIL_FROM,300)||'WestTech Home Automation <orders@westtechha.com>',to:[r.customer_email],reply_to:clean(context.env.COASTER_EMAIL_REPLY_TO,254)||'orders@westtechha.com',subject:`WestTech invoice ${r.invoice_number} - $${dollar(r.total_cents)}`,html})});const data=await readJsonSafe(response);if(!response.ok)throw Error(data.message||'Resend rejected the invoice');
  await db.prepare("UPDATE sales_invoices SET status='SENT',sent_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='SENDING'").bind(id).run();await event(db,id,'EMAIL_SENT',{providerId:clean(data.id,100)});return getInvoice(context.env,id);
 }catch(e){await db.prepare("UPDATE sales_invoices SET status='SEND_REVIEW',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='SENDING'").bind(id).run();await event(db,id,'EMAIL_NEEDS_REVIEW',{reason:clean(e.message,300)});throw saleError('Invoice email delivery requires review. Do not resend blindly: '+clean(e.message,120),502);}
}
export async function paypalRequest(env,path,{method='GET',payload=null,requestId=null}={}){const access=await generateAccessToken(env);const response=await fetch(paypalBaseUrl(env.PAYPAL_ENV)+path,{method,headers:{Authorization:'Bearer '+access,Accept:'application/json',...(payload?{'Content-Type':'application/json'}:{}),...(requestId?{'PayPal-Request-Id':requestId}:{})},body:payload?JSON.stringify(payload):undefined});const data=await readJsonSafe(response);if(!response.ok)throw saleError(clean(data.details?.[0]?.description||data.message||'Provider request failed',200),response.status>=500?502:409);return data;}
export function orderPayload(row,method,attemptId){const amount=dollar(row.total_cents),subtotal=dollar(row.subtotal_cents),shipping=dollar(row.shipping_cents),tax=dollar(row.tax_cents);
 return {intent:'CAPTURE',purchase_units:[{custom_id:row.invoice_number,invoice_id:row.invoice_number+'-'+attemptId.slice(0,8),description:'WestTech direct sale '+row.invoice_number,amount:{currency_code:'USD',value:amount,breakdown:{item_total:{currency_code:'USD',value:subtotal},shipping:{currency_code:'USD',value:shipping},tax_total:{currency_code:'USD',value:tax}}},items:[{name:'WestTech merchandise',quantity:'1',category:'PHYSICAL_GOODS',unit_amount:{currency_code:'USD',value:subtotal}}]}]};
}
