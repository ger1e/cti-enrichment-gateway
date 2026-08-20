import { loadTextFeed } from './public-feed.js';

export const feodoTrackerProvider = Object.freeze({
  name: 'feodo-tracker', types: ['ip'], cacheTtlMs: 60 * 60 * 1000, negativeCacheTtlMs: 30 * 60 * 1000, costClass: 'free', timeoutMs: 5000, parserVersion: '2026-08-20',
  async run(input, context = {}) {
    const url = 'https://feodotracker.abuse.ch/downloads/ipblocklist.txt';
    const text = await loadTextFeed(url, context, { ttlMs: 60 * 60 * 1000, maxBytes: 2_000_000 });
    const entries = new Set(String(text).split(/\r?\n/).map(x => x.trim()).filter(x => x && !x.startsWith('#')));
    const listed = entries.has(input.value);
    return {
      observationType: 'botnet_c2',
      verdict: listed ? 'listed' : 'not_listed',
      attributes: { listed, feed: 'Feodo Tracker' },
      relationships: [],
      references: [url],
    };
  },
});
