(function(){
  'use strict';

  const nflTeams = [
    {id:'ARI',city:'Arizona',name:'Cardinals'},{id:'ATL',city:'Atlanta',name:'Falcons'},{id:'BAL',city:'Baltimore',name:'Ravens'},{id:'BUF',city:'Buffalo',name:'Bills'},
    {id:'CAR',city:'Carolina',name:'Panthers'},{id:'CHI',city:'Chicago',name:'Bears'},{id:'CIN',city:'Cincinnati',name:'Bengals'},{id:'CLE',city:'Cleveland',name:'Browns'},
    {id:'DAL',city:'Dallas',name:'Cowboys'},{id:'DEN',city:'Denver',name:'Broncos'},{id:'DET',city:'Detroit',name:'Lions'},{id:'GB',city:'Green Bay',name:'Packers'},
    {id:'HOU',city:'Houston',name:'Texans'},{id:'IND',city:'Indianapolis',name:'Colts'},{id:'JAX',city:'Jacksonville',name:'Jaguars'},{id:'KC',city:'Kansas City',name:'Chiefs'},
    {id:'LV',city:'Las Vegas',name:'Raiders'},{id:'LAC',city:'Los Angeles',name:'Chargers'},{id:'LAR',city:'Los Angeles',name:'Rams'},{id:'MIA',city:'Miami',name:'Dolphins'},
    {id:'MIN',city:'Minnesota',name:'Vikings'},{id:'NE',city:'New England',name:'Patriots'},{id:'NO',city:'New Orleans',name:'Saints'},{id:'NYG',city:'New York',name:'Giants'},
    {id:'NYJ',city:'New York',name:'Jets'},{id:'PHI',city:'Philadelphia',name:'Eagles'},{id:'PIT',city:'Pittsburgh',name:'Steelers'},{id:'SF',city:'San Francisco',name:'49ers'},
    {id:'SEA',city:'Seattle',name:'Seahawks'},{id:'TB',city:'Tampa Bay',name:'Buccaneers'},{id:'TEN',city:'Tennessee',name:'Titans'},{id:'WAS',city:'Washington',name:'Commanders'}
  ];

  const $ = (sel,root=document)=>root.querySelector(sel);
  const $$ = (sel,root=document)=>Array.from(root.querySelectorAll(sel));
  const palette = window.WestTechNFLSingleTeamPrintPalette || window.WestTechNFLPrintPalette || [];
  const profiles = window.WestTechNFLSingleTeamProfiles || {};
  const paletteById = Object.fromEntries(palette.map(c=>[c.id,c]));
  const defaultTeam = nflTeams.find(t=>t.id==='DEN');
  let selected = {...defaultTeam,kind:'standard'};
  let activeSport='NFL';
  let customObjectUrl='';

  function color(id,fallback){return paletteById[id]?.hex || fallback;}
  function profile(team){return team?.kind==='custom' ? null : profiles[team.id] || null;}
  function fieldColor(team){if(team?.kind==='custom')return '#1677c4';return color(profile(team)?.field,'#1677c4');}
  function ringColor(team){if(team?.kind==='custom')return color('white','#f5f5f2');return color(profile(team)?.nameRing,'#f5f5f2');}
  function ringTextColor(team){if(team?.kind==='custom')return '#111317';return color(profile(team)?.ringText,'#111317');}
  function accentColor(team){if(team?.kind==='custom')return '#111317';return color(profile(team)?.accentRing,'#111317');}
  function outlineColor(team){if(team?.kind==='custom')return '#111317';return color(profile(team)?.outline,'#111317');}
  function fullName(team){return team.kind==='custom' ? `${team.topText} ${team.bottomText}`.trim() : `${team.city} ${team.name}`;}
  function topText(team){return (team.kind==='custom'?team.topText:team.city).toUpperCase();}
  function bottomText(team){return (team.kind==='custom'?team.bottomText:team.name).toUpperCase();}
  function logoUrl(team){return team.kind==='custom' ? team.artworkUrl || '' : `../images/coasters/teams/nfl/custom/${team.id}.svg`;}
  function mark(team){if(team.kind!=='custom')return team.id;return ((team.topText||'C')[0]+(team.bottomText||'T')[0]).toUpperCase();}

  function renderRingLetters(group,text,position){
    const value=(text||'').toUpperCase();
    const chars=[...value];
    const slots=Math.max(chars.length,1);
    const nonSpace=value.replace(/\s+/g,'').length;
    // Optical centering: the top glyphs sit slightly outward in Copperplate,
    // so pull the top half-ring inward a touch while leaving the bottom at the proven radius.
    const radius=position==='top' ? 395 : 403;
    const startAngle=position==='top' ? -145 : 145;
    const endAngle=position==='top' ? -35 : 35;
    let fontSize=70;
    if(slots>=13)fontSize=45;
    else if(slots>=11)fontSize=50;
    else if(slots>=9)fontSize=56;
    else if(slots>=8)fontSize=61;
    else if(nonSpace<=5)fontSize=73;
    group.innerHTML='';
    group.setAttribute('aria-label',value);
    chars.forEach((ch,index)=>{
      if(ch===' ')return;
      const ratio=slots===1 ? .5 : index/(slots-1);
      const angle=startAngle+(endAngle-startAngle)*ratio;
      const rad=angle*Math.PI/180;
      const x=500+radius*Math.cos(rad);
      const y=500+radius*Math.sin(rad);
      const rotation=position==='top' ? angle+90 : angle-90;
      const letter=document.createElementNS('http://www.w3.org/2000/svg','text');
      letter.setAttribute('x',x.toFixed(2));
      letter.setAttribute('y',y.toFixed(2));
      letter.setAttribute('transform',`rotate(${rotation.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)})`);
      letter.setAttribute('text-anchor','middle');
      letter.setAttribute('dominant-baseline','middle');
      letter.setAttribute('font-size',String(fontSize));
      letter.textContent=ch;
      group.appendChild(letter);
    });
  }

  function setSvgLogo(team){
    const img=$('#st-team-logo');
    const fallback=$('#st-logo-fallback');
    const src=logoUrl(team);
    fallback.textContent=mark(team);
    if(!src){img.removeAttribute('href');img.style.display='none';fallback.style.display='block';return;}
    img.style.display='block';fallback.style.display='none';img.setAttribute('href',src);
    // SVG image load errors are inconsistently surfaced cross-browser; the visible team card provides an additional fallback.
  }
  function setHtmlLogo(img,fallback,team){
    const src=logoUrl(team);fallback.textContent=mark(team);
    if(!src){img.hidden=true;fallback.hidden=false;return;}
    img.hidden=false;fallback.hidden=true;img.src=src;
    img.onload=()=>{img.hidden=false;fallback.hidden=true;};
    img.onerror=()=>{img.hidden=true;fallback.hidden=false;};
  }

  function updatePreview(){
    const center=fieldColor(selected),accent=accentColor(selected),ring=ringColor(selected),ringText=ringTextColor(selected),outline=outlineColor(selected);
    const coaster=$('#st-coaster');
    coaster.style.setProperty('--st-center',center);
    coaster.style.setProperty('--st-accent',accent);
    coaster.style.setProperty('--st-ring',ring);
    coaster.style.setProperty('--st-ring-text',ringText);
    coaster.style.setProperty('--st-outline',outline);
    const top=topText(selected),bottom=bottomText(selected);
    const topNode=$('#st-top-text'),bottomNode=$('#st-bottom-text');
    renderRingLetters(topNode,top,'top');
    renderRingLetters(bottomNode,bottom,'bottom');
    setSvgLogo(selected);
    $('#st-preview-title').textContent=`${fullName(selected)} single-team coaster preview`;
    $('#st-preview-desc').textContent=`Circular single-team coaster with ${top} on the top name ring, ${bottom} on the bottom name ring, and the selected WestTech artwork in the center.`;
    $('#st-selected-name').textContent=fullName(selected);
    $('#st-selected-kind').textContent=selected.kind==='custom'?'Custom team · design review':'Standard NFL team';
    $('#st-summary-name').textContent=fullName(selected);
    $('#st-summary-detail').textContent=selected.kind==='custom'?'Custom team · artwork + print-color review required':'Standard NFL team · WestTech artwork + managed print colors';
    $('#st-preview-sport').textContent=activeSport;
    const art=$('#st-selected-art');art.style.setProperty('--team-field',center);art.style.setProperty('--team-accent',accent);
    setHtmlLogo($('#st-selected-logo'),$('#st-selected-fallback'),selected);
  }

  function renderTeams(filter=''){
    const grid=$('#st-team-grid');grid.innerHTML='';
    const custom=document.createElement('button');custom.type='button';custom.className='st-team-option st-team-option-custom';
    custom.innerHTML='<span class="st-team-option-art">+</span><span class="st-team-option-copy"><strong>Custom Team</strong><small>School, club, organization or other artwork</small></span>';
    custom.addEventListener('click',showCustom);grid.appendChild(custom);
    const q=filter.trim().toLowerCase();
    const matches=nflTeams.filter(t=>`${t.city} ${t.name} ${t.id}`.toLowerCase().includes(q));
    matches.forEach(team=>{
      const button=document.createElement('button');button.type='button';button.className='st-team-option';
      button.style.setProperty('--team-field',fieldColor({...team,kind:'standard'}));button.style.setProperty('--team-accent',accentColor({...team,kind:'standard'}));
      button.innerHTML=`<span class="st-team-option-art"><img src="../images/coasters/teams/nfl/custom/${team.id}.svg" alt=""/><b hidden>${team.id}</b></span><span class="st-team-option-copy"><strong>${team.city} ${team.name}</strong><small>Standard NFL team</small></span>`;
      const img=button.querySelector('img'),fb=button.querySelector('b');img.onload=()=>{img.hidden=false;fb.hidden=true};img.onerror=()=>{img.hidden=true;fb.hidden=false};
      button.addEventListener('click',()=>{selected={...team,kind:'standard'};closePicker();updatePreview();showMessage(`${fullName(selected)} selected.`,false);});
      grid.appendChild(button);
    });
    if(!matches.length){const empty=document.createElement('div');empty.className='st-team-empty';empty.textContent='No standard NFL team matches that search. Use Custom Team above for a school, club, organization, or other design.';grid.appendChild(empty);}
  }

  function openPicker(){
    if(activeSport!=='NFL'){showMessage(`${activeSport} is planned but its team catalog is not enabled in this first build.`,true);return;}
    $('#st-picker-overlay').hidden=false;document.body.style.overflow='hidden';showStandard();$('#st-team-search').value='';renderTeams();setTimeout(()=>$('#st-team-search').focus(),20);
  }
  function closePicker(){$('#st-picker-overlay').hidden=true;document.body.style.overflow='';showStandard();}
  function showStandard(){$('#st-standard-picker').hidden=false;$('#st-custom-panel').hidden=true;}
  function showCustom(){$('#st-standard-picker').hidden=true;$('#st-custom-panel').hidden=false;$('#st-custom-top').value='';$('#st-custom-bottom').value='';$('#st-custom-artwork').value='';$('#st-custom-notes').value='';setTimeout(()=>$('#st-custom-top').focus(),20);}
  function showMessage(msg,info){const el=$('#st-message');el.hidden=false;el.textContent=msg;el.dataset.kind=info?'info':'success';}

  $('#st-open-picker').addEventListener('click',openPicker);
  $('#st-picker-close').addEventListener('click',closePicker);
  $('#st-picker-overlay').addEventListener('click',e=>{if(e.target===$('#st-picker-overlay'))closePicker();});
  $('#st-team-search').addEventListener('input',e=>renderTeams(e.target.value));
  $('#st-back-teams').addEventListener('click',()=>{showStandard();renderTeams();setTimeout(()=>$('#st-team-search').focus(),20);});
  $('#st-apply-custom').addEventListener('click',()=>{
    const top=$('#st-custom-top').value.trim(),bottom=$('#st-custom-bottom').value.trim(),file=$('#st-custom-artwork').files[0];
    if(!top||!bottom){showMessage('Add both top and bottom ring text for the custom coaster.',true);return;}
    if(customObjectUrl){URL.revokeObjectURL(customObjectUrl);customObjectUrl='';}
    if(file)customObjectUrl=URL.createObjectURL(file);
    selected={kind:'custom',topText:top,bottomText:bottom,artworkUrl:customObjectUrl,notes:$('#st-custom-notes').value.trim()};
    closePicker();updatePreview();showMessage('Custom team applied for preview. WestTech artwork and print colors still require design review.',false);
  });
  $('#st-reset').addEventListener('click',()=>{if(customObjectUrl){URL.revokeObjectURL(customObjectUrl);customObjectUrl='';}selected={...defaultTeam,kind:'standard'};activeSport='NFL';$$('.st-sport-option').forEach(b=>{const on=b.dataset.sport==='NFL';b.classList.toggle('is-selected',on);b.setAttribute('aria-checked',on?'true':'false');});updatePreview();showMessage('Denver Broncos example restored.',false);});
  $('#st-continue').addEventListener('click',()=>showMessage('Online ordering for Your Team coasters is not available yet. You can still use the builder to preview your team.',true));
  $$('.st-sport-option').forEach(button=>button.addEventListener('click',()=>{
    if(button.dataset.sport!=='NFL'){showMessage(`${button.dataset.sport} is already accounted for in the selector structure, but the catalog is not enabled yet.`,true);return;}
    activeSport='NFL';$$('.st-sport-option').forEach(b=>{const on=b===button;b.classList.toggle('is-selected',on);b.setAttribute('aria-checked',on?'true':'false');});updatePreview();
  }));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#st-picker-overlay').hidden)closePicker();});

  updatePreview();
})();
