const PRODUCTION_PAGES_HOST = 'westtechha.pages.dev';
const CANONICAL_PRODUCTION_HOST = 'westtechha.com';
// Preview admin Cloudflare Access validation. These are PUBLIC identifiers,
// never a login token. Cloudflare's signed JWT is verified before authorizing.
const DEV_ADMIN_HOST='dev.westtechha.com';
const ACCESS_ISSUER='https://westnetain8n.cloudflareaccess.com';
const ACCESS_AUDIENCE='76b566a38877e16451475aef7994a8f7890fbe163ef07985a2afd5ad2664696b';
const ADMIN_EMAILS=new Set(['west.ed@gmail.com','ewest@westtechha.com']);
let accessKeys={until:0,keys:[]};
function decodeUrlBase64(value){
  const b64=value.replace(/-/g,'+').replace(/_/g,'/');
  const binary=atob(b64.padEnd(Math.ceil(b64.length/4)*4,'='));
  return Uint8Array.from(binary,ch=>ch.charCodeAt(0));
}
async function getAccessKey(kid){
  if(Date.now()>=accessKeys.until||!accessKeys.keys.some(k=>k.kid===kid)){
    const response=await fetch(ACCESS_ISSUER+'/cdn-cgi/access/certs',{headers:{Accept:'application/json'}});
    if(!response.ok)throw Error('Cloudflare Access signing keys unavailable.');
    const data=await response.json();
    if(!Array.isArray(data.keys))throw Error('Cloudflare Access signing keys missing.');
    accessKeys={until:Date.now()+300000,keys:data.keys};
  }
  return accessKeys.keys.find(k=>k.kid===kid&&k.kty==='RSA')||null;
}
async function validatedDevAdminEmail(request,expectedAudience){
  try{
    const token=request.headers.get('Cf-Access-Jwt-Assertion');
    if(!token||token.length>12000)return null;
    const pieces=token.split('.');
    if(pieces.length!==3)return null;
    const header=JSON.parse(new TextDecoder().decode(decodeUrlBase64(pieces[0])));
    const claims=JSON.parse(new TextDecoder().decode(decodeUrlBase64(pieces[1])));
    if(header.alg!=='RS256'||typeof header.kid!=='string'||header.kid.length>200)return null;
    if(claims.iss!==ACCESS_ISSUER)return null;
    const audiences=Array.isArray(claims.aud)?claims.aud:[claims.aud];
    if(!expectedAudience||!audiences.includes(expectedAudience))return null;
    const now=Math.floor(Date.now()/1000);
    if(!Number.isSafeInteger(claims.exp)||claims.exp<=now)return null;
    if(claims.nbf!==undefined&&(!Number.isSafeInteger(claims.nbf)||claims.nbf>now+30))return null;
    const email=String(claims.email||'').trim().toLowerCase();
    if(!ADMIN_EMAILS.has(email))return null;
    const jwk=await getAccessKey(header.kid);
    if(!jwk)return null;
    const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
    const valid=await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decodeUrlBase64(pieces[2]),new TextEncoder().encode(pieces[0]+'.'+pieces[1]));
    return valid?email:null;
  }catch{return null;}
}


function isAdminPath(pathname){
  return pathname === '/admin' || pathname.startsWith('/admin/') || pathname === '/api/admin' || pathname.startsWith('/api/admin/');
}

function isInternalSourcePath(pathname){
  return pathname === '/_local-notes' || pathname.startsWith('/_local-notes/') ||
    pathname === '/migrations' || pathname.startsWith('/migrations/') ||
    pathname === '/scripts' || pathname.startsWith('/scripts/') ||
    pathname === '/tools' || pathname.startsWith('/tools/') ||
    pathname === '/coasters/Color_Labs' || pathname.startsWith('/coasters/Color_Labs/');
}

export async function onRequest(context){
  const requestUrl = new URL(context.request.url);
  const host = requestUrl.hostname.toLowerCase();

  const isDevColorLab=requestUrl.pathname==='/coasters/Color_Labs'||
    requestUrl.pathname.startsWith('/coasters/Color_Labs/');
  if(isInternalSourcePath(requestUrl.pathname)&&!(host===DEV_ADMIN_HOST&&isDevColorLab)){
    return new Response('Not found', { status: 404 });
  }

  if(host === PRODUCTION_PAGES_HOST && isAdminPath(requestUrl.pathname)){
    requestUrl.protocol = 'https:';
    requestUrl.hostname = CANONICAL_PRODUCTION_HOST;
    if(requestUrl.pathname === '/admin')requestUrl.pathname = '/admin/login';
    return Response.redirect(requestUrl.toString(), 302);
  }

  if((host === CANONICAL_PRODUCTION_HOST || host === `www.${CANONICAL_PRODUCTION_HOST}`) && requestUrl.pathname === '/admin'){
    requestUrl.pathname = '/admin/login';
    return Response.redirect(requestUrl.toString(), 302);
  }

  // The public Pages preview aliases are not a back door into Admin. This
  // applies to new preview deployments; earlier immutable hash URLs also need
  // a separate Cloudflare Access preview policy before sign-off.
  if(isAdminPath(requestUrl.pathname) && host.endsWith('.'+PRODUCTION_PAGES_HOST)){
    return new Response('Not found',{status:404});
  }

  if(host===DEV_ADMIN_HOST && isAdminPath(requestUrl.pathname)){
    if(requestUrl.pathname==='/admin'){
      requestUrl.pathname='/admin/login';
      return Response.redirect(requestUrl.toString(),302);
    }
    // The same Access application protects /admin/* and /api/admin/*.
    // Both require a signed JWT; a browser-only admin token is insufficient.
    const verifiedEmail=await validatedDevAdminEmail(context.request,ACCESS_AUDIENCE);
    if(!verifiedEmail)return new Response('Unauthorized',{status:401});
    if(!context.data)return new Response('Admin authentication context unavailable',{status:500});
    context.data.westtechVerifiedAdmin=verifiedEmail;
  }

  return context.next();
}
