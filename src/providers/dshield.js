import { fetchJson } from '../core/fetch-json.js';

function numberOrZero(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export const dshieldProvider = Object.freeze({
  name: 'dshield', types: ['ip'], cacheTtlMs: 60 * 60 * 1000, negativeCacheTtlMs: 30 * 60 * 1000, costClass: 'free', timeoutMs: 5000, parserVersion: '2026-08-20',
  async run(input, context = {}) {
    const url = `https://isc.sans.edu/api/ip/${encodeURIComponent(input.value)}?json`;
    const raw = await fetchJson(url, { ...context, maxBytes: 1_000_000 });
    const item = raw?.ip && typeof raw.ip === 'object' ? raw.ip : raw ?? {};
    const attacks = numberOrZero(item.attacks);
    const reports = numberOrZero(item.count);
    return {
      observationType: 'scanner_activity',
      verdict: attacks > 0 || reports > 0 ? 'observed' : 'not_observed',
      firstSeen: item.mindate ?? null,
      lastSeen: item.maxdate ?? null,
      attributes: {
        attacks,
        reports,
        asn: item.as ?? item.asn ?? null,
        asName: item.asname ?? null,
        country: item.country ?? null,
        network: item.network ?? null,
      },
      relationships: [],
      references: [url],
    };
  },
});
