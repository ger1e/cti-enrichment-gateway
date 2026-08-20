import { fetchJson } from '../core/fetch-json.js';
import { compact, envValue, firstCvss, firstEnglish } from './helpers.js';
export const nvdProvider = Object.freeze({
  name: 'nvd', types: ['cve'], optionalEnv: 'NVD_API_KEY', cacheTtlMs: 86400000, negativeCacheTtlMs: 21600000, costClass: 'free', timeoutMs: 7000, parserVersion: '2.0-2026-08-20',
  async run(input, context = {}) {
    const key = envValue(context, 'NVD_API_KEY'); const headers = {}; if (key) headers.apiKey = key;
    const raw = await fetchJson(`https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${encodeURIComponent(input.value)}`, { ...context, headers, maxBytes: 3_000_000 }); const cve = raw?.vulnerabilities?.[0]?.cve; const cvss = firstCvss(cve?.metrics);
    return { observationType: 'vulnerability_metadata', verdict: cve ? 'cataloged' : 'no_result', firstSeen: cve?.published ?? null, lastSeen: cve?.lastModified ?? null, tags: compact(cve?.cveTags?.flatMap?.(x => x?.tags) ?? []), attributes: { id: cve?.id ?? input.value, description: firstEnglish(cve?.descriptions), cvss, sourceIdentifier: cve?.sourceIdentifier ?? null }, relationships: [], references: [`https://nvd.nist.gov/vuln/detail/${encodeURIComponent(input.value)}`] };
  },
});
