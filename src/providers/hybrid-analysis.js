import { fetchJson } from '../core/fetch-json.js';
import { compact, relation, requireEnv } from './helpers.js';
export const hybridAnalysisProvider = Object.freeze({
  name: 'hybrid-analysis', types: ['hash'], requiredEnv: 'HYBRID_ANALYSIS_API_KEY', cacheTtlMs: 86400000, negativeCacheTtlMs: 3600000, costClass: 'scarce', timeoutMs: 10000, parserVersion: 'v2.38.0',
  async run(input, context = {}) {
    const key = requireEnv(context, 'HYBRID_ANALYSIS_API_KEY'); const raw = await fetchJson(`https://www.hybrid-analysis.com/api/v2/search/hash?hash=${encodeURIComponent(input.value)}`, { ...context, headers: { 'api-key': key, 'User-Agent': 'Falcon Sandbox' }, maxBytes: 3_000_000 });
    const reports = Array.isArray(raw?.reports) ? raw.reports : []; const verdicts = reports.map(r => String(r?.verdict ?? '').toLowerCase()); const verdict = verdicts.includes('malicious') ? 'malicious' : verdicts.includes('suspicious') ? 'suspicious' : reports.length ? 'observed' : 'no_result';
    return { observationType: 'sandbox_report_index', verdict, attributes: { reportCount: reports.length, reports: reports.slice(0, 20).map(r => ({ id: r?.id ?? null, environmentId: r?.environment_id ?? null, state: r?.state ?? null, verdict: r?.verdict ?? null })) }, relationships: compact((Array.isArray(raw?.sha256s) ? raw.sha256s : []).map(h => relation('hash', h, 'related_sha256'))), references: ['https://hybrid-analysis.com/'] };
  },
});
