import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEvidenceGraph } from '../src/core/evidence-graph.js';
import { buildGuidance, GUIDANCE_SCHEMA_VERSION } from '../src/core/guidance.js';

const A = 'a'.repeat(64);
const B = 'b'.repeat(64);

function graph() {
  return buildEvidenceGraph({
    indicator: 'evil.example',
    type: 'domain',
    evidence: [
      { provider: 'a', indicator: 'evil.example', type: 'domain', observation: { kind: 'reputation', verdict: 'malicious', attributes: { attackIds: ['T1105'] } }, integrity: { fingerprint: A } },
      { provider: 'b', indicator: 'evil.example', type: 'domain', observation: { kind: 'reputation', verdict: 'malicious', attributes: {} }, integrity: { fingerprint: B } },
    ],
    relationships: [],
    correlation: {},
    decision: { attackMappings: [{ id: 'T1105', evidenceFingerprints: [A] }] },
  });
}

function decision(overrides = {}) {
  return {
    version: '1.0',
    disposition: 'hunt_now',
    confidence: 'high',
    reasons: ['supported_threat_evidence'],
    assessment: {
      disposition: 'hunt_now', confidence: 'high', reasons: ['supported_threat_evidence'],
      evidenceQuality: 'high', threatState: 'supported', freshness: 'current', huntability: 'high', coverageMaterialLoss: false,
    },
    telemetry: { status: 'ready', requiredTables: ['DeviceNetworkEvents'], environmentValidated: false, notes: ['schema_level_template_only'] },
    attackMappings: [{ id: 'T1105', bases: ['evidence'], providers: ['a'], evidenceFingerprints: [A] }],
    huntPlan: [{ id: 'subject-domain-1', priority: 'high', hypothesis: 'Search it', telemetry: ['DeviceNetworkEvents'], evidenceFingerprints: [A, B], kql: 'DeviceNetworkEvents', falsePositives: [], tuning: [] }],
    ...overrides,
  };
}

function correlation(overrides = {}) {
  return {
    contradictions: [],
    limitations: [],
    freshness: { overall: 'current', items: [{ provider: 'a', observationClass: 'current' }] },
    evidenceQuality: { level: 'high', evidenceCount: 2, providerCount: 2 },
    threatAssessment: { state: 'supported', assessmentBasis: { providers: ['a', 'b'], semanticClasses: ['reputation'] } },
    huntability: { level: 'high', reason: 'direct_network_or_url_search' },
    ...overrides,
  };
}

function semanticDiff(categories) {
  return {
    version: '1.0', indicator: 'evil.example', type: 'domain', changed: categories.length > 0,
    summary: { added: 0, removed: 0, changed: categories.length, total: categories.length },
    changes: categories.map((category, index) => ({ category, key: `k${index}`, before: null, after: { value: index }, providers: [], evidenceFingerprints: [] })),
  };
}

test('guidance inherits decision semantics and keeps analyst axes distinct', () => {
  const out = buildGuidance({ decision: decision(), correlation: correlation(), evidenceGraph: graph() });

  assert.equal(GUIDANCE_SCHEMA_VERSION, '1.0');
  assert.equal(out.schemaVersion, '1.0');
  assert.equal(out.disposition, 'hunt_now');
  assert.equal(out.confidence, 'high');
  assert.deepEqual(out.reasons, ['supported_threat_evidence']);
  assert.deepEqual(out.evidenceFingerprints, [A, B]);
  assert.deepEqual(out.contradictions, []);
  assert.deepEqual(out.limitations, []);
  assert.equal(out.freshness.overall, 'current');
  assert.deepEqual(out.coverage, { materialLoss: false });
  assert.equal(out.telemetry.status, 'ready');
  assert.equal(out.attackMappings[0].id, 'T1105');
  assert.equal(out.hunts[0].id, 'subject-domain-1');
  assert.equal(out.change, null);
  assert.equal('score' in out, false);
  assert.equal('severity' in out, false);
  assert.equal(JSON.stringify(out).toLowerCase().includes('weighted'), false);
});

test('infrastructure-only decision remains context_only without guidance reinterpretation', () => {
  const d = decision({
    disposition: 'context_only', confidence: 'medium', reasons: ['infrastructure_only_evidence'],
    assessment: { disposition: 'context_only', confidence: 'medium', reasons: ['infrastructure_only_evidence'], evidenceQuality: 'medium', threatState: 'insufficient', freshness: 'unknown', huntability: 'medium', coverageMaterialLoss: false },
    huntPlan: [], attackMappings: [],
  });
  const c = correlation({
    limitations: ['infrastructure_only_evidence'],
    freshness: { overall: 'unknown', items: [] },
    threatAssessment: { state: 'insufficient', assessmentBasis: { providers: [], semanticClasses: [] } },
  });
  const out = buildGuidance({ decision: d, correlation: c, evidenceGraph: graph() });
  assert.equal(out.disposition, 'context_only');
  assert.deepEqual(out.limitations, ['infrastructure_only_evidence']);
});

test('semantic change attention uses only the approved forcing categories', () => {
  const forcing = [
    'decision_changed', 'contradiction_changed', 'semantic_claim_changed', 'provider_state_changed',
    'attack_mapping_changed', 'huntability_changed', 'telemetry_changed',
  ];
  const informational = [
    'evidence_added', 'evidence_removed', 'provider_coverage_changed',
    'relationship_added', 'relationship_removed', 'freshness_changed',
  ];

  for (const category of forcing) {
    const out = buildGuidance({ decision: decision(), correlation: correlation(), evidenceGraph: graph(), semanticDiff: semanticDiff([category]) });
    assert.equal(out.change.attentionRequired, true, category);
    assert.deepEqual(out.change.categories, [category]);
    assert.equal(out.change.explanations.length, 1);
  }
  const info = buildGuidance({ decision: decision(), correlation: correlation(), evidenceGraph: graph(), semanticDiff: semanticDiff(informational) });
  assert.equal(info.change.attentionRequired, false);
  assert.deepEqual(info.change.categories, informational);
  assert.equal(info.change.explanations.length, informational.length);
});

test('every referenced guidance fingerprint must resolve to a graph evidence node', () => {
  const bad = decision({
    huntPlan: [{ id: 'bad', evidenceFingerprints: ['c'.repeat(64)], telemetry: [], hypothesis: 'bad', kql: null }],
  });
  assert.throws(
    () => buildGuidance({ decision: bad, correlation: correlation(), evidenceGraph: graph() }),
    /guidance_evidence_reference_invalid/,
  );
});

test('contradictions limitations freshness coverage telemetry ATT&CK and hunts remain separate fields', () => {
  const d = decision({
    assessment: { disposition: 'investigate', confidence: 'low', reasons: ['material_coverage_loss'], evidenceQuality: 'medium', threatState: 'contradicted', freshness: 'stale', huntability: 'high', coverageMaterialLoss: true },
    disposition: 'investigate', confidence: 'low', reasons: ['material_coverage_loss'],
  });
  const c = correlation({
    contradictions: [{ semanticClass: 'reputation', providers: ['a', 'b'] }],
    limitations: ['material_coverage_loss', 'stale_evidence_only'],
    freshness: { overall: 'stale', items: [] },
  });
  const out = buildGuidance({ decision: d, correlation: c, evidenceGraph: graph() });
  assert.equal(out.disposition, 'investigate');
  assert.equal(out.confidence, 'low');
  assert.equal(out.contradictions.length, 1);
  assert.deepEqual(out.limitations, ['material_coverage_loss', 'stale_evidence_only']);
  assert.equal(out.freshness.overall, 'stale');
  assert.deepEqual(out.coverage, { materialLoss: true });
  assert.ok(Array.isArray(out.attackMappings));
  assert.ok(Array.isArray(out.hunts));
});
