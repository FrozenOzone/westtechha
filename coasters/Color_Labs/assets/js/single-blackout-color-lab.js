(function(){
  'use strict';

  const CATALOG = window.WestTechSportsColorLabCatalog?.NFL || {teams:[]};
  const TEAMS = CATALOG.teams || [];
  const STANDARD_PALETTE = JSON.parse(JSON.stringify(window.WestTechNFLTeamArtPrintPalette || []));
  const BASE_PALETTE = JSON.parse(JSON.stringify(window.WestTechFilamentInventory || window.WestTechNFLTeamArtPrintPalette || []));
  const LEGACY_COLOR_MAP = Object.assign({},window.WestTechLegacyColorMap||{});
  const PACKAGED_STANDARD_PROFILES = JSON.parse(JSON.stringify(window.WestTechNFLTeamArtProfiles || {}));
  const PACKAGED_STANDARD = Object.assign({field:'petg-black'},window.WestTechNFLTeamArtSingleBlackoutStandard||{});
  const PACKAGED_PROFILES = JSON.parse(JSON.stringify(window.WestTechNFLTeamArtSingleBlackoutProfiles || {}));
  const TEAM_ART_OUTLINES = window.WestTechNFLTeamArtOutlineData || {};
  const DEFAULT_PROFILE={nameRing:'petg-white',ringText:'petg-black',accentRing:'petg-grey',outline:'petg-white',logoOutlineEnabled:true,logoOutline:'petg-white',logoScaleCustom:90,approved:false,notes:''};
  const $=(sel,root=document)=>root.querySelector(sel);
  const $$=(sel,root=document)=>Array.from(root.querySelectorAll(sel));
  const clone=obj=>JSON.parse(JSON.stringify(obj));
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,Math.round(Number(value)||0)));
  const storageKey='wt-nfl-team-art-single-blackout-v1';

  let standard=clone(PACKAGED_STANDARD);
  let firstPass=normalizeProfiles(PACKAGED_PROFILES);
  let working=clone(firstPass);
  let sharedProfiles=clone(PACKAGED_STANDARD_PROFILES);
  let activeTeamId=TEAMS.some(t=>t.id==='DEN')?'DEN':TEAMS[0]?.id;
  let palette=clone(BASE_PALETTE);
  let materialFilter=localStorage.getItem('wt-color-lab-material-filter')||'all';
  let dirty=false;
  if(!['all','PETG','PLA_FAMILY'].includes(materialFilter))materialFilter='all';

  function normalizeColorId(value){if(BASE_PALETTE.some(item=>item.id===value))return value;return LEGACY_COLOR_MAP[value]||'petg-white';}
  function normalizeProfiles(source){
    const out={};
    TEAMS.forEach(team=>{
      out[team.id]=Object.assign({},DEFAULT_PROFILE,clone(source?.[team.id]||{}));
      ['nameRing','ringText','accentRing','outline','logoOutline'].forEach(key=>out[team.id][key]=normalizeColorId(out[team.id][key]));
      out[team.id].logoOutlineEnabled=!!out[team.id].logoOutlineEnabled;
      out[team.id].logoScaleCustom=clamp(out[team.id].logoScaleCustom||90,30,120);
      out[team.id].approved=!!out[team.id].approved;
      out[team.id].notes=typeof out[team.id].notes==='string'?out[team.id].notes:'';
    });
    return out;
  }
  function team(id=activeTeamId){return TEAMS.find(t=>t.id===id)||TEAMS[0];}
  function profile(id=activeTeamId){return working[id]||DEFAULT_PROFILE;}
  function standardProfile(id=activeTeamId){return sharedProfiles[id]||{};}
  function paletteEntry(id){return palette.find(p=>p.id===id)||null;}
  function color(id,fallback='#111317'){return paletteEntry(id)?.hex||fallback;}
  function fullName(t){return `${t?.city||''} ${t?.name||''}`.trim();}
  function logoPath(t){return t?`../images/coasters/teams/nfl/custom/${t.id}.svg`:'';}
  function standardScale(id=activeTeamId){return clamp(standardProfile(id).logoScaleCustom||90,30,120);}
  function baselineSignature(){return JSON.stringify({standard,firstPass,shared:PACKAGED_STANDARD_PROFILES});}

  function entryOptionLabel(item){return `${item.label} — ${item.material||'Legacy'}`;}
  function filteredPalette(){return materialFilter==='all'?palette:palette.filter(item=>item.family===materialFilter);}
  function optionMarkup(currentId){
    const visible=filteredPalette().slice(),current=paletteEntry(currentId);
    if(current&&!visible.some(item=>item.id===current.id))visible.unshift(current);
    const order=['PETG','PLA','PLA+','PLA+ 2.0'];
    return order.map(material=>{const entries=visible.filter(item=>item.material===material);if(!entries.length)return'';return `<optgroup label="${material}">${entries.map(item=>`<option value="${item.id}">${entryOptionLabel(item)}</option>`).join('')}</optgroup>`;}).join('');
  }
  function setSwatch(role,id){
    const entry=paletteEntry(id),sw=$(`#swatch-${role}`),ref=$(`#filament-${role}`);
    if(sw)sw.style.background=entry?.hex||'#fff';
    if(ref){ref.className='filament-ref';if(entry?.filamentStatus)ref.classList.add(entry.filamentStatus);ref.textContent=entry?`${entry.label} · ${entry.material||''} · ${entry.filament||'No filament listed'}${entry.filamentNote?` — ${entry.filamentNote}`:''}`:'No palette entry';}
  }
  function populateColorSelects(){const p=profile();['nameRing','ringText','accentRing','outline','logoOutline'].forEach(k=>{const el=$(`#lab-role-${k}`);if(!el)return;el.innerHTML=optionMarkup(p[k]);el.value=p[k];setSwatch(k,p[k]);});}
  function renderMaterialFilter(){
    const root=$('#lab-material-filter');if(!root)return;
    root.querySelectorAll('[data-material-filter]').forEach(btn=>{const on=btn.dataset.materialFilter===materialFilter;btn.classList.toggle('is-selected',on);btn.setAttribute('aria-pressed',on?'true':'false');});
    const count=filteredPalette().length,note=$('#lab-material-filter-note');
    if(note)note.textContent=materialFilter==='PETG'?`${count} PETG colors shown. PETG stays separate from the PLA family.`:materialFilter==='PLA_FAMILY'?`${count} PLA-family colors shown across PLA, PLA+, and PLA+ 2.0.`:`${count} stocked filament choices shown. Use the filter to narrow the picker.`;
  }
  function renderMaterialStatus(){
    const el=$('#lab-material-status');if(!el)return;const p=profile(),ids=[standard.field,p.nameRing,p.ringText,p.accentRing,p.outline];if(p.logoOutlineEnabled)ids.push(p.logoOutline);
    const families=new Set(ids.map(id=>paletteEntry(id)?.family).filter(Boolean)),mixed=families.has('PETG')&&families.has('PLA_FAMILY');el.classList.toggle('is-mixed',mixed);
    el.textContent=mixed?'MIXED MATERIALS: this team currently uses PETG and PLA-family colors.':families.has('PETG')?'Current team material: PETG only.':families.has('PLA_FAMILY')?'Current team material: PLA family only.':'Current team material: no stocked filament selected.';
  }
  function renderPaletteKey(){
    const p=profile(),ids=[standard.field,p.nameRing,p.ringText,p.accentRing,p.outline];if(p.logoOutlineEnabled)ids.push(p.logoOutline);
    const root=$('#lab-palette-key');root.innerHTML='';[...new Set(ids.filter(Boolean))].forEach(id=>{const item=paletteEntry(id);if(!item)return;const s=document.createElement('span');s.className='key-chip';s.style.background=item.hex;s.title=`${entryOptionLabel(item)} · ${item.filament||'No filament listed'}`;root.appendChild(s);});
  }
  function renderStatus(){
    const approved=TEAMS.filter(t=>working[t.id]?.approved).length;$('#lab-progress-title').textContent=`Approved teams: ${approved} / ${TEAMS.length}`;const root=$('#lab-team-status');root.innerHTML='';
    TEAMS.forEach(t=>{const b=document.createElement('button');b.type='button';b.className='status-chip';if(working[t.id]?.approved)b.classList.add('is-approved');if(t.id===activeTeamId)b.classList.add('is-active');b.textContent=t.id;b.title=fullName(t);b.addEventListener('click',()=>{activeTeamId=t.id;syncUI();});root.appendChild(b);});
  }
  function renderRingLetters(group,text,position){
    const value=(text||'').toUpperCase(),chars=[...value],slots=Math.max(chars.length,1),nonSpace=value.replace(/\s+/g,'').length;const radius=position==='top'?395:403,startAngle=position==='top'?-145:145,endAngle=position==='top'?-35:35;
    let fontSize=70;if(slots>=13)fontSize=45;else if(slots>=11)fontSize=50;else if(slots>=9)fontSize=56;else if(slots>=8)fontSize=61;else if(nonSpace<=5)fontSize=73;
    group.innerHTML='';group.setAttribute('aria-label',value);chars.forEach((ch,index)=>{if(ch===' ')return;const ratio=slots===1?.5:index/(slots-1),angle=startAngle+(endAngle-startAngle)*ratio,rad=angle*Math.PI/180,x=500+radius*Math.cos(rad),y=500+radius*Math.sin(rad),rotation=position==='top'?angle+90:angle-90;const node=document.createElementNS('http://www.w3.org/2000/svg','text');node.setAttribute('x',x.toFixed(2));node.setAttribute('y',y.toFixed(2));node.setAttribute('transform',`rotate(${rotation.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)})`);node.setAttribute('text-anchor','middle');node.setAttribute('dominant-baseline','middle');node.setAttribute('font-size',String(fontSize));node.textContent=ch;group.appendChild(node);});
  }
  function applyLogoImage(img,src,fallback){if(!src){img.style.display='none';fallback.style.display='block';return;}img.style.display='block';fallback.style.display='none';img.setAttribute('href',src);const test=new Image();test.onload=()=>{img.style.display='block';fallback.style.display='none';};test.onerror=()=>{img.style.display='none';fallback.style.display='block';};test.src=src;}
  function renderPreview(){
    const t=team(),p=profile(),coaster=$('#lab-coaster');if(!t)return;
    coaster.style.setProperty('--field',color(standard.field,'#111317'));coaster.style.setProperty('--ring',color(p.nameRing,'#f5f5f2'));coaster.style.setProperty('--ringText',color(p.ringText,'#111317'));coaster.style.setProperty('--accent',color(p.accentRing,'#8d949b'));coaster.style.setProperty('--outline',color(p.outline,'#f5f5f2'));
    renderRingLetters($('#lab-top-text'),t.city,'top');renderRingLetters($('#lab-bottom-text'),t.name,'bottom');
    const img=$('#lab-team-logo'),fallback=$('#lab-logo-fallback'),scale=standardScale(t.id),baseSize=630,size=baseSize*(scale/100),pos=(1000-size)/2;fallback.textContent=t.id;
    img.setAttribute('x',pos.toFixed(2));img.setAttribute('y',pos.toFixed(2));img.setAttribute('width',size.toFixed(2));img.setAttribute('height',size.toFixed(2));applyLogoImage(img,logoPath(t),fallback);
    const out=$('#lab-team-logo-outline'),outPaths=$('#lab-team-logo-outline-paths'),outlineData=TEAM_ART_OUTLINES[t.id];out.setAttribute('x',pos.toFixed(2));out.setAttribute('y',pos.toFixed(2));out.setAttribute('width',size.toFixed(2));out.setAttribute('height',size.toFixed(2));out.classList.toggle('is-visible',!!(outlineData&&p.logoOutlineEnabled));
    if(outlineData&&p.logoOutlineEnabled){out.setAttribute('viewBox',outlineData.viewBox||'0 0 1000 1000');outPaths.replaceChildren();outlineData.paths.forEach(part=>{const node=document.createElementNS('http://www.w3.org/2000/svg','path');node.setAttribute('d',part.d);node.setAttribute('fill',color(p.logoOutline,'#f5f5f2'));if(part.fillRule)node.setAttribute('fill-rule',part.fillRule);if(part.clipRule)node.setAttribute('clip-rule',part.clipRule);outPaths.appendChild(node);});}else outPaths.replaceChildren();
    $('#lab-preview-name').textContent=fullName(t);$('#lab-preview-title').textContent=`${fullName(t)} Single Team Blackout coaster preview`;$('#lab-preview-desc').textContent=`${fullName(t)} Single Team Blackout preview with a Black field, WestTech Team Art, current ring colors, and independent logo outline.`;renderPaletteKey();
  }
  function populateTeamSelect(){const select=$('#lab-team-select');select.innerHTML=TEAMS.map(t=>`<option value="${t.id}">${fullName(t)}</option>`).join('');select.value=activeTeamId;}
  function updateDraftState(){const el=$('#lab-draft-state');el.textContent=dirty?'Single Blackout profiles have changes not saved to a browser draft.':'Working from Single Blackout Pass 1 / saved draft.';}
  function markDirty(){dirty=true;updateDraftState();}
  function syncUI(){
    const t=team(),p=profile(),sp=standardProfile();if(!t)return;populateTeamSelect();populateColorSelects();renderMaterialFilter();renderStatus();renderMaterialStatus();
    $('#lab-team-name').textContent=fullName(t);$('#lab-team-code').textContent=`${t.id} · NFL SINGLE BLACKOUT`;$('#lab-team-icon').src=logoPath(t);$('#lab-team-icon').alt=`${fullName(t)} WestTech Team Art`;$('#lab-approved').checked=!!p.approved;$('#lab-notes').value=p.notes||'';$('#lab-active-team-card').classList.toggle('is-approved',!!p.approved);
    $('#lab-role-logoOutlineEnabled').checked=!!p.logoOutlineEnabled;$('#lab-role-logoOutline').disabled=!p.logoOutlineEnabled;$('#lab-logo-outline-wrap').classList.toggle('is-enabled',!!p.logoOutlineEnabled);
    const sharedScale=standardScale();p.logoScaleCustom=sharedScale;$('#lab-logo-size-slider').value=String(sharedScale);$('#lab-logo-size-number').value=String(sharedScale);
    const ref=paletteEntry(sp.field);$('#lab-standard-reference').innerHTML=ref?`Standard field: <span class="single-blackout-reference-chip"><i style="background:${ref.hex}"></i>${ref.label}</span>`:'Standard field reference unavailable';
    renderPreview();updateDraftState();
  }
  function setMaterialFilter(value){if(!['all','PETG','PLA_FAMILY'].includes(value))return;materialFilter=value;localStorage.setItem('wt-color-lab-material-filter',value);syncUI();}
  function setLogoScale(value){const v=clamp(value,30,120);if(!sharedProfiles[activeTeamId])sharedProfiles[activeTeamId]={};sharedProfiles[activeTeamId].logoScaleCustom=v;profile().logoScaleCustom=v;$('#lab-logo-size-slider').value=String(v);$('#lab-logo-size-number').value=String(v);markDirty();renderPreview();}
  function saveDraft(){localStorage.setItem(storageKey,JSON.stringify({signature:baselineSignature(),working,sharedProfiles,activeTeamId,materialFilter,savedAt:new Date().toISOString()}));dirty=false;syncUI();$('#lab-status-subtitle').textContent='Single Blackout + shared Single geometry browser draft saved.';}
  function restoreDraft(){const raw=localStorage.getItem(storageKey);if(!raw)return false;try{const d=JSON.parse(raw);if(d.signature!==baselineSignature()){localStorage.removeItem(storageKey);return false;}if(d.working&&TEAMS.every(t=>d.working[t.id]))working=normalizeProfiles(d.working);if(d.sharedProfiles&&TEAMS.every(t=>d.sharedProfiles[t.id]))sharedProfiles=clone(d.sharedProfiles);if(d.activeTeamId&&TEAMS.some(t=>t.id===d.activeTeamId))activeTeamId=d.activeTeamId;if(['all','PETG','PLA_FAMILY'].includes(d.materialFilter))materialFilter=d.materialFilter;return true;}catch(_){return false;}}
  function buildExport(){const stamp=new Date().toISOString(),exportProfiles=clone(working);for(const t of TEAMS){if(exportProfiles[t.id])exportProfiles[t.id].logoScaleCustom=standardScale(t.id);}return `(function(){\n  'use strict';\n  // WestTech NFL Team Art Single Team Blackout production baseline.\n  // Logo geometry is shared only with Single Team Standard.\n  // Single Blackout Color Lab export generated: ${stamp}\n  window.WestTechNFLTeamArtSingleBlackoutStandard = ${JSON.stringify(standard)};\n\n  window.WestTechNFLTeamArtSingleBlackoutProfiles = ${JSON.stringify(exportProfiles,null,2)};\n})();\n`;}
  function buildSharedStandardExport(){const stamp=new Date().toISOString();return `(function(){\n  'use strict';\n  // WestTech NFL Single Team Standard production color baseline.\n  // Shared Single Team logo geometry may be edited from Standard or Single Blackout.\n  // Single shared-geometry export generated: ${stamp}\n  window.WestTechNFLTeamArtPrintPalette = ${JSON.stringify(STANDARD_PALETTE.length?STANDARD_PALETTE:palette,null,2)};\n\n  window.WestTechNFLTeamArtProfiles = ${JSON.stringify(sharedProfiles,null,2)};\n})();\n`;}
  function downloadText(name,text){const blob=new Blob([text],{type:'application/javascript'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function download(){downloadText('nfl-team-art-single-blackout-baseline.js',buildExport());downloadText('nfl-team-art-color-baseline.js',buildSharedStandardExport());$('#lab-status-subtitle').textContent='Downloaded Single Blackout + shared Single Standard geometry exports.';}
  async function importFile(e){const file=e.target.files?.[0];if(!file)return;try{const txt=await file.text();let found,foundStandard;if(file.name.toLowerCase().endsWith('.json')){const d=JSON.parse(txt);found=d.profiles||d;foundStandard=d.standard;}else{const box={};new Function('window',txt+';return window;')(box);found=box.WestTechNFLTeamArtSingleBlackoutProfiles;foundStandard=box.WestTechNFLTeamArtSingleBlackoutStandard;}if(!found)throw new Error('No WestTechNFLTeamArtSingleBlackoutProfiles object found.');for(const t of TEAMS)if(!found[t.id])throw new Error(`Missing ${t.id}.`);working=normalizeProfiles(found);if(foundStandard?.field)standard.field=normalizeColorId(foundStandard.field);dirty=true;syncUI();$('#lab-status-subtitle').textContent=`Loaded ${file.name}. Review before exporting.`;}catch(err){alert(`Import failed: ${err.message}`);}finally{e.target.value='';}}
  function resetTeam(){working[activeTeamId]=clone(firstPass[activeTeamId]);if(PACKAGED_STANDARD_PROFILES[activeTeamId])sharedProfiles[activeTeamId]=clone(PACKAGED_STANDARD_PROFILES[activeTeamId]);markDirty();syncUI();}
  function resetAll(){if(!confirm('Reset all Single Team Blackout profiles to Pass 1 suggestions?'))return;working=clone(firstPass);sharedProfiles=clone(PACKAGED_STANDARD_PROFILES);standard=clone(PACKAGED_STANDARD);localStorage.removeItem(storageKey);dirty=false;syncUI();$('#lab-status-subtitle').textContent='Reset to Single Blackout Pass 1 suggestions.';}
  function nextTeam(delta){const i=TEAMS.findIndex(t=>t.id===activeTeamId),n=Math.min(TEAMS.length-1,Math.max(0,i+delta));activeTeamId=TEAMS[n].id;syncUI();}
  function nextUnapproved(){const i=Math.max(0,TEAMS.findIndex(t=>t.id===activeTeamId)),list=[...TEAMS.slice(i+1),...TEAMS.slice(0,i+1)],next=list.find(t=>!working[t.id]?.approved);if(!next){$('#lab-status-subtitle').textContent='All 32 Single Blackout profiles are approved.';return;}activeTeamId=next.id;syncUI();}

  $('#lab-team-select').addEventListener('change',e=>{activeTeamId=e.target.value;syncUI();});
  ['nameRing','ringText','accentRing','outline','logoOutline'].forEach(k=>$('#lab-role-'+k).addEventListener('change',e=>{profile()[k]=e.target.value;markDirty();syncUI();}));
  $('#lab-role-logoOutlineEnabled').addEventListener('change',e=>{profile().logoOutlineEnabled=e.target.checked;markDirty();syncUI();});
  $('#lab-approved').addEventListener('change',e=>{profile().approved=e.target.checked;markDirty();syncUI();});
  $('#lab-notes').addEventListener('input',e=>{profile().notes=e.target.value;markDirty();});
  $('#lab-logo-size-slider').addEventListener('input',e=>setLogoScale(e.target.value));
  $('#lab-logo-size-number').addEventListener('input',e=>{if(e.target.value!=='')setLogoScale(e.target.value);});
  $('#lab-logo-size-reset').addEventListener('click',()=>setLogoScale(PACKAGED_STANDARD_PROFILES[activeTeamId]?.logoScaleCustom||90));
  $('#lab-prev-team').addEventListener('click',()=>nextTeam(-1));$('#lab-next-team').addEventListener('click',()=>nextTeam(1));$('#lab-next-unapproved').addEventListener('click',nextUnapproved);$('#lab-reset-team').addEventListener('click',resetTeam);
  $('#lab-save-draft').addEventListener('click',saveDraft);$('#lab-reset-baseline').addEventListener('click',resetAll);$('#lab-download-js').addEventListener('click',download);$('#lab-import-file').addEventListener('change',importFile);
  $$('[data-material-filter]').forEach(btn=>btn.addEventListener('click',()=>setMaterialFilter(btn.dataset.materialFilter)));

  const restored=restoreDraft();syncUI();if(restored)$('#lab-status-subtitle').textContent='Loaded your saved Single Blackout browser draft.';
})();
