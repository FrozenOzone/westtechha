import {jsonResponse} from '../../../_lib/shared.js';
import {invoiceForBuyer,beginPayment,cancelPayment,capturePayment} from '../../../_lib/sales-payment.js';
const reply=(data,status=200)=>jsonResponse(data,status,{'Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});
export async function onRequestPost(ctx){try{const origin=ctx.request.headers.get('Origin');if(origin&&origin!==new URL(ctx.request.url).origin)return reply({ok:false,message:'Invalid origin.'},403);if(!/^application\/json(?:;|$)/i.test(ctx.request.headers.get('Content-Type')||''))return reply({ok:false,message:'JSON required.'},415);const body=await ctx.request.json(),token=String(body.token||''),action=String(body.action||'');
 if(action==='get')return reply({ok:true,...await invoiceForBuyer(ctx,token)});
 if(action==='start')return reply({ok:true,...await beginPayment(ctx,token,String(body.method||'').toUpperCase())});
 if(action==='cancel')return reply({ok:true,...await cancelPayment(ctx,token,String(body.orderId||''))});
 if(action==='capture')return reply({ok:true,...await capturePayment(ctx,token,String(body.orderId||''))});
 return reply({ok:false,message:'Unsupported action.'},400);
 }catch(e){return reply({ok:false,message:e.message||'Payment request failed.'},e.status||500);}}
