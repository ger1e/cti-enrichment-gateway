import { fetchJson } from '../core/fetch-json.js';
import { compact, relation } from './helpers.js';

function normalizedAsn(value) {
  const numeric = Number(value?.asn ?? value);
  return Number.isInteger(numeric) && numeric > 0 ? `AS${numeric}` : null;
}

export const ripestatProvider = Object.freeze({
  name: 'ripestat', types: ['ip', 'asn', 'cidr'], cacheTtlMs: 86400000, negativeCacheTtlMs: 3600000, costClass: 'free', timeoutMs: 5000, parserVersion: '2026-08-21.2',
  async run(input, context = {}) {
    if (input.type === 'asn') {
      const url = `https://stat.ripe.net/data/as-overview/data.json?resource=${encodeURIComponent(input.value)}`;
      const raw = await fetchJson(url, context); const d = raw?.data ?? {};
      return {
        observationType: 'routing', verdict: 'unknown',
        attributes: {
          asn: input.value,
          announced: d.announced === true,
          holder: d.holder ?? null,
          block: d.block && typeof d.block === 'object' ? { resource: d.block.resource ?? null, name: d.block.name ?? null, desc: d.block.desc ?? null } : null,
        },
        relationships: [],
        references: ['https://stat.ripe.net/docs/data-api/api-endpoints/as-overview'],
      };
    }

    if (input.type === 'cidr') {
      const url = `https://stat.ripe.net/data/prefix-overview/data.json?resource=${encodeURIComponent(input.value)}&max_related=10`;
      const raw = await fetchJson(url, context); const d = raw?.data ?? {};
      const rows = Array.isArray(d.asns) ? d.asns.slice(0, 20) : [];
      const asns = compact(rows.map(normalizedAsn));
      return {
        observationType: 'routing', verdict: 'unknown',
        attributes: {
          cidr: input.value,
          resource: d.resource ?? null,
          announced: d.announced === true,
          isLessSpecific: d.is_less_specific === true,
          asns,
          holders: compact(rows.map(row => row?.holder)).slice(0, 20),
          relatedPrefixCount: Number.isFinite(Number(d.actual_num_related)) ? Number(d.actual_num_related) : null,
          returnedRelatedPrefixes: Array.isArray(d.related_prefixes) ? d.related_prefixes.slice(0, 10) : [],
        },
        relationships: compact(asns.map(asn => relation('asn', asn, 'origin_asn'))),
        references: ['https://stat.ripe.net/docs/data-api/api-endpoints/prefix-overview'],
      };
    }

    const url = `https://stat.ripe.net/data/network-info/data.json?resource=${encodeURIComponent(input.value)}`;
    const raw = await fetchJson(url, context); const d = raw?.data ?? {}; const asns = Array.isArray(d.asns) ? d.asns : [];
    return { observationType: 'routing', verdict: 'unknown', attributes: { ip: input.value, asn: asns[0] != null ? `AS${asns[0]}` : null, prefix: d.prefix ?? null, asns }, relationships: compact(asns.map(a => relation('asn', `AS${a}`, 'origin_asn'))), references: ['https://stat.ripe.net/docs/data-api/api-endpoints/network-info'] };
  },
});
