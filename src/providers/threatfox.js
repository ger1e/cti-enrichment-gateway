import { fetchJson } from '../core/fetch-json.js';
import { compact, relation, requireEnv } from './helpers.js';
export const threatfoxProvider = Object.freeze({
  name: 'threatfox', types: ['ip', 'domain', 'url', 'hash'], requiredEnv: 'ABUSECH_API_KEY', cacheTtlMs: 3600000, negativeCacheTtlMs: 1800000, costClass: 'free', timeoutMs: 7000, parserVersion: '2026-08-20',
  async run(input, context = {}) {
    const key = requireEnv(context, 'ABUSECH_API_KEY'); const body = input.type === 'hash' ? { query: 'search_hash', hash: input.value } : { query: 'search_ioc', search_term: input.value, exact_match: true };
    const raw = await fetchJson('https://threatfox-api.abuse.ch/api/v1/', { ...context, method: 'POST', headers: { 'Auth-Key': key, 'Content-Type': 'application/json' }, body: JSON.stringify(body), maxBytes: 3_000_000 });
    const rows = Array.isArray(raw?.data) ? raw.data : []; const first = rows[0] ?? {};
    const rels = rows.map(r => relation(r?.ioc_type?.includes('ip') ? 'ip' : r?.ioc_type?.includes('domain') ? 'domain' : r?.ioc_type?.includes('url') ? 'url' : null, r?.ioc, 'threatfox_ioc')).filter(x => x?.targetType);
    return { observationType: 'threat_intelligence', verdict: rows.length ? 'associated' : 'no_association', confidence: Number.isFinite(Number(first?.confidence_level)) ? Number(first.confidence_level) : null, firstSeen: first?.first_seen ?? null, lastSeen: first?.last_seen ?? null, tags: compact(rows.flatMap(r => Array.isArray(r?.tags) ? r.tags : [])), malwareFamily: first?.malware_printable ?? first?.malware ?? null, attributes: { queryStatus: raw?.query_status ?? null, threatType: first?.threat_type ?? null, resultCount: rows.length }, relationships: rels, references: ['https://threatfox.abuse.ch/'] };
  },
});
