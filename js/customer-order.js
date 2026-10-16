/* WestTech Customer Portal – Stage 3 Step 4: signed-in coaster proof review. */
(()=>{
 'use strict';
 const $=s=>document.querySelector(s);
 const params=new URLSearchParams(location.search);
 const source=String(params.get('type')||'').toUpperCase();
 const id=String(params.get('id')||'');
 const validSource=new Set(['COASTER','CUSTOM','ENCLOSURE','STORE']);
 const content=$('#co-content');
 const message=$('#co-message');
 const $text=(s,value)=>{$(s).textContent=String(value??'—')};
 function readable(value){return String(value||'').replaceAll('_',' ').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase())||'—'}
 function date(value){if(!value)return '—';const d=new Date(value);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});}
 function money(value){const number=Number(value);return Number.isFinite(number)?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(number):'—';}
 function explain(status,fulfillment){
   switch(status){
    case 'DESIGN_REVIEW':return ['WestTech is reviewing your request','No action is needed while WestTech reviews your order.'];
    case 'PROOF_SENT':return ['Your design is ready for review','Review your latest WestTech proof and approve it or request changes in the section below.'];
    case 'CHANGES_REQUESTED':return ['Your changes were sent to WestTech','WestTech will prepare and release a revised proof for your review.'];
    case 'PROOF_APPROVED':return ['Your proof was approved','Your proof and agreed terms are recorded. Payment will follow if required.'];
    case 'AWAITING_PAYMENT':return ['Payment is awaiting completion','Use the secure PayPal payment link already provided by WestTech. Payment inside the dashboard will be added in a later step.'];
    case 'PRODUCTION_QUEUE':return ['Your order is in the production queue','WestTech has your approved order queued for manufacturing. No action is needed.'];
    case 'IN_PRODUCTION':return ['Your order is in production','WestTech is working on your order. No action is needed.'];
    case 'PREPARING_FOR_PICKUP':return ['WestTech is preparing your pickup order','Final checks and packaging are underway.'];
    case 'READY_FOR_PICKUP':return ['Your order is ready for pickup','Choose an available pickup appointment or request a different time in the scheduling section below.'];
    case 'PREPARING_TO_SHIP':return ['Your order is preparing for shipment','WestTech is completing final packaging and preparing the shipment.'];
    case 'SHIPPED':return ['Your order has shipped','Your tracking details, when available, are shown in the order summary.'];
    case 'COMPLETED':return ['Your order is complete','Thank you for choosing WestTech. Your order remains in your history.'];
    case 'ARCHIVED':return ['Your order is in your history','You can return to this page to review your previous order.'];
    case 'EXPIRED':return ['This order expired','Please contact WestTech if you want to discuss a new order.'];
    case 'CANCELLED':case 'CANCELED':return ['This order was canceled','No further order action is available here.'];
    default:return [readable(status),'Check your WestTech messages or order notifications for the next step.'];
   }
 }
 const stages=['Submitted','Review','Approval / Payment','Production','Fulfillment','Completed'];
 function step(status){
   if(['SUBMITTED','REQUESTED','PENDING','DRAFT'].includes(status))return 1;
   if(status==='DESIGN_REVIEW')return 2;
   if(['PROOF_SENT','CHANGES_REQUESTED','PROOF_APPROVED','AWAITING_PAYMENT','PAYMENT_PENDING','APPROVED'].includes(status))return 3;
   if(['PRODUCTION_QUEUE','IN_PRODUCTION'].includes(status))return 4;
   if(['PREPARING_FOR_PICKUP','READY_FOR_PICKUP','PREPARING_TO_SHIP','SHIPPED'].includes(status))return 5;
   if(['COMPLETED','ARCHIVED'].includes(status))return 6;
   return null;
 }
 function render(order){
  const status=String(order.status||'').toUpperCase();
  const type=String(order.sourceType||'').toUpperCase();
  const fulfillment=String(order.fulfillmentMethod||'').toUpperCase();
  $text('#co-intro','Track the progress of your WestTech order and see what happens next.');
  $text('#co-product-type',({'COASTER':'CUSTOM COASTERS','CUSTOM':'CUSTOM ORDER','ENCLOSURE':'ESP32 ENCLOSURES','STORE':'WESTTECH STORE'})[type]||'WESTTECH ORDER');
  $text('#co-title',order.title||'WestTech Order');
  $text('#co-order-id',order.orderId);
  $text('#co-status',readable(status));
  const [headline,body]=explain(status,fulfillment);$text('#co-next-title',headline);$text('#co-next-body',body);
  const timeline=$('#co-timeline');timeline.replaceChildren();
  const current=step(status);
  for(let i=0;i<stages.length;i++){
   const item=document.createElement('li');item.textContent=stages[i];
   item.dataset.stage=current===null?'upcoming':current>i+1?'complete':current===i+1?'current':'upcoming';
   timeline.appendChild(item);
  }
  $text('#co-created',date(order.createdAt));$text('#co-updated',date(order.updatedAt));
  $text('#co-total',money(order.total));$text('#co-payment',readable(order.paymentStatus));
  $text('#co-fulfillment',({'LOCAL_PICKUP':'Local Pickup','SHIP':'Ship Order','UNSET':'To Be Confirmed'})[fulfillment]||readable(fulfillment));
  const detail=$('#co-delivery'),dtitle=$('#co-delivery-title'),dbody=$('#co-delivery-details');
  if(fulfillment==='SHIP'&&order.trackingNumber){
   detail.hidden=false;dtitle.textContent='Shipping tracking';
   dbody.textContent=[order.trackingCarrier||'Carrier',order.trackingNumber].join(' · ');
  }else if(fulfillment==='LOCAL_PICKUP'&&['PREPARING_FOR_PICKUP','READY_FOR_PICKUP'].includes(status)){
   detail.hidden=false;dtitle.textContent='Local pickup';
   dbody.textContent='Review your pickup scheduling options below. Private pickup address and directions will appear after confirmation when that Stage 3 feature is enabled.';
  }else{detail.hidden=true;dbody.textContent='';}
  content.hidden=false;
  renderCoasterDesign(order);
  renderCoasterApproval(order);
  if(typeof window.wtPickupPortalInit==='function')window.wtPickupPortalInit(order);
 }
 function renderCoasterDesign(order){
  const host=$('#co-design'),image=$('#co-design-image'),placeholder=$('#co-design-placeholder'),caption=$('#co-design-caption');
  if(!host||!image||!placeholder||!caption)return;
  host.hidden=String(order.sourceType||'').toUpperCase()!=='COASTER';
  if(host.hidden)return;
  image.hidden=false;image.style.visibility='hidden';image.removeAttribute('src');
  placeholder.hidden=false;placeholder.textContent='Loading your coaster design…';
  caption.textContent='WestTech displays the current proof when available, or the design you submitted.';
  const url='/api/customer/orders/COASTER/'+encodeURIComponent(order.orderId)+'/artwork';
  image.alt='Coaster design for order '+order.orderId;
  image.onload=()=>{image.style.visibility='visible';placeholder.hidden=true;};
  image.onerror=()=>{image.hidden=true;placeholder.hidden=false;placeholder.textContent='Design preview is not available for this order yet.';};
  image.src=url;
 }
 const proofHost=$('#co-approval');
 let activeProof=null,proofBusy=false,proofLoaded=false;
 const proofUrl=()=>'/api/customer/orders/COASTER/'+encodeURIComponent(id)+'/approval';
 function proofText(selector,value){const el=$(selector);if(el)el.textContent=String(value??'—');}
 function proofFeedback(text,error=false){const node=$('#co-proof-feedback');node.textContent=text||'';node.hidden=!text;node.dataset.error=error?'true':'false';}
 function proofButtons(){const allowed=!!activeProof?.canRespond&&!proofBusy&&proofLoaded;$('#co-proof-approve').disabled=!allowed||!$('#co-proof-confirm').checked;$('#co-proof-request').disabled=!allowed;}
 async function renderCoasterApproval(order){
   if(!proofHost)return;
   proofHost.hidden=true;activeProof=null;proofLoaded=false;
   if(String(order.sourceType||'').toUpperCase()!=='COASTER')return;
   try{
     const response=await fetch(proofUrl(),{credentials:'same-origin',headers:{Accept:'application/json'}});
     if(response.status===401){location.replace('login.html');return;}
     const data=await response.json().catch(()=>({}));
     if(!response.ok||!data.ok)throw new Error(data.message||'Proof details are unavailable.');
     const p=data.proof;
     if(!p?.hasProof||!['PROOF_SENT','CHANGES_REQUESTED','PROOF_APPROVED','AWAITING_PAYMENT'].includes(String(p.status||'').toUpperCase()))return;
     activeProof=p;proofHost.hidden=false;
     proofFeedback('');$('#co-proof-confirm').checked=false;$('#co-proof-change').value='';
     proofText('#co-proof-version','Proof V'+p.proofVersion);
     proofText('#co-proof-set',p.setSize+'-Coaster Set');
     proofText('#co-proof-count',p.setCount+' ('+p.totalCoasters+' coasters)');
     proofText('#co-proof-delivery',p.fulfillmentMethod==='LOCAL_PICKUP'?'Local Pickup':p.fulfillmentMethod==='SHIP'?'Ship Order':'To Be Confirmed');
     proofText('#co-proof-window',p.productionWindow||'To Be Confirmed');
     proofText('#co-proof-base',money(p.basePrice*Math.max(1,p.setCount)));
     const artTotal=p.artworkCharge+p.billableWorkTotal;
     $('#co-proof-art-row').hidden=artTotal===0;proofText('#co-proof-art',money(artTotal));
     $('#co-proof-other-row').hidden=p.otherCharge===0;proofText('#co-proof-other',money(p.otherCharge));
     $('#co-proof-shipping-row').hidden=p.shippingAmount===0;proofText('#co-proof-shipping',money(p.shippingAmount));
     $('#co-proof-discount-row').hidden=p.discountAmount===0;proofText('#co-proof-discount','−'+money(p.discountAmount));
     proofText('#co-proof-total',money(p.finalAmount));
     proofText('#co-proof-payment',p.paymentRequired?'Required after approval':'Not required');
     $('#co-proof-review-note').hidden=!p.customerReviewNote;
     proofText('#co-proof-review-text',p.customerReviewNote||'');
     const note=$('#co-proof-result');note.hidden=p.canRespond;
     if(!p.canRespond){
       note.textContent=p.reviewExpired&&p.proofStatus==='SENT'?'The 30-day proof review period has expired. Please contact WestTech to request a new approval link.':p.proofStatus==='CHANGES_REQUESTED'?'Your changes are recorded. The proof shown here is the previous version; wait for WestTech to release the revised proof.':p.proofStatus==='APPROVED'?'Proof approved. The design and terms are locked. '+(p.paymentRequired?'Payment is the next step.':'No payment is required.'):'This proof is not currently open for approval.';
     }
     $('#co-proof-actions').hidden=!p.canRespond;
     $('#co-proof-instructions').textContent=p.canRespond?'Please review the exact WestTech proof and the order terms below. Approval locks these terms before payment or manufacturing.':'Your proof is saved with this order for reference.';
     const image=$('#co-proof-image'),pdf=$('#co-proof-pdf'),loader=$('#co-proof-loading'),open=$('#co-proof-open');
     image.onload=null;image.onerror=null;image.removeAttribute('src');pdf.removeAttribute('src');image.hidden=true;pdf.hidden=true;
     loader.hidden=false;loader.textContent='Loading WestTech proof…';
     const url=proofUrl()+'/proof';open.href=url;open.hidden=false;
     if(p.proofIsPdf){
       pdf.hidden=false;pdf.src=url;loader.hidden=true;proofLoaded=true;
     }else{
       image.onload=()=>{image.hidden=false;loader.hidden=true;proofLoaded=true;proofButtons();};
       image.onerror=()=>{image.hidden=true;loader.hidden=false;loader.textContent='We could not load the released proof. Please refresh or contact WestTech before approving.';proofLoaded=false;proofButtons();};
       image.src=url;
     }
     proofButtons();
   }catch(error){proofHost.hidden=false;$('#co-proof-actions').hidden=true;proofFeedback(error.message||'Unable to load the current proof.',true);}
 }
 async function submitProofAction(action){
   if(!activeProof?.canRespond||proofBusy||!proofLoaded)return;
   const message=$('#co-proof-change').value.trim();
   if(action==='requestChanges'&&message.length<2){proofFeedback('Please describe what you would like changed.',true);return;}
   if(action==='approve'&&!$('#co-proof-confirm').checked){proofFeedback('Confirm that you reviewed the design and terms.',true);return;}
   proofBusy=true;proofButtons();proofFeedback('');
   const btn=action==='approve'?$('#co-proof-approve'):$('#co-proof-request');
   const label=btn.textContent;btn.textContent=action==='approve'?'Saving approval…':'Sending changes…';
   try{
     const response=await fetch(proofUrl(),{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify({action,proofVersion:activeProof.proofVersion,message})});
     if(response.status===401){location.replace('login.html');return;}
     const data=await response.json().catch(()=>({}));
     if(!response.ok||!data.ok)throw new Error(data.message||'Could not save your decision.');
     proofBusy=false;await load();
     proofFeedback(data.notice||(action==='approve'?'Your proof approval is saved.':'WestTech has received your requested changes.'));
   }catch(error){proofBusy=false;proofFeedback(error.message||'Unable to save your decision.',true);proofButtons();}
   finally{btn.textContent=label;}
 }
 $('#co-proof-confirm').addEventListener('change',proofButtons);
 $('#co-proof-approve').addEventListener('click',()=>submitProofAction('approve'));
 $('#co-proof-request').addEventListener('click',()=>submitProofAction('requestChanges'));
 async function load(){
  if(!validSource.has(source)||!id||id.length>100){
   message.textContent='This order link is incomplete. Return to My Orders and select an order.';message.classList.add('error');message.hidden=false;return;
  }
  try{
   const response=await fetch('/api/customer/account',{credentials:'same-origin',headers:{Accept:'application/json'}});
   if(response.status===401){location.replace('login.html');return;}
   const data=await response.json().catch(()=>({}));
   if(!response.ok||data.ok!==true)throw new Error('Could not load your order details.');
   const order=(Array.isArray(data.orders)?data.orders:[]).find(x=>x.sourceType===source&&x.orderId===id);
   if(!order)throw new Error('This order is not available in your customer account.');
   window.wtPortalPickupEmail=typeof data.profile?.email==='string'?data.profile.email:'';
   render(order);
  }catch(e){message.textContent=e.message||'Could not load your order details.';message.classList.add('error');message.hidden=false;}
 }
 window.wtPortalPickupConfirmed=(appointment,pickupDetails)=>{
  const info=$('#co-delivery'),title=$('#co-delivery-title'),body=$('#co-delivery-details');
  if(!info||!appointment)return;
  const when=new Date(appointment.localDate+'T12:00:00Z').toLocaleDateString('en-US',{timeZone:'UTC',weekday:'long',month:'short',day:'numeric',year:'numeric'});
  const [hour,min]=appointment.localTime.split(':').map(Number);
  info.hidden=false;title.textContent='Confirmed pickup appointment';
  body.textContent=`${when} at ${hour%12||12}:${String(min).padStart(2,'0')} ${hour>=12?'PM':'AM'} Mountain Time.`+
   (pickupDetails?.location?.address?` Private location: ${pickupDetails.location.address}.`:' Pickup location not yet provided.');
 };
 load();
})();
