import { BlockList, isIP } from 'node:net';
import { loadTextFeed } from './public-feed.js';

function parseFeed(text) {
  const entries = [];
  let metadata = null;
  let parsedObjects = 0;

  for (const line of String(text).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let item;
    try {
      item = JSON.parse(trimmed);
    } catch {
      throw new Error('invalid Spamhaus DROP feed');
    }
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('invalid Spamhaus DROP feed');
    parsedObjects += 1;
    if (item.type === 'metadata') {
      metadata = item;
      continue;
    }
    if (typeof item.cidr !== 'string' || !item.cidr.includes('/')) throw new Error('invalid Spamhaus DROP feed');
    entries.push(item);
  }

  if (parsedObjects === 0 || !metadata) throw new Error('invalid Spamhaus DROP feed');
  return { entries, metadata };
}

function familyFor(ip) {
  return isIP(ip) === 6 ? 'ipv6' : 'ipv4';
}

function contains(cidr, ip, family) {
  const slash = cidr.lastIndexOf('/');
  if (slash <= 0) return false;
  const network = cidr.slice(0, slash);
  const prefix = Number(cidr.slice(slash + 1));
  if (!Number.isInteger(prefix)) return false;
  try {
    const block = new BlockList();
    block.addSubnet(network, prefix, family);
    return block.check(ip, family);
  } catch {
    return false;
  }
}

export const spamhausDropProvider = Object.freeze({
  name: 'spamhaus-drop', types: ['ip'], cacheTtlMs: 12 * 60 * 60 * 1000, negativeCacheTtlMs: 60 * 60 * 1000, costClass: 'free', timeoutMs: 5000, parserVersion: '2026-08-20',
  async run(input, context = {}) {
    const family = familyFor(input.value);
    const suffix = family === 'ipv6' ? 'v6' : 'v4';
    const url = `https://www.spamhaus.org/drop/drop_${suffix}.json`;
    const text = await loadTextFeed(url, context, { ttlMs: 12 * 60 * 60 * 1000, maxBytes: 2_000_000 });
    const { entries, metadata } = parseFeed(text);
    const match = entries.find(item => contains(item.cidr, input.value, family)) ?? null;
    return {
      observationType: 'drop_netblock',
      verdict: match ? 'listed' : 'not_listed',
      attributes: {
        listed: Boolean(match),
        cidr: match?.cidr ?? null,
        sblId: match?.sblid ?? null,
        feedTimestamp: Number.isFinite(Number(metadata.timestamp)) ? Number(metadata.timestamp) : null,
        copyright: metadata.copyright ?? null,
      },
      relationships: [],
      references: [url],
    };
  },
});
