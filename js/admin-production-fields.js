(function(){
  'use strict';
  const monthNames=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const monthIndex=value=>monthNames.findIndex(month=>month.toLowerCase()===String(value||'').slice(0,3).toLowerCase());
  const iso=(year,month,day)=>`${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  const validIso=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''));
  function numericDate(month,day,year){
    const m=Number(month),d=Number(day),y=Number(year),date=new Date(y,m-1,d);
    return date.getFullYear()===y&&date.getMonth()===m-1&&date.getDate()===d?iso(y,m-1,d):'';
  }
  function formatDate(value,includeYear=true){
    if(!validIso(value))return '';
    const [year,month,day]=value.split('-').map(Number);
    return `${monthNames[month-1]} ${day}${includeYear?`, ${year}`:''}`;
  }
  function formatWindow(start,end){
    if(!start&&end)start=end;
    if(!start)return '';
    if(!end||end===start)return formatDate(start);
    const [sy,sm,sd]=start.split('-').map(Number),[ey,em,ed]=end.split('-').map(Number);
    if(sy===ey&&sm===em)return `${monthNames[sm-1]} ${sd}–${ed}, ${sy}`;
    if(sy===ey)return `${monthNames[sm-1]} ${sd}–${monthNames[em-1]} ${ed}, ${sy}`;
    return `${formatDate(start)}–${formatDate(end)}`;
  }
  function parseWindow(value){
    const text=String(value||'').trim();
    if(!text)return {start:'',end:''};
    if(validIso(text))return {start:text,end:''};
    let match=text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})\s*(?:–|—|-|to)\s*(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/i);
    if(match){const start=numericDate(match[1],match[2],match[3]),end=numericDate(match[4],match[5],match[6]);if(start&&end)return {start,end};}
    match=text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if(match){const start=numericDate(match[1],match[2],match[3]);if(start)return {start,end:''};}
    match=text.match(/^([A-Za-z]{3,9})\s+(\d{1,2})[–-](\d{1,2}),\s*(\d{4})$/);
    if(match){const month=monthIndex(match[1]);if(month>=0)return {start:iso(match[4],month,match[2]),end:iso(match[4],month,match[3])};}
    match=text.match(/^([A-Za-z]{3,9})\s+(\d{1,2})[–-]([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})$/);
    if(match){const sm=monthIndex(match[1]),em=monthIndex(match[3]);if(sm>=0&&em>=0)return {start:iso(match[5],sm,match[2]),end:iso(match[5],em,match[4])};}
    match=text.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})[–-]([A-Za-z]{3,9})\s+(\d{1,2}),\s*(\d{4})$/);
    if(match){const sm=monthIndex(match[1]),em=monthIndex(match[4]);if(sm>=0&&em>=0)return {start:iso(match[3],sm,match[2]),end:iso(match[6],em,match[5])};}
    const parsed=new Date(text);
    if(!Number.isNaN(parsed.getTime()))return {start:iso(parsed.getFullYear(),parsed.getMonth(),parsed.getDate()),end:''};
    return {start:'',end:''};
  }
  function elements(target){
    const field=typeof target==='string'?document.querySelector(target):target;
    if(!field)return {};
    const wrapper=document.querySelector(`[data-window-target="#${field.id}"]`);
    return {field,wrapper,start:wrapper?.querySelector('[data-window-start]'),end:wrapper?.querySelector('[data-window-end]'),note:wrapper?.querySelector('[data-window-note]')};
  }
  function syncFromDates(target){
    const {field,start,end,note}=elements(target);if(!field||!start||!end)return '';
    if(!start.value&&end.value){start.value=end.value;end.value='';}
    end.min=start.value||'';
    if(start.value&&end.value&&end.value<start.value)end.value=start.value;
    field.value=formatWindow(start.value,end.value);
    if(note)note.textContent=note.dataset.defaultText||'Choose a date. Add an optional end date only when you need a range.';
    field.dispatchEvent(new Event('input',{bubbles:true}));
    return field.value;
  }
  function setWindow(target,value){
    const {field,start,end,note}=elements(target);if(!field)return;
    field.value=String(value||'').trim();
    if(!start||!end)return;
    const parsed=parseWindow(field.value);start.value=parsed.start||'';end.value=parsed.end||'';end.min=start.value||'';
    if(note){if(!note.dataset.defaultText)note.dataset.defaultText=note.textContent.trim();note.textContent=note.dataset.defaultText;}
  }
  function getWindow(target){const {field}=elements(target);return String(field?.value||'').trim();}
  function disableWindow(target,disabled){const {start,end}=elements(target);if(start)start.disabled=disabled;if(end)end.disabled=disabled;}
  function bind(){document.querySelectorAll('[data-window-target]').forEach(wrapper=>{const target=wrapper.dataset.windowTarget,start=wrapper.querySelector('[data-window-start]'),end=wrapper.querySelector('[data-window-end]');start?.addEventListener('change',()=>syncFromDates(target));end?.addEventListener('change',()=>syncFromDates(target));setWindow(target,document.querySelector(target)?.value||'');});}
  window.WestTechProductionFields={bind,setWindow,getWindow,disableWindow,syncFromDates,formatWindow,parseWindow};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();
