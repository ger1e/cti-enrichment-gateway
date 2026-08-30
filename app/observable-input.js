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

const MAX_INDICATOR_LENGTH = 4096;
const CVE_RE = /^CVE-\d{4}-\d{4,}$/i;
const ATTACK_RE = /^(?:T\d{4}(?:\.\d{3})?|TA\d{4}|G\d{4}|S\d{4}|M\d{4}|C\d{4}|DS\d{4}|DC\d{4}|DET\d{4})$/i;
const CERT_SHA256_RE = /^cert-sha256:([a-fA-F0-9]{64})$/;
const HASH_RE = /^(?:[a-fA-F0-9]{32}|[a-fA-F0-9]{40}|[a-fA-F0-9]{64})$/;
const ASN_RE = /^AS([1-9]\d*)$/i;
const MAX_ASN = 4_294_967_295n;

function parseIpv4(address) {
  const parts = String(address).split('.');
  if (parts.length !== 4 || parts.some(part => !/^(?:0|[1-9]\d{0,2})$/.test(part))) return null;
  const octets = parts.map(Number);
  if (octets.some(value => value > 255)) return null;
  let numeric = 0n;
  for (const octet of octets) numeric = (numeric << 8n) | BigInt(octet);
  return { version: 4, bits: 32, numeric, canonical: octets.join('.') };
}

function ipv4HexGroups(numeric) {
  const octets = [24n, 16n, 8n, 0n].map(shift => Number((numeric >> shift) & 255n));
  return [((octets[0] << 8) | octets[1]).toString(16), ((octets[2] << 8) | octets[3]).toString(16)];
}

function parseIpv6(address) {
  let raw = String(address).toLowerCase();
  if (!raw || raw.includes('%')) return null;
  if (raw.includes('.')) {
    const colon = raw.lastIndexOf(':');
    if (colon < 0) return null;
    const v4 = parseIpv4(raw.slice(colon + 1));
    if (!v4) return null;
    raw = `${raw.slice(0, colon)}:${ipv4HexGroups(v4.numeric).join(':')}`;
  }
  if ((raw.match(/::/g) ?? []).length > 1) return null;
  const hasCompression = raw.includes('::');
  const [leftRaw, rightRaw = ''] = raw.split('::');
  const left = leftRaw ? leftRaw.split(':') : [];
  const right = rightRaw ? rightRaw.split(':') : [];
  const valid = group => /^[0-9a-f]{1,4}$/.test(group);
  if (!left.every(valid) || !right.every(valid)) return null;
  if (!hasCompression && left.length !== 8) return null;
  if (hasCompression && left.length + right.length >= 8) return null;
  const groups = [...left, ...Array(hasCompression ? 8 - left.length - right.length : 0).fill('0'), ...right];
  if (groups.length !== 8) return null;
  let numeric = 0n;
  for (const group of groups) numeric = (numeric << 16n) | BigInt(`0x${group}`);
  return { version: 6, bits: 128, numeric, canonical: formatIpv6(numeric) };
}

function formatIpv6(numeric) {
  const groups = [];
  for (let shift = 112n; shift >= 0n; shift -= 16n) groups.push(Number((numeric >> shift) & 0xffffn).toString(16));
  let bestStart = -1;
  let bestLength = 0;
  for (let index = 0; index < groups.length;) {
    if (groups[index] !== '0') { index += 1; continue; }
    let end = index;
    while (end < groups.length && groups[end] === '0') end += 1;
    const length = end - index;
    if (length >= 2 && length > bestLength) { bestStart = index; bestLength = length; }
    index = end;
  }
  if (bestStart < 0) return groups.join(':');
  const left = groups.slice(0, bestStart).join(':');
  const right = groups.slice(bestStart + bestLength).join(':');
  if (!left && !right) return '::';
  if (!left) return `::${right}`;
  if (!right) return `${left}::`;
  return `${left}::${right}`;
}

function parseIp(value) {
  return parseIpv4(value) ?? parseIpv6(value);
}

function parseCanonicalCidr(value) {
  const raw = String(value);
  if ((raw.match(/\//g) ?? []).length !== 1) return null;
  const [address, prefixText] = raw.split('/');
  if (!/^(?:0|[1-9]\d*)$/.test(prefixText)) return null;
  const parsed = parseIp(address);
  if (!parsed) return null;
  const prefix = Number(prefixText);
  if (!Number.isInteger(prefix) || prefix < 0 || prefix > parsed.bits) return null;
  const mask = prefix === 0 ? 0n : ((1n << BigInt(prefix)) - 1n) << BigInt(parsed.bits - prefix);
  if ((parsed.numeric & mask) !== parsed.numeric) return null;
  return `${parsed.canonical}/${prefix}`;
}

function validDomain(value) {
  const raw = String(value).toLowerCase();
  if (!raw.includes('.') || parseIp(raw)) return null;
  let ascii;
  try { ascii = new URL(`http://${raw}/`).hostname.toLowerCase(); } catch { return null; }
  if (!ascii || ascii.length > 253 || !ascii.includes('.') || parseIp(ascii)) return null;
  const labels = ascii.split('.');
  if (labels.some(label => !label || label.length > 63 || !/^[a-z0-9-]+$/i.test(label) || label.startsWith('-') || label.endsWith('-'))) return null;
  return ascii;
}

function validUrl(value) {
  let parsed;
  try { parsed = new URL(value); } catch { return null; }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return null;
  const host = parseIp(parsed.hostname.replace(/^\[|\]$/g, ''))?.canonical ?? validDomain(parsed.hostname);
  if (!host) return null;
  parsed.hostname = host;
  parsed.hash = '';
  return parsed.toString();
}

function validAsn(value) {
  const match = ASN_RE.exec(value);
  if (!match || (match[1].length > 1 && match[1].startsWith('0'))) return null;
  const number = BigInt(match[1]);
  if (number < 1n || number > MAX_ASN) return null;
  return `AS${number}`;
}

export function classifyBrowserObservable(input) {
  if (typeof input !== 'string') throw new TypeError('indicator must be a string');
  if (input.length > MAX_INDICATOR_LENGTH) throw new RangeError('indicator too long');
  const value = input.trim();
  if (!value) throw new TypeError('indicator is required');

  const ip = parseIp(value);
  if (ip) return Object.freeze({ value: ip.canonical, type: 'ip' });
  const cidr = parseCanonicalCidr(value);
  if (cidr) return Object.freeze({ value: cidr, type: 'cidr' });
  const asn = validAsn(value);
  if (asn) return Object.freeze({ value: asn, type: 'asn' });
  if (/^AS/i.test(value)) throw new TypeError('unsupported indicator');
  if (value.includes('/') && !/^https?:\/\//i.test(value)) throw new TypeError('unsupported indicator');
  if (CVE_RE.test(value)) return Object.freeze({ value: value.toUpperCase(), type: 'cve' });
  if (ATTACK_RE.test(value)) return Object.freeze({ value: value.toUpperCase(), type: 'attack' });
  const certificate = CERT_SHA256_RE.exec(value);
  if (certificate) return Object.freeze({ value: `cert-sha256:${certificate[1].toLowerCase()}`, type: 'certificate' });
  if (/^cert-sha256:/i.test(value)) throw new TypeError('unsupported indicator');
  if (HASH_RE.test(value)) return Object.freeze({ value: value.toLowerCase(), type: 'hash' });
  const url = validUrl(value);
  if (url) return Object.freeze({ value: url, type: 'url' });
  const domain = validDomain(value);
  if (domain) return Object.freeze({ value: domain, type: 'domain' });
  throw new TypeError('unsupported indicator');
}

export function validateTypedBrowserObservable(type, input) {
  if (!SUPPORTED_OBSERVABLE_TYPES.includes(type)) throw new TypeError('unsupported observable type');
  const classified = classifyBrowserObservable(type === 'certificate' && /^[a-fA-F0-9]{64}$/.test(String(input).trim()) ? `cert-sha256:${String(input).trim()}` : input);
  if (classified.type !== type) throw new TypeError(`expected ${type} observable`);
  return classified;
}

export function toGatewayIndicator({ type, value } = {}) {
  if (!SUPPORTED_OBSERVABLE_TYPES.includes(type)) throw new TypeError('unsupported observable type');
  if (typeof value !== 'string' || value.length === 0) throw new TypeError('observable value required');
  if (type === 'certificate') return value.startsWith('cert-sha256:') ? value : `cert-sha256:${value}`;
  return value;
}
