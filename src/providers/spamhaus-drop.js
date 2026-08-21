import { BlockList, isIP } from 'node:net';
import { parseCanonicalCidr, cidrContains, cidrOverlaps } from '../core/network.js';
import { loadTextFeed } from './public-feed.js';

function parseFeed(text, kind = 'cidr') {
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
    if (kind === 'asn') {
      if (!Number.isInteger(Number(item.asn)) || Number(item.asn) < 1) throw new Error('invalid Spamhaus ASN-DROP feed');
    } else if (typeof item.cidr !== 'string' || !parseCanonicalCidr(item.cidr)) {
      throw new Error('invalid Spamhaus DROP feed');
    }
    entries.push(item);
  }

  if (parsedObjects === 0 || !metadata) throw new Error('invalid Spamhaus DROP feed');
  return { entries, metadata };
}

function familyFor(ip) {
  return isIP(ip) === 6 ? 'ipv6' : 'ipv4';
}

function containsIp(cidr, ip, family) {
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

function metadataFields(metadata) {
  return {
    feedTimestamp: Number.isFinite(Number(metadata.timestamp)) ? Number(metadata.timestamp) : null,
    copyright: metadata.copyright ?? null,
  };
}

export const spamhausDropProvider = Object.freeze({
  name: 'spamhaus-drop', types: ['ip', 'asn', 'cidr'], cacheTtlMs: 12 * 60 * 60 * 1000, negativeCacheTtlMs: 60 * 60 * 1000, costClass: 'free', timeoutMs: 5000, parserVersion: '2026-08-21.2',
  async run(input, context = {}) {
    if (input.type === 'asn') {
      const url = 'https://www.spamhaus.org/drop/asndrop.json';
      const text = await loadTextFeed(url, context, { ttlMs: 12 * 60 * 60 * 1000, maxBytes: 2_000_000 });
      const { entries, metadata } = parseFeed(text, 'asn');
      const number = Number(input.value.slice(2));
      const match = entries.find(item => Number(item.asn) === number) ?? null;
      return {
        observationType: 'drop_netblock',
        verdict: match ? 'listed' : 'not_listed',
        attributes: {
          listed: Boolean(match), asn: input.value,
          rir: match?.rir ?? null, domain: match?.domain ?? null, cc: match?.cc ?? null, asname: match?.asname ?? null,
          ...metadataFields(metadata),
        },
        relationships: [], references: [url],
      };
    }

    if (input.type === 'cidr') {
      const parsed = parseCanonicalCidr(input.value);
      const suffix = parsed?.version === 6 ? 'v6' : 'v4';
      const url = `https://www.spamhaus.org/drop/drop_${suffix}.json`;
      const text = await loadTextFeed(url, context, { ttlMs: 12 * 60 * 60 * 1000, maxBytes: 2_000_000 });
      const { entries, metadata } = parseFeed(text, 'cidr');
      const contained = entries.find(item => cidrContains(item.cidr, input.value)) ?? null;
      const overlap = contained ?? entries.find(item => cidrOverlaps(item.cidr, input.value)) ?? null;
      return {
        observationType: 'drop_netblock',
        verdict: contained ? 'listed' : overlap ? 'overlap' : 'not_listed',
        attributes: {
          listed: Boolean(contained), overlap: Boolean(overlap), queryCidr: input.value,
          cidr: overlap?.cidr ?? null, sblId: overlap?.sblid ?? null,
          ...metadataFields(metadata),
        },
        relationships: [], references: [url],
      };
    }

    const family = familyFor(input.value);
    const suffix = family === 'ipv6' ? 'v6' : 'v4';
    const url = `https://www.spamhaus.org/drop/drop_${suffix}.json`;
    const text = await loadTextFeed(url, context, { ttlMs: 12 * 60 * 60 * 1000, maxBytes: 2_000_000 });
    const { entries, metadata } = parseFeed(text, 'cidr');
    const match = entries.find(item => containsIp(item.cidr, input.value, family)) ?? null;
    return {
      observationType: 'drop_netblock',
      verdict: match ? 'listed' : 'not_listed',
      attributes: {
        listed: Boolean(match),
        cidr: match?.cidr ?? null,
        sblId: match?.sblid ?? null,
        ...metadataFields(metadata),
      },
      relationships: [],
      references: [url],
    };
  },
});
