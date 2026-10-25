(()=>{'use strict';
 const $=s=>document.querySelector(s),money=n=>'$'+Number(n||0).toFixed(2);
 const state={invoices:[],selected:null,link:'',quote:null,busy:false};
 const msg=(m,isError=false)=>{const el=$('#ws-msg');el.hidden=!m;el.textContent=m;el.style.borderColor=isError?'#f4a3a3':'#6da8ca';};
 const auth=()=>{const v=sessionStorage.getItem('westtechha-admin-token')||'cloudflare-access';return {'Authorization':'Bearer '+v};};
 async function api(url,opts={}){const res=await fetch(url,{credentials:'same-origin',headers:{...auth(),Accept:'application/json',...(opts.body?{'Content-Type':'application/json'}:{})},...opts});const data=await res.json().catch(()=>({}));if(!res.ok||!data.ok)throw Error(data.message||'Sales request failed.');return data;}
 // Catalog prices are known for coaster sets. Enclosure package prices vary: never invent one.
 const catalog=[
  {family:'Coasters',choices:[['coaster4','4-Coaster Set','19.99'],['coaster8','8-Coaster Set','29.99']]},
  {family:'ESP32 Enclosures',choices:[['scout','WestTech Scout ESP32 Enclosure',''],['ranger','WestTech Ranger ESP32 Enclosure',''],['command','WestTech Command ESP32 Enclosure','']]},
  {family:'Other',choices:[['custom','Custom Item','']]}
 ];
 function createLine(des='',qty='1',regular='0.00',price='0.00'){
  const line=document.createElement('div');line.className='ws-line';
  const cell=document.createElement('div');cell.className='ws-product-cell';
  const picker=document.createElement('select');picker.setAttribute('aria-label','Choose product');
  const blank=document.createElement('option');blank.value='';blank.textContent='-- Select a product --';picker.append(blank);
  for(const group of catalog){const optgroup=document.createElement('optgroup');optgroup.label=group.family;for(const [id,title] of group.choices){const opt=document.createElement('option');opt.value=id;opt.textContent=title;optgroup.append(opt);}picker.append(optgroup);}
  const description=document.createElement('input');description.dataset.field='description';description.placeholder='Description';description.maxLength=160;description.required=true;description.value=des;
  cell.append(picker,description);line.append(cell);
  const inputs={description};
  for(const [field,value,placeholder] of [['quantity',qty,'Qty'],['regularPrice',regular,'Regular'],['unitPrice',price,'Sell for']]){
   const input=document.createElement('input');input.dataset.field=field;input.value=value;input.placeholder=placeholder;input.required=true;
   if(field==='quantity'){input.inputMode='numeric';input.type='number';input.min='1';input.max='999';input.step='1';}
   if(field==='regularPrice'||field==='unitPrice')input.inputMode='decimal';
   input.addEventListener('input',invalidate);inputs[field]=input;line.append(input);
  }
  picker.addEventListener('change',()=>{const selected=catalog.flatMap(x=>x.choices).find(x=>x[0]===picker.value);if(!selected)return;
   description.value=picker.value==='custom'?'':selected[1];
   inputs.regularPrice.value=selected[2]||'0.00';inputs.unitPrice.value=selected[2]||'0.00';invalidate();
  });
  description.addEventListener('input',invalidate);
  const known=catalog.flatMap(x=>x.choices).find(x=>x[1]===des);picker.value=known?known[0]:(des?'custom':'');
  const remove=document.createElement('button');remove.type='button';remove.textContent='×';remove.title='Remove item';remove.addEventListener('click',()=>{if($('#ws-lines').children.length>1){line.remove();invalidate();}});line.append(remove);$('#ws-lines').append(line);
 }
 function invalidate(){state.quote=null;$('#ws-quote-result').textContent='Amounts changed. Calculate tax and total again before saving.';}
 function payload(){const f=$('#ws-form'),d=new FormData(f);return {saleType:d.get('saleType'),customerName:d.get('customerName'),customerPhone:d.get('customerPhone'),customerEmail:d.get('customerEmail'),locationLabel:d.get('locationLabel'),address:{fullName:d.get('customerName')||'WestTech customer',address1:d.get('address1'),city:d.get('city'),state:d.get('state'),postalCode:d.get('postalCode'),countryCode:'US'},shipping:d.get('shipping'),notes:d.get('notes'),discountReason:d.get('discountReason'),taxExempt:$('#ws-exempt').checked,exemptReason:$('#ws-exempt').checked?$('#ws-reason').value:'',items:[...$('#ws-lines').children].map(el=>Object.fromEntries([...el.querySelectorAll('input')].map(x=>[x.dataset.field,x.value])))};}
 function busy(yes){state.busy=yes;$('#ws-quote').disabled=yes;$('#ws-create').disabled=yes;}
 async function quote(){busy(true);msg('');try{const data=await api('/api/admin/sales',{method:'POST',body:JSON.stringify({action:'quote',sale:payload()})});state.quote=data.quote;$('#ws-quote-result').textContent=`Regular value: ${money(data.quote.regular)}\nPrice overrides / discounts: -${money(data.quote.discount)}\nSelling subtotal: ${money(data.quote.subtotal)}\nShipping: ${money(data.quote.shipping)}\nSales tax (${(data.quote.taxRate*100).toFixed(3)}%): ${money(data.quote.tax)}\nTOTAL DUE: ${money(data.quote.total)}\nTax source: ${data.quote.taxSource}`;return data.quote;}catch(e){msg(e.message,true);return null;}finally{busy(false);}}
 async function create(ev){ev.preventDefault();if(state.busy)return;if(!state.quote){msg('Calculate and review sales tax and total before creating the invoice.',true);return;}busy(true);msg('');try{const result=await api('/api/admin/sales',{method:'POST',body:JSON.stringify({action:'create',sale:payload(),expectedTotal:state.quote.total})});msg('Created '+result.invoice.invoice_number+'. Select the payment method or share the link.');reset();await load();await detail(result.invoice.id);}catch(e){msg(e.message,true);}finally{busy(false);}}
 function reset(){const f=$('#ws-form');f.reset();$('#ws-lines').replaceChildren();createLine();$('#ws-reason').value='';$('#ws-exempt-reason').hidden=true;$('#ws-create').textContent='Create Sale / Invoice';state.quote=null;$('#ws-quote-result').textContent='Select a product or enter a custom item, then calculate tax and total.';}
 function filterRows(){const q=$('#ws-search').value.trim().toLowerCase(),list=$('#ws-history');list.replaceChildren();const rows=state.invoices.filter(x=>[x.invoice_number,x.customer_name,x.customer_phone,x.customer_email,x.status,x.location_label].join(' ').toLowerCase().includes(q));if(!rows.length){const p=document.createElement('p');p.className='ws-empty';p.textContent='No sales found.';list.append(p);return;}for(const row of rows){const btn=document.createElement('button');btn.type='button';btn.setAttribute('aria-current',String(state.selected===row.id));const a=document.createElement('span'),b=document.createElement('span');a.textContent=row.invoice_number+' • '+(row.customer_name||'Walk-in');const small=document.createElement('small');small.textContent=row.created_at+' · '+row.status;a.append(small);b.textContent=money(row.total);btn.append(a,b);btn.onclick=()=>detail(row.id);list.append(btn);}}
 async function load(){try{const data=await api('/api/admin/sales');state.invoices=data.invoices;$('#ws-paid').textContent=money(data.totals.paidCents);$('#ws-tax').textContent=money(data.totals.taxCents);$('#ws-discount').textContent=money(data.totals.discountCents);$('#ws-checks').textContent=money(data.totals.checkPendingCents);filterRows();}catch(e){msg(e.message,true);}}
 function actionButton(label,act,confirmText=''){const b=document.createElement('button');b.type='button';b.textContent=label;b.onclick=async()=>{if(confirmText&&!confirm(confirmText))return;b.disabled=true;try{const data=await api('/api/admin/sales/'+state.selected,{method:'POST',body:JSON.stringify({action:act})});msg(label+' completed for '+data.invoice.invoice_number);await load();await detail(data.invoice.id);}catch(e){msg(e.message,true);}finally{b.disabled=false;}};$('#ws-detail-actions').append(b);}
 async function detail(id){try{const data=await api('/api/admin/sales/'+id),r=data.invoice;state.selected=r.id;state.link=data.link;filterRows();$('#ws-detail').hidden=false;const info=$('#ws-detail-info');info.replaceChildren();
 const section=(title)=>{const el=document.createElement('section');el.className='ws-invoice-section';const head=document.createElement('h4');head.textContent=title;el.append(head);info.append(el);return el;};
 const line=(parent,label,value,strong=false)=>{const el=document.createElement('div');el.className='ws-invoice-row'+(strong?' ws-invoice-total':'');const key=document.createElement('span');key.textContent=label;const val=document.createElement('strong');val.textContent=value;el.append(key,val);parent.append(el);};
 const head=section('Invoice '+r.invoice_number);
 line(head,'Status',r.status);line(head,'Customer',r.customer_name||'Walk-in');if(r.customer_phone)line(head,'Phone',r.customer_phone);if(r.customer_email)line(head,'Email',r.customer_email);line(head,'Location',r.location_label||'WestTech walk-in');
 const items=section('Items');for(const item of r.items)line(items,item.quantity+' × '+item.description,money(item.lineTotal));
 const totals=section('Payment summary');line(totals,'Regular value',money(r.regular));if(Number(r.discount)>0)line(totals,'Discount','−'+money(r.discount));line(totals,'Selling subtotal',money(r.subtotal));line(totals,'Shipping',money(r.shipping));line(totals,'Sales tax',money(r.tax));line(totals,'Total',money(r.total),true);
 const pay=section('Payment');line(pay,'Payment method',r.payment_method||'Not paid');line(pay,'Payment status',r.status);if(r.discount_reason)line(pay,'Discount reason',r.discount_reason);if(r.exempt_reason)line(pay,'Tax exemption',r.exempt_reason);if(r.notes)line(pay,'Notes',r.notes);
 $('#ws-detail-actions').replaceChildren();const linkBox=$('#ws-link');linkBox.hidden=!['DRAFT','SENT','PAYMENT_PENDING'].includes(r.status)||Number(r.total)===0;$('#ws-link-text').value=data.link;$('#ws-open').href=data.link;$('#ws-qr-host').hidden=true;$('#ws-qr-host').replaceChildren();
 if(r.status==='DRAFT'&&Number(r.total)===0)actionButton('Record Complimentary Sale','comp','Close this $0 sale as complimentary?');
 if(['DRAFT','SENT'].includes(r.status)&&Number(r.total)>0){actionButton('Record Cash','cash','Confirm actual cash received for '+r.invoice_number+'?');actionButton('Record Check','check','Record a check received, awaiting clearance?');}
 if(r.status==='CHECK_PENDING')actionButton('Mark Check Cleared','check-cleared','Confirm the check has cleared your bank?');
 if(r.status==='DRAFT'&&r.customer_email&&Number(r.total)>0)actionButton('Email Invoice','send','Send this invoice once to '+r.customer_email+'?');
 if(['DRAFT','SENT'].includes(r.status))actionButton('Void Invoice','void','Void this unpaid invoice permanently?');
 }catch(e){msg(e.message,true);}}
 function csv(){const header=['Invoice','Created','Status','Customer','Phone','Email','Location','Regular','Discount','Subtotal','Shipping','Tax','Total','Method','PaidAt','Exemption','Discount Reason','Notes'];const rows=state.invoices.map(r=>[r.invoice_number,r.created_at,r.status,r.customer_name,r.customer_phone,r.customer_email,r.location_label,r.regular,r.discount,r.subtotal,r.shipping,r.tax,r.total,r.payment_method,r.paid_at,r.exempt_reason,r.discount_reason,r.notes]);const safe=v=>'"'+String(v??'').replace(/^[=+@-]/,x=>"'"+x).replaceAll('"','""')+'"';const data=[header,...rows].map(r=>r.map(safe).join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([data],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='WestTechHA-Sales-'+new Date().toISOString().slice(0,10)+'.csv';a.click();URL.revokeObjectURL(url);}
 $('#ws-form').addEventListener('input',invalidate);$('#ws-form').addEventListener('change',invalidate);$('#ws-form').addEventListener('submit',create);$('#ws-add').onclick=()=>{if($('#ws-lines').children.length<20){createLine('',1,'0.00','0.00');invalidate();}};$('#ws-quote').onclick=quote;$('#ws-reset').onclick=reset;$('#ws-reload').onclick=load;$('#ws-search').oninput=filterRows;$('#ws-export').onclick=csv;
 $('#ws-type').onchange=()=>{$('#ws-create').textContent=$('#ws-type').value==='INVOICE'?'Create Invoice':'Create Sale';invalidate();};$('#ws-exempt').onchange=()=>{$('#ws-exempt-reason').hidden=!$('#ws-exempt').checked;invalidate();};
 $('#ws-copy').onclick=async()=>{try{await navigator.clipboard.writeText(state.link);msg('Payment link copied.');}catch{const e=$('#ws-link-text');e.select();msg('Payment link selected. Copy it manually.');}};
 $('#ws-share').onclick=async()=>{
  if(!state.link)return;
  if(navigator.share){try{await navigator.share({title:'WestTechHA invoice payment',text:'Open your WestTech invoice to pay securely with PayPal or eligible Venmo.',url:state.link});return;}catch(e){if(e.name==='AbortError')return;}}
  try{await navigator.clipboard.writeText(state.link);msg('Payment link copied. Paste it into your text message.');}
  catch{const e=$('#ws-link-text');e.select();msg('Select and copy the payment link, then send it by text.',false);}
 };
 $('#ws-email-me').onclick=async()=>{if(!state.selected)return;const btn=$('#ws-email-me');btn.disabled=true;try{const result=await api('/api/admin/sales/'+state.selected,{method:'POST',body:JSON.stringify({action:'email-owner'})});msg('Payment link emailed to '+result.to+'. Forward it to your customer.');}catch(e){msg(e.message,true);}finally{btn.disabled=false;}};
 $('#ws-qr').onclick=()=>{const host=$('#ws-qr-host');host.hidden=false;host.replaceChildren();if(typeof QRCode==='undefined'){host.textContent='QR library is unavailable. Copy the payment link instead.';return;}new QRCode(host,{text:state.link,width:224,height:224,correctLevel:QRCode.CorrectLevel.M});};
 reset();load();
})();
