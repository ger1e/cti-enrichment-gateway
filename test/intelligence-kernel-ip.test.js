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
  const evidence = [{
    provider: 'fixture',
    observation: { kind: 'reputation', verdict: 'malicious', attributes: { nested: ['x'] } },
    semantics: { sourceRole: 'first_party', semanticClass: 'reputation' },
    integrity: { fingerprint: 'a'.repeat(64) },
  }];
  const relationships = [{ type: 'domain', source: '203.0.113.7', target: 'evil.example', targetType: 'domain', provider: 'fixture' }];
  const correlation = { limitations: ['fixture_limit'], nested: { values: [1, 2] } };
  const coverage = { materialLoss: false, selectedProviders: ['fixture'], nested: { values: [3, 4] } };
  const before = structuredClone({ evidence, relationships, correlation, coverage });

  build({ evidence, relationships, correlation, coverage });

  assert.deepEqual({ evidence, relationships, correlation, coverage }, before);
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
