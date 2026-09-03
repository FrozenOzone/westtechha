(function(){
  'use strict';
  if(location.protocol==='file:')return;
  let lastActivity=Date.now();
  let lastRefresh=0;
  const ACTIVE_STATUSES=new Set(['PROOF SENT','PROOF APPROVED','AWAITING PAYMENT']);

  function status(){return String(document.querySelector('#ca-status-pill')?.textContent||'').trim().toUpperCase();}
  function editing(){const el=document.activeElement;return !!el&&/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);}
  function markActivity(){lastActivity=Date.now();}
  function refreshIfWaiting(force=false){
    if(document.hidden)return;
    if(!ACTIVE_STATUSES.has(status()))return;
    if(editing())return;
    const now=Date.now();
    if(!force&&now-lastActivity<8000)return;
    if(now-lastRefresh<8000)return;
    const button=document.querySelector('#ca-refresh');
    if(!button||button.disabled)return;
    lastRefresh=now;
    button.click();
  }

  ['input','change','keydown','pointerdown'].forEach(type=>document.addEventListener(type,markActivity,{passive:true}));
  window.addEventListener('focus',()=>setTimeout(()=>refreshIfWaiting(true),400));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(()=>refreshIfWaiting(true),400);});
  setInterval(()=>refreshIfWaiting(false),12000);
})();
