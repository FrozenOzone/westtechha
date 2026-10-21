/* WestTech Production Date Awareness — advisory Stage A, admin only */
(function(){
  'use strict';
  const $=s=>document.querySelector(s);
  const token=()=>sessionStorage.getItem('westtechha-admin-token')||'';
  const states={OVERDUE:'Overdue',AT_RISK:'At risk',NO_WINDOW:'No saved date',PAUSED:'Paused',DUE_TODAY:'Due today',ON_TRACK:'On schedule'};
  const sortRank={OVERDUE:0,AT_RISK:1,DUE_TODAY:2,NO_WINDOW:3,PAUSED:4,ON_TRACK:5};
  let coasterResult=null,loadedId='',requestId=0;
  async function request(params={}){
    const q=new URLSearchParams(params),response=await fetch('/api/admin/production-awareness?'+q.toString(),{headers:{Accept:'application/json',Authorization:`Bearer ${token()}`},cache:'no-store'});
    const result=await response.json().catch(()=>({}));if(!response.ok||!result.ok)throw new Error(result.message||'Could not calculate production dates.');return result;
  }
  function setText(selector,s){const node=$(selector);if(node)node.textContent=s;}
  function renderWork(data){
    const summary=data.summary||{};
    setText('#wo-pa-summary',`${summary.active||0} active • ${summary.atRisk||0} at risk • ${summary.overdue||0} overdue • ${summary.missing||0} without a production date`);
    setText('#wo-pa-suggestion',`If a new 4-coaster set arrived now: ${data.suggested.label} (${data.suggested.allowanceBusinessDays} business days; shared queue considered).`);
    const list=$('#wo-pa-list');if(!list)return;
    list.replaceChildren();
    const rows=(data.alerts||[]).slice().sort((a,b)=>(sortRank[a.status]??10)-(sortRank[b.status]??10)).slice(0,18);
    if(!rows.length){const p=document.createElement('p');p.textContent='No active manufacturing orders to evaluate.';list.append(p);return;}
    for(const row of rows){
      const article=document.createElement('div');article.className='pa-item';
      const link=document.createElement('a');link.textContent=row.sourceOrderId;link.href=row.sourceType==='COASTER'?`coaster-orders.html?order=${encodeURIComponent(row.sourceOrderId)}`:row.sourceType==='ENCLOSURE'?`enclosure-orders.html?order=${encodeURIComponent(row.sourceOrderId)}`:`custom-orders.html?order=${encodeURIComponent(row.sourceOrderId)}`;
      const status=document.createElement('strong');status.className='pa-state pa-state-'+String(row.status).toLowerCase();status.textContent=states[row.status]||row.status;
      const detail=document.createElement('span');detail.textContent=`${row.itemSummary||row.sourceType} • ${row.promisedWindow||'No saved window'} • ${row.detail}`;
      article.append(link,status,detail);list.append(article);
    }
    const count=(data.alerts||[]).length-rows.length;if(count>0){const p=document.createElement('p');p.textContent=`${count} more work orders. Results show the highest-priority 18.`;list.append(p);}
  }
  async function updateWork(){if(!$('#wo-awareness')||!token())return;setText('#wo-pa-summary','Checking the shared production schedule…');try{renderWork(await request());}catch(e){setText('#wo-pa-summary',e.message);}}
  function coasterParams(){
    const count=Math.max(1,Number($('#ca-set-count')?.value||1));
    const total=Number($('#ca-total-coasters')?.value||0),size=total?Math.max(1,Math.round(total/count)):4;
    return {orderId:($('#ca-order-id')?.textContent||'').trim(),setSize:size,setCount:count,minutes:Math.max(1,Math.round(Number($('#ca-printer-minutes')?.value||650)))};
  }
  function renderCoaster(data){
    coasterResult=data;
    const sug=data.suggested||{},count=data.summary||{};
    setText('#ca-pa-summary',`Suggested: ${sug.label} • ${sug.allowanceBusinessDays} business days for this order. Across both K2s: ${Math.round((data.capacity?.remainingPrinterMinutes||0)/60*10)/10} printer hours currently queued.`);
    const explanation=sug.lastCommittedEnd?`Latest saved commitment ends ${sug.lastCommittedEnd}. `:'No later saved commitment found. ';
    const extra=sug.capacityExtended?'Shared printer workload extends the proposed end date. ':'';
    const unreadable=sug.unreadableWindows?`${sug.unreadableWindows} saved window(s) could not be parsed; review those manually. `:'';
    setText('#ca-pa-note',explanation+extra+unreadable+'Advisory only. You can override these dates; Save Order Review to commit your choice.');
    setText('#ca-pa-risk',`${count.atRisk||0} at risk • ${count.overdue||0} overdue • ${count.missing||0} active work orders missing dates.`);
    const button=$('#ca-pa-apply');if(button)button.disabled=!sug.start||!!$('#ca-production-window-start')?.disabled;
    compareDates();
  }
  function compareDates(){
    const note=$('#ca-pa-warning'),s=coasterResult?.suggested;if(!note||!s)return;
    const start=$('#ca-production-window-start')?.value||'',end=$('#ca-production-window-end')?.value||start;
    if(!start){note.textContent='No dates selected yet. Use the suggestion or enter your own window.';return;}
    if(end<s.end){note.textContent=`Heads-up: your selected end date (${end}) is earlier than the conservative suggestion (${s.end}). Review available capacity before saving.`;return;}
    if(s.lastCommittedEnd&&start<=s.lastCommittedEnd){note.textContent='Possible overlapping commitment. Parallel printing may make this workable, but verify printer capacity before saving.';return;}
    note.textContent='The selected dates are consistent with this advisory forecast. Saving is still required.';
  }
  async function updateCoaster(){
    if(!$('#ca-production-awareness')||!token())return;
    const params=coasterParams();if(!params.orderId||!$('#ca-detail')||$('#ca-detail').hidden)return;
    const seq=++requestId;setText('#ca-pa-summary','Checking saved production commitments…');
    try{const data=await request(params);if(seq!==requestId)return;renderCoaster(data);}catch(e){if(seq===requestId){coasterResult=null;setText('#ca-pa-summary',e.message);setText('#ca-pa-note','Dates must be checked manually until the calculation is available.');}}
  }
  function applySuggested(){
    const windowInfo=coasterResult?.suggested;if(!windowInfo?.start)return;
    const windowField=$('#ca-production-window');if(!windowField||$('#ca-production-window-start')?.disabled)return;
    if(!window.WestTechProductionFields)return;
    window.WestTechProductionFields.setWindow(windowField,windowInfo.label);
    windowField.dispatchEvent(new Event('input',{bubbles:true}));
    compareDates();
    setText('#ca-pa-warning','Suggested dates entered. Click Save Order Review just below to save them before verifying or releasing payment.');
    $('#ca-save-review-near-dates')?.focus();
  }
  function init(){
    if($('#wo-awareness')){
      $('#wo-pa-reload')?.addEventListener('click',updateWork);
      $('#wo-connect')?.addEventListener('click',()=>setTimeout(updateWork,0));
      $('#wo-refresh')?.addEventListener('click',updateWork);
      $('#wo-settings-form')?.addEventListener('submit',()=>setTimeout(updateWork,1300));
      if(token())updateWork();
    }
    if($('#ca-production-awareness')){
      $('#ca-pa-reload')?.addEventListener('click',updateCoaster);
      $('#ca-pa-apply')?.addEventListener('click',applySuggested);
      $('#ca-production-window')?.addEventListener('input',compareDates);
      let previous='';const orderEl=$('#ca-order-id');
      if(orderEl){new MutationObserver(()=>{const id=orderEl.textContent.trim();if(id&&id!==previous){previous=id;coasterResult=null;setTimeout(updateCoaster,80);}}).observe(orderEl,{childList:true,characterData:true,subtree:true});}
      $('#ca-connect')?.addEventListener('click',()=>setTimeout(updateCoaster,500));
      $('#ca-set-count')?.addEventListener('change',updateCoaster);
      $('#ca-printer-minutes')?.addEventListener('change',updateCoaster);
      $('#ca-save-review-near-dates')?.addEventListener('click',()=>setTimeout(updateCoaster,1000));
      if(token())setTimeout(updateCoaster,350);
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
