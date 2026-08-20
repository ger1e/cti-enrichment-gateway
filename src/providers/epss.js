import { fetchJson } from '../core/fetch-json.js';

export const epssProvider = Object.freeze({
  name: 'epss',
  types: ['cve'],
  cacheTtlMs: 24 * 60 * 60 * 1000,
  negativeCacheTtlMs: 60 * 60 * 1000,
  costClass: 'free',
  timeoutMs: 5000,
  parserVersion: '1',
  async run(input, { signal, fetchImpl = fetch } = {}) {
    const url = `https://api.first.org/data/v1/epss?cve=${encodeURIComponent(input.value)}`;
    const raw = await fetchJson(url, { fetchImpl, signal, maxBytes: 1_000_000 });
    const row = Array.isArray(raw.data) ? raw.data.find(item => item.cve === input.value) : null;
    return {
      observationType: 'exploit_probability',
      verdict: row ? 'scored' : 'not_found',
      attributes: {
        epss: row ? Number(row.epss) : null,
        percentile: row ? Number(row.percentile) : null,
        date: row?.date ?? null,
      },
      references: [url],
    };
  },
});
