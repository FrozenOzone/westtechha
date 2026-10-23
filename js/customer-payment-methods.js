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
 const feedback=document.querySelector('#co-venmo-feedback');
 const route='/api/customer/orders/COASTER/'+encodeURIComponent(orderId)+'/payment-methods';
 let quote=null,session=null,busy=false,initialized=false;
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
 async function init(){
  if(initialized)return;initialized=true;
  try{
   const data=await json(route);
   const venmo=data.methods?.find(m=>m.id==='venmo');
   if(data.mode!=='sandbox'||!venmo?.enabled||!data.clientId||!data.quote){root.hidden=true;return;}
   quote=data.quote;
   root.hidden=false;
   quoteEl.textContent=`Approved subtotal: $${quote.taxableAmount} + Colorado tax: $${quote.taxAmount} = Total: $${quote.totalAmount}`;
   await loadSdk();
   const sdk=await window.paypal.createInstance({clientId:data.clientId,components:['venmo-payments'],pageType:'checkout'});
   const eligible=await sdk.findEligibleMethods({currencyCode:'USD',countryCode:'US',amount:String(quote.totalAmount)});
   if(!eligible.isEligible('venmo')){setEnabled(false);explain.textContent='Venmo is not available for this device or Sandbox buyer. PayPal remains available above.';return;}
   session=sdk.createVenmoOneTimePaymentSession({
    onApprove:async ({orderId:paypalOrderId})=>{
     status('Checking Venmo authorization and recording your payment…');
     const r=await post('captureVenmo',{paypalOrderId});
     if(r.paid){status('Venmo Sandbox payment recorded. Reloading your order…');location.reload();}
     else throw new Error('Payment requires verification. Contact WestTech before retrying.');
    },
    onCancel:()=>{busy=false;status('Venmo was canceled. No payment was captured.');},
    onError:()=>{busy=false;status('Venmo could not complete the payment. Please review your order before trying again.',true);}
   });
   setEnabled(true);status('Venmo is available for this Sandbox buyer. Confirm the tax and total before paying.');
  }catch(e){root.hidden=false;setEnabled(false);explain.textContent=e.message||'Could not check Venmo eligibility.';}
 }
 button.addEventListener('click',async()=>{
  if(!session||busy)return;
  if(!confirm.checked){status('Please approve the tax and total before starting Venmo.',true);return;}
  busy=true;status('Opening secure Venmo Sandbox checkout…');
  try{
   // Create a separate PayPal Orders API attempt without disturbing existing PayPal approval links.
   const promise=post('startVenmo',{confirmedTotal:true,expectedTotal:String(quote.totalAmount)})
     .then(data=>({orderId:data.orderId}));
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
