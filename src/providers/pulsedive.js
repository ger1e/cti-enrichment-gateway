import { fetchJson } from '../core/fetch-json.js';
import { compact, relation, requireEnv, riskVerdict } from './helpers.js';
export const pulsediveProvider = Object.freeze({
  name: 'pulsedive', types: ['ip', 'domain', 'url', 'hash'], requiredEnv: 'PULSEDIVE_API_KEY', cacheTtlMs: 21600000, negativeCacheTtlMs: 3600000, costClass: 'free', timeoutMs: 7000, parserVersion: '2026-08-20',
  async run(input, context = {}) {
    const key = requireEnv(context, 'PULSEDIVE_API_KEY'); const params = new URLSearchParams({ indicator: input.value, pretty: '1', key });
    const raw = await fetchJson(`https://pulsedive.com/api/indicator.php?${params}`, { ...context, maxBytes: 3_000_000 }); const threats = Array.isArray(raw?.threats) ? raw.threats : [];
    return { observationType: 'threat_intelligence', verdict: riskVerdict(raw?.risk), firstSeen: raw?.stamp_added ?? null, lastSeen: raw?.stamp_updated ?? null, tags: compact(raw?.tags), attributes: { risk: raw?.risk ?? null, indicatorType: raw?.type ?? null, threatNames: threats.map(x => x?.name).filter(Boolean).slice(0, 25) }, relationships: compact(threats.map(t => relation('malware', t?.name, 'threat_association'))), references: ['https://pulsedive.com/api/indicator.php'] };
  },
});
