import { createHash } from 'node:crypto';
import { loadTextFeed } from './public-feed.js';
import { arr, uniq } from './helpers.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_EVENT_FETCHES = 5;
const HASH_CACHE_TTL_MS = 60 * 60 * 1000;

function md5(value) {
  return createHash('md5').update(value, 'utf8').digest('hex');
}

function stripBom(value) {
  return String(value).replace(/^\uFEFF/, '');
}

function parseHashCache(text) {
  const entries = new Map();
  let rows = 0;

  for (const line of stripBom(text).split(/\r?\n/)) {
    const value = line.trim();
    if (!value || value.startsWith('#')) continue;
    rows += 1;
    const parts = value.split(',').map(part => part.trim().replace(/^"|"$/g, ''));
    if (parts.length !== 2 || !/^[a-f0-9]{32}$/i.test(parts[0]) || !UUID_RE.test(parts[1])) {
      throw new Error('invalid MISP feed hash cache');
    }
    const key = parts[0].toLowerCase();
    const current = entries.get(key) ?? [];
    current.push(parts[1].toLowerCase());
    entries.set(key, current);
  }

  if (rows === 0 || entries.size === 0) throw new Error('invalid MISP feed hash cache');
  return entries;
}

function canonicalUrl(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    url.hash = '';
    return url.toString();
  } catch {
    return null;
  }
}

function candidateValues(input) {
  const value = String(input.value);
  if (input.type === 'url') {
    const canonical = canonicalUrl(value);
    if (!canonical) return [value];
    const variants = [canonical];
    const parsed = new URL(canonical);
    if (parsed.pathname === '/' && !parsed.search) variants.push(canonical.replace(/\/$/, ''));
    return uniq(variants);
  }
  if (input.type === 'cve') return uniq([value.toUpperCase(), value.toLowerCase()]);
  return [value];
}

function sameValue(input, value) {
  const candidate = String(value ?? '').trim();
  if (!candidate) return false;
  if (input.type === 'url') return canonicalUrl(candidate) === canonicalUrl(input.value);
  if (input.type === 'domain' || input.type === 'hash' || input.type === 'cve') {
    return candidate.toLowerCase() === String(input.value).toLowerCase();
  }
  return candidate === String(input.value);
}

function componentFor(inputType, attributeType, value) {
  const type = String(attributeType ?? '').toLowerCase();
  const raw = String(value ?? '');

  if (inputType === 'ip') {
    if (type === 'ip-src' || type === 'ip-dst') return raw;
    if (type === 'domain|ip') return raw.split('|', 2)[1] ?? null;
    if (type === 'ip-src|port' || type === 'ip-dst|port') return raw.split('|', 2)[0] ?? null;
    return null;
  }

  if (inputType === 'domain') {
    if (type === 'domain' || type === 'hostname') return raw;
    if (type === 'domain|ip' || type === 'hostname|port') return raw.split('|', 2)[0] ?? null;
    return null;
  }

  if (inputType === 'url') return type === 'url' ? raw : null;

  if (inputType === 'hash') {
    if (['md5', 'sha1', 'sha256'].includes(type)) return raw;
    if (['filename|md5', 'filename|sha1', 'filename|sha256'].includes(type)) return raw.split('|', 2)[1] ?? null;
    return null;
  }

  if (inputType === 'cve') return type === 'vulnerability' ? raw : null;
  return null;
}

function matchesAttribute(input, attribute) {
  if (!attribute || attribute.deleted === true || attribute.deleted === 1 || attribute.deleted === '1') return false;
  const component = componentFor(input.type, attribute.type, attribute.value);
  return component != null && sameValue(input, component);
}

function eventAttributes(event) {
  return [
    ...arr(event?.Attribute),
    ...arr(event?.Object).flatMap(object => arr(object?.Attribute)),
  ];
}

function tagNames(items) {
  return arr(items).map(tag => tag?.name).filter(Boolean);
}

function asBoolean(value) {
  return value === true || value === 1 || value === '1';
}

async function loadEvent(baseUrl, uuid, context) {
  const url = `${baseUrl}${uuid}.json`;
  const text = await loadTextFeed(url, context, { maxBytes: 2_000_000, cache: false });
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('invalid MISP feed event JSON');
  }
  const event = raw?.Event;
  if (!event || String(event.uuid ?? '').toLowerCase() !== uuid.toLowerCase()) {
    throw new Error('invalid MISP feed event');
  }
  return { event, url };
}

function createMispFeedProvider({ name, baseUrl, feedLabel }) {
  return Object.freeze({
    name,
    types: ['ip', 'domain', 'url', 'hash', 'cve'],
    cacheTtlMs: HASH_CACHE_TTL_MS,
    negativeCacheTtlMs: HASH_CACHE_TTL_MS,
    costClass: 'free',
    timeoutMs: 8000,
    parserVersion: '2026-08-21.2',
    async run(input, context = {}) {
      const hashUrl = `${baseUrl}hashes.csv`;
      const cacheText = await loadTextFeed(hashUrl, context, { ttlMs: HASH_CACHE_TTL_MS, maxBytes: 32_000_000 });
      const cache = parseHashCache(cacheText);
      const eventUuids = uniq(candidateValues(input).flatMap(value => cache.get(md5(value)) ?? []));

      if (eventUuids.length === 0) {
        return {
          observationType: 'misp_feed_hit',
          verdict: 'not_listed',
          attributes: { feed: feedLabel, listed: false, eventCount: 0, matchedAttributeCount: 0, toIds: false },
          relationships: [],
          references: [hashUrl],
        };
      }

      const verified = [];
      const tags = [];
      const references = [hashUrl];
      let matchedAttributeCount = 0;
      let toIds = false;

      for (const uuid of eventUuids.slice(0, MAX_EVENT_FETCHES)) {
        const { event, url } = await loadEvent(baseUrl, uuid, context);
        const matches = eventAttributes(event).filter(attribute => matchesAttribute(input, attribute));
        if (matches.length === 0) throw new Error('MISP feed hash cache/event mismatch');

        matchedAttributeCount += matches.length;
        toIds ||= matches.some(attribute => asBoolean(attribute?.to_ids));
        const eventTags = tagNames(event.Tag);
        const attributeTags = matches.flatMap(match => tagNames(match?.Tag));
        tags.push(...eventTags, ...attributeTags);
        references.push(url);
        verified.push({
          uuid: event.uuid,
          info: event.info ?? null,
          date: event.date ?? null,
          published: asBoolean(event.published),
          threatLevelId: event.threat_level_id ?? null,
          tags: uniq([...eventTags, ...attributeTags]),
          matchedAttributeTypes: uniq(matches.map(attribute => attribute.type)),
        });
      }

      return {
        observationType: 'misp_feed_hit',
        verdict: 'listed',
        tags: uniq(tags),
        attributes: {
          feed: feedLabel,
          listed: true,
          eventCount: verified.length,
          candidateEventCount: eventUuids.length,
          matchedAttributeCount,
          toIds,
          truncated: eventUuids.length > MAX_EVENT_FETCHES,
          events: verified,
        },
        relationships: [],
        references: uniq(references),
      };
    },
  });
}

export const mispCirclOsintProvider = createMispFeedProvider({
  name: 'misp-circl-osint',
  baseUrl: 'https://www.circl.lu/doc/misp/feed-osint/',
  feedLabel: 'CIRCL OSINT Feed',
});

export const mispBotvrijOsintProvider = createMispFeedProvider({
  name: 'misp-botvrij-osint',
  baseUrl: 'https://www.botvrij.eu/data/feed-osint/',
  feedLabel: 'Botvrij.eu OSINT Feed',
});
