import { fetchJson } from '../core/fetch-json.js';
import { compact, relation } from './helpers.js';

export const rdapProvider = Object.freeze({
  name: 'rdap', types: ['ip', 'domain'], cacheTtlMs: 7 * 24 * 60 * 60 * 1000, negativeCacheTtlMs: 60 * 60 * 1000, costClass: 'free', timeoutMs: 5000, parserVersion: '2026-08-20',
  async run(input, context = {}) {
    const resource = input.type === 'domain' ? 'domain' : 'ip'; const url = `https://rdap.org/${resource}/${encodeURIComponent(input.value)}`;
    const raw = await fetchJson(url, { ...context, maxBytes: 2_000_000 });
    if (input.type === 'domain') {
      const nameservers = Array.isArray(raw?.nameservers) ? raw.nameservers : [];
      return { observationType: 'registration', verdict: 'unknown', attributes: { domain: raw?.ldhName?.toLowerCase() ?? input.value, handle: raw?.handle ?? null, unicodeName: raw?.unicodeName ?? null, status: Array.isArray(raw?.status) ? raw.status : [] }, relationships: compact(nameservers.map(n => relation('domain', n?.ldhName, 'nameserver'))), references: [url] };
    }
    return { observationType: 'registration', verdict: 'unknown', attributes: { handle: raw?.handle ?? null, name: raw?.name ?? null, country: raw?.country ?? null, startAddress: raw?.startAddress ?? null, endAddress: raw?.endAddress ?? null }, relationships: [], references: [url] };
  },
});
