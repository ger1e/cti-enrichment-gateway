import { fetchJson } from '../core/fetch-json.js';
import { compact, relation, requireEnv } from './helpers.js';
export const urlhausProvider = Object.freeze({
  name: 'urlhaus', types: ['url'], methods: ['POST'], requiredEnv: 'ABUSECH_API_KEY', cacheTtlMs: 3600000, negativeCacheTtlMs: 1800000, costClass: 'free', timeoutMs: 7000, parserVersion: '2026-08-20',
  async run(input, context = {}) {
    const key = requireEnv(context, 'ABUSECH_API_KEY'); const body = new URLSearchParams({ url: input.value }).toString();
    const raw = await fetchJson('https://urlhaus-api.abuse.ch/v1/url/', { ...context, method: 'POST', headers: { 'Auth-Key': key, 'Content-Type': 'application/x-www-form-urlencoded' }, body, maxBytes: 3_000_000 }); const payloads = Array.isArray(raw?.payloads) ? raw.payloads : [];
    return { observationType: 'malware_distribution', verdict: raw?.query_status === 'ok' ? 'associated' : 'no_association', firstSeen: raw?.date_added ?? null, lastSeen: raw?.last_online ?? null, tags: compact(raw?.tags), attributes: { urlStatus: raw?.url_status ?? null, threat: raw?.threat ?? null, queryStatus: raw?.query_status ?? null, payloadCount: payloads.length }, relationships: compact(payloads.map(p => relation('hash', p?.response_sha256 ?? p?.sha256_hash, 'payload_sha256'))), references: ['https://urlhaus.abuse.ch/'] };
  },
});
