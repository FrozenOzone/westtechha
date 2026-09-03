import { sanitizeEnvValue } from './shared.js';

export function requireWestTechAdmin(context) {
  const expected = sanitizeEnvValue(context?.env?.WESTTECH_ADMIN_TOKEN);
  const header = sanitizeEnvValue(context?.request?.headers?.get('Authorization'));
  const provided = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';

  if (!expected) {
    const error = new Error('Missing WESTTECH_ADMIN_TOKEN secret.');
    error.status = 500;
    throw error;
  }
  if (!provided || provided !== expected) {
    const error = new Error('Unauthorized WestTech admin request.');
    error.status = 401;
    throw error;
  }
}
