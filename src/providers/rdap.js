import { fetchJson } from '../core/fetch-json.js';
import { compact, relation } from './helpers.js';

function rdapUrl(input) {
  if (input.type === 'domain') return `https://rdap.org/domain/${encodeURIComponent(input.value)}`;
  if (input.type === 'asn') return `https://rdap.org/autnum/${input.value.slice(2)}`;
  if (input.type === 'cidr') return `https://rdap.org/ip/${input.value}`;
  return `https://rdap.org/ip/${encodeURIComponent(input.value)}`;
}

export const rdapProvider = Object.freeze({
  name: 'rdap', types: ['ip', 'domain', 'asn', 'cidr'], cacheTtlMs: 7 * 24 * 60 * 60 * 1000, negativeCacheTtlMs: 60 * 60 * 1000, costClass: 'free', timeoutMs: 5000, parserVersion: '2026-08-21.2',
  async run(input, context = {}) {
    const url = rdapUrl(input);
    const raw = await fetchJson(url, { ...context, maxBytes: 2_000_000 });
    if (input.type === 'domain') {
      const nameservers = Array.isArray(raw?.nameservers) ? raw.nameservers : [];
      return { observationType: 'registration', verdict: 'unknown', attributes: { domain: raw?.ldhName?.toLowerCase() ?? input.value, handle: raw?.handle ?? null, unicodeName: raw?.unicodeName ?? null, status: Array.isArray(raw?.status) ? raw.status : [] }, relationships: compact(nameservers.map(n => relation('domain', n?.ldhName, 'nameserver'))), references: [url] };
    }
    if (input.type === 'asn') {
      return {
        observationType: 'registration', verdict: 'unknown',
        attributes: {
          asn: input.value, handle: raw?.handle ?? null, name: raw?.name ?? null, country: raw?.country ?? null,
          startAutnum: Number.isFinite(Number(raw?.startAutnum)) ? Number(raw.startAutnum) : null,
          endAutnum: Number.isFinite(Number(raw?.endAutnum)) ? Number(raw.endAutnum) : null,
          status: Array.isArray(raw?.status) ? raw.status : [],
        },
        relationships: [], references: [url],
      };
    }
    return {
      observationType: 'registration', verdict: 'unknown',
      attributes: {
        ...(input.type === 'cidr' ? { cidr: input.value } : { ip: input.value }),
        handle: raw?.handle ?? null, name: raw?.name ?? null, country: raw?.country ?? null,
        startAddress: raw?.startAddress ?? null, endAddress: raw?.endAddress ?? null,
        cidr0: Array.isArray(raw?.cidr0_cidrs) ? raw.cidr0_cidrs.slice(0, 20) : [],
      },
      relationships: [], references: [url],
    };
  },
});
