import { requireWestTechAdmin } from '../../../../../_lib/admin.js';
import { syncCoasterPayPalOrder, recordCoasterPayPalFailure } from '../../../../../_lib/coaster-paypal.js';
import { jsonResponse } from '../../../../../_lib/shared.js';

function stripPrivate(order){if(!order)return order;delete order.artworkObjectKey;delete order.designSnapshotObjectKey;delete order.proofObjectKey;return order;}

export async function onRequestPost(context){
  const orderId=String(context.params?.orderId||'').trim();
  try{requireWestTechAdmin(context);const order=await syncCoasterPayPalOrder(context.env,orderId);if(!order)return jsonResponse({ok:false,message:'Coaster order not found.'},404);return jsonResponse({ok:true,order:stripPrivate(order)});}
  catch(error){if(orderId&&error?.status!==401&&error?.status!==404)await recordCoasterPayPalFailure(context.env,orderId,error).catch(()=>{});return jsonResponse({ok:false,message:error?.message||'Could not synchronize the PayPal checkout.'},error?.status||500);}
}
