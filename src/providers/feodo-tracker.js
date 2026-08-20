import { isIP } from 'node:net';
import { loadTextFeed } from './public-feed.js';

function parseFeed(text) {
  const source = String(text);
  if (!source.includes('Feodo Tracker Botnet C2 IP Blocklist')) throw new Error('invalid Feodo Tracker feed');
  const updated = source.match(/^#\s*Last updated:\s*(.+)$/mi)?.[1]?.trim() ?? null;
  const entries = [];
  for (const line of source.split(/\r?\n/)) {
    const value = line.trim();
    if (!value || value.startsWith('#')) continue;
    if (!isIP(value)) throw new Error('invalid Feodo Tracker feed');
    entries.push(value);
  }
  return { entries: new Set(entries), updated };
}

export const feodoTrackerProvider = Object.freeze({
  name: 'feodo-tracker', types: ['ip'], cacheTtlMs: 60 * 60 * 1000, negativeCacheTtlMs: 30 * 60 * 1000, costClass: 'free', timeoutMs: 5000, parserVersion: '2026-08-20',
  async run(input, context = {}) {
    const url = 'https://feodotracker.abuse.ch/downloads/ipblocklist.txt';
    const text = await loadTextFeed(url, context, { ttlMs: 60 * 60 * 1000, maxBytes: 2_000_000 });
    const { entries, updated } = parseFeed(text);
    const listed = entries.has(input.value);
    return {
      observationType: 'botnet_c2',
      verdict: listed ? 'listed' : 'not_listed',
      attributes: { listed, feed: 'Feodo Tracker', feedUpdatedAt: updated },
      relationships: [],
      references: [url],
    };
  },
});
