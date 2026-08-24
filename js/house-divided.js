(function(){
  'use strict';

  // Storefront uses the approved WestTech custom icon set only.
  const STANDARD_LOGO_SET = 'custom';

  const nflTeams = [
    {id:'ARI',city:'Arizona',name:'Cardinals',primary:'#97233f',secondary:'#ffb612'},
    {id:'ATL',city:'Atlanta',name:'Falcons',primary:'#a71930',secondary:'#000000'},
    {id:'BAL',city:'Baltimore',name:'Ravens',primary:'#241773',secondary:'#9e7c0c'},
    {id:'BUF',city:'Buffalo',name:'Bills',primary:'#00338d',secondary:'#c60c30'},
    {id:'CAR',city:'Carolina',name:'Panthers',primary:'#0085ca',secondary:'#101820'},
    {id:'CHI',city:'Chicago',name:'Bears',primary:'#0b162a',secondary:'#c83803'},
    {id:'CIN',city:'Cincinnati',name:'Bengals',primary:'#fb4f14',secondary:'#000000'},
    {id:'CLE',city:'Cleveland',name:'Browns',primary:'#311d00',secondary:'#ff3c00'},
    {id:'DAL',city:'Dallas',name:'Cowboys',primary:'#003594',secondary:'#869397'},
    {id:'DEN',city:'Denver',name:'Broncos',primary:'#0a2342',secondary:'#fc4c02'},
    {id:'DET',city:'Detroit',name:'Lions',primary:'#0076b6',secondary:'#b0b7bc'},
    {id:'GB',city:'Green Bay',name:'Packers',primary:'#203731',secondary:'#ffb612'},
    {id:'HOU',city:'Houston',name:'Texans',primary:'#03202f',secondary:'#a71930'},
    {id:'IND',city:'Indianapolis',name:'Colts',primary:'#002c5f',secondary:'#ffffff'},
    {id:'JAX',city:'Jacksonville',name:'Jaguars',primary:'#006778',secondary:'#d7a22a'},
    {id:'KC',city:'Kansas City',name:'Chiefs',primary:'#e31837',secondary:'#ffb81c'},
    {id:'LV',city:'Las Vegas',name:'Raiders',primary:'#000000',secondary:'#a5acaf'},
    {id:'LAC',city:'Los Angeles',name:'Chargers',primary:'#0080c6',secondary:'#ffc20e'},
    {id:'LAR',city:'Los Angeles',name:'Rams',primary:'#003594',secondary:'#ffd100'},
    {id:'MIA',city:'Miami',name:'Dolphins',primary:'#008e97',secondary:'#fc4c02'},
    {id:'MIN',city:'Minnesota',name:'Vikings',primary:'#4f2683',secondary:'#ffc62f'},
    {id:'NE',city:'New England',name:'Patriots',primary:'#002244',secondary:'#c60c30'},
    {id:'NO',city:'New Orleans',name:'Saints',primary:'#101820',secondary:'#d3bc8d'},
    {id:'NYG',city:'New York',name:'Giants',primary:'#0b2265',secondary:'#a71930'},
    {id:'NYJ',city:'New York',name:'Jets',primary:'#125740',secondary:'#ffffff'},
    {id:'PHI',city:'Philadelphia',name:'Eagles',primary:'#004c54',secondary:'#a5acaf'},
    {id:'PIT',city:'Pittsburgh',name:'Steelers',primary:'#101820',secondary:'#ffb612'},
    {id:'SF',city:'San Francisco',name:'49ers',primary:'#aa0000',secondary:'#b3995d'},
    {id:'SEA',city:'Seattle',name:'Seahawks',primary:'#002244',secondary:'#69be28'},
    {id:'TB',city:'Tampa Bay',name:'Buccaneers',primary:'#d50a0a',secondary:'#ff7900'},
    {id:'TEN',city:'Tennessee',name:'Titans',primary:'#0c2340',secondary:'#4b92db'},
    {id:'WAS',city:'Washington',name:'Commanders',primary:'#5a1414',secondary:'#ffb612'}
  ];

  const $ = (sel, root=document) => root.querySelector(sel);
  const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

  const picker = $('#team-picker');
  const teamGrid = $('#team-grid');
  const search = $('#team-search');
  const customPanel = $('#custom-team-panel');
  const standardPicker = $('#team-standard-picker');
  const sportNote = $('#sport-note');
  const buildMessage = $('#build-message');
  let activeSide = null;
  let activeSport = 'NFL';

  const defaultOne = nflTeams.find(t => t.id === 'DEN');
  const defaultTwo = nflTeams.find(t => t.id === 'DAL');
  // Team colors are WestTech-managed production defaults. Customers choose teams, not colors.
  const state = { one: {...defaultOne, kind:'standard'}, two: {...defaultTwo, kind:'standard'} };

  function fullName(team){
    if (!team) return 'Choose a team';
    if (team.kind === 'custom') return team.customName || 'Custom Team';
    return `${team.city} ${team.name}`;
  }
  function shortName(team){
    if (!team) return 'TEAM';
    if (team.kind === 'custom') {
      const words=(team.customName||'Custom Team').trim().split(/\s+/);
      return (words[words.length-1]||'TEAM').toUpperCase();
    }
    return team.name.toUpperCase();
  }
  function mark(team){
    if (!team) return '?';
    if (team.kind === 'custom') {
      const words=(team.customName||'Custom Team').trim().split(/\s+/).filter(Boolean);
      return words.slice(0,2).map(w=>w[0]).join('').toUpperCase() || 'CT';
    }
    return team.id;
  }
  function teamPrimary(team){return team && team.primary ? team.primary : '#1677c4';}

  const printPalette = window.WestTechNFLPrintPalette || [];
  const printProfiles = window.WestTechNFLHouseDividedProfiles || {};
  const paletteById = Object.fromEntries(printPalette.map(color=>[color.id,color]));
  function profile(team){
    if(!team) return null;
    if(team.kind === 'custom') return team.printProfile || {field:'royal-blue',band:'white',text:'black',house:'royal-blue'};
    return printProfiles[team.id] || null;
  }
  function profileHex(team,role,fallback){
    const p=profile(team); const id=p && p[role];
    return (id && paletteById[id] && paletteById[id].hex) || fallback;
  }
  function fieldColor(team){return profileHex(team,'field',teamPrimary(team));}
  function bandColor(team){return profileHex(team,'band',secondary(team));}
  function bandTextColor(team){return profileHex(team,'text','#ffffff');}
  function houseColor(team){return profileHex(team,'house',teamPrimary(team));}
  function primary(team){return teamPrimary(team);}
  function secondary(team){return team && team.secondary ? team.secondary : '#ffffff';}
  function isCustom(team){return team && team.kind === 'custom';}
  function standardLogoUrl(team){
    if(!team || isCustom(team)) return '';
    return `../images/coasters/teams/nfl/${STANDARD_LOGO_SET}/${team.id}.svg`;
  }
  function logoUrl(team){
    if(!team) return '';
    if(isCustom(team)) return team.artworkUrl || '';
    return standardLogoUrl(team);
  }
  function setArtwork(img,fallback,team){
    const src=logoUrl(team);
    fallback.textContent=mark(team);
    fallback.hidden=!!src;
    if(src){
      img.hidden=false;
      img.alt=`${fullName(team)} artwork`;
      img.src=src;
      img.onerror=()=>{img.hidden=true;fallback.hidden=false;};
      img.onload=()=>{img.hidden=false;fallback.hidden=true;};
    }else{
      img.removeAttribute('src');
      img.alt='';
      img.hidden=true;
      fallback.hidden=false;
    }
  }
  function setSvgArtwork(imageEl,fallbackEl,team){
    const src=logoUrl(team);
    fallbackEl.textContent=mark(team);
    if(src){
      imageEl.setAttribute('href',src);
      imageEl.setAttributeNS('http://www.w3.org/1999/xlink','href',src);
      imageEl.style.display='block';
      fallbackEl.style.display='none';
    }else{
      imageEl.removeAttribute('href');
      imageEl.style.display='none';
      fallbackEl.style.display='block';
    }
  }

  function updateCard(side){
    const team=state[side];
    const card=$(`[data-side-card="${side}"]`);
    const id=side==='one'?'side-one':'side-two';
    const art=$(`#${id}-art`);
    const img=$(`#${id}-logo`);
    const fallback=$(`#${id}-mark`);
    setArtwork(img,fallback,team);
    $(`#${id}-name`).textContent=fullName(team);
    $(`#${id}-kind`).textContent=isCustom(team)?'Custom team · design review':'Standard NFL team';
    art.style.setProperty('--team-primary',fieldColor(team));
    art.style.setProperty('--team-secondary',bandTextColor(team));
    card.classList.toggle('is-custom',isCustom(team));
  }

  function updatePreview(){
    const one=state.one,two=state.two,disc=$('#preview-disc');
    const frame=window.WestTechNFLHouseDividedFrame || {outer:'white',inner:'black'};
    const frameOuter=paletteById[frame.outer]?.hex || '#f5f5f2';
    const frameInner=paletteById[frame.inner]?.hex || '#111317';
    disc.style.setProperty('--hd-frame-outer',frameOuter);
    disc.style.setProperty('--hd-frame-inner',frameInner);
    disc.style.setProperty('--hd-side-one-field',fieldColor(one));
    disc.style.setProperty('--hd-side-two-field',fieldColor(two));
    disc.style.setProperty('--hd-side-one-band',bandColor(one));
    disc.style.setProperty('--hd-side-two-band',bandColor(two));
    disc.style.setProperty('--hd-side-one-band-text',bandTextColor(one));
    disc.style.setProperty('--hd-side-two-band-text',bandTextColor(two));
    disc.style.setProperty('--hd-side-one-house',houseColor(one));
    disc.style.setProperty('--hd-side-two-house',houseColor(two));
    setSvgArtwork($('#preview-logo-one'),$('#preview-mark-one'),one);
    setSvgArtwork($('#preview-logo-two'),$('#preview-mark-two'),two);
    $('#hd-preview-title').textContent=`${fullName(one)} + ${fullName(two)} house divided coaster preview`;
    $('#hd-preview-desc').textContent=`Circular House Divided coaster with ${fullName(one)} on the top half, ${fullName(two)} on the bottom half, and a split center band labeled ${shortName(two)} and ${shortName(one)} with a two-color house icon.`;
    $('#preview-band-left').textContent=shortName(two);
    $('#preview-band-right').textContent=shortName(one);
    $('#preview-summary').textContent=`${fullName(one)} + ${fullName(two)}`;
    const customCount=[one,two].filter(isCustom).length;
    $('#preview-detail').textContent=customCount===0?'Standard NFL matchup · print-style split name band':customCount===1?'One custom team · design review required · print-style split name band':'Two custom teams · design review required · print-style split name band';
    $('#preview-sport').textContent=activeSport;
    updateCard('one'); updateCard('two');
  }


  function renderTeams(filter=''){
    const needle=filter.trim().toLowerCase();
    const teams=nflTeams.filter(team => `${team.city} ${team.name} ${team.id}`.toLowerCase().includes(needle));
    teamGrid.innerHTML='';

    const custom=document.createElement('button');
    custom.type='button'; custom.className='hd-team-option hd-team-option-custom';
    custom.innerHTML='<span class="hd-team-option-mark">+</span><span><strong>Custom Team</strong><small>School, club or organization</small></span>';
    custom.addEventListener('click',()=>openCustom(activeSide));
    teamGrid.appendChild(custom);

    teams.forEach(team=>{
      const button=document.createElement('button');
      button.type='button'; button.className='hd-team-option';
      button.style.setProperty('--team-primary',fieldColor(team));
      button.style.setProperty('--team-secondary',bandTextColor(team));
      button.innerHTML=`<span class="hd-team-option-art"><img src="${standardLogoUrl(team)}" alt=""/><b>${team.id}</b></span><span><strong>${team.city} ${team.name}</strong><small>Standard NFL team</small></span>`;
      const thumb=button.querySelector('img');
      const thumbFallback=button.querySelector('b');
      thumbFallback.hidden=true;
      thumb.addEventListener('error',()=>{thumb.hidden=true;thumbFallback.hidden=false;});
      thumb.addEventListener('load',()=>{thumb.hidden=false;thumbFallback.hidden=true;});
      button.addEventListener('click',()=>{
        const side=activeSide;
        state[side]={...team,kind:'standard'};
        closePicker();
        updatePreview();
        showBuildMessage(`${fullName(state[side])} selected for ${side==='one'?'Side 1':'Side 2'}.`,false);
      });
      teamGrid.appendChild(button);
    });
    if(!teams.length){
      const empty=document.createElement('div'); empty.className='hd-team-empty'; empty.textContent='No standard NFL teams match that search. Use Custom Team above if this is a school, club, or organization.'; teamGrid.appendChild(empty);
    }
  }

  function showStandardPicker(){
    standardPicker.hidden=false;
    customPanel.hidden=true;
  }
  function openPicker(side){
    if(activeSport!=='NFL'){
      showBuildMessage(`${activeSport} is shown as part of the final selector structure, but its House Divided team catalog is not enabled in this first prototype.`,true);
      return;
    }
    activeSide=side;
    $('#picker-side-label').textContent=side==='one'?'Side 1':'Side 2';
    $('#picker-title').textContent=`Choose ${side==='one'?'Side 1':'Side 2'} team`;
    picker.hidden=false;
    showStandardPicker();
    search.value='';
    renderTeams();
    setTimeout(()=>search.focus(),20);
  }
  function closePicker(){
    picker.hidden=true;
    showStandardPicker();
    activeSide=null;
    search.value='';
  }

  function openCustom(side){
    activeSide=side;
    picker.hidden=false;
    standardPicker.hidden=true;
    customPanel.hidden=false;
    $('#picker-side-label').textContent=side==='one'?'Side 1':'Side 2';
    $('#picker-title').textContent=`Custom ${side==='one'?'Side 1':'Side 2'} team`;
    $('#custom-team-name').value='';
    $('#custom-notes').value='';
    $('#custom-artwork').value='';
    $('#custom-heading').textContent=`Custom ${side==='one'?'Side 1':'Side 2'} team`;
    setTimeout(()=>$('#custom-team-name').focus(),20);
  }
  function closeCustom(){
    if(!picker.hidden && activeSide){
      $('#picker-title').textContent=`Choose ${activeSide==='one'?'Side 1':'Side 2'} team`;
      showStandardPicker();
      search.value='';
      renderTeams();
      setTimeout(()=>search.focus(),20);
    }else{
      customPanel.hidden=true;
      activeSide=null;
    }
  }

  function showBuildMessage(message,isInfo){
    buildMessage.hidden=false;
    buildMessage.textContent=message;
    buildMessage.dataset.kind=isInfo?'info':'success';
  }

  $$('[data-open-picker]').forEach(btn=>btn.addEventListener('click',()=>openPicker(btn.dataset.openPicker)));
  $('#picker-close').addEventListener('click',closePicker);
  search.addEventListener('input',()=>renderTeams(search.value));
  $('#swap-teams').addEventListener('click',()=>{
    const tmp=state.one; state.one=state.two; state.two=tmp; updatePreview(); showBuildMessage('Sides swapped.',false);
  });
  $('#apply-custom').addEventListener('click',()=>{
    const customName=$('#custom-team-name').value.trim();
    if(!customName){
      $('#custom-team-name').focus();
      showBuildMessage('Enter a team or organization name before using the custom team.',true);
      return;
    }
    const side=activeSide;
    const artworkFile=$('#custom-artwork').files[0]||null;
    // Custom-team colors are intentionally not customer-selectable. The blue/white values are preview placeholders until WestTech completes design review.
    state[side]={id:'CUSTOM',customName,primary:'#1677c4',secondary:'#f3f4f6',printProfile:{field:'royal-blue',band:'white',text:'black',house:'royal-blue'},kind:'custom',notes:$('#custom-notes').value.trim(),artwork:artworkFile?.name||'',artworkUrl:artworkFile?URL.createObjectURL(artworkFile):''};
    closePicker(); updatePreview(); showBuildMessage(`${customName} is now ${side==='one'?'Side 1':'Side 2'}. Custom artwork would require design review before checkout.`,false);
  });
  $('#cancel-custom').addEventListener('click',closeCustom);
  $('#reset-build').addEventListener('click',()=>{
    state.one={...defaultOne,kind:'standard'}; state.two={...defaultTwo,kind:'standard'}; activeSport='NFL';
    $$('.hd-sport-option').forEach(btn=>{const selected=btn.dataset.sport==='NFL';btn.classList.toggle('is-selected',selected);btn.setAttribute('aria-checked',selected?'true':'false');});
    sportNote.textContent='NFL is the active House Divided catalog for this first build. The selector is already structured so additional sports can drop into the same flow later.';
    closePicker(); updatePreview(); showBuildMessage('Example matchup reset to Denver Broncos + Dallas Cowboys.',false);
  });
  $('#continue-build').addEventListener('click',()=>{
    const custom=[state.one,state.two].some(isCustom);
    showBuildMessage(custom
      ? 'Online ordering is not available yet. Custom team artwork will require WestTech review when ordering opens.'
      : 'Online ordering for House Divided coasters is not available yet. You can still use the builder to preview your matchup.',true);
  });

  $$('.hd-sport-option').forEach(btn=>btn.addEventListener('click',()=>{
    const sport=btn.dataset.sport;
    activeSport=sport;
    $$('.hd-sport-option').forEach(other=>{const selected=other===btn;other.classList.toggle('is-selected',selected);other.setAttribute('aria-checked',selected?'true':'false');});
    if(sport==='NFL'){
      sportNote.textContent='NFL is the active House Divided catalog for this first build. Choose either side below.';
      showBuildMessage('NFL selected. Standard team selection is active.',false);
    }else{
      sportNote.textContent=`${sport} is already represented in the final selector structure. Its House Divided team catalog can be enabled here when that sport is ready for sale.`;
      showBuildMessage(`${sport} is visible for the future flow, but this prototype only enables the NFL House Divided catalog.`,true);
    }
    $('#preview-sport').textContent=sport;
    closePicker();
  }));

  updatePreview();
})();
