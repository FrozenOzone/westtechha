// WestTechHA Sales & Invoices wallet add-on. Loaded only when the server enables wallets.
// Existing PayPal and Venmo sessions live in sales-pay.js and are intentionally untouched.
(()=>{'use strict';
 const loadScript=src=>new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src=src;script.async=true;
  script.onload=resolve;script.onerror=()=>reject(Error('Wallet provider library unavailable.'));
  document.head.appendChild(script);
 });
 async function init({mode,clientId,invoice,post,status,show,isConfirmed}){
  if(!window.paypal?.createInstance||!['sandbox','live'].includes(mode)||!invoice||!clientId)return;
  // Dedicated SDK instance: wallet eligibility/config cannot break the working PayPal/Venmo buttons.
  let sdk,eligibility;
  try{
   sdk=await window.paypal.createInstance({
    clientId,components:['applepay-payments','googlepay-payments'],pageType:'checkout'
   });
   eligibility=await sdk.findEligibleMethods({
    currencyCode:'USD',countryCode:'US',amount:String(invoice.total)
   });
  }catch{return;} // No merchant wallet approval yet: preserve the existing checkout without extra errors.
  const check=label=>{
   if(!isConfirmed()){status('Please confirm the invoice amount before using '+label+'.',true);return false;}
   return true;
  };
  const complete=async orderId=>{
   const result=await post('capture',{orderId});
   if(!result?.paid||!result.invoice)throw Error('Payment needs review by WestTech. Do not pay again.');
   show(result.invoice);status('Payment recorded successfully.');return true;
  };
  // Apple Pay is rendered ONLY on an eligible Apple browser with the wallet enabled.
  async function addApple(){
   if(!eligibility.isEligible('applepay'))return;
   await loadScript('https://applepay.cdn-apple.com/jsapi/1.latest/apple-pay-sdk.js');
   if(!window.ApplePaySession?.canMakePayments?.()||!window.ApplePaySession.supportsVersion?.(3))return;
   const apple=await sdk.createApplePayOneTimePaymentSession();
   const configuration=await apple.config();
   if(!Array.isArray(configuration?.supportedNetworks)||!Array.isArray(configuration?.merchantCapabilities))return;
   const host=document.querySelector('#wp-apple-pay'),button=document.createElement('apple-pay-button');
   button.setAttribute('buttonstyle','black');button.setAttribute('type','buy');button.setAttribute('locale','en-US');
   host.append(button);host.hidden=false;host.parentElement.hidden=false;
   button.addEventListener('click',()=>{
    if(!check('Apple Pay'))return;
    // Native user-gesture requirement: create/begin ApplePaySession synchronously in this click.
    const version=window.ApplePaySession.supportsVersion(4)?4:3;
    const request={
     countryCode:'US',currencyCode:'USD',
     supportedNetworks:configuration.supportedNetworks,
     merchantCapabilities:configuration.merchantCapabilities,
     requiredBillingContactFields:['name','postalAddress'],
     requiredShippingContactFields:[],
     total:{label:'WestTech Home Automation',amount:String(invoice.total),type:'final'}
    };
    let session;
    try{session=new window.ApplePaySession(version,request);}catch{
     status('Apple Pay is not available on this device. Choose PayPal or Venmo.',true);return;
    }
    session.onvalidatemerchant=async event=>{
     try{
      const {merchantSession}=await apple.validateMerchant({validationUrl:event.validationURL});
      session.completeMerchantValidation(merchantSession);
     }catch{session.abort();status('Apple Pay merchant validation failed. No payment was started.',true);}
    };
    session.onpaymentauthorized=async event=>{
     try{
      status('Confirming Apple Pay payment…');
      const {orderId}=await post('start',{method:'APPLE_PAY'});
      const result=await apple.confirmOrder({
       orderId,token:event.payment.token,
       billingContact:event.payment.billingContact,shippingContact:event.payment.shippingContact
      });
      if(result?.status&&result.status!=='APPROVED')throw Error('Apple Pay payment needs further verification.');
      await complete(orderId);
      session.completePayment({status:window.ApplePaySession.STATUS_SUCCESS});
     }catch(error){
      session.completePayment({status:window.ApplePaySession.STATUS_FAILURE});
      status((error.message||'Apple Pay could not complete.')+' Do not attempt another charge until WestTech verifies the invoice.',true);
     }
    };
    session.oncancel=()=>status('Apple Pay was closed without completing checkout.');
    session.begin();
   });
  }
  // Google Pay native payment sheet: create order ONLY after Google has authorized a wallet.
  async function addGoogle(){
   if(!eligibility.isEligible('googlepay'))return;
   await loadScript('https://pay.google.com/gp/p/js/pay.js');
   if(!window.google?.payments?.api?.PaymentsClient)return;
   const googleSession=sdk.createGooglePayOneTimePaymentSession();
   let config;
   if(typeof googleSession.getGooglePayConfig==='function'){
    config=await googleSession.getGooglePayConfig();
   }else{
    const details=eligibility.getDetails('googlepay');
    if(!details?.config||typeof googleSession.formatConfigForPaymentRequest!=='function')return;
    config=googleSession.formatConfigForPaymentRequest(details.config);
   }
   if(!config?.allowedPaymentMethods||!config?.apiVersion)return;
   const client=new window.google.payments.api.PaymentsClient({
    environment:mode==='live'?'PRODUCTION':'TEST',
    paymentDataCallbacks:{
     onPaymentAuthorized:async paymentData=>{
      try{
       status('Confirming Google Pay payment…');
       const {orderId}=await post('start',{method:'GOOGLE_PAY'});
       const confirmed=await googleSession.confirmOrder({
        orderId,paymentMethodData:paymentData.paymentMethodData
       });
       if(confirmed?.status!=='APPROVED')
        throw Error('Google Pay requires additional authorization. Payment has NOT been captured.');
       await complete(orderId);
       return {transactionState:'SUCCESS'};
      }catch(error){
       status((error.message||'Google Pay could not complete.')+' Do not attempt another charge until WestTech verifies the invoice.',true);
       return {transactionState:'ERROR',error:{intent:'PAYMENT_AUTHORIZATION',reason:'OTHER_ERROR',message:'Payment could not be completed. Contact WestTech.'}};
      }
     }
    }
   });
   const ready=await client.isReadyToPay({
    allowedPaymentMethods:config.allowedPaymentMethods,
    apiVersion:config.apiVersion,apiVersionMinor:config.apiVersionMinor
   });
   if(!ready?.result)return;
   const host=document.querySelector('#wp-google-pay');
   const button=client.createButton({buttonType:'pay',onClick:()=>{
    if(!check('Google Pay'))return;
    client.loadPaymentData({
     ...config,
     transactionInfo:{
      countryCode:config.countryCode||'US',
      currencyCode:'USD',totalPriceStatus:'FINAL',
      totalPrice:String(invoice.total)
     },
     callbackIntents:['PAYMENT_AUTHORIZATION']
    }).catch(error=>{
     if(error?.statusCode==='CANCELED')status('Google Pay was closed without completing checkout.');
     else status('Google Pay is unavailable. Use PayPal or Venmo, or contact WestTech.',true);
    });
   }});
   host.append(button);host.hidden=false;host.parentElement.hidden=false;
  }
  await Promise.allSettled([addApple(),addGoogle()]);
 }
 window.WestTechSalesWallets={init};
})();