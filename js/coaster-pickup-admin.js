/* Separate admin-only Stage 1 add-on. Existing coaster-admin.js is NOT edited. */
(()=>{
 'use strict';
 const $=s=>document.querySelector(s);
 const panel=$('#wt-pickup-panel');
 if(!panel||location.protocol==='file:'||new URLSearchParams(location.search).get('mode')==='local')return;
 const date=$('#wt-pickup-date'),time=$('#wt-pickup-time'),list=$('#wt-pickup-list'),status=$('#wt-pickup-status'),add=$('#wt-pickup-add'),reload=$('#wt-pickup-reload');
 let activeOrder='',lastKey='',serial=0,busy=false;
 function setStatus(value,error=false){status.textContent=value;status.className='wt-pickup-status'+(error?' error':'');}
 function todayMountain(){const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Denver',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const p=Object.fromEntries(parts.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}`;}
 date.min=todayMountain();
 function visibleOrder(){
  if($('#ca-detail')?.hidden||$('#ca-production-card')?.hidden)return null;
  if($('#ca-prod-fulfillment')?.textContent.trim()!=='Local Pickup')return null;
  const id=$('#ca-order-id')?.textContent.trim()||'',stage=$('#ca-status-pill')?.dataset.savedStatus||'';
  return /^WTCC-[A-Za-z0-9-]+$/.test(id)?{id,key:id+'|'+stage}:null;
 }
 async function request(orderId,method='GET',body=null){
  const token=(sessionStorage.getItem('westtechha-admin-token')||$('#ca-token')?.value||'').trim();
  const response=await fetch(`/api/admin/coasters/orders/${encodeURIComponent(orderId)}/pickup`,{method,credentials:'same-origin',headers:{Accept:'application/json',...(token?{Authorization:'Bearer '+token}:{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const json=await response.json().catch(()=>({}));if(!response.ok||!json.ok)throw new Error(json.message||`Pickup request failed (${response.status}).`);return json.pickup;
 }
 function readableDate(localDate){return new Date(localDate+'T12:00:00Z').toLocaleDateString('en-US',{timeZone:'UTC',weekday:'short',month:'short',day:'numeric',year:'numeric'});}
 function readableTime(localTime){const [h,m]=localTime.split(':').map(Number);return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`;}
 function paint(pickup){
  list.replaceChildren();add.disabled=!pickup.enabled;
  if(!pickup.enabled)setStatus('Only active Local Pickup production orders can offer times.');
  else if(!(pickup.slots||[]).length)setStatus('No pickup times offered yet.');
  else setStatus(`${pickup.slots.length} time${pickup.slots.length===1?'':'s'} offered for this order.`);
  for(const slot of pickup.slots||[]){
   const row=document.createElement('div'),description=document.createElement('div'),title=document.createElement('strong'),sub=document.createElement('small');
   row.className='wt-pickup-row';title.textContent=readableDate(slot.localDate)+' · '+readableTime(slot.localTime);sub.textContent='15 minutes · Mountain Time · '+slot.status;
   description.append(title,sub);row.appendChild(description);
   if(slot.status==='OFFERED'&&pickup.enabled){const button=document.createElement('button');button.type='button';button.className='ca-secondary';button.textContent='Withdraw';button.addEventListener('click',()=>{if(!busy&&confirm('Withdraw this offered pickup time?'))change('DELETE',{slotId:slot.id});});row.appendChild(button);}
   list.appendChild(row);
  }
 }
 async function refresh(force=false){
  const shown=visibleOrder();panel.hidden=!shown;
  if(!shown){activeOrder='';lastKey='';serial++;return;}
  activeOrder=shown.id;if(!force&&shown.key===lastKey)return;
  lastKey=shown.key;const requestId=++serial;setStatus('Loading pickup times…');
  try{const pickup=await request(shown.id);if(requestId===serial&&activeOrder===shown.id)paint(pickup);}catch(e){if(requestId===serial&&activeOrder===shown.id)setStatus(e.message,true);}
 }
 async function change(method,body){
  if(busy||!activeOrder)return;busy=true;add.disabled=reload.disabled=true;setStatus('Saving pickup times…');const order=activeOrder;
  try{const pickup=await request(order,method,body);if(activeOrder===order)paint(pickup);}catch(e){if(activeOrder===order)setStatus(e.message,true);}finally{busy=false;reload.disabled=false;add.disabled=false;}
 }
 add.addEventListener('click',()=>{if(!date.value||!time.value){setStatus('Choose a date and time.',true);return;}change('POST',{date:date.value,time:time.value});});
 reload.addEventListener('click',()=>refresh(true));
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
