/* Separate admin-only Stage 1 add-on. Existing coaster-admin.js is NOT edited. */
(()=>{
 'use strict';
 const $=s=>document.querySelector(s);
 const panel=$('#wt-pickup-panel');
 if(!panel||location.protocol==='file:'||new URLSearchParams(location.search).get('mode')==='local')return;
 const date=$('#wt-pickup-date'),time=$('#wt-pickup-time'),list=$('#wt-pickup-list'),status=$('#wt-pickup-status'),add=$('#wt-pickup-add'),reload=$('#wt-pickup-reload');
 const linkButton=$('#wt-pickup-create-link'),linkState=$('#wt-pickup-link-state'),linkBox=$('#wt-pickup-link-box'),linkValue=$('#wt-pickup-link-value'),copyLink=$('#wt-pickup-copy-link'),requestHost=$('#wt-pickup-requests'),appointmentHost=$('#wt-pickup-appointment');
 const decisionDialog=$('#wt-pickup-decision-dialog'),decisionTitle=$('#wt-pickup-decision-title'),decisionDescription=$('#wt-pickup-decision-description'),decisionCancel=$('#wt-pickup-decision-cancel'),decisionConfirm=$('#wt-pickup-decision-confirm');
 const withdrawDialog=$('#wt-pickup-withdraw-dialog'),withdrawDescription=$('#wt-pickup-withdraw-description'),withdrawCancel=$('#wt-pickup-withdraw-cancel'),withdrawConfirm=$('#wt-pickup-withdraw-confirm');
 let activeOrder='',lastKey='',serial=0,busy=false;
 let pendingWithdraw=null,pendingDecision=null,linkedOrder='';
 let lastPickupSnapshot='',autoCheckInFlight=false,lastAutoCheck=0;
 function setStatus(value,error=false){status.textContent=value;status.className='wt-pickup-status'+(error?' error':'');}
 function todayMountain(){const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Denver',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const p=Object.fromEntries(parts.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`;}
 function syncDateMin(){
  const today=todayMountain();date.min=today;
  if(date.value&&date.value<today)date.value='';
 }
 function addTimeChoices(){
  // 9:00 AM through 4:45 PM (last 15-minute appointment ends at 5:00 PM).
  time.replaceChildren(new Option('Choose a time',''));
  for(let mins=9*60;mins<=16*60+45;mins+=15){
   const hour=Math.floor(mins/60),minute=mins%60;
   const value=`${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
   const label=`${hour%12||12}:${String(minute).padStart(2,'0')} ${hour>=12?'PM':'AM'}`;
   time.add(new Option(label,value));
  }
  time.value='10:00';
 }
 syncDateMin();addTimeChoices();
 date.addEventListener('click',()=>{syncDateMin();try{date.showPicker?.();}catch(_){/* native input remains usable */}});
 date.addEventListener('focus',syncDateMin);
 date.addEventListener('change',()=>{
  if(!date.value)return;
  const d=new Date(date.value+'T12:00:00Z');
  if(!Number.isFinite(d.getTime())||[0,6].includes(d.getUTCDay())){date.value='';setStatus('Please select a weekday. No weekend pickups.',true);}
 });
 function visibleOrder(){
  if($('#ca-detail')?.hidden||$('#ca-production-card')?.hidden)return null;
  if($('#ca-prod-fulfillment')?.textContent.trim()!=='Local Pickup')return null;
  const id=$('#ca-order-id')?.textContent.trim()||'',stage=$('#ca-status-pill')?.dataset.savedStatus||'';
  return /^WTCC-[A-Za-z0-9-]+$/.test(id)?{id,key:id+'|'+stage}:null;
 }
 async function request(orderId,method='GET',body=null){
  const token=(sessionStorage.getItem('westtechha-admin-token')||$('#ca-token')?.value||'').trim();
  const response=await fetch(`/api/admin/coasters/orders/${encodeURIComponent(orderId)}/pickup`,{method,credentials:'same-origin',headers:{Accept:'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const json=await response.json().catch(()=>({}));if(!response.ok||!json.ok)throw new Error(json.message||`Pickup request failed (${response.status}).`);return json;
 }
 function readableDate(localDate){return new Date(localDate+'T12:00:00Z').toLocaleDateString('en-US',{timeZone:'UTC',weekday:'short',month:'short',day:'numeric',year:'numeric'});}
 function readableTime(localTime){const [h,m]=localTime.split(':').map(Number);return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`;}
 function askWithdraw(slot){
  if(busy||withdrawDialog.open||!activeOrder)return;
  pendingWithdraw={orderId:activeOrder,slotId:slot.id};
  withdrawDescription.textContent=`${readableDate(slot.localDate)} at ${readableTime(slot.localTime)} (Mountain Time) will no longer be offered for this order.`;
  withdrawDialog.showModal();
 }
 withdrawCancel.addEventListener('click',()=>withdrawDialog.close());
 withdrawConfirm.addEventListener('click',()=>{
  const pending=pendingWithdraw;
  withdrawDialog.close();
  if(pending&&pending.orderId===activeOrder&&!busy)change('DELETE',{slotId:pending.slotId});
 });
 withdrawDialog.addEventListener('close',()=>{pendingWithdraw=null;});
 // Compare only the actual scheduling state; unchanged background replies do not
 // re-render buttons or interrupt an admin who is reviewing a request.
 function pickupSnapshot(pickup){
  return JSON.stringify({enabled:pickup.enabled,canCreateLink:pickup.canCreateLink,
   linkActive:pickup.linkActive,linkExpiresAt:pickup.linkExpiresAt,
   slots:pickup.slots,requests:pickup.requests,appointment:pickup.appointment});
 }
 function paint(pickup){
  lastPickupSnapshot=pickupSnapshot(pickup);
  list.replaceChildren();add.disabled=!pickup.enabled;renderStage2(pickup);
  if(!pickup.enabled)setStatus('Only active Local Pickup production orders can offer times.');
  else if(!(pickup.slots||[]).length)setStatus('No pickup times offered yet.');
  else setStatus(`${pickup.slots.length} time${pickup.slots.length===1?'':'s'} offered for this order.`);
  for(const slot of pickup.slots||[]){
   const row=document.createElement('div'),description=document.createElement('div'),title=document.createElement('strong'),sub=document.createElement('small');
   row.className='wt-pickup-row';title.textContent=readableDate(slot.localDate)+' · '+readableTime(slot.localTime);sub.textContent='15 minutes · Mountain Time · '+slot.status;
   description.append(title,sub);row.appendChild(description);
   if(slot.status==='OFFERED'&&pickup.enabled){const button=document.createElement('button');button.type='button';button.className='ca-secondary';button.textContent='Withdraw';button.addEventListener('click',()=>askWithdraw(slot));row.appendChild(button);}
   list.appendChild(row);
  }
 }
 async function refresh(force=false,quiet=false){
  const shown=visibleOrder();panel.hidden=!shown;
  if(withdrawDialog.open&&(!shown||shown.id!==pendingWithdraw?.orderId))withdrawDialog.close();
  if(decisionDialog.open&&(!shown||shown.id!==pendingDecision?.orderId))decisionDialog.close();
  if(!shown){activeOrder='';lastKey='';lastPickupSnapshot='';serial++;linkedOrder='';linkValue.value='';linkBox.hidden=true;return;}
  if(linkedOrder&&linkedOrder!==shown.id){linkedOrder='';linkValue.value='';linkBox.hidden=true;}
  activeOrder=shown.id;if(!force&&shown.key===lastKey)return;
  if(shown.key!==lastKey)lastPickupSnapshot='';
  lastKey=shown.key;const requestId=++serial;
  if(!quiet)setStatus('Loading pickup times…');
  try{
   const result=await request(shown.id);
   if(requestId!==serial||activeOrder!==shown.id||visibleOrder()?.id!==shown.id)return;
   // Do not replace decisions while a modal or a write is in progress.
   if(quiet&&(busy||withdrawDialog.open||decisionDialog.open||readyDialog.open))return;
   if(!quiet||pickupSnapshot(result.pickup)!==lastPickupSnapshot)paint(result.pickup);
  }catch(e){if(!quiet&&requestId===serial&&activeOrder===shown.id)setStatus(e.message,true);}
 }
 async function change(method,body){
  if(busy||!activeOrder)return;serial++;busy=true;add.disabled=reload.disabled=true;setStatus('Saving pickup times…');const order=activeOrder;
  try{const result=await request(order,method,body);if(activeOrder===order)paint(result.pickup);}catch(e){if(activeOrder===order)setStatus(e.message,true);}finally{busy=false;reload.disabled=false;add.disabled=false;}
 }
 add.addEventListener('click',()=>{syncDateMin();if(!date.value||!time.value){setStatus('Choose a date and time.',true);return;}change('POST',{date:date.value,time:time.value});});
 reload.addEventListener('click',()=>refresh(true));
 function renderStage2(pickup){
   linkButton.disabled=!pickup.canCreateLink;
   linkButton.textContent=pickup.linkActive?'Generate New Link':'Generate Private Link';
   linkState.textContent=pickup.linkActive?`An active link exists (expires ${pickup.linkExpiresAt?.slice(0,10)||'soon'}). Generate New invalidates the old link.`:'No active private link.';
   const a=pickup.appointment;
   appointmentHost.hidden=!a;
   appointmentHost.textContent=a?`Confirmed pickup: ${readableDate(a.localDate)} at ${readableTime(a.localTime)} (Mountain Time). Address and invitations are not yet enabled.`:'';
   requestHost.replaceChildren();
   const recent=(pickup.requests||[]).filter(x=>x.status==='PENDING'||x.status==='COUNTER_OFFERED');
   if(!recent.length){const p=document.createElement('p');p.textContent='No active alternate-time requests.';requestHost.appendChild(p);return;}
   for(const item of recent){
     const box=document.createElement('div'),title=document.createElement('strong'),one=document.createElement('small');box.className='wt-pickup-request';
     title.textContent=item.status==='PENDING'?'Awaiting your approval':'Different times offered — awaiting customer';
     one.textContent=`First: ${readableDate(item.firstDate)} at ${readableTime(item.firstTime)}`;
     box.append(title,one);
     if(item.secondDate){const two=document.createElement('small');two.textContent=`Second: ${readableDate(item.secondDate)} at ${readableTime(item.secondTime)}`;box.appendChild(two);}
     if(item.status==='PENDING'&&!a){
       const actions=document.createElement('div');actions.className='wt-pickup-request-actions';
       for(const [decision,label,available] of [['first','Approve First Choice',true],['second','Approve Second Choice',!!item.secondDate],['counter','Offer Different Times',true]]){
         if(!available)continue;
         const b=document.createElement('button');b.type='button';b.className='ca-secondary';b.textContent=label;
         b.addEventListener('click',()=>askDecision(item,decision));actions.appendChild(b);
       }box.appendChild(actions);
     }requestHost.appendChild(box);
   }
 }
 function askDecision(item,decision){
   if(busy||decisionDialog.open||!activeOrder)return;
   pendingDecision={orderId:activeOrder,requestId:item.id,decision};
   if(decision==='counter'){
     decisionTitle.textContent='Offer different pickup times?';
     decisionDescription.textContent='First, add your proposed weekday slots above. This will mark the alternative request as counter-offered. No email is sent in Stage 2.';
   }else{
     const d=decision==='first'?item.firstDate:item.secondDate,t=decision==='first'?item.firstTime:item.secondTime;
     decisionTitle.textContent='Confirm this pickup appointment?';
     decisionDescription.textContent=`Approve ${readableDate(d)} at ${readableTime(t)} (Mountain Time)? This books the requested time, including after-hours only by your approval.`;
   }
   decisionDialog.showModal();
 }
 decisionCancel.addEventListener('click',()=>decisionDialog.close());
 decisionConfirm.addEventListener('click',()=>{
   const p=pendingDecision;decisionDialog.close();
   if(p&&p.orderId===activeOrder&&!busy)change('POST',{action:'decide',requestId:p.requestId,decision:p.decision});
 });
 decisionDialog.addEventListener('close',()=>{pendingDecision=null;});
 linkButton.addEventListener('click',async()=>{
   if(busy||!activeOrder)return;serial++;busy=true;linkButton.disabled=true;setStatus('Preparing private link…');const id=activeOrder;
   try{const result=await request(id,'POST',{action:'createLink'});
     if(activeOrder===id){paint(result.pickup);linkedOrder=id;linkValue.value=result.link||'';linkBox.hidden=!linkValue.value;setStatus('Private link created. Copy and share only with this customer. No email has been sent.');}
   }catch(e){if(activeOrder===id)setStatus(e.message,true);}
   finally{busy=false;linkButton.disabled=false;}
 });
 copyLink.addEventListener('click',async()=>{
   if(!linkValue.value)return;
   try{await navigator.clipboard.writeText(linkValue.value);setStatus('Private link copied. No automatic email has been sent.');}
   catch(e){linkValue.select();setStatus('Link selected — press Ctrl+C to copy.');}
 });

 // Ready for Pickup: on selecting the status, guide the admin to scheduling;
 // on Save, require future offered times or an explicit one-time override.
 const readyDialog=$('#wt-pickup-ready-dialog');
 const readyAdd=$('#wt-pickup-ready-add'),readyOverride=$('#wt-pickup-ready-override'),readyCancel=$('#wt-pickup-ready-cancel');
 let settleReady=null;
 const readyNo={proceed:false,override:false};
 const readyStatus=$('#ca-production-status');
 const savedStatus=()=>$('#ca-status-pill')?.dataset.savedStatus||'';
 const resetReadySelection=()=>{if(readyStatus&&savedStatus()){
  readyStatus.value=savedStatus();readyStatus.dispatchEvent(new Event('change',{bubbles:true}));
 }};
 const scrollToSlots=()=>{panel.scrollIntoView({behavior:'smooth',block:'start'});setTimeout(()=>date.focus({preventScroll:true}),200);};
 function finishReady(action){
  if(!settleReady)return;
  const done=settleReady;settleReady=null;
  if(readyDialog.open)readyDialog.close();
  if(action==='add')scrollToSlots();
  if(action==='cancel')resetReadySelection();
  done(action==='override'?{proceed:true,override:true}:readyNo);
 }
 readyAdd.addEventListener('click',()=>finishReady('add'));
 readyCancel.addEventListener('click',()=>finishReady('cancel'));
 readyOverride.addEventListener('click',()=>finishReady('override'));
 readyDialog.addEventListener('close',()=>{if(!readyDialog.open&&settleReady)finishReady('cancel');});
 readyStatus?.addEventListener('change',()=>{
  if(readyStatus.value==='READY_FOR_PICKUP'&&savedStatus()!=='READY_FOR_PICKUP'&&!panel.hidden)scrollToSlots();
 });
 window.wtPickupReadyGate=async(expectedOrderId='')=>{
  // The main Save button supplies its order ID. Never silently bypass the
  // scheduling popup if the UI is still rendering or showing another order.
  let shown=visibleOrder();
  if(!shown&&expectedOrderId&&$('#ca-prod-fulfillment')?.textContent.trim()==='Local Pickup'&&$('#ca-order-id')?.textContent.trim()===expectedOrderId){
    shown={id:expectedOrderId};
  }
  if(expectedOrderId&&(!shown||shown.id!==expectedOrderId)){
    setStatus('Pickup order details are still loading. Please refresh this order before saving.',true);
    return readyNo;
  }
  if(!shown||readyStatus?.value!=='READY_FOR_PICKUP'||savedStatus()==='READY_FOR_PICKUP'){
    return expectedOrderId?readyNo:{proceed:true,override:false};
  }
  if(busy||readyDialog.open)return readyNo;
  try{
   const data=await request(shown.id);
   if(visibleOrder()?.id!==shown.id||readyStatus?.value!=='READY_FOR_PICKUP')return readyNo;
   const nowParts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Denver',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());
   const now=Object.fromEntries(nowParts.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
   const today=`${now.year}-${now.month}-${now.day}`,clock=`${now.hour}:${now.minute}`;
   const offered=(data.pickup?.slots||[]).some(x=>x.status==='OFFERED'&&(x.localDate>today||(x.localDate===today&&x.localTime>clock)));
   if(offered)return {proceed:true,override:false};
  }catch(e){setStatus('Could not verify pickup times: '+e.message,true);scrollToSlots();return readyNo;}
  return new Promise(resolve=>{settleReady=resolve;readyDialog.showModal();});
 };

 // Check the currently displayed pickup order every 20 seconds while visible.
 // The normal order auto-refresh intentionally does not monitor pickup requests.
 function maybeAutoRefresh(){
  if(document.hidden||autoCheckInFlight||busy||!visibleOrder())return;
  if(withdrawDialog.open||decisionDialog.open||readyDialog.open)return;
  // Avoid changing scheduling controls while the admin is editing their values.
  if(panel.contains(document.activeElement)&&/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName||''))return;
  const now=Date.now();if(now-lastAutoCheck<1500)return;lastAutoCheck=now;
  autoCheckInFlight=true;
  refresh(true,true).finally(()=>{autoCheckInFlight=false;});
 }
 setInterval(maybeAutoRefresh,20000);
 window.addEventListener('focus',maybeAutoRefresh);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)maybeAutoRefresh();});

 const observer=new MutationObserver(()=>refresh());
 // Only observe existing admin state indicators. Do not observe this add-on's own
 // panel: writing its content must never retrigger the observer.
 for(const selector of ['#ca-detail','#ca-production-card']){
  const el=$(selector);if(el)observer.observe(el,{attributes:true,attributeFilter:['hidden']});
 }
 for(const selector of ['#ca-order-id','#ca-prod-fulfillment']){
  const el=$(selector);if(el)observer.observe(el,{childList:true,subtree:true});
 }
 const stage=$('#ca-status-pill');if(stage)observer.observe(stage,{attributes:true,attributeFilter:['data-saved-status']});
 refresh(true);
})();
