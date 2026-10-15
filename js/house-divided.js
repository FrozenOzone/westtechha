(function(){
  'use strict';
  const LOGO_SETS={custom:'custom'};
  let activeLogoStyle='custom';
  let activeArtworkStyle='standard';
  let blackoutColoredCenter=false;
  const nflTeams=[
    {id:'ARI',city:'Arizona',name:'Cardinals',primary:'#97233f',secondary:'#ffb612'},{id:'ATL',city:'Atlanta',name:'Falcons',primary:'#a71930',secondary:'#000000'},{id:'BAL',city:'Baltimore',name:'Ravens',primary:'#241773',secondary:'#9e7c0c'},{id:'BUF',city:'Buffalo',name:'Bills',primary:'#00338d',secondary:'#c60c30'},
    {id:'CAR',city:'Carolina',name:'Panthers',primary:'#0085ca',secondary:'#101820'},{id:'CHI',city:'Chicago',name:'Bears',primary:'#0b162a',secondary:'#c83803'},{id:'CIN',city:'Cincinnati',name:'Bengals',primary:'#fb4f14',secondary:'#000000'},{id:'CLE',city:'Cleveland',name:'Browns',primary:'#311d00',secondary:'#ff3c00'},
    {id:'DAL',city:'Dallas',name:'Cowboys',primary:'#003594',secondary:'#869397'},{id:'DEN',city:'Denver',name:'Broncos',primary:'#0a2342',secondary:'#fc4c02'},{id:'DET',city:'Detroit',name:'Lions',primary:'#0076b6',secondary:'#b0b7bc'},{id:'GB',city:'Green Bay',name:'Packers',primary:'#203731',secondary:'#ffb612'},
    {id:'HOU',city:'Houston',name:'Texans',primary:'#03202f',secondary:'#a71930'},{id:'IND',city:'Indianapolis',name:'Colts',primary:'#002c5f',secondary:'#ffffff'},{id:'JAX',city:'Jacksonville',name:'Jaguars',primary:'#006778',secondary:'#d7a22a'},{id:'KC',city:'Kansas City',name:'Chiefs',primary:'#e31837',secondary:'#ffb81c'},
    {id:'LV',city:'Las Vegas',name:'Raiders',primary:'#000000',secondary:'#a5acaf'},{id:'LAC',city:'Los Angeles',name:'Chargers',primary:'#0080c6',secondary:'#ffc20e'},{id:'LAR',city:'Los Angeles',name:'Rams',primary:'#003594',secondary:'#ffd100'},{id:'MIA',city:'Miami',name:'Dolphins',primary:'#008e97',secondary:'#fc4c02'},
    {id:'MIN',city:'Minnesota',name:'Vikings',primary:'#4f2683',secondary:'#ffc62f'},{id:'NE',city:'New England',name:'Patriots',primary:'#002244',secondary:'#c60c30'},{id:'NO',city:'New Orleans',name:'Saints',primary:'#101820',secondary:'#d3bc8d'},{id:'NYG',city:'New York',name:'Giants',primary:'#0b2265',secondary:'#a71930'},
    {id:'NYJ',city:'New York',name:'Jets',primary:'#125740',secondary:'#ffffff'},{id:'PHI',city:'Philadelphia',name:'Eagles',primary:'#004c54',secondary:'#a5acaf'},{id:'PIT',city:'Pittsburgh',name:'Steelers',primary:'#101820',secondary:'#ffb612'},{id:'SF',city:'San Francisco',name:'49ers',primary:'#aa0000',secondary:'#b3995d'},
    {id:'SEA',city:'Seattle',name:'Seahawks',primary:'#002244',secondary:'#69be28'},{id:'TB',city:'Tampa Bay',name:'Buccaneers',primary:'#d50a0a',secondary:'#ff7900'},{id:'TEN',city:'Tennessee',name:'Titans',primary:'#0c2340',secondary:'#4b92db'},{id:'WAS',city:'Washington',name:'Commanders',primary:'#5a1414',secondary:'#ffb612'}
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
  const $=(sel,root=document)=>root.querySelector(sel);const $$=(sel,root=document)=>Array.from(root.querySelectorAll(sel));
  const picker=$('#team-picker'),teamGrid=$('#team-grid'),search=$('#team-search'),standardPicker=$('#team-standard-picker'),sportNote=$('#sport-note'),logoStyleNote=$('#logo-style-note'),blackoutCenterOption=$('#hd-blackout-center-option'),blackoutCenterToggle=$('#hd-blackout-colored-center'),buildMessage=$('#build-message');
  let activeSide=null,activeSport='NFL';
  const state={one:{...nflTeams.find(t=>t.id==='DEN'),kind:'standard'},two:{...nflTeams.find(t=>t.id==='DAL'),kind:'standard'}};
  const printPalette=window.WestTechNFLTeamArtPrintPalette||window.WestTechNFLPrintPalette||[],teamArtProfiles=window.WestTechNFLTeamArtProfiles||{},houseProfiles=window.WestTechNFLHouseDividedProfiles||teamArtProfiles;
  const blackoutStandard=window.WestTechNFLTeamArtBlackoutStandard||{field:'petg-black',band:'petg-black',text:'petg-white',frameOuter:'petg-white',frameInner:'petg-black'};
  const blackoutProfiles=window.WestTechNFLTeamArtBlackoutProfiles||{};
  const TEAM_ART_OUTLINES=window.WestTechNFLTeamArtOutlineData||{};
  const nhlSinglePalette=window.WestTechNHLSingleTeamPrintPalette||[],nhlSingleProfiles=window.WestTechNHLSingleTeamProfiles||{};
  const paletteById=Object.fromEntries([...printPalette,...nhlSinglePalette].map(color=>[color.id,color]));
  const houseAccentBaseline=window.WestTechHouseAccentBaseline||{sports:{}};
  const houseAccentSelections={one:null,two:null};
  const HD_DEFAULT_BAND_COLOR_ID='petg-black';
  const HD_DEFAULT_TEXT_COLOR_ID='petg-white';
  const HD_COLLISION_FALLBACK_COLOR_ID='petg-white';
  function paletteHex(id,fallback){return paletteById[id]?.hex||fallback;}
  function paletteLabel(id){return paletteById[id]?.label||paletteById[id]?.color||id||'WestTech accent';}

  function currentTeams(){return sportTeams[activeSport]||[];}
  function defaultsForSport(sport){if(sport==='NHL')return [nhlTeams.find(t=>t.id==='COL'),nhlTeams.find(t=>t.id==='PHI')];return [nflTeams.find(t=>t.id==='DEN'),nflTeams.find(t=>t.id==='DAL')];}
  function fullName(team){if(!team)return'Choose a team';return `${team.city} ${team.name}`;}
  function shortName(team){if(!team)return'TEAM';return team.name.toUpperCase();}
  function mark(team){if(!team)return'?';return team.id;}
  function isCustom(team){return team&&team.kind==='custom';}
  function teamPrimary(team){return team&&team.primary?team.primary:'#1677c4';}
  function secondary(team){return team&&team.secondary?team.secondary:'#ffffff';}
  function profile(team){if(!team)return null;if(team.kind==='custom')return team.printProfile||{field:'royal-blue',band:'white',text:'black',house:'royal-blue'};if(activeSport==='NFL')return teamArtProfiles[team.id]||null;if(activeSport==='NHL')return nhlSingleProfiles[team.id]||null;return null;}
  function blackoutProfile(team){return activeSport==='NFL'&&team&&!isCustom(team)?blackoutProfiles[team.id]||null:null;}
  function profileHex(team,role,fallback){const p=profile(team),id=p&&p[role];return(id&&paletteById[id]&&paletteById[id].hex)||fallback;}
  function fieldColor(team){if(activeSport==='NFL'&&activeArtworkStyle==='blackout'&&!isCustom(team))return paletteHex(blackoutStandard.field,'#111317');return profileHex(team,'field',teamPrimary(team));}
  function houseProfile(team){if(!team||isCustom(team))return null;return activeSport==='NFL'?(houseProfiles[team.id]||null):profile(team);}
  function usesTeamColoredCenter(){return activeArtworkStyle!=='blackout'||blackoutColoredCenter;}
  function centerBandColorId(team){if(activeSport==='NFL'&&activeArtworkStyle==='blackout'&&!blackoutColoredCenter&&!isCustom(team))return blackoutStandard.band||HD_DEFAULT_BAND_COLOR_ID;return houseProfile(team)?.band||HD_DEFAULT_BAND_COLOR_ID;}
  function centerTextColorId(team){if(activeSport==='NFL'&&activeArtworkStyle==='blackout'&&!blackoutColoredCenter&&!isCustom(team))return blackoutStandard.text||HD_DEFAULT_TEXT_COLOR_ID;return houseProfile(team)?.text||HD_DEFAULT_TEXT_COLOR_ID;}
  function centerBandColor(team){return paletteHex(centerBandColorId(team),'#111317');}
  function bandTextColor(team){return paletteHex(centerTextColorId(team),'#f5f5f2');}
  function sameColor(a,b){return String(a||'').trim().toLowerCase()===String(b||'').trim().toLowerCase();}
  function contrastTextIdForBand(colorId){
    const value=String(paletteHex(colorId,'#111317')).replace('#','');
    if(!/^[0-9a-f]{6}$/i.test(value))return HD_DEFAULT_TEXT_COLOR_ID;
    const rgb=[0,2,4].map(i=>parseInt(value.slice(i,i+2),16)/255).map(c=>c<=0.03928?c/12.92:Math.pow((c+0.055)/1.055,2.4));
    const luminance=0.2126*rgb[0]+0.7152*rgb[1]+0.0722*rgb[2];
    const whiteContrast=1.05/(luminance+0.05),blackContrast=(luminance+0.05)/0.05;
    return whiteContrast>=blackContrast?'petg-white':'petg-black';
  }
  function resolvedCenterBands(oneTeam=state.one,twoTeam=state.two){
    const oneRaw=centerBandColorId(oneTeam),twoRaw=centerBandColorId(twoTeam);
    const oneTextRaw=centerTextColorId(oneTeam),twoTextRaw=centerTextColorId(twoTeam);
    if(!usesTeamColoredCenter())return {oneBandId:oneRaw,twoBandId:twoRaw,oneTextId:oneTextRaw,twoTextId:twoTextRaw};
    const fieldHexes=[fieldColor(oneTeam),fieldColor(twoTeam)];
    const collides=id=>fieldHexes.some(value=>sameColor(paletteHex(id,''),value));
    const fallback=(avoidId='')=>{
      const ids=['petg-white','petg-black','petg-grey'];
      for(const id of ids){
        if(!paletteById[id]||collides(id))continue;
        if(avoidId&&sameColor(paletteHex(id,''),paletteHex(avoidId,'')))continue;
        return id;
      }
      for(const id of ids){if(paletteById[id]&&!collides(id))return id;}
      return HD_COLLISION_FALLBACK_COLOR_ID;
    };
    let oneBandId=oneRaw,twoBandId=twoRaw;
    let oneChanged=false,twoChanged=false;
    if(collides(oneBandId)){oneBandId=fallback(twoBandId);oneChanged=true;}
    if(collides(twoBandId)){twoBandId=fallback(oneBandId);twoChanged=true;}
    return {
      oneBandId,
      twoBandId,
      oneTextId:oneChanged?contrastTextIdForBand(oneBandId):oneTextRaw,
      twoTextId:twoChanged?contrastTextIdForBand(twoBandId):twoTextRaw
    };
  }
  function dividerColorId(team){
    if(activeSport==='NFL'&&activeArtworkStyle==='blackout'&&!isCustom(team))return blackoutProfile(team)?.separator||'petg-white';
    // Standard keeps the normal Black field/center edge. If both the field and
    // that team's shared center section are Black, use Grey so the edge remains visible.
    const band=centerBandColor(team),black=paletteHex('petg-black','#111317');
    return ['NFL','NHL'].includes(activeSport)&&!isCustom(team)&&sameColor(fieldColor(team),black)&&sameColor(band,black)?'petg-grey':'petg-black';
  }
  function dividerColor(team){return paletteHex(dividerColorId(team),'#111317');}

  function approvedAccentRecord(team){
    if(!['NFL','NHL'].includes(activeSport)||!team||isCustom(team))return null;
    const rec=houseAccentBaseline?.sports?.[activeSport]?.[team.id];
    return rec&&rec.approved&&rec.preferred?rec:null;
  }
  function baseApprovedAccentIds(team){
    const rec=approvedAccentRecord(team);if(!rec)return[];
    return [...new Set([rec.preferred,rec.alternate].filter(id=>id&&paletteById[id]))];
  }
  function approvedAccentIds(team,side=null){
    const ids=baseApprovedAccentIds(team);
    // NHL teams may intentionally have no Alternate. White is exposed only
    // when the collision resolver actually had to use it for this side.
    if(activeSport==='NHL'&&side&&houseAccentSelections[side]===HD_COLLISION_FALLBACK_COLOR_ID&&paletteById[HD_COLLISION_FALLBACK_COLOR_ID]){
      ids.push(HD_COLLISION_FALLBACK_COLOR_ID);
    }
    return [...new Set(ids)];
  }
  function ensureHouseAccentDefaults(){
    if(!['NFL','NHL'].includes(activeSport)){
      houseAccentSelections.one=null;houseAccentSelections.two=null;return;
    }
    for(const side of ['one','two']){
      const rec=approvedAccentRecord(state[side]);
      const ids=baseApprovedAccentIds(state[side]);
      const current=houseAccentSelections[side];
      if(!rec||!ids.length){houseAccentSelections[side]=null;continue;}
      // Collision-only White never persists as a normal choice. Reset to the
      // team's approved set first, then re-apply White below only if the
      // current matchup still needs it.
      if(!ids.includes(current))houseAccentSelections[side]=rec.preferred;
    }
    if(houseAccentSelections.one&&houseAccentSelections.one===houseAccentSelections.two){
      const recTwo=approvedAccentRecord(state.two);
      const recOne=approvedAccentRecord(state.one);
      if(recTwo?.alternate&&recTwo.alternate!==houseAccentSelections.one){
        houseAccentSelections.two=recTwo.alternate;
      }else if(recOne?.alternate&&recOne.alternate!==houseAccentSelections.two){
        houseAccentSelections.one=recOne.alternate;
      }else if(activeSport==='NHL'&&HD_COLLISION_FALLBACK_COLOR_ID!==houseAccentSelections.one&&paletteById[HD_COLLISION_FALLBACK_COLOR_ID]){
        houseAccentSelections.two=HD_COLLISION_FALLBACK_COLOR_ID;
      }
    }
  }
  function legacyHouseAccentColor(team){
    if(activeSport==='NFL'&&!isCustom(team)){
      const p=profile(team)||{};
      for(const id of [p.house,p.band,p.field,p.text]){
        if(id&&id!=='petg-black'&&id!=='petg-white'&&paletteById[id]?.hex)return paletteById[id].hex;
      }
    }
    const primary=teamPrimary(team),secondaryColor=secondary(team);
    const normalize=value=>String(value||'').toLowerCase();
    if(!['#000000','#111317','#ffffff','#f5f5f2'].includes(normalize(primary)))return primary;
    if(!['#000000','#111317','#ffffff','#f5f5f2'].includes(normalize(secondaryColor)))return secondaryColor;
    return primary;
  }
  function houseAccentColor(side,team){
    const id=houseAccentSelections[side];
    if(['NFL','NHL'].includes(activeSport)&&id&&paletteById[id])return paletteById[id].hex;
    return legacyHouseAccentColor(team);
  }
  function houseAccentOrderLabel(side){
    const id=houseAccentSelections[side];
    return id&&paletteById[id]?`${paletteLabel(id)} (PETG)`:'';
  }
  function updateAccentControl(side){
    const idPrefix=side==='one'?'side-one':'side-two';
    const container=$(`#${idPrefix}-house-accent-control`),select=$(`#${idPrefix}-house-accent`),swatch=$(`#${idPrefix}-house-accent-swatch`);
    if(!container||!select||!swatch)return;
    const team=state[side],rec=approvedAccentRecord(team),ids=approvedAccentIds(team,side);
    if(!rec||!ids.length){container.hidden=true;return;}
    container.hidden=false;
    const selected=houseAccentSelections[side]||rec.preferred;
    select.innerHTML='';
    const other=side==='one'?'two':'one';
    ids.forEach(id=>{
      const option=document.createElement('option');
      const role=id===rec.preferred?'Preferred':(id===rec.alternate?'Alternate':'Collision fallback');
      option.value=id;option.textContent=`${paletteLabel(id)} — ${role}`;option.selected=id===selected;
      option.disabled=id===houseAccentSelections[other]&&id!==selected;
      select.appendChild(option);
    });
    swatch.style.background=paletteHex(selected,'#ffffff');
  }
  function updateAccentControls(){updateAccentControl('one');updateAccentControl('two');}
  function setHouseAccent(side,id){
    const other=side==='one'?'two':'one';
    const valid=approvedAccentIds(state[side],side);
    if(!valid.includes(id)){updateAccentControl(side);return;}
    if(id&&id===houseAccentSelections[other]){
      updateAccentControl(side);
      showBuildMessage(`${paletteLabel(id)} is already being used by ${fullName(state[other])}. Choose the other available ${fullName(state[side])} accent so the divided house stays readable.`,true);
      return;
    }
    houseAccentSelections[side]=id;
    updatePreview();
    showBuildMessage(`${fullName(state[side])} divided-house accent set to ${paletteLabel(id)}.`,false);
  }

  function standardLogoUrl(team){if(!team||isCustom(team)||activeSport!=='NFL')return'';return `../images/coasters/teams/nfl/custom/${team.id}.svg`;}
  function logoUrl(team){if(!team)return'';if(isCustom(team))return team.artworkUrl||'';return standardLogoUrl(team);}
  function styleLabel(){return activeArtworkStyle==='blackout'?'WestTech team art · Blackout':'WestTech team art · Standard';}
  function styleLabelSingular(){return activeArtworkStyle==='blackout'?'Blackout WestTech team art':'Standard WestTech team art';}
  function setArtwork(img,fallback,team){const src=logoUrl(team);fallback.textContent=mark(team);fallback.hidden=!!src;if(src){img.hidden=false;img.alt=`${fullName(team)} artwork`;img.src=src;img.onerror=()=>{img.hidden=true;fallback.hidden=false;};img.onload=()=>{img.hidden=false;fallback.hidden=true;};}else{img.removeAttribute('src');img.alt='';img.hidden=true;fallback.hidden=false;}}
  function logoScale(team){if(activeSport!=='NFL'||!team||isCustom(team))return 100;/* House Divided geometry is shared only between House Standard and House Blackout. */const p=houseProfiles[team.id]||{};const value=Number(p.logoScaleCustom);return Number.isFinite(value)?Math.max(30,Math.min(120,value)):100;}
  function applyLogoBox(imageEl,side,percent){const x=70,w=860,h=385,y=side==='one'?70:545,s=Math.max(30,Math.min(120,Number(percent)||100))/100;const nw=w*s,nh=h*s,nx=x+(w-nw)/2,ny=y+(h-nh)/2;imageEl.setAttribute('x',nx.toFixed(2));imageEl.setAttribute('y',ny.toFixed(2));imageEl.setAttribute('width',nw.toFixed(2));imageEl.setAttribute('height',nh.toFixed(2));return{nx,ny,nw,nh};}
  function renderTeamArtOutline(side,team,box){const out=$(`#preview-logo-${side}-outline`),paths=$(`#preview-logo-${side}-outline-paths`);if(!out||!paths)return;out.setAttribute('x',box.nx.toFixed(2));out.setAttribute('y',box.ny.toFixed(2));out.setAttribute('width',box.nw.toFixed(2));out.setAttribute('height',box.nh.toFixed(2));const p=team&&!isCustom(team)?(activeArtworkStyle==='blackout'?(blackoutProfiles[team.id]||{}):(teamArtProfiles[team.id]||{})):null,data=activeSport==='NFL'&&team&&!isCustom(team)?TEAM_ART_OUTLINES[team.id]:null,enabled=!!(data&&p?.logoOutlineEnabled);out.style.display=enabled?'block':'none';paths.replaceChildren();if(!enabled)return;out.setAttribute('viewBox',data.viewBox||'0 0 1000 1000');const fill=paletteHex(p.logoOutline,activeArtworkStyle==='blackout'?'#f5f5f2':'#111317');data.paths.forEach(part=>{const node=document.createElementNS('http://www.w3.org/2000/svg','path');node.setAttribute('d',part.d);node.setAttribute('fill',fill);if(part.fillRule)node.setAttribute('fill-rule',part.fillRule);if(part.clipRule)node.setAttribute('clip-rule',part.clipRule);paths.appendChild(node);});}
  function setSvgArtwork(imageEl,fallbackEl,team){const src=logoUrl(team),side=imageEl.id==='preview-logo-one'?'one':'two',box=applyLogoBox(imageEl,side,activeSport==='NFL'?logoScale(team):100);renderTeamArtOutline(side,team,box);fallbackEl.textContent=mark(team);if(src){imageEl.setAttribute('href',src);imageEl.setAttributeNS('http://www.w3.org/1999/xlink','href',src);imageEl.style.display='block';fallbackEl.style.display='none';}else{imageEl.removeAttribute('href');imageEl.style.display='none';fallbackEl.style.display='block';}}
  function updateLogoStyleUI(){
    const row=$('#hd-logo-style-row'),heading=$('#logo-style-heading');
    activeLogoStyle='custom';
    if(row){row.hidden=false;row.style.display='';row.removeAttribute('aria-hidden');}
    if(heading)heading.textContent='Artwork Style';
    if(blackoutCenterOption)blackoutCenterOption.hidden=activeArtworkStyle!=='blackout';
    if(blackoutCenterToggle)blackoutCenterToggle.checked=blackoutColoredCenter;
    if(logoStyleNote){
      if(activeArtworkStyle==='blackout')logoStyleNote.textContent=blackoutColoredCenter?'Blackout keeps Black fields and the Blackout logo treatment while using a team-colored HOUSE / DIVIDED center.':'Blackout uses Black fields, a Black center, and the Blackout logo treatment. A team-colored center is optional.';
      else logoStyleNote.textContent='Standard uses team-color fields and a team-colored HOUSE / DIVIDED center.';
    }
    $$('[data-artwork-style]').forEach(btn=>{const on=btn.dataset.artworkStyle===activeArtworkStyle;btn.classList.toggle('is-selected',on);btn.setAttribute('aria-checked',on?'true':'false');});
  }
  function updateCard(side){const team=state[side],card=$(`[data-side-card="${side}"]`),id=side==='one'?'side-one':'side-two',art=$(`#${id}-art`),img=$(`#${id}-logo`),fallback=$(`#${id}-mark`);setArtwork(img,fallback,team);$(`#${id}-name`).textContent=fullName(team);$(`#${id}-kind`).textContent=`${activeArtworkStyle==='blackout'?'Blackout':'Standard'} ${activeSport} team · WestTech Team Art`;art.style.setProperty('--team-primary',fieldColor(team));art.style.setProperty('--team-secondary',bandTextColor(team));card.classList.remove('is-custom');}
  function updatePreview(){
    ensureHouseAccentDefaults();
    const one=state.one,two=state.two,centers=resolvedCenterBands(one,two),disc=$('#preview-disc');
    const frame=window.WestTechNFLHouseDividedFrame||{outer:'petg-white',inner:'petg-black'},isBlackout=activeSport==='NFL'&&activeArtworkStyle==='blackout',frameOuter=paletteHex(isBlackout?blackoutStandard.frameOuter:frame.outer,'#f5f5f2'),frameInner=paletteHex(isBlackout?blackoutStandard.frameInner:frame.inner,'#111317');
    disc.dataset.artworkStyle=isBlackout?'blackout':'standard';
    disc.style.setProperty('--hd-frame-outer',frameOuter);disc.style.setProperty('--hd-frame-inner',frameInner);disc.style.setProperty('--hd-side-one-field',fieldColor(one));disc.style.setProperty('--hd-side-two-field',fieldColor(two));disc.style.setProperty('--hd-side-two-band',paletteHex(centers.twoBandId,'#111317'));disc.style.setProperty('--hd-side-one-band',paletteHex(centers.oneBandId,'#111317'));disc.style.setProperty('--hd-side-two-band-text',paletteHex(centers.twoTextId,'#f5f5f2'));disc.style.setProperty('--hd-side-one-band-text',paletteHex(centers.oneTextId,'#f5f5f2'));disc.style.setProperty('--hd-side-two-house',houseAccentColor('two',two));disc.style.setProperty('--hd-side-one-house',houseAccentColor('one',one));disc.style.setProperty('--hd-side-one-divider',dividerColor(one));disc.style.setProperty('--hd-side-two-divider',dividerColor(two));
    setSvgArtwork($('#preview-logo-one'),$('#preview-mark-one'),one);setSvgArtwork($('#preview-logo-two'),$('#preview-mark-two'),two);
    $('#hd-preview-title').textContent=`${fullName(one)} + ${fullName(two)} ${isBlackout?'Blackout ':''}House Divided coaster preview`;
    $('#hd-preview-desc').textContent=isBlackout?(blackoutColoredCenter?`Blackout House Divided preview with ${fullName(one)} on top and ${fullName(two)} on bottom, Black team fields, team-colored center treatment, WestTech Team Art, and team house accents.`:`Blackout House Divided preview with ${fullName(one)} on top and ${fullName(two)} on bottom, Black team fields, a Black HOUSE DIVIDED center, WestTech Team Art, and team house accents.`):`Circular House Divided coaster with ${fullName(one)} on the top half, ${fullName(two)} on the bottom half, and a team-colored HOUSE DIVIDED center treatment.`;
    $('#preview-band-left').textContent='HOUSE';$('#preview-band-right').textContent='DIVIDED';$('#preview-summary').textContent=`${fullName(one)} + ${fullName(two)}`;
    const centerDetail=isBlackout?(blackoutColoredCenter?'team-colored center':'Black center'):'team-colored center';
    $('#preview-detail').textContent=['NFL','NHL'].includes(activeSport)?`${isBlackout?'Blackout':'Standard'} ${activeSport} matchup · ${styleLabel()} · ${centerDetail} · house accents`:`Standard ${activeSport} matchup · ${styleLabel()} · WestTech center treatment`;
    $('#preview-sport').textContent=activeSport;$('#sport-heading').textContent=activeSport;
    updateLogoStyleUI();updateCard('one');updateCard('two');updateAccentControls();
  }
  function renderTeams(filter=''){
    const needle=filter.trim().toLowerCase(),teams=currentTeams().filter(team=>`${team.city} ${team.name} ${team.id}`.toLowerCase().includes(needle));teamGrid.innerHTML='';
    teams.forEach(team=>{const button=document.createElement('button');button.type='button';button.className='hd-team-option';button.style.setProperty('--team-primary',fieldColor(team));button.style.setProperty('--team-secondary',bandTextColor(team));button.innerHTML=`<span class="hd-team-option-art"><img src="${standardLogoUrl(team)}" alt=""/><b>${team.id}</b></span><span><strong>${team.city} ${team.name}</strong><small>${styleLabelSingular()}</small></span>`;const thumb=button.querySelector('img'),fb=button.querySelector('b');fb.hidden=true;thumb.addEventListener('error',()=>{thumb.hidden=true;fb.hidden=false;});thumb.addEventListener('load',()=>{thumb.hidden=false;fb.hidden=true;});button.addEventListener('click',()=>{const side=activeSide;state[side]={...team,kind:'standard'};houseAccentSelections[side]=null;ensureHouseAccentDefaults();closePicker();updatePreview();showBuildMessage(`${fullName(state[side])} selected for ${side==='one'?'Side 1':'Side 2'}. Team house accents were applied automatically.`,false);});teamGrid.appendChild(button);});
    if(!teams.length){const empty=document.createElement('div');empty.className='hd-team-empty';empty.textContent=`No ${activeSport} teams match that search.`;teamGrid.appendChild(empty);}
  }
  function setArtworkStyle(style,announce=true){if(style!=='standard'&&style!=='blackout')return;if(activeSport!=='NFL'&&style==='blackout')return;activeArtworkStyle=style;updatePreview();if(announce){const centerNote=style==='blackout'?(blackoutColoredCenter?' with the team-colored center':' with the Black center'):'';showBuildMessage(`${style==='blackout'?'Blackout':'Standard'} House Divided artwork selected for both teams${centerNote}.`,false);}}
  function showStandardPicker(){standardPicker.hidden=false;}
  function openPicker(side){if(!sportTeams[activeSport]){showBuildMessage(`${activeSport} team options are coming soon.`,true);return;}activeSide=side;$('#picker-side-label').textContent=side==='one'?'Side 1':'Side 2';$('#picker-title').textContent=`Choose ${side==='one'?'Side 1':'Side 2'} team`;picker.hidden=false;showStandardPicker();search.value='';renderTeams();setTimeout(()=>search.focus(),20);}
  function closePicker(){picker.hidden=true;showStandardPicker();activeSide=null;search.value='';}
  function showBuildMessage(message,isInfo){if(!isInfo){buildMessage.hidden=true;buildMessage.textContent='';return;}buildMessage.hidden=false;buildMessage.textContent=message;buildMessage.dataset.kind='info';}

  $$('[data-open-picker]').forEach(btn=>btn.addEventListener('click',()=>openPicker(btn.dataset.openPicker)));
  $$('[data-artwork-style]').forEach(btn=>btn.addEventListener('click',()=>setArtworkStyle(btn.dataset.artworkStyle,true)));
  blackoutCenterToggle?.addEventListener('change',()=>{blackoutColoredCenter=blackoutCenterToggle.checked;updatePreview();showBuildMessage(blackoutColoredCenter?'Team-colored center selected.':'Black center selected.',false);});
  $('#picker-close').addEventListener('click',closePicker);search.addEventListener('input',()=>renderTeams(search.value));
  $('#side-one-house-accent')?.addEventListener('change',event=>setHouseAccent('one',event.target.value));
  $('#side-two-house-accent')?.addEventListener('change',event=>setHouseAccent('two',event.target.value));
  $('#swap-teams').addEventListener('click',()=>{const tmp=state.one;state.one=state.two;state.two=tmp;const tmpAccent=houseAccentSelections.one;houseAccentSelections.one=houseAccentSelections.two;houseAccentSelections.two=tmpAccent;updatePreview();showBuildMessage('Sides swapped.',false);});
  $('#reset-build').addEventListener('click',()=>{activeSport='NFL';activeLogoStyle='custom';activeArtworkStyle='standard';blackoutColoredCenter=false;const defs=defaultsForSport('NFL');state.one={...defs[0],kind:'standard'};state.two={...defs[1],kind:'standard'};houseAccentSelections.one=null;houseAccentSelections.two=null;$$('.hd-sport-option').forEach(btn=>{const selected=btn.dataset.sport==='NFL';btn.classList.toggle('is-selected',selected);btn.setAttribute('aria-checked',selected?'true':'false');});sportNote.textContent='NFL Team Art is available now. More sports are coming soon.';closePicker();updatePreview();showBuildMessage('Example matchup reset to Denver Broncos + Dallas Cowboys.',false);});
  $('#continue-build').addEventListener('click',()=>{
    const centerMode=activeArtworkStyle==='blackout'?(blackoutColoredCenter?'team-color':'blackout'):'team-color';
    const params=new URLSearchParams({coaster:'house-divided',sport:activeSport,side1:fullName(state.one),side2:fullName(state.two),logoStyle:activeLogoStyle,artworkStyle:activeArtworkStyle,hdCenterMode:centerMode,blackoutColoredCenter:blackoutColoredCenter?'1':'0'});
    if(['NFL','NHL'].includes(activeSport)){
      const oneId=houseAccentSelections.one,twoId=houseAccentSelections.two,centers=resolvedCenterBands();
      params.set('side1CenterBandId',centers.oneBandId);params.set('side1CenterBand',paletteLabel(centers.oneBandId));params.set('side1CenterTextId',centers.oneTextId);params.set('side1CenterText',paletteLabel(centers.oneTextId));
      params.set('side2CenterBandId',centers.twoBandId);params.set('side2CenterBand',paletteLabel(centers.twoBandId));params.set('side2CenterTextId',centers.twoTextId);params.set('side2CenterText',paletteLabel(centers.twoTextId));
      if(oneId){params.set('side1HouseAccentId',oneId);params.set('side1HouseAccent',houseAccentOrderLabel('one'));}
      if(twoId){params.set('side2HouseAccentId',twoId);params.set('side2HouseAccent',houseAccentOrderLabel('two'));}
      const oneDividerId=dividerColorId(state.one),twoDividerId=dividerColorId(state.two);
      if(oneDividerId!=='petg-black'){params.set('side1DividerId',oneDividerId);params.set('side1Divider',`${paletteLabel(oneDividerId)} (PETG)`);}
      if(twoDividerId!=='petg-black'){params.set('side2DividerId',twoDividerId);params.set('side2Divider',`${paletteLabel(twoDividerId)} (PETG)`);}
    }
    window.location.href=`../contact.html?${params.toString()}`;
  });
  $$('.hd-sport-option').forEach(btn=>btn.addEventListener('click',()=>{const sport=btn.dataset.sport;if(sport!=='NFL'){sportNote.textContent=`${sport} Team Art is coming soon.`;showBuildMessage(`${sport} team options are coming soon. NFL is available now.`,true);return;}activeSport='NFL';activeLogoStyle='custom';activeArtworkStyle='standard';blackoutColoredCenter=false;const defs=defaultsForSport('NFL');state.one={...defs[0],kind:'standard'};state.two={...defs[1],kind:'standard'};houseAccentSelections.one=null;houseAccentSelections.two=null;$$('.hd-sport-option').forEach(other=>{const selected=other===btn;other.classList.toggle('is-selected',selected);other.setAttribute('aria-checked',selected?'true':'false');});sportNote.textContent='NFL Team Art is available now. Choose both sides and a house accent for each team.';closePicker();updatePreview();showBuildMessage(`${sport} selected.`,false);}));
  updatePreview();
})();
