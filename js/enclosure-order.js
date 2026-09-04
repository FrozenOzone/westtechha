(function(){
  'use strict';
  const $=selector=>document.querySelector(selector);
  const MODELS={
    Scout:[{value:'scout',label:'Scout'}],
    Ranger:[{value:'ranger-relay',label:'Ranger Relay'},{value:'ranger-bucks',label:'Ranger Bucks'}],
    Command:[{value:'command-core',label:'Command Core'},{value:'command-gp',label:'Command-GP / Garage Panel'}]
  };

  function selected(name){return document.querySelector(`input[name="${name}"]:checked`)?.value||'';}
  function quantity(){return Math.min(50,Math.max(1,Math.round(Number($('#eo-quantity').value||1))));}
  function skuFor(model,board,offer){
    const suffix=String(offer||'Unloaded').toLowerCase();
    if(model==='scout')return `scout-${board}-${suffix}`;
    if(model==='ranger-relay')return `ranger-${board}-${suffix}`;
    if(model==='ranger-bucks')return `ranger-${board}-bucks-${suffix}`;
    if(model==='command-core')return `command-${board}-${suffix}`;
    return `command-${board}-gp-${suffix}`;
  }
  function imageFor(model,board){
    const root='../images/products/';
    if(model==='scout')return `${root}scout/${board}/${board}-Scout-angled-side1-inserts-hero.jpg`;
    if(model==='ranger-relay')return `${root}ranger/relay/${board}/${board}-ranger-relay-angled-side1-inserts-hero.jpg`;
    if(model==='ranger-bucks')return `${root}ranger/bucks/${board}/${board}-ranger-bucks-angled-side1-inserts-hero.jpg`;
    if(model==='command-core')return `${root}command/standard/${board}/${board}-Command-angled-side1-inserts-hero.jpg`;
    return `${root}command/gp/${board}/${board}-Command-GP-angled-side1-inserts-hero.jpg`;
  }
  function modelLabel(){return $('#eo-model').selectedOptions[0]?.textContent||'Scout';}
  function formatMoney(value){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(value||0));}
  function setMessage(message,type=''){const box=$('#eo-message');box.hidden=!message;box.textContent=message;box.className=`eo-message ${type}`.trim();}

  function buildModelOptions(preferred=''){
    const family=$('#eo-family').value;
    const choices=MODELS[family]||MODELS.Scout;
    $('#eo-model').innerHTML=choices.map(item=>`<option value="${item.value}">${item.label}</option>`).join('');
    if(choices.some(item=>item.value===preferred))$('#eo-model').value=preferred;
  }

  function parseSku(value){
    const sku=String(value||'').toLowerCase();
    const offer=sku.endsWith('-loaded')?'Loaded':'Unloaded';
    const board=sku.includes('-38')?'38':'30';
    let family='Scout',model='scout';
    if(sku.startsWith('ranger-')){family='Ranger';model=sku.includes('-bucks-')?'ranger-bucks':'ranger-relay';}
    else if(sku.startsWith('command-')){family='Command';model=sku.includes('-gp-')?'command-gp':'command-core';}
    return {family,model,board,offer};
  }

  let priceRequest=0;
  async function refreshSummary(){
    const family=$('#eo-family').value,model=$('#eo-model').value,board=selected('board'),offer=selected('offer'),color=$('#eo-color').value,count=quantity();
    $('#eo-quantity').value=String(count);
    const sku=skuFor(model,board,offer);
    $('#eo-family-summary').textContent=`${family.toUpperCase()} FAMILY`;
    $('#eo-product-summary').textContent=`${modelLabel()} ${board} — ${offer}`;
    $('#eo-board-summary').textContent=`${board}-pin`;
    $('#eo-offer-summary').textContent=offer;
    $('#eo-color-summary').textContent=color;
    $('#eo-quantity-summary').textContent=String(count);
    const image=$('#eo-product-image');image.src=imageFor(model,board);image.alt=`${modelLabel()} ${board}-pin ${offer} enclosure`;
    const request=++priceRequest;$('#eo-price-summary').textContent='Loading…';
    try{
      const response=await fetch(`/api/products/${encodeURIComponent(sku)}?quantity=${count}`,{headers:{Accept:'application/json'}});
      const data=await response.json();
      if(request!==priceRequest)return;
      if(!response.ok||!data.ok)throw new Error(data.message||'Price unavailable');
      $('#eo-price-summary').textContent=formatMoney(data.product?.itemAmount);
    }catch(error){if(request===priceRequest)$('#eo-price-summary').textContent='Confirmed during review';}
  }

  async function submit(event){
    event.preventDefault();setMessage('');
    const form=$('#eo-order-form');
    if(!form.reportValidity())return;
    if(!$('#eo-confirm').checked){setMessage('Check the confirmation box before sending your enclosure request.','error');$('#eo-confirm').focus();return;}
    const model=$('#eo-model').value,board=selected('board'),offer=selected('offer');
    const payload={
      sku:skuFor(model,board,offer),modelLabel:modelLabel(),color:$('#eo-color').value,quantity:quantity(),fulfillmentPreference:selected('fulfillment'),
      customerName:$('#eo-name').value.trim(),customerEmail:$('#eo-email').value.trim(),customerPhone:$('#eo-phone').value.trim(),customerNotes:$('#eo-notes').value.trim(),website:$('#eo-website').value,requestConfirmed:true
    };
    const button=$('#eo-submit');button.disabled=true;button.textContent='Sending Request…';
    try{
      const response=await fetch('/api/enclosures/orders',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(payload)});
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data.ok)throw new Error(data.message||'Could not submit the enclosure request.');
      location.href=`request-received.html?order=${encodeURIComponent(data.orderId)}`;
    }catch(error){setMessage(error.message||'Could not submit the enclosure request.','error');button.disabled=false;button.innerHTML='Send to WestTech for Review <span aria-hidden="true">→</span>';}
  }

  const initial=parseSku(new URLSearchParams(location.search).get('sku'));
  $('#eo-family').value=initial.family;buildModelOptions(initial.model);$('#eo-model').value=initial.model;
  document.querySelector(`input[name="board"][value="${initial.board}"]`).checked=true;
  document.querySelector(`input[name="offer"][value="${initial.offer}"]`).checked=true;
  $('#eo-family').addEventListener('change',()=>{buildModelOptions();refreshSummary();});
  $('#eo-model').addEventListener('change',refreshSummary);
  const radioGroups=['board','offer','fulfillment'];
  radioGroups.forEach(name=>document.querySelectorAll(`input[name="${name}"]`).forEach(input=>input.addEventListener('change',refreshSummary)));
  ['eo-color','eo-quantity'].forEach(id=>$('#'+id).addEventListener('input',refreshSummary));
  $('#eo-order-form').addEventListener('submit',submit);
  refreshSummary();
})();
