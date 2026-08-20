import { fetchJson } from '../core/fetch-json.js';
import { compact, relation, requireEnv } from './helpers.js';
function query(input) { if (input.type === 'ip') return `ip:${input.value}`; if (input.type === 'domain') return `domain:${input.value}`; if (input.type === 'url') return `page.url:${JSON.stringify(input.value)}`; throw Object.assign(new Error('unsupported indicator type'), { status: 400 }); }
export const urlscanProvider = Object.freeze({
  name: 'urlscan', types: ['ip', 'domain', 'url'], requiredEnv: 'URLSCAN_API_KEY', cacheTtlMs: 21600000, negativeCacheTtlMs: 3600000, costClass: 'free', timeoutMs: 7000, parserVersion: '2026-08-20',
  async run(input, context = {}) {
    const key = requireEnv(context, 'URLSCAN_API_KEY'); const url = `https://urlscan.io/api/v1/search?q=${encodeURIComponent(query(input))}&size=25`;
    const raw = await fetchJson(url, { ...context, headers: { 'api-key': key }, maxBytes: 3_000_000 }); const rows = Array.isArray(raw?.results) ? raw.results : []; const malicious = rows.some(r => r?.verdicts?.overall?.malicious === true);
    const rels = []; for (const r of rows) { if (r?.page?.ip) rels.push(relation('ip', r.page.ip, 'resolved_ip')); if (r?.page?.domain) rels.push(relation('domain', r.page.domain, 'observed_domain')); if (r?.page?.url) rels.push(relation('url', r.page.url, 'observed_url')); }
    return { observationType: 'web_observation', verdict: malicious ? 'malicious' : rows.length ? 'observed' : 'no_result', firstSeen: rows.at(-1)?.indexedAt ?? null, lastSeen: rows[0]?.indexedAt ?? null, attributes: { resultCount: rows.length }, relationships: compact(rels), references: ['https://urlscan.io/search/'] };
  },
});
