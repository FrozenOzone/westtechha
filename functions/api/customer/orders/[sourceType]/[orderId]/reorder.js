import { reorderCustomerOrder, requireCustomerSession } from '../../../../../_lib/customer-account.js';
import { jsonResponse } from '../../../../../_lib/shared.js';

export async function onRequestPost(context){try{const account=await requireCustomerSession(context),result=await reorderCustomerOrder(context.env,account,context.params.sourceType,context.params.orderId);return jsonResponse({ok:true,...result});}catch(error){return jsonResponse({ok:false,message:error.message||'Could not create the reorder request.'},error.status||500);}}
