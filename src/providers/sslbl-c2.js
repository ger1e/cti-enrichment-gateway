import { isIP } from 'node:net';
import { loadTextFeed } from './public-feed.js';

function parseMatch(text, target) {
  for (const line of String(text).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split(',').map(x => x.trim());
    const ipIndex = parts.findIndex(value => isIP(value));
    if (ipIndex < 0 || parts[ipIndex] !== target) continue;
    const port = parts.slice(ipIndex + 1).find(value => /^\d{1,5}$/.test(value));
    return {
      firstSeen: ipIndex > 0 ? parts[ipIndex - 1] || null : null,
      port: port ? Number(port) : null,
    };
  }
  return null;
}

export const sslblC2Provider = Object.freeze({
  name: 'sslbl-c2', types: ['ip'], cacheTtlMs: 60 * 60 * 1000, negativeCacheTtlMs: 30 * 60 * 1000, costClass: 'free', timeoutMs: 5000, parserVersion: '2026-08-20',
  async run(input, context = {}) {
    const url = 'https://sslbl.abuse.ch/blacklist/sslipblacklist_aggressive.csv';
    const text = await loadTextFeed(url, context, { ttlMs: 60 * 60 * 1000, maxBytes: 2_000_000 });
    const match = parseMatch(text, input.value);
    return {
      observationType: 'botnet_c2',
      verdict: match ? 'listed' : 'not_listed',
      firstSeen: match?.firstSeen ?? null,
      attributes: { listed: Boolean(match), port: match?.port ?? null, feed: 'SSLBL aggressive IP blacklist' },
      relationships: [],
      references: [url],
    };
  },
});
