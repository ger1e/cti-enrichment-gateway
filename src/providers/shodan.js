import { fetchJson } from '../core/fetch-json.js';
import { compact, relation, requireEnv } from './helpers.js';
export const shodanProvider = Object.freeze({
  name: 'shodan', types: ['ip'], requiredEnv: 'SHODAN_API_KEY', cacheTtlMs: 86400000, negativeCacheTtlMs: 21600000, costClass: 'scarce', timeoutMs: 7000, parserVersion: '2026-08-20',
  async run(input, context = {}) {
    const key = requireEnv(context, 'SHODAN_API_KEY'); const url = `https://api.shodan.io/shodan/host/${encodeURIComponent(input.value)}?key=${encodeURIComponent(key)}&minify=false`;
    const raw = await fetchJson(url, { ...context, maxBytes: 3_000_000 }); const hosts = Array.isArray(raw?.hostnames) ? raw.hostnames : [];
    const rels = hosts.map(x => relation('domain', x, 'hostname')); if (raw?.asn) rels.push(relation('asn', raw.asn, 'asn'));
    return { observationType: 'internet_exposure', verdict: 'observed', lastSeen: raw?.last_update ?? null, tags: compact(raw?.tags), attributes: { ip: raw?.ip_str ?? input.value, asn: raw?.asn ?? null, organization: raw?.org ?? null, country: raw?.country_code ?? null, hostnames: hosts, ports: Array.isArray(raw?.ports) ? raw.ports : [], serviceCount: Array.isArray(raw?.data) ? raw.data.length : 0 }, relationships: compact(rels), references: [`https://www.shodan.io/host/${encodeURIComponent(input.value)}`] };
  },
});
