import { semanticSnapshot, stableValue } from './snapshot-semantics.js';

const CATEGORY_PRIORITY = Object.freeze([
  'decision_changed',
  'contradiction_changed',
  'semantic_claim_changed',
  'evidence_added',
  'evidence_removed',
  'provider_state_changed',
  'provider_coverage_changed',
  'relationship_added',
  'relationship_removed',
  'attack_mapping_changed',
  'huntability_changed',
  'telemetry_changed',
  'freshness_changed',
]);

const PRIORITY = new Map(CATEGORY_PRIORITY.map((category, index) => [category, index]));

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function json(value) {
  return JSON.stringify(stableValue(value));
}

function same(a, b) {
  return json(a) === json(b);
}

function evidenceKey(item) {
  return `${item?.provider ?? ''}\u0000${item?.observation?.kind ?? ''}`;
}

function relationshipKey(item) {
  return json({
    type: item?.type ?? 'related_to',
    targetType: item?.targetType ?? null,
    target: item?.target ?? null,
    provider: item?.provider ?? null,
  });
}

function references(...values) {
  const providers = new Set();
  const evidenceFingerprints = new Set();
  const walk = value => {
    if (Array.isArray(value)) {
      for (const item of value) walk(item);
      return;
    }
    if (!value || typeof value !== 'object') return;
    if (typeof value.provider === 'string' && value.provider) providers.add(value.provider);
    for (const provider of Array.isArray(value.providers) ? value.providers : []) {
      if (typeof provider === 'string' && provider) providers.add(provider);
    }
    if (typeof value.fingerprint === 'string' && value.fingerprint) evidenceFingerprints.add(value.fingerprint);
    for (const fingerprint of Array.isArray(value.evidenceFingerprints) ? value.evidenceFingerprints : []) {
      if (typeof fingerprint === 'string' && fingerprint) evidenceFingerprints.add(fingerprint);
    }
    for (const child of Object.values(value)) walk(child);
  };
  for (const value of values) walk(value);
  return {
    providers: [...providers].sort((a, b) => a.localeCompare(b)),
    evidenceFingerprints: [...evidenceFingerprints].sort((a, b) => a.localeCompare(b)),
  };
}

function makeChange(category, key, before, after) {
  const refs = references(before, after);
  return {
    category,
    key,
    before: before ?? null,
    after: after ?? null,
    providers: refs.providers,
    evidenceFingerprints: refs.evidenceFingerprints,
  };
}

function mapBy(values, keyFn) {
  return new Map((Array.isArray(values) ? values : []).map(value => [keyFn(value), value]));
}

function appendSetChanges(changes, previousValues, currentValues, keyFn, addedCategory, removedCategory) {
  const previous = mapBy(previousValues, keyFn);
  const current = mapBy(currentValues, keyFn);
  for (const [key, value] of current) {
    if (!previous.has(key)) changes.push(makeChange(addedCategory, key, null, value));
  }
  for (const [key, value] of previous) {
    if (!current.has(key)) changes.push(makeChange(removedCategory, key, value, null));
  }
}

function appendEvidenceChanges(changes, previousValues, currentValues) {
  const previous = mapBy(previousValues, evidenceKey);
  const current = mapBy(currentValues, evidenceKey);
  for (const [key, value] of current) {
    if (!previous.has(key)) {
      changes.push(makeChange('evidence_added', key, null, value));
      continue;
    }
    const before = previous.get(key);
    if (!same(before, value)) changes.push(makeChange('semantic_claim_changed', key, before, value));
  }
  for (const [key, value] of previous) {
    if (!current.has(key)) changes.push(makeChange('evidence_removed', key, value, null));
  }
}

function appendProviderStateChanges(changes, beforeHealth, afterHealth) {
  const providers = new Set([...Object.keys(beforeHealth ?? {}), ...Object.keys(afterHealth ?? {})]);
  for (const provider of [...providers].sort((a, b) => a.localeCompare(b))) {
    const beforeState = Object.prototype.hasOwnProperty.call(beforeHealth ?? {}, provider) ? beforeHealth[provider] : null;
    const afterState = Object.prototype.hasOwnProperty.call(afterHealth ?? {}, provider) ? afterHealth[provider] : null;
    if (same(beforeState, afterState)) continue;
    changes.push(makeChange(
      'provider_state_changed',
      provider,
      beforeState === null ? null : { provider, state: beforeState },
      afterState === null ? null : { provider, state: afterState },
    ));
  }
}

function coverageState(snapshot) {
  return {
    status: snapshot.status,
    coverage: snapshot.coverage,
    limitations: snapshot.limitations,
  };
}

function decisionState(snapshot) {
  return {
    status: snapshot.status,
    evidenceQuality: snapshot.evidenceQuality,
    disposition: snapshot.decision.disposition,
    confidence: snapshot.decision.confidence,
    reasons: snapshot.decision.reasons,
    huntPlan: snapshot.decision.huntPlan,
  };
}

export function diffEvidenceSnapshots(previous, current) {
  if (previous?.indicator !== current?.indicator || previous?.type !== current?.type) {
    throw new TypeError('semantic diff requires matching indicator and type');
  }

  const before = semanticSnapshot(previous);
  const after = semanticSnapshot(current);
  const changes = [];

  appendEvidenceChanges(changes, before.evidence, after.evidence);
  appendProviderStateChanges(changes, before.providerHealth, after.providerHealth);
  appendSetChanges(changes, before.relationships, after.relationships, relationshipKey, 'relationship_added', 'relationship_removed');

  const beforeCoverage = coverageState(before);
  const afterCoverage = coverageState(after);
  if (!same(beforeCoverage, afterCoverage)) changes.push(makeChange('provider_coverage_changed', 'coverage', beforeCoverage, afterCoverage));

  if (!same(before.contradictions, after.contradictions)) {
    changes.push(makeChange('contradiction_changed', 'contradictions', before.contradictions, after.contradictions));
  }
  if (before.freshness !== after.freshness) {
    changes.push(makeChange('freshness_changed', 'freshness', before.freshness, after.freshness));
  }
  if (!same(before.decision.attackMappings, after.decision.attackMappings)) {
    changes.push(makeChange('attack_mapping_changed', 'attackMappings', before.decision.attackMappings, after.decision.attackMappings));
  }

  const beforeDecision = decisionState(before);
  const afterDecision = decisionState(after);
  if (!same(beforeDecision, afterDecision)) changes.push(makeChange('decision_changed', 'decision', beforeDecision, afterDecision));

  if (before.huntability !== after.huntability) {
    changes.push(makeChange('huntability_changed', 'huntability', before.huntability, after.huntability));
  }
  if (!same(before.decision.telemetry, after.decision.telemetry)) {
    changes.push(makeChange('telemetry_changed', 'telemetry', before.decision.telemetry, after.decision.telemetry));
  }

  changes.sort((a, b) => {
    const categoryOrder = (PRIORITY.get(a.category) ?? CATEGORY_PRIORITY.length) - (PRIORITY.get(b.category) ?? CATEGORY_PRIORITY.length);
    return categoryOrder || a.key.localeCompare(b.key);
  });

  const bounded = changes.slice(0, 128);
  const summary = {
    added: bounded.filter(change => change.category.endsWith('_added')).length,
    removed: bounded.filter(change => change.category.endsWith('_removed')).length,
    changed: bounded.filter(change => !change.category.endsWith('_added') && !change.category.endsWith('_removed')).length,
    total: bounded.length,
  };

  return deepFreeze({
    version: '1.0',
    indicator: after.indicator,
    type: after.type,
    changed: bounded.length > 0,
    summary,
    changes: bounded,
  });
}

export { CATEGORY_PRIORITY };
