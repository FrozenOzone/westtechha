import { jsonResponse, readJsonSafe } from '../../../../../../_lib/shared.js';
import { requireWestTechAdmin } from '../../../../../../_lib/admin-auth.js';
import { releaseEnclosureTerms } from '../../../../../../_lib/enclosure-orders.js';
import { sendEnclosureCustomerEmail } from '../../../../../../_lib/enclosure-email.js';

function root(request){const url=new URL(request.url);return `${url.protocol}//${url.host}`;}
export async function onRequestPost(context){
  try{
    requireWestTechAdmin(context);const body=await readJsonSafe(context.request),action=String(body?.action||'sendTerms');
    if(!['sendTerms','refreshLink'].includes(action))return jsonResponse({ok:false,message:'Unsupported approval-link action.'},400);
    const released=await releaseEnclosureTerms(context.env,context.params.orderId,{refreshOnly:action==='refreshLink'}),approvalUrl=`${root(context.request)}/enclosures/order-approval.html?order=${encodeURIComponent(released.order.orderId)}&approvalToken=${encodeURIComponent(released.approvalToken)}`;
    const email=await sendEnclosureCustomerEmail(context.env,{type:'CONFIGURATION_READY',order:released.order,approvalUrl,requestUrl:context.request.url});
    return jsonResponse({ok:true,order:released.order,approvalUrl,email});
  }catch(error){return jsonResponse({ok:false,message:error.message||'Could not send the enclosure configuration.'},error.status||500);}
}
