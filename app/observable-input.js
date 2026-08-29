export const SUPPORTED_OBSERVABLE_TYPES = Object.freeze([
  'asn',
  'attack',
  'certificate',
  'cidr',
  'cve',
  'domain',
  'hash',
  'ip',
  'url',
]);

export function toGatewayIndicator({ type, value } = {}) {
  if (!SUPPORTED_OBSERVABLE_TYPES.includes(type)) throw new TypeError('unsupported observable type');
  if (typeof value !== 'string' || value.length === 0) throw new TypeError('observable value required');
  return type === 'certificate' ? `cert-sha256:${value}` : value;
}
