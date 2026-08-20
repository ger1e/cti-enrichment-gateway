import { fetchJson } from '../core/fetch-json.js';
import { compact, relation } from './helpers.js';
export const ripestatProvider = Object.freeze({
  name: 'ripestat', types: ['ip'], cacheTtlMs: 86400000, negativeCacheTtlMs: 3600000, costClass: 'free', timeoutMs: 5000, parserVersion: '2026-08-20',
  async run(input, context = {}) {
    const url = `https://stat.ripe.net/data/network-info/data.json?resource=${encodeURIComponent(input.value)}`;
    const raw = await fetchJson(url, context); const d = raw?.data ?? {}; const asns = Array.isArray(d.asns) ? d.asns : [];
    return { observationType: 'routing', verdict: 'unknown', attributes: { ip: input.value, asn: asns[0] != null ? `AS${asns[0]}` : null, prefix: d.prefix ?? null, asns }, relationships: compact(asns.map(a => relation('asn', `AS${a}`, 'origin_asn'))), references: ['https://stat.ripe.net/docs/data-api/api-endpoints/network-info'] };
  },
});
