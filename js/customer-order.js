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
    case 'REORDER_VERIFICATION':return ['WestTech is verifying your reorder','We are confirming current pricing and production timing for your previously approved design. No additional artwork approval is necessary.'];
    case 'DESIGN_REVIEW':return ['WestTech is reviewing your request','No action is needed while WestTech reviews your order.'];
    case 'PROOF_SENT':return ['Your design is ready for review','Review your latest WestTech proof and approve it or request changes in the section below.'];
    case 'CHANGES_REQUESTED':return ['Your changes were sent to WestTech','WestTech will prepare and release a revised proof for your review.'];
    case 'PROOF_APPROVED':return ['Your proof was approved','Your proof and agreed terms are recorded. Payment will follow if required.'];
    case 'AWAITING_PAYMENT':return ['Payment is awaiting completion','Your proof has been approved. Check the current payment instructions below; Preview test orders never require a PayPal charge.'];
    case 'PRODUCTION_QUEUE':return ['Your order is in the production queue','WestTech has your approved order queued for manufacturing. No action is needed.'];
    case 'IN_PRODUCTION':return ['Your order is in production','WestTech is working on your order. No action is needed.'];
    case 'PREPARING_FOR_PICKUP':return ['WestTech is preparing your pickup order','Final checks and packaging are underway.'];
    case 'READY_FOR_PICKUP':return ['Your order is ready for pickup','Choose an available pickup appointment or request a different time in the scheduling section below.'];
    case 'PREPARING_TO_SHIP':return ['Your order is being prepared for shipment','WestTech is completing final packaging and preparing the shipment.'];
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
   if(['DESIGN_REVIEW','REORDER_VERIFICATION'].includes(status))return 2;
   if(['PROOF_SENT','CHANGES_REQUESTED','PROOF_APPROVED','AWAITING_PAYMENT','PAYMENT_PENDING','APPROVED'].includes(status))return 3;
   if(['PRODUCTION_QUEUE','IN_PRODUCTION'].includes(status))return 4;
   if(['PREPARING_FOR_PICKUP','READY_FOR_PICKUP','PREPARING_TO_SHIP','SHIPPED'].includes(status))return 5;
   if(['COMPLETED','ARCHIVED'].includes(status))return 6;
   return null;
 }

 // Stage-specific workspace uses the same step() mapping as the progress timeline.
 // These are presentation-only rules; proof approvals, payment and pickup continue
 // to use their existing, authenticated endpoints.
 function renderStageWorkspace(order,current){
  const host=$('#co-stage-workspace'),panel=$('#co-stage-panel');
  if(!host||!panel)return;
  const status=String(order.status||'').toUpperCase();
  const payment=String(order.paymentStatus||'NOT_REQUESTED').toUpperCase();
  const required=order.paymentRequired===true;
  const fulfillment=String(order.fulfillmentMethod||'').toUpperCase();
  host.classList.toggle('customer-order-stage-only',String(order.sourceType||'').toUpperCase()!=='COASTER');
  const paid=['PAID','CAPTURED','COMPLETED'].includes(payment);
  const pickup=fulfillment==='LOCAL_PICKUP';
  let title='',explanation='',guidance='',showPayment=false;
  switch(current){
   case 1:
    title='Your request has been received';
    explanation='We have your order and design details. WestTech will review everything before releasing a proof.';
    guidance='No action is needed right now. Watch this page for the next update.';
    break;
   case 2:
    if(status==='REORDER_VERIFICATION'){title='Your reorder is being verified';explanation='Your previously approved artwork will be reused. WestTech is confirming the current total and manufacturing schedule.';guidance='No new proof approval is needed. Payment is next once WestTech verifies the order.';break;}
    title='WestTech is reviewing your design';
    explanation='We are checking your coaster design and order details before releasing a customer proof.';
    guidance='You will be able to approve the proof or request changes once it is released.';
    break;
   case 3:
    showPayment=['PROOF_APPROVED','AWAITING_PAYMENT','PAYMENT_PENDING','APPROVED'].includes(status);
    if(status==='PROOF_SENT'){
     title='Your proof needs a decision';
     explanation='Check the released artwork and order terms shown to the left.';
     guidance='Use Approve Design & Terms or Request Changes in the proof section. Production does not start until the required steps are complete.';
    }else if(status==='CHANGES_REQUESTED'){
     title='Your requested changes are being reviewed';
     explanation='WestTech has your feedback. The visible proof is the previous version until a revised proof is released.';
     guidance='No further action is needed until the revised proof is ready.';
    }else if(paid){
     title=order.paymentSimulated?'Preview payment test recorded':'Payment has been recorded';
     explanation=order.paymentSimulated?'This test payment was simulated in Preview. No PayPal charge was made.':'Your artwork is approved and payment is recorded. WestTech will move your order forward.';
     guidance='No additional payment action is needed here.';
    }else if(payment==='NOT_REQUIRED'||(!required&&payment==='NOT_REQUESTED'&&status==='PROOF_APPROVED')){
     title='Your design is approved';
     explanation='Your approved artwork and order terms are saved.';
     guidance='WestTech will advance your order to production when it is ready.';
    }else{
     title='Your artwork is approved';
     explanation='Your approved design and terms are locked. Payment is the next step before production.';
     guidance=payment==='PREVIEW_AWAITING_TEST_PAYMENT'?'PREVIEW TEST: WestTech can simulate payment from Admin. No PayPal charge will be made.':payment==='NOT_REQUESTED'?'Payment is required but checkout has not been prepared yet. WestTech will provide the next step.':'Please use the secure payment instructions provided by WestTech. Payment is not collected directly on this page.';
    }
    break;
   case 4:
    title=status==='IN_PRODUCTION'?'Your order is being made':'Your order is in the production queue';
    explanation=status==='IN_PRODUCTION'?'WestTech is manufacturing your approved order.':'Your order is approved and waiting for its production turn.';
    guidance='No customer action is required. You can return here to check progress.';
    break;
   case 5:
    if(status==='READY_FOR_PICKUP'){
     title='Your order is ready for pickup';
     explanation='Your coasters are ready. Use the appointment section below to choose a time or review your confirmed booking.';
     guidance='Pickup details and appointment status are shown below when available.';
    }else if(status==='SHIPPED'){
     title='Your order has shipped';
     explanation='Your package is on its way. Any available tracking details are shown in the order summary above.';
     guidance='No action is required unless WestTech contacts you.';
    }else{
     title=pickup?'Preparing your order for pickup':'Preparing your shipment';
     explanation='WestTech is completing final checks and packaging.';
     guidance=pickup?'Scheduling opens when your order is marked Ready for Pickup.':'Shipping information will appear when your package ships.';
    }
    break;
   case 6:
    title='Your order is complete';
    explanation='Thank you for choosing WestTech. Your final artwork and order details remain available in My Orders.';
    guidance='This page is kept for your records.';
    break;
   default:
    title=['CANCELED','CANCELLED','EXPIRED'].includes(status)?'This order is closed':'Order status update';
    explanation=['CANCELED','CANCELLED','EXPIRED'].includes(status)?'This order is no longer active.':'The order details above show the last available status.';
    guidance='Contact WestTech if you need help with this order.';
  }
  $text('#co-stage-label',current===3&&showPayment?'PAYMENT & NEXT STEP':current?`STAGE ${current} OF ${stages.length} · ${stages[current-1].toUpperCase()}`:'ORDER STATUS');
  if(current===3&&showPayment){title='Payment details';explanation=paid?'Your payment is recorded. No further payment is needed.':required?'Your approved order is waiting for its payment step.':'Your approved order does not require payment.';}
  $text('#co-stage-title',title);
  $text('#co-stage-explanation',explanation);
  $text('#co-stage-guidance',guidance);
  $('#co-stage-payment').hidden=!showPayment;
  if(showPayment){$text('#co-stage-amount',money(order.total));$text('#co-stage-payment-status',order.paymentSimulated?'Preview Test Paid · No Charge':required&&payment==='NOT_REQUESTED'?'Required · Not yet initiated':payment==='PREVIEW_AWAITING_TEST_PAYMENT'?'Preview · Awaiting test payment':readable(payment));}
  // Latest Update already carries the stage message. Below progress, only keep
  // the customer payment details when they add information or a next step.
  const coaster=String(order.sourceType||'').toUpperCase()==='COASTER';
  const paymentStage=current===3&&showPayment;
  panel.hidden=coaster&&!paymentStage;
  host.classList.toggle('customer-order-workspace-no-panel',panel.hidden);
  syncWorkspaceVisibility();
 }
 function syncWorkspaceVisibility(){
  const host=$('#co-stage-workspace');
  if(!host)return;
  const visible=['#co-approval','#co-stage-panel','#co-pickup'].some(selector=>{
   const node=$(selector);return node&&!node.hidden;
  });
  host.hidden=!visible;
 }
 // Only link to well-formed, non-test carrier tracking IDs. A Preview test
 // shipment never opens a real carrier tracking page.
 function carrierTrackingUrl(carrier,tracking,simulated){
  if(simulated)return '';
  const c=String(carrier||'').trim().toUpperCase(),n=String(tracking||'').trim().toUpperCase();
  if(/^USPS(?:\b|\s)/.test(c)&&/^\d{20,26}$/.test(n))return 'https://tools.usps.com/go/TrackConfirmAction?tLabels='+encodeURIComponent(n);
  if(/^UPS(?:\b|\s)/.test(c)&&/^1Z[A-Z0-9]{16}$/.test(n))return 'https://www.ups.com/track?tracknum='+encodeURIComponent(n);
  if(/^FEDEX(?:\b|\s)/.test(c)&&/^(?:\d{12}|\d{15}|\d{20}|\d{22})$/.test(n))return 'https://www.fedex.com/fedextrack/?trknbr='+encodeURIComponent(n);
  return '';
 }
 // Open the carrier's official tracking page even for Preview test references,
 // but never submit a simulated / malformed tracking ID to the carrier.
 function carrierTrackingPage(carrier){
  const c=String(carrier||'').trim().toUpperCase();
  if(/^USPS(?:\b|\s)/.test(c))return {name:'USPS',url:'https://tools.usps.com/go/TrackConfirmAction_input'};
  if(/^UPS(?:\b|\s)/.test(c))return {name:'UPS',url:'https://www.ups.com/track?loc=en_US'};
  if(/^FEDEX(?:\b|\s)/.test(c))return {name:'FedEx',url:'https://www.fedex.com/en-us/tracking.html'};
  return null;
 }
 function renderShipping(order){
  const box=$('#co-shipping');if(!box)return;
  const isCoaster=String(order.sourceType||'').toUpperCase()==='COASTER';
  const shipping=String(order.fulfillmentMethod||'').toUpperCase()==='SHIP';
  box.hidden=!(isCoaster&&shipping);if(box.hidden)return;
  const status=String(order.status||'').toUpperCase();
  $text('#co-shipping-charge',money(order.shippingAmount));
  const shipmentStatus=({PREPARING_TO_SHIP:'Preparing for shipment',SHIPPED:'Shipped',COMPLETED:'Completed'})[status]||'Not shipped yet';
  $text('#co-shipping-status',shipmentStatus);
  const destination=order.shippingDestination||{};
  const isPreview=order.paymentSimulated===true;
  const lines=[destination.name,destination.address1,destination.address2,
   [destination.city,destination.region,destination.postalCode].filter(Boolean).join(', '),
   destination.country].map(s=>String(s||'').trim()).filter(Boolean);
  const hasStreet=!!String(destination.address1||'').trim();
  $text('#co-shipping-address-title',isPreview?'Preview test destination — not a customer address':'Ship-to address');
  $text('#co-shipping-address',hasStreet?lines.join('\n'):
   status==='SHIPPED'||status==='COMPLETED'?'No delivery address is recorded for this order. Please contact WestTech.':'Address will appear when shipping details are confirmed.');
  $('#co-shipping-test-note').hidden=!isPreview;
  const tracking=String(order.trackingNumber||'').trim();
  const carrier=carrierTrackingPage(order.trackingCarrier);
  const shipped=['SHIPPED','COMPLETED'].includes(status);
  const details=tracking?(isPreview
   ?[order.trackingCarrier||'Carrier',tracking,'Preview test reference — not a real tracking number'].join(' · ')
   :[order.trackingCarrier||'Carrier',tracking].join(' · '))
   :carrier?carrier.name+' · Tracking number pending':'';
  const trackingPanel=$('#co-shipping-tracking');
  trackingPanel.hidden=!(tracking||(shipped&&carrier));
  $text('#co-shipping-tracking-detail',details);
  const directUrl=shipped?carrierTrackingUrl(order.trackingCarrier,tracking,isPreview):'';
  const url=shipped?(directUrl||carrier?.url||''):'';
  const link=$('#co-shipping-tracking-link');
  link.hidden=!url;
  if(url){
   link.href=url;
   link.textContent=directUrl?'Track shipment with '+carrier.name+' ↗':'Visit '+carrier.name+' tracking ↗';
  }else link.removeAttribute('href');
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
  const productionStage=type==='COASTER'&&['PRODUCTION_QUEUE','IN_PRODUCTION'].includes(status);
  $('#co-production-window').hidden=!productionStage;
  if(productionStage)$text('#co-production-window-value',String(order.productionWindow||'').trim()||'WestTech will confirm your production dates.');
  const timeline=$('#co-timeline');timeline.replaceChildren();
  const current=step(status);
  for(let i=0;i<stages.length;i++){
   const item=document.createElement('li');item.textContent=status==='REORDER_VERIFICATION'&&i===1?'Verify Reorder':stages[i];
   item.dataset.stage=current===null?'upcoming':current>i+1?'complete':current===i+1?'current':'upcoming';
   timeline.appendChild(item);
  }
  $text('#co-created',date(order.createdAt));$text('#co-updated',date(order.updatedAt));
  $text('#co-total',money(order.total));$text('#co-payment',order.paymentSimulated?'Preview Test Paid · No Charge':type==='COASTER'&&order.paymentRequired===true&&String(order.paymentStatus||'').toUpperCase()==='NOT_REQUESTED'&&['PROOF_APPROVED','AWAITING_PAYMENT'].includes(status)?'Required · Not yet initiated':String(order.paymentStatus||'').toUpperCase()==='PREVIEW_AWAITING_TEST_PAYMENT'?'Preview · Awaiting test payment':readable(order.paymentStatus));
  $text('#co-fulfillment',({'LOCAL_PICKUP':'Local Pickup','SHIP':'Ship Order','UNSET':'To Be Confirmed'})[fulfillment]||readable(fulfillment));
  $text('#co-pickup-heading',status==='COMPLETED'?'Your Pickup Details':'Arrange your pickup');
  $text('.customer-order-pickup-intro',status==='COMPLETED'?'Review your pickup appointment, directions, and calendar details. All times are Mountain Time.':'Choose an available appointment, suggest different times, or review your confirmed booking. All times are Mountain Time.');
  renderShipping(order);
  const detail=$('#co-delivery'),dtitle=$('#co-delivery-title'),dbody=$('#co-delivery-details');
  if(fulfillment==='LOCAL_PICKUP'&&['PREPARING_FOR_PICKUP','READY_FOR_PICKUP'].includes(status)){
   detail.hidden=false;dtitle.textContent='Local pickup';
   dbody.textContent='Review your pickup options below. After confirmation, your private pickup location, directions, and calendar links appear in your order details.';
  }else{detail.hidden=true;dbody.textContent='';}
  content.hidden=false;
  renderStageWorkspace(order,current);
  // Once payment has been recorded, retire the large proof/terms panel.
  // Approved proof data remains stored; the active dashboard focuses on production.
  const paymentRecorded=order.paymentSimulated===true||['PAID','CAPTURED','COMPLETED','NOT_REQUIRED'].includes(String(order.paymentStatus||'').toUpperCase());
  const proofStage=type==='COASTER'&&(['PROOF_SENT','CHANGES_REQUESTED'].includes(status)||
   (!paymentRecorded&&['PROOF_APPROVED','AWAITING_PAYMENT','PAYMENT_PENDING'].includes(status)));
  if(proofStage){
   // A full-size, reviewable proof takes priority while the customer decides.
   // After approval, show the saved image up in Latest Update instead.
   $('#co-design').hidden=true;
   renderCoasterApproval(order);
  }else{
   proofHost.hidden=true;
   renderCoasterDesign(order);
  }
  if(typeof window.wtPickupPortalInit==='function')window.wtPickupPortalInit(order);
  syncWorkspaceVisibility();
 }
 function renderCoasterDesign(order){
  const host=$('#co-design'),image=$('#co-design-image'),placeholder=$('#co-design-placeholder'),caption=$('#co-design-caption');
  if(!host||!image||!placeholder||!caption)return;
  host.hidden=String(order.sourceType||'').toUpperCase()!=='COASTER';
  if(host.hidden)return;
  image.hidden=false;image.style.visibility='hidden';image.removeAttribute('src');
  placeholder.hidden=false;placeholder.textContent='Loading your coaster design…';
  caption.textContent='Your current coaster artwork';
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
   proofHost.hidden=true;proofHost.classList.remove('customer-order-review-full','customer-order-approved-terms');activeProof=null;proofLoaded=false;
   if(String(order.sourceType||'').toUpperCase()!=='COASTER')return;
   try{
     const response=await fetch(proofUrl(),{credentials:'same-origin',headers:{Accept:'application/json'}});
     if(response.status===401){location.replace('login.html');return;}
     const data=await response.json().catch(()=>({}));
     if(!response.ok||!data.ok)throw new Error(data.message||'Proof details are unavailable.');
     const p=data.proof;
     if(!p?.hasProof||!['PROOF_SENT','CHANGES_REQUESTED','PROOF_APPROVED','AWAITING_PAYMENT','PAYMENT_PENDING'].includes(String(p.status||'').toUpperCase())){
       renderCoasterDesign(order);
       return;
     }
     activeProof=p;proofHost.hidden=false;proofHost.classList.toggle('customer-order-review-full',p.canRespond===true);
     const approved=p.proofStatus==='APPROVED'||['PROOF_APPROVED','AWAITING_PAYMENT'].includes(String(p.status||'').toUpperCase());
     proofHost.classList.toggle('customer-order-approved-terms',approved&&!p.canRespond);
     const changing=p.proofStatus==='CHANGES_REQUESTED';
     // The exact full-size proof remains in the review workflow. For approved
     // image proofs, show the saved artwork above and keep terms below.
     const topArtwork=approved&&!p.proofIsPdf;
     if(topArtwork)renderCoasterDesign(order);
     else $('#co-design').hidden=true;
     $('#co-proof-frame').hidden=topArtwork;
     proofFeedback('');$('#co-proof-confirm').checked=false;$('#co-proof-change').value='';
     proofText('#co-proof-version','Proof V'+p.proofVersion);
     proofText('#co-proof-title',p.canRespond?'Review your coaster proof':approved?'Approved proof & saved terms':changing?'Previous proof · changes requested':'Your saved proof');
     // Approved terms stay immediately visible while the customer awaits payment.
     $('#co-proof-terms-details').open=!!p.canRespond||approved;
     proofText('#co-proof-terms-label',p.canRespond?'Proof and order terms':'View saved proof and order terms');
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
     if(p.reviewExpired&&!p.canRespond&&p.proofStatus==='SENT'){
       proofText('#co-stage-title','The proof review window has expired');
       proofText('#co-stage-guidance','Contact WestTech to request a new approval link before production can continue.');
     }
     $('#co-proof-instructions').textContent=p.canRespond?'Please review the released proof and the order terms before approving or requesting changes.':approved?'This is the approved design saved with your order.':changing?'Your requested changes are recorded. This is the previous proof while WestTech prepares your revision.':'Your proof is saved with this order for reference.';
     const image=$('#co-proof-image'),pdf=$('#co-proof-pdf'),loader=$('#co-proof-loading'),open=$('#co-proof-open');
     image.onload=null;image.onerror=null;image.removeAttribute('src');pdf.removeAttribute('src');image.hidden=true;pdf.hidden=true;
     loader.hidden=false;loader.textContent='Loading WestTech proof…';
     const url=proofUrl()+'/proof';open.href=url;open.hidden=false;
     if(topArtwork){
       loader.hidden=true;proofLoaded=true;
     }else if(p.proofIsPdf){
       pdf.hidden=false;pdf.src=url;loader.hidden=true;proofLoaded=true;
     }else{
       image.onload=()=>{image.hidden=false;loader.hidden=true;proofLoaded=true;proofButtons();};
       image.onerror=()=>{image.hidden=true;loader.hidden=false;loader.textContent='We could not load the released proof. Please refresh or contact WestTech before approving.';proofLoaded=false;proofButtons();};
       image.src=url;
     }
     proofButtons();
     syncWorkspaceVisibility();
   }catch(error){
     // Show the original design if a saved proof is unavailable, without
     // claiming the original design is a substitute for approval.
     proofHost.hidden=true;
     renderCoasterDesign(order);
     const panel=$('#co-stage-panel');
     if(panel){
       panel.hidden=false;
       proofText('#co-stage-title','Proof details unavailable');
       proofText('#co-stage-guidance','The released proof could not be loaded. Refresh this page or contact WestTech before approving. '+(error.message||''));
     }
     syncWorkspaceVisibility();
   }
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
 // Pickup scheduler reveals itself asynchronously; don't hide its actions
 // just because they were not visible during the initial page render.
 const pickupSection=$('#co-pickup');
 if(pickupSection&&typeof MutationObserver!=='undefined'){
  new MutationObserver(syncWorkspaceVisibility).observe(pickupSection,{attributes:true,attributeFilter:['hidden']});
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
