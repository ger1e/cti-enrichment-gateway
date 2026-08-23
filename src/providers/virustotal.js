import { fetchJson } from '../core/fetch-json.js';
import { compact, isoFromUnix, requireEnv, vtVerdict } from './helpers.js';

const COVERAGE_OBSERVATION_TYPES = Object.freeze({
  ip: Object.freeze(['multi_engine_reputation']),
  domain: Object.freeze(['multi_engine_reputation']),
  url: Object.freeze(['multi_engine_reputation']),
  hash: Object.freeze(['multi_engine_reputation']),
});

function vtPath(input) {
  if (input.type === 'ip') return `ip_addresses/${encodeURIComponent(input.value)}`;
  if (input.type === 'domain') return `domains/${encodeURIComponent(input.value)}`;
  if (input.type === 'hash') return `files/${encodeURIComponent(input.value)}`;
  if (input.type === 'url') return `urls/${Buffer.from(input.value).toString('base64url').replace(/=+$/, '')}`;
  throw Object.assign(new Error('unsupported indicator type'), { status: 400 });
}

function noResult() {
  return {
    observationType: 'multi_engine_reputation',
    verdict: 'no_result',
    lastSeen: null,
    tags: [],
    attributes: {
      reputation: null,
      lastAnalysisStats: {},
      typeDescription: null,
      meaningfulName: null,
    },
    relationships: [],
    references: ['https://www.virustotal.com/gui/home/search'],
  };
}

export const virustotalProvider = Object.freeze({
  name: 'virustotal', types: ['ip', 'domain', 'url', 'hash'], requiredEnv: 'VIRUSTOTAL_API_KEY', cacheTtlMs: 21600000, negativeCacheTtlMs: 3600000, costClass: 'scarce', timeoutMs: 7000, parserVersion: 'v3-2026-08-22.1',
  coverageObservationTypesByType: COVERAGE_OBSERVATION_TYPES,
  async run(input, context = {}) {
    const key = requireEnv(context, 'VIRUSTOTAL_API_KEY');
    let raw;
    try {
      raw = await fetchJson(`https://www.virustotal.com/api/v3/${vtPath(input)}`, {
        ...context,
        headers: { 'x-apikey': key },
        maxBytes: 3_000_000,
      });
    } catch (error) {
      if (error?.status === 404) return noResult();
      throw error;
    }
    const a = raw?.data?.attributes ?? {};
    const stats = a.last_analysis_stats ?? {};
    return {
      observationType: 'multi_engine_reputation',
      verdict: vtVerdict(stats),
      lastSeen: isoFromUnix(a.last_analysis_date),
      tags: compact(a.tags),
      attributes: {
        reputation: a.reputation ?? null,
        lastAnalysisStats: stats,
        typeDescription: a.type_description ?? null,
        meaningfulName: a.meaningful_name ?? null,
      },
      relationships: [],
      references: ['https://www.virustotal.com/gui/home/search'],
    };
  },
});
