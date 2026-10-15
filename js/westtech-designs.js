(function(){
  'use strict';
  const input=document.getElementById('wtd-state-search');
  const cards=Array.from(document.querySelectorAll('.wtd-state-card'));
  const count=document.getElementById('wtd-state-count');
  const empty=document.getElementById('wtd-state-empty');
  if(!input||!cards.length)return;
  function filter(){
    const q=String(input.value||'').trim().toLowerCase();
    let visible=0;
    cards.forEach(card=>{const show=!q||String(card.dataset.stateName||'').includes(q)||card.textContent.toLowerCase().includes(q);card.hidden=!show;if(show)visible++;});
    if(count)count.textContent=`${visible} ${visible===1?'state':'states'}`;
    if(empty)empty.hidden=visible!==0;
  }
  input.addEventListener('input',filter);
})();
