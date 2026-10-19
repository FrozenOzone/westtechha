/* Small, isolated Admin reorder verification panel. Never overrides standard proof workflow. */
(function(){'use strict';
 const $=s=>document.querySelector(s);let lastOrder='',busy=false,loadSeq=0;
 const auth=()=>sessionStorage.getItem('westtechha-admin-token')||'';
 async function api(url,body){const r=await fetch(url,{method:body?'POST':'GET',headers:{Accept:'application/json',Authorization:`Bearer ${auth()}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});const x=await r.json().catch(()=>({}));if(!r.ok||!x.ok)throw new Error(x.message||'Could not verify reorder');return x;}
 function text(s){const el=$('#ca-message');if(el){el.hidden=false;el.className='ca-inline-message';el.textContent=s;}}
 function remove(){document.querySelector('#ca-reorder-panel')?.remove();document.querySelector('#ca-reorder-tag')?.remove();}
 function number(n){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(n||0));}
 function render(info){remove();if(!info.sourceOrderId)return;
  const pill=$('#ca-status-pill');if(pill){const tag=document.createElement('span');tag.id='ca-reorder-tag';tag.textContent='REORDER';tag.style.cssText='display:inline-block;margin-left:10px;border:1px solid #4a9bd4;padding:4px 9px;border-radius:999px;color:#91cfff;font-size:11px;font-weight:800';pill.after(tag);}
  if(!info.canVerify)return;
  const proof=$('.ca-proof-card');if(!proof)return;
  const box=document.createElement('section');box.id='ca-reorder-panel';box.style.cssText='border:1px solid #1677C4;border-radius:12px;padding:16px;margin-bottom:15px;background:rgba(22,119,196,.09)';
  const h=document.createElement('h3');h.textContent='Verify Repeat Order — No New Customer Proof';h.style.margin='0 0 9px';box.appendChild(h);
  const p=document.createElement('p');p.textContent=`Reordered from ${info.sourceOrderId}. Original approved proof V${info.original?.proofVersion||'?'}; original total ${number(info.original?.finalAmount)}. Check this order's current price, quantity, shipping/pickup and production window above. Save changes before verifying.`;box.appendChild(p);
  const btn=document.createElement('button');btn.type='button';btn.textContent='Verify Reorder & Release to Payment';btn.className='ca-secondary';btn.style.marginTop='8px';box.appendChild(btn);
  const hint=document.createElement('p');hint.textContent='PREVIEW TEST: This skips repeat proof approval. Payment is simulated from Admin later; no PayPal charge.';hint.style.fontSize='12px';box.appendChild(hint);
  btn.onclick=async()=>{if(busy)return;const id=String($('#ca-order-id')?.textContent||'').trim();if(id!==info.order.orderId)return;
   if(!window.confirm(`Verify approved design from ${info.sourceOrderId}, current price ${number(info.order.finalAmount)}, and production window ${info.order.productionWindow||'(missing)'}?\n\nAny unsaved edits must be saved first.`))return;
   busy=true;btn.disabled=true;btn.textContent='Verifying Reorder…';
   try{const result=await api(`/api/admin/coasters/orders/${encodeURIComponent(id)}/reorder`,{action:'verifyForPayment',confirmed:true});text(result.order.paymentRequired?'Reorder verified. Awaiting Preview test payment — no new customer proof required.':'Reorder verified; no payment required. Sent to Production Queue.');$('#ca-refresh')?.click();}
   catch(e){text(e.message||'Could not verify reorder.');btn.disabled=false;btn.textContent='Verify Reorder & Release to Payment';}
   finally{busy=false;}
  };
  proof.parentNode.insertBefore(box,proof);
 }
 async function refresh(){const id=String($('#ca-order-id')?.textContent||'').trim();if(!id||!auth())return;if(id===lastOrder)return;lastOrder=id;const seq=++loadSeq;
  try{const x=await api(`/api/admin/coasters/orders/${encodeURIComponent(id)}/reorder`);if(seq!==loadSeq)return;render(x);}catch{if(seq===loadSeq){lastOrder='';remove();}}
 }
 const elem=$('#ca-order-id');if(elem)new MutationObserver(()=>{lastOrder='';refresh()}).observe(elem,{childList:true,characterData:true,subtree:true});
 $('#ca-refresh')?.addEventListener('click',()=>{lastOrder='';setTimeout(refresh,400)});
 window.addEventListener('focus',()=>{lastOrder='';refresh()});
 setInterval(refresh,6000);setTimeout(refresh,700);
})();
