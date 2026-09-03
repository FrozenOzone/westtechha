import { generateAccessToken, paypalBaseUrl } from './paypal.js';
import { getCoasterOrderDetail, getCoasterApprovalByToken } from './coaster-orders.js';
import { requireOrdersDb } from './orders.js';
import { readJsonSafe, sanitizeEnvValue } from './shared.js';
import { sendCoasterCustomerEmail } from './coaster-email.js';

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
function buildPayload(order,currency,{returnUrl,cancelUrl}){
  const setCount=Math.max(1,Number(order.setCount||1)),setSize=Math.max(1,Number(order.setSize||4));
  const shippingPreference=order.fulfillmentMethod==='SHIP'?'GET_FROM_FILE':'NO_SHIPPING';
  return {
    intent:'CAPTURE',
    purchase_units:[{
      reference_id:'CUSTOM_COASTER',custom_id:order.orderId,invoice_id:`${order.orderId}-P${Math.max(1,Number(order.proofVersion||1))}`,
      description:`WestTech custom coaster order • ${setCount} × ${setSize}-Coaster Set • ${Number(order.totalCoasters||setCount*setSize)} coasters`,
      amount:{currency_code:currency,value:usd(order.finalAmount),breakdown:{item_total:{currency_code:currency,value:usd(order.finalAmount)}}},
      items:[{name:`WestTech Custom Coaster Order — ${setCount} × ${setSize}-Coaster Set`,description:`Approved proof v${Math.max(1,Number(order.proofVersion||1))} • Order ${order.orderId}`,quantity:'1',unit_amount:{currency_code:currency,value:usd(order.finalAmount)},category:'PHYSICAL_GOODS'}]
    }],
    payment_source:{paypal:{experience_context:{shipping_preference:shippingPreference,user_action:'PAY_NOW',return_url:returnUrl,cancel_url:cancelUrl}}}
  };
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
    await db.prepare(`UPDATE coaster_orders SET payment_status='NOT_REQUIRED',status='PRODUCTION_QUEUE',paypal_last_error=NULL,updated_at=CURRENT_TIMESTAMP WHERE order_id=?`).bind(orderId).run();
    await db.prepare(`INSERT INTO coaster_order_events (order_id,event_type,detail) VALUES (?,'PAYMENT_NOT_REQUIRED',?)`).bind(orderId,JSON.stringify({finalAmount:money(order.finalAmount)})).run();
    await db.prepare(`INSERT INTO coaster_order_events (order_id,event_type,detail) VALUES (?,'PRODUCTION_QUEUED',?)`).bind(orderId,JSON.stringify({reason:'NO_PAYMENT_REQUIRED'})).run();
    const queued=await getCoasterOrderDetail(env,orderId);
    if(queued)await sendCoasterCustomerEmail(env,{type:'PRODUCTION_QUEUED',order:queued});
    return await getCoasterOrderDetail(env,orderId)||queued;
  }
  if(String(order.proofStatus)!=='APPROVED')throw Object.assign(new Error('Customer proof approval is required before PayPal checkout can be created.'),{status:409});
  if(money(order.finalAmount)<=0)throw Object.assign(new Error('The approved customer total must be greater than $0 before PayPal checkout can be created.'),{status:400});
  if(!returnUrl||!cancelUrl)throw Object.assign(new Error('PayPal return/cancel URLs are required.'),{status:500});

  if(order.paypalOrderId){
    const got=await paypalCall(env,`/v2/checkout/orders/${encodeURIComponent(order.paypalOrderId)}`);const url=approvalUrl(got.data);
    await db.prepare(`UPDATE coaster_orders SET paypal_order_status=?, paypal_approval_url=CASE WHEN ?<>'' THEN ? ELSE paypal_approval_url END, payment_status=CASE WHEN payment_status='PAID' THEN payment_status ELSE 'AWAITING_PAYMENT' END, status=CASE WHEN payment_status='PAID' THEN status ELSE 'AWAITING_PAYMENT' END, updated_at=CURRENT_TIMESTAMP WHERE order_id=?`).bind(String(got.data?.status||''),url,url,orderId).run();
    return getCoasterOrderDetail(env,orderId);
  }

  const currency=sanitizeEnvValue(env.PAYPAL_CURRENCY)||'USD';const token=await generateAccessToken(env);const payload=buildPayload(order,currency,{returnUrl,cancelUrl});
  await db.prepare(`UPDATE coaster_orders SET payment_status='CREATING_PAYPAL_ORDER',paypal_last_error=NULL,updated_at=CURRENT_TIMESTAMP WHERE order_id=?`).bind(orderId).run();
  const created=await paypalCall(env,'/v2/checkout/orders',{method:'POST',body:payload,accessToken:token,requestId:requestId(order.orderId,order.proofVersion,'create-order')});
  if(!created.data?.id)throw new Error('PayPal created the checkout but did not return an order ID.');
  const url=approvalUrl(created.data);
  await db.prepare(`UPDATE coaster_orders SET paypal_order_id=?,paypal_order_status=?,paypal_approval_url=?,payment_status='AWAITING_PAYMENT',status='AWAITING_PAYMENT',updated_at=CURRENT_TIMESTAMP WHERE order_id=?`).bind(created.data.id,String(created.data.status||'CREATED'),url||null,orderId).run();
  await db.prepare(`INSERT INTO coaster_order_events (order_id,event_type,detail) VALUES (?,'PAYPAL_ORDER_CREATED',?)`).bind(orderId,JSON.stringify({paypalOrderId:created.data.id,amount:money(order.finalAmount),shippingPreference:order.fulfillmentMethod==='SHIP'?'GET_FROM_FILE':'NO_SHIPPING'})).run();
  return getCoasterOrderDetail(env,orderId);
}

async function markCaptured(env,orderId,paypalOrderId,details,captured){
  const db=requireOrdersDb(env);const order=await getCoasterOrderDetail(env,orderId);if(!order)return null;
  if(String(order.paymentStatus||'').toUpperCase()==='PAID')return order;
  const ship=order.fulfillmentMethod==='SHIP'?extractShipping(captured||details):null;if(order.fulfillmentMethod==='SHIP')requireUsShipping(ship);
  const cap=captureId(captured)||captureId(details);const paidAt=new Date().toISOString();
  const write=await db.prepare(`UPDATE coaster_orders SET paypal_order_status='COMPLETED',paypal_capture_id=?,paypal_payment_id=?,payment_status='PAID',paypal_paid_at=COALESCE(paypal_paid_at,?),paypal_last_error=NULL,status='PRODUCTION_QUEUE',shipping_name=?,shipping_address1=?,shipping_address2=?,shipping_city=?,shipping_region=?,shipping_postal_code=?,shipping_country=?,updated_at=CURRENT_TIMESTAMP WHERE order_id=? AND COALESCE(payment_status,'')<>'PAID'`).bind(cap||null,cap||null,paidAt,ship?.name||null,ship?.address1||null,ship?.address2||null,ship?.city||null,ship?.region||null,ship?.postalCode||null,ship?.country||null,orderId).run();
  if(!Number(write?.meta?.changes||0))return getCoasterOrderDetail(env,orderId);
  await db.prepare(`INSERT INTO coaster_order_events (order_id,event_type,detail) VALUES (?,'PAYPAL_ORDER_CAPTURED',?)`).bind(orderId,JSON.stringify({paypalOrderId,captureId:cap||null,paymentStatus:'PAID',addressSource:ship?'PAYPAL':'NONE'})).run();
  await db.prepare(`INSERT INTO coaster_order_events (order_id,event_type,detail) VALUES (?,'PRODUCTION_QUEUED',?)`).bind(orderId,JSON.stringify({reason:'PAYMENT_RECEIVED',paypalOrderId,captureId:cap||null})).run();
  const queued=await getCoasterOrderDetail(env,orderId);
  if(queued)await sendCoasterCustomerEmail(env,{type:'PRODUCTION_QUEUED',order:queued});
  return await getCoasterOrderDetail(env,orderId)||queued;
}

export async function captureCoasterPayPalOrder(env,orderId,approvalToken,paypalOrderId){
  const approval=await getCoasterApprovalByToken(env,orderId,approvalToken);if(!approval)throw Object.assign(new Error('This approval link is invalid.'),{status:404});
  const order=await getCoasterOrderDetail(env,orderId);if(!order)throw Object.assign(new Error('Coaster order not found.'),{status:404});
  if(!order.paypalOrderId||order.paypalOrderId!==paypalOrderId)throw Object.assign(new Error('This PayPal checkout does not match the approved coaster order.'),{status:409});
  if(String(order.paymentStatus).toUpperCase()==='PAID')return order;
  let accessToken=await generateAccessToken(env);const detailResult=await paypalCall(env,`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`,{accessToken});accessToken=detailResult.accessToken;
  if(order.fulfillmentMethod==='SHIP')requireUsShipping(extractShipping(detailResult.data));
  const captured=await paypalCall(env,`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`,{method:'POST',accessToken,requestId:requestId(order.orderId,order.proofVersion,'capture')});
  return markCaptured(env,orderId,paypalOrderId,detailResult.data,captured.data);
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
    if(order.fulfillmentMethod==='SHIP')requireUsShipping(extractShipping(got.data));
    const captured=await paypalCall(env,`/v2/checkout/orders/${encodeURIComponent(order.paypalOrderId)}/capture`,{method:'POST',accessToken,requestId:requestId(order.orderId,order.proofVersion,'capture')});
    return markCaptured(env,orderId,order.paypalOrderId,got.data,captured.data);
  }
  await db.prepare(`INSERT INTO coaster_order_events (order_id,event_type,detail) VALUES (?,'PAYPAL_STATUS_SYNCED',?)`).bind(orderId,JSON.stringify({paypalOrderId:order.paypalOrderId,paypalStatus:status})).run();
  return getCoasterOrderDetail(env,orderId);
}
