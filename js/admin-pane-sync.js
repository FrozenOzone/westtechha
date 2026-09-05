(function(){
  'use strict';
  if(window.parent===window)return;
  const params=new URLSearchParams(location.search);if(params.get('pane')!=='1')return;
  function publish(){
    const coaster=document.querySelector('#ca-order-id'),enclosure=document.querySelector('#ea-order-id'),status=document.querySelector('#ca-status-pill,#ea-status-pill');
    const orderId=(coaster||enclosure)?.textContent?.trim();if(!orderId||orderId==='—'||!status)return;
    window.parent.postMessage({type:'westtech-order-state',sourceType:coaster?'COASTER':'ENCLOSURE',orderId,status:String(status.dataset.savedStatus||status.textContent||'').trim().replaceAll(' ','_').toUpperCase()},location.origin);
  }
  window.addEventListener('DOMContentLoaded',()=>{
    const status=document.querySelector('#ca-status-pill,#ea-status-pill');if(!status)return;
    new MutationObserver(publish).observe(status,{childList:true,characterData:true,subtree:true,attributes:true,attributeFilter:['data-saved-status']});publish();
  });
})();
