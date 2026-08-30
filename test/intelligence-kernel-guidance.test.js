import test from 'node:test';
import assert from 'node:assert/strict';
import { buildEvidenceGraph } from '../src/core/evidence-graph.js';
import { buildGuidance } from '../src/core/guidance.js';

const FP = 'a'.repeat(64);

function graph() {
  return buildEvidenceGraph({
    indicator: '203.0.113.7',
    type: 'ip',
    evidence: [{
      provider: 'alpha', indicator: '203.0.113.7', type: 'ip',
      observation: { kind: 'reputation', verdict: 'malicious', attributes: { attackIds: ['T1071.001'] } },
      integrity: { fingerprint: FP },
    }],
    relationships: [],
    correlation: {},
    decision: { attackMappings: [{ id: 'T1071.001', evidenceFingerprints: [FP] }] },
  });
}

function decision(overrides = {}) {
  return {
    version: '1.0',
    disposition: 'hunt_now',
    confidence: 'high',
    reasons: ['ip_priority_immediate', 'ip_strength_strong_independent_direct'],
    assessment: {
      disposition: 'hunt_now', confidence: 'high', reasons: [], evidenceQuality: 'high',
      threatState: 'supported', freshness: 'current', huntability: 'high', coverageMaterialLoss: false,
      intelligenceVersion: '1.0', intelligencePolicyVersion: '1.0',
    },
    telemetry: { status: 'ready', requiredTables: ['DeviceNetworkEvents', 'CommonSecurityLog'], environmentValidated: false, notes: [] },
    attackMappings: [{ id: 'T1071.001', bases: ['evidence'], providers: ['alpha'], evidenceFingerprints: [FP] }],
    huntPlan: [{ id: 'subject-ip-1', priority: 'high', hypothesis: 'Search it', telemetry: ['DeviceNetworkEvents'], evidenceFingerprints: [FP], kql: 'DeviceNetworkEvents', falsePositives: [], tuning: [] }],
    ...overrides,
  };
}

function correlation() {
  return {
    contradictions: [],
    limitations: ['single_source_threat_support'],
    freshness: { overall: 'current', items: [] },
  };
}

function intelligence() {
  return {
    schemaVersion: '1.0',
    type: 'ip',
    policy: { type: 'ip', version: '1.0' },
    evidenceStrength: { level: 'strong', reasons: ['ip_strength_strong_independent_direct'], providers: ['alpha'], evidenceFingerprints: [FP] },
    analystPriority: { level: 'immediate', reasons: ['ip_priority_immediate'], evidenceFingerprints: [FP] },
    threatContext: {
      state: 'supported',
      direct: [{ provider: 'alpha', kind: 'reputation', evidenceFingerprints: [FP] }],
      supporting: [], scannerNoise: [], torProxy: [], infrastructure: [], exposure: [],
    },
    coverageImpact: { level: 'none', uniqueCapabilityLoss: [], duplicateCoverageLoss: [], reasons: [] },
    limitations: ['single_source_threat_support'],
    trace: { ruleIds: ['ip_priority_immediate', 'ip_strength_strong_independent_direct'] },
    relationshipValue: [{ id: 'must-not-copy', target: 'pivot.example' }],
    pivotCandidates: [{ value: 'pivot.example' }],
  };
}

test('guidance exposes only a bounded deeply frozen intelligence summary', () => {
  const out = buildGuidance({ decision: decision(), correlation: correlation(), evidenceGraph: graph(), intelligence: intelligence() });

  assert.deepEqual(out.intelligence, {
    schemaVersion: '1.0',
    evidenceStrength: 'strong',
    analystPriority: 'immediate',
    threatState: 'supported',
    coverageImpact: 'none',
    limitations: ['single_source_threat_support'],
    ruleIds: ['ip_priority_immediate', 'ip_strength_strong_independent_direct'],
  });
  assert.equal(Object.isFrozen(out.intelligence), true);
  assert.equal(Object.isFrozen(out.intelligence.limitations), true);
  assert.equal(Object.isFrozen(out.intelligence.ruleIds), true);
  const serialized = JSON.stringify(out.intelligence);
  assert.equal(serialized.includes('must-not-copy'), false);
  assert.equal(serialized.includes('pivot.example'), false);
  assert.equal(serialized.includes('"direct":'), false);
  assert.deepEqual(Object.keys(out.intelligence).sort(), [
    'analystPriority', 'coverageImpact', 'evidenceStrength', 'limitations', 'ruleIds', 'schemaVersion', 'threatState',
  ]);
});

test('intelligence never weakens evidence graph fingerprint validation', () => {
  const bad = decision({
    huntPlan: [{ id: 'bad', priority: 'high', hypothesis: 'bad', telemetry: [], evidenceFingerprints: ['c'.repeat(64)], kql: null, falsePositives: [], tuning: [] }],
  });
  assert.throws(
    () => buildGuidance({ decision: bad, correlation: correlation(), evidenceGraph: graph(), intelligence: intelligence() }),
    /guidance_evidence_reference_invalid/,
  );
});

test('absent or malformed intelligence preserves the existing guidance shape', () => {
  const base = buildGuidance({ decision: decision(), correlation: correlation(), evidenceGraph: graph() });
  assert.equal('intelligence' in base, false);

  for (const malformed of [
    {},
    { schemaVersion: '2.0' },
    { schemaVersion: '1.0', evidenceStrength: { level: 'strong' } },
  ]) {
    const out = buildGuidance({ decision: decision(), correlation: correlation(), evidenceGraph: graph(), intelligence: malformed });
    assert.deepEqual(out, base);
  }
});
