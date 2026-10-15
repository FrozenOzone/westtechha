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
  const nhlTeams=[
    {id:'ANA',city:"Anaheim",name:"Ducks",primary:'#fc4c02',secondary:'#b9975b'},
    {id:'BOS',city:"Boston",name:"Bruins",primary:'#ffb81c',secondary:'#010101'},
    {id:'BUF',city:"Buffalo",name:"Sabres",primary:'#041e42',secondary:'#ffb81c'},
    {id:'CGY',city:"Calgary",name:"Flames",primary:'#c8102e',secondary:'#f1be48'},
    {id:'CAR',city:"Carolina",name:"Hurricanes",primary:'#c8102e',secondary:'#ffffff'},
    {id:'CHI',city:"Chicago",name:"Blackhawks",primary:'#cf0a2c',secondary:'#ff671b'},
    {id:'COL',city:"Colorado",name:"Avalanche",primary:'#6f263d',secondary:'#236192'},
    {id:'CBJ',city:"Columbus",name:"Blue Jackets",primary:'#041e42',secondary:'#c8102e'},
    {id:'DAL',city:"Dallas",name:"Stars",primary:'#006847',secondary:'#8f8f8c'},
    {id:'DET',city:"Detroit",name:"Red Wings",primary:'#ce1126',secondary:'#ffffff'},
    {id:'EDM',city:"Edmonton",name:"Oilers",primary:'#041e42',secondary:'#ff4c00'},
    {id:'FLA',city:"Florida",name:"Panthers",primary:'#041e42',secondary:'#c8102e'},
    {id:'LAK',city:"Los Angeles",name:"Kings",primary:'#111111',secondary:'#a2aaad'},
    {id:'MIN',city:"Minnesota",name:"Wild",primary:'#154734',secondary:'#a6192e'},
    {id:'MTL',city:"Montreal",name:"Canadiens",primary:'#af1e2d',secondary:'#192168'},
    {id:'NSH',city:"Nashville",name:"Predators",primary:'#ffb81c',secondary:'#041e42'},
    {id:'NJD',city:"New Jersey",name:"Devils",primary:'#ce1126',secondary:'#000000'},
    {id:'NYI',city:"New York",name:"Islanders",primary:'#00539b',secondary:'#f47d30'},
    {id:'NYR',city:"New York",name:"Rangers",primary:'#0038a8',secondary:'#ce1126'},
    {id:'OTT',city:"Ottawa",name:"Senators",primary:'#c52032',secondary:'#c2912c'},
    {id:'PHI',city:"Philadelphia",name:"Flyers",primary:'#f74902',secondary:'#000000'},
    {id:'PIT',city:"Pittsburgh",name:"Penguins",primary:'#fcb514',secondary:'#000000'},
    {id:'SJS',city:"San Jose",name:"Sharks",primary:'#006d75',secondary:'#ea7200'},
    {id:'SEA',city:"Seattle",name:"Kraken",primary:'#001628',secondary:'#99d9d9',logoUrl:'https://assets.nhle.com/logos/nhl/svg/SEA_light.svg'},
    {id:'STL',city:"St. Louis",name:"Blues",primary:'#002f87',secondary:'#fcb514'},
    {id:'TBL',city:"Tampa Bay",name:"Lightning",primary:'#002868',secondary:'#ffffff'},
    {id:'TOR',city:"Toronto",name:"Maple Leafs",primary:'#003e7e',secondary:'#ffffff'},
    {id:'UTA',city:"Utah",name:"Mammoth",primary:'#6cace4',secondary:'#010101',logoUrl:'https://assets.nhle.com/logos/nhl/svg/UTA_light.svg'},
    {id:'VAN',city:"Vancouver",name:"Canucks",primary:'#00205b',secondary:'#00843d'},
    {id:'VGK',city:"Vegas",name:"Golden Knights",primary:'#b4975a',secondary:'#333f42'},
    {id:'WSH',city:"Washington",name:"Capitals",primary:'#041e42',secondary:'#c8102e'},
    {id:'WPG',city:"Winnipeg",name:"Jets",primary:'#041e42',secondary:'#7b303e'}
  ];
  const sportTeams={NFL:nflTeams,NHL:nhlTeams};

  const $ = (sel,root=document)=>root.querySelector(sel);
  const $$ = (sel,root=document)=>Array.from(root.querySelectorAll(sel));
  const sportPalettes = {
    NFL: window.WestTechNFLTeamArtPrintPalette || window.WestTechNFLSingleTeamPrintPalette || window.WestTechNFLPrintPalette || [],
    NHL: window.WestTechNHLSingleTeamPrintPalette || []
  };
  const sportProfiles = {
    NFL: window.WestTechNFLTeamArtProfiles || window.WestTechNFLSingleTeamProfiles || {},
    NHL: window.WestTechNHLSingleTeamProfiles || {}
  };
  const singleBlackoutStandard = window.WestTechNFLTeamArtSingleBlackoutStandard || {field:'petg-black'};
  const singleBlackoutProfiles = window.WestTechNFLTeamArtSingleBlackoutProfiles || {};
  const paletteMaps = Object.fromEntries(Object.entries(sportPalettes).map(([sport,palette])=>[sport,Object.fromEntries(palette.map(c=>[c.id,c]))]));
  const LOGO_SETS={custom:'custom'};
  const TEAM_ART_OUTLINES=window.WestTechNFLTeamArtOutlineData||{};
  let activeSport='NFL';
  let activeLogoStyle='custom';
  let activeArtworkStyle='standard';
  let activeSetSize='4';
  let selected={...nflTeams.find(t=>t.id==='DEN'),kind:'standard'};

  function currentTeams(){return sportTeams[activeSport]||[];}
  function defaultTeamForSport(sport){return sport==='NHL'?nhlTeams.find(t=>t.id==='COL'):nflTeams.find(t=>t.id==='DEN');}
  function color(id,fallback,sport=activeSport){return paletteMaps[sport]?.[id]?.hex || fallback;}
  function profile(team){
    if(team?.kind==='custom')return null;
    if(activeSport==='NFL'&&activeArtworkStyle==='blackout')return singleBlackoutProfiles[team.id] || sportProfiles.NFL?.[team.id] || null;
    return sportProfiles[activeSport]?.[team.id] || null;
  }
  function fieldColor(team){
    if(team?.kind==='custom')return '#1677c4';
    const p=profile(team);
    if(activeSport==='NFL'&&activeArtworkStyle==='blackout')return color(p?.field || singleBlackoutStandard.field,'#111317');
    return color(p?.field,activeSport==='NHL'?(team?.primary||'#1677c4'):'#1677c4');
  }
  function ringColor(team){if(team?.kind==='custom')return color('white','#f5f5f2','NFL');const p=profile(team);return color(p?.nameRing,'#f5f5f2');}
  function ringTextColor(team){if(team?.kind==='custom')return '#111317';const p=profile(team);return color(p?.ringText,'#111317');}
  function accentColor(team){if(team?.kind==='custom')return '#111317';const p=profile(team);return color(p?.accentRing,activeSport==='NHL'?(team?.secondary||'#111317'):'#111317');}
  function outlineColor(team){if(team?.kind==='custom')return '#111317';const p=profile(team);return color(p?.outline,'#111317');}
  function logoScale(team){
    if(team?.kind==='custom')return 100;
    // Shared Single Team geometry: Single Standard is the source of truth
    // for logo size in both Single Standard and Single Blackout.
    const p=activeSport==='NFL' ? sportProfiles.NFL?.[team.id] : sportProfiles[activeSport]?.[team.id];
    const n=Number(p?.logoScaleCustom);
    return Number.isFinite(n)?Math.min(120,Math.max(30,n)):100;
  }
  function logoOutlineColor(team){const p=profile(team);return color(p?.logoOutline,'#111317');}
  function renderTeamArtOutline(team,pos,size){
    const out=$('#st-team-logo-outline'),paths=$('#st-team-logo-outline-paths');if(!out||!paths)return;
    out.setAttribute('x',pos.toFixed(2));out.setAttribute('y',pos.toFixed(2));out.setAttribute('width',size.toFixed(2));out.setAttribute('height',size.toFixed(2));
    const data=team&&team.kind!=='custom'?TEAM_ART_OUTLINES[team.id]:null;
    const enabled=!!(data&&profile(team)?.logoOutlineEnabled);out.style.display=enabled?'block':'none';paths.replaceChildren();if(!enabled)return;
    out.setAttribute('viewBox',data.viewBox||'0 0 1000 1000');
    data.paths.forEach(part=>{const node=document.createElementNS('http://www.w3.org/2000/svg','path');node.setAttribute('d',part.d);node.setAttribute('fill',logoOutlineColor(team));if(part.fillRule)node.setAttribute('fill-rule',part.fillRule);if(part.clipRule)node.setAttribute('clip-rule',part.clipRule);paths.appendChild(node);});
  }
  function fullName(team){return team.kind==='custom' ? `${team.topText} ${team.bottomText}`.trim() : `${team.city} ${team.name}`;}
  function topText(team){return (team.kind==='custom'?team.topText:team.city).toUpperCase();}
  function bottomText(team){return (team.kind==='custom'?team.bottomText:team.name).toUpperCase();}
  function logoStyleLabel(){return activeArtworkStyle==='blackout'?'WestTech Team Art · Blackout':'WestTech Team Art · Standard';}
  function standardLogoUrl(team){if(activeSport!=='NFL')return'';return `../images/coasters/teams/nfl/custom/${team.id}.svg`;}
  function logoUrl(team){return team.kind==='custom' ? team.artworkUrl || '' : standardLogoUrl(team);}
  function setLabel(){return activeSetSize==='8'?'8-Coaster Set':'4-Coaster Set';}
  function setPrice(){return activeSetSize==='8'?'$39.99':'$29.99';}
  function mark(team){if(team.kind!=='custom')return team.id;return ((team.topText||'C')[0]+(team.bottomText||'T')[0]).toUpperCase();}

  function renderRingLetters(group,text,position){
    const value=(text||'').toUpperCase(); const chars=[...value]; const slots=Math.max(chars.length,1); const nonSpace=value.replace(/\s+/g,'').length;
    const radius=position==='top'?395:403; const startAngle=position==='top'?-145:145; const endAngle=position==='top'?-35:35;
    let fontSize=70; if(slots>=13)fontSize=45; else if(slots>=11)fontSize=50; else if(slots>=9)fontSize=56; else if(slots>=8)fontSize=61; else if(nonSpace<=5)fontSize=73;
    group.innerHTML=''; group.setAttribute('aria-label',value);
    chars.forEach((ch,index)=>{if(ch===' ')return;const ratio=slots===1?.5:index/(slots-1);const angle=startAngle+(endAngle-startAngle)*ratio;const rad=angle*Math.PI/180;const x=500+radius*Math.cos(rad);const y=500+radius*Math.sin(rad);const rotation=position==='top'?angle+90:angle-90;const letter=document.createElementNS('http://www.w3.org/2000/svg','text');letter.setAttribute('x',x.toFixed(2));letter.setAttribute('y',y.toFixed(2));letter.setAttribute('transform',`rotate(${rotation.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)})`);letter.setAttribute('text-anchor','middle');letter.setAttribute('dominant-baseline','middle');letter.setAttribute('font-size',String(fontSize));letter.textContent=ch;group.appendChild(letter);});
  }
  function setSvgLogo(team){const img=$('#st-team-logo'),fallback=$('#st-logo-fallback'),src=logoUrl(team);fallback.textContent=mark(team);const baseSize=630,scale=logoScale(team),size=baseSize*(scale/100),pos=(1000-size)/2;img.setAttribute('x',pos.toFixed(2));img.setAttribute('y',pos.toFixed(2));img.setAttribute('width',size.toFixed(2));img.setAttribute('height',size.toFixed(2));renderTeamArtOutline(team,pos,size);if(!src){img.removeAttribute('href');img.style.display='none';fallback.style.display='block';return;}img.style.display='block';fallback.style.display='none';img.setAttribute('href',src);}
  function setHtmlLogo(img,fallback,team){const src=logoUrl(team);fallback.textContent=mark(team);if(!src){img.hidden=true;fallback.hidden=false;return;}img.hidden=false;fallback.hidden=true;img.src=src;img.onload=()=>{img.hidden=false;fallback.hidden=true;};img.onerror=()=>{img.hidden=true;fallback.hidden=false;};}

  function updateArtworkStyleUI(){
    const row=$('#st-logo-style-row'),heading=$('#st-logo-style-heading'),note=$('#st-logo-style-note'),teamStep=$('#st-team-step-number'),setStep=$('#st-set-step-number'),intro=$('#st-builder-intro');
    activeLogoStyle='custom';
    if(row){row.hidden=false;row.style.display='';row.removeAttribute('aria-hidden');}
    if(teamStep)teamStep.textContent='03';
    if(setStep)setStep.textContent='04';
    if(intro)intro.textContent='Choose a football team, choose Standard or Blackout artwork, then choose a 4- or 8-coaster set.';
    if(heading)heading.textContent='Artwork Style';
    if(note)note.textContent=activeArtworkStyle==='blackout'?'Blackout uses the black-field treatment for the selected team.':'Standard uses the team-color treatment for the selected team.';
    $$('[data-artwork-style]').forEach(btn=>{const on=btn.dataset.artworkStyle===activeArtworkStyle;btn.classList.toggle('is-selected',on);btn.setAttribute('aria-checked',on?'true':'false');});
  }
  function updatePreview(){
    const center=fieldColor(selected),accent=accentColor(selected),ring=ringColor(selected),ringText=ringTextColor(selected),outline=outlineColor(selected),coaster=$('#st-coaster');
    coaster.style.setProperty('--st-center',center);coaster.style.setProperty('--st-accent',accent);coaster.style.setProperty('--st-ring',ring);coaster.style.setProperty('--st-ring-text',ringText);coaster.style.setProperty('--st-outline',outline);
    const top=topText(selected),bottom=bottomText(selected);renderRingLetters($('#st-top-text'),top,'top');renderRingLetters($('#st-bottom-text'),bottom,'bottom');setSvgLogo(selected);
    $('#st-preview-title').textContent=`${fullName(selected)} single-team coaster preview`;const artworkLabel=selected.kind==='custom'?'custom artwork':logoStyleLabel();$('#st-preview-desc').textContent=`Circular single-team coaster with ${top} on the top name ring, ${bottom} on the bottom name ring, and ${artworkLabel} in the center.`;
    $('#st-selected-name').textContent=fullName(selected);$('#st-selected-kind').textContent=selected.kind==='custom'?'Custom team · design review':`${activeSport} team · ${logoStyleLabel()}`;$('#st-summary-name').textContent=fullName(selected);$('#st-summary-detail').textContent=selected.kind==='custom'?`Custom artwork · ${setLabel()} · ${setPrice()} · design review required`:`${logoStyleLabel()} · ${setLabel()} · ${setPrice()}`;$('#st-preview-sport').textContent=activeSport;$('#st-sport-heading').textContent=activeSport;const leagueLabel=$('#st-summary-league');if(leagueLabel)leagueLabel.textContent=`${activeSport} TEAM SET`;
    const art=$('#st-selected-art');art.style.setProperty('--team-field',center);art.style.setProperty('--team-accent',accent);setHtmlLogo($('#st-selected-logo'),$('#st-selected-fallback'),selected);updateArtworkStyleUI();
  }

  function renderTeams(filter=''){
    const grid=$('#st-team-grid');grid.innerHTML='';
    const q=filter.trim().toLowerCase(),matches=currentTeams().filter(t=>`${t.city} ${t.name} ${t.id}`.toLowerCase().includes(q));
    matches.forEach(team=>{const button=document.createElement('button');button.type='button';button.className='st-team-option';button.style.setProperty('--team-field',fieldColor({...team,kind:'standard'}));button.style.setProperty('--team-accent',accentColor({...team,kind:'standard'}));button.innerHTML=`<span class="st-team-option-art"><img src="${standardLogoUrl({...team,kind:'standard'})}" alt=""/><b hidden>${team.id}</b></span><span class="st-team-option-copy"><strong>${team.city} ${team.name}</strong><small>${logoStyleLabel()}</small></span>`;const img=button.querySelector('img'),fb=button.querySelector('b');img.onload=()=>{img.hidden=false;fb.hidden=true};img.onerror=()=>{img.hidden=true;fb.hidden=false};button.addEventListener('click',()=>{selected={...team,kind:'standard'};closePicker();updatePreview();showMessage('',false);});grid.appendChild(button);});
    if(!matches.length){const empty=document.createElement('div');empty.className='st-team-empty';empty.textContent=`No ${activeSport} teams match that search.`;grid.appendChild(empty);}
  }

  function setArtworkStyle(style,announce=true){if(style!=='standard'&&style!=='blackout')return;if(activeSport!=='NFL'&&style==='blackout')return;activeArtworkStyle=style;updatePreview();if(announce)showMessage('',false);}
  function setSetSize(size,announce=true){if(size!=='4'&&size!=='8')return;activeSetSize=size;$$('[data-set-size]').forEach(btn=>{const on=btn.dataset.setSize===size;btn.classList.toggle('is-selected',on);btn.setAttribute('aria-checked',on?'true':'false');});updatePreview();if(announce)showMessage(`${setLabel()} selected at ${setPrice()}.`,false);}
  function openPicker(){if(!sportTeams[activeSport]){showMessage(`${activeSport} team options are coming soon.`,true);return;}$('#st-picker-overlay').hidden=false;document.body.style.overflow='hidden';showStandard();$('#st-team-search').value='';renderTeams();setTimeout(()=>$('#st-team-search').focus(),20);}
  function closePicker(){$('#st-picker-overlay').hidden=true;document.body.style.overflow='';showStandard();}
  function showStandard(){$('#st-standard-picker').hidden=false;}
  function showMessage(msg,info){const el=$('#st-message');if(!info){el.hidden=true;el.textContent='';return;}el.hidden=false;el.textContent=msg;el.dataset.kind='info';}

  $('#st-open-picker').addEventListener('click',openPicker);$$('[data-artwork-style]').forEach(btn=>btn.addEventListener('click',()=>setArtworkStyle(btn.dataset.artworkStyle,true)));$$('[data-set-size]').forEach(btn=>btn.addEventListener('click',()=>setSetSize(btn.dataset.setSize,true)));$('#st-picker-close').addEventListener('click',closePicker);$('#st-picker-overlay').addEventListener('click',e=>{if(e.target===$('#st-picker-overlay'))closePicker();});$('#st-team-search').addEventListener('input',e=>renderTeams(e.target.value));
  $('#st-reset').addEventListener('click',()=>{activeSport='NFL';activeLogoStyle='custom';activeArtworkStyle='standard';activeSetSize='4';selected={...defaultTeamForSport('NFL'),kind:'standard'};$$('.st-sport-option').forEach(b=>{const on=b.dataset.sport==='NFL';b.classList.toggle('is-selected',on);b.setAttribute('aria-checked',on?'true':'false');});setSetSize('4',false);updatePreview();showMessage('',false);});
  $('#st-continue').addEventListener('click',()=>{const params=new URLSearchParams({coaster:'your-team',sport:activeSport,team:fullName(selected),teamId:selected.id,logoStyle:activeLogoStyle,artworkStyle:activeArtworkStyle,setSize:activeSetSize});window.location.href=`../contact.html?${params.toString()}`;});
  $$('.st-sport-option').forEach(button=>button.addEventListener('click',()=>{const sport=button.dataset.sport;if(sport!=='NFL'){showMessage(`${sport} team options are coming soon. NFL is available now.`,true);return;}activeSport='NFL';activeLogoStyle='custom';activeArtworkStyle='standard';selected={...defaultTeamForSport('NFL'),kind:'standard'};$$('.st-sport-option').forEach(b=>{const on=b===button;b.classList.toggle('is-selected',on);b.setAttribute('aria-checked',on?'true':'false');});closePicker();updatePreview();showMessage('',false);}));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#st-picker-overlay').hidden)closePicker();});
  updatePreview();
})();
