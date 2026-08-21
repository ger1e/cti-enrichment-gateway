import { createHash } from 'node:crypto';

function array(value) {
  return Array.isArray(value) ? value : [];
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  }
  return value;
}

function fingerprint(value) {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

export function normalizeEvidence(provider, indicator, type, data = {}, meta = {}) {
  const observation = {
    kind: data.observationType ?? 'enrichment',
    verdict: data.verdict ?? 'unknown',
    confidence: Number.isFinite(data.confidence) ? data.confidence : null,
    firstSeen: data.firstSeen ?? null,
    lastSeen: data.lastSeen ?? null,
    tags: array(data.tags),
    malwareFamily: data.malwareFamily ?? null,
    actor: data.actor ?? null,
    attributes: data.attributes && typeof data.attributes === 'object' ? data.attributes : {},
  };
  const relationships = array(data.relationships);
  const references = array(data.references);
  const parserVersion = meta.parserVersion ?? '1';
  const retrievedAt = meta.retrievedAt ?? null;
  const integrityFingerprint = fingerprint({
    provider,
    parserVersion,
    indicator,
    type,
    observation,
    relationships,
    references,
  });

  return {
    provider,
    indicator,
    type,
    observation,
    relationships,
    references,
    retrievedAt,
    cacheState: meta.cacheState ?? 'miss',
    durationMs: Number.isFinite(meta.durationMs) ? Math.max(0, meta.durationMs) : 0,
    integrity: {
      rawHash: meta.rawHash ?? null,
      parserVersion,
      fingerprint: integrityFingerprint,
    },
  };
}
