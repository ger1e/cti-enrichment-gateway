import { fetchJson } from '../core/fetch-json.js';
import { compact, relation, requireEnv } from './helpers.js';
export const webamonProvider = Object.freeze({
  name: 'webamon', types: ['ip', 'domain', 'url', 'hash'], requiredEnv: 'WEBAMON_API_KEY', cacheTtlMs: 21600000, negativeCacheTtlMs: 3600000, costClass: 'free', timeoutMs: 7000, parserVersion: '2026-08-20',
  async run(input, context = {}) {
    const key = requireEnv(context, 'WEBAMON_API_KEY'); const url = `https://pro.webamon.com/search?search=${encodeURIComponent(input.value)}&size=25`;
    const raw = await fetchJson(url, { ...context, headers: { 'x-api-key': key }, maxBytes: 3_000_000 }); const rows = Array.isArray(raw?.results) ? raw.results : Array.isArray(raw?.data) ? raw.data : Array.isArray(raw?.hits) ? raw.hits : [];
    const rels = []; for (const r of rows) { if (r?.ip) rels.push(relation('ip', r.ip, 'observed_ip')); if (r?.domain) rels.push(relation('domain', r.domain, 'observed_domain')); if (r?.url) rels.push(relation('url', r.url, 'observed_url')); }
    return { observationType: 'web_intelligence', verdict: rows.length ? 'observed' : 'no_result', attributes: { resultCount: raw?.total ?? raw?.count ?? rows.length }, relationships: compact(rels), references: ['https://webamon.com/'] };
  },
});
