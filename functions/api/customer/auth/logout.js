import { clearCustomerSessionCookie, endCustomerSession } from '../../../_lib/customer-account.js';
import { jsonResponse } from '../../../_lib/shared.js';

export async function onRequestPost(context){try{await endCustomerSession(context);}catch{}return jsonResponse({ok:true},200,{'Set-Cookie':clearCustomerSessionCookie()});}
