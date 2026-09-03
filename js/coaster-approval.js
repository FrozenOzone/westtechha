(function(){
  'use strict';
  const $=s=>document.querySelector(s);
  const params=new URLSearchParams(location.search);
  const orderId=params.get('order')||'';
  const paymentReturn=params.get('payment')==='return';
  const paymentCancelled=params.get('payment')==='cancel';
  const paypalReturnOrderId=paymentReturn?(params.get('token')||params.get('paypalOrder')||''):'';
  const privateToken=params.get('approvalToken') || (!paymentReturn&&!paymentCancelled ? (params.get('token')||'') : '');
  const isLocal=location.protocol==='file:'||params.get('mode')==='local';
  let approval=null;
  let taxReview=null;

  function money(v){const n=Number(v||0);return Number.isFinite(n)?n:0;}
  function fmt(v){return new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(money(v));}
  function esc(v){return String(v??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}
  function fulfillment(v){return v==='LOCAL_PICKUP'?'Local Pickup':'Ship Order';}
  function showError(msg){$('#cap-loading').textContent=msg;$('#cap-loading').hidden=false;$('#cap-content').hidden=true;}
  function message(text,type){const el=$('#cap-message');if(!el)return;el.hidden=false;el.textContent=text;el.className='cap-message '+(type||'');}
  function readArray(key){try{const v=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(v)?v:[];}catch(e){return [];}}
  function writeArray(key,rows){try{localStorage.setItem(key,JSON.stringify(rows));}catch(e){}}
  function localApprovals(){
    let rows=readArray('westtechha-coaster-local-approvals');
    if(!rows.length){try{const legacy=JSON.parse(localStorage.getItem('westtechha-coaster-local-approval')||'null');if(legacy?.orderId)rows=[legacy];}catch(e){}}
    return rows;
  }
  function saveLocalApproval(row){let rows=localApprovals().filter(r=>r?.orderId!==row.orderId);rows.unshift(row);rows=rows.slice(0,25);writeArray('westtechha-coaster-local-approvals',rows);try{localStorage.setItem('westtechha-coaster-local-approval',JSON.stringify(row));}catch(e){}}
  function localAdminOrders(){
    let rows=readArray('westtechha-coaster-local-admin-orders');
    if(!rows.length){try{const legacy=JSON.parse(localStorage.getItem('westtechha-coaster-local-admin-order')||'null');if(legacy?.orderId)rows=[legacy];}catch(e){}}
    return rows;
  }
  function saveLocalAdmin(row){let rows=localAdminOrders().filter(r=>r?.orderId!==row.orderId);rows.unshift(row);rows=rows.slice(0,25);writeArray('westtechha-coaster-local-admin-orders',rows);try{localStorage.setItem('westtechha-coaster-local-admin-order',JSON.stringify(row));}catch(e){}}
  function sanitizeSvg(svgText){try{const d=new DOMParser().parseFromString(svgText,'image/svg+xml');if(d.querySelector('parsererror')||d.documentElement.tagName.toLowerCase()!=='svg')return '';d.querySelectorAll('script,foreignObject,iframe,object,embed').forEach(e=>e.remove());d.querySelectorAll('*').forEach(e=>Array.from(e.attributes||[]).forEach(a=>{if(a.name.toLowerCase().startsWith('on'))e.removeAttribute(a.name);if(['href','xlink:href'].includes(a.name.toLowerCase())&&String(a.value).trim().toLowerCase().startsWith('javascript:'))e.removeAttribute(a.name);}));const svg=d.documentElement;svg.removeAttribute('width');svg.removeAttribute('height');svg.setAttribute('preserveAspectRatio','xMidYMid meet');return new XMLSerializer().serializeToString(svg);}catch(e){return '';}}

  async function loadApproval(){
    if(!orderId)throw new Error('This approval link is missing the order number.');
    if(isLocal){
      const row=localApprovals().find(r=>r?.orderId===orderId);if(!row)throw new Error('No local approval test is available for this order. Release a proof from the WestTech Order page first.');
      approval=row;
      const linkToken=params.get('approvalToken')||params.get('token')||'';
      if(linkToken&&approval.token&&linkToken!==approval.token)throw new Error('This local approval link is no longer current. Generate a fresh link from the Order page.');
      return;
    }
    if(!privateToken)throw new Error('This approval link is missing its private token.');
    const r=await fetch(`/api/coasters/orders/${encodeURIComponent(orderId)}/approval?token=${encodeURIComponent(privateToken)}`,{headers:{Accept:'application/json'}});const data=await r.json().catch(()=>({}));if(!r.ok||!data.ok)throw new Error(data.message||'Could not load this proof.');approval=data.approval;
  }

  async function captureReturnedPayPal(confirmTax=false){
    if(isLocal||!paymentReturn||!paypalReturnOrderId||!privateToken)return;
    const target=confirmTax?$('#cap-tax-message'):$('#cap-message');
    if(target){target.hidden=false;target.className='cap-message';target.textContent=confirmTax?'Completing your payment…':'PayPal approved. Calculating the destination tax and preparing your payment…';}
    const r=await fetch(`/api/coasters/orders/${encodeURIComponent(orderId)}/payment/capture`,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({approvalToken:privateToken,paypalOrderId:paypalReturnOrderId,confirmTax})});
    const data=await r.json().catch(()=>({}));if(!r.ok||!data.ok)throw new Error(data.message||'PayPal approved the payment, but WestTech could not finalize it. Please contact WestTech with your order number.');
    approval=data.approval;
    if(data.taxConfirmationRequired){
      taxReview=data.taxReview||null;
      return;
    }
    taxReview=null;
    history.replaceState({},'',new URL(`order-approval.html?order=${encodeURIComponent(orderId)}&approvalToken=${encodeURIComponent(privateToken)}`,location.href).href);
  }

  function renderTaxReview(){
    const card=$('#cap-tax-card'),actions=$('#cap-actions');if(!card||!actions)return;
    if(!taxReview){card.hidden=true;actions.hidden=false;return;}
    card.hidden=false;actions.hidden=true;
    const a=taxReview.address||{},lines=[a.fullName,a.address1,a.address2,[a.city,a.state,a.postalCode].filter(Boolean).join(', ').replace(', '+(a.postalCode||''),' '+(a.postalCode||''))].filter(Boolean);
    $('#cap-tax-address').textContent=lines.join('\n');
    const pickup=taxReview.addressSource==='WESTTECH_PICKUP';
    $('#cap-tax-intro').textContent=pickup?'This local-pickup order uses WestTech’s pickup address for the Colorado tax calculation. The address is locked.':'PayPal returned this shipping address. It is locked here so the tax quote and fulfillment address stay identical.';
    $('#cap-tax-confirm-copy').textContent=pickup?'I understand this order is for pickup at the WestTech address shown above and Colorado sales tax is based on that location.':'I verified that this PayPal shipping address is correct and understand Colorado sales tax is based on it.';
    $('#cap-tax-subtotal').textContent=fmt(taxReview.taxableAmount);$('#cap-tax-shipping').textContent=fmt(taxReview.shippingAmount);$('#cap-tax-shipping-row').hidden=money(taxReview.shippingAmount)===0;
    $('#cap-tax-review-amount').textContent=fmt(taxReview.taxAmount);$('#cap-tax-rate').textContent=taxReview.taxRate?'('+(Number(taxReview.taxRate)*100).toFixed(3).replace(/0+$/,'').replace(/\.$/,'')+'%)':'';
    $('#cap-tax-total').textContent=fmt(taxReview.totalAmount);$('#cap-tax-confirm').checked=false;$('#cap-complete-order').disabled=true;$('#cap-tax-message').hidden=true;
    $('#cap-status').textContent='TAX CONFIRMATION';$('#cap-status').classList.add('approved');
  }

  async function completeOrder(){
    if(!taxReview||!$('#cap-tax-confirm').checked)return;
    const button=$('#cap-complete-order'),original=button.textContent;button.disabled=true;button.textContent='Completing Order…';
    try{await captureReturnedPayPal(true);render();}
    catch(e){const el=$('#cap-tax-message');el.hidden=false;el.className='cap-message error';el.textContent=e.message||'Could not complete the payment.';button.disabled=false;button.textContent=original;}
  }

  async function renderProof(){
    const host=$('#cap-proof');host.innerHTML='<div class="cap-proof-loading">Loading proof…</div>';
    if(isLocal){
      if(approval.proofSource==='UPLOADED'){
        if(String(approval.proofContentType||'').includes('pdf'))host.innerHTML=`<embed src="${esc(approval.proofData)}" type="application/pdf"/>`;
        else host.innerHTML=`<img src="${esc(approval.proofData)}" alt="WestTech customer proof"/>`;
      }else{const safe=sanitizeSvg(approval.proofData||'');host.innerHTML=safe||'<div class="cap-proof-loading">Proof could not be displayed.</div>';}
      return;
    }
    const proofUrl=`/api/coasters/orders/${encodeURIComponent(orderId)}/approval/proof?token=${encodeURIComponent(privateToken)}`;
    if(String(approval.proofContentType||'').includes('pdf'))host.innerHTML=`<embed src="${proofUrl}" type="application/pdf"/>`;
    else host.innerHTML=`<img src="${proofUrl}" alt="WestTech customer proof"/>`;
  }

  function render(){
    $('#cap-loading').hidden=true;$('#cap-content').hidden=false;
    $('#cap-order-id').textContent=`Order ${approval.orderId}`;$('#cap-proof-version').textContent=`V${Number(approval.proofVersion||1)}`;
    $('#cap-set').textContent=`${Number(approval.setSize||4)}-Coaster Set`;$('#cap-set-count').textContent=String(approval.setCount||1);$('#cap-total-coasters').textContent=String(approval.totalCoasters||approval.setSize||4);$('#cap-fulfillment').textContent=fulfillment(approval.fulfillmentMethod);
    const designWork=money(approval.artworkCharge)+money(approval.billableWorkTotal);
    const payStatus=String(approval.paymentStatus||'').toUpperCase(),paid=payStatus==='PAID';const knownTax=taxReview?money(taxReview.taxAmount):money(approval.taxAmount);const knownPaymentTotal=taxReview?money(taxReview.totalAmount):(money(approval.paymentTotal)||money(approval.finalAmount));const showPaymentTotal=!!taxReview||paid;
    $('#cap-base-total').textContent=fmt(money(approval.basePrice)*Math.max(1,Number(approval.setCount||1)));$('#cap-art-charge').textContent=fmt(designWork);$('#cap-other-charge').textContent=fmt(approval.otherCharge);$('#cap-shipping').textContent=fmt(approval.shippingAmount);$('#cap-discount').textContent=`−${fmt(approval.discountAmount)}`;$('#cap-tax-amount').textContent=fmt(knownTax);$('#cap-final-total').textContent=fmt(showPaymentTotal?knownPaymentTotal:approval.finalAmount);$('#cap-total-label').textContent=showPaymentTotal?'PAYMENT TOTAL':'APPROVED SUBTOTAL';
    $('#cap-art-row').hidden=designWork===0;$('#cap-other-row').hidden=money(approval.otherCharge)===0;$('#cap-shipping-row').hidden=money(approval.shippingAmount)===0;$('#cap-tax-row').hidden=knownTax===0;$('#cap-discount-row').hidden=money(approval.discountAmount)===0;
    const shipped=approval.fulfillmentMethod==='SHIP';
    $('#cap-paypal-address-card').hidden=!(shipped&&approval.paymentRequired);
    if(approval.paymentRequired){
      $('#cap-payment-note').textContent=shipped?'After approval, continue to PayPal and confirm the shipping address. Colorado destinations add address-based sales tax before capture; out-of-state shipments do not.':'After approval, Colorado sales tax is calculated using WestTech’s pickup address before PayPal captures payment.';
    }else $('#cap-payment-note').textContent='WestTech has marked this order as no-charge. No payment will be requested after approval.';
    if(approval.customerReviewNote){$('#cap-note-card').hidden=false;$('#cap-review-note').textContent=approval.customerReviewNote;}else $('#cap-note-card').hidden=true;

    const status=String(approval.proofStatus||'SENT');
    if(status==='APPROVED'){
      $('#cap-status').textContent='APPROVED';$('#cap-status').classList.add('approved');
      if(!approval.paymentRequired||payStatus==='NOT_REQUIRED')$('#cap-actions').innerHTML='<div class="cap-complete"><strong>Proof approved.</strong>No payment is required. Your order is now in the WestTech production queue.</div>';
      else if(payStatus==='PAID')$('#cap-actions').innerHTML='<div class="cap-complete"><strong>Proof approved + paid.</strong>Thank you. Your order is now in the WestTech production queue.</div>';
      else if(approval.paypalApprovalUrl)$('#cap-actions').innerHTML=`<div class="cap-complete"><strong>Proof approved.</strong>Continue to PayPal to complete payment${shipped?' and confirm your shipping address':''}.</div><a class="cap-primary" href="${esc(approval.paypalApprovalUrl)}">Continue to PayPal →</a>`;
      else if(isLocal&&approval.paypalOrderId)$('#cap-actions').innerHTML='<div class="cap-complete"><strong>Proof approved.</strong>Local test: PayPal checkout is ready. Return to the WestTech Order page and use Mark Paid (Local Test). For a shipped local test, the paid step will simulate the address PayPal would return.</div>';
      else if(payStatus==='PAYPAL_ERROR')$('#cap-actions').innerHTML='<div class="cap-complete"><strong>Proof approved.</strong>WestTech has your approval. The PayPal checkout needs a quick WestTech check.</div>';
      else $('#cap-actions').innerHTML='<div class="cap-complete"><strong>Proof approved.</strong>Your PayPal checkout is being prepared automatically.</div>';
    }else if(status==='CHANGES_REQUESTED'){
      $('#cap-status').textContent='CHANGES REQUESTED';$('#cap-status').classList.add('changes');$('#cap-actions').innerHTML='<div class="cap-complete"><strong>Changes requested.</strong>WestTech has received your request and will prepare the next proof.</div>';
    }
    renderTaxReview();
    renderProof();
  }

  async function act(action){
    if(String(approval?.paymentStatus||'').toUpperCase()==='PAID'||['PRODUCTION_QUEUE','IN_PRODUCTION','READY_FOR_PICKUP','SHIPPED','COMPLETED'].includes(String(approval?.status||'').toUpperCase())){message('This order is already queued or in production. The approved design and terms are locked.','error');return;}
    const note=$('#cap-change')?.value.trim()||'';if(action==='requestChanges'&&note.length<2)return message('Please tell WestTech what you would like changed.','error');
    const button=action==='approve'?$('#cap-approve'):$('#cap-request-change');const original=button.textContent;button.disabled=true;button.textContent=action==='approve'?'Recording approval…':'Sending request…';
    try{
      if(isLocal){
        approval.proofStatus=action==='approve'?'APPROVED':'CHANGES_REQUESTED';approval.status=action==='approve'?'PROOF_APPROVED':'CHANGES_REQUESTED';if(action==='requestChanges')approval.customerChangeRequest=note;
        const adminRows=localAdminOrders();let admin=adminRows.find(r=>r?.orderId===orderId)||{};
        if(action==='approve'){
          if(approval.paymentRequired){approval.paypalOrderId=`LOCAL-PP-${Date.now().toString(36).toUpperCase()}`;approval.paypalOrderStatus='PAYER_ACTION_REQUIRED';approval.paymentStatus='AWAITING_PAYMENT';approval.status='AWAITING_PAYMENT';}
          else{approval.paymentStatus='NOT_REQUIRED';approval.status='PRODUCTION_QUEUE';}
        }
        saveLocalApproval(approval);
        if(admin.orderId===orderId){admin.proofStatus=approval.proofStatus;admin.status=approval.status;admin.customerChangeRequest=approval.customerChangeRequest||'';admin.paymentStatus=approval.paymentStatus||admin.paymentStatus;admin.paypalOrderId=approval.paypalOrderId||admin.paypalOrderId;admin.paypalOrderStatus=approval.paypalOrderStatus||admin.paypalOrderStatus;admin.updatedAt=new Date().toISOString();admin.events=admin.events||[];admin.events.push({eventType:action==='approve'?'CUSTOMER_PROOF_APPROVED':'CUSTOMER_CHANGES_REQUESTED',detail:JSON.stringify({proofVersion:approval.proofVersion,message:note||undefined}),createdAt:new Date().toISOString()});if(action==='approve'){admin.events.push({eventType:approval.paymentRequired?'PAYPAL_ORDER_CREATED':'PAYMENT_NOT_REQUIRED',detail:JSON.stringify({paypalOrderId:approval.paypalOrderId||null,amount:approval.finalAmount,addressSource:approval.fulfillmentMethod==='SHIP'?'PAYPAL':'NONE'}),createdAt:new Date().toISOString()});admin.events.push({eventType:'EMAIL_SENT',detail:JSON.stringify({emailType:approval.paymentRequired?'PAYMENT_REQUIRED':'PRODUCTION_QUEUED',to:admin.customerEmail,provider:'LOCAL_TEST',localSimulation:true}),createdAt:new Date().toISOString()});}else admin.events.push({eventType:'EMAIL_SENT',detail:JSON.stringify({emailType:'CHANGES_REQUESTED',to:admin.customerEmail,provider:'LOCAL_TEST',localSimulation:true}),createdAt:new Date().toISOString()});saveLocalAdmin(admin);}
      }else{
        const r=await fetch(`/api/coasters/orders/${encodeURIComponent(orderId)}/approval`,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({token:privateToken,action,message:note})});const data=await r.json().catch(()=>({}));if(!r.ok||!data.ok)throw new Error(data.message||'Could not update the proof.');approval=data.approval;if(data.paymentWarning)message('Your proof is approved. WestTech is finishing the PayPal checkout setup.','');
      }
      render();
    }catch(e){message(e.message||'Could not update the proof.','error');button.disabled=false;button.textContent=original;}
  }

  async function boot(){
    try{await loadApproval();if(paymentCancelled)message('PayPal payment was cancelled. Your approved proof is still saved; you can continue to PayPal whenever you are ready.','');if(paymentReturn){await captureReturnedPayPal();}render();}
    catch(e){showError(e.message||'Could not load this proof.');}
  }
  $('#cap-confirm').addEventListener('change',()=>{$('#cap-approve').disabled=!$('#cap-confirm').checked;});$('#cap-approve').addEventListener('click',()=>act('approve'));$('#cap-request-change').addEventListener('click',()=>act('requestChanges'));$('#cap-tax-confirm').addEventListener('change',()=>{$('#cap-complete-order').disabled=!$('#cap-tax-confirm').checked;});$('#cap-complete-order').addEventListener('click',completeOrder);
  boot();
})();
