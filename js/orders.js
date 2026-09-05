(function(){
  'use strict';
  const $=selector=>document.querySelector(selector);
  let token=sessionStorage.getItem('westtechha-admin-token')||'';
  let orders=[];
  let manufacturing={orders:[],summary:{}};
  let selectedKey='';
  const imageUrls=new Map();

  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const readable=value=>String(value||'').replaceAll('_',' ').toLowerCase().replace(/\b\w/g,c=>c.toUpperCase());
  const formatDate=value=>{const d=new Date(value);return !value||Number.isNaN(d.getTime())?'—':d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});};
  const hours=minutes=>`${(Number(minutes||0)/60).toFixed(Number(minutes||0)%60?1:0)} hr`;
  const keyFor=order=>`${order.sourceType}:${order.orderId}`;
  const active=order=>!['COMPLETED','ARCHIVED','CANCELLED'].includes(String(order.status||'').toUpperCase());
  const productionStatus=status=>['PRODUCTION_QUEUE','IN_PRODUCTION','PREPARING_TO_SHIP','PREPARING_FOR_PICKUP','READY_FOR_PICKUP','SHIPPED'].includes(String(status||'').toUpperCase());
  const workFor=order=>(manufacturing.orders||[]).find(row=>row.sourceType===order.sourceType&&row.sourceOrderId===order.orderId);
  const headers=()=>({Accept:'application/json',Authorization:`Bearer ${token}`});

  function message(text,type=''){const el=$('#uo-message');el.hidden=!text;el.textContent=text;el.className=`ca-inline-message uo-message ${type}`.trim();}
  async function fetchJson(path){const response=await fetch(path,{headers:headers()}),data=await response.json().catch(()=>({}));if(!response.ok||!data.ok)throw new Error(data.message||`Could not load ${path}.`);return data;}
  function normalize(sourceType,row){return {...row,sourceType,orderId:row.orderId,createdAt:row.createdAt||'',customerName:row.customerName||'Unknown customer'};}

  function nextAction(order){
    const status=String(order.status||'').toUpperCase();
    if(status==='ARCHIVED')return 'Archived record';
    if(status==='COMPLETED')return 'Ready to archive';
    if(status==='CANCELLED')return 'Cancelled';
    if(status==='CHANGES_REQUESTED')return order.sourceType==='COASTER'?'Review proof changes':'Update configuration';
    if(['DESIGN_REVIEW','PROOF_READY'].includes(status))return order.sourceType==='COASTER'?'Review design and terms':'Review request';
    if(['REQUEST_RECEIVED','UNDER_REVIEW'].includes(status))return 'Complete order review';
    if(status==='NEEDS_CUSTOMER_INFO')return 'Contact customer';
    if(status==='ON_HOLD')return 'Review order hold';
    if(['PROOF_SENT','CONFIGURATION_SENT'].includes(status))return 'Waiting for customer approval';
    if(['PROOF_APPROVED','CONFIGURATION_APPROVED','AWAITING_PAYMENT'].includes(status))return order.paymentRequired===false?'Release to production':'Waiting for payment';
    if(status==='PRODUCTION_QUEUE')return 'Ready for production';
    if(status==='IN_PRODUCTION')return 'Currently printing';
    if(status==='PREPARING_TO_SHIP')return 'Prepare shipment';
    if(status==='PREPARING_FOR_PICKUP')return 'Prepare pickup';
    if(status==='READY_FOR_PICKUP')return 'Waiting for pickup';
    if(status==='SHIPPED')return 'Shipment in transit';
    return readable(status)||'Review order';
  }

  function stage(order){
    const status=String(order.status||'').toUpperCase();
    if(['DESIGN_REVIEW','PROOF_READY','REQUEST_RECEIVED','UNDER_REVIEW','NEEDS_CUSTOMER_INFO','ON_HOLD','CHANGES_REQUESTED'].includes(status))return 'REVIEW';
    if(['PROOF_SENT','CONFIGURATION_SENT'].includes(status))return 'CUSTOMER';
    if(['PROOF_APPROVED','CONFIGURATION_APPROVED','AWAITING_PAYMENT'].includes(status))return 'PAYMENT';
    if(productionStatus(status))return 'PRODUCTION';
    if(status==='COMPLETED')return 'COMPLETED';
    if(status==='ARCHIVED')return 'ARCHIVED';
    return 'OTHER';
  }

  function filtered(){
    const filter=$('#uo-filter').value,q=$('#uo-search').value.trim().toLowerCase();
    return orders.filter(order=>{
      const filterMatch=filter==='ALL'||(filter==='ACTIVE'&&active(order))||(filter==='COASTER'&&order.sourceType==='COASTER'&&active(order))||(filter==='ENCLOSURE'&&order.sourceType==='ENCLOSURE'&&active(order))||stage(order)===filter;
      const detail=order.sourceType==='COASTER'?`${order.topText||''} ${order.bottomText||''}`:`${order.model||''} ${order.sku||''} ${order.offerType||''}`;
      return filterMatch&&(!q||[order.orderId,order.customerName,order.customerEmail,order.status,detail].join(' ').toLowerCase().includes(q));
    });
  }

  function enclosureImage(order){
    const sku=String(order.sku||'').toLowerCase(),board=sku.includes('-38')?'38':'30',root='../images/products/';
    if(sku.startsWith('scout-'))return `${root}scout/${board}/${board}-Scout-angled-side1-inserts-hero.jpg`;
    if(sku.startsWith('ranger-')&&sku.includes('-bucks-'))return `${root}ranger/bucks/${board}/${board}-ranger-bucks-angled-side1-inserts-hero.jpg`;
    if(sku.startsWith('ranger-'))return `${root}ranger/relay/${board}/${board}-ranger-relay-angled-side1-inserts-hero.jpg`;
    if(sku.startsWith('command-')&&sku.includes('-gp-'))return `${root}command/gp/${board}/${board}-Command-GP-angled-side1-inserts-hero.jpg`;
    return `${root}command/standard/${board}/${board}-Command-angled-side1-inserts-hero.jpg`;
  }

  function itemSummary(order){return order.sourceType==='COASTER'?`${Number(order.setCount||1)} × ${Number(order.setSize||4)}-coaster set`:`${Number(order.quantity||1)} × ${order.model} ${order.boardVariant}-pin ${order.offerType}`;}
  function manufacturingLine(order){const work=workFor(order);if(!work)return '<span class="uo-manufacturing muted">Not released to manufacturing</span>';if(work.isPaused)return `<span class="uo-manufacturing">Paused • ${esc(hours(work.remainingPrinterMinutes))} left</span>`;if(['COMPLETED','ARCHIVED'].includes(String(work.status||'')))return '<span class="uo-manufacturing muted">Manufacturing complete</span>';return `<span class="uo-manufacturing">FIFO #${esc(work.queuePosition||'—')} • ${esc(hours(work.remainingPrinterMinutes))} left</span>`;}

  function cardHtml(order){
    const work=workFor(order),image=order.sourceType==='ENCLOSURE'?`<img src="${esc(enclosureImage(order))}" alt=""/>`:'<span class="uo-thumb-fallback">DESIGN</span>';
    return `<button class="uo-order-card${selectedKey===keyFor(order)?' active':''}" type="button" data-key="${esc(keyFor(order))}" data-source="${esc(order.sourceType)}"><span class="uo-thumb" data-thumb="${esc(keyFor(order))}">${image}</span><span class="uo-card-copy"><span class="uo-card-top"><b class="uo-source">${order.sourceType==='COASTER'?'COASTER':'ENCLOSURE'}</b><time class="uo-request-date">${esc(formatDate(order.createdAt))}</time></span><strong>${esc(order.orderId)}</strong><span>${esc(order.customerName)}</span><span>${esc(itemSummary(order))}</span><span class="uo-next">Next: ${esc(nextAction(order))}</span>${manufacturingLine(order)}</span></button>`;
  }

  function renderSummary(){
    const activeOrders=orders.filter(active),actionCount=activeOrders.filter(order=>['REVIEW','CUSTOMER','PAYMENT'].includes(stage(order))).length,activeWork=(manufacturing.orders||[]).filter(row=>['PRODUCTION_QUEUE','IN_PRODUCTION'].includes(String(row.status||''))&&!row.isPaused);
    $('#uo-active-count').textContent=String(activeOrders.length);$('#uo-action-count').textContent=String(actionCount);$('#uo-manufacturing-count').textContent=String(activeWork.length);$('#uo-hours-left').textContent=hours(manufacturing.summary?.remainingPrinterMinutes||0);$('#uo-summary').hidden=false;
  }

  function renderList(){
    const rows=filtered(),list=$('#uo-order-list');$('#uo-count').textContent=`${rows.length} order${rows.length===1?'':'s'}`;
    list.innerHTML=rows.length?rows.map(cardHtml).join(''):'<div class="ca-empty">No coaster or enclosure orders match this view.</div>';
    list.querySelectorAll('[data-key]').forEach(button=>button.addEventListener('click',()=>selectOrder(button.dataset.key)));
    loadCoasterThumbnails(rows.filter(order=>order.sourceType==='COASTER'));
  }

  async function loadCoasterThumbnails(rows){
    await Promise.all(rows.map(async order=>{
      const key=keyFor(order),host=document.querySelector(`[data-thumb="${CSS.escape(key)}"]`);if(!host)return;
      if(imageUrls.has(key)){host.innerHTML=`<img src="${imageUrls.get(key)}" alt=""/>`;return;}
      try{const response=await fetch(`/api/admin/coasters/orders/${encodeURIComponent(order.orderId)}/design`,{headers:headers()});if(!response.ok)throw new Error('missing');const svg=await response.text(),url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));imageUrls.set(key,url);if(host.isConnected)host.innerHTML=`<img src="${url}" alt=""/>`;}catch(error){if(host.isConnected)host.innerHTML='<span class="uo-thumb-fallback">DESIGN</span>';}
    }));
  }

  function frameUrl(order){const page=order.sourceType==='COASTER'?'coaster-orders.html':'enclosure-orders.html',layout=order.sourceType==='ENCLOSURE'?'&layout=20260905-parity1':'';return `${page}?pane=1&order=${encodeURIComponent(order.orderId)}${layout}`;}
  function selectOrder(key){
    const order=orders.find(row=>keyFor(row)===key);if(!order)return;selectedKey=key;renderList();
    const frame=$('#uo-order-frame');$('#uo-empty-detail').hidden=true;$('#uo-frame-loading').hidden=false;frame.hidden=true;frame.src=frameUrl(order);
    const url=new URL(location.href);url.searchParams.set('type',order.sourceType);url.searchParams.set('order',order.orderId);history.replaceState(null,'',url);
  }

  async function load(){
    message('');$('#uo-order-list').innerHTML='<div class="ca-empty">Loading all WestTech orders…</div>';
    try{
      const [coasters,enclosures,work]=await Promise.all([fetchJson('/api/admin/coasters/orders'),fetchJson('/api/admin/enclosures/orders'),fetchJson('/api/admin/work-orders')]);
      manufacturing=work;orders=[...(coasters.orders||[]).map(row=>normalize('COASTER',row)),...(enclosures.orders||[]).map(row=>normalize('ENCLOSURE',row))].sort((a,b)=>new Date(a.createdAt||0)-new Date(b.createdAt||0)||a.orderId.localeCompare(b.orderId));
      $('#uo-auth').hidden=true;renderSummary();renderList();
      const params=new URLSearchParams(location.search),wantedType=params.get('type'),wantedOrder=params.get('order'),wanted=orders.find(row=>row.sourceType===wantedType&&row.orderId===wantedOrder),first=filtered()[0];if(wanted||first)selectOrder(keyFor(wanted||first));
    }catch(error){message(error.message,'error');$('#uo-order-list').innerHTML='<div class="ca-empty">Connect with the WestTech admin token.</div>';$('#uo-auth').hidden=false;}
  }

  function acceptChildState(event){
    if(event.origin!==location.origin||event.data?.type!=='westtech-order-state')return;
    const sourceType=String(event.data.sourceType||''),orderId=String(event.data.orderId||''),index=orders.findIndex(row=>row.sourceType===sourceType&&row.orderId===orderId);if(index<0)return;
    orders[index]={...orders[index],status:event.data.status,paymentStatus:event.data.paymentStatus,updatedAt:event.data.updatedAt||orders[index].updatedAt};renderSummary();renderList();
  }

  $('#uo-token').value=token;$('#uo-connect').addEventListener('click',()=>{token=$('#uo-token').value.trim();if(token){sessionStorage.setItem('westtechha-admin-token',token);load();}});$('#uo-token').addEventListener('keydown',event=>{if(event.key==='Enter')$('#uo-connect').click();});$('#uo-filter').addEventListener('change',renderList);$('#uo-search').addEventListener('input',renderList);$('#uo-refresh').addEventListener('click',load);$('#uo-order-frame').addEventListener('load',()=>{$('#uo-frame-loading').hidden=true;$('#uo-order-frame').hidden=false;});window.addEventListener('message',acceptChildState);if(token)load();
})();
