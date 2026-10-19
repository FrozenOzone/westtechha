import { quoteCustomerCoasterReorder, reorderCustomerOrder, requireCustomerSession } from '../../../../../_lib/customer-account.js';
import { jsonResponse } from '../../../../../_lib/shared.js';

const respond=(value,status=200)=>{const r=jsonResponse(value,status);r.headers.set('Cache-Control','private, no-store');return r;};
export async function onRequestGet(context){
  try{const account=await requireCustomerSession(context);
    if(String(context.params.sourceType||'').toUpperCase()!=='COASTER')return respond({ok:false,message:'This quote is only available for coaster reorders.'},400);
    return respond({ok:true,quote:await quoteCustomerCoasterReorder(context.env,account,context.params.orderId)});
  }catch(e){return respond({ok:false,message:e.message||'Unable to quote reorder.'},e.status||500);}
}
export async function onRequestPost(context){
  try{
    const origin=context.request.headers.get('Origin');if(origin&&origin!==new URL(context.request.url).origin)return respond({ok:false,message:'Invalid request origin.'},403);
    const account=await requireCustomerSession(context);
    const type=String(context.params.sourceType||'').toUpperCase();let options={};
    if(type==='COASTER'){
      if(!/^application\/json(?:;|$)/i.test(context.request.headers.get('Content-Type')||''))return respond({ok:false,message:'JSON request required.'},415);
      options=await context.request.json();
    }
    return respond({ok:true,...await reorderCustomerOrder(context.env,account,type,context.params.orderId,context.request.url,options)});
  }catch(e){return respond({ok:false,message:e.message||'Could not create the reorder request.'},e.status||500);}
}
