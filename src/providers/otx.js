import { fetchJson } from '../core/fetch-json.js';
import { compact, requireEnv } from './helpers.js';
function slug(type, value) { if (type === 'ip') return value.includes(':') ? 'IPv6' : 'IPv4'; if (type === 'hash') return 'file'; if (type === 'cve') return 'CVE'; if (type === 'domain') return 'domain'; if (type === 'url') return 'url'; throw Object.assign(new Error('unsupported indicator type'), { status: 400 }); }
export const otxProvider = Object.freeze({
  name: 'otx', types: ['ip', 'domain', 'url', 'hash', 'cve'], requiredEnv: 'OTX_API_KEY', cacheTtlMs: 21600000, negativeCacheTtlMs: 3600000, costClass: 'free', timeoutMs: 7000, parserVersion: '2026-08-20',
  async run(input, context = {}) {
    const key = requireEnv(context, 'OTX_API_KEY'); const type = slug(input.type, input.value); const url = `https://otx.alienvault.com/api/v1/indicators/${type}/${encodeURIComponent(input.value)}/general`;
    const raw = await fetchJson(url, { ...context, headers: { 'X-OTX-API-KEY': key }, maxBytes: 3_000_000 }); const pulses = Array.isArray(raw?.pulse_info?.pulses) ? raw.pulse_info.pulses : [];
    return { observationType: 'community_intelligence', verdict: (raw?.pulse_info?.count ?? pulses.length) > 0 ? 'associated' : 'no_association', tags: compact(pulses.flatMap(p => Array.isArray(p?.tags) ? p.tags : [])), attributes: { pulseCount: raw?.pulse_info?.count ?? pulses.length, reputation: raw?.reputation ?? null, pulseNames: pulses.slice(0, 25).map(p => p?.name).filter(Boolean) }, relationships: [], references: [`https://otx.alienvault.com/indicator/${type}/${encodeURIComponent(input.value)}`] };
  },
});
