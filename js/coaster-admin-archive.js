(function(){
  'use strict';
  if(location.protocol==='file:')return;
  const $=s=>document.querySelector(s);
  const money=v=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(v||0));
  const readable=v=>String(v||'').replaceAll('_',' ');
  const normalize=v=>String(v||'').trim().toUpperCase().replaceAll(' ','_');
  const token=()=>sessionStorage.getItem('westtechha-admin-token')||'';
  const orderId=()=>String($('#ca-order-id')?.textContent||'').trim();
  const statusCode=()=>normalize($('#ca-status-pill')?.textContent||'');
  const FILTER_KEY='westtechha-coaster-order-filter';

  function authHeaders(extra={}){return {'Accept':'application/json','Authorization':`Bearer ${token()}`,...extra};}
  async function getOrder(){
    const id=orderId();if(!id||!token())return null;
    const r=await fetch(`/api/admin/coasters/orders/${encodeURIComponent(id)}`,{headers:authHeaders()});
    const data=await r.json().catch(()=>({}));
    if(!r.ok||!data.ok)throw new Error(data.message||'Could not load order.');
    return data.order||null;
  }
  async function orderAction(action){
    const id=orderId();if(!id)throw new Error('No order selected.');
    const r=await fetch(`/api/admin/coasters/orders/${encodeURIComponent(id)}`,{method:'POST',headers:authHeaders({'Content-Type':'application/json'}),body:JSON.stringify({action})});
    const data=await r.json().catch(()=>({}));
    if(!r.ok||!data.ok)throw new Error(data.message||'Could not update order.');
    return data.order;
  }

  function ensureStyle(){
    if($('#ca-archive-style'))return;
    const style=document.createElement('style');style.id='ca-archive-style';style.textContent=`
      .ca-order-filter{margin-bottom:12px}
      .ca-archive-panel{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-top:14px;padding:14px 16px;border:1px solid rgba(148,163,184,.16);border-radius:14px;background:#0a1727}
      .ca-archive-panel[hidden]{display:none!important}.ca-archive-copy{display:grid;gap:3px}.ca-archive-copy strong{color:#fff;font-size:.75rem}.ca-archive-copy span{color:#7f95ad;font-size:.62rem;line-height:1.45}
      .ca-archive-badge{display:inline-flex;align-items:center;padding:7px 10px;border-radius:999px;border:1px solid #4a617a;background:#101c2b;color:#b8c8d9;font-size:.59rem;font-weight:950;letter-spacing:.07em}
      .ca-order-item[hidden]{display:none!important}
      @media(max-width:760px){.ca-archive-panel{align-items:stretch;flex-direction:column}.ca-archive-panel button{width:100%}}
    `;document.head.appendChild(style);
  }

  function ensureFilter(){
    let select=$('#ca-order-filter');if(select)return select;
    const search=$('#ca-search');if(!search)return null;
    select=document.createElement('select');select.id='ca-order-filter';select.className='ca-search ca-order-filter';
    select.innerHTML='<option value="ACTIVE">Active Orders</option><option value="COMPLETED">Completed</option><option value="ARCHIVED">Archived</option><option value="ALL">All Orders</option>';
    select.value=sessionStorage.getItem(FILTER_KEY)||'ACTIVE';
    search.insertAdjacentElement('afterend',select);
    select.addEventListener('change',()=>{sessionStorage.setItem(FILTER_KEY,select.value);applyFilter();});
    return select;
  }
  function itemStatus(button){return normalize(button.querySelector('small')?.textContent||'');}
  function filterMatch(status,filter){
    if(filter==='ALL')return true;
    if(filter==='COMPLETED')return status==='COMPLETED';
    if(filter==='ARCHIVED')return status==='ARCHIVED';
    return status!=='COMPLETED'&&status!=='ARCHIVED';
  }
  function applyFilter(){
    const select=ensureFilter();const list=$('#ca-order-list');if(!select||!list)return;
    const buttons=Array.from(list.querySelectorAll('.ca-order-item'));let visible=0;
    buttons.forEach(button=>{const show=filterMatch(itemStatus(button),select.value);button.hidden=!show;if(show)visible++;});
    const count=$('#ca-count');if(count)count.textContent=`${visible} order${visible===1?'':'s'}`;
    const old=list.querySelector('.ca-filter-empty');if(old)old.remove();
    if(buttons.length&&!visible){const empty=document.createElement('div');empty.className='ca-empty ca-filter-empty';empty.textContent=select.value==='ARCHIVED'?'No archived coaster orders.':select.value==='COMPLETED'?'No completed coaster orders.':'No orders in this view.';list.appendChild(empty);}
  }

  function ensureArchivePanel(){
    let panel=$('#ca-archive-panel');if(panel)return panel;
    const saveRow=$('#ca-production-save-row');if(!saveRow)return null;
    panel=document.createElement('div');panel.id='ca-archive-panel';panel.className='ca-archive-panel';panel.hidden=true;
    panel.innerHTML='<div class="ca-archive-copy"><strong id="ca-archive-title">Completed order</strong><span id="ca-archive-help">Archive finished orders to remove them from the active working list while keeping the full record.</span></div><div><span class="ca-archive-badge" id="ca-archive-badge" hidden>ARCHIVED</span> <button class="ca-secondary" id="ca-archive-button" type="button">Archive Order</button></div>';
    saveRow.insertAdjacentElement('afterend',panel);
    $('#ca-archive-button').addEventListener('click',handleArchiveButton);
    return panel;
  }

  function setArchiveLocked(lock){
    const selectors=['#ca-production-status','#ca-tracking-carrier','#ca-tracking-number','#ca-production-notes','#ca-work-type','#ca-work-minutes','#ca-work-billable','#ca-work-note','#ca-add-work'];
    selectors.forEach(sel=>{const el=$(sel);if(!el)return;if(lock){if(!el.disabled)el.dataset.archiveLocked='1';el.disabled=true;}else if(el.dataset.archiveLocked==='1'){el.disabled=false;delete el.dataset.archiveLocked;}});
    ['#ca-save-top','#ca-save'].forEach(sel=>{const el=$(sel);if(!el)return;if(lock){if(!el.hidden)el.dataset.archiveHidden='1';el.hidden=true;}else if(el.dataset.archiveHidden==='1'){el.hidden=false;delete el.dataset.archiveHidden;}});
  }

  function shippingAddress(order){const city=[order.shippingCity,order.shippingRegion,order.shippingPostalCode].filter(Boolean).join(' ');return [order.shippingAddress1,order.shippingAddress2,city].filter(Boolean).join(' • ');}
  function ensureArchivedStatusOption(){const select=$('#ca-production-status');if(!select)return;let option=Array.from(select.options).find(o=>o.value==='ARCHIVED');if(!option){option=document.createElement('option');option.value='ARCHIVED';option.textContent='Archived';select.appendChild(option);}select.value='ARCHIVED';}
  async function renderArchivedRecord(){
    if(statusCode()!=='ARCHIVED')return;
    let order;try{order=await getOrder();}catch(e){return;}if(!order||normalize(order.status)!=='ARCHIVED')return;
    $('#ca-detail')?.classList.add('ca-production-mode');
    const card=$('#ca-production-card');if(card)card.hidden=false;
    const commercial=$('#ca-review-commercial');if(commercial)commercial.hidden=true;
    const review=$('#ca-review-terms-row');if(review)review.hidden=true;
    const saveRow=$('#ca-production-save-row');if(saveRow)saveRow.hidden=true;
    ensureArchivedStatusOption();
    const count=Math.max(1,Number(order.setCount||1)),size=Math.max(1,Number(order.setSize||4)),total=Math.max(1,Number(order.totalCoasters||count*size));
    if($('#ca-production-lock-label'))$('#ca-production-lock-label').textContent='ARCHIVED • RECORD RETAINED';
    if($('#ca-prod-quantity'))$('#ca-prod-quantity').textContent=`${total} coaster${total===1?'':'s'}`;
    if($('#ca-prod-set-detail'))$('#ca-prod-set-detail').textContent=`${count} × ${size}-Coaster Set${count===1?'':'s'}`;
    if($('#ca-prod-fulfillment'))$('#ca-prod-fulfillment').textContent=order.fulfillmentMethod==='LOCAL_PICKUP'?'Local Pickup':'Ship Order';
    if($('#ca-prod-price'))$('#ca-prod-price').textContent=money(order.finalAmount);
    if($('#ca-prod-payment'))$('#ca-prod-payment').textContent=normalize(order.paymentStatus)==='PAID'?'PAID':(order.paymentRequired?'PAYMENT RECORDED':'NO PAYMENT REQUIRED');
    if($('#ca-prod-payment-detail'))$('#ca-prod-payment-detail').textContent=order.paypalPaidAt?`Paid ${new Date(order.paypalPaidAt).toLocaleString()}`:'Completed order record';
    if($('#ca-prod-proof'))$('#ca-prod-proof').textContent=`Proof v${Math.max(1,Number(order.proofVersion||1))} • ${readable(order.proofStatus||'APPROVED')}`;
    if($('#ca-prod-paypal'))$('#ca-prod-paypal').textContent=order.paypalOrderId||order.paypalInvoiceId||order.paypalCaptureId||'No PayPal payment reference';
    if($('#ca-prod-paypal-detail'))$('#ca-prod-paypal-detail').textContent='Retained with archived order';
    if(order.fulfillmentMethod==='LOCAL_PICKUP'){
      if($('#ca-prod-delivery-label'))$('#ca-prod-delivery-label').textContent='LOCAL PICKUP';
      if($('#ca-prod-delivery-primary'))$('#ca-prod-delivery-primary').textContent='Completed pickup order';
      if($('#ca-prod-delivery-secondary'))$('#ca-prod-delivery-secondary').textContent=order.pickupReadyAt?`Ready for pickup ${new Date(order.pickupReadyAt).toLocaleString()}`:'Completed order';
      if($('#ca-production-tracking'))$('#ca-production-tracking').hidden=true;
    }else{
      if($('#ca-prod-delivery-label'))$('#ca-prod-delivery-label').textContent='SHIP TO';
      if($('#ca-prod-delivery-primary'))$('#ca-prod-delivery-primary').textContent=order.shippingName||order.customerName||'Customer';
      if($('#ca-prod-delivery-secondary'))$('#ca-prod-delivery-secondary').textContent=shippingAddress(order)||'Shipping address retained with order';
      if($('#ca-production-tracking'))$('#ca-production-tracking').hidden=false;
    }
    const carrier=$('#ca-tracking-carrier');if(carrier)carrier.value=order.trackingCarrier||'';
    const tracking=$('#ca-tracking-number');if(tracking)tracking.value=order.trackingNumber||'';
    const notes=$('#ca-production-notes');if(notes)notes.value=order.adminNotes||'';
    if($('#ca-proof-eyebrow'))$('#ca-proof-eyebrow').textContent='ARCHIVED ORDER RECORD';
    if($('#ca-proof-title'))$('#ca-proof-title').textContent='Proof + payment summary';
    if($('#ca-proof-status'))$('#ca-proof-status').textContent='ARCHIVED • LOCKED';
  }

  function updateArchiveUi(){
    ensureStyle();ensureFilter();ensureArchivePanel();applyFilter();
    const status=statusCode(),panel=$('#ca-archive-panel'),button=$('#ca-archive-button'),badge=$('#ca-archive-badge'),title=$('#ca-archive-title'),help=$('#ca-archive-help');
    const finished=status==='COMPLETED'||status==='ARCHIVED';
    setArchiveLocked(finished);
    if(!panel||!button)return;
    panel.hidden=!finished;
    if(status==='COMPLETED'){
      badge.hidden=true;button.hidden=false;button.textContent='Archive Order';button.dataset.action='archive';
      title.textContent='Completed order';help.textContent='Archive this finished order to remove it from Active while keeping the complete customer, payment, artwork, tracking, work-log, and event record.';
    }else if(status==='ARCHIVED'){
      badge.hidden=false;button.hidden=false;button.textContent='Restore to Completed';button.dataset.action='restoreArchive';
      title.textContent='Archived order';help.textContent='This record is retained and hidden from Active orders. Restore it if you need to work with the completed order again.';
      renderArchivedRecord();
    }else{button.dataset.action='';}
  }

  async function handleArchiveButton(){
    const button=$('#ca-archive-button'),action=button?.dataset.action;if(!button||!action)return;
    const id=orderId();const archiving=action==='archive';
    const ok=window.confirm(archiving?`Archive ${id}?\n\nThe complete order record will be retained. No customer email will be sent.`:`Restore ${id} to Completed?\n\nNo customer email will be sent.`);if(!ok)return;
    const original=button.textContent;button.disabled=true;button.textContent=archiving?'Archiving…':'Restoring…';
    try{await orderAction(action);sessionStorage.setItem(FILTER_KEY,archiving?'ARCHIVED':'COMPLETED');location.reload();}
    catch(err){button.disabled=false;button.textContent=original;const msg=$('#ca-message');if(msg){msg.hidden=false;msg.textContent=err.message||'Could not update archive state.';msg.className='ca-inline-message error';}}
  }

  const listObserver=new MutationObserver(()=>setTimeout(applyFilter,0));
  const statusObserver=new MutationObserver(()=>setTimeout(updateArchiveUi,0));
  function start(){ensureStyle();ensureFilter();ensureArchivePanel();applyFilter();updateArchiveUi();const list=$('#ca-order-list');if(list)listObserver.observe(list,{childList:true,subtree:true});const pill=$('#ca-status-pill');if(pill)statusObserver.observe(pill,{childList:true,characterData:true,subtree:true});setInterval(()=>{applyFilter();updateArchiveUi();},2500);}
  setTimeout(start,350);
})();
