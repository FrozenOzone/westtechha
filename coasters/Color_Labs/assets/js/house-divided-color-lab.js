(function(){
  'use strict';

  const SPORTS=['NFL','NHL','MLB','NBA','MLS','WNBA'];
  const catalog=window.WestTechSportsColorLabCatalog||{};
  const $=(sel,root=document)=>root.querySelector(sel);
  const $$=(sel,root=document)=>Array.from(root.querySelectorAll(sel));
  const clone=value=>JSON.parse(JSON.stringify(value));
  const clamp=(value,min,max)=>Math.min(max,Math.max(min,Number(value)||min));
  const INVENTORY=clone(window.WestTechFilamentInventory||[]);
  const LEGACY_COLOR_MAP=Object.assign({},window.WestTechLegacyColorMap||{});
  const HOUSE_ACCENTS=clone(window.WestTechHouseAccentBaseline||{standard:{band:'petg-black',text:'petg-white',fallback:'petg-white'},sports:{}});
  // Standard House uses the same already-approved Team Art outline treatment as the public House builder.
  // House logo SIZE remains House-specific in nfl-house-divided-color-baseline.js.
  const TEAM_ART_OUTLINES=window.WestTechNFLTeamArtOutlineData||{};
  const TEAM_ART_BASELINE=clone(window.WestTechNFLTeamArtProfiles||{});
  const TEAM_ART_WORKING=clone(TEAM_ART_BASELINE);
  const HD_DEFAULT_BAND='petg-black';
  const HD_DEFAULT_TEXT='petg-white';
  const HD_FALLBACK='petg-white';
  let materialFilter=localStorage.getItem('wt-color-lab-material-filter')||'all';
  if(!['all','PETG','PLA_FAMILY'].includes(materialFilter))materialFilter='all';

  function windowName(sport,type){
    if(type==='palette') return sport==='NFL'?'WestTechNFLPrintPalette':`WestTech${sport}HouseDividedPrintPalette`;
    if(type==='profiles') return `WestTech${sport}HouseDividedProfiles`;
    if(type==='frame') return `WestTech${sport}HouseDividedFrame`;
    return '';
  }

  function normalizeColorId(value){
    if(INVENTORY.some(item=>item.id===value))return value;
    return LEGACY_COLOR_MAP[value]||'petg-white';
  }
  function normalizeSource(sport,source){
    const frame=clone(source?.frame||{outer:'white',inner:'black'});
    frame.outer=normalizeColorId(frame.outer);frame.inner=normalizeColorId(frame.inner);
    const profiles=clone(source?.profiles||{});
    Object.keys(profiles).forEach(id=>{
      ['field','band','text','house'].forEach(key=>profiles[id][key]=normalizeColorId(profiles[id][key]));
      if(['NFL','NHL'].includes(sport)){
        if(sport==='NHL'){profiles[id].band=HD_DEFAULT_BAND;profiles[id].text=HD_DEFAULT_TEXT;}
        const rec=HOUSE_ACCENTS?.sports?.[sport]?.[id];
        if(rec?.approved&&rec.preferred)profiles[id].house=normalizeColorId(rec.preferred);
      }
      if(!Number.isFinite(Number(profiles[id].logoScaleOfficial)))profiles[id].logoScaleOfficial=100;
      if(!Number.isFinite(Number(profiles[id].logoScaleCustom)))profiles[id].logoScaleCustom=100;
      profiles[id].logoScaleOfficial=clamp(profiles[id].logoScaleOfficial,30,120);
      profiles[id].logoScaleCustom=clamp(profiles[id].logoScaleCustom,30,120);
    });
    return {frame,palette:clone(INVENTORY),profiles};
  }
  function loadedSource(sport){
    return normalizeSource(sport,{
      frame:window[windowName(sport,'frame')]||{outer:'white',inner:'black'},
      palette:window[windowName(sport,'palette')]||[],
      profiles:window[windowName(sport,'profiles')]||{}
    });
  }

  const baseline={};
  const working={};
  const dirty={};
  SPORTS.forEach(sport=>{
    baseline[sport]=loadedSource(sport);
    working[sport]=clone(baseline[sport]);
    dirty[sport]=false;
  });

  const defaultMatchups={
    NFL:['DEN','DAL'],
    NHL:['COL','PHI'],
    MLB:['Colorado_Rockies','Arizona_Diamondbacks'],
    NBA:['Denver_Nuggets','Chicago_Bulls'],
    MLS:['Colorado_Rapids','LA_Galaxy'],
    WNBA:['Las_Vegas_Aces','Seattle_Storm']
  };
  const matchup={};
  SPORTS.forEach(sport=>{
    const teams=(catalog[sport]&&catalog[sport].teams)||[];
    const preferred=defaultMatchups[sport]||[];
    matchup[sport]={
      one:teams.some(t=>t.id===preferred[0])?preferred[0]:(teams[0]&&teams[0].id),
      two:teams.some(t=>t.id===preferred[1])?preferred[1]:(teams[1]&&teams[1].id)||(teams[0]&&teams[0].id)
    };
  });

  const logoMode={NFL:'custom',NHL:'official',MLB:'official',NBA:'official',MLS:'official',WNBA:'official'};
  let activeSport='NFL';

  function storageKey(sport){return sport==='NFL'?'wt-house-divided-color-lab-nfl-draft-v4-wt-single-sync':`wt-house-divided-color-lab-${sport.toLowerCase()}-draft-v1`; }
  function teams(){return (catalog[activeSport]&&catalog[activeSport].teams)||[];}
  function team(id){return teams().find(t=>t.id===id)||teams()[0]||null;}
  function profile(id){return working[activeSport].profiles[id]||null;}
  function palette(){return working[activeSport].palette||[];}
  function paletteEntry(id){return palette().find(item=>item.id===id)||null;}
  function hex(id,fallback='#111317'){return paletteEntry(id)?.hex||fallback;}
  function sameColor(a,b){return String(a||'').trim().toLowerCase()===String(b||'').trim().toLowerCase();}
  function approvedAccentRecord(teamId){
    const rec=HOUSE_ACCENTS?.sports?.[activeSport]?.[teamId];
    return rec&&rec.approved&&rec.preferred?rec:null;
  }
  function preferredAccentId(teamId){return approvedAccentRecord(teamId)?.preferred||HD_FALLBACK;}
  function resolvedHousePair(teamOneId,teamTwoId){
    const a=approvedAccentRecord(teamOneId),b=approvedAccentRecord(teamTwoId);
    let one=a?.preferred||HD_FALLBACK,two=b?.preferred||HD_FALLBACK;
    let usedAlternate=false,usedFallback=false;
    if(one&&two&&one===two){
      if(b?.alternate&&b.alternate!==one){two=b.alternate;usedAlternate=true;}
      else if(a?.alternate&&a.alternate!==two){one=a.alternate;usedAlternate=true;}
      else if(one!==HD_FALLBACK){two=HD_FALLBACK;usedFallback=true;}
    }
    return {one,two,usedAlternate,usedFallback};
  }
  function dividerColorForProfile(p){
    const black=hex('petg-black','#111317'),grey=hex('petg-grey','#8d949b');
    return ['NFL','NHL'].includes(activeSport)&&p&&sameColor(hex(p.field,'#fff'),black)&&sameColor(hex(p.band,black),black)?grey:black;
  }
  function fullName(t){return t?`${t.city} ${t.name}`:'Choose a team';}
  function mode(){return activeSport==='NFL'?logoMode.NFL:'official';}
  function scaleKey(){return mode()==='custom'?'logoScaleCustom':'logoScaleOfficial';}
  function teamArtProfile(id){return TEAM_ART_WORKING[id]||null;}
  function showTeamArtOutline(){return activeSport==='NFL'&&mode()==='custom';}
  function contrastTextId(colorId){
    const value=String(hex(colorId,'#111317')).replace('#','');
    if(!/^[0-9a-f]{6}$/i.test(value))return 'petg-white';
    const rgb=[0,2,4].map(i=>parseInt(value.slice(i,i+2),16)/255).map(c=>c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4));
    const luminance=0.2126*rgb[0]+0.7152*rgb[1]+0.0722*rgb[2];
    const whiteContrast=1.05/(luminance+0.05),blackContrast=(luminance+0.05)/0.05;
    return whiteContrast>=blackContrast?'petg-white':'petg-black';
  }
  function resolvedCenterBands(teamOneId,teamTwoId){
    const p1=profile(teamOneId)||{},p2=profile(teamTwoId)||{};
    if(activeSport==='NHL')return {oneBandId:HD_DEFAULT_BAND,twoBandId:HD_DEFAULT_BAND,oneTextId:HD_DEFAULT_TEXT,twoTextId:HD_DEFAULT_TEXT};
    const fields=[hex(p1.field,'#111317'),hex(p2.field,'#111317')];
    const collides=id=>fields.some(value=>sameColor(hex(id,''),value));
    const fallback=(avoidId='')=>{
      const ids=['petg-white','petg-black','petg-grey'];
      for(const id of ids){
        if(!paletteEntry(id)||collides(id))continue;
        if(avoidId&&sameColor(hex(id,''),hex(avoidId,'')))continue;
        return id;
      }
      for(const id of ids){if(paletteEntry(id)&&!collides(id))return id;}
      return HD_FALLBACK;
    };
    let oneBandId=p1.band||HD_DEFAULT_BAND,twoBandId=p2.band||HD_DEFAULT_BAND;
    let oneChanged=false,twoChanged=false;
    if(collides(oneBandId)){oneBandId=fallback(twoBandId);oneChanged=true;}
    if(collides(twoBandId)){twoBandId=fallback(oneBandId);twoChanged=true;}
    return {
      oneBandId,
      twoBandId,
      oneTextId:oneChanged?contrastTextId(oneBandId):(p1.text||HD_DEFAULT_TEXT),
      twoTextId:twoChanged?contrastTextId(twoBandId):(p2.text||HD_DEFAULT_TEXT)
    };
  }
  function restoreWtSingleColors(side){
    if(activeSport!=='NFL'||mode()!=='custom')return;
    const id=matchup[activeSport][side],source=TEAM_ART_BASELINE[id],p=profile(id),tp=teamArtProfile(id);
    if(!source||!p||!tp)return;
    p.field=normalizeColorId(source.field);
    p.band=normalizeColorId(source.accentRing);
    p.text=contrastTextId(p.band);
    tp.logoOutlineEnabled=source.logoOutlineEnabled===true;
    tp.logoOutline=normalizeColorId(source.logoOutline||'petg-white');
    markDirty();
    populatePaletteControls();
    syncSide(side);
    if(matchup[activeSport][side==='one'?'two':'one']===id)syncSide(side==='one'?'two':'one');
    renderMaterialStatus();
    renderPreview();
    $('#lab-status-subtitle').textContent=`${fullName(team(id))} restored from the approved WT Single palette. House logo size and divided-house accent were preserved.`;
  }

  function logoUrl(t){
    if(!t)return'';
    const file=t.file||`${t.id}.svg`;
    if(activeSport==='NFL') return `../images/coasters/teams/nfl/${mode()==='custom'?'custom':'official'}/${file}`;
    return `../images/coasters/teams/${activeSport.toLowerCase()}/official/${file}`;
  }

  function entryOptionLabel(item){return `${item.label} — ${item.material||'Legacy'}`;}
  function filteredPalette(){return materialFilter==='all'?palette():palette().filter(item=>item.family===materialFilter);}
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

  function filamentText(roleId,colorId){
    const entry=paletteEntry(colorId),el=document.getElementById(`filament-${roleId}`);
    if(!el)return;
    el.className='filament-ref';
    if(entry?.filamentStatus)el.classList.add(entry.filamentStatus);
    el.textContent=entry?`${entry.label} · ${entry.material||''} · ${entry.filament||'No filament listed'}${entry.filamentNote?` — ${entry.filamentNote}`:''}`:'No palette entry found';
  }

  function setRoleUI(side,key,value){
    const select=document.getElementById(`lab-${side}-${key}`);
    const swatch=document.getElementById(`swatch-${side}-${key}`);
    if(select)select.value=value||'';
    if(swatch)swatch.style.background=hex(value,'#fff');
    filamentText(`${side}-${key}`,value);
  }

  function setFrameUI(key,value){
    const select=document.getElementById(`lab-frame-${key}`),swatch=document.getElementById(`swatch-frame-${key}`);
    if(select)select.value=value||'';
    if(swatch)swatch.style.background=hex(value,'#fff');
    filamentText(`frame-${key}`,value);
  }

  function populatePaletteControls(){
    ['one','two'].forEach(side=>{
      ['field','band','text','house'].forEach(key=>{
        const el=document.getElementById(`lab-${side}-${key}`),p=profile(matchup[activeSport]?.[side]);
        if(el){const value=p?.[key]||'petg-white';el.innerHTML=optionMarkup(value);el.value=value;}
      });
      const out=document.getElementById(`lab-${side}-logoOutline`),tp=teamArtProfile(matchup[activeSport]?.[side]);
      if(out){const value=tp?.logoOutline||'petg-white';out.innerHTML=optionMarkup(value);out.value=value;}
    });
    ['outer','inner'].forEach(key=>{const el=document.getElementById(`lab-frame-${key}`),value=working[activeSport]?.frame?.[key]||'petg-white';if(el){el.innerHTML=optionMarkup(value);el.value=value;}});
  }

  function populateTeamSelects(){
    const markup=teams().map(t=>`<option value="${t.id}">${fullName(t)}</option>`).join('');
    $('#lab-team-one').innerHTML=markup;
    $('#lab-team-two').innerHTML=markup;
    $('#lab-team-one').value=matchup[activeSport].one;
    $('#lab-team-two').value=matchup[activeSport].two;
  }

  function renderSportButtons(){
    const root=$('#lab-sport-grid');root.innerHTML='';
    SPORTS.forEach(sport=>{
      if(!catalog[sport])return;
      const btn=document.createElement('button');
      btn.type='button';
      btn.className='lab-sport-option';
      if(sport===activeSport)btn.classList.add('is-selected');
      btn.innerHTML=`<span>${sport}</span><strong>${catalog[sport].subtitle||sport}</strong><small>${catalog[sport].teamCount||catalog[sport].teams.length} teams</small>`;
      btn.addEventListener('click',()=>switchSport(sport));
      root.appendChild(btn);
    });
  }

  function renderLogoModes(){
    const root=$('#lab-logo-mode-options');root.innerHTML='';
    const modes=activeSport==='NFL'?['custom','official']:['official'];
    modes.forEach(value=>{
      const btn=document.createElement('button');btn.type='button';btn.className='lab-logo-mode-option';
      if(mode()===value)btn.classList.add('is-selected');
      btn.innerHTML=value==='custom'?'<span>WESTTECH</span><strong>Team Art</strong><small>WestTech-created NFL artwork</small>':`<span>${activeSport}</span><strong>Team Logo</strong><small>Real team logo artwork</small>`;
      btn.addEventListener('click',()=>{if(activeSport!=='NFL')return;logoMode.NFL=value;renderLogoModes();syncEditors();renderPreview();});
      root.appendChild(btn);
    });
    $('#lab-logo-mode-note').textContent=activeSport==='NFL'?'NFL remembers separate logo sizes for WestTech Team Art and the real NFL Team Logo.':'This sport uses the real team-logo library only.';
  }

  function renderMaterialFilter(){
    const root=$('#lab-material-filter');if(!root)return;
    root.querySelectorAll('[data-material-filter]').forEach(btn=>{const on=btn.dataset.materialFilter===materialFilter;btn.classList.toggle('is-selected',on);btn.setAttribute('aria-pressed',on?'true':'false');});
    const count=filteredPalette().length,note=$('#lab-material-filter-note');
    if(note)note.textContent=materialFilter==='PETG'?`${count} PETG colors shown. PETG stays separate from the PLA family.`:materialFilter==='PLA_FAMILY'?`${count} PLA-family colors shown across PLA, PLA+, and PLA+ 2.0.`:`${count} stocked filament choices shown. Use the filter to narrow the picker.`;
  }
  function setMaterialFilter(value){if(!['all','PETG','PLA_FAMILY'].includes(value))return;materialFilter=value;localStorage.setItem('wt-color-lab-material-filter',value);renderMaterialFilter();populatePaletteControls();renderPaletteKey();syncEditors();}
  function renderPaletteKey(){
    const root=$('#lab-palette-key');root.innerHTML='';
    filteredPalette().forEach(entry=>{const chip=document.createElement('span');chip.className='key-chip';chip.style.background=entry.hex;chip.title=`${entryOptionLabel(entry)} · ${entry.filament||''}`;root.appendChild(chip);});
  }
  function renderMaterialStatus(){
    const el=$('#lab-material-status');if(!el)return;
    const frame=working[activeSport]?.frame||{},p1=profile(matchup[activeSport]?.one)||{},p2=profile(matchup[activeSport]?.two)||{},centers=resolvedCenterBands(matchup[activeSport]?.one,matchup[activeSport]?.two);
    const ids=[frame.outer,frame.inner,p1.field,centers.oneBandId,centers.oneTextId,p1.house,p2.field,centers.twoBandId,centers.twoTextId,p2.house];
    if(showTeamArtOutline()){
      const t1=teamArtProfile(matchup[activeSport]?.one),t2=teamArtProfile(matchup[activeSport]?.two);
      if(t1?.logoOutlineEnabled)ids.push(t1.logoOutline);
      if(t2?.logoOutlineEnabled)ids.push(t2.logoOutline);
    }
    const families=new Set(ids.map(id=>paletteEntry(id)?.family).filter(Boolean));
    const mixed=families.has('PETG')&&families.has('PLA_FAMILY');
    el.classList.toggle('is-mixed',mixed);
    el.textContent=mixed?'MIXED MATERIALS: this matchup currently uses PETG and PLA-family colors.':families.has('PETG')?'Current matchup material: PETG only.':families.has('PLA_FAMILY')?'Current matchup material: PLA family only.':'Current matchup material: no stocked filament selected.';
  }

  function renderApprovalChips(){
    const root=$('#lab-team-status');root.innerHTML='';
    const list=teams(),profiles=working[activeSport].profiles;
    const approved=list.filter(t=>profiles[t.id]?.approved===true).length;
    $('#lab-progress-title').textContent=`Approved teams: ${approved} / ${list.length}`;
    list.forEach(t=>{
      const btn=document.createElement('button');btn.type='button';btn.className='approval-chip';
      if(profiles[t.id]?.approved===true)btn.classList.add('approved');
      const short=t.id.length<=4?t.id:t.name;
      btn.innerHTML=`<b>${short}</b><i>${profiles[t.id]?.approved===true?'✓':'·'}</i>`;
      btn.title=`Load ${fullName(t)} into Side 1`;
      btn.addEventListener('click',()=>{matchup[activeSport].one=t.id;$('#lab-team-one').value=t.id;syncEditors();renderPreview();});
      root.appendChild(btn);
    });
  }

  function syncSide(side){
    const id=matchup[activeSport][side],t=team(id),p=profile(id),tp=teamArtProfile(id);
    if(!t||!p)return;
    const card=$(`[data-editor-side="${side}"]`);
    card.classList.toggle('is-approved',p.approved===true);
    document.getElementById(`lab-name-${side}`).textContent=fullName(t);
    document.getElementById(`lab-code-${side}`).textContent=`${t.id} · ${activeSport} HOUSE DIVIDED`;
    const icon=document.getElementById(`lab-icon-${side}`);icon.src=logoUrl(t);icon.alt=`${fullName(t)} logo`;
    document.getElementById(`lab-approved-${side}`).checked=p.approved===true;
    ['field','band','text','house'].forEach(key=>setRoleUI(side,key,p[key]));

    const outlineWrap=document.getElementById(`lab-logo-outline-wrap-${side}`);
    const outlineToggle=document.getElementById(`lab-${side}-logoOutlineEnabled`);
    const outlineSelect=document.getElementById(`lab-${side}-logoOutline`);
    const restoreButton=document.querySelector(`[data-restore-wt-single="${side}"]`);
    const outlineVisible=showTeamArtOutline();
    if(restoreButton)restoreButton.hidden=!outlineVisible;
    if(outlineWrap)outlineWrap.hidden=!outlineVisible;
    if(outlineVisible&&tp){
      setRoleUI(side,'logoOutline',tp.logoOutline||'petg-white');
      if(outlineToggle)outlineToggle.checked=tp.logoOutlineEnabled===true;
      if(outlineSelect)outlineSelect.disabled=tp.logoOutlineEnabled!==true;
      if(outlineWrap)outlineWrap.classList.toggle('is-enabled',tp.logoOutlineEnabled===true);
    }else{
      if(outlineToggle)outlineToggle.checked=false;
      if(outlineSelect)outlineSelect.disabled=true;
      if(outlineWrap)outlineWrap.classList.remove('is-enabled');
    }

    document.getElementById(`lab-notes-${side}`).value=p.notes||'';
    const scale=clamp(p[scaleKey()]??100,30,120);
    document.getElementById(`lab-logo-size-${side}`).value=scale;
    document.getElementById(`lab-logo-size-number-${side}`).value=scale;
    document.getElementById(`lab-logo-size-title-${side}`).textContent=mode()==='custom'?'WestTech Team Art fit':'Real team logo fit';
  }

  function syncEditors(){
    populateTeamSelects();
    syncSide('one');syncSide('two');
    const frame=working[activeSport].frame;
    setFrameUI('outer',frame.outer);setFrameUI('inner',frame.inner);
    renderApprovalChips();renderMaterialStatus();
    $('#lab-status-title').textContent=`${activeSport} · House Divided`;
    $('#lab-preview-sport').textContent=activeSport;
    const controlledHouse=['NFL','NHL'].includes(activeSport),fixedNhlCenter=activeSport==='NHL';
    for(const side of ['one','two']){
      for(const key of ['band','text','house']){
        const el=document.getElementById(`lab-${side}-${key}`);if(!el)continue;
        const locked=key==='house'?controlledHouse:fixedNhlCenter;
        el.disabled=locked;
        el.title=locked?(key==='house'?'Approved House Accent Review controls this automatically.':'NHL center treatment remains fixed for now.'):(activeSport==='NFL'&&(key==='band'||key==='text')?'Shared with House Blackout. Changes here flow to both styles.':'');
      }
    }
    updateDraftState();
  }

  function applyLogoBox(el,side,percent){
    const x=70,w=860,h=385,y=side==='one'?70:545,s=clamp(percent,30,120)/100;
    const nw=w*s,nh=h*s,nx=x+(w-nw)/2,ny=y+(h-nh)/2;
    el.setAttribute('x',nx.toFixed(2));el.setAttribute('y',ny.toFixed(2));el.setAttribute('width',nw.toFixed(2));el.setAttribute('height',nh.toFixed(2));
    return {nx,ny,nw,nh};
  }

  function renderTeamArtOutline(side,t,box){
    const out=document.getElementById(`lab-logo-${side}-outline`),paths=document.getElementById(`lab-logo-${side}-outline-paths`);
    if(!out||!paths)return;
    paths.replaceChildren();
    const p=t?teamArtProfile(t.id):null,data=t?TEAM_ART_OUTLINES[t.id]:null;
    const enabled=!!(showTeamArtOutline()&&data&&p?.logoOutlineEnabled);
    out.classList.toggle('is-visible',enabled);
    if(!enabled)return;
    out.setAttribute('x',box.nx.toFixed(2));out.setAttribute('y',box.ny.toFixed(2));out.setAttribute('width',box.nw.toFixed(2));out.setAttribute('height',box.nh.toFixed(2));
    out.setAttribute('viewBox',data.viewBox||'0 0 1000 1000');
    for(const part of data.paths||[]){
      const node=document.createElementNS('http://www.w3.org/2000/svg','path');
      node.setAttribute('d',part.d);node.setAttribute('fill',hex(p.logoOutline,'#111317'));
      if(part.fillRule)node.setAttribute('fill-rule',part.fillRule);
      if(part.clipRule)node.setAttribute('clip-rule',part.clipRule);
      paths.appendChild(node);
    }
  }

  function setPreviewLogo(side,t,p){
    const img=document.getElementById(`lab-logo-${side}`),fallback=document.getElementById(`lab-logo-fallback-${side}`),src=logoUrl(t);
    const scale=clamp(p[scaleKey()]??100,30,120),box=applyLogoBox(img,side,scale);
    renderTeamArtOutline(side,t,box);
    fallback.textContent=t.id.length<=5?t.id:t.name.slice(0,4).toUpperCase();
    if(src){img.setAttribute('href',src);img.style.display='block';fallback.style.display='none';}
    else{img.removeAttribute('href');img.style.display='none';fallback.style.display='block';}
  }

  function renderPreview(){
    const t1=team(matchup[activeSport].one),t2=team(matchup[activeSport].two),p1=profile(t1?.id),p2=profile(t2?.id);
    if(!t1||!t2||!p1||!p2)return;
    const svg=$('#lab-hd-coaster'),frame=working[activeSport].frame;
    svg.style.setProperty('--frame-outer',hex(frame.outer,'#f5f5f2'));
    svg.style.setProperty('--frame-inner',hex(frame.inner,'#111317'));
    svg.style.setProperty('--one-field',hex(p1.field,'#f26a21'));
    svg.style.setProperty('--two-field',hex(p2.field,'#2447b8'));
    const controlledHouse=['NFL','NHL'].includes(activeSport),fixedNhlCenter=activeSport==='NHL',centers=resolvedCenterBands(t1.id,t2.id);
    const houses=controlledHouse?resolvedHousePair(t1.id,t2.id):{one:p1.house,two:p2.house};
    svg.style.setProperty('--one-band',hex(centers.oneBandId,'#2447b8'));
    svg.style.setProperty('--two-band',hex(centers.twoBandId,'#8d949b'));
    svg.style.setProperty('--one-text',hex(centers.oneTextId,'#f5f5f2'));
    svg.style.setProperty('--two-text',hex(centers.twoTextId,'#f5f5f2'));
    svg.style.setProperty('--one-house',controlledHouse?hex(houses.one,'#f5f5f2'):hex(p1.house,'#f26a21'));
    svg.style.setProperty('--two-house',controlledHouse?hex(houses.two,'#f5f5f2'):hex(p2.house,'#2447b8'));
    setPreviewLogo('one',t1,p1);setPreviewLogo('two',t2,p2);
    $('#lab-band-left').textContent=controlledHouse?'HOUSE':t2.name.toUpperCase();
    $('#lab-band-right').textContent=controlledHouse?'DIVIDED':t1.name.toUpperCase();
    $('#lab-preview-matchup').textContent=`${fullName(t1)} + ${fullName(t2)}`;
    $('#lab-preview-title').textContent=`${fullName(t1)} + ${fullName(t2)} House Divided coaster preview`;
    $('#lab-preview-desc').textContent=activeSport==='NFL'?`Current House Divided production preview with ${fullName(t1)} on top, ${fullName(t2)} on bottom, shared approved center colors/text for Standard and Blackout, and approved house accents.`:controlledHouse?`Current ${activeSport} House Divided production preview with fixed center treatment and approved house accents.`:`House Divided preview with ${fullName(t1)} on the top half and ${fullName(t2)} on the bottom half using ${mode()==='custom'?'WestTech Team Art':'real team logos'}.`;
  }

  function markDirty(){dirty[activeSport]=true;updateDraftState();}
  function updateDraftState(){
    const el=$('#lab-draft-state');if(el)el.textContent=dirty[activeSport]?'This sport has changes not saved to a browser draft.':'Working from loaded baseline / saved draft.';
  }

  function bindSide(side){
    $('#lab-team-'+side).addEventListener('change',e=>{matchup[activeSport][side]=e.target.value;syncEditors();renderPreview();});
    ['field','band','text','house'].forEach(key=>{
      document.getElementById(`lab-${side}-${key}`).addEventListener('change',e=>{
        if((activeSport==='NFL'&&key==='house')||(activeSport==='NHL'&&['band','text','house'].includes(key)))return;
        const p=profile(matchup[activeSport][side]);p[key]=e.target.value;markDirty();syncSide(side);renderApprovalChips();renderPreview();
      });
    });
    document.getElementById(`lab-approved-${side}`).addEventListener('change',e=>{
      const p=profile(matchup[activeSport][side]);p.approved=e.target.checked;markDirty();syncSide(side);renderApprovalChips();
    });
    document.getElementById(`lab-notes-${side}`).addEventListener('input',e=>{profile(matchup[activeSport][side]).notes=e.target.value;markDirty();});
    const outlineToggle=document.getElementById(`lab-${side}-logoOutlineEnabled`),outlineSelect=document.getElementById(`lab-${side}-logoOutline`);
    if(outlineToggle)outlineToggle.addEventListener('change',e=>{
      if(!showTeamArtOutline())return;
      const tp=teamArtProfile(matchup[activeSport][side]);if(!tp)return;
      tp.logoOutlineEnabled=e.target.checked;markDirty();syncSide(side);renderMaterialStatus();renderPreview();
    });
    if(outlineSelect)outlineSelect.addEventListener('change',e=>{
      if(!showTeamArtOutline())return;
      const tp=teamArtProfile(matchup[activeSport][side]);if(!tp)return;
      tp.logoOutline=e.target.value;markDirty();syncSide(side);renderMaterialStatus();renderPreview();
    });
    const restoreButton=document.querySelector(`[data-restore-wt-single="${side}"]`);
    if(restoreButton)restoreButton.addEventListener('click',()=>restoreWtSingleColors(side));
    const slider=document.getElementById(`lab-logo-size-${side}`),number=document.getElementById(`lab-logo-size-number-${side}`);
    function setSize(value){const v=clamp(value,30,120),p=profile(matchup[activeSport][side]);p[scaleKey()]=v;slider.value=v;number.value=v;markDirty();renderPreview();}
    slider.addEventListener('input',e=>setSize(e.target.value));
    number.addEventListener('input',e=>{if(e.target.value==='')return;setSize(e.target.value);});
    document.querySelector(`[data-reset-logo-size="${side}"]`).addEventListener('click',()=>{const id=matchup[activeSport][side],base=baseline[activeSport]?.profiles?.[id];setSize(base?.[scaleKey()]??100);});
  }

  function switchSport(sport){
    if(!catalog[sport])return;
    activeSport=sport;
    populatePaletteControls();
    renderSportButtons();renderLogoModes();renderMaterialFilter();renderPaletteKey();syncEditors();renderPreview();
    $('#lab-status-subtitle').textContent=sport==='NFL'?'NFL Standard starts from the approved WT Single field + accent palette. House logo size stays House-specific; divided-house accents stay automatic. Center colors continue to feed the optional colored-center Blackout treatment.':sport==='NHL'?'NHL field colors and logo sizes come from the approved team baseline. Center treatment remains fixed for now; approved house accents are automatic.':'Seeded from the approved Single Team baseline. Review and approve each House Divided team profile.';
  }

  function buildExport(){
    const data=clone(working[activeSport]),stamp=new Date().toISOString();
    if(['NFL','NHL'].includes(activeSport)){
      Object.keys(data.profiles||{}).forEach(id=>{
        if(activeSport==='NHL'){data.profiles[id].band=HD_DEFAULT_BAND;data.profiles[id].text=HD_DEFAULT_TEXT;}
        data.profiles[id].house=preferredAccentId(id);
      });
    }
    const palName=windowName(activeSport,'palette');
    return `(function(){\n  'use strict';\n  // WestTech ${activeSport} House Divided production color baseline.\n  // House Divided Sports Color Lab export generated: ${stamp}\n  window.${windowName(activeSport,'frame')} = ${JSON.stringify(data.frame)};\n\n  window.${palName} = ${JSON.stringify(data.palette,null,2)};\n\n  window.${windowName(activeSport,'profiles')} = ${JSON.stringify(data.profiles,null,2)};\n})();\n`;
  }

  function buildTeamArtExport(){
    const stamp=new Date().toISOString();
    return `(function(){\n  'use strict';\n  // WestTech NFL WestTech Team Art production color baseline.\n  // House Divided Color Lab outline export generated: ${stamp}\n  window.WestTechNFLTeamArtPrintPalette = ${JSON.stringify(window.WestTechNFLTeamArtPrintPalette||INVENTORY,null,2)};\n\n  window.WestTechNFLTeamArtProfiles = ${JSON.stringify(TEAM_ART_WORKING,null,2)};\n})();\n`;
  }

  function downloadText(name,text){
    const blob=new Blob([text],{type:'application/javascript'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function saveDraft(){
    const payload={sport:activeSport,data:working[activeSport],teamArtProfiles:activeSport==='NFL'?TEAM_ART_WORKING:null,matchup:matchup[activeSport],logoMode:logoMode[activeSport],materialFilter,savedAt:new Date().toISOString()};
    localStorage.setItem(storageKey(activeSport),JSON.stringify(payload));dirty[activeSport]=false;updateDraftState();
    $('#lab-status-subtitle').textContent=`Browser draft saved ${new Date().toLocaleString()}.`;
  }

  function restoreDrafts(){
    SPORTS.forEach(sport=>{
      try{
        const raw=localStorage.getItem(storageKey(sport));if(!raw)return;
        const data=JSON.parse(raw);if(data?.data?.profiles)working[sport]=normalizeSource(sport,data.data);
        if(sport==='NFL'&&data?.teamArtProfiles){
          Object.keys(data.teamArtProfiles).forEach(id=>{
            if(!TEAM_ART_WORKING[id])return;
            if('logoOutlineEnabled' in data.teamArtProfiles[id])TEAM_ART_WORKING[id].logoOutlineEnabled=data.teamArtProfiles[id].logoOutlineEnabled===true;
            if(data.teamArtProfiles[id].logoOutline)TEAM_ART_WORKING[id].logoOutline=normalizeColorId(data.teamArtProfiles[id].logoOutline);
          });
        }
        if(data?.matchup)matchup[sport]=Object.assign(matchup[sport],data.matchup);
        if(sport==='NFL'&&data?.logoMode)logoMode.NFL=data.logoMode;
        if(data?.materialFilter&&['all','PETG','PLA_FAMILY'].includes(data.materialFilter))materialFilter=data.materialFilter;
      }catch(err){console.warn('House Divided Color Lab draft restore failed for',sport,err);}
    });
  }

  async function importFile(file){
    const text=await file.text();let frame=null,pal=null,profiles=null;
    if(file.name.toLowerCase().endsWith('.json')){
      const data=JSON.parse(text);frame=data.frame||null;pal=data.palette||null;profiles=data.profiles||data.teams||null;
    }else{
      const temp={};new Function('window',text+';return window;')(temp);
      frame=temp[windowName(activeSport,'frame')]||null;pal=temp[windowName(activeSport,'palette')]||null;profiles=temp[windowName(activeSport,'profiles')]||null;
    }
    if(!frame||!Array.isArray(pal)||!profiles)throw new Error(`File does not contain the expected ${activeSport} House Divided baseline.`);
    working[activeSport]=normalizeSource(activeSport,{frame,palette:pal,profiles});dirty[activeSport]=false;
    populatePaletteControls();renderPaletteKey();syncEditors();renderPreview();
    $('#lab-status-subtitle').textContent=`Loaded ${file.name}.`;
  }

  $('#lab-frame-outer').addEventListener('change',e=>{working[activeSport].frame.outer=e.target.value;markDirty();setFrameUI('outer',e.target.value);renderPreview();});
  $('#lab-frame-inner').addEventListener('change',e=>{working[activeSport].frame.inner=e.target.value;markDirty();setFrameUI('inner',e.target.value);renderPreview();});
  bindSide('one');bindSide('two');
  $('#lab-swap-teams').addEventListener('click',()=>{const m=matchup[activeSport],tmp=m.one;m.one=m.two;m.two=tmp;syncEditors();renderPreview();});
  $('#lab-next-unapproved').addEventListener('click',()=>{
    const list=teams(),current=matchup[activeSport].one,start=Math.max(0,list.findIndex(t=>t.id===current));let found=null;
    for(let offset=1;offset<=list.length;offset++){const t=list[(start+offset)%list.length];if(profile(t.id)?.approved!==true){found=t;break;}}
    if(found){matchup[activeSport].one=found.id;syncEditors();renderPreview();$('#lab-status-subtitle').textContent=`Loaded next unapproved team: ${fullName(found)}.`;}
    else $('#lab-status-subtitle').textContent=`All ${teams().length} ${activeSport} teams are approved.`;
  });
  $('#lab-save-draft').addEventListener('click',saveDraft);
  $('#lab-reset-sport').addEventListener('click',()=>{
    working[activeSport]=clone(baseline[activeSport]);dirty[activeSport]=false;localStorage.removeItem(storageKey(activeSport));
    if(activeSport==='NFL'){
      Object.keys(TEAM_ART_BASELINE).forEach(id=>{
        if(!TEAM_ART_WORKING[id])return;
        TEAM_ART_WORKING[id].logoOutlineEnabled=TEAM_ART_BASELINE[id].logoOutlineEnabled===true;
        TEAM_ART_WORKING[id].logoOutline=TEAM_ART_BASELINE[id].logoOutline||'petg-white';
      });
    }
    populatePaletteControls();renderPaletteKey();syncEditors();renderPreview();$('#lab-status-subtitle').textContent=`${activeSport} restored to the supplied House Divided seed baseline.`;
  });
  $('#lab-download-js').addEventListener('click',()=>{
    downloadText(`${activeSport.toLowerCase()}-house-divided-color-baseline.js`,buildExport());
    if(activeSport==='NFL')setTimeout(()=>downloadText('nfl-team-art-color-baseline.js',buildTeamArtExport()),180);
    $('#lab-status-subtitle').textContent=activeSport==='NFL'?'NFL House Divided + approved Team Art outline exports downloaded.':`${activeSport} House Divided JS export downloaded.`;
  });
  $$('#lab-material-filter [data-material-filter]').forEach(btn=>btn.addEventListener('click',()=>setMaterialFilter(btn.dataset.materialFilter)));
  $('#lab-import-file').addEventListener('change',async e=>{const file=e.target.files&&e.target.files[0];if(!file)return;try{await importFile(file);}catch(err){console.error(err);alert(err.message);$('#lab-status-subtitle').textContent=`Import failed: ${err.message}`;}finally{e.target.value='';}});

  restoreDrafts();
  renderSportButtons();renderLogoModes();renderMaterialFilter();populatePaletteControls();renderPaletteKey();syncEditors();renderPreview();
})();
