import { fetchJson } from '../core/fetch-json.js';
import { compact, relation } from './helpers.js';
export const osvProvider = Object.freeze({
  name: 'osv', types: ['cve'], cacheTtlMs: 86400000, negativeCacheTtlMs: 21600000, costClass: 'free', timeoutMs: 5000, parserVersion: '2026-08-20',
  async run(input, context = {}) {
    const url = `https://api.osv.dev/v1/vulns/${encodeURIComponent(input.value)}`; let raw;
    try { raw = await fetchJson(url, { ...context, maxBytes: 2_000_000 }); }
    catch (error) { if (error?.status === 404) return { observationType: 'open_source_vulnerability', verdict: 'no_result', attributes: { id: input.value }, relationships: [], references: [`https://osv.dev/vulnerability/${encodeURIComponent(input.value)}`] }; throw error; }
    const aliases = Array.isArray(raw?.aliases) ? raw.aliases : [];
    return { observationType: 'open_source_vulnerability', verdict: 'cataloged', firstSeen: raw?.published ?? null, lastSeen: raw?.modified ?? null, attributes: { id: raw?.id ?? input.value, summary: raw?.summary ?? null, affectedCount: Array.isArray(raw?.affected) ? raw.affected.length : 0 }, relationships: compact(aliases.map(a => relation('cve', a, 'alias'))), references: [`https://osv.dev/vulnerability/${encodeURIComponent(raw?.id ?? input.value)}`] };
  },
});
