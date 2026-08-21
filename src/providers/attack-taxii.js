import { fetchJson } from '../core/fetch-json.js';
import { BoundedCache } from '../core/cache.js';
import { arr, uniq } from './helpers.js';

const TAXII_ROOT = 'https://attack-taxii.mitre.org/api/v21/collections/';
const TAXII_ACCEPT = 'application/taxii+json;version=2.1';
const TAXII_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const DEFAULT_TAXII_CACHE = new BoundedCache({ maxEntries: 16 });

const COLLECTIONS = Object.freeze([
  ['enterprise-attack', 'x-mitre-collection--1f5f1533-f617-4ca8-9ab4-6a02367fa019'],
  ['ics-attack', 'x-mitre-collection--90c00720-636b-4485-b342-8751d232bf09'],
  ['mobile-attack', 'x-mitre-collection--dac0d2d7-8653-445c-9bff-82f934c1e858'],
]);

function stixTypes(attackId) {
  if (/^T\d{4}(?:\.\d{3})?$/.test(attackId)) return ['attack-pattern'];
  if (/^TA\d{4}$/.test(attackId)) return ['x-mitre-tactic'];
  if (/^G\d{4}$/.test(attackId)) return ['intrusion-set'];
  if (/^S\d{4}$/.test(attackId)) return ['malware', 'tool'];
  if (/^M\d{4}$/.test(attackId)) return ['course-of-action'];
  if (/^C\d{4}$/.test(attackId)) return ['campaign'];
  if (/^DS\d{4}$/.test(attackId)) return ['x-mitre-data-source'];
  if (/^DC\d{4}$/.test(attackId)) return ['x-mitre-data-component'];
  if (/^DET\d{4}$/.test(attackId)) return ['x-mitre-detection-strategy'];
  return [];
}

function endpoint(collectionId, types) {
  const params = new URLSearchParams({ 'match[type]': types.join(',') });
  return `${TAXII_ROOT}${collectionId}/objects/?${params.toString()}`;
}

async function fetchTaxii(url, context) {
  const raw = await fetchJson(url, {
    fetchImpl: context.fetchImpl,
    signal: context.signal,
    headers: { accept: TAXII_ACCEPT },
    maxBytes: 24_000_000,
    redirect: 'error',
  });
  if (!raw || !Array.isArray(raw.objects)) throw new Error('invalid ATT&CK TAXII response');
  return raw;
}

async function loadTaxii(url, context) {
  const cache = context.feedCache ?? DEFAULT_TAXII_CACHE;
  const key = `attack-taxii:${url}`;
  if (cache && typeof cache.getOrLoad === 'function') {
    return cache.getOrLoad(key, () => fetchTaxii(url, context), {
      namespace: 'attack-taxii',
      ttlMs: TAXII_CACHE_TTL_MS,
      cache: true,
    });
  }

  const now = typeof context.nowMs === 'function' ? context.nowMs() : Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now) return cached.value;
  const raw = await fetchTaxii(url, context);
  cache.set(key, { value: raw, expiresAt: now + TAXII_CACHE_TTL_MS });
  return raw;
}

function attackReference(object, attackId) {
  return arr(object?.external_references).find(reference =>
    String(reference?.source_name ?? '').toLowerCase() === 'mitre-attack' &&
    String(reference?.external_id ?? '').toUpperCase() === attackId);
}

function findObject(objects, attackId) {
  return arr(objects).find(object => attackReference(object, attackId));
}

function tactics(object) {
  return uniq(arr(object?.kill_chain_phases)
    .filter(phase => phase?.kill_chain_name === 'mitre-attack')
    .map(phase => phase?.phase_name));
}

function references(object) {
  return uniq(arr(object?.external_references).map(reference => reference?.url).filter(Boolean));
}

export const attackTaxiiProvider = Object.freeze({
  name: 'attack-taxii',
  types: ['attack'],
  cacheTtlMs: TAXII_CACHE_TTL_MS,
  negativeCacheTtlMs: TAXII_CACHE_TTL_MS,
  costClass: 'free',
  timeoutMs: 8000,
  parserVersion: '2026-08-21.2',
  async run(input, context = {}) {
    const attackId = String(input.value).toUpperCase();
    const types = stixTypes(attackId);
    if (types.length === 0) throw new TypeError('unsupported ATT&CK identifier');

    const queried = [];
    for (const [domain, collectionId] of COLLECTIONS) {
      const url = endpoint(collectionId, types);
      queried.push(url);
      const raw = await loadTaxii(url, context);
      const object = findObject(raw.objects, attackId);
      if (!object) continue;

      const primaryReference = attackReference(object, attackId);
      return {
        observationType: 'attack_knowledge',
        verdict: 'cataloged',
        firstSeen: object.created ?? null,
        lastSeen: object.modified ?? null,
        tags: uniq(arr(object.x_mitre_platforms)),
        attributes: {
          attackId,
          stixId: object.id ?? null,
          stixType: object.type ?? null,
          name: object.name ?? null,
          description: typeof object.description === 'string' ? object.description.slice(0, 4000) : null,
          domain,
          version: object.x_mitre_version ?? null,
          platforms: uniq(arr(object.x_mitre_platforms)),
          tactics: tactics(object),
          revoked: object.revoked === true,
          deprecated: object.x_mitre_deprecated === true,
          relationshipExpansion: 'omitted_boundedness',
        },
        relationships: [],
        references: uniq([primaryReference?.url, ...references(object)].filter(Boolean)),
      };
    }

    return {
      observationType: 'attack_knowledge',
      verdict: 'not_found',
      attributes: {
        attackId,
        stixTypes: types,
        collectionsChecked: COLLECTIONS.map(([domain]) => domain),
        relationshipExpansion: 'omitted_boundedness',
      },
      relationships: [],
      references: queried,
    };
  },
});
