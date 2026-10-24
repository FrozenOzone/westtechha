/* WestTech Payment Methods — Preview-only Venmo integration. Legacy PayPal remains unchanged. */
(()=>{'use strict';
 const params=new URLSearchParams(location.search);
 const orderId=String(params.get('id')||'');
 if(String(params.get('type')||'').toUpperCase()!=='COASTER'||!/^WTCC-\d{8}-\d{1,6}$/.test(orderId))return;
 const host='pickup-stage1-preview.westtechha.pages.dev';
 if(location.hostname.toLowerCase()!==host)return;
 const root=document.querySelector('#co-payment-methods');if(!root)return;
 const button=document.querySelector('#co-venmo-button'),explain=document.querySelector('#co-venmo-explain');
 const confirm=document.querySelector('#co-venmo-tax-confirm'),quoteEl=document.querySelector('#co-venmo-total');
 const review=document.querySelector('#co-venmo-review');
 const itemsEl=document.querySelector('#co-venmo-items-amount'),shippingAmountEl=document.querySelector('#co-venmo-shipping-amount'),taxAmountEl=document.querySelector('#co-venmo-tax-amount');
 const feedback=document.querySelector('#co-venmo-feedback');
 const shippingPanel=document.querySelector('#co-venmo-shipping');
 const shippingButton=document.querySelector('#co-venmo-ship-quote');
 const shippingSummary=document.querySelector('#co-venmo-ship-summary');
 const shippingFields=['name','line1','line2','city','state','zip'].map(x=>document.querySelector('#co-venmo-ship-'+x));
 let shippingMode=false,confirmedAddress=null;
 const route='/api/customer/orders/COASTER/'+encodeURIComponent(orderId)+'/payment-methods';
 let quote=null,session=null,busy=false,initialized=false,activeCreate=null,activeOrderId=null;
 function status(message,error=false){feedback.hidden=!message;feedback.textContent=message;feedback.style.color=error?'#ffb3b3':'#c6dcec';}
 async function json(url,options={}){
  const res=await fetch(url,{credentials:'same-origin',headers:{Accept:'application/json',...(options.body?{'Content-Type':'application/json'}:{})},...options});
  if(res.status===401)throw new Error('Sign in to your customer account again.');
  const data=await res.json().catch(()=>({}));if(!res.ok||!data.ok)throw new Error(data.message||'Unable to complete payment operation.');return data;
 }
 const post=(action,extra={})=>json(route,{method:'POST',body:JSON.stringify({action,...extra})});
 async function loadSdk(){
  const src='https://www.sandbox.paypal.com/web-sdk/v6/core';
  if(window.paypal?.createInstance)return;
  await new Promise((resolve,reject)=>{
   const script=document.createElement('script');script.src=src;script.async=true;
   script.onload=resolve;script.onerror=()=>reject(new Error('PayPal/Venmo checkout library failed to load.'));
   document.head.appendChild(script);
  });
  if(!window.paypal?.createInstance)throw new Error('PayPal/Venmo checkout did not initialize.');
 }
 function setEnabled(yes){button.hidden=!yes;explain.hidden=yes;}
 function addressFromFields(){const [name,line1,line2,city,state,zip]=shippingFields.map(x=>x.value.trim());
  return {fullName:name,address1:line1,address2:line2,city,state,postalCode:zip,countryCode:'US'};
 }
 function showQuote(q){
  quote=q;
  itemsEl.textContent='$'+q.itemAmount;
  shippingAmountEl.textContent='$'+q.shippingAmount;
  taxAmountEl.textContent='$'+q.taxAmount;
  quoteEl.textContent='$'+q.totalAmount;
  review.hidden=false;
  if(shippingMode)shippingSummary.textContent='Deliver to: '+[q.address.fullName,q.address.address1,q.address.address2,q.address.city+', '+q.address.state+' '+q.address.postalCode].filter(Boolean).join(' · ');
 }
 async function checkoutReady(clientId){
   await loadSdk();
   const sdk=await window.paypal.createInstance({clientId,components:['venmo-payments'],pageType:'checkout'});
   const eligible=await sdk.findEligibleMethods({currencyCode:'USD',countryCode:'US',amount:String(quote.totalAmount)});
   if(!eligible.isEligible('venmo')){setEnabled(false);explain.textContent='Venmo is unavailable for this Sandbox buyer. PayPal remains available.';return;}
   session=sdk.createVenmoOneTimePaymentSession({
    onApprove:async ({orderId:paypalOrderId})=>{
     activeCreate=null;activeOrderId=null; // Authorization began; never cancel this attempt automatically.
     status('Checking Venmo authorization and recording your payment…');
     const r=await post('captureVenmo',{paypalOrderId});
     if(r.paid){status('Venmo Sandbox payment recorded. Reloading your order…');location.reload();}
     else throw new Error('Payment requires verification. Contact WestTech before retrying.');
    },
    onCancel:async()=>{
     busy=false;
     const creating=activeCreate;let id=activeOrderId;activeCreate=null;activeOrderId=null;
     if(!id&&creating){try{id=(await creating).orderId;}catch{}}
     if(!id){status('Venmo was canceled before a payment attempt was created.');return;}
     try{await post('cancelVenmo',{paypalOrderId:id});status('Venmo was canceled. No payment captured; the test attempt is recorded as canceled.');}
     catch(e){status('Checkout closed, but the cancellation could not be verified. Please check your order before retrying.',true);}
    },
    onError:()=>{busy=false;status('Venmo could not complete the payment. Please review your order before trying again.',true);}
   });

   setEnabled(true);status('Confirm the address, tax, and final total before paying with Venmo.');
 }
 async function init(){
   if(initialized)return;initialized=true;
   try{
     const data=await json(route);
     const venmo=data.methods?.find(m=>m.id==='venmo');
     if(data.mode!=='sandbox'||!venmo?.enabled||!data.clientId||(data.fulfillmentMethod!=='SHIP'&&!data.quote)){root.hidden=true;return;}
     shippingMode=data.fulfillmentMethod==='SHIP';root.hidden=false;shippingPanel.hidden=!shippingMode;
     if(shippingMode){
       setEnabled(false);explain.textContent='Calculate and confirm the delivery address and tax total first.';
       shippingFields.forEach(field=>field.addEventListener('input',()=>{
         quote=null;confirmedAddress=null;session=null;confirm.checked=false;setEnabled(false);
         review.hidden=true;quoteEl.textContent='';shippingSummary.textContent='Address changed. Calculate a new quote.';
       }));
       shippingButton.addEventListener('click',async()=>{
         shippingButton.disabled=true;shippingSummary.textContent='Checking delivery address and calculating tax…';
         try{
           const result=await post('quoteVenmoShipping',{shippingAddress:addressFromFields()});
           confirmedAddress=result.quote.address;showQuote(result.quote);confirm.checked=false;
           await checkoutReady(data.clientId);
         }catch(err){quote=null;confirmedAddress=null;session=null;review.hidden=true;setEnabled(false);shippingSummary.textContent=err.message||'Could not verify the shipping quote.';}
         finally{shippingButton.disabled=false;}
       });
     }else{showQuote(data.quote);await checkoutReady(data.clientId);}
   }catch(e){root.hidden=false;setEnabled(false);explain.textContent=e.message||'Could not check Venmo eligibility.';}
 }
 button.addEventListener('click',async()=>{
  if(!session||busy)return;
  if(!confirm.checked){status('Please approve the tax and total before starting Venmo.',true);return;}
  busy=true;status('Opening secure Venmo Sandbox checkout…');
  try{
   // Create a separate PayPal Orders API attempt without disturbing existing PayPal approval links.
   const promise=post('startVenmo',{confirmedTotal:true,expectedTotal:String(quote.totalAmount),...(shippingMode?{shippingAddress:confirmedAddress}:{})})
     .then(data=>{activeOrderId=data.orderId;return {orderId:data.orderId};});
   activeCreate=promise;
   await session.start({presentationMode:'auto'},promise);
  }catch(e){status(e.message||'Venmo checkout could not start.',true);}
  finally{busy=false;}
 });
 const observer=new MutationObserver(()=>{
  const sandbox=document.querySelector('#co-paypal-sandbox');
  if(sandbox&&!sandbox.hidden){observer.disconnect();init();}
 });
 const sandbox=document.querySelector('#co-paypal-sandbox');
 if(sandbox&&!sandbox.hidden)init();else if(sandbox)observer.observe(sandbox,{attributes:true,attributeFilter:['hidden']});
})();
