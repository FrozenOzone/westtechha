import { requireOrdersDb } from './orders.js';
import { byToken, saleError, salesMode, summary, event, paypalRequest, orderPayload } from './sales-invoices.js';
const dbFor=env=>requireOrdersDb(env);
const clean=v=>String(v??'').trim();
function publicInvoice(row){const x=summary(row);return {invoice_number:x.invoice_number,customer_name:x.customer_name,location_label:x.location_label,address:x.address,items:x.items,regular:x.regular,discount:x.discount,discount_reason:x.discount_reason,subtotal:x.subtotal,shipping:x.shipping,tax:x.tax,total:x.total,status:x.status,tax_rate:x.tax_rate,tax_source:x.tax_source};}
export async function invoiceForBuyer(context,token){const row=await byToken(context.env,token);return {invoice:publicInvoice(row),mode:salesMode(context),clientId:['live','sandbox'].includes(salesMode(context))?clean(context.env.PAYPAL_CLIENT_ID):''};}
export async function beginPayment(context,token,method){
 if(!['PAYPAL','VENMO'].includes(method))throw saleError('Select PayPal or Venmo.');const mode=salesMode(context);if(!['live','sandbox'].includes(mode))throw saleError('Electronic payment is not configured on this site.',403);
 const env=context.env,db=dbFor(env),row=await byToken(env,token);
 if(!['DRAFT','SENT','PAYMENT_PENDING'].includes(row.status)||row.total_cents<=0)throw saleError('This invoice is not available for payment.',409);
 if(row.status==='PAYMENT_PENDING'){
  const current=await db.prepare("SELECT * FROM sales_payment_attempts WHERE invoice_id=? AND status IN ('CREATING','CREATED') ORDER BY created_at DESC LIMIT 1").bind(row.id).first();
  if(current?.status==='CREATED'&&current.method===method)return {orderId:current.provider_order_id,reused:true};
  throw saleError('A checkout is already in progress. Do not start another payment.',409);
 }
 const recent=await db.prepare("SELECT COUNT(*) n FROM sales_payment_attempts WHERE invoice_id=? AND created_at>datetime('now','-1 hour')").bind(row.id).first();
 if(Number(recent?.n||0)>=12)throw saleError('Too many payment attempts. Contact WestTech.',429);
 const attemptId=crypto.randomUUID(),pending='PENDING'+attemptId.replaceAll('-','').toUpperCase();
 const lock=await db.prepare("UPDATE sales_invoices SET status='PAYMENT_PENDING',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status IN ('DRAFT','SENT') AND paypal_capture_id IS NULL").bind(row.id).run();
 if(lock.meta?.changes!==1)throw saleError('Another payment is already processing. Refresh.',409);
 try{await db.prepare("INSERT INTO sales_payment_attempts (attempt_id,invoice_id,method,provider_order_id,status) VALUES (?,?,?,?,'CREATING')").bind(attemptId,row.id,method,pending).run();
  const created=await paypalRequest(env,'/v2/checkout/orders',{method:'POST',payload:orderPayload(row,method,attemptId),requestId:'WT-SALE-'+attemptId});
  if(!/^[A-Z0-9]{8,32}$/i.test(created?.id||''))throw saleError('PayPal order ID was invalid.',502);
  const finish=await db.prepare("UPDATE sales_payment_attempts SET provider_order_id=?,status='CREATED',updated_at=CURRENT_TIMESTAMP WHERE attempt_id=? AND status='CREATING'").bind(created.id,attemptId).run();if(finish.meta?.changes!==1)throw saleError('Checkout needs admin review; do not pay again.',502);
  await event(db,row.id,'PAYMENT_STARTED',{method});return {orderId:created.id,reused:false};
 }catch(e){const attempt=await db.prepare('SELECT * FROM sales_payment_attempts WHERE attempt_id=?').bind(attemptId).first();
  if(attempt?.status==='CREATING'){
   await db.prepare("UPDATE sales_payment_attempts SET status='FAILED',updated_at=CURRENT_TIMESTAMP WHERE attempt_id=? AND status='CREATING'").bind(attemptId).run();
   await db.prepare("UPDATE sales_invoices SET status=CASE WHEN sent_at IS NULL THEN 'DRAFT' ELSE 'SENT' END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PAYMENT_PENDING'").bind(row.id).run();
  }
  throw e;
 }
}
export async function cancelPayment(context,token,providerOrderId){const row=await byToken(context.env,token),db=dbFor(context.env);
 if(row.status==='PAID')throw saleError('The payment was already recorded.',409);
 const result=await db.prepare("UPDATE sales_payment_attempts SET status='CANCELED',updated_at=CURRENT_TIMESTAMP WHERE invoice_id=? AND provider_order_id=? AND status='CREATED'").bind(row.id,providerOrderId).run();
 if(result.meta?.changes!==1)throw saleError('Payment is processing or cancellation is unavailable. Contact WestTech.',409);
 await db.prepare("UPDATE sales_invoices SET status=CASE WHEN sent_at IS NULL THEN 'DRAFT' ELSE 'SENT' END,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PAYMENT_PENDING'").bind(row.id).run();await event(db,row.id,'PAYMENT_CANCELED');return {canceled:true};}
export async function capturePayment(context,token,providerOrderId){
 const mode=salesMode(context);if(!['live','sandbox'].includes(mode))throw saleError('Checkout is unavailable.',403);
 if(!/^[A-Z0-9]{8,32}$/i.test(clean(providerOrderId)))throw saleError('Payment reference is invalid.');
 const env=context.env,db=dbFor(env),row=await byToken(env,token);
 const attempt=await db.prepare('SELECT * FROM sales_payment_attempts WHERE invoice_id=? AND provider_order_id=?').bind(row.id,providerOrderId).first();if(!attempt)throw saleError('Payment does not match this invoice.',404);
 if(row.status==='PAID'&&attempt.status==='CAPTURED'&&row.paypal_order_id===providerOrderId)return {paid:true,invoice:publicInvoice(row)};
 if(row.status!=='PAYMENT_PENDING'||attempt.status!=='CREATED')throw saleError('Payment is already being processed or requires admin review. Do not pay twice.',409);
 const details=await paypalRequest(env,'/v2/checkout/orders/'+encodeURIComponent(providerOrderId));
 const unit=details.purchase_units?.[0];
 if(details.id!==providerOrderId||details.status!=='APPROVED'||!unit||details.purchase_units.length!==1||unit.custom_id!==row.invoice_number||unit.amount?.currency_code!=='USD'||unit.amount?.value!==(row.total_cents/100).toFixed(2))throw saleError('Provider payment verification failed. No payment captured.',409);
 if(attempt.method==='VENMO'&&!details.payment_source?.venmo)throw saleError('The provider did not verify Venmo as the funding source.',409);
 if(attempt.method==='PAYPAL'&&!details.payment_source?.paypal)throw saleError('The provider did not verify PayPal as the funding source.',409);
 const claim=await db.prepare("UPDATE sales_payment_attempts SET status='CAPTURING',updated_at=CURRENT_TIMESTAMP WHERE attempt_id=? AND status='CREATED'").bind(attempt.attempt_id).run();if(claim.meta?.changes!==1)throw saleError('Another capture is processing.',409);
 const orderLock=await db.prepare("UPDATE sales_invoices SET status='CAPTURING',updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='PAYMENT_PENDING' AND paypal_capture_id IS NULL").bind(row.id).run();if(orderLock.meta?.changes!==1)throw saleError('Invoice capture lock changed. Contact WestTech; do not pay again.',409);
 let result;try{result=await paypalRequest(env,'/v2/checkout/orders/'+encodeURIComponent(providerOrderId)+'/capture',{method:'POST',payload:{},requestId:'WT-SALE-'+attempt.attempt_id+'-CAPTURE'});}catch{throw saleError('Provider capture outcome needs admin review. Do not pay again.',502);}
 const cap=result.purchase_units?.[0]?.payments?.captures?.[0];
 if(result.status!=='COMPLETED'||!cap?.id||cap.status!=='COMPLETED'||cap.amount?.currency_code!=='USD'||cap.amount?.value!==(row.total_cents/100).toFixed(2))throw saleError('Provider capture requires reconciliation. Do not pay again.',502);
 const updated=await db.prepare("UPDATE sales_invoices SET status='PAID',payment_method=?,paypal_order_id=?,paypal_capture_id=?,paid_at=CURRENT_TIMESTAMP,updated_at=CURRENT_TIMESTAMP WHERE id=? AND status='CAPTURING' AND paypal_capture_id IS NULL").bind(attempt.method,providerOrderId,cap.id,row.id).run();
 if(updated.meta?.changes!==1)throw saleError('Captured payment needs invoice reconciliation. Do not pay again.',502);
 await db.prepare("UPDATE sales_payment_attempts SET status='CAPTURED',updated_at=CURRENT_TIMESTAMP WHERE attempt_id=? AND status='CAPTURING'").bind(attempt.attempt_id).run();await event(db,row.id,'PAID',{method:attempt.method,providerOrderId,captureId:cap.id});return {paid:true,invoice:publicInvoice(await byToken(env,token))};
}
