import { loadTextFeed } from './public-feed.js';

function canonicalUrl(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    url.hash = '';
    return url.href;
  } catch {
    return null;
  }
}

function parseFeed(text) {
  const entries = [];
  let dataRows = 0;
  for (const line of String(text).split(/\r?\n/)) {
    const value = line.trim();
    if (!value || value.startsWith('#')) continue;
    dataRows += 1;
    const canonical = canonicalUrl(value);
    if (!canonical) throw new Error('invalid OpenPhish feed');
    entries.push({ url: canonical, host: new URL(canonical).hostname.toLowerCase() });
  }
  if (dataRows === 0 || entries.length === 0) throw new Error('invalid OpenPhish feed');
  return entries;
}

export const openphishProvider = Object.freeze({
  name: 'openphish', types: ['domain', 'url'], cacheTtlMs: 12 * 60 * 60 * 1000, negativeCacheTtlMs: 12 * 60 * 60 * 1000, costClass: 'free', timeoutMs: 5000, parserVersion: '2026-08-20',
  async run(input, context = {}) {
    const url = 'https://raw.githubusercontent.com/openphish/public_feed/refs/heads/main/feed.txt';
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
