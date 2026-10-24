import { jsonResponse } from '../../../../../../_lib/shared.js';
import { requireCoasterAdmin } from '../../../../../../_lib/coaster-admin.js';
import { getCoasterPickupSlots,addCoasterPickupSlot,withdrawCoasterPickupSlot } from '../../../../../../_lib/coaster-pickup-slots.js';
import { adminPickupExtra,createAdminPickupLink,decideAdminPickupRequest } from '../../../../../../_lib/coaster-pickup-customer.js';
async function state(env,id){return {...await getCoasterPickupSlots(env,id),...await adminPickupExtra(env,id)};}
const fail=(e,fallback)=>jsonResponse({ok:false,message:e.message||fallback},e.status||500);
export async function onRequestGet(context){try{requireCoasterAdmin(context);return jsonResponse({ok:true,pickup:await state(context.env,context.params.orderId)});}catch(e){return fail(e,'Could not load pickup times.');}}
export async function onRequestPost(context){
  try{
    requireCoasterAdmin(context);
    const b=await context.request.json(),id=context.params.orderId;
    if(b.action==='createLink'){
      const link=await createAdminPickupLink(context.env,id,new URL(context.request.url).origin);
      return jsonResponse({ok:true,pickup:await state(context.env,id),link});
    }
    if(b.action==='decide'){
      await decideAdminPickupRequest(context.env,id,b.requestId,b.decision,b.slotIds);
      return jsonResponse({ok:true,pickup:await state(context.env,id)});
    }
    await addCoasterPickupSlot(context.env,id,b);
    return jsonResponse({ok:true,pickup:await state(context.env,id)});
  }catch(e){return fail(e,'Could not update pickup scheduling.');}
}
export async function onRequestDelete(context){try{requireCoasterAdmin(context);await withdrawCoasterPickupSlot(context.env,context.params.orderId,await context.request.json());return jsonResponse({ok:true,pickup:await state(context.env,context.params.orderId)});}catch(e){return fail(e,'Could not withdraw pickup time.');}}
