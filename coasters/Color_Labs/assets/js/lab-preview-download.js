(function(){
  'use strict';
  const SVG_NS='http://www.w3.org/2000/svg';
  const XLINK_NS='http://www.w3.org/1999/xlink';
  const STYLE_PROPS=[
    'fill','fill-opacity','stroke','stroke-width','stroke-opacity','stroke-linecap','stroke-linejoin','stroke-miterlimit',
    'opacity','color','font-family','font-size','font-style','font-weight','letter-spacing','word-spacing',
    'text-anchor','dominant-baseline','paint-order','shape-rendering','vector-effect','display','visibility'
  ];
  const $=s=>document.querySelector(s);
  const slug=v=>String(v||'preview').trim().replace(/[^a-z0-9]+/gi,'-').replace(/^-+|-+$/g,'').toLowerCase()||'preview';

  function assetKey(href){
    if(!href)return'';
    try{
      const u=new URL(href,document.baseURI), path=decodeURIComponent(u.pathname).replace(/\\/g,'/');
      const marker='/images/coasters/teams/';
      const i=path.toLowerCase().indexOf(marker);
      return i>=0?path.slice(i):'';
    }catch(_){
      const p=String(href).replace(/\\/g,'/');
      const marker='/images/coasters/teams/';
      const i=p.toLowerCase().indexOf(marker);
      return i>=0?p.slice(i):'';
    }
  }

  function copyComputedStyles(source,clone){
    const src=[source,...source.querySelectorAll('*')];
    const dst=[clone,...clone.querySelectorAll('*')];
    src.forEach((node,i)=>{
      const target=dst[i]; if(!target)return;
      const cs=getComputedStyle(node);
      STYLE_PROPS.forEach(prop=>{const value=cs.getPropertyValue(prop);if(value)target.style.setProperty(prop,value);});
    });
  }

  function inlineSvgImages(source,clone){
    const srcImgs=[...source.querySelectorAll('image')];
    const dstImgs=[...clone.querySelectorAll('image')];
    srcImgs.forEach((img,i)=>{
      const target=dstImgs[i]; if(!target)return;
      const href=img.getAttribute('href')||img.getAttributeNS(XLINK_NS,'href')||'';
      if(!href)return;
      if(href.startsWith('data:')){target.setAttribute('href',href);return;}
      const key=assetKey(href), b64=window.WestTechLabSvgAssetMap&&window.WestTechLabSvgAssetMap[key];
      if(b64){
        const data='data:image/svg+xml;base64,'+b64;
        target.setAttribute('href',data);target.setAttributeNS(XLINK_NS,'xlink:href',data);
      }else{
        try{const absolute=new URL(href,document.baseURI).href;target.setAttribute('href',absolute);target.setAttributeNS(XLINK_NS,'xlink:href',absolute);}catch(_){target.setAttribute('href',href);}
      }
    });
  }

  function filename(){
    const body=document.body;
    if(body.classList.contains('single-blackout-color-lab-page')){
      return `nfl-${slug($('#lab-preview-name')?.textContent)}-single-blackout.png`;
    }
    if(body.classList.contains('blackout-color-lab-page')){
      return `nfl-${slug($('#lab-preview-matchup')?.textContent)}-house-divided-blackout.png`;
    }
    if(body.classList.contains('house-divided-color-lab-page')){
      const sport=slug($('#lab-preview-sport')?.textContent||'nfl');
      return `${sport}-${slug($('#lab-preview-matchup')?.textContent)}-house-divided-standard.png`;
    }
    const sport=slug($('#lab-preview-sport')?.textContent||'nfl');
    return `${sport}-${slug($('#lab-preview-name')?.textContent)}-single-standard.png`;
  }

  function findSvg(){return $('#lab-coaster')||$('#lab-hd-coaster');}

  async function exportPng(){
    const source=findSvg(); if(!source){alert('Preview SVG was not found.');return;}
    const button=$('#lab-download-preview-png');
    const old=button?.textContent;if(button){button.disabled=true;button.textContent='Rendering PNG…';}
    try{
      if(document.fonts&&document.fonts.ready)await document.fonts.ready;
      const clone=source.cloneNode(true);
      clone.setAttribute('xmlns',SVG_NS);clone.setAttribute('xmlns:xlink',XLINK_NS);
      clone.setAttribute('width','1000');clone.setAttribute('height','1000');
      clone.removeAttribute('aria-labelledby');
      copyComputedStyles(source,clone);
      inlineSvgImages(source,clone);
      const xml='<?xml version="1.0" encoding="UTF-8"?>\n'+new XMLSerializer().serializeToString(clone);
      const blob=new Blob([xml],{type:'image/svg+xml;charset=utf-8'}),url=URL.createObjectURL(blob);
      const image=new Image();
      await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('Could not render the coaster SVG.'));image.src=url;});
      const size=2000,canvas=document.createElement('canvas');canvas.width=size;canvas.height=size;
      const ctx=canvas.getContext('2d',{alpha:true});ctx.clearRect(0,0,size,size);ctx.drawImage(image,0,0,size,size);URL.revokeObjectURL(url);
      const png=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG creation failed.')),'image/png'));
      const pngUrl=URL.createObjectURL(png),a=document.createElement('a');a.href=pngUrl;a.download=filename();document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(pngUrl),1500);
    }catch(err){console.error(err);alert('Could not create the PNG preview. '+(err&&err.message?err.message:''));}
    finally{if(button){button.disabled=false;button.textContent=old||'Download Preview PNG';}}
  }

  function install(){
    if($('#lab-download-preview-png'))return;
    const anchor=$('#lab-download-js');if(!anchor)return;
    const b=document.createElement('button');b.id='lab-download-preview-png';b.type='button';b.textContent='Download Preview PNG';b.addEventListener('click',exportPng);anchor.insertAdjacentElement('afterend',b);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
