function array(value) {
  return Array.isArray(value) ? value : [];
}

export function normalizeEvidence(provider, indicator, type, data = {}, meta = {}) {
  return {
    provider,
    indicator,
    type,
    observation: {
      kind: data.observationType ?? 'enrichment',
      verdict: data.verdict ?? 'unknown',
      confidence: Number.isFinite(data.confidence) ? data.confidence : null,
      firstSeen: data.firstSeen ?? null,
      lastSeen: data.lastSeen ?? null,
      tags: array(data.tags),
      malwareFamily: data.malwareFamily ?? null,
      actor: data.actor ?? null,
      attributes: data.attributes && typeof data.attributes === 'object' ? data.attributes : {},
    },
    relationships: array(data.relationships),
    references: array(data.references),
    retrievedAt: meta.retrievedAt ?? null,
    integrity: {
      rawHash: meta.rawHash ?? null,
      parserVersion: meta.parserVersion ?? '1',
    },
  };
}
