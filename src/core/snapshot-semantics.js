function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, stableValue(value[key])]));
  }
  return value;
}

function sortedStrings(values, limit = Infinity) {
  return [...new Set((Array.isArray(values) ? values : []).filter(value => typeof value === 'string'))]
    .sort((a, b) => a.localeCompare(b))
    .slice(0, limit);
}

function sortedStable(values, limit) {
  const items = (Array.isArray(values) ? values : []).map(stableValue);
  const byJson = new Map(items.map(item => [JSON.stringify(item), item]));
  return [...byJson.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, limit)
    .map(([, item]) => item);
}

function projectEvidence(item) {
  const observation = item?.observation ?? {};
  return {
    provider: item?.provider ?? null,
    fingerprint: item?.integrity?.fingerprint ?? null,
    semantics: stableValue(item?.semantics ?? null),
    observation: {
      kind: observation.kind ?? null,
      verdict: observation.verdict ?? null,
      firstSeen: observation.firstSeen ?? null,
      lastSeen: observation.lastSeen ?? null,
      tags: sortedStrings(observation.tags),
      attributes: stableValue(observation.attributes ?? {}),
    },
  };
}

function projectRelationship(rel) {
  return {
    type: rel?.type ?? 'related_to',
    target: rel?.target ?? rel?.value ?? null,
    targetType: rel?.targetType ?? null,
    provider: rel?.provider ?? null,
  };
}

function projectHunt(hunt) {
  return {
    id: hunt?.id ?? null,
    priority: hunt?.priority ?? null,
    hypothesis: hunt?.hypothesis ?? null,
    telemetry: sortedStrings(hunt?.telemetry),
    evidenceFingerprints: sortedStrings(hunt?.evidenceFingerprints),
  };
}

export function semanticSnapshot(enrichment) {
  if (!enrichment || typeof enrichment.indicator !== 'string' || typeof enrichment.type !== 'string' || !Array.isArray(enrichment.evidence)) {
    throw new TypeError('invalid evidence snapshot');
  }

  const evidence = enrichment.evidence
    .map(projectEvidence)
    .sort((a, b) => `${a.provider ?? ''}\u0000${a.fingerprint ?? ''}`.localeCompare(`${b.provider ?? ''}\u0000${b.fingerprint ?? ''}`))
    .slice(0, 256);

  const relationships = sortedStable((enrichment.relationships ?? []).map(projectRelationship), 256);
  const correlation = enrichment.correlation ?? {};
  const decision = enrichment.decision ?? {};
  const coverage = enrichment.coverage ?? {};
  const providerHealth = stableValue(enrichment.meta?.providerHealth ?? {});

  const snapshot = {
    indicator: enrichment.indicator,
    type: enrichment.type,
    status: enrichment.status ?? null,
    providerHealth,
    coverage: {
      selected: coverage.selected ?? 0,
      executed: coverage.executed ?? 0,
      succeeded: coverage.succeeded ?? 0,
      failed: coverage.failed ?? 0,
      skipped: coverage.skipped ?? 0,
      materialLoss: Boolean(coverage.materialLoss),
    },
    limitations: sortedStrings(enrichment.limitations ?? correlation.limitations),
    evidence,
    relationships,
    contradictions: sortedStable(correlation.contradictions, 64),
    freshness: correlation.freshness?.overall ?? null,
    evidenceQuality: correlation.evidenceQuality?.level ?? null,
    huntability: correlation.huntability?.level ?? null,
    decision: {
      disposition: decision.disposition ?? null,
      confidence: decision.confidence ?? null,
      reasons: sortedStrings(decision.reasons, 16),
      telemetry: stableValue(decision.telemetry ?? null),
      attackMappings: sortedStable(decision.attackMappings, 64),
      huntPlan: (Array.isArray(decision.huntPlan) ? decision.huntPlan : []).slice(0, 8).map(projectHunt),
    },
  };

  return deepFreeze(snapshot);
}

export { stableValue };
