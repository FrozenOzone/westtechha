(function(){
  'use strict';

  const CATALOG = window.WestTechSportsColorLabCatalog || {};
  const SEEDS = window.WestTechSportsColorLabSeedProfiles || {};
  const LEGACY_PALETTE = JSON.parse(JSON.stringify(window.WestTechNFLSingleTeamPrintPalette || []));
  const BASE_PALETTE = JSON.parse(JSON.stringify(window.WestTechFilamentInventory || LEGACY_PALETTE));
  const LEGACY_COLOR_MAP = Object.assign({},window.WestTechLegacyColorMap||{});
  const NFL_BASE = JSON.parse(JSON.stringify(window.WestTechNFLSingleTeamProfiles || {}));
  const NFL_TEAM_ART_BASE = JSON.parse(JSON.stringify(window.WestTechNFLTeamArtProfiles || {}));
  const NHL_BASE = JSON.parse(JSON.stringify(window.WestTechNHLSingleTeamProfiles || {}));
  const SPORTS = ['NFL','NHL','MLB','NBA','MLS','WNBA'].filter(key => CATALOG[key]);
  const DEFAULT_PROFILE = {field:'petg-white',nameRing:'petg-white',ringText:'petg-black',accentRing:'petg-black',outline:'petg-black',logoOutlineEnabled:false,logoOutline:'petg-black',logoScaleOfficial:100,logoScaleCustom:100,approved:false,notes:''};
  const TEAM_ART_OUTLINES = window.WestTechNFLTeamArtOutlineData || {};
  const $=(sel,root=document)=>root.querySelector(sel);
  const $$=(sel,root=document)=>Array.from(root.querySelectorAll(sel));
  const clone=obj=>JSON.parse(JSON.stringify(obj));

  let activeSport='NFL';
  let activeLogoMode='official';
  let activeTeamId='DEN';
  let palette=clone(BASE_PALETTE);
  const states={};
  let dirty=false;
  let materialFilter=localStorage.getItem('wt-color-lab-material-filter')||'all';
  if(!['all','PETG','PLA_FAMILY'].includes(materialFilter))materialFilter='all';

  function normalizeColorId(value){
    if(BASE_PALETTE.some(item=>item.id===value))return value;
    return LEGACY_COLOR_MAP[value]||'petg-white';
  }
  function normalizeProfiles(sport,source){
    const out={};
    (CATALOG[sport]?.teams||[]).forEach(team=>{
      out[team.id]=Object.assign({},DEFAULT_PROFILE,clone(source?.[team.id]||{}));
      ['field','nameRing','ringText','accentRing','outline','logoOutline'].forEach(key=>out[team.id][key]=normalizeColorId(out[team.id][key]));
      if(typeof out[team.id].approved!=='boolean')out[team.id].approved=false;
      if(typeof out[team.id].logoOutlineEnabled!=='boolean')out[team.id].logoOutlineEnabled=false;
      if(typeof out[team.id].notes!=='string')out[team.id].notes='';
      if(!Number.isFinite(Number(out[team.id].logoScaleOfficial)))out[team.id].logoScaleOfficial=100;
      if(!Number.isFinite(Number(out[team.id].logoScaleCustom)))out[team.id].logoScaleCustom=100;
      out[team.id].logoScaleOfficial=Math.min(120,Math.max(30,Math.round(Number(out[team.id].logoScaleOfficial))));
      out[team.id].logoScaleCustom=Math.min(120,Math.max(30,Math.round(Number(out[team.id].logoScaleCustom))));
    });
    return out;
  }

  SPORTS.forEach(sport=>{
    const source=sport==='NFL'?NFL_BASE:(sport==='NHL'&&Object.keys(NHL_BASE).length?NHL_BASE:(SEEDS[sport]||{}));
    states[sport]={baseline:normalizeProfiles(sport,source),profiles:normalizeProfiles(sport,source)};
    if(sport==='NFL'){
      const customSource=Object.keys(NFL_TEAM_ART_BASE).length?NFL_TEAM_ART_BASE:NFL_BASE;
      states[sport].customBaseline=normalizeProfiles(sport,customSource);
      states[sport].customProfiles=normalizeProfiles(sport,customSource);
    }
  });
  function profilesFor(sport=activeSport,mode=(sport===activeSport?activeLogoMode:(CATALOG[sport]?.defaultLogoMode||'official'))){return sport==='NFL'&&mode==='custom'?states[sport].customProfiles:states[sport].profiles;}
  function baselineFor(sport=activeSport,mode=(sport===activeSport?activeLogoMode:(CATALOG[sport]?.defaultLogoMode||'official'))){return sport==='NFL'&&mode==='custom'?states[sport].customBaseline:states[sport].baseline;}
  function setProfilesFor(sport,mode,value){if(sport==='NFL'&&mode==='custom')states[sport].customProfiles=value;else states[sport].profiles=value;}

  function teamList(){return CATALOG[activeSport]?.teams||[];}
  function teamById(id){return teamList().find(t=>t.id===id)||teamList()[0];}
  function profile(){return profilesFor()?.[activeTeamId]||DEFAULT_PROFILE;}
  function paletteEntry(id){return palette.find(p=>p.id===id)||null;}
  function color(id,fallback='#111317'){return paletteEntry(id)?.hex||fallback;}
  function fullName(team){return `${team.city||''} ${team.name||''}`.trim();}
  function logoPath(team,mode=activeLogoMode){
    if(!team)return '';
    if(activeSport==='NFL'&&mode==='custom')return `../images/coasters/teams/nfl/custom/${team.id}.svg`;
    const base=team.logoUrl||`../images/coasters/teams/${activeSport.toLowerCase()}/official/${team.file}`;
    const fieldId=profilesFor()?.[team.id]?.field||'';
    return window.WestTechTeamLogoContext?.resolve?.(activeSport,team.id,fieldId,base)||base;
  }
  function customOutlinePath(team){return activeSport==='NFL'?`../images/coasters/teams/nfl/custom-outline/${team.id}.svg`:'';}
  function storageKey(sport){const mode=sport==='NFL'?activeLogoMode:'official';return `wt-sports-color-lab-${sport.toLowerCase()}-${mode}-single-team-v4`;}
  function baselineSignature(sport){return JSON.stringify(baselineFor(sport)||{});}
  function exportGlobals(sport,mode=activeLogoMode){if(sport==='NFL'&&mode==='custom')return{palette:'WestTechNFLTeamArtPrintPalette',profiles:'WestTechNFLTeamArtProfiles'};return {palette:`WestTech${sport}SingleTeamPrintPalette`,profiles:`WestTech${sport}SingleTeamProfiles`};}
  function activeLogoScaleKey(){return activeSport==='NFL'&&activeLogoMode==='custom'?'logoScaleCustom':'logoScaleOfficial';}
  function clampLogoScale(value){const n=Number(value);return Number.isFinite(n)?Math.min(120,Math.max(30,Math.round(n))):100;}
  function activeLogoScale(){return clampLogoScale(profile()[activeLogoScaleKey()] ?? 100);}

  function renderRingLetters(group,text,position){
    const value=(text||'').toUpperCase(),chars=[...value],slots=Math.max(chars.length,1),nonSpace=value.replace(/\s+/g,'').length;
    const radius=position==='top'?395:403,startAngle=position==='top'?-145:145,endAngle=position==='top'?-35:35;
    let fontSize=70;if(slots>=13)fontSize=45;else if(slots>=11)fontSize=50;else if(slots>=9)fontSize=56;else if(slots>=8)fontSize=61;else if(nonSpace<=5)fontSize=73;
    group.innerHTML='';group.setAttribute('aria-label',value);
    chars.forEach((ch,index)=>{if(ch===' ')return;const ratio=slots===1?.5:index/(slots-1),angle=startAngle+(endAngle-startAngle)*ratio,rad=angle*Math.PI/180,x=500+radius*Math.cos(rad),y=500+radius*Math.sin(rad),rotation=position==='top'?angle+90:angle-90;const node=document.createElementNS('http://www.w3.org/2000/svg','text');node.setAttribute('x',x.toFixed(2));node.setAttribute('y',y.toFixed(2));node.setAttribute('transform',`rotate(${rotation.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)})`);node.setAttribute('text-anchor','middle');node.setAttribute('dominant-baseline','middle');node.setAttribute('font-size',String(fontSize));node.textContent=ch;group.appendChild(node);});
  }

  function renderSportButtons(){
    const root=$('#lab-sport-grid');root.innerHTML='';
    SPORTS.forEach(sport=>{const meta=CATALOG[sport],b=document.createElement('button');b.type='button';b.className='lab-sport-button'+(sport===activeSport?' is-selected':'');b.innerHTML=`<span>${sport}</span><strong>${meta.subtitle}</strong><small>${meta.teams.length} teams</small>`;b.addEventListener('click',()=>switchSport(sport));root.appendChild(b);});
  }

  function renderLogoModes(){
    const root=$('#lab-logo-mode-options');root.innerHTML='';root.classList.toggle('is-single',(CATALOG[activeSport].logoModes||[]).length===1);
    const modes=CATALOG[activeSport].logoModes||['official'];
    if(!modes.includes(activeLogoMode))activeLogoMode=CATALOG[activeSport].defaultLogoMode||modes[0];
    modes.forEach(mode=>{const b=document.createElement('button');b.type='button';b.className='lab-logo-mode-button'+(mode===activeLogoMode?' is-selected':'');if(mode==='custom')b.innerHTML='<span>WESTTECH</span><strong>Team Art</strong><small>Original WestTech sports emblem</small>';else b.innerHTML=`<span>${activeSport}</span><strong>Team Logo</strong><small>Existing real team-logo artwork</small>`;b.addEventListener('click',()=>{activeLogoMode=mode;dirty=false;restoreDraft(activeSport,false);syncUI();$('#lab-status-subtitle').textContent=mode==='custom'?'WestTech Team Art baseline loaded.':'Official team-logo baseline loaded.';});root.appendChild(b);});
    $('#lab-logo-mode-note').textContent=activeSport==='NFL'?'NFL can preview either WestTech Team Art or the real NFL Team Logo. Every other sport currently uses the real team-logo library only.':`${activeSport} uses the real team-logo library. No WestTech art set is enabled for this sport.`;
  }

  function populateTeamSelect(){
    const select=$('#lab-team-select');select.innerHTML=teamList().map(t=>`<option value="${t.id}">${fullName(t)}</option>`).join('');select.value=activeTeamId;
  }
  function entryOptionLabel(item){return `${item.label} — ${item.material||'Legacy'}`;}
  function filteredPalette(){return materialFilter==='all'?palette:palette.filter(item=>item.family===materialFilter);}
  function optionMarkup(currentId){
    const visible=filteredPalette().slice(),current=paletteEntry(currentId);
    if(current&&!visible.some(item=>item.id===current.id))visible.unshift(current);
    const order=['PETG','PLA','PLA+','PLA+ 2.0'];
    return order.map(material=>{
      const entries=visible.filter(item=>item.material===material);
      if(!entries.length)return'';
      return `<optgroup label="${material}">${entries.map(item=>`<option value="${item.id}">${entryOptionLabel(item)}</option>`).join('')}</optgroup>`;
    }).join('');
  }
  function populateColorSelects(){
    const p=profile();
    ['field','nameRing','ringText','accentRing','outline','logoOutline'].forEach(k=>{const el=$(`#lab-role-${k}`);if(el){const value=p[k]||normalizeColorId(DEFAULT_PROFILE[k]);el.innerHTML=optionMarkup(value);el.value=value;}});
  }
  function renderMaterialFilter(){
    const root=$('#lab-material-filter');if(!root)return;
    root.querySelectorAll('[data-material-filter]').forEach(btn=>{const on=btn.dataset.materialFilter===materialFilter;btn.classList.toggle('is-selected',on);btn.setAttribute('aria-pressed',on?'true':'false');});
    const count=filteredPalette().length,note=$('#lab-material-filter-note');
    if(note)note.textContent=materialFilter==='PETG'?`${count} PETG colors shown. PETG stays separate from the PLA family.`:materialFilter==='PLA_FAMILY'?`${count} PLA-family colors shown across PLA, PLA+, and PLA+ 2.0.`:`${count} stocked filament choices shown. Use the filter to narrow the picker.`;
  }
  function setMaterialFilter(value){if(!['all','PETG','PLA_FAMILY'].includes(value))return;materialFilter=value;localStorage.setItem('wt-color-lab-material-filter',value);renderMaterialFilter();populateColorSelects();renderPalette();syncUI();}
  function renderPalette(){const root=$('#lab-palette-key');root.innerHTML='';filteredPalette().forEach(p=>{const s=document.createElement('span');s.className='key-chip';s.style.background=p.hex;s.title=`${entryOptionLabel(p)} · ${p.filament||'No filament listed'}`;root.appendChild(s);});}
  function setSwatch(role,id){const entry=paletteEntry(id),sw=$(`#swatch-${role}`),ref=$(`#filament-${role}`);if(sw)sw.style.background=entry?.hex||'#fff';if(ref){ref.className='filament-ref';if(entry?.filamentStatus)ref.classList.add(entry.filamentStatus);ref.textContent=entry?`${entry.label} · ${entry.material||''} · ${entry.filament||'No filament listed'}${entry.filamentNote?` — ${entry.filamentNote}`:''}`:'No palette entry';}}
  function renderMaterialStatus(){
    const el=$('#lab-material-status');if(!el)return;
    const p=profile(),ids=['field','nameRing','ringText','accentRing','outline'].map(key=>p[key]);
    if(p.logoOutlineEnabled)ids.push(p.logoOutline);
    const families=new Set(ids.map(id=>paletteEntry(id)?.family).filter(Boolean));
    const mixed=families.has('PETG')&&families.has('PLA_FAMILY');
    el.classList.toggle('is-mixed',mixed);
    el.textContent=mixed?'MIXED MATERIALS: this team currently uses PETG and PLA-family colors.':families.has('PETG')?'Current team material: PETG only.':families.has('PLA_FAMILY')?'Current team material: PLA family only.':'Current team material: no stocked filament selected.';
  }

  function renderStatus(){const root=$('#lab-team-status'),profiles=profilesFor(),approved=teamList().filter(t=>profiles[t.id]?.approved).length;$('#lab-progress-title').textContent=`Approved teams: ${approved} / ${teamList().length}`;root.innerHTML='';teamList().forEach(t=>{const b=document.createElement('button');b.type='button';b.className='status-chip';if(profiles[t.id]?.approved)b.classList.add('is-approved');if(t.id===activeTeamId)b.classList.add('is-active');b.textContent=t.id.length<=5?t.id:String(teamList().indexOf(t)+1);b.title=fullName(t);b.addEventListener('click',()=>{activeTeamId=t.id;syncUI();});root.appendChild(b);});}

  function applyLogoImage(img,src,fallback){
    if(!src){img.style.display='none';fallback.style.display='block';return;}
    img.style.display='block';fallback.style.display='none';img.setAttribute('href',src);
    const test=new Image();test.onload=()=>{img.style.display='block';fallback.style.display='none';};test.onerror=()=>{img.style.display='none';fallback.style.display='block';};test.src=src;
  }

  function renderPreview(){
    const t=teamById(activeTeamId),p=profile(),coaster=$('#lab-coaster');if(!t)return;
    coaster.style.setProperty('--field',color(p.field,'#1677c4'));coaster.style.setProperty('--ring',color(p.nameRing,'#f5f5f2'));coaster.style.setProperty('--ringText',color(p.ringText,'#111317'));coaster.style.setProperty('--accent',color(p.accentRing,'#111317'));coaster.style.setProperty('--outline',color(p.outline,'#111317'));
    renderRingLetters($('#lab-top-text'),t.city,'top');renderRingLetters($('#lab-bottom-text'),t.name,'bottom');
    const img=$('#lab-team-logo'),fallback=$('#lab-logo-fallback');fallback.textContent=(t.id||activeSport).slice(0,6).toUpperCase();
    const baseSize=activeLogoMode==='official'?700:630,scale=activeLogoScale(),size=baseSize*(scale/100),pos=(1000-size)/2;
    img.setAttribute('x',pos.toFixed(2));img.setAttribute('y',pos.toFixed(2));img.setAttribute('width',size.toFixed(2));img.setAttribute('height',size.toFixed(2));
    applyLogoImage(img,logoPath(t),fallback);
    const out=$('#lab-team-logo-outline'),outPaths=$('#lab-team-logo-outline-paths'),outlineAvailable=activeSport==='NFL'&&activeLogoMode==='custom';
    out.setAttribute('x',pos.toFixed(2));out.setAttribute('y',pos.toFixed(2));out.setAttribute('width',size.toFixed(2));out.setAttribute('height',size.toFixed(2));
    const outlineData=outlineAvailable?TEAM_ART_OUTLINES[t.id]:null;
    out.classList.toggle('is-visible',!!(outlineData&&p.logoOutlineEnabled));
    if(outlineData&&p.logoOutlineEnabled){
      out.setAttribute('viewBox',outlineData.viewBox||'0 0 1000 1000');
      outPaths.replaceChildren();
      outlineData.paths.forEach(part=>{const node=document.createElementNS('http://www.w3.org/2000/svg','path');node.setAttribute('d',part.d);node.setAttribute('fill',color(p.logoOutline,'#111317'));if(part.fillRule)node.setAttribute('fill-rule',part.fillRule);if(part.clipRule)node.setAttribute('clip-rule',part.clipRule);outPaths.appendChild(node);});
    }else outPaths.replaceChildren();
    $('#lab-preview-name').textContent=fullName(t);$('#lab-preview-sport').textContent=activeSport;$('#lab-preview-title').textContent=`${fullName(t)} ${activeSport} coaster preview`;$('#lab-preview-desc').textContent=`${fullName(t)} preview with ${activeLogoMode==='official'?'real team logo':'WestTech Team Art'} and the current coaster color profile.`;
  }

  function syncUI(){
    const t=teamById(activeTeamId);if(!t)return;const p=profile();
    renderSportButtons();renderLogoModes();populateTeamSelect();populateColorSelects();renderMaterialFilter();
    $('#lab-status-title').textContent=`${activeSport} · Single Team`;$('#lab-team-name').textContent=fullName(t);$('#lab-team-code').textContent=`${t.id} · ${activeSport} SINGLE TEAM`;$('#lab-team-icon').src=logoPath(t);$('#lab-team-icon').alt=`${fullName(t)} logo`;$('#lab-approved').checked=!!p.approved;$('#lab-notes').value=p.notes||'';$('#lab-active-team-card').classList.toggle('is-approved',!!p.approved);
    ['field','nameRing','ringText','accentRing','outline','logoOutline'].forEach(k=>{const el=$(`#lab-role-${k}`);if(el)el.value=p[k]||DEFAULT_PROFILE[k];setSwatch(k,p[k]||DEFAULT_PROFILE[k]);});
    const outlineAvailable=activeSport==='NFL'&&activeLogoMode==='custom';$('#lab-role-logoOutlineEnabled').checked=outlineAvailable&&!!p.logoOutlineEnabled;$('#lab-role-logoOutlineEnabled').disabled=!outlineAvailable;$('#lab-role-logoOutline').disabled=!outlineAvailable||!p.logoOutlineEnabled;$('#lab-logo-outline-wrap').classList.toggle('is-unavailable',!outlineAvailable);$('#lab-logo-outline-wrap').classList.toggle('is-enabled',outlineAvailable&&!!p.logoOutlineEnabled);$('#lab-logo-outline-note').textContent=outlineAvailable?'Available for WestTech Team Art preview.':'Whole-logo outline preview is disabled for real team logos.';
    const logoScale=activeLogoScale();$('#lab-logo-size-slider').value=String(logoScale);$('#lab-logo-size-number').value=String(logoScale);$('#lab-logo-size-control').classList.toggle('is-custom-mode',activeSport==='NFL'&&activeLogoMode==='custom');
    renderPreview();renderStatus();renderMaterialStatus();$('#lab-draft-state').textContent=dirty?'This sport has unsaved changes in the current session.':'Working from the loaded/saved sport baseline.';
  }

  function switchSport(sport){
    if(!CATALOG[sport])return;activeSport=sport;activeLogoMode=CATALOG[sport].defaultLogoMode||'official';const preferred={NFL:'DEN',NHL:'COL',MLB:'Colorado_Rockies',NBA:'Denver_Nuggets',MLS:'Colorado_Rapids',WNBA:'Las_Vegas_Aces'}[sport];activeTeamId=teamList().some(t=>t.id===preferred)?preferred:teamList()[0]?.id;const restored=restoreDraft(sport,false);dirty=false;syncUI();$('#lab-status-subtitle').textContent=restored?`${sport} browser draft restored.`:(sport==='NFL'||sport==='NHL'?`Approved ${sport} production baseline loaded.`:`${sport} real-logo catalog loaded. Seed colors are a starting point until you approve each team.`);
  }

  function buildExport(sport){const vars=exportGlobals(sport),stamp=new Date().toISOString(),profiles=profilesFor(sport),label=sport==='NFL'&&activeLogoMode==='custom'?'WestTech Team Art':'Single Team';return `(function(){\n  'use strict';\n  // WestTech ${sport} ${label} production color baseline.\n  // Sports Color Lab export generated: ${stamp}\n  window.${vars.palette} = ${JSON.stringify(palette,null,2)};\n\n  window.${vars.profiles} = ${JSON.stringify(profiles,null,2)};\n})();\n`;}
  function download(filename,text,type='application/javascript'){const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  function saveDraft(){localStorage.setItem(storageKey(activeSport),JSON.stringify({sport:activeSport,mode:activeLogoMode,baselineSignature:baselineSignature(activeSport),palette,profiles:profilesFor(),activeTeamId,materialFilter,savedAt:new Date().toISOString()}));dirty=false;syncUI();$('#lab-status-subtitle').textContent=`${activeSport} browser draft saved ${new Date().toLocaleString()}.`;}
  function restoreDraft(sport,announce=true){const raw=localStorage.getItem(storageKey(sport));if(!raw)return false;try{const d=JSON.parse(raw);if(d.baselineSignature!==baselineSignature(sport)){localStorage.removeItem(storageKey(sport));if(announce)$('#lab-status-subtitle').textContent=`Ignored an older ${sport} browser draft because the packaged baseline has changed.`;return false;}if(d.profiles)setProfilesFor(sport,activeLogoMode,normalizeProfiles(sport,d.profiles));palette=clone(BASE_PALETTE);if(d.materialFilter&&['all','PETG','PLA_FAMILY'].includes(d.materialFilter))materialFilter=d.materialFilter;if(d.activeTeamId&&CATALOG[sport].teams.some(t=>t.id===d.activeTeamId))activeTeamId=d.activeTeamId;if(announce)$('#lab-status-subtitle').textContent=`Restored ${sport} ${activeLogoMode==='custom'?'Team Art':'Team Logo'} browser draft${d.savedAt?' from '+new Date(d.savedAt).toLocaleString():''}.`;return true;}catch(e){console.warn(e);return false;}}

  async function importFile(e){const file=e.target.files?.[0];if(!file)return;try{const txt=await file.text();let foundSport=null,foundMode='official',foundPalette=null,foundProfiles=null;if(file.name.toLowerCase().endsWith('.json')){const d=JSON.parse(txt);foundSport=d.sport||null;foundMode=d.mode||'official';foundPalette=d.palette||null;foundProfiles=d.profiles||null;}else{const w={};new Function('window',txt+';return window;')(w);if(w.WestTechNFLTeamArtProfiles){foundSport='NFL';foundMode='custom';foundProfiles=w.WestTechNFLTeamArtProfiles;foundPalette=w.WestTechNFLTeamArtPrintPalette||BASE_PALETTE;}else{for(const sport of SPORTS){const v=exportGlobals(sport,'official');if(w[v.profiles]){foundSport=sport;foundMode='official';foundProfiles=w[v.profiles];foundPalette=w[v.palette]||BASE_PALETTE;break;}}}}if(!foundSport||!CATALOG[foundSport]||!foundProfiles)throw new Error('No supported Sports Color Lab profile set was found.');activeSport=foundSport;activeLogoMode=foundSport==='NFL'&&foundMode==='custom'?'custom':(CATALOG[foundSport].defaultLogoMode||'official');palette=clone(BASE_PALETTE);setProfilesFor(foundSport,activeLogoMode,normalizeProfiles(foundSport,foundProfiles));activeTeamId=CATALOG[foundSport].teams[0].id;dirty=false;populateColorSelects();renderPalette();syncUI();$('#lab-status-subtitle').textContent=`Loaded ${file.name} as ${foundSport} ${activeLogoMode==='custom'?'Team Art':'Team Logo'}.`;}catch(err){alert(`Import failed: ${err.message}`);$('#lab-status-subtitle').textContent=`Import failed: ${err.message}`;}finally{e.target.value='';}}

  function attach(){
    $('#lab-team-select').addEventListener('change',e=>{activeTeamId=e.target.value;syncUI();});
    ['field','nameRing','ringText','accentRing','outline','logoOutline'].forEach(k=>$('#lab-role-'+k).addEventListener('change',e=>{profilesFor()[activeTeamId][k]=e.target.value;dirty=true;syncUI();}));
    $('#lab-role-logoOutlineEnabled').addEventListener('change',e=>{profilesFor()[activeTeamId].logoOutlineEnabled=e.target.checked;dirty=true;syncUI();});
    $('#lab-approved').addEventListener('change',e=>{profilesFor()[activeTeamId].approved=e.target.checked;dirty=true;syncUI();});
    $('#lab-notes').addEventListener('input',e=>{profilesFor()[activeTeamId].notes=e.target.value;dirty=true;$('#lab-draft-state').textContent='This sport has unsaved changes in the current session.';});
    const applyLogoScale=value=>{const v=clampLogoScale(value);profilesFor()[activeTeamId][activeLogoScaleKey()]=v;dirty=true;$('#lab-logo-size-slider').value=String(v);$('#lab-logo-size-number').value=String(v);renderPreview();$('#lab-draft-state').textContent='This sport has unsaved changes in the current session.';};
    $('#lab-logo-size-slider').addEventListener('input',e=>applyLogoScale(e.target.value));
    $('#lab-logo-size-number').addEventListener('input',e=>{const n=Number(e.target.value);if(Number.isFinite(n)&&n>=30&&n<=120){profilesFor()[activeTeamId][activeLogoScaleKey()]=Math.round(n);dirty=true;$('#lab-logo-size-slider').value=String(Math.round(n));renderPreview();$('#lab-draft-state').textContent='This sport has unsaved changes in the current session.';}});
    $('#lab-logo-size-number').addEventListener('change',e=>applyLogoScale(e.target.value));
    $('#lab-logo-size-reset').addEventListener('click',()=>applyLogoScale(100));
    $('#lab-prev-team').addEventListener('click',()=>{const list=teamList(),i=Math.max(0,list.findIndex(t=>t.id===activeTeamId)-1);activeTeamId=list[i].id;syncUI();});
    $('#lab-next-team').addEventListener('click',()=>{const list=teamList(),i=Math.min(list.length-1,list.findIndex(t=>t.id===activeTeamId)+1);activeTeamId=list[i].id;syncUI();});
    $('#lab-reset-team').addEventListener('click',()=>{profilesFor()[activeTeamId]=clone(baselineFor()?.[activeTeamId]||DEFAULT_PROFILE);dirty=true;syncUI();});
    $('#lab-save-draft').addEventListener('click',saveDraft);
    $('#lab-reset-baseline').addEventListener('click',()=>{setProfilesFor(activeSport,activeLogoMode,clone(baselineFor()));localStorage.removeItem(storageKey(activeSport));dirty=false;syncUI();$('#lab-status-subtitle').textContent=`${activeSport} reset to its packaged baseline.`;});
    $('#lab-download-js').addEventListener('click',()=>{download(activeSport==='NFL'&&activeLogoMode==='custom'?'nfl-team-art-color-baseline.js':`${activeSport.toLowerCase()}-single-team-color-baseline.js`,buildExport(activeSport));$('#lab-status-subtitle').textContent=`${activeSport} JS baseline downloaded ${new Date().toLocaleString()}.`;});
    $('#lab-import-file').addEventListener('change',importFile);
    $$('#lab-material-filter [data-material-filter]').forEach(btn=>btn.addEventListener('click',()=>setMaterialFilter(btn.dataset.materialFilter)));
  }

  restoreDraft('NFL',false);attach();renderMaterialFilter();populateColorSelects();renderPalette();syncUI();
})();