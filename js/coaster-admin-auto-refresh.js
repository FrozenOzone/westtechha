(function(){
  'use strict';
  if(location.protocol==='file:')return;

  let lastActivity=Date.now();
  let lastRefresh=0;
  let queueSelectTouched=false;
  let queueRenderBusy=false;
  const WAITING_STATUSES=new Set(['PROOF SENT','PROOF APPROVED','AWAITING PAYMENT']);

  const $=s=>document.querySelector(s);
  function status(){return String($('#ca-status-pill')?.textContent||'').trim().toUpperCase();}
  function editing(){const el=document.activeElement;return !!el&&/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);}
  function markActivity(){lastActivity=Date.now();}
  function fmtMoney(v){const n=Number(v||0);return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number.isFinite(n)?n:0);}
  function fmtDate(v){if(!v)return '';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString();}
  function readable(v){return String(v||'').replaceAll('_',' ');}
  function token(){return sessionStorage.getItem('westtechha-admin-token')||'';}
  function orderId(){return String($('#ca-order-id')?.textContent||'').trim();}
  function authHeaders(extra={}){return {'Accept':'application/json','Authorization':`Bearer ${token()}`,...extra};}

  function ensureQueueOption(){
    const select=$('#ca-production-status');
    if(!select)return null;
    if(!Array.from(select.options).some(o=>o.value==='PRODUCTION_QUEUE')){
      const option=document.createElement('option');option.value='PRODUCTION_QUEUE';option.textContent='Production Queue';select.insertBefore(option,select.firstChild);
    }
    return select;
  }

  async function getOrder(){
    const id=orderId();if(!id||!token())return null;
    const r=await fetch(`/api/admin/coasters/orders/${encodeURIComponent(id)}`,{headers:authHeaders()});
    const data=await r.json().catch(()=>({}));
    if(!r.ok||!data.ok)throw new Error(data.message||'Could not refresh production queue order.');
    return data.order||null;
  }

  function shippingAddress(order){
    const city=[order.shippingCity,order.shippingRegion,order.shippingPostalCode].filter(Boolean).join(' ');
    return [order.shippingAddress1,order.shippingAddress2,city].filter(Boolean).join(' • ');
  }

  function applyQueueView(order){
    if(!order||String(order.status||'').toUpperCase()!=='PRODUCTION_QUEUE')return;
    const select=ensureQueueOption();
    if(select&&!queueSelectTouched)select.value='PRODUCTION_QUEUE';

    $('#ca-detail')?.classList.add('ca-production-mode');
    if($('#ca-production-card'))$('#ca-production-card').hidden=false;
    if($('#ca-production-save-row'))$('#ca-production-save-row').hidden=false;
    if($('#ca-review-commercial'))$('#ca-review-commercial').hidden=true;
    if($('#ca-review-terms-row'))$('#ca-review-terms-row').hidden=true;

    const total=Math.max(1,Number(order.totalCoasters||order.setSize||4));
    const count=Math.max(1,Number(order.setCount||1));
    const size=Math.max(1,Number(order.setSize||4));
    const pickup=order.fulfillmentMethod==='LOCAL_PICKUP';
    const paid=String(order.paymentStatus||'').toUpperCase()==='PAID';
    const payment=paid?'PAID':'NO PAYMENT REQUIRED';
    const proof=`Proof v${Math.max(1,Number(order.proofVersion||1))} • ${readable(order.proofStatus||'APPROVED')}`;
    const paypal=order.paypalOrderId||order.paypalInvoiceId||(paid?'Payment captured':'No PayPal payment required');

    if($('#ca-production-lock-label'))$('#ca-production-lock-label').textContent='PRODUCTION QUEUE • TERMS LOCKED';
    if($('#ca-prod-quantity'))$('#ca-prod-quantity').textContent=`${total} coaster${total===1?'':'s'}`;
    if($('#ca-prod-set-detail'))$('#ca-prod-set-detail').textContent=`${count} × ${size}-Coaster Set${count===1?'':'s'}`;
    if($('#ca-prod-fulfillment'))$('#ca-prod-fulfillment').textContent=pickup?'Local Pickup':'Ship Order';
    if($('#ca-prod-price'))$('#ca-prod-price').textContent=fmtMoney(order.finalAmount);
    if($('#ca-prod-payment'))$('#ca-prod-payment').textContent=payment;
    if($('#ca-prod-payment-detail'))$('#ca-prod-payment-detail').textContent=paid&&order.paypalPaidAt?`Paid ${fmtDate(order.paypalPaidAt)}`:'Approved and queued';
    if($('#ca-prod-proof'))$('#ca-prod-proof').textContent=proof;
    if($('#ca-prod-paypal'))$('#ca-prod-paypal').textContent=paypal;
    if($('#ca-prod-paypal-detail'))$('#ca-prod-paypal-detail').textContent=paid&&order.paypalPaidAt?`Paid ${fmtDate(order.paypalPaidAt)}`:'No-charge order';

    const delivery=$('#ca-production-delivery');
    const tracking=$('#ca-production-tracking');
    if(pickup){
      if($('#ca-prod-delivery-label'))$('#ca-prod-delivery-label').textContent='LOCAL PICKUP';
      if($('#ca-prod-delivery-primary'))$('#ca-prod-delivery-primary').textContent='No shipping address required';
      if($('#ca-prod-delivery-secondary'))$('#ca-prod-delivery-secondary').textContent='Queued for production. Mark Ready for Pickup after manufacturing and packaging are complete.';
      if(tracking)tracking.hidden=true;
      delivery?.classList.remove('missing');
    }else{
      const address=shippingAddress(order);
      if($('#ca-prod-delivery-label'))$('#ca-prod-delivery-label').textContent='SHIP TO';
      if($('#ca-prod-delivery-primary'))$('#ca-prod-delivery-primary').textContent=order.shippingName||order.customerName||'Customer';
      if($('#ca-prod-delivery-secondary'))$('#ca-prod-delivery-secondary').textContent=address||'Shipping address is missing from this order.';
      if(tracking)tracking.hidden=false;
      delivery?.classList.toggle('missing',!address);
    }
    if($('#ca-tracking-carrier')&&document.activeElement!==$('#ca-tracking-carrier'))$('#ca-tracking-carrier').value=order.trackingCarrier||'';
    if($('#ca-tracking-number')&&document.activeElement!==$('#ca-tracking-number'))$('#ca-tracking-number').value=order.trackingNumber||'';
    if($('#ca-production-notes')&&document.activeElement!==$('#ca-production-notes'))$('#ca-production-notes').value=order.adminNotes||'';

    if($('#ca-proof-eyebrow'))$('#ca-proof-eyebrow').textContent='APPROVED ORDER TERMS';
    if($('#ca-proof-title'))$('#ca-proof-title').textContent='Proof + payment summary';
    if($('#ca-proof-status'))$('#ca-proof-status').textContent='PRODUCTION QUEUE • LOCKED';
    if($('#ca-production-lock-summary'))$('#ca-production-lock-summary').hidden=false;
    if($('#ca-lock-proof'))$('#ca-lock-proof').textContent=proof;
    if($('#ca-lock-payment'))$('#ca-lock-payment').textContent=payment;
    if($('#ca-lock-total'))$('#ca-lock-total').textContent=fmtMoney(order.finalAmount);
    if($('#ca-lock-invoice'))$('#ca-lock-invoice').textContent=paypal;
    const intro=document.querySelector('.ca-proof-intro');if(intro)intro.hidden=true;
    const source=document.querySelector('.ca-proof-source');if(source)source.hidden=true;
    const actions=document.querySelector('.ca-proof-actions');if(actions)actions.hidden=true;
    const proofPayment=document.querySelector('.ca-proof-payment');if(proofPayment)proofPayment.hidden=true;
    if($('#ca-proof-upload'))$('#ca-proof-upload').hidden=true;
    if($('#ca-approval-link'))$('#ca-approval-link').hidden=true;

    if($('#ca-save'))$('#ca-save').textContent='Save Production Update';
    if($('#ca-save-top'))$('#ca-save-top').textContent='Save Production Update';
    if($('#ca-work-billable')){$('#ca-work-billable').value='0.00';$('#ca-work-billable').disabled=true;}
    if($('#ca-work-billable-label'))$('#ca-work-billable-label').textContent='Customer charge (locked)';
    if($('#ca-work-billable-note'))$('#ca-work-billable-note').textContent='Queued/production work stays in the log but cannot change the approved customer total.';
  }

  async function renderQueueIfNeeded(){
    if(queueRenderBusy||status()!=='PRODUCTION QUEUE')return;
    queueRenderBusy=true;
    try{applyQueueView(await getOrder());}catch(e){}finally{queueRenderBusy=false;}
  }

  async function saveQueue(e){
    if(status()!=='PRODUCTION QUEUE')return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    const button=e.currentTarget;const original=button.textContent;button.disabled=true;button.textContent='Saving Production Update…';
    try{
      const select=ensureQueueOption();
      const next=select?.value||'PRODUCTION_QUEUE';
      const payload={action:'saveReview',status:next,adminNotes:($('#ca-production-notes')?.value||'').trim(),trackingCarrier:($('#ca-tracking-carrier')?.value||'').trim(),trackingNumber:($('#ca-tracking-number')?.value||'').trim()};
      const r=await fetch(`/api/admin/coasters/orders/${encodeURIComponent(orderId())}`,{method:'POST',headers:authHeaders({'Content-Type':'application/json'}),body:JSON.stringify(payload)});
      const data=await r.json().catch(()=>({}));if(!r.ok||!data.ok)throw new Error(data.message||'Could not save production update.');
      queueSelectTouched=false;
      const reload=$('#ca-refresh');if(reload)reload.click();else location.reload();
    }catch(err){
      const msg=$('#ca-message');if(msg){msg.hidden=false;msg.textContent=err.message||'Could not save production update.';msg.className='ca-inline-message error';}
    }finally{button.disabled=false;button.textContent=original;}
  }

  function refreshIfWaiting(force=false){
    if(document.hidden||!WAITING_STATUSES.has(status())||editing())return;
    const now=Date.now();
    if(!force&&now-lastActivity<8000)return;
    if(now-lastRefresh<8000)return;
    const button=$('#ca-refresh');if(!button||button.disabled)return;
    lastRefresh=now;button.click();
  }

  ensureQueueOption();
  $('#ca-production-status')?.addEventListener('change',()=>{queueSelectTouched=true;});
  ['#ca-save','#ca-save-top'].forEach(sel=>$(sel)?.addEventListener('click',saveQueue,true));
  ['input','change','keydown','pointerdown'].forEach(type=>document.addEventListener(type,markActivity,{passive:true}));
  window.addEventListener('focus',()=>setTimeout(()=>{refreshIfWaiting(true);renderQueueIfNeeded();},400));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(()=>{refreshIfWaiting(true);renderQueueIfNeeded();},400);});
  const observer=new MutationObserver(()=>{if(status()==='PRODUCTION QUEUE')setTimeout(renderQueueIfNeeded,50);});
  if($('#ca-status-pill'))observer.observe($('#ca-status-pill'),{childList:true,characterData:true,subtree:true});
  setInterval(()=>{refreshIfWaiting(false);renderQueueIfNeeded();},12000);
  setTimeout(renderQueueIfNeeded,300);
})();