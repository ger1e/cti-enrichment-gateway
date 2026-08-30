import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIntelligenceKernel, INTELLIGENCE_KERNEL_SCHEMA_VERSION } from '../src/core/intelligence-kernel.js';
import { IP_INTELLIGENCE_POLICY } from '../src/core/intelligence-policy/ip.js';

const NOW = '2026-08-30T10:00:00.000Z';

function build(overrides = {}) {
  return buildIntelligenceKernel({
    indicator: '203.0.113.7',
    type: 'ip',
    evidence: [],
    relationships: [],
    correlation: {},
    coverage: {},
    now: NOW,
    policy: IP_INTELLIGENCE_POLICY,
    ...overrides,
  });
}

function assertDeepFrozen(value) {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeepFrozen(child);
}

function evidence({
  provider,
  kind = 'reputation',
  verdict = 'malicious',
  sourceRole = 'first_party',
  semanticClass = 'reputation',
  fingerprint = 'a',
  firstSeen,
  lastSeen,
  retrievedAt,
} = {}) {
  const observation = { kind, verdict };
  if (firstSeen !== undefined) observation.firstSeen = firstSeen;
  if (lastSeen !== undefined) observation.lastSeen = lastSeen;
  const item = {
    provider,
    observation,
    semantics: { sourceRole, semanticClass },
    integrity: { fingerprint: fingerprint.repeat(64) },
  };
  if (retrievedAt !== undefined) item.retrievedAt = retrievedAt;
  return item;
}

function capability(provider, state, observationTypes, sourceRole = 'community', semanticClassHints = []) {
  return { provider, state, observationTypes, semanticClassHints, sourceRole };
}

test('empty IP evidence returns the canonical immutable Intelligence Kernel v1 projection', () => {
  const out = build();
  assert.equal(INTELLIGENCE_KERNEL_SCHEMA_VERSION, '1.0');
  assert.equal(out.schemaVersion, '1.0');
  assert.deepEqual(out.policy, { type: 'ip', version: '1.0' });
  assert.equal(out.indicator, '203.0.113.7');
  assert.equal(out.type, 'ip');
  assert.deepEqual(out.evidenceStrength, {
    level: 'none', reasons: [], providers: [], evidenceFingerprints: [],
  });
  assert.deepEqual(out.sourceDiversity, {
    providerCount: 0, providers: [], sourceRoles: [], semanticClasses: [], evidenceCategories: [], capabilityGroups: [],
  });
  assert.deepEqual(out.corroboration, []);
  assert.deepEqual(out.contradiction, { level: 'none', items: [] });
  assert.deepEqual(out.temporalRelevance, {
    firstSeen: null, lastSeen: null, ageDays: null, activeSpanDays: null, overall: 'unknown',
    distribution: { current: 0, aging: 0, stale: 0, unknown: 0 },
  });
  assert.deepEqual(out.relationshipValue, []);
  assert.deepEqual(out.pivotCandidates, []);
  assert.deepEqual(out.threatContext, {
    state: 'insufficient', direct: [], supporting: [], scannerNoise: [], torProxy: [], infrastructure: [], exposure: [],
  });
  assert.deepEqual(out.huntRelevance, {
    level: 'none', directSearch: false, telemetry: [], pivotCount: 0, evidenceFingerprints: [], ruleIds: [],
  });
  assert.deepEqual(out.coverageImpact, {
    level: 'none', uniqueCapabilityLoss: [], duplicateCoverageLoss: [], reasons: [],
  });
  assert.deepEqual(out.analystPriority, { level: 'insufficient', reasons: [], evidenceFingerprints: [] });
  assert.deepEqual(out.limitations, []);
  assert.deepEqual(out.trace, { ruleIds: [] });
  assertDeepFrozen(out);
});

test('kernel projection never mutates Evidence v2 relationships correlation or coverage inputs', () => {
  const inputEvidence = [{
    provider: 'fixture',
    observation: { kind: 'reputation', verdict: 'malicious', attributes: { nested: ['x'] } },
    semantics: { sourceRole: 'first_party', semanticClass: 'reputation' },
    integrity: { fingerprint: 'a'.repeat(64) },
  }];
  const relationships = [{ type: 'domain', source: '203.0.113.7', target: 'evil.example', targetType: 'domain', provider: 'fixture' }];
  const correlation = { limitations: ['fixture_limit'], nested: { values: [1, 2] } };
  const coverage = { materialLoss: false, selectedProviders: ['fixture'], nested: { values: [3, 4] } };
  const before = structuredClone({ evidence: inputEvidence, relationships, correlation, coverage });

  build({ evidence: inputEvidence, relationships, correlation, coverage });

  assert.deepEqual({ evidence: inputEvidence, relationships, correlation, coverage }, before);
});

test('kernel projection is deterministic for identical inputs and injected clock', () => {
  const args = {
    evidence: [{ provider: 'fixture', observation: { kind: 'reputation', verdict: 'malicious' }, integrity: { fingerprint: 'b'.repeat(64) } }],
    relationships: [{ type: 'domain', source: '203.0.113.7', target: 'evil.example', targetType: 'domain', provider: 'fixture' }],
    correlation: { limitations: ['x'] },
    coverage: { materialLoss: false },
  };
  assert.deepEqual(build(args), build(structuredClone(args)));
});

test('kernel does not invent or emit malformed evidence fingerprints', () => {
  const out = build({
    evidence: [
      { provider: 'bad', observation: { kind: 'reputation', verdict: 'malicious' }, integrity: { fingerprint: 'not-a-fingerprint' } },
      { provider: 'good', observation: { kind: 'reputation', verdict: 'malicious' }, integrity: { fingerprint: 'c'.repeat(64) } },
    ],
  });
  assert.equal(JSON.stringify(out).includes('not-a-fingerprint'), false);
  assert.equal(out.evidenceStrength.evidenceFingerprints.includes('not-a-fingerprint'), false);
});

test('missing clock never falls back to wall clock for temporal state', () => {
  const out = buildIntelligenceKernel({
    indicator: '203.0.113.7', type: 'ip', evidence: [], relationships: [], correlation: {}, coverage: {}, policy: IP_INTELLIGENCE_POLICY,
  });
  assert.equal(out.temporalRelevance.overall, 'unknown');
  assert.equal(out.temporalRelevance.ageDays, null);
});

test('source diversity and corroboration distinguish independent evidence from same-capability duplication', () => {
  const independent = build({ evidence: [
    evidence({ provider: 'alpha', sourceRole: 'first_party', fingerprint: '1' }),
    evidence({ provider: 'beta', sourceRole: 'contextual', fingerprint: '2' }),
  ] });
  assert.deepEqual(independent.sourceDiversity, {
    providerCount: 2,
    providers: ['alpha', 'beta'],
    sourceRoles: ['contextual', 'first_party'],
    semanticClasses: ['reputation'],
    evidenceCategories: ['direct_threat'],
    capabilityGroups: ['contextual:reputation', 'first_party:reputation'],
  });
  assert.deepEqual(independent.corroboration, [{
    semanticClass: 'reputation',
    category: 'direct_threat',
    polarity: 'positive',
    providers: ['alpha', 'beta'],
    sourceRoles: ['contextual', 'first_party'],
    evidenceFingerprints: ['1'.repeat(64), '2'.repeat(64)],
    independence: 'independent',
  }]);

  const duplicate = build({ evidence: [
    evidence({ provider: 'alpha', sourceRole: 'first_party', fingerprint: '3' }),
    evidence({ provider: 'beta', sourceRole: 'first_party', fingerprint: '4' }),
  ] });
  assert.equal(duplicate.corroboration[0].independence, 'same_capability');
  assert.deepEqual(duplicate.sourceDiversity.capabilityGroups, ['first_party:reputation']);
});

test('contradiction severity follows direct supporting and contextual evidence categories', () => {
  const high = build({ evidence: [
    evidence({ provider: 'alpha', kind: 'reputation', verdict: 'malicious', fingerprint: '1' }),
    evidence({ provider: 'beta', kind: 'reputation', verdict: 'benign', fingerprint: '2' }),
  ] });
  assert.equal(high.contradiction.level, 'high');
  assert.equal(high.contradiction.items[0].category, 'direct_threat');

  const medium = build({ evidence: [
    evidence({ provider: 'alpha', kind: 'threat_context', semanticClass: 'threat_context', verdict: 'malicious', fingerprint: '3' }),
    evidence({ provider: 'beta', kind: 'threat_context', semanticClass: 'threat_context', verdict: 'benign', fingerprint: '4' }),
  ] });
  assert.equal(medium.contradiction.level, 'medium');
  assert.equal(medium.contradiction.items[0].category, 'supporting_threat');

  const low = build({ evidence: [
    evidence({ provider: 'alpha', kind: 'registration', semanticClass: 'network_context', verdict: 'malicious', fingerprint: '5' }),
    evidence({ provider: 'beta', kind: 'registration', semanticClass: 'network_context', verdict: 'benign', fingerprint: '6' }),
  ] });
  assert.equal(low.contradiction.level, 'low');
  assert.equal(low.contradiction.items[0].category, 'infrastructure');

  const none = build({ evidence: [
    evidence({ provider: 'alpha', fingerprint: '7' }),
    evidence({ provider: 'beta', fingerprint: '8' }),
  ] });
  assert.deepEqual(none.contradiction, { level: 'none', items: [] });
});

test('temporal relevance classifies current aging stale mixed and unknown observation time deterministically', () => {
  const current = build({ evidence: [evidence({ provider: 'current', firstSeen: '2026-08-28T10:00:00.000Z', lastSeen: '2026-08-29T10:00:00.000Z', fingerprint: '1' })] });
  assert.deepEqual(current.temporalRelevance, {
    firstSeen: '2026-08-28T10:00:00.000Z', lastSeen: '2026-08-29T10:00:00.000Z', ageDays: 1, activeSpanDays: 1,
    overall: 'current', distribution: { current: 1, aging: 0, stale: 0, unknown: 0 },
  });

  const aging = build({ evidence: [evidence({ provider: 'aging', lastSeen: '2026-08-15T10:00:00.000Z', fingerprint: '2' })] });
  assert.equal(aging.temporalRelevance.overall, 'aging');
  assert.equal(aging.temporalRelevance.ageDays, 15);

  const stale = build({ evidence: [evidence({ provider: 'stale', lastSeen: '2026-07-01T10:00:00.000Z', fingerprint: '3' })] });
  assert.equal(stale.temporalRelevance.overall, 'stale');
  assert.equal(stale.temporalRelevance.ageDays, 60);

  const mixed = build({ evidence: [
    evidence({ provider: 'current', firstSeen: '2026-08-29T10:00:00.000Z', lastSeen: '2026-08-29T10:00:00.000Z', fingerprint: '4' }),
    evidence({ provider: 'aging', firstSeen: '2026-08-10T10:00:00.000Z', lastSeen: '2026-08-15T10:00:00.000Z', fingerprint: '5' }),
    evidence({ provider: 'stale', firstSeen: '2026-06-01T10:00:00.000Z', lastSeen: '2026-07-01T10:00:00.000Z', fingerprint: '6' }),
    evidence({ provider: 'unknown', fingerprint: '7' }),
  ] });
  assert.equal(mixed.temporalRelevance.overall, 'stale');
  assert.deepEqual(mixed.temporalRelevance.distribution, { current: 1, aging: 1, stale: 1, unknown: 1 });
  assert.equal(mixed.temporalRelevance.firstSeen, '2026-06-01T10:00:00.000Z');
  assert.equal(mixed.temporalRelevance.lastSeen, '2026-08-29T10:00:00.000Z');
  assert.equal(mixed.temporalRelevance.ageDays, 1);
  assert.equal(mixed.temporalRelevance.activeSpanDays, 89);
});

test('retrieval time alone never becomes observation recency', () => {
  const out = build({ evidence: [evidence({ provider: 'retrieved-only', retrievedAt: '2026-08-30T09:59:00.000Z', fingerprint: '9' })] });
  assert.deepEqual(out.temporalRelevance, {
    firstSeen: null, lastSeen: null, ageDays: null, activeSpanDays: null, overall: 'unknown',
    distribution: { current: 0, aging: 0, stale: 0, unknown: 1 },
  });
});

test('unique direct-threat capability loss is material coverage impact', () => {
  const out = build({ coverage: {
    providerCapabilities: [capability('threatfox', 'failed', ['ioc_reputation'], 'first_party', ['reputation'])],
  } });
  assert.deepEqual(out.coverageImpact, {
    level: 'material',
    uniqueCapabilityLoss: [{ provider: 'threatfox', observationType: 'ioc_reputation', semanticClass: 'reputation', category: 'direct_threat', sourceRole: 'first_party' }],
    duplicateCoverageLoss: [],
    reasons: ['unique_threat_capability_loss'],
  });
});

test('duplicate direct-threat capability loss is degraded when healthy coverage remains', () => {
  const out = build({ coverage: {
    providerCapabilities: [
      capability('threatfox', 'failed', ['ioc_reputation'], 'first_party', ['reputation']),
      capability('virustotal', 'ok', ['ioc_reputation'], 'specialist', ['reputation']),
    ],
  } });
  assert.deepEqual(out.coverageImpact, {
    level: 'degraded',
    uniqueCapabilityLoss: [],
    duplicateCoverageLoss: [{ provider: 'threatfox', observationType: 'ioc_reputation', semanticClass: 'reputation', category: 'direct_threat', sourceRole: 'first_party' }],
    reasons: ['duplicate_capability_loss'],
  });
});

test('unique contextual-only capability loss is degraded rather than material', () => {
  const out = build({ coverage: {
    providerCapabilities: [capability('rdap', 'skipped', ['registration'], 'authoritative', ['network_context'])],
  } });
  assert.deepEqual(out.coverageImpact, {
    level: 'degraded',
    uniqueCapabilityLoss: [{ provider: 'rdap', observationType: 'registration', semanticClass: 'network_context', category: 'infrastructure', sourceRole: 'authoritative' }],
    duplicateCoverageLoss: [],
    reasons: ['contextual_capability_loss'],
  });
});

test('healthy or cached admitted capabilities produce no coverage impact', () => {
  const out = build({ coverage: {
    providerCapabilities: [
      capability('threatfox', 'ok', ['ioc_reputation'], 'first_party', ['reputation']),
      capability('virustotal', 'cached', ['ioc_reputation'], 'specialist', ['reputation']),
      capability('rdap', 'ok', ['registration'], 'authoritative', ['network_context']),
    ],
  } });
  assert.deepEqual(out.coverageImpact, { level: 'none', uniqueCapabilityLoss: [], duplicateCoverageLoss: [], reasons: [] });
});

test('failed or timed-out capability coverage never becomes negative threat evidence', () => {
  const out = build({ coverage: {
    providerCapabilities: [capability('threatfox', 'failed', ['ioc_reputation'], 'first_party', ['reputation'])],
  } });
  assert.equal(out.threatContext.state, 'insufficient');
  assert.deepEqual(out.threatContext.direct, []);
  assert.deepEqual(out.threatContext.supporting, []);
  assert.equal(JSON.stringify(out.threatContext).includes('negative'), false);
});
