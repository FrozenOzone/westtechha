import { requireWestTechAdmin } from '../../../../_lib/admin-auth.js';
import { getCustomOrderDetail, releaseCustomOrder, updateCustomOrderAdmin } from '../../../../_lib/custom-orders.js';
import { sendCustomAdminProductionEmail, sendCustomCustomerEmail } from '../../../../_lib/custom-email.js';
import { syncCustomPayPalOrder } from '../../../../_lib/custom-paypal.js';
import { jsonResponse } from '../../../../_lib/shared.js';

function baseUrl(request){const url=new URL(request.url);return `${url.protocol}//${url.host}`;}
function approvalUrl(request,orderId,token){return `${baseUrl(request)}/custom-orders/order-approval.html?order=${encodeURIComponent(orderId)}&approvalToken=${encodeURIComponent(token)}`;}

export async function onRequestGet(context){try{requireWestTechAdmin(context);return jsonResponse({ok:true,order:await getCustomOrderDetail(context.env,context.params.orderId)});}catch(error){return jsonResponse({ok:false,message:error.message||'Could not load custom order.'},error.status||500);}}
export async function onRequestPost(context){try{requireWestTechAdmin(context);const body=await context.request.json(),action=String(body?.action||'');
  if(action==='sendOrder'||action==='refreshApprovalLink'){const released=await releaseCustomOrder(context.env,context.params.orderId,{refreshOnly:action==='refreshApprovalLink'}),url=approvalUrl(context.request,released.order.orderId,released.approvalToken),email=await sendCustomCustomerEmail(context.env,{type:'CUSTOM_ORDER_READY',order:released.order,approvalUrl:url,requestUrl:context.request.url});return jsonResponse({ok:true,order:released.order,approvalUrl:url,email});}
  if(action==='syncPayPal'){const order=await syncCustomPayPalOrder(context.env,context.params.orderId);if(order?._paymentCapturedNow)await sendCustomAdminProductionEmail(context.env,{order,requestUrl:context.request.url});return jsonResponse({ok:true,order});}
  const before=await getCustomOrderDetail(context.env,context.params.orderId),order=await updateCustomOrderAdmin(context.env,context.params.orderId,body);if(!['archive','restoreArchive','addWork'].includes(action)&&before.status!==order.status&&['IN_PRODUCTION','PREPARING_TO_SHIP','PREPARING_FOR_PICKUP','READY_FOR_PICKUP','SHIPPED','COMPLETED'].includes(order.status))await sendCustomCustomerEmail(context.env,{type:order.status,order,requestUrl:context.request.url});return jsonResponse({ok:true,order});
}catch(error){return jsonResponse({ok:false,message:error.message||'Could not update custom order.'},error.status||500);}}
