import { loadTextFeed } from './public-feed.js';

export const torExitProvider = Object.freeze({
  name: 'tor-exit', types: ['ip'], cacheTtlMs: 30 * 60 * 1000, negativeCacheTtlMs: 15 * 60 * 1000, costClass: 'free', timeoutMs: 5000, parserVersion: '2026-08-20',
  async run(input, context = {}) {
    const url = 'https://check.torproject.org/torbulkexitlist';
    const text = await loadTextFeed(url, context, { ttlMs: 30 * 60 * 1000, maxBytes: 1_000_000 });
    const exits = new Set(String(text).split(/\r?\n/).map(x => x.trim()).filter(Boolean));
    const listed = exits.has(input.value);
    return {
      observationType: 'tor_exit',
      verdict: listed ? 'observed' : 'not_observed',
      attributes: { isTorExit: listed },
      relationships: [],
      references: [url],
    };
  },
});
