/* WestTech Customer Portal – Stage 3 Step 1. Read-only; existing session protects data. */
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
    case 'PROOF_SENT':return ['Your design is ready for review','Please use the private proof link WestTech sent you. Proof approval in the dashboard will be added in a later Stage 3 step.'];
    case 'PROOF_APPROVED':return ['Your proof was approved','WestTech is preparing the next step for your order.'];
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
   if(['PROOF_SENT','PROOF_APPROVED','AWAITING_PAYMENT','PAYMENT_PENDING','APPROVED'].includes(status))return 3;
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
  if(typeof window.wtPickupPortalInit==='function')window.wtPickupPortalInit(order);
 }
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
   render(order);
  }catch(e){message.textContent=e.message||'Could not load your order details.';message.classList.add('error');message.hidden=false;}
 }
 window.wtPortalPickupConfirmed=appointment=>{
  const info=$('#co-delivery'),title=$('#co-delivery-title'),body=$('#co-delivery-details');
  if(!info||!appointment)return;
  const when=new Date(appointment.localDate+'T12:00:00Z').toLocaleDateString('en-US',{timeZone:'UTC',weekday:'long',month:'short',day:'numeric',year:'numeric'});
  const [hour,min]=appointment.localTime.split(':').map(Number);
  info.hidden=false;title.textContent='Confirmed pickup appointment';
  body.textContent=`${when} at ${hour%12||12}:${String(min).padStart(2,'0')} ${hour>=12?'PM':'AM'} Mountain Time. Pickup address and calendar links are coming in a later Stage 3 step.`;
 };
 load();
})();
