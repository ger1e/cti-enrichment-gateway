import { isIP } from 'node:net';
import { loadTextFeed } from './public-feed.js';

function parseExitFeed(text) {
  const lines = String(text).split(/\r?\n/).map(x => x.trim()).filter(Boolean);
  if (lines.length === 0 || lines.some(value => !isIP(value))) throw new Error('invalid Tor exit feed');
  return new Set(lines);
}

export const torExitProvider = Object.freeze({
  name: 'tor-exit', types: ['ip'], cacheTtlMs: 30 * 60 * 1000, negativeCacheTtlMs: 15 * 60 * 1000, costClass: 'free', timeoutMs: 5000, parserVersion: '2026-08-20',
  async run(input, context = {}) {
    const url = 'https://check.torproject.org/torbulkexitlist';
    const text = await loadTextFeed(url, context, { ttlMs: 30 * 60 * 1000, maxBytes: 1_000_000 });
    const exits = parseExitFeed(text);
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
