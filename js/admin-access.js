(function(){
  'use strict';
  const productionHosts=new Set(['westtechha.com','www.westtechha.com']);
  const isProduction=productionHosts.has(location.hostname.toLowerCase());
  window.WestTechAdminAccess={isProduction,token:'cloudflare-access',loginPath:'/admin/login'};
  if(!isProduction)return;

  sessionStorage.setItem('westtechha-admin-token','cloudflare-access');
  document.documentElement.classList.add('wt-cloudflare-admin');

  const style=document.createElement('style');
  style.textContent=[
    '.wt-cloudflare-admin #uo-auth,.wt-cloudflare-admin #xo-auth,.wt-cloudflare-admin #wo-auth,.wt-cloudflare-admin #ca-auth,.wt-cloudflare-admin #ea-auth,.wt-cloudflare-admin #cpt-auth{display:none!important}',
    '.wt-cloudflare-admin input[id$="-token"],.wt-cloudflare-admin button[id$="-connect"]{display:none!important}',
    '.wt-cloudflare-admin .uo-order-list .ca-empty,.wt-cloudflare-admin .xo-order-list .xo-empty,.wt-cloudflare-admin .wo-list .wo-empty{visibility:hidden}'
  ].join('');
  document.head.appendChild(style);

  window.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('#uo-auth,#xo-auth,#wo-auth,#ca-auth,#ea-auth,#cpt-auth').forEach(el=>{el.hidden=true;el.style.display='none';});
    document.querySelectorAll('input[id$="-token"]').forEach(el=>{el.value='cloudflare-access';});
  });
})();
