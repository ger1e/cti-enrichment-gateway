import { fetchJson } from '../core/fetch-json.js';

export const rdapProvider = Object.freeze({
  name: 'rdap',
  types: ['ip'],
  cacheTtlMs: 7 * 24 * 60 * 60 * 1000,
  negativeCacheTtlMs: 60 * 60 * 1000,
  costClass: 'free',
  timeoutMs: 5000,
  parserVersion: '1',
  async run(input, { signal, fetchImpl = fetch } = {}) {
    const url = `https://rdap.org/ip/${encodeURIComponent(input.value)}`;
    const raw = await fetchJson(url, { fetchImpl, signal, maxBytes: 1_000_000 });
    return {
      observationType: 'registration',
      verdict: 'unknown',
      attributes: {
        handle: raw.handle ?? null,
        name: raw.name ?? null,
        country: raw.country ?? null,
        startAddress: raw.startAddress ?? null,
        endAddress: raw.endAddress ?? null,
      },
      references: [url],
    };
  },
});
