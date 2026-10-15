(function(){
 'use strict';
 const $=s=>document.querySelector(s);
 const KEY='westtechha-sports-order-pending-v1';
 const CONTACT='westtechha-customer-contact-v1';
 const available=new Set(['VERIZON','TMOBILE','METRO','MINT','VISIBLE','XFINITY','BOOST','CRICKET','US_CELLULAR','GOOGLE_FI']);
 let data=null;
 try{data=JSON.parse(sessionStorage.getItem(KEY)||'null');}catch{}
 if(!data||!data.png||!data.svg||Date.now()-data.createdAt>60*60*1000){$('#so-title').textContent='Your design is no longer available';$('#so-detail').textContent='Please choose your coaster again.';$('#so-form').hidden=true;return;}
 const house=data.kind==='house';
 const title=house?`${data.side1} / ${data.side2}`:data.team;
 const details=house?`House Divided · ${data.artworkStyle} · ${data.centerMode}`:`Single Team · ${data.artworkStyle}`;
 $('#so-art').src=data.png;$('#so-title').textContent=title;$('#so-detail').textContent=`${details} · NFL · Choose your set size`;
 $('#so-back').href=data.returnUrl;
 $('#so-set-size').value=String(data.setSize)==='8'?'8':'4';
 try{const old=JSON.parse(localStorage.getItem(CONTACT)||'null');if(old){$('#so-name').value=old.name||'';$('#so-email').value=old.email||'';$('#so-phone').value=old.phone||'';$('#so-carrier').value=old.mobileCarrier||'';$('#so-communication').value=old.communicationPreference||'EMAIL';$('#so-sms-consent').checked=old.smsConsent===true;}}catch{}
 const show=message=>{const feedback=$('#so-feedback');feedback.hidden=false;feedback.textContent=message;};
 $('#so-form').addEventListener('submit',async e=>{
   e.preventDefault();const button=$('#so-submit');
   const name=$('#so-name').value.trim(),email=$('#so-email').value.trim(),phone=$('#so-phone').value.trim(),carrier=$('#so-carrier').value,communication=$('#so-communication').value;
   const consent=$('#so-sms-consent').checked;
   if(name.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||phone.replace(/\D/g,'').length<10||!carrier){show('Please enter your name, valid email, mobile number, and carrier.');return;}
   if(communication==='SMS'&&(!consent||!available.has(carrier))){show('Text notifications require your consent and a supported mobile carrier. Otherwise choose Email.');return;}
   button.disabled=true;button.textContent='Sending request…';$('#so-feedback').hidden=true;
   try{
     const fields=new FormData();
     const response=await fetch(data.png);const art=await response.blob();
     fields.append('artwork',new File([art],'westtech-team-art-preview.png',{type:'image/png'}));
     fields.append('designSnapshot',data.svg);
     fields.append('customerName',name);fields.append('customerEmail',email);fields.append('customerPhone',phone);
     fields.append('mobileCarrier',carrier);fields.append('communicationPreference',communication);fields.append('smsConsent',String(consent));
     fields.append('setSize',$('#so-set-size').value);
     fields.append('topText',house?'HOUSE':data.topText||'');fields.append('bottomText',house?'DIVIDED':data.bottomText||'');
     fields.append('fieldColor',house?`${data.side1} / ${data.side2}`:data.artworkStyle);
     fields.append('accentColor',house?`${data.side1Band} / ${data.side2Band}`:'WestTech Team Art');
     fields.append('ringColor',data.artworkStyle);fields.append('textColor',data.sport);
     const metadata=house?[
       'Type: House Divided','Sport: '+data.sport,'Side 1 / top: '+data.side1+' ['+data.side1Id+']',
       'Side 2 / bottom: '+data.side2+' ['+data.side2Id+']','Artwork style: '+data.artworkStyle,
       'Center mode: '+data.centerMode,'Side 1 band: '+data.side1Band+' ('+data.side1BandId+')',
       'Side 2 band: '+data.side2Band+' ('+data.side2BandId+')',
       'Side 1 house accent: '+data.side1HouseAccent,'Side 2 house accent: '+data.side2HouseAccent
     ]:[ 'Type: Single Team','Sport: '+data.sport,'Team: '+data.team+' ['+data.teamId+']','Artwork style: '+data.artworkStyle ];
     fields.append('notes',[...metadata,'Customer notes: '+$('#so-notes').value.trim()].join('\n'));
     // WestTech's own library artwork; no customer-uploaded IP claim is needed.
     fields.append('rightsConfirmed','true');fields.append('website',$('#so-website').value);
     if(location.protocol==='file:')throw new Error('Live order submission needs the published website. No request was sent.');
     const result=await fetch('/api/coasters/orders',{method:'POST',body:fields,headers:{Accept:'application/json'}});
     let payload={};try{payload=await result.json();}catch{}
     if(!result.ok||!payload.ok||!payload.orderId)throw new Error(payload.message||'Order request could not be submitted. Please retry.');
     try{localStorage.setItem(CONTACT,JSON.stringify({name,email,phone,mobileCarrier:carrier,communicationPreference:communication,smsConsent:consent}));}catch{}
     sessionStorage.removeItem(KEY);
     location.href='request-received.html?order='+encodeURIComponent(payload.orderId);
   }catch(error){show(error.message||'Could not submit. Please try again.');button.disabled=false;button.textContent='Send to WestTech for Review →';}
 });
})();
