import { sanitizeEnvValue } from './shared.js';

export function requireWestTechAdmin(context){
  const expected=sanitizeEnvValue(context.env.WESTTECH_ADMIN_TOKEN);
  const header=sanitizeEnvValue(context.request.headers.get('Authorization'));
  const provided=header.toLowerCase().startsWith('bearer ')?header.slice(7).trim():'';
  if(!expected)throw Object.assign(new Error('Missing WESTTECH_ADMIN_TOKEN secret.'),{status:500});
  if(!provided||provided!==expected)throw Object.assign(new Error('Unauthorized WestTech admin request.'),{status:401});
}
