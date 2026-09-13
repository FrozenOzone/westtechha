const PRODUCTION_PAGES_HOST = 'westtechha.pages.dev';
const CANONICAL_PRODUCTION_HOST = 'westtechha.com';

function isAdminPath(pathname){
  return pathname === '/admin' || pathname.startsWith('/admin/') || pathname === '/api/admin' || pathname.startsWith('/api/admin/');
}

export async function onRequest(context){
  const requestUrl = new URL(context.request.url);
  const branch = String(context.env.CF_PAGES_BRANCH || '').toLowerCase();
  const host = requestUrl.hostname.toLowerCase();

  if(branch === 'main' && host === PRODUCTION_PAGES_HOST && isAdminPath(requestUrl.pathname)){
    requestUrl.protocol = 'https:';
    requestUrl.hostname = CANONICAL_PRODUCTION_HOST;
    if(requestUrl.pathname === '/admin')requestUrl.pathname = '/admin/login';
    return Response.redirect(requestUrl.toString(), 302);
  }

  if(branch === 'main' && (host === CANONICAL_PRODUCTION_HOST || host === `www.${CANONICAL_PRODUCTION_HOST}`) && requestUrl.pathname === '/admin'){
    requestUrl.pathname = '/admin/login';
    return Response.redirect(requestUrl.toString(), 302);
  }

  return context.next();
}
