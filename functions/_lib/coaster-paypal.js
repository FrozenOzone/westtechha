import { generateAccessToken, paypalBaseUrl } from './paypal.js';
import { getCoasterOrderDetail, getCoasterApprovalByToken } from './coaster-orders.js';
import { requireOrdersDb } from './orders.js';
import { readJsonSafe, sanitizeEnvValue } from './shared.js';
import { sendCoasterCustomerEmail } from './coaster-email.js';
import { buildTaxQuote } from './tax.js';

const PICKUP_ADDRESS={
  fullName:'WestTech Home Automation, LLC',
  address1:'11300 Emporia St',
  address2:'',
  city:'Henderson',
  state:'CO',
  postalCode:'80640',
  countryCode:'US'
};

function money(value){const n=Number(value??0);return Number.isFinite(n)&&n>=0?Math.round(n*100)/100:0;}
function usd(value){return money(value).toFixed(2);}
function clean(value,max=500){return String(value??'').trim().slice(0,max);}
function approvalUrl(data){return clean(data?.links?.find?.(l=>['payer-action','approve'].includes(String(l?.rel||'').toLowerCase()))?.href||'',2000);}
function captureId(data){return clean(data?.purchase_units?.[0]?.payments?.captures?.[0]?.id||'',120);}
function extractShipping(data){
  const shipping=data?.purchase_units?.[0]?.shipping||{};const payer=data?.payer?.name||{};
  return {name:shipping?.name?.full_name||[payer.given_name,payer.surname].filter(Boolean).join(' '),address1:shipping?.address?.address_line_1||'',address2:shipping?.address?.address_line_2||'',city:shipping?.address?.admin_area_2||'',region:shipping?.address?.admin_area_1||'',postalCode:shipping?.address?.postal_code||'',country:shipping?.address?.country_code||''};
}
function requireUsShipping(a){
  if(String(a?.country||'').toUpperCase()!=='US')throw Object.assign(new Error('Website checkout currently supports U.S. shipping addresses only.'),{status:400});
  if(!clean(a?.address1)||!clean(a?.city)||!clean(a?.region)||!clean(a?.postalCode))throw Object.assign(new Error('PayPal did not provide a complete shipping address.'),{status:400});
}
async function paypalCall(env,path,{method='GET',body,accessToken,requestId}={}){
  const token=accessToken||await generateAccessToken(env);const headers={Authorization:`Bearer ${token}`,Accept:'application/json'};
  if(body!==undefined)headers['Content-Type']='application/json';if(requestId)headers['PayPal-Request-Id']=requestId;
  const response=await fetch(`${paypalBaseUrl(env.PAYPAL_ENV)}${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});const data=await readJsonSafe(response);
  if(!response.ok){const e=new Error(data?.details?.[0]?.description||data?.message||data?.error_description||data?.raw||`PayPal request failed (${response.status}).`);e.status=response.status||500;e.paypal=data;throw e;}
  return {data,accessToken:token};
}
function requestId(orderId,proofVersion,action){return `${String(orderId).replace(/[^A-Za-z0-9_-]/g,'-')}-P${Number(proofVersion||0)}-${action}`.slice(0,100);}
function coasterAmounts(order){
  const approvedTotal=money(order.finalAmount),configuredShipping=money(order.shippingAmount);
  const shippingAmount=configuredShipping<=approvedTotal?configuredShipping:0;
  const taxableAmount=money(approvedTotal-shippingAmount);
  return {approvedTotal,taxableAmount:taxableAmount>0?taxableAmount:approvedTotal,shippingAmount:taxableAmount>0?shippingAmount:0};
}
function paypalItem(order,currency,unitAmount){
  const setCount=Math.max(1,Number(order.setCount||1)),setSize=Math.max(1,Number(order.setSize||4));
  return {name:`WestTech Custom Coaster Order — ${setCount} × ${setSize}-Coaster Set`,description:`Approved proof v${Math.max(1,Number(order.proofVersion||1))} • Order ${order.orderId}`,quantity:'1',unit_amount:{currency_code:currency,value:usd(unitAmount)},category:'PHYSICAL_GOODS'};
}
function amountBreakdown(currency,taxableAmount,shippingAmount,taxAmount=0){
  return {currency_code:currency,value:usd(money(taxableAmount)+money(shippingAmount)+money(taxAmount)),breakdown:{item_total:{currency_code:currency,value:usd(taxableAmount)},shipping:{currency_code:currency,value:usd(shippingAmount)},tax_total:{currency_code:currency,value:usd(taxAmount)}}};
}
function buildPayload(order,currency,{returnUrl,cancelUrl}){
  const setCount=Math.max(1,Number(order.setCount||1)),setSize=Math.max(1,Number(order.setSize||4));
  const shippingPreference=order.fulfillmentMethod==='SHIP'?'GET_FROM_FILE':'NO_SHIPPING';
  const amounts=coasterAmounts(order);
  return {
    intent:'CAPTURE',
    purchase_units:[{
      reference_id:'CUSTOM_COASTER',custom_id:order.orderId,invoice_id:`${order.orderId}-P${Math.max(1,Number(order.proofVersion||1))}`,
      description:`WestTech custom coaster order • ${setCount} × ${setSize}-Coaster Set • ${Number(order.totalCoasters||setCount*setSize)} coasters`,
      amount:amountBreakdown(currency,amounts.taxableAmount,amounts.shippingAmount),
      items:[paypalItem(order,currency,amounts.taxableAmount)]
    }],
    payment_source:{paypal:{experience_context:{shipping_preference:shippingPreference,user_action:'PAY_NOW',return_url:returnUrl,cancel_url:cancelUrl}}}
  };
}
function taxAddressFor(order,details){
  if(order.fulfillmentMethod==='LOCAL_PICKUP')return {...PICKUP_ADDRESS};
  const ship=extractShipping(details);requireUsShipping(ship);
  return {fullName:ship.name,address1:ship.address1,address2:ship.address2,city:ship.city,state:ship.region,postalCode:ship.postalCode,countryCode:ship.country};
}
function addressJson(address){return JSON.stringify({fullName:clean(address?.fullName,200),address1:clean(address?.address1,200),address2:clean(address?.address2,200),city:clean(address?.city,120),state:clean(address?.state,20).toUpperCase(),postalCode:clean(address?.postalCode,30),countryCode:clean(address?.countryCode,10).toUpperCase()});}
function taxConfirmationMatches(order,quote){
  if(!quote?.isColorado||!order?.taxConfirmedAt)return false;
  return order.taxAddressJson===addressJson(quote.address)&&Math.abs(money(order.taxAmount)-money(quote.taxAmount))<0.001&&Math.abs(money(order.paymentTotal)-money(quote.totalAmount))<0.001;
}
async function persistTaxQuote(env,order,quote,addressSource,confirmTax){
  const db=requireOrdersDb(env),now=new Date().toISOString(),address=addressJson(quote.address),quoteJson=JSON.stringify(quote);
  const wasConfirmed=taxConfirmationMatches(order,quote);
  const unchanged=order.taxAddressJson===address&&Math.abs(money(order.taxAmount)-money(quote.taxAmount))<0.001&&Math.abs(money(order.paymentTotal)-money(quote.totalAmount))<0.001;
  await db.prepare(`UPDATE coaster_orders SET taxable_amount=?,tax_amount=?,tax_rate=?,tax_jurisdiction_code=?,tax_source=?,tax_address_source=?,tax_address_json=?,tax_quote_json=?,payment_total=?,tax_prepared_at=?,tax_confirmed_at=CASE WHEN ?=1 THEN ? WHEN tax_address_json=? AND ABS(COALESCE(tax_amount,0)-?)<0.001 AND ABS(COALESCE(payment_total,0)-?)<0.001 THEN tax_confirmed_at ELSE NULL END,payment_status=CASE WHEN ?=1 AND ?=0 THEN 'AWAITING_TAX_CONFIRMATION' ELSE payment_status END,updated_at=CURRENT_TIMESTAMP WHERE order_id=?`).bind(Number(quote.taxableAmount),Number(quote.taxAmount),Number(quote.taxRate),clean(quote.jurisdictionCode,200)||null,clean(quote.source,80)||null,addressSource,address,quoteJson,Number(quote.totalAmount),now,confirmTax?1:0,now,address,Number(quote.taxAmount),Number(quote.totalAmount),quote.isColorado?1:0,confirmTax||wasConfirmed?1:0,order.orderId).run();
  if(!unchanged)await db.prepare(`INSERT INTO coaster_order_events (order_id,event_type,detail) VALUES (?,'TAX_PREPARED',?)`).bind(order.orderId,JSON.stringify({source:quote.source,addressSource,isColorado:quote.isColorado,taxRate:quote.taxRate,taxAmount:Number(quote.taxAmount),paymentTotal:Number(quote.totalAmount),jurisdictionCode:quote.jurisdictionCode||null})).run();
  if(quote.isColorado&&confirmTax&&!wasConfirmed)await db.prepare(`INSERT INTO coaster_order_events (order_id,event_type,detail) VALUES (?,'COLORADO_TAX_CONFIRMED',?)`).bind(order.orderId,JSON.stringify({addressSource,taxAmount:Number(quote.taxAmount),paymentTotal:Number(quote.totalAmount),jurisdictionCode:quote.jurisdictionCode||null})).run();
  return getCoasterOrderDetail(env,order.orderId);
}
function taxPatch(order,quote,currency){
  return [
    {op:'replace',path:"/purchase_units/@reference_id=='CUSTOM_COASTER'/amount",value:amountBreakdown(currency,Number(quote.taxableAmount),Number(quote.shippingAmount),Number(quote.taxAmount))},
    {op:'replace',path:"/purchase_units/@reference_id=='CUSTOM_COASTER'/items",value:[paypalItem(order,currency,Number(quote.taxableAmount))]}
  ];
}
async function preparePayPalTax(env,order,details,accessToken,{confirmTax=false}={}){
  const address=taxAddressFor(order,details),amounts=coasterAmounts(order);
  const quote=await buildTaxQuote(env,address,{taxableAmount:amounts.taxableAmount,shippingAmount:amounts.shippingAmount});
  const currency=sanitizeEnvValue(env.PAYPAL_CURRENCY)||'USD';
  await paypalCall(env,`/v2/checkout/orders/${encodeURIComponent(order.paypalOrderId)}`,{method:'PATCH',body:taxPatch(order,quote,currency),accessToken});
  const confirmationAccepted=!quote.isColorado||confirmTax||taxConfirmationMatches(order,quote);
  const updated=await persistTaxQuote(env,order,quote,order.fulfillmentMethod==='LOCAL_PICKUP'?'WESTTECH_PICKUP':'PAYPAL',quote.isColorado&&confirmationAccepted);
  return {order:updated,quote,address:quote.address,addressSource:order.fulfillmentMethod==='LOCAL_PICKUP'?'WESTTECH_PICKUP':'PAYPAL',confirmationAccepted};
}
function taxReview(prepared){
  return {address:prepared.address,addressSource:prepared.addressSource,fulfillmentMethod:prepared.order.fulfillmentMethod,taxRate:Number(prepared.quote.taxRate),taxableAmount:Number(prepared.quote.taxableAmount),shippingAmount:Number(prepared.quote.shippingAmount),taxAmount:Number(prepared.quote.taxAmount),totalAmount:Number(prepared.quote.totalAmount),jurisdictionCode:prepared.quote.jurisdictionCode||''};
}

export async function recordCoasterPayPalFailure(env,orderId,error){
  const db=requireOrdersDb(env);const msg=clean(error?.message||'PayPal checkout setup failed.',1000);
  await db.prepare(`UPDATE coaster_orders SET payment_status='PAYPAL_ERROR', paypal_last_error=?, updated_at=CURRENT_TIMESTAMP WHERE order_id=?`).bind(msg,orderId).run();
  await db.prepare(`INSERT INTO coaster_order_events (order_id,event_type,detail) VALUES (?,'PAYPAL_ERROR',?)`).bind(orderId,JSON.stringify({message:msg})).run();
  return getCoasterOrderDetail(env,orderId);
}

export async function ensureCoasterPayPalOrder(env,orderId,{returnUrl,cancelUrl}={}){
  const db=requireOrdersDb(env);let order=await getCoasterOrderDetail(env,orderId);if(!order)return null;
  if(String(order.paymentStatus||'').toUpperCase()==='PAID')return order;
  if(order.paymentRequired===false){
    if(String(order.paymentStatus||'').toUpperCase()==='NOT_REQUIRED')return order;
    await db.prepare(`UPDATE coaster_orders SET payment_status='NOT_REQUIRED',status='PRODUCTION_QUEUE',paypal_last_error=NULL,payment_total=0,updated_at=CURRENT_TIMESTAMP WHERE order_id=?`).bind(orderId).run();
    await db.prepare(`INSERT INTO coaster_order_events (order_id,event_type,detail) VALUES (?,'PAYMENT_NOT_REQUIRED',?)`).bind(orderId,JSON.stringify({finalAmount:money(order.finalAmount)})).run();
    await db.prepare(`INSERT INTO coaster_order_events (order_id,event_type,detail) VALUES (?,'PRODUCTION_QUEUED',?)`).bind(orderId,JSON.stringify({reason:'NO_PAYMENT_REQUIRED'})).run();
    const queued=await getCoasterOrderDetail(env,orderId);
    if(queued)await sendCoasterCustomerEmail(env,{type:'PRODUCTION_QUEUED',order:queued});
    return await getCoasterOrderDetail(env,orderId)||queued;
  }
  if(String(order.proofStatus)!=='APPROVED')throw Object.assign(new Error('Customer proof approval is required before PayPal checkout can be created.'),{status:409});
  if(money(order.finalAmount)<=0)throw Object.assign(new Error('The approved customer subtotal must be greater than $0 before PayPal checkout can be created.'),{status:400});
  if(!returnUrl||!cancelUrl)throw Object.assign(new Error('PayPal return/cancel URLs are required.'),{status:500});

  if(order.paypalOrderId){
    const got=await paypalCall(env,`/v2/checkout/orders/${encodeURIComponent(order.paypalOrderId)}`);const url=approvalUrl(got.data);
    await db.prepare(`UPDATE coaster_orders SET paypal_order_status=?, paypal_approval_url=CASE WHEN ?<>'' THEN ? ELSE paypal_approval_url END, payment_status=CASE WHEN payment_status='PAID' THEN payment_status ELSE 'AWAITING_PAYMENT' END, status=CASE WHEN payment_status='PAID' THEN status ELSE 'AWAITING_PAYMENT' END, updated_at=CURRENT_TIMESTAMP WHERE order_id=?`).bind(String(got.data?.status||''),url,url,orderId).run();
    return getCoasterOrderDetail(env,orderId);
  }

  const currency=sanitizeEnvValue(env.PAYPAL_CURRENCY)||'USD';const token=await generateAccessToken(env);const payload=buildPayload(order,currency,{returnUrl,cancelUrl});
  await db.prepare(`UPDATE coaster_orders SET payment_status='CREATING_PAYPAL_ORDER',paypal_last_error=NULL,taxable_amount=0,tax_amount=0,tax_rate=0,tax_jurisdiction_code=NULL,tax_source=NULL,tax_address_source=NULL,tax_address_json=NULL,tax_quote_json=NULL,payment_total=0,tax_prepared_at=NULL,tax_confirmed_at=NULL,updated_at=CURRENT_TIMESTAMP WHERE order_id=?`).bind(orderId).run();
  const created=await paypalCall(env,'/v2/checkout/orders',{method:'POST',body:payload,accessToken:token,requestId:requestId(order.orderId,order.proofVersion,'create-order')});
  if(!created.data?.id)throw new Error('PayPal created the checkout but did not return an order ID.');
  const url=approvalUrl(created.data);
  await db.prepare(`UPDATE coaster_orders SET paypal_order_id=?,paypal_order_status=?,paypal_approval_url=?,payment_status='AWAITING_PAYMENT',status='AWAITING_PAYMENT',updated_at=CURRENT_TIMESTAMP WHERE order_id=?`).bind(created.data.id,String(created.data.status||'CREATED'),url||null,orderId).run();
  await db.prepare(`INSERT INTO coaster_order_events (order_id,event_type,detail) VALUES (?,'PAYPAL_ORDER_CREATED',?)`).bind(orderId,JSON.stringify({paypalOrderId:created.data.id,approvedSubtotal:money(order.finalAmount),shippingPreference:order.fulfillmentMethod==='SHIP'?'GET_FROM_FILE':'NO_SHIPPING',taxTiming:'AFTER_PAYPAL_ADDRESS'})).run();
  return getCoasterOrderDetail(env,orderId);
}

async function markCaptured(env,orderId,paypalOrderId,details,captured){
  const db=requireOrdersDb(env);const order=await getCoasterOrderDetail(env,orderId);if(!order)return null;
  if(String(order.paymentStatus||'').toUpperCase()==='PAID'){order._paymentCapturedNow=false;return order;}
  const ship=order.fulfillmentMethod==='SHIP'?extractShipping(captured||details):null;if(order.fulfillmentMethod==='SHIP')requireUsShipping(ship);
  const cap=captureId(captured)||captureId(details);const paidAt=new Date().toISOString();
  const write=await db.prepare(`UPDATE coaster_orders SET paypal_order_status='COMPLETED',paypal_capture_id=?,paypal_payment_id=?,payment_status='PAID',paypal_paid_at=COALESCE(paypal_paid_at,?),paypal_last_error=NULL,status='PRODUCTION_QUEUE',shipping_name=?,shipping_address1=?,shipping_address2=?,shipping_city=?,shipping_region=?,shipping_postal_code=?,shipping_country=?,payment_total=CASE WHEN payment_total>0 THEN payment_total ELSE final_amount END,updated_at=CURRENT_TIMESTAMP WHERE order_id=? AND COALESCE(payment_status,'')<>'PAID'`).bind(cap||null,cap||null,paidAt,ship?.name||null,ship?.address1||null,ship?.address2||null,ship?.city||null,ship?.region||null,ship?.postalCode||null,ship?.country||null,orderId).run();
  if(!Number(write?.meta?.changes||0)){const current=await getCoasterOrderDetail(env,orderId);if(current)current._paymentCapturedNow=false;return current;}
  const paid=await getCoasterOrderDetail(env,orderId);
  await db.prepare(`INSERT INTO coaster_order_events (order_id,event_type,detail) VALUES (?,'PAYPAL_ORDER_CAPTURED',?)`).bind(orderId,JSON.stringify({paypalOrderId,captureId:cap||null,paymentStatus:'PAID',approvedSubtotal:money(paid?.finalAmount),taxAmount:money(paid?.taxAmount),paymentTotal:money(paid?.paymentTotal),addressSource:ship?'PAYPAL':'WESTTECH_PICKUP'})).run();
  await db.prepare(`INSERT INTO coaster_order_events (order_id,event_type,detail) VALUES (?,'PRODUCTION_QUEUED',?)`).bind(orderId,JSON.stringify({reason:'PAYMENT_RECEIVED',paypalOrderId,captureId:cap||null})).run();
  const queued=await getCoasterOrderDetail(env,orderId);
  if(queued)await sendCoasterCustomerEmail(env,{type:'PRODUCTION_QUEUED',order:queued});
  if(queued)queued._paymentCapturedNow=true;
  return queued;
}

export async function captureCoasterPayPalOrder(env,orderId,approvalToken,paypalOrderId,{confirmTax=false}={}){
  const approval=await getCoasterApprovalByToken(env,orderId,approvalToken);if(!approval)throw Object.assign(new Error('This approval link is invalid.'),{status:404});
  const order=await getCoasterOrderDetail(env,orderId);if(!order)throw Object.assign(new Error('Coaster order not found.'),{status:404});
  if(!order.paypalOrderId||order.paypalOrderId!==paypalOrderId)throw Object.assign(new Error('This PayPal checkout does not match the approved coaster order.'),{status:409});
  if(String(order.paymentStatus||'').toUpperCase()==='PAID')return {order,capturedNow:false,taxConfirmationRequired:false};
  let accessToken=await generateAccessToken(env);const detailResult=await paypalCall(env,`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`,{accessToken});accessToken=detailResult.accessToken;
  const status=String(detailResult.data?.status||'').toUpperCase();
  if(!['APPROVED','COMPLETED'].includes(status))throw Object.assign(new Error(`PayPal checkout is not ready to capture (status: ${status||'UNKNOWN'}).`),{status:409});
  if(status==='COMPLETED'){const paid=await markCaptured(env,orderId,paypalOrderId,detailResult.data,detailResult.data);return {order:paid,capturedNow:!!paid?._paymentCapturedNow,taxConfirmationRequired:false};}
  const prepared=await preparePayPalTax(env,order,detailResult.data,accessToken,{confirmTax});
  if(prepared.quote.isColorado&&!prepared.confirmationAccepted)return {order:prepared.order,capturedNow:false,taxConfirmationRequired:true,taxReview:taxReview(prepared)};
  const captured=await paypalCall(env,`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`,{method:'POST',body:{},accessToken,requestId:requestId(order.orderId,order.proofVersion,'capture')});
  const paid=await markCaptured(env,orderId,paypalOrderId,detailResult.data,captured.data);
  return {order:paid,capturedNow:!!paid?._paymentCapturedNow,taxConfirmationRequired:false};
}

export async function syncCoasterPayPalOrder(env,orderId){
  const db=requireOrdersDb(env);const order=await getCoasterOrderDetail(env,orderId);if(!order)return null;
  if(String(order.paymentStatus||'').toUpperCase()==='PAID')return order;
  if(!order.paypalOrderId)throw Object.assign(new Error('No PayPal checkout exists for this order yet.'),{status:404});
  let accessToken=await generateAccessToken(env);const got=await paypalCall(env,`/v2/checkout/orders/${encodeURIComponent(order.paypalOrderId)}`,{accessToken});accessToken=got.accessToken;
  const status=String(got.data?.status||'').toUpperCase();const url=approvalUrl(got.data);
  await db.prepare(`UPDATE coaster_orders SET paypal_order_status=?,paypal_approval_url=CASE WHEN ?<>'' THEN ? ELSE paypal_approval_url END,updated_at=CURRENT_TIMESTAMP WHERE order_id=?`).bind(status,url,url,orderId).run();
  if(status==='COMPLETED')return markCaptured(env,orderId,order.paypalOrderId,got.data,got.data);
  if(status==='APPROVED'){
    const prepared=await preparePayPalTax(env,order,got.data,accessToken);
    if(prepared.quote.isColorado&&!prepared.confirmationAccepted)throw Object.assign(new Error('The customer must confirm the Colorado tax total on the approval page before this payment can be captured.'),{status:409});
    const captured=await paypalCall(env,`/v2/checkout/orders/${encodeURIComponent(order.paypalOrderId)}/capture`,{method:'POST',body:{},accessToken,requestId:requestId(order.orderId,order.proofVersion,'capture')});
    return markCaptured(env,orderId,order.paypalOrderId,got.data,captured.data);
  }
  await db.prepare(`INSERT INTO coaster_order_events (order_id,event_type,detail) VALUES (?,'PAYPAL_STATUS_SYNCED',?)`).bind(orderId,JSON.stringify({paypalOrderId:order.paypalOrderId,paypalStatus:status})).run();
  return getCoasterOrderDetail(env,orderId);
}
