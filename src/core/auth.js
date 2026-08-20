import { createHash, timingSafeEqual } from 'node:crypto';

function readAuthorization(headers) {
  if (!headers) return '';
  if (typeof headers.get === 'function') return headers.get('authorization') ?? '';
  return headers.authorization ?? headers.Authorization ?? '';
}

function digest(value) {
  return createHash('sha256').update(value, 'utf8').digest();
}

export function requireGatewayAuth(request, secret) {
  if (typeof secret !== 'string' || secret.length < 1) return false;
  const authorization = readAuthorization(request?.headers);
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) return false;
  const supplied = authorization.slice(7);
  return timingSafeEqual(digest(supplied), digest(secret));
}
