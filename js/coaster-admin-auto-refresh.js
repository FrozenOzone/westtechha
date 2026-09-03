(function(){
  'use strict';
  if(location.protocol==='file:')return;

  let lastActivity=Date.now();
  let lastRefresh=0;
  let productionSelectTouched=false;
  let extendedRenderBusy=false;
  const WAITING_STATUSES=new Set(['PROOF_SENT','PROOF_APPROVED','AWAITING_PAYMENT']);
  const EXTENDED_STATUSES=new Set(['PRODUCTION_QUEUE','PREPARING_TO_SHIP','PREPARING_FOR_PICKUP']);
  const STANDARD_SHIPPING=['8.95','10.95','14.95'];

  const $=s=>document.querySelector(s);
  function statusCode(){return String($('#ca-status-pill')?.textContent||'').trim().toUpperCase().replaceAll(' ','_');}
  function editing(){const el=document.activeElement;return !!el&&/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);}
  function markActivity(){lastActivity=Date.now();}
  function fmtMoney(v){const n=Number(v||0);return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number.isFinite(n)?n:0);}
  function fmtDate(v){if(!v)return '';const d=new Date(v);return Number.isNaN(d.getTime())?String(v):d.toLocaleString();}
  function readable(v){return String(v||'').replaceAll('_',' ');}
  function token(){return sessionStorage.getItem('westtechha-admin-token')||'';}
  function orderId(){return String($('#ca-order-id')?.textContent||'').trim();}
  function authHeaders(extra={}){return {'Accept':'application/json','Authorization':`Bearer ${token()}`,...extra};}

  function suggestedShipping(setCount){
    const n=Math.max(1,Number.parseInt(setCount,10)||1);
    if(n===1)return '8.95';
    if(n===2)return '10.95';
    if(n===3||n===4)return '14.95';
    return '';
  }
  function normalizeMoneyValue(v){const n=Number(v);return Number.isFinite(n)?n.toFixed(2):'';}
  function syncShippingPreset(){
    const input=$('#ca-shipping'),select=$('#ca-shipping-preset');if(!input||!select)return;
    const value=normalizeMoneyValue(input.value);
    select.value=STANDARD_SHIPPING.includes(value)?value:'CUSTOM';
  }
  function applyShippingPreset(value){
    const input=$('#ca-shipping');if(!input||!value||value==='CUSTOM')return;
    input.value=value;
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.dispatchEvent(new Event('change',{bubbles:true}));
  }
  function ensureShippingPreset(){
    const input=$('#ca-shipping');if(!input)return null;
    let select=$('#ca-shipping-preset');
    if(!select){
      const field=input.closest('.ca-field');if(!field)return null;
      const label=field.querySelector('label[for="ca-shipping"]');if(label)label.textContent='Shipping amount';
      select=document.createElement('select');
      select.id='ca-shipping-preset';
      select.setAttribute('aria-label','Shipping rate preset');
      select.innerHTML='<option value="CUSTOM">Custom / Large Order</option><option value="8.95">1 set — $8.95</option><option value="10.95">2 sets — $10.95</option><option value="14.95">3–4 sets — $14.95</option>';
      const moneyWrap=input.parentElement;
      field.insertBefore(select,moneyWrap);
      const note=document.createElement('small');
      note.id='ca-shipping-preset-note';
      note.textContent='WestTech standard shipping presets. The dollar amount below stays editable for larger or unusual orders.';
      field.insertBefore(note,moneyWrap);
      select.addEventListener('change',()=>{if(select.value==='CUSTOM'){input.focus();return;}applyShippingPreset(select.value);});
      input.addEventListener('input',syncShippingPreset);
      input.addEventListener('change',syncShippingPreset);
      const count=$('#ca-set-count');
      if(count)count.addEventListener('change',()=>{
        const current=normalizeMoneyValue(input.value);
        if(!STANDARD_SHIPPING.includes(current))return;
        const next=suggestedShipping(count.value);
        if(next){select.value=next;applyShippingPreset(next);}else select.value='CUSTOM';
      });
    }
    syncShippingPreset();
    return select;
  }

  function insertOption(select,value,label,beforeValue=''){
    if(Array.from(select.options).some(o=>o.value===value))return;
    const option=document.createElement('option');option.value=value;option.textContent=label;
    const before=beforeValue?Array.from(select.options).find(o=>o.value===beforeValue):null;
    if(before)select.insertBefore(option,before);else select.appendChild(option);
  }
  function ensureProductionOptions(){
    const select=$('#ca-production-status');if(!select)return null;
    insertOption(select,'PRODUCTION_QUEUE','Production Queue','IN_PRODUCTION');
    insertOption(select,'PREPARING_TO_SHIP','Preparing to Ship','SHIPPED');
    insertOption(select,'PREPARING_FOR_PICKUP','Preparing for Pickup','READY_FOR_PICKUP');
    configureFulfillmentOptions(select);
    return select;
  }
  function fulfillmentIsPickup(){return String($('#ca-prod-fulfillment')?.textContent||'').trim().toUpperCase().includes('PICKUP');}
  function configureFulfillmentOptions(select=ensureProductionOptions()){
    if(!select)return;
    const pickup=fulfillmentIsPickup();
    Array.from(select.options).forEach(opt=>{
      if(opt.value==='PREPARING_FOR_PICKUP'||opt.value==='READY_FOR_PICKUP')opt.disabled=!pickup;
      if(opt.value==='PREPARING_TO_SHIP'||opt.value==='SHIPPED')opt.disabled=pickup;
    });
  }

  async function getOrder(){
    const id=orderId();if(!id||!token())return null;
    const r=await fetch(`/api/admin/coasters/orders/${encodeURIComponent(id)}`,{headers:authHeaders()});
    const data=await r.json().catch(()=>({}));
    if(!r.ok||!data.ok)throw new Error(data.message||'Could not refresh production work order.');
    return data.order||null;
  }

  function shippingAddress(order){const city=[order.shippingCity,order.shippingRegion,order.shippingPostalCode].filter(Boolean).join(' ');return [order.shippingAddress1,order.shippingAddress2,city].filter(Boolean).join(' • ');}
  function stageHelp(status,pickup){
    if(status==='PRODUCTION_QUEUE')return pickup?'Queued for production. Start manufacturing when you are ready; after production, move it to Preparing for Pickup.':'Queued for production. Start manufacturing when you are ready; after production, move it to Preparing to Ship.';
    if(status==='PREPARING_FOR_PICKUP')return 'Manufacturing is complete. Inspect, clean up, organize, and package the order before marking it Ready for Pickup.';
    if(status==='PREPARING_TO_SHIP')return 'Manufacturing is complete. Inspect, clean up, organize, and package the order before marking it Shipped.';
    return '';
  }

  function applyExtendedView(order){
    const currentStatus=String(order?.status||'').toUpperCase();
    if(!order||!EXTENDED_STATUSES.has(currentStatus))return;
    const select=ensureProductionOptions();
    if(select&&!productionSelectTouched)select.value=currentStatus;

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

    if($('#ca-production-lock-label'))$('#ca-production-lock-label').textContent=`${readable(currentStatus)} • TERMS LOCKED`;
    if($('#ca-prod-quantity'))$('#ca-prod-quantity').textContent=`${total} coaster${total===1?'':'s'}`;
    if($('#ca-prod-set-detail'))$('#ca-prod-set-detail').textContent=`${count} × ${size}-Coaster Set${count===1?'':'s'}`;
    if($('#ca-prod-fulfillment'))$('#ca-prod-fulfillment').textContent=pickup?'Local Pickup':'Ship Order';
    configureFulfillmentOptions(select);
    if($('#ca-prod-price'))$('#ca-prod-price').textContent=fmtMoney(order.finalAmount);
    if($('#ca-prod-payment'))$('#ca-prod-payment').textContent=payment;
    if($('#ca-prod-payment-detail'))$('#ca-prod-payment-detail').textContent=paid&&order.paypalPaidAt?`Paid ${fmtDate(order.paypalPaidAt)}`:'Approved and locked';
    if($('#ca-prod-proof'))$('#ca-prod-proof').textContent=proof;
    if($('#ca-prod-paypal'))$('#ca-prod-paypal').textContent=paypal;
    if($('#ca-prod-paypal-detail'))$('#ca-prod-paypal-detail').textContent=paid&&order.paypalPaidAt?`Paid ${fmtDate(order.paypalPaidAt)}`:'No-charge order';

    const delivery=$('#ca-production-delivery');
    const tracking=$('#ca-production-tracking');
    if(pickup){
      if($('#ca-prod-delivery-label'))$('#ca-prod-delivery-label').textContent='LOCAL PICKUP';
      if($('#ca-prod-delivery-primary'))$('#ca-prod-delivery-primary').textContent='No shipping address required';
      if($('#ca-prod-delivery-secondary'))$('#ca-prod-delivery-secondary').textContent=stageHelp(currentStatus,true);
      if(tracking)tracking.hidden=true;delivery?.classList.remove('missing');
    }else{
      const address=shippingAddress(order);
      if($('#ca-prod-delivery-label'))$('#ca-prod-delivery-label').textContent='SHIP TO';
      if($('#ca-prod-delivery-primary'))$('#ca-prod-delivery-primary').textContent=order.shippingName||order.customerName||'Customer';
      if($('#ca-prod-delivery-secondary'))$('#ca-prod-delivery-secondary').textContent=address?`${address} • ${stageHelp(currentStatus,false)}`:stageHelp(currentStatus,false)||'Shipping address is missing from this order.';
      if(tracking)tracking.hidden=false;delivery?.classList.toggle('missing',!address);
    }
    if($('#ca-tracking-carrier')&&document.activeElement!==$('#ca-tracking-carrier'))$('#ca-tracking-carrier').value=order.trackingCarrier||'';
    if($('#ca-tracking-number')&&document.activeElement!==$('#ca-tracking-number'))$('#ca-tracking-number').value=order.trackingNumber||'';
    if($('#ca-production-notes')&&document.activeElement!==$('#ca-production-notes'))$('#ca-production-notes').value=order.adminNotes||'';

    if($('#ca-proof-eyebrow'))$('#ca-proof-eyebrow').textContent='APPROVED ORDER TERMS';
    if($('#ca-proof-title'))$('#ca-proof-title').textContent='Proof + payment summary';
    if($('#ca-proof-status'))$('#ca-proof-status').textContent=`${readable(currentStatus)} • LOCKED`;
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
    if($('#ca-work-billable-note'))$('#ca-work-billable-note').textContent='Queue and production work stays in the log but cannot change the approved customer total.';
  }

  async function renderExtendedIfNeeded(){
    const code=statusCode();
    if(extendedRenderBusy||productionSelectTouched||!EXTENDED_STATUSES.has(code))return;
    const select=ensureProductionOptions();const card=$('#ca-production-card');
    if(card&&!card.hidden&&select?.value===code){configureFulfillmentOptions(select);return;}
    extendedRenderBusy=true;
    try{applyExtendedView(await getOrder());}catch(e){}finally{extendedRenderBusy=false;}
  }

  function shouldInterceptSave(){
    const current=statusCode();const selected=ensureProductionOptions()?.value||'';
    return EXTENDED_STATUSES.has(current)||EXTENDED_STATUSES.has(selected);
  }
  async function saveExtended(e){
    if(!shouldInterceptSave())return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation();
    const button=e.currentTarget;const original=button.textContent;button.disabled=true;button.textContent='Saving Production Update…';
    try{
      const select=ensureProductionOptions();const next=select?.value||statusCode();
      const payload={action:'saveReview',status:next,adminNotes:($('#ca-production-notes')?.value||'').trim(),trackingCarrier:($('#ca-tracking-carrier')?.value||'').trim(),trackingNumber:($('#ca-tracking-number')?.value||'').trim()};
      const r=await fetch(`/api/admin/coasters/orders/${encodeURIComponent(orderId())}`,{method:'POST',headers:authHeaders({'Content-Type':'application/json'}),body:JSON.stringify(payload)});
      const data=await r.json().catch(()=>({}));if(!r.ok||!data.ok)throw new Error(data.message||'Could not save production update.');
      productionSelectTouched=false;
      const reload=$('#ca-refresh');if(reload)reload.click();else location.reload();
    }catch(err){const msg=$('#ca-message');if(msg){msg.hidden=false;msg.textContent=err.message||'Could not save production update.';msg.className='ca-inline-message error';}}
    finally{button.disabled=false;button.textContent=original;}
  }

  function refreshIfWaiting(force=false){
    if(document.hidden||!WAITING_STATUSES.has(statusCode())||editing())return;
    const now=Date.now();if(!force&&now-lastActivity<8000)return;if(now-lastRefresh<8000)return;
    const button=$('#ca-refresh');if(!button||button.disabled)return;lastRefresh=now;button.click();
  }

  ensureShippingPreset();
  ensureProductionOptions();
  $('#ca-production-status')?.addEventListener('change',()=>{productionSelectTouched=true;configureFulfillmentOptions();});
  ['#ca-save','#ca-save-top'].forEach(sel=>$(sel)?.addEventListener('click',saveExtended,true));
  ['input','change','keydown','pointerdown'].forEach(type=>document.addEventListener(type,markActivity,{passive:true}));
  window.addEventListener('focus',()=>setTimeout(()=>{ensureShippingPreset();refreshIfWaiting(true);renderExtendedIfNeeded();configureFulfillmentOptions();},400));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(()=>{ensureShippingPreset();refreshIfWaiting(true);renderExtendedIfNeeded();configureFulfillmentOptions();},400);});
  const observer=new MutationObserver(()=>{ensureShippingPreset();ensureProductionOptions();if(EXTENDED_STATUSES.has(statusCode()))setTimeout(renderExtendedIfNeeded,50);else configureFulfillmentOptions();});
  if($('#ca-status-pill'))observer.observe($('#ca-status-pill'),{childList:true,characterData:true,subtree:true});
  setInterval(()=>{ensureShippingPreset();refreshIfWaiting(false);renderExtendedIfNeeded();configureFulfillmentOptions();},12000);
  setTimeout(()=>{ensureShippingPreset();renderExtendedIfNeeded();configureFulfillmentOptions();},300);
})();
