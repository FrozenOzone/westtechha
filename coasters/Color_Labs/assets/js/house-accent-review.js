(function(){
  'use strict';

  const LEAGUES=['NFL','NHL'];
  const catalog=window.WestTechSportsColorLabCatalog||{};
  const inventory=(window.WestTechFilamentInventory||[]).filter(item=>item.family==='PETG'&&item.filamentStatus==='on-hand');
  const legacy=window.WestTechLegacyColorMap||{};
  const byId=new Map(inventory.map(item=>[item.id,item]));
  const $=(s,r=document)=>r.querySelector(s);
  const clone=v=>JSON.parse(JSON.stringify(v));
  const DRAFT_KEY='wt-house-accent-review-v2';
  let activeLeague='NFL';
  let needsOnly=false;
  let query='';
  let dirty=false;

  function sourceProfiles(league){return window[`WestTech${league}HouseDividedProfiles`]||{};}
  function normalize(value){
    if(byId.has(value))return value;
    const mapped=legacy[value];
    return byId.has(mapped)?mapped:'';
  }
  function teams(league=activeLeague){return (catalog[league]?.teams||[]).slice();}
  function teamName(t){return `${t.city} ${t.name}`;}
  function logoUrl(league,t){return t.logoUrl||`../images/coasters/teams/${league.toLowerCase()}/official/${t.file||`${t.id}.svg`}`;}
  function entry(id){return byId.get(id)||null;}
  function label(id){const e=entry(id);return e?`${e.label} (${e.material})`:'Choose color';}
  function hex(id){return entry(id)?.hex||'#ffffff';}
  function nonBlack(id){return id&&id!=='petg-black';}
  function isNeutral(id){return ['petg-white','petg-bone-white','petg-grey','petg-black'].includes(id);}

  function seedTeam(profile){
    const roleIds=['house','band','field','text'].map(key=>normalize(profile?.[key])).filter(Boolean);
    let preferred=roleIds.find(nonBlack)||'petg-white';
    const distinct=roleIds.filter(id=>id!==preferred&&nonBlack(id));
    const colored=distinct.find(id=>!isNeutral(id));
    const alternate=colored||distinct[0]||'';
    return {preferred,alternate,approved:false};
  }
  function seedAll(){
    const data={version:1,standard:{band:'petg-black',text:'petg-white',fallback:'petg-white'},sports:{}};
    LEAGUES.forEach(league=>{
      const profiles=sourceProfiles(league);
      data.sports[league]={};
      teams(league).forEach(t=>{data.sports[league][t.id]=seedTeam(profiles[t.id]||{});});
    });
    return data;
  }

  let working=seedAll();

  function mergeLoaded(loaded){
    if(!loaded?.sports)return false;
    LEAGUES.forEach(league=>{
      const incoming=loaded.sports[league]||{};
      teams(league).forEach(t=>{
        const row=incoming[t.id];if(!row)return;
        const preferred=normalize(row.preferred),alternate=normalize(row.alternate);
        if(preferred)working.sports[league][t.id].preferred=preferred;
        working.sports[league][t.id].alternate=alternate||'';
        working.sports[league][t.id].approved=row.approved===true;
      });
    });
    return true;
  }
  if(window.WestTechHouseAccentBaseline)mergeLoaded(window.WestTechHouseAccentBaseline);
  const baseline=clone(working);
  function loadDraft(){
    try{const raw=localStorage.getItem(DRAFT_KEY);if(raw)mergeLoaded(JSON.parse(raw));}catch(err){console.warn('House Accent Review draft could not load.',err);}
  }
  loadDraft();

  function state(league,id){return working.sports[league][id];}
  function valid(row){return !!row.preferred&&(!row.alternate||row.preferred!==row.alternate);}
  function ready(row){return valid(row)&&row.approved===true;}
  function optionMarkup(selected,allowBlank=false){
    const first=allowBlank?'<option value="">Choose alternate…</option>':'';
    return first+inventory.map(item=>`<option value="${item.id}"${item.id===selected?' selected':''}>${item.label}</option>`).join('');
  }
  function setDirty(value=true){dirty=value;renderDraftState();}
  function renderDraftState(){const el=$('#har-draft-state');if(el)el.textContent=dirty?'Changes are not saved to the browser draft.':'Working from current profiles / saved browser draft.';}

  function renderLeagueButtons(){
    document.querySelectorAll('[data-league]').forEach(btn=>btn.classList.toggle('is-selected',btn.dataset.league===activeLeague));
  }
  function visibleTeams(){
    const q=query.trim().toLowerCase();
    return teams().filter(t=>{
      const row=state(activeLeague,t.id);
      if(needsOnly&&ready(row))return false;
      if(!q)return true;
      return `${t.id} ${teamName(t)}`.toLowerCase().includes(q);
    });
  }
  function renderProgress(){
    const list=teams(),approved=list.filter(t=>ready(state(activeLeague,t.id))).length;
    $('#har-progress').textContent=`${activeLeague}: ${approved} / ${list.length} approved`;
    const invalid=list.filter(t=>!valid(state(activeLeague,t.id))).length;
    const readiness=$('#har-readiness');
    if(invalid===0&&approved===list.length){readiness.textContent='This league is fully reviewed and ready to export.';readiness.classList.add('good');}
    else{readiness.textContent=invalid?`${invalid} team${invalid===1?'':'s'} have an invalid Preferred/Alternate pairing. ${list.length-approved} await approval.`:`${list.length-approved} team${list.length-approved===1?'':'s'} await approval. Alternate is optional; White is collision-only fallback when needed.`;readiness.classList.remove('good');}
  }
  function renderTeamList(){
    const root=$('#har-team-list');root.innerHTML='';
    visibleTeams().forEach(t=>{
      const row=state(activeLeague,t.id),ok=valid(row);
      const el=document.createElement('article');
      el.className=`har-team-row${ready(row)?'':' needs-review'}`;el.dataset.team=t.id;
      el.innerHTML=`
        <div class="har-team"><img src="${logoUrl(activeLeague,t)}" alt=""/><div><b>${teamName(t)}</b><span>${t.id} · ${activeLeague}</span></div></div>
        <div><div class="har-color-control"><i data-swatch="preferred" style="background:${hex(row.preferred)}"></i><select data-role="preferred">${optionMarkup(row.preferred,false)}</select></div></div>
        <div><div class="har-color-control"><i data-swatch="alternate" style="background:${hex(row.alternate)}"></i><select data-role="alternate">${optionMarkup(row.alternate,true)}</select></div>${row.alternate?'':'<div class="har-optional">Optional — White is used only if a collision needs a fallback.</div>'}${ok?'':'<div class="har-invalid">Preferred and Alternate cannot be the same.</div>'}</div>
        <div class="har-house-preview" title="Preferred | Alternate / collision fallback"><i style="background:${hex(row.preferred)}"></i><b></b><i style="background:${hex(row.alternate||'petg-white')}"></i></div>
        <label class="har-approve"><input type="checkbox" data-role="approved" ${row.approved===true?'checked':''} ${ok?'':'disabled'}/> Approved</label>`;
      root.appendChild(el);
      const preferred=el.querySelector('[data-role="preferred"]'),alternate=el.querySelector('[data-role="alternate"]'),approved=el.querySelector('[data-role="approved"]');
      preferred.addEventListener('change',e=>{row.preferred=e.target.value;if(row.preferred===row.alternate)row.approved=false;setDirty();renderAll();});
      alternate.addEventListener('change',e=>{row.alternate=e.target.value;if(row.preferred===row.alternate)row.approved=false;setDirty();renderAll();});
      approved.addEventListener('change',e=>{row.approved=e.target.checked&&valid(row);setDirty();renderAll();});
    });
  }

  function renderMatchSelectors(){
    const list=teams();
    const markup=list.map(t=>`<option value="${t.id}">${teamName(t)}</option>`).join('');
    const one=$('#har-match-one'),two=$('#har-match-two');
    const oldOne=one.value,oldTwo=two.value;
    one.innerHTML=markup;two.innerHTML=markup;
    one.value=list.some(t=>t.id===oldOne)?oldOne:(activeLeague==='NFL'?'DEN':(list[0]?.id||''));
    two.value=list.some(t=>t.id===oldTwo)?oldTwo:(activeLeague==='NFL'?'PHI':(list[1]?.id||list[0]?.id||''));
  }
  function autoPair(id1,id2){
    const a=state(activeLeague,id1),b=state(activeLeague,id2);
    if(!a||!b)return null;
    let left=a.preferred,right=b.preferred,usedAlternate=false,usedFallback=false,warning='';
    if(left&&right&&left===right){
      if(b.alternate&&b.alternate!==left){right=b.alternate;usedAlternate=true;}
      else if(a.alternate&&a.alternate!==right){left=a.alternate;usedAlternate=true;}
      else if(left!=='petg-white'){right='petg-white';usedFallback=true;}
      else warning='Collision remains: review this matchup manually.';
    }
    return {left,right,usedAlternate,usedFallback,warning};
  }
  function renderMatch(){
    const one=$('#har-match-one'),two=$('#har-match-two'),root=$('#har-match-result');if(!one||!two||!root)return;
    const t1=teams().find(t=>t.id===one.value),t2=teams().find(t=>t.id===two.value),pair=autoPair(one.value,two.value);if(!t1||!t2||!pair)return;
    const note=pair.warning||(pair.usedFallback?'Preferred colors matched and neither team has an approved Alternate, so White is used only as the collision fallback.':(pair.usedAlternate?'Preferred colors matched, so the automatic rule switched one side to its approved Alternate.':'Preferred colors are different; no substitution is needed.'));
    const role=(leagueRow,color)=>color===leagueRow.alternate&&leagueRow.alternate?'Alternate':(color===leagueRow.preferred?'Preferred':'Collision fallback');
    root.innerHTML=`<div class="har-pair"><div class="har-pair-side"><strong>${t1.id} · ${label(pair.left)}</strong><div class="har-pair-swatch" style="background:${hex(pair.left)}"></div><small>${role(state(activeLeague,t1.id),pair.left)}</small></div><b>|</b><div class="har-pair-side right"><strong>${t2.id} · ${label(pair.right)}</strong><div class="har-pair-swatch" style="background:${hex(pair.right)}"></div><small>${role(state(activeLeague,t2.id),pair.right)}</small></div></div><div class="har-pair-note ${pair.warning?'collision':''}">${note}</div>`;
  }

  function renderAll(preserveMatch=true){
    renderLeagueButtons();renderProgress();renderTeamList();
    if(!preserveMatch)renderMatchSelectors();
    renderMatch();renderDraftState();
  }

  function saveDraft(){localStorage.setItem(DRAFT_KEY,JSON.stringify(working));setDirty(false);}
  function resetLeague(){working.sports[activeLeague]=clone(baseline.sports[activeLeague]);setDirty();renderAll(false);}
  function exportPayload(){
    const out={version:1,generatedAt:new Date().toISOString(),standard:{band:'petg-black',text:'petg-white',fallback:'petg-white'},sports:{}};
    LEAGUES.forEach(league=>{out.sports[league]={};teams(league).forEach(t=>{out.sports[league][t.id]=clone(state(league,t.id));});});
    return out;
  }
  function download(){
    const payload=exportPayload();
    const js=`(function(){\n  'use strict';\n  // WestTech House Divided approved team house accents.\n  window.WestTechHouseAccentBaseline = ${JSON.stringify(payload,null,2)};\n})();\n`;
    const blob=new Blob([js],{type:'application/javascript'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='westtech-house-accent-baseline.js';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function importFile(file){
    const text=await file.text();let data=null;
    try{data=JSON.parse(text);}catch(_){const match=text.match(/WestTechHouseAccentBaseline\s*=\s*(\{[\s\S]*\});?/);if(match){try{data=JSON.parse(match[1]);}catch(__){}}}
    if(!mergeLoaded(data)){alert('That file does not contain a House Accent Review export.');return;}
    setDirty();renderAll(false);
  }
  function nextUnapproved(){
    const t=teams().find(team=>!ready(state(activeLeague,team.id)));if(!t)return;
    needsOnly=false;$('#har-needs-only').checked=false;query='';$('#har-search').value='';renderAll();
    const row=document.querySelector(`[data-team="${CSS.escape(t.id)}"]`);row?.scrollIntoView({behavior:'smooth',block:'center'});
  }

  document.querySelectorAll('[data-league]').forEach(btn=>btn.addEventListener('click',()=>{activeLeague=btn.dataset.league;renderAll(false);}));
  $('#har-search').addEventListener('input',e=>{query=e.target.value;renderTeamList();});
  $('#har-needs-only').addEventListener('change',e=>{needsOnly=e.target.checked;renderTeamList();});
  $('#har-save-draft').addEventListener('click',saveDraft);
  $('#har-reset-league').addEventListener('click',()=>{if(confirm(`Reset ${activeLeague} house accents to the current profile suggestions?`))resetLeague();});
  $('#har-download-js').addEventListener('click',download);
  $('#har-import-file').addEventListener('change',e=>{const file=e.target.files?.[0];if(file)importFile(file);e.target.value='';});
  $('#har-next-unapproved').addEventListener('click',nextUnapproved);
  $('#har-match-one').addEventListener('change',renderMatch);$('#har-match-two').addEventListener('change',renderMatch);

  renderAll(false);
})();
