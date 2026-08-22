import { fetchJson } from '../core/fetch-json.js';
import { cidrContains, formatIp, parseCanonicalCidr, parseIp } from '../core/network.js';

const BOOTSTRAP_TTL_MS = 24 * 60 * 60 * 1000;
const DEFAULT_BOOTSTRAP_CACHE = new Map();
const ALLOWED_RIR_BASES = new Set([
  'https://rdap.afrinic.net/rdap/',
  'https://rdap.apnic.net/',
  'https://rdap.arin.net/registry/',
  'https://rdap.db.ripe.net/',
  'https://rdap.lacnic.net/rdap/',
]);

function bootstrapUrl(input) {
  if (input.type === 'asn') return 'https://data.iana.org/rdap/asn.json';
  if (input.type === 'ip') return `https://data.iana.org/rdap/${parseIp(input.value)?.version === 6 ? 'ipv6' : 'ipv4'}.json`;
  if (input.type === 'cidr') return `https://data.iana.org/rdap/${parseCanonicalCidr(input.value)?.version === 6 ? 'ipv6' : 'ipv4'}.json`;
  throw Object.assign(new Error('unsupported RDAP indicator type'), { status: 400 });
}

function validBootstrap(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.services)) {
    throw Object.assign(new Error('rdap_invalid_bootstrap'), { status: 502 });
  }
  return raw;
}

async function loadBootstrap(input, context) {
  const url = bootstrapUrl(input);
  const store = context.feedCache ?? DEFAULT_BOOTSTRAP_CACHE;
  const now = typeof context.nowMs === 'function' ? context.nowMs() : Date.now();
  const key = `rdap-bootstrap:${url}`;
  if (store && typeof store.getOrLoad === 'function') {
    const value = await store.getOrLoad(key, () => fetchJson(url, { ...context, maxBytes: 256_000 }), {
      namespace: 'rdap-bootstrap', ttlMs: BOOTSTRAP_TTL_MS, cache: true,
    });
    return { raw: validBootstrap(value), url };
  }
  const cached = store?.get?.(key);
  if (cached?.expiresAt > now) return { raw: cached.value, url };
  const raw = validBootstrap(await fetchJson(url, { ...context, maxBytes: 256_000 }));
  store?.set?.(key, { value: raw, expiresAt: now + BOOTSTRAP_TTL_MS });
  return { raw, url };
}

function httpsRirBase(urls) {
  for (const value of Array.isArray(urls) ? urls : []) {
    try {
      const parsed = new URL(value);
      parsed.hash = '';
      parsed.search = '';
      if (parsed.protocol !== 'https:') continue;
      const normalized = parsed.href.endsWith('/') ? parsed.href : `${parsed.href}/`;
      if (ALLOWED_RIR_BASES.has(normalized)) return normalized;
    } catch {}
  }
  return null;
}

function ipQueryCidr(input) {
  if (input.type === 'cidr') return parseCanonicalCidr(input.value);
  const parsed = parseIp(input.value);
  if (!parsed) return null;
  return parseCanonicalCidr(`${formatIp(parsed)}/${parsed.bits}`);
}

function ipRirBase(bootstrap, input) {
  const query = ipQueryCidr(input);
  if (!query) throw Object.assign(new Error('invalid RDAP IP input'), { status: 400 });
  let best = null;
  for (const service of bootstrap.services) {
    if (!Array.isArray(service) || service.length < 2) continue;
    const base = httpsRirBase(service[1]);
    if (!base) continue;
    for (const prefix of Array.isArray(service[0]) ? service[0] : []) {
      const parsed = parseCanonicalCidr(String(prefix));
      if (!parsed || parsed.version !== query.version || !cidrContains(parsed, query)) continue;
      if (!best || parsed.prefix > best.prefix) best = { prefix: parsed.prefix, base };
    }
  }
  return best?.base ?? null;
}

function asnNumber(value) {
  const text = String(value ?? '').toUpperCase().replace(/^AS/, '');
  if (!/^\d+$/.test(text)) return null;
  const number = Number(text);
  return Number.isSafeInteger(number) && number > 0 && number <= 4294967295 ? number : null;
}

function asnRirBase(bootstrap, value) {
  const number = asnNumber(value);
  if (number == null) throw Object.assign(new Error('invalid RDAP ASN input'), { status: 400 });
  for (const service of bootstrap.services) {
    if (!Array.isArray(service) || service.length < 2) continue;
    const base = httpsRirBase(service[1]);
    if (!base) continue;
    for (const range of Array.isArray(service[0]) ? service[0] : []) {
      const match = String(range).match(/^(\d+)(?:-(\d+))?$/);
      if (!match) continue;
      const start = Number(match[1]);
      const end = Number(match[2] ?? match[1]);
      if (number >= start && number <= end) return base;
    }
  }
  return null;
}

function authoritativeUrl(base, input) {
  if (input.type === 'asn') return `${base}autnum/${asnNumber(input.value)}`;
  return `${base}ip/${input.value}`;
}

function noResult(input, references) {
  return {
    observationType: 'registration', verdict: 'no_result',
    attributes: input.type === 'asn'
      ? { asn: input.value, handle: null, name: null, country: null, startAutnum: null, endAutnum: null, status: [] }
      : { ...(input.type === 'cidr' ? { cidr: input.value } : { ip: input.value }), handle: null, name: null, country: null, startAddress: null, endAddress: null, cidr0: [] },
    relationships: [], references,
  };
}

export const rdapProvider = Object.freeze({
  name: 'rdap',
  types: ['ip', 'asn', 'cidr'],
  cacheTtlMs: 7 * 24 * 60 * 60 * 1000,
  negativeCacheTtlMs: 60 * 60 * 1000,
  costClass: 'free',
  timeoutMs: 5000,
  parserVersion: '2026-08-22.1',
  async run(input, context = {}) {
    const { raw: bootstrap, url: bootstrapReference } = await loadBootstrap(input, context);
    const base = input.type === 'asn' ? asnRirBase(bootstrap, input.value) : ipRirBase(bootstrap, input);
    if (!base) return noResult(input, [bootstrapReference]);
    const url = authoritativeUrl(base, input);
    let raw;
    try {
      raw = await fetchJson(url, { ...context, maxBytes: 2_000_000 });
    } catch (error) {
      if (error?.status === 404) return noResult(input, [bootstrapReference, url]);
      throw error;
    }

    if (input.type === 'asn') {
      return {
        observationType: 'registration', verdict: 'unknown',
        attributes: {
          asn: input.value,
          handle: raw?.handle ?? null,
          name: raw?.name ?? null,
          country: raw?.country ?? null,
          startAutnum: Number.isFinite(Number(raw?.startAutnum)) ? Number(raw.startAutnum) : null,
          endAutnum: Number.isFinite(Number(raw?.endAutnum)) ? Number(raw.endAutnum) : null,
          status: Array.isArray(raw?.status) ? raw.status : [],
        },
        relationships: [], references: [bootstrapReference, url],
      };
    }

    return {
      observationType: 'registration', verdict: 'unknown',
      attributes: {
        ...(input.type === 'cidr' ? { cidr: input.value } : { ip: input.value }),
        handle: raw?.handle ?? null,
        name: raw?.name ?? null,
        country: raw?.country ?? null,
        startAddress: raw?.startAddress ?? null,
        endAddress: raw?.endAddress ?? null,
        cidr0: Array.isArray(raw?.cidr0_cidrs) ? raw.cidr0_cidrs.slice(0, 20) : [],
      },
      relationships: [], references: [bootstrapReference, url],
    };
  },
});
