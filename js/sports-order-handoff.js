/* Sports builder -> Production order request. Does not alter approved artwork rendering. */
(function(){
  'use strict';
  const KEY='westtechha-sports-order-pending-v1';
  const NS='http://www.w3.org/2000/svg';
  function tell(selector,message){const el=document.querySelector(selector);if(el){el.hidden=false;el.dataset.kind='info';el.textContent=message;}}
  async function imageData(href){
    const url=new URL(href,location.href);
    if(url.origin!==location.origin && url.protocol!=='data:')throw new Error('Artwork must come from WestTech.');
    const response=await fetch(url.href);
    if(!response.ok)throw new Error('The selected team logo could not be loaded.');
    const blob=await response.blob();
    const objectUrl=URL.createObjectURL(blob);
    try{
      const img=new Image();img.src=objectUrl;
      await img.decode();
      const canvas=document.createElement('canvas');canvas.width=Math.max(1,img.naturalWidth||1000);canvas.height=Math.max(1,img.naturalHeight||1000);
      const context=canvas.getContext('2d');if(!context)throw new Error('Artwork rendering unavailable.');
      context.drawImage(img,0,0,canvas.width,canvas.height);
      return canvas.toDataURL('image/png');
    }finally{URL.revokeObjectURL(objectUrl);}
  }
  async function snapshot(source){
    if(!source)throw new Error('The coaster preview is missing.');
    const clone=source.cloneNode(true);
    clone.setAttribute('xmlns',NS);clone.setAttribute('viewBox','0 0 1000 1000');
    clone.setAttribute('width','1000');clone.setAttribute('height','1000');
    clone.removeAttribute('id');clone.removeAttribute('aria-labelledby');
    const originalNodes=[source,...source.querySelectorAll('*')];
    const cloneNodes=[clone,...clone.querySelectorAll('*')];
    for(let i=0;i<cloneNodes.length;i++){
      const old=originalNodes[i],fresh=cloneNodes[i],css=getComputedStyle(old);
      // Only presentation properties: avoid cloning selectors, animation or page layout.
      ['fill','stroke','stroke-width','stroke-linecap','stroke-linejoin','stroke-dasharray','opacity',
       'font-family','font-size','font-weight','letter-spacing','text-anchor','dominant-baseline','display','visibility'].forEach(key=>{
        const value=css.getPropertyValue(key);if(value&&value!=='normal')fresh.style.setProperty(key,value);
      });
    }
    const images=[...clone.querySelectorAll('image')];
    for(const el of images){
      const href=el.getAttribute('href')||el.getAttribute('xlink:href');
      if(!href||el.style.display==='none')continue;
      const png=await imageData(href);
      el.setAttribute('href',png);el.removeAttribute('xlink:href');
    }
    // IDs must remain for SVG references (clip paths etc), but the outer id is unnecessary.
    let svg=new XMLSerializer().serializeToString(clone);
    if(!/^<svg\b/i.test(svg))throw new Error('Could not capture coaster artwork.');
    const blob=new Blob([svg],{type:'image/svg+xml'});
    const url=URL.createObjectURL(blob);
    try{
      const image=new Image();image.src=url;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=1000;
      const context=canvas.getContext('2d');if(!context)throw new Error('Artwork rendering unavailable.');
      context.drawImage(image,0,0,1000,1000);
      const png=canvas.toDataURL('image/png');
      if(png.length>8*1024*1024)throw new Error('The artwork image is too large to submit.');
      // Store a self-contained SVG with a single embedded image. D1/R2 API accepts this snapshot.
      svg=`<svg xmlns="${NS}" width="1000" height="1000" viewBox="0 0 1000 1000"><image x="0" y="0" width="1000" height="1000" href="${png}"/></svg>`;
      if(svg.length>3500000)throw new Error('The coaster design exceeds the snapshot limit.');
      return {png,svg};
    }finally{URL.revokeObjectURL(url);}
  }
  window.WestTechSportsOrder={async begin(data){
    const btn=document.querySelector(data.button),previous=btn?.textContent;
    if(btn){btn.disabled=true;btn.textContent='Preparing your order…';}
    try{
      const art=await snapshot(document.querySelector(data.preview));
      const pending={...data,png:art.png,svg:art.svg,createdAt:Date.now()};
      for(const key of ['preview','button','message'])delete pending[key];
      sessionStorage.setItem(KEY,JSON.stringify(pending));
      location.href='sports-order.html';
    }catch(err){tell(data.message,err.message||'Could not prepare the order. Please try again.');if(btn){btn.disabled=false;btn.textContent=previous;}}
  },KEY};
})();
