(function(){
  'use strict';
  if(location.hostname!=='coasters-v30-preview.westtechha.pages.dev')return;
  const $=s=>document.querySelector(s);
  let busy=false;
  function token(){return sessionStorage.getItem('westtechha-admin-token')||'';}
  function orderId(){return String($('#ca-order-id')?.textContent||'').trim();}
  function status(){return String($('#ca-status-pill')?.textContent||'').trim().toUpperCase().replaceAll(' ','_');}
  function authHeaders(extra={}){return {'Accept':'application/json','Authorization':`Bearer ${token()}`,...extra};}
  function message(text,type='success'){const box=$('#ca-message');if(!box)return;box.hidden=false;box.textContent=text;box.className=`ca-inline-message ${type}`;}
  function removeButton(){document.querySelector('#ca-preview-mark-paid')?.remove();document.querySelector('#ca-preview-pay-note')?.remove();}
  async function fetchOrder(){const id=orderId();if(!id||!token())return null;const r=await fetch(`/api/admin/coasters/orders/${encodeURIComponent(id)}`,{headers:authHeaders()});const data=await r.json().catch(()=>({}));if(!r.ok||!data.ok)return null;return data.order||null;}
  async function markPaid(){
    if(busy)return;busy=true;const button=$('#ca-preview-mark-paid');if(button){button.disabled=true;button.textContent='Marking Test Paid…';}
    try{
      const id=orderId();const r=await fetch(`/api/admin/coasters/orders/${encodeURIComponent(id)}`,{method:'POST',headers:authHeaders({'Content-Type':'application/json'}),body:JSON.stringify({action:'previewMarkPaid'})});
      const data=await r.json().catch(()=>({}));if(!r.ok||!data.ok)throw new Error(data.message||'Could not simulate preview payment.');
      message('Preview test payment recorded. No PayPal call was made. Order moved to Production Queue.','success');
      setTimeout(()=>$('#ca-refresh')?.click(),350);
    }catch(err){message(err.message||'Could not simulate preview payment.','error');}
    finally{busy=false;if(button){button.disabled=false;button.textContent='Preview: Mark Paid';}}
  }
  async function render(){
    const code=status();
    if(!['PROOF_APPROVED','AWAITING_PAYMENT'].includes(code)){removeButton();return;}
    const order=await fetchOrder();
    if(!order||!order.paymentRequired||String(order.paymentStatus||'').toUpperCase()==='PAID'){removeButton();return;}
    const actions=document.querySelector('.ca-paypal-actions');if(!actions)return;
    let button=$('#ca-preview-mark-paid');
    if(!button){button=document.createElement('button');button.id='ca-preview-mark-paid';button.type='button';button.className='ca-secondary';button.textContent='Preview: Mark Paid';button.addEventListener('click',markPaid);actions.appendChild(button);}
    let note=$('#ca-preview-pay-note');
    if(!note){note=document.createElement('small');note.id='ca-preview-pay-note';note.style.display='block';note.style.marginTop='8px';note.style.color='#8a5a00';const host=document.querySelector('.ca-proof-payment');host?.appendChild(note);}
    if(note)note.textContent=order.fulfillmentMethod==='SHIP'?'PREVIEW ONLY — no PayPal call. Marks this order paid and inserts a clearly labeled test shipping address so you can test the full shipping workflow.':'PREVIEW ONLY — no PayPal call. Marks this order paid so you can test the remaining workflow.';
  }
  const observer=new MutationObserver(()=>setTimeout(render,80));
  if($('#ca-status-pill'))observer.observe($('#ca-status-pill'),{childList:true,characterData:true,subtree:true});
  window.addEventListener('focus',()=>setTimeout(render,150));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)setTimeout(render,150);});
  setInterval(render,7000);
  setTimeout(render,450);
})();
