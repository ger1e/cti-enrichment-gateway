import { loadTextFeed } from './public-feed.js';

function canonicalUrl(value) {
  try {
    const url = new URL(value);
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

function parseFeed(text) {
  const entries = [];
  for (const line of String(text).split(/\r?\n/)) {
    const value = line.trim();
    if (!value || value.startsWith('#')) continue;
    const canonical = canonicalUrl(value);
    if (!canonical) continue;
    try {
      entries.push({ url: canonical, host: new URL(canonical).hostname.toLowerCase() });
    } catch {
      // Ignore malformed feed rows.
    }
  }
  return entries;
}

export const openphishProvider = Object.freeze({
  name: 'openphish', types: ['domain', 'url'], cacheTtlMs: 12 * 60 * 60 * 1000, negativeCacheTtlMs: 12 * 60 * 60 * 1000, costClass: 'free', timeoutMs: 5000, parserVersion: '2026-08-20',
  async run(input, context = {}) {
    const url = 'https://openphish.com/feed.txt';
    const text = await loadTextFeed(url, context, { ttlMs: 12 * 60 * 60 * 1000, maxBytes: 4_000_000 });
    const entries = parseFeed(text);
    let matches;
    if (input.type === 'url') {
      const target = canonicalUrl(input.value);
      matches = target ? entries.filter(entry => entry.url === target) : [];
    } else {
      const host = String(input.value).toLowerCase();
      matches = entries.filter(entry => entry.host === host);
    }
    const listed = matches.length > 0;
    return {
      observationType: 'phishing_feed_match',
      verdict: listed ? 'phishing' : 'not_listed',
      attributes: { listed, matchCount: matches.length, feed: 'OpenPhish Community' },
      relationships: [],
      references: [url],
    };
  },
});
