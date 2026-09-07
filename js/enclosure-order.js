(function(){
  'use strict';
  const $=selector=>document.querySelector(selector);
  const MODELS={
    Scout:[{value:'scout',label:'Scout'}],
    Ranger:[{value:'ranger-relay',label:'Ranger Relay'},{value:'ranger-bucks',label:'Ranger Bucks'}],
    Command:[{value:'command-core',label:'Command Core'},{value:'command-gp',label:'Command-GP / Garage Panel'}]
  };
  const BASE_PRICES={
    'scout-30-unloaded':27.99,'scout-38-unloaded':27.99,'scout-30-loaded':42.99,'scout-38-loaded':42.99,
    'ranger-30-unloaded':29.99,'ranger-38-unloaded':29.99,'ranger-30-loaded':46.99,'ranger-38-loaded':46.99,
    'ranger-30-bucks-unloaded':29.99,'ranger-38-bucks-unloaded':29.99,'ranger-30-bucks-loaded':49.99,'ranger-38-bucks-loaded':49.99,
    'command-30-unloaded':32.99,'command-38-unloaded':34.99,'command-30-loaded':54.99,'command-38-loaded':59.99,
    'command-30-gp-unloaded':32.99,'command-38-gp-unloaded':34.99,'command-30-gp-loaded':54.99,'command-38-gp-loaded':59.99
  };
  const OPTIONAL_COMPONENTS={
    'oled-096':{componentSku:'oled-096',label:'0.96-inch OLED display',description:'Installed and wired for the selected enclosure layout.',unitAmount:8},
    lcd2004:{componentSku:'lcd2004',label:'LCD2004 display',description:'20×4 I²C display installed and wired for the selected Command layout.',unitAmount:15},
    dht11:{componentSku:'dht11',label:'DHT11 temperature and humidity sensor',description:'Installed and wired for temperature and humidity sensing.',unitAmount:5},
    buzzer:{componentSku:'buzzer',label:'Buzzer',description:'Installed and wired as an audible alert option.',unitAmount:3}
  };
  const MODEL_OPTIONS={scout:['buzzer'],'ranger-relay':['oled-096','buzzer'],'ranger-bucks':['oled-096','buzzer'],'command-core':['oled-096','lcd2004','dht11','buzzer'],'command-gp':['oled-096','lcd2004','dht11','buzzer']};
  const DISPLAY_COMPONENTS=['oled-096','lcd2004'];
  let componentSelections={},componentProfileKey='',displayCombinationAcknowledged=false,pendingDisplaySku='',displayReturnFocus=null;

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
  function bothDisplaysSelected(){return DISPLAY_COMPONENTS.every(sku=>componentSelections[sku]===true);}
  function closeDisplayModal(confirmed=false){
    const modal=$('#eo-display-modal');
    if(confirmed&&pendingDisplaySku){componentSelections[pendingDisplaySku]=true;displayCombinationAcknowledged=true;}
    modal.hidden=true;document.body.classList.remove('eo-modal-open');pendingDisplaySku='';
    const returnSku=displayReturnFocus?.name?.replace('component-','')||'';displayReturnFocus=null;refreshSummary();
    if(returnSku)setTimeout(()=>document.querySelector(`input[name="component-${returnSku}"][value="yes"]`)?.focus(),0);
  }
  function openDisplayModal(sku,input){
    const otherSku=DISPLAY_COMPONENTS.find(value=>value!==sku);
    pendingDisplaySku=sku;displayReturnFocus=input;
    $('#eo-display-existing').textContent=OPTIONAL_COMPONENTS[otherSku].label;
    $('#eo-display-additional').textContent=OPTIONAL_COMPONENTS[sku].label;
    $('#eo-display-ack').checked=false;$('#eo-display-confirm').disabled=true;
    $('#eo-display-modal').hidden=false;document.body.classList.add('eo-modal-open');
    setTimeout(()=>$('#eo-display-cancel').focus(),0);
  }

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

  function componentProfile(model,board){
    const required=[{componentSku:`esp32-${board}-kit`,label:`${board}-pin ESP32 + matching breakout board`,description:'Installed, wired, checked, and loaded with WestTech Quick Start firmware.',unitAmount:0,required:true,selected:true}];
    if(model==='ranger-relay')required.push({componentSku:'relay-module',label:'Relay module',description:'Installed and wired for the Ranger Relay path.',unitAmount:0,required:true,selected:true});
    if(model==='ranger-bucks')required.push({componentSku:'buck-converter',label:'Buck converter',description:'Installed and wired for the Ranger Bucks power path.',unitAmount:0,required:true,selected:true});
    if(model==='command-core'||model==='command-gp'){
      required.push({componentSku:'relay-module',label:'Relay module',description:'Installed and wired for the Command platform.',unitAmount:0,required:true,selected:true});
      required.push({componentSku:'buck-converter',label:'Buck converter',description:'Installed and wired for the Command power path.',unitAmount:0,required:true,selected:true});
    }
    const optional=(MODEL_OPTIONS[model]||[]).map(sku=>({...OPTIONAL_COMPONENTS[sku],required:false,selected:componentSelections[sku]===true}));
    return [...required,...optional];
  }
  function selectedOptionalSkus(){return Object.entries(componentSelections).filter(([,isSelected])=>isSelected).map(([sku])=>sku);}
  function renderLoadedComponents(model,board,offer){
    const panel=$('#eo-loaded-config'),summary=$('#eo-loaded-summary');
    if(offer!=='Loaded'){panel.hidden=true;summary.hidden=true;return [];}
    const profile=componentProfile(model,board),required=profile.filter(item=>item.required),optional=profile.filter(item=>!item.required);
    panel.hidden=false;summary.hidden=false;
    $('#eo-loaded-core').innerHTML=required.map(item=>`<div class="eo-component-row"><div class="eo-component-copy"><strong>${item.label}</strong><small>${item.description}</small></div><span class="eo-component-included">INCLUDED</span></div>`).join('');
    $('#eo-loaded-options-group').hidden=!optional.length;
    $('#eo-loaded-options').innerHTML=optional.map(item=>`<div class="eo-component-row"><div class="eo-component-copy"><strong>${item.label} • +${formatMoney(item.unitAmount)} each</strong><small>${item.description}</small></div><div class="eo-component-choice" role="radiogroup" aria-label="Add ${item.label}?"><label><input type="radio" name="component-${item.componentSku}" value="yes" ${item.selected?'checked':''}/><span>Yes</span></label><label><input type="radio" name="component-${item.componentSku}" value="no" ${item.selected?'':'checked'}/><span>No</span></label></div></div>`).join('');
    $('#eo-loaded-options').querySelectorAll('input[type="radio"]').forEach(input=>input.addEventListener('change',()=>{
      const sku=input.name.replace('component-',''),wantsComponent=input.value==='yes';
      if(wantsComponent&&DISPLAY_COMPONENTS.includes(sku)&&!componentSelections[sku]){
        const otherSku=DISPLAY_COMPONENTS.find(value=>value!==sku);
        if(componentSelections[otherSku]){document.querySelector(`input[name="component-${sku}"][value="no"]`).checked=true;openDisplayModal(sku,input);return;}
      }
      componentSelections[sku]=wantsComponent;
      if(DISPLAY_COMPONENTS.includes(sku)&&!wantsComponent)displayCombinationAcknowledged=false;
      refreshSummary();
    }));
    const dualDisplay=bothDisplaysSelected()&&displayCombinationAcknowledged;
    $('#eo-display-combination-status').hidden=!dualDisplay;
    $('#eo-loaded-summary-list').innerHTML=profile.filter(item=>item.selected).map(item=>`<li><span>${item.label}</span><strong>${item.required?'Included':`+${formatMoney(item.unitAmount)} each`}</strong></li>`).join('')+(dualDisplay?'<li class="eo-dual-display-summary"><span>Two-display selection</span><strong>Acknowledged</strong></li>':'');
    return profile;
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
    const profileKey=`${model}:${board}:${offer}`;
    if(profileKey!==componentProfileKey){componentProfileKey=profileKey;componentSelections={};displayCombinationAcknowledged=false;}
    const components=renderLoadedComponents(model,board,offer),optionUnit=components.filter(item=>!item.required&&item.selected).reduce((sum,item)=>sum+Number(item.unitAmount||0),0);
    const localTotal=(Number(BASE_PRICES[sku]||0)+optionUnit)*count;
    const request=++priceRequest;$('#eo-price-summary').textContent=localTotal?formatMoney(localTotal):'Loading…';
    try{
      const query=new URLSearchParams({quantity:String(count)}),selectedComponents=selectedOptionalSkus();if(selectedComponents.length)query.set('components',selectedComponents.join(','));
      const response=await fetch(`/api/products/${encodeURIComponent(sku)}?${query}`,{headers:{Accept:'application/json'}});
      const data=await response.json();
      if(request!==priceRequest)return;
      if(!response.ok||!data.ok)throw new Error(data.message||'Price unavailable');
      $('#eo-price-summary').textContent=formatMoney(data.product?.itemAmount);
    }catch(error){if(request===priceRequest&&!localTotal)$('#eo-price-summary').textContent='Confirmed during review';}
  }

  async function submit(event){
    event.preventDefault();setMessage('');
    const form=$('#eo-order-form');
    if(!form.reportValidity())return;
    if(!$('#eo-confirm').checked){setMessage('Check the confirmation box before sending your enclosure request.','error');$('#eo-confirm').focus();return;}
    const model=$('#eo-model').value,board=selected('board'),offer=selected('offer');
    const payload={
      sku:skuFor(model,board,offer),modelLabel:modelLabel(),color:$('#eo-color').value,quantity:quantity(),loadedComponentSkus:offer==='Loaded'?selectedOptionalSkus():[],displayCombinationAcknowledged:offer==='Loaded'&&bothDisplaysSelected()?displayCombinationAcknowledged:false,fulfillmentPreference:selected('fulfillment'),
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
  $('#eo-display-ack').addEventListener('change',()=>{$('#eo-display-confirm').disabled=!$('#eo-display-ack').checked;});
  $('#eo-display-cancel').addEventListener('click',()=>closeDisplayModal(false));
  $('#eo-display-confirm').addEventListener('click',()=>{if($('#eo-display-ack').checked)closeDisplayModal(true);});
  $('#eo-display-modal').addEventListener('click',event=>{if(event.target===$('#eo-display-modal'))closeDisplayModal(false);});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('#eo-display-modal').hidden)closeDisplayModal(false);});
  $('#eo-order-form').addEventListener('submit',submit);
  refreshSummary();
})();
