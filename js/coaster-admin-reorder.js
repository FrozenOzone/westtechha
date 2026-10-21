/* Small, isolated Admin reorder verification panel. Never overrides standard proof workflow. */
(function(){'use strict';
 const $=s=>document.querySelector(s);let lastOrder='',busy=false,loadSeq=0;
 const auth=()=>sessionStorage.getItem('westtechha-admin-token')||'';
 async function api(url,body){const r=await fetch(url,{method:body?'POST':'GET',headers:{Accept:'application/json',Authorization:`Bearer ${auth()}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const x=await r.json().catch(()=>({}));if(!r.ok||!x.ok)throw new Error(x.message||'Could not verify reorder');return x;}
 function text(s){const el=$('#ca-message');if(el){el.hidden=false;el.className='ca-inline-message';el.textContent=s;}}
 const reorderStyles=()=>{
  if($('#ca-reorder-styles'))return;
  const style=document.createElement('style');style.id='ca-reorder-styles';style.textContent=`
  .ca-proof-card.wt-exact-reorder .ca-proof-intro,
  .ca-proof-card.wt-exact-reorder .ca-proof-source,
  .ca-proof-card.wt-exact-reorder .ca-proof-upload,
  .ca-proof-card.wt-exact-reorder .ca-proof-actions,
  .ca-proof-card.wt-exact-reorder .ca-approval-link{display:none!important}
  #ca-reorder-confirm{border:1px solid #356c98;border-radius:16px;background:#0c1e33;color:#f1f7ff;box-shadow:0 30px 90px rgba(0,0,0,.65);width:min(510px,calc(100vw - 30px));max-height:90vh;overflow:auto;padding:0}
  #ca-reorder-confirm::backdrop{background:rgba(1,9,19,.78)}
  #ca-reorder-confirm .wt-verify-body{padding:clamp(18px,3vw,26px);font:inherit}
  #ca-reorder-confirm .wt-verify-eyebrow{font-size:11px;letter-spacing:.13em;font-weight:800;color:#8bcafa}
  #ca-reorder-confirm h2{font-size:clamp(21px,2.2vw,27px);margin:9px 0;color:#f1f7ff}
  #ca-reorder-confirm p{line-height:1.5;color:#c5d6e8}
  #ca-reorder-confirm dl{padding:10px 15px;border-radius:11px;border:1px solid #254463;background:#08192d;margin:18px 0}
  #ca-reorder-confirm dl div{display:flex;justify-content:space-between;gap:12px;padding:9px 0}
  #ca-reorder-confirm dl div+div{border-top:1px solid #254463}
  #ca-reorder-confirm dt{color:#aac3d9}#ca-reorder-confirm dd{margin:0;font-weight:750;text-align:right;overflow-wrap:anywhere}
  #ca-reorder-confirm .wt-verify-info{border-left:3px solid #1677c4;padding-left:12px;font-size:13px}
  #ca-reorder-confirm .wt-verify-error{border:1px solid #ee897d;color:#ffd1ca;background:rgba(150,45,35,.12);padding:10px;border-radius:8px}
  #ca-reorder-confirm .wt-verify-actions{display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;margin-top:18px}
  #ca-reorder-confirm button{border-radius:9px;padding:11px 16px;font-weight:750;cursor:pointer;border:1px solid #417ba9;color:#fff;background:#102942}
  #ca-reorder-confirm button.wt-verify-release{background:#1677c4;border-color:#1677c4}
  #ca-reorder-confirm button:disabled{opacity:.6;cursor:wait}
  #ca-reorder-confirm button:focus-visible{outline:3px solid #ffc85e;outline-offset:3px}
  .wt-date-window.wt-reorder-date-required{outline:2px solid #ed897b;outline-offset:5px;border-radius:8px}
  #ca-reorder-date-warning{color:#ffd2c9;background:rgba(168,57,45,.17);border:1px solid #df8276;border-radius:8px;padding:10px 12px;font-size:13px;line-height:1.45;margin:10px 0 0}
  #ca-printer-minutes.wt-reorder-minutes-required{outline:2px solid #ed897b;outline-offset:3px}`;
  document.head.appendChild(style);
 };
 function remove(){
  clearScheduleWarning();
  $('#ca-reorder-panel')?.remove();$('#ca-reorder-tag')?.remove();
  const proof=$('.ca-proof-card');proof?.classList.remove('wt-exact-reorder');
  const dialog=$('#ca-reorder-confirm');if(dialog?.open)dialog.close();dialog?.remove();
 }
 function number(n){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));}
 function savedWindow(x){return String(x?.order?.productionWindow||'').trim()||'Not saved';}
 // Keep draft saving available, but do not open payment release confirmation
 // until the date window has been saved and matches the Admin fields.
 function clearScheduleWarning(){
  $('.wt-date-window')?.classList.remove('wt-reorder-date-required');
  $('#ca-printer-minutes')?.classList.remove('wt-reorder-minutes-required');
  $('#ca-reorder-date-warning')?.remove();
 }
 function guideSchedule(message,fieldSelector='#ca-production-window-start'){
  clearScheduleWarning();
  const field=$(fieldSelector)||$('#ca-production-window-start');
  if(!field){text(message);return;}
  const wrapper=field.closest('.wt-date-window')||field.closest('.ca-field')||field.parentElement;
  if(fieldSelector==='#ca-printer-minutes')field.classList.add('wt-reorder-minutes-required');
  else wrapper?.classList.add('wt-reorder-date-required');
  const warning=document.createElement('p');warning.id='ca-reorder-date-warning';warning.setAttribute('role','alert');warning.textContent=message;
  if(wrapper){wrapper.appendChild(warning);wrapper.scrollIntoView({behavior:'smooth',block:'center'});}
  field.focus({preventScroll:true});
 }
 function scheduleReady(info){
  const saved=String(info?.order?.productionWindow||'').trim();
  const fields=window.WestTechProductionFields;
  const parsed=fields?.parseWindow(saved);
  if(!saved||!parsed?.start){
   guideSchedule('Enter an estimated production start date (end date is optional), click Save Order Review, then Verify Reorder & Release to Payment.');
   return false;
  }
  const visible=fields?.getWindow('#ca-production-window')||String($('#ca-production-window')?.value||'').trim();
  if(visible!==saved){
   guideSchedule('These production dates have not been saved. Click Save Order Review, then return to Verify Reorder & Release to Payment.');
   return false;
  }
  const minutes=Number(info?.order?.estimatedPrinterMinutes||0);
  if(!Number.isFinite(minutes)||minutes<=0){
   guideSchedule('Enter the estimated printer minutes and click Save Order Review before releasing the reorder.','#ca-printer-minutes');
   return false;
  }
  clearScheduleWarning();return true;
 }
 function addRow(list,label,value){const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;row.append(dt,dd);list.appendChild(row);}
 function openConfirm(info,btn){
  const previous=$('#ca-reorder-confirm');if(previous)previous.remove();
  const d=document.createElement('dialog');d.id='ca-reorder-confirm';d.setAttribute('aria-labelledby','ca-reorder-confirm-title');
  const body=document.createElement('div');body.className='wt-verify-body';
  const eyebrow=document.createElement('div');eyebrow.className='wt-verify-eyebrow';eyebrow.textContent='WESTTECH · REORDER VERIFICATION';
  const heading=document.createElement('h2');heading.id='ca-reorder-confirm-title';heading.textContent='Verify & Release Reorder';
  const intro=document.createElement('p');intro.textContent='This repeats previously approved artwork. Please confirm the saved current price, quantity and production window before releasing to payment.';
  const dl=document.createElement('dl');addRow(dl,'Original order',info.sourceOrderId);addRow(dl,'New reorder',info.order.orderId);
  addRow(dl,'Quantity',`${Math.max(1,Number(info.order.setCount||1))} set(s) · ${Number(info.order.totalCoasters||0)} coasters`);
  addRow(dl,'Delivery',info.order.fulfillmentMethod==='SHIP'?'Ship Order':info.order.fulfillmentMethod==='LOCAL_PICKUP'?'Local Pickup':'Not selected');
  addRow(dl,'Current total',number(info.order.finalAmount));addRow(dl,'Production window',savedWindow(info));
  const note=document.createElement('p');note.className='wt-verify-info';note.textContent='No second proof approval. Any Admin edits must be saved before release. This confirmation uses the current saved order values.';
  const error=document.createElement('p');error.className='wt-verify-error';error.hidden=true;error.setAttribute('role','alert');
  const actions=document.createElement('div');actions.className='wt-verify-actions';
  const cancel=document.createElement('button');cancel.type='button';cancel.textContent='Cancel';
  const release=document.createElement('button');release.type='button';release.className='wt-verify-release';release.textContent='Confirm & Release to Payment';
  actions.append(cancel,release);body.append(eyebrow,heading,intro,dl,note,error,actions);d.appendChild(body);document.body.appendChild(d);
  const dismiss=()=>{if(busy)return;d.close();d.remove();btn.focus();};cancel.addEventListener('click',dismiss);
  d.addEventListener('cancel',e=>{if(busy)e.preventDefault();});
  d.addEventListener('click',e=>{if(e.target===d)dismiss();});
  release.addEventListener('click',async()=>{
   if(busy)return;
   busy=true;release.disabled=true;cancel.disabled=true;release.textContent='Verifying…';
   try{
    const id=String($('#ca-order-id')?.textContent||'').trim();if(id!==info.order.orderId)throw new Error('The selected order changed. Reopen verification.');
    const result=await api(`/api/admin/coasters/orders/${encodeURIComponent(id)}/reorder`,{action:'verifyForPayment',confirmed:true});
    d.close();d.remove();text(result.order.paymentRequired?'Reorder verified. Awaiting Preview test payment — no new customer proof required.':'Reorder verified; no payment required. Sent to Production Queue.');
    $('#ca-refresh')?.click();
   }catch(e){error.textContent=e.message||'Could not verify reorder.';error.hidden=false;release.disabled=false;cancel.disabled=false;release.textContent='Confirm & Release to Payment';}
   finally{busy=false;}
  });
  d.showModal();cancel.focus();
 }
 function render(info){remove();if(!info.sourceOrderId)return;
  reorderStyles();
  const proof=$('.ca-proof-card');proof?.classList.add('wt-exact-reorder');
  if(proof&&['REORDER_VERIFICATION','DESIGN_REVIEW','PROOF_APPROVED','AWAITING_PAYMENT'].includes(String(info.order.status||'').toUpperCase())){
   const eyebrow=$('#ca-proof-eyebrow'),title=$('#ca-proof-title');
   if(eyebrow)eyebrow.textContent='EXACT REORDER · PREVIOUSLY APPROVED ARTWORK';
   if(title)title.textContent=info.canVerify?'No additional proof approval needed':'Verified artwork · payment next';
  }
  const pill=$('#ca-status-pill');if(pill){const tag=document.createElement('span');tag.id='ca-reorder-tag';tag.textContent='REORDER';tag.style.cssText='display:inline-block;margin-left:10px;border:1px solid #4a9bd4;padding:4px 9px;border-radius:999px;color:#91cfff;font-size:11px;font-weight:800';pill.after(tag);}
  if(!info.canVerify)return;
  if(!proof)return;
  const box=document.createElement('section');box.id='ca-reorder-panel';box.style.cssText='border:1px solid #1677C4;border-radius:12px;padding:16px;margin-bottom:15px;background:rgba(22,119,196,.09)';
  const h=document.createElement('h3');h.textContent='Verify Repeat Order — No New Customer Proof';h.style.margin='0 0 9px';box.appendChild(h);
  const p=document.createElement('p');p.textContent=`Reordered from ${info.sourceOrderId}. Original approved proof V${info.original?.proofVersion||'?'}; original total ${number(info.original?.finalAmount)}. Check this order's current price, quantity, shipping/pickup and production window above. Save changes before verifying.`;box.appendChild(p);
  const btn=document.createElement('button');btn.type='button';btn.textContent='Verify Reorder & Release to Payment';btn.className='ca-secondary';btn.style.marginTop='8px';box.appendChild(btn);
  const hint=document.createElement('p');hint.textContent='PREVIEW TEST: This skips repeat proof approval. Payment is simulated from Admin later; no PayPal charge.';hint.style.fontSize='12px';box.appendChild(hint);
  btn.addEventListener('click',async()=>{
   if(busy)return;const id=String($('#ca-order-id')?.textContent||'').trim();if(id!==info.order.orderId)return;
   btn.disabled=true;
   try{
    // Refresh before confirmation: use the latest SAVED terms, not a stale page snapshot.
    const latest=await api(`/api/admin/coasters/orders/${encodeURIComponent(id)}/reorder`);
    if(String($('#ca-order-id')?.textContent||'').trim()!==id||!latest.canVerify||latest.sourceOrderId!==info.sourceOrderId)throw new Error('This reorder changed. Reload it before verifying.');
    if(!scheduleReady(latest))return;
    openConfirm(latest,btn);
   }catch(e){text(e.message||'Could not load current reorder terms.');}
   finally{btn.disabled=false;}
  });
  proof.parentNode.insertBefore(box,proof);
 }
 async function refresh(){const id=String($('#ca-order-id')?.textContent||'').trim();if(!id||!auth())return;if($('#ca-reorder-confirm')?.open&&id===lastOrder)return;if(id===lastOrder)return;lastOrder=id;const seq=++loadSeq;
  try{const x=await api(`/api/admin/coasters/orders/${encodeURIComponent(id)}/reorder`);if(seq!==loadSeq)return;render(x);}catch{if(seq===loadSeq){lastOrder='';remove();}}
 }
 const elem=$('#ca-order-id');if(elem)new MutationObserver(()=>{lastOrder='';refresh()}).observe(elem,{childList:true,characterData:true,subtree:true});
 $('#ca-refresh')?.addEventListener('click',()=>{lastOrder='';setTimeout(refresh,400)});
 window.addEventListener('focus',()=>{lastOrder='';refresh()});
 setInterval(refresh,6000);setTimeout(refresh,700);
})();
