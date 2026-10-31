(()=>{'use strict';
 const $=s=>document.querySelector(s),token=location.hash.slice(1).trim();
 const status=(msg,error=false)=>{$('#wp-status').hidden=!msg;$('#wp-status').textContent=msg;$('#wp-status').style.color=error?'#ffbbbb':'#b9dff8';};
 const dollar=n=>'$'+Number(n||0).toFixed(2);let invoice=null,mode='',active=null,creating=null,sdk=null;
 async function post(action,other={}){const r=await fetch('/api/sales/checkout',{method:'POST',credentials:'same-origin',headers:{Accept:'application/json','Content-Type':'application/json'},body:JSON.stringify({action,token,...other})});const data=await r.json().catch(()=>({}));if(!r.ok||!data.ok)throw Error(data.message||'Checkout unavailable.');return data;}
 function field(id,value){$(id).textContent=String(value??'');}
 const customerStatus={DRAFT:'Awaiting Payment',SENT:'Awaiting Payment',SENDING:'Preparing Invoice',SEND_REVIEW:'Invoice Under Review',PAYMENT_PENDING:'Payment in Progress',CAPTURING:'Payment Processing',CHECK_PENDING:'Check Awaiting Clearance',PAID:'Paid',VOID:'Voided'};
 function show(inv){invoice=inv;$('#wp-content').hidden=false;field('#wp-number',inv.invoice_number);field('#wp-state',customerStatus[inv.status]||'Contact WestTech');field('#wp-confirm-amount',dollar(inv.total));field('#wp-regular',dollar(inv.regular));field('#wp-discount','-'+dollar(inv.discount));$('#wp-regular-row').hidden=Number(inv.discount)<=0;$('#wp-discount-row').hidden=Number(inv.discount)<=0;field('#wp-subtotal',dollar(inv.subtotal));field('#wp-shipping',dollar(inv.shipping));field('#wp-tax',dollar(inv.tax));field('#wp-total',dollar(inv.total));field('#wp-location','Sale / tax location: '+inv.location_label+' - '+[inv.address?.address1,inv.address?.city,inv.address?.state,inv.address?.postalCode].filter(Boolean).join(', '));
  const items=$('#wp-items');items.replaceChildren();for(const row of inv.items){const el=document.createElement('div');el.className='wp-item';const label=document.createElement('span'),amount=document.createElement('strong');label.textContent=row.quantity+' × '+row.description+' @ '+dollar(row.unitPrice);if(Number(row.regularPrice)>Number(row.unitPrice)){const original=document.createElement('small');original.className='wp-item-original';original.textContent='Regular '+dollar(row.regularPrice)+' each';label.append(original);}amount.textContent=dollar(row.lineTotal);el.append(label,amount);items.append(el);}
  $('#wp-complete').hidden=inv.status!=='PAID';$('#wp-checkout').hidden=!['DRAFT','SENT','PAYMENT_PENDING'].includes(inv.status)||Number(inv.total)===0;
  if(inv.status==='PAID')status('Payment complete.');else if(inv.status==='CHECK_PENDING')status('Your check payment is awaiting clearance.');else if(inv.status==='VOID')status('This invoice has been voided.',true);else if(inv.status==='CAPTURING')status('Your payment may be processing. Do not pay again; contact WestTech.',true);else if(!$('#wp-checkout').hidden)status('');else status('Contact WestTech for the next step.',true);
 }
 async function init(){if(!/^[a-f0-9]{64}$/.test(token)){status('This invoice link is invalid. Request a new link from WestTech.',true);return;}let data;
  try{data=await post('get');show(data.invoice);mode=data.mode;if($('#wp-checkout').hidden)return;if(!['sandbox','live'].includes(mode)||!data.clientId){status('Electronic checkout is unavailable for this invoice. Contact WestTech.',true);$('#wp-checkout').hidden=true;return;}
   const script=document.createElement('script');script.src=mode==='live'?'https://www.paypal.com/web-sdk/v6/core':'https://www.sandbox.paypal.com/web-sdk/v6/core';script.async=true;
   await new Promise((resolve,reject)=>{script.onload=resolve;script.onerror=()=>reject(Error('Could not load payment options.'));document.head.append(script);});
   sdk=await window.paypal.createInstance({clientId:data.clientId,components:['paypal-payments','venmo-payments'],pageType:'checkout'});
   const eligibility=await sdk.findEligibleMethods({currencyCode:'USD',countryCode:'US',amount:String(invoice.total)});
   configure('PAYPAL',eligibility.isEligible('paypal'));configure('VENMO',eligibility.isEligible('venmo'));
   const notice=$('#wp-eligibility');notice.hidden=mode!=='sandbox';notice.textContent=mode==='sandbox'?'SANDBOX TEST — No real funds will be charged.':'';
  }catch(e){status(e.message||'Payment methods unavailable.',true);}}
 function configure(method,eligible){const el=method==='PAYPAL'?$('#wp-paypal'):$('#wp-venmo');el.hidden=!eligible;if(!eligible)return;
  const config={onApprove:async ({orderId})=>{active=null;creating=null;status('Confirming your payment with the provider…');try{const result=await post('capture',{orderId});if(result.paid){show(result.invoice);status('Payment recorded successfully.');}else status('Payment needs review; contact WestTech.',true);}catch(e){status(e.message+' Do not submit a second payment until WestTech checks this invoice.',true);}},
   onCancel:async()=>{let id=active;const inFlight=creating;active=null;creating=null;if(!id&&inFlight){try{id=(await inFlight).orderId;}catch{}}
    if(id){try{await post('cancel',{orderId:id});status('Payment canceled; no charge recorded.');}catch(e){status('Cancellation needs review. Do not retry without checking the invoice.',true);}}else status('Checkout closed.');},
   onError:()=>status('Payment did not complete. Check with WestTech before retrying.',true)};
  const session=method==='PAYPAL'?sdk.createPayPalOneTimePaymentSession(config):sdk.createVenmoOneTimePaymentSession(config);
  el.addEventListener('click',async()=>{if(!$('#wp-confirm').checked){status('Please confirm the amount before paying.',true);return;}if(creating)return;
   status('Opening secure '+(method==='PAYPAL'?'PayPal':'Venmo')+' checkout…');
   const promise=post('start',{method}).then(data=>{active=data.orderId;return {orderId:data.orderId};});creating=promise;
   try{await session.start({presentationMode:'auto'},promise);}catch(e){status(e.message||'Checkout could not start.',true);}finally{creating=null;}
  });
 }
 $('#wp-print').addEventListener('click',()=>window.print());
 init();
})();
