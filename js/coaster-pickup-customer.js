/* Private customer pickup scheduling. Token is in URL fragment, not transmitted via page URL. */
(()=>{
 'use strict';
 const $=s=>document.querySelector(s);
 const tokenFromHash=new URLSearchParams(location.hash.replace(/^#/,'' )).get('key')||'';
 if(tokenFromHash&&/^[a-f\d]{64}$/i.test(tokenFromHash))sessionStorage.setItem('westtech-pickup-stage2-token',tokenFromHash);
 const token=tokenFromHash||sessionStorage.getItem('westtech-pickup-stage2-token')||'';
 if(location.hash){try{history.replaceState(null,'',location.pathname+location.search);}catch(e){/* URL cleanup unavailable in local test */}}
 const busyText=$('#pc-loading'),content=$('#pc-content'),message=$('#pc-message'),submit=$('#pc-submit');
 let state=null,busy=false;
 function showError(text){busyText.hidden=true;content.hidden=true;$('#pc-error').hidden=false;$('#pc-error-text').textContent=text;}
 function notify(text,error=false){message.textContent=text;message.hidden=false;message.className='pc-message'+(error?' error':'');}
 const friendlyDate=date=>new Date(date+'T12:00:00Z').toLocaleDateString('en-US',{timeZone:'UTC',weekday:'long',month:'short',day:'numeric',year:'numeric'});
 function friendlyTime(value){const [h,m]=value.split(':').map(Number);return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`;}
 function pretty(date,time){return `${friendlyDate(date)} at ${friendlyTime(time)} (Mountain Time)`;}
 async function call(action,fields={}){
  const response=await fetch('/api/coasters/pickup',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},credentials:'same-origin',body:JSON.stringify({action,token,...fields})});
  const data=await response.json().catch(()=>({}));if(!response.ok||!data.ok)throw new Error(data.message||`Scheduling request failed (${response.status}).`);
  return data;
 }
 function todayMountain(){
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Denver',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const p=Object.fromEntries(parts.filter(x=>x.type!=='literal').map(x=>[x.type,x.value]));
  return `${p.year}-${p.month}-${p.day}`;
 }
 function setDates(){
  // Refresh even when a page remains open overnight. Never accept an older server date.
  const now=todayMountain()>state.today?todayMountain():state.today;
  const max=new Date(Date.parse(now+'T12:00:00Z')+120*86400000).toISOString().slice(0,10);
  ['pc-first-date','pc-second-date'].forEach(id=>{const el=$('#'+id);el.min=now;el.max=max;if(el.value&&el.value<now)el.value='';});
 }
 function addTimeChoices(){
  // Visible 12-hour labels, exact HH:mm values for API and D1.
  for(const id of ['pc-first-time','pc-second-time']){
   const select=$('#'+id);select.replaceChildren(new Option('Choose a time',''));
   for(let mins=8*60;mins<=18*60;mins+=15){
    const hour=Math.floor(mins/60),minute=mins%60;
    const value=`${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
    const label=`${hour%12||12}:${String(minute).padStart(2,'0')} ${hour>=12?'PM':'AM'}`;
    select.add(new Option(label,value));
   }
  }
 }
 // Clicking anywhere inside a date field opens the native calendar in supported browsers.
 for(const id of ['pc-first-date','pc-second-date']){
  const el=$('#'+id);
  el.addEventListener('click',()=>{setDates();try{el.showPicker?.();}catch(_){/* native input remains usable */}});
  el.addEventListener('focus',setDates);
 }
 addTimeChoices();
 function validWeekday(date){const d=new Date(date+'T12:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===date&&!([0,6].includes(d.getUTCDay()));}
 function paint(){
  busyText.hidden=true;content.hidden=false;message.hidden=true;
  $('#pc-order').textContent='Coaster order '+state.orderId;
  $('#pc-waiting').hidden=true;$('#pc-confirmed').hidden=true;$('#pc-pending').hidden=true;$('#pc-chooser').hidden=true;
  if(state.appointment){$('#pc-confirmed').hidden=false;$('#pc-confirmed-when').textContent=pretty(state.appointment.localDate,state.appointment.localTime);return;}
  if(!state.ready){$('#pc-waiting').hidden=false;return;}
  if(state.request?.status==='PENDING'){
   $('#pc-pending').hidden=false;
   $('#pc-pending-text').textContent=`First choice: ${pretty(state.request.firstDate,state.request.firstTime)}`+(state.request.secondDate?`. Second choice: ${pretty(state.request.secondDate,state.request.secondTime)}.`:'.');
   return;
  }
  $('#pc-chooser').hidden=false;
  const list=$('#pc-slot-list');list.replaceChildren();
  for(const slot of state.slots||[]){
    const label=document.createElement('label'),radio=document.createElement('input'),text=document.createElement('span'),main=document.createElement('strong'),sub=document.createElement('small');
    label.className='pc-slot';radio.type='radio';radio.name='pc-choice';radio.value=String(slot.id);
    main.textContent=pretty(slot.localDate,slot.localTime);sub.textContent='15-minute pickup appointment';text.append(main,sub);label.append(radio,text);list.appendChild(label);
  }
  if(!(state.slots||[]).length){let p=document.createElement('p');p.textContent='There are no offered pickup times right now. Please request another weekday date and time below.';list.appendChild(p);}
  const counter=state.request?.status==='COUNTER_OFFERED';
  $('#pc-other').disabled=counter;$('#pc-other').closest('label').hidden=counter;
  if(counter){notify('WestTech has offered alternative pickup times. Please select one of the available appointments.');}
  document.querySelectorAll('input[name=pc-choice]').forEach(x=>x.checked=false);
  $('#pc-alternatives').hidden=true;submit.disabled=true;
  submit.textContent='Choose a pickup appointment';setDates();
 }
 function onChange(){
  const radio=$('input[name=pc-choice]:checked');
  const other=radio?.value==='other';$('#pc-alternatives').hidden=!other;
  submit.disabled=!radio;submit.textContent=other?'Request Alternate Pickup Time':'Confirm Pickup Appointment';
 }
 document.addEventListener('change',e=>{
   if(e.target.matches('input[name=pc-choice]'))onChange();
   if(e.target.matches('#pc-first-date,#pc-second-date')&&e.target.value&&!validWeekday(e.target.value)){
     e.target.value='';notify('Weekend pickup dates are unavailable. Please select Monday through Friday.',true);
   }
 });
 function parseChoice(prefix){return {date:$('#pc-'+prefix+'-date').value,time:$('#pc-'+prefix+'-time').value};}
 submit.addEventListener('click',async()=>{
  if(busy||!state||!state.ready)return;
  const checked=$('input[name=pc-choice]:checked');if(!checked)return;
  const other=checked.value==='other';let fields;
  if(other){
   setDates();
   const first=parseChoice('first'),second=parseChoice('second');
   if(!first.date||!first.time){notify('Please enter your first-choice date and time.',true);return;}
   if(!validWeekday(first.date)||second.date&&!validWeekday(second.date)){notify('Weekend pickup dates are not available. Please choose weekdays.',true);return;}
   if(!!second.date!==!!second.time){notify('Please enter both date and time for your optional second choice.',true);return;}
   const offeredChoices=[...$('#pc-first-time').options].map(x=>x.value).filter(Boolean);
   if(!offeredChoices.includes(first.time)||(second.time&&!offeredChoices.includes(second.time))){notify('Please select a time from the 15-minute options between 8 AM and 6 PM.',true);return;}
   fields={first,second};
  }else fields={slotId:Number(checked.value)};
  busy=true;submit.disabled=true;submit.textContent='Saving…';
  try{const result=await call(other?'request':'book',fields);state=result.view||result.pickup;paint();}
  catch(e){notify(e.message||'Could not save. Please try again.',true);}
  finally{busy=false;if(!$('#pc-chooser').hidden){submit.disabled=false;onChange();}}
 });
 if(!/^[a-f\d]{64}$/i.test(token)){showError('The private pickup scheduling link is missing or invalid.');return;}
 call('view').then(data=>{state=data.pickup;paint();}).catch(e=>showError(e.message));
})();
