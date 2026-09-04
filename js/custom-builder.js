(function(){
  'use strict';
  const palette = [
    ['white','White','#f5f5f2','SUNLU White'],['warm-white','Warm White','#e9e2d4','SUNLU Bone White'],['light-gray','Silver / Light Gray','#c4c8cc','SUNLU Silver'],['gray','Gray','#8d949b','SUNLU Grey'],['black','Black','#111317','SUNLU Black'],['red','Cherry Red','#d9232e','SUNLU Cherry Red'],['dark-red','Dark Red','#8b1e2d','SUNLU Red'],['orange','Sunny Orange','#f26a21','SUNLU Sunny Orange'],['yellow','Yellow','#f4c430','SUNLU Yellow'],['green','Green','#168b55','SUNLU Green'],['dark-green','Olive / Dark Green','#1e4c3b','SUNLU Olive Green'],['royal-blue','Klein / Royal Blue','#2447b8','SUNLU Blue (Klein Blue)'],['light-blue','Sky Blue','#67aee8','SUNLU Sky Blue'],['cyan','Cyan','#27b8cf','ELEGOO Cyan'],['purple','Purple','#5f3ba8','SUNLU Purple'],['brown','Coffee Brown','#6f4a2c','SUNLU Coffee Brown']
  ].map(([id,label,hex,filament])=>({id,label,hex,filament}));
  const byId=Object.fromEntries(palette.map(c=>[c.id,c]));
  const $=s=>document.querySelector(s);
  const form=$('#cb-order-form');
  const submit=$('#cb-submit');
  const submitDefaultHtml=submit.innerHTML;
  const submitRightsHtml='Check the artwork permission box above <span aria-hidden="true">↑</span>';
  const message=$('#cb-message');
  let originalArtworkDataUrl='';
  let previewArtworkDataUrl='';

  function fillSelect(sel, selected){
    sel.innerHTML='';
    palette.forEach(c=>{const o=document.createElement('option');o.value=c.id;o.textContent=c.label;sel.appendChild(o);});
    sel.value=selected;
  }
  fillSelect($('#cb-field-color'),'orange'); fillSelect($('#cb-accent-color'),'royal-blue'); fillSelect($('#cb-ring-color'),'white'); fillSelect($('#cb-text-color'),'royal-blue');

  function renderLetters(group,text,position){
    const value=(text||'').toUpperCase(); const chars=[...value]; const slots=Math.max(chars.length,1); const nonSpace=value.replace(/\s+/g,'').length;
    const radius=position==='top'?395:403, start=position==='top'?-145:145, end=position==='top'?-35:35;
    let size=70; if(slots>=13)size=45; else if(slots>=11)size=50; else if(slots>=9)size=56; else if(slots>=8)size=61; else if(nonSpace<=5)size=73;
    group.innerHTML=''; group.setAttribute('aria-label',value);
    chars.forEach((ch,i)=>{if(ch===' ')return; const ratio=slots===1?.5:i/(slots-1); const angle=start+(end-start)*ratio; const rad=angle*Math.PI/180; const x=500+radius*Math.cos(rad), y=500+radius*Math.sin(rad), rotation=position==='top'?angle+90:angle-90; const t=document.createElementNS('http://www.w3.org/2000/svg','text'); t.setAttribute('x',x.toFixed(2));t.setAttribute('y',y.toFixed(2));t.setAttribute('transform',`rotate(${rotation.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)})`);t.setAttribute('text-anchor','middle');t.setAttribute('dominant-baseline','middle');t.setAttribute('font-size',size);t.textContent=ch;group.appendChild(t);});
  }
  function applyColors(){
    const map=[['field','cb-field-color'],['accent','cb-accent-color'],['ring','cb-ring-color'],['ring-text','cb-text-color']]; const coaster=$('#cb-coaster');
    map.forEach(([css,id])=>coaster.style.setProperty(`--${css}`,byId[$('#'+id).value].hex));
    $('#dot-field').style.background=byId[$('#cb-field-color').value].hex; $('#dot-accent').style.background=byId[$('#cb-accent-color').value].hex; $('#dot-ring').style.background=byId[$('#cb-ring-color').value].hex; $('#dot-text').style.background=byId[$('#cb-text-color').value].hex;
  }
  function updateText(){renderLetters($('#cb-top-text'),$('#cb-top').value||'YOUR','top');renderLetters($('#cb-bottom-text'),$('#cb-bottom').value||'DESIGN','bottom');}
  function emailLooksValid(value){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((value||'').trim());}
  function selectedSetSize(){const checked=document.querySelector('input[name="cb-set-size"]:checked');return checked?checked.value:'';}
  function updateReady(){
    const rights=$('#cb-rights');
    const busy=submit.dataset.busy==='true';
    const ready=!!$('#cb-file').files[0] && rights.checked && $('#cb-name').value.trim().length>=2 && emailLooksValid($('#cb-email').value) && !!selectedSetSize();
    submit.disabled=!ready || busy;
    if(!busy){
      const rightsMissing=!rights.checked;
      submit.classList.toggle('needs-rights',rightsMissing);
      submit.innerHTML=rightsMissing?submitRightsHtml:submitDefaultHtml;
      rights.closest('.cb-rights-check')?.classList.toggle('needs-attention',rightsMissing);
    }
  }
  function showMessage(text,type){
    message.hidden=false;message.textContent=text;message.classList.remove('is-error','is-success');
    if(type)message.classList.add(type==='error'?'is-error':'is-success');
  }

  function prepareArtworkPreview(dataUrl){
    return new Promise(resolve=>{
      const source=new Image();
      source.onload=()=>{
        try{
          const maxScan=1400;
          const naturalW=Math.max(1,source.naturalWidth||source.width||1);
          const naturalH=Math.max(1,source.naturalHeight||source.height||1);
          const scale=Math.min(1,maxScan/Math.max(naturalW,naturalH));
          const scanW=Math.max(1,Math.round(naturalW*scale));
          const scanH=Math.max(1,Math.round(naturalH*scale));
          const scan=document.createElement('canvas');scan.width=scanW;scan.height=scanH;
          const ctx=scan.getContext('2d',{willReadFrequently:true});if(!ctx){resolve(dataUrl);return;}
          ctx.clearRect(0,0,scanW,scanH);ctx.drawImage(source,0,0,scanW,scanH);
          const pixels=ctx.getImageData(0,0,scanW,scanH).data;const alphaThreshold=8;
          let minX=scanW,minY=scanH,maxX=-1,maxY=-1;
          for(let y=0;y<scanH;y++){for(let x=0;x<scanW;x++){const alpha=pixels[(y*scanW+x)*4+3];if(alpha>alphaThreshold){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}}}
          if(maxX<minX||maxY<minY){resolve(dataUrl);return;}
          const cropW=maxX-minX+1,cropH=maxY-minY+1;
          if(cropW>=scanW-2&&cropH>=scanH-2){resolve(dataUrl);return;}
          const crop=document.createElement('canvas');crop.width=cropW;crop.height=cropH;
          const cropCtx=crop.getContext('2d');if(!cropCtx){resolve(dataUrl);return;}
          cropCtx.clearRect(0,0,cropW,cropH);cropCtx.drawImage(scan,minX,minY,cropW,cropH,0,0,cropW,cropH);
          resolve(crop.toDataURL('image/png'));
        }catch(err){resolve(dataUrl);}
      };
      source.onerror=()=>resolve(dataUrl);source.src=dataUrl;
    });
  }

  $('#cb-file').addEventListener('change',e=>{
    const file=e.target.files[0];const img=$('#cb-art'),fb=$('#cb-art-fallback'),status=$('#cb-file-status');
    if(!file){img.removeAttribute('href');img.style.display='none';fb.style.display='block';status.textContent='No artwork loaded yet.';status.classList.remove('is-loaded');updateReady();return;}
    if(file.size>10*1024*1024){e.target.value='';img.removeAttribute('href');img.style.display='none';fb.style.display='block';status.textContent='Artwork must be 10 MB or smaller.';status.classList.remove('is-loaded');showMessage('That artwork file is larger than the 10 MB upload limit.','error');updateReady();return;}
    const reader=new FileReader();
    reader.addEventListener('load',async()=>{originalArtworkDataUrl=String(reader.result||'');const previewUrl=await prepareArtworkPreview(originalArtworkDataUrl);previewArtworkDataUrl=previewUrl;img.setAttribute('href',previewUrl);img.style.display='block';fb.style.display='none';status.textContent=`Loaded: ${file.name}`;status.classList.add('is-loaded');message.hidden=true;updateReady();});
    reader.addEventListener('error',()=>{img.removeAttribute('href');img.style.display='none';fb.style.display='block';status.textContent='Could not read that artwork file. Please try another PNG, JPG, WEBP, or SVG.';status.classList.remove('is-loaded');updateReady();});
    reader.readAsDataURL(file);
  });

  function buildSubmittedDesignSnapshot(){
    const source=$('#cb-coaster');
    if(!source)return '';
    const clone=source.cloneNode(true);
    clone.removeAttribute('id');
    clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
    clone.setAttribute('viewBox','0 0 1000 1000');
    clone.setAttribute('role','img');
    clone.setAttribute('aria-label','Customer submitted custom coaster design');
    clone.classList.add('wt-submitted-design-snapshot');
    const style=document.createElementNS('http://www.w3.org/2000/svg','style');
    style.textContent=`
      .cb-outer{fill:var(--ring);stroke:var(--outline);stroke-width:18}
      .cb-rim{fill:none;stroke:var(--accent);stroke-width:13}
      .cb-field{fill:var(--field);stroke:var(--accent);stroke-width:16}
      .cb-inner{fill:none;stroke:var(--outline);stroke-width:4;opacity:.7}
      .cb-ring-text{fill:var(--ring-text);font-family:"Copperplate Gothic Bold","Copperplate Gothic",Copperplate,serif;font-weight:700}
      .cb-art{pointer-events:none}.cb-art-fallback{font-family:Arial,sans-serif;font-size:94px;font-weight:950;fill:var(--ring-text);letter-spacing:-.05em}
    `;
    clone.insertBefore(style,clone.firstChild);
    return new XMLSerializer().serializeToString(clone);
  }

  function localTestOrder(){
    const now=new Date();
    const y=now.getFullYear(),m=String(now.getMonth()+1).padStart(2,'0'),d=String(now.getDate()).padStart(2,'0');
    return `LOCAL-WTCC-${y}${m}${d}-${Math.floor(1000+Math.random()*9000)}`;
  }

  async function submitLiveOrder(){
    const data=new FormData();
    data.append('artwork',$('#cb-file').files[0]);
    data.append('designSnapshot',buildSubmittedDesignSnapshot());
    data.append('customerName',$('#cb-name').value.trim());
    data.append('customerEmail',$('#cb-email').value.trim());
    data.append('customerPhone',$('#cb-phone').value.trim());
    data.append('setSize',selectedSetSize());
    data.append('topText',$('#cb-top').value.trim());
    data.append('bottomText',$('#cb-bottom').value.trim());
    data.append('fieldColor',$('#cb-field-color').value);
    data.append('accentColor',$('#cb-accent-color').value);
    data.append('ringColor',$('#cb-ring-color').value);
    data.append('textColor',$('#cb-text-color').value);
    data.append('notes',$('#cb-notes').value.trim());
    data.append('rightsConfirmed',$('#cb-rights').checked?'true':'false');
    data.append('website',$('#cb-website').value);

    const response=await fetch('/api/coasters/orders',{method:'POST',body:data,headers:{'Accept':'application/json'}});
    let result={};
    try{result=await response.json();}catch(err){result={};}
    if(!response.ok||!result.ok)throw new Error(result.message||'Could not submit the request. Please try again.');
    return result.orderId;
  }

  function saveLocalTest(orderId){
    const file=$('#cb-file').files[0]||null;
    const record={
      orderId,status:'LOCAL_TEST_ONLY',createdAt:new Date().toISOString(),customerName:$('#cb-name').value.trim(),customerEmail:$('#cb-email').value.trim(),customerPhone:$('#cb-phone').value.trim(),setSize:Number(selectedSetSize()),topText:$('#cb-top').value.trim(),bottomText:$('#cb-bottom').value.trim(),fieldColor:$('#cb-field-color').value,accentColor:$('#cb-accent-color').value,ringColor:$('#cb-ring-color').value,textColor:$('#cb-text-color').value,notes:$('#cb-notes').value.trim(),artworkFilename:file?.name||'',artworkSizeBytes:file?.size||0,artworkContentType:file?.type||''
    };
    if(originalArtworkDataUrl.startsWith('data:') && originalArtworkDataUrl.length<2500000)record.artworkOriginalUrl=originalArtworkDataUrl;
    const previewUrl=previewArtworkDataUrl || $('#cb-art').getAttribute('href')||'';
    if(previewUrl.startsWith('data:') && previewUrl.length<2500000){record.artworkPreviewUrl=previewUrl;record.artworkPreviewVersion='trim-alpha-center90-v1';}
    const designSnapshotSvg=buildSubmittedDesignSnapshot();
    if(designSnapshotSvg && designSnapshotSvg.length<3500000)record.designSnapshotSvg=designSnapshotSvg;
    try{
      const key='westtechha-coaster-local-orders';
      let rows=[];try{rows=JSON.parse(localStorage.getItem(key)||'[]');if(!Array.isArray(rows))rows=[];}catch(e){rows=[];}
      if(!rows.length){try{const legacy=JSON.parse(localStorage.getItem('westtechha-coaster-local-order')||'null');if(legacy?.orderId)rows=[legacy];}catch(e){}}
      rows=rows.filter(r=>r&&r.orderId!==record.orderId);rows.unshift(record);
      rows=rows.slice(0,25);localStorage.setItem(key,JSON.stringify(rows));
      localStorage.setItem('westtechha-coaster-local-order',JSON.stringify(record));
    }catch(err){}
  }

  $('#cb-top').addEventListener('input',updateText);$('#cb-bottom').addEventListener('input',updateText);$('#cb-rights').addEventListener('change',updateReady);
  ['cb-name','cb-email','cb-phone','cb-notes'].forEach(id=>{
    const el=$('#'+id);
    ['input','change','blur'].forEach(evt=>el.addEventListener(evt,updateReady));
    el.addEventListener('focus',()=>{setTimeout(updateReady,150);setTimeout(updateReady,700);});
  });
  window.addEventListener('pageshow',()=>setTimeout(updateReady,100));
  document.querySelectorAll('input[name="cb-set-size"]').forEach(el=>el.addEventListener('change',updateReady));
  ['cb-field-color','cb-accent-color','cb-ring-color','cb-text-color'].forEach(id=>$('#'+id).addEventListener('change',applyColors));

  form.addEventListener('submit',async e=>{
    e.preventDefault();updateReady();if(submit.disabled)return;
    submit.dataset.busy='true';submit.disabled=true;const original=submit.innerHTML;submit.textContent='Sending for Review…';message.hidden=true;
    try{
      let orderId='';let local=false;
      if(window.location.protocol==='file:'){
        local=true;orderId=localTestOrder();saveLocalTest(orderId);
      }else{
        orderId=await submitLiveOrder();
      }
      const target=new URL('request-received.html',window.location.href);target.searchParams.set('order',orderId);if(local)target.searchParams.set('mode','local');
      window.location.href=target.href;
    }catch(err){showMessage(err?.message||'Could not submit the request. Please try again.','error');submit.dataset.busy='false';submit.innerHTML=original;updateReady();}
  });

  updateText();applyColors();updateReady();
})();
