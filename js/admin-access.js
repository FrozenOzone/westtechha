(function(){
  'use strict';
  const productionHosts=new Set(['westtechha.com','www.westtechha.com']);
  if(!productionHosts.has(location.hostname.toLowerCase()))return;
  sessionStorage.setItem('westtechha-admin-token','cloudflare-access');
  document.documentElement.classList.add('wt-cloudflare-admin');
  const style=document.createElement('style');
  style.textContent='.wt-cloudflare-admin #uo-auth,.wt-cloudflare-admin #xo-auth,.wt-cloudflare-admin #wo-auth,.wt-cloudflare-admin #ca-auth,.wt-cloudflare-admin #ea-auth,.wt-cloudflare-admin #cpt-auth{display:none!important}';
  document.head.appendChild(style);
})();
