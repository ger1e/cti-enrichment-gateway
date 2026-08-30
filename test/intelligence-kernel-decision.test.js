import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDecisionSupport } from '../src/core/decision-engine.js';

const NOW = '2026-08-30T10:00:00.000Z';
const INDICATOR = '203.0.113.7';
const FP = 'a'.repeat(64);

function evidence() {
  return [{
    provider: 'alpha',
    observation: {
      kind: 'reputation',
      verdict: 'malicious',
      lastSeen: '2026-08-29T10:00:00.000Z',
      attributes: { attackIds: ['T1071.001'] },
    },
    integrity: { fingerprint: FP },
  }];
}

function correlation() {
  return {
    limitations: [],
    evidenceQuality: { level: 'medium' },
    threatAssessment: { state: 'supported', assessmentBasis: { providers: ['alpha'] } },
    freshness: { overall: 'current' },
    huntability: { level: 'high' },
  };
}

function intelligence({ priority = 'immediate', strength = 'strong', limitations = [] } = {}) {
  return {
    schemaVersion: '1.0',
    type: 'ip',
    policy: { type: 'ip', version: '1.0' },
    analystPriority: {
      level: priority,
      reasons: [`ip_priority_${priority}`],
      evidenceFingerprints: [FP],
    },
    evidenceStrength: {
      level: strength,
      reasons: [`ip_strength_${strength}`],
      providers: ['alpha'],
      evidenceFingerprints: [FP],
    },
    threatContext: { state: 'supported' },
    limitations,
    trace: { ruleIds: [`ip_priority_${priority}`, `ip_strength_${strength}`] },
  };
}

function build(extra = {}) {
  return buildDecisionSupport({
    indicator: INDICATOR,
    type: 'ip',
    evidence: evidence(),
    relationships: [{
      type: 'hostname',
      source: INDICATOR,
      target: 'pivot.example',
      targetType: 'domain',
      provider: 'alpha',
    }],
    correlation: correlation(),
    coverage: { materialLoss: false },
    limitations: [],
    now: NOW,
    ...extra,
  });
}

for (const [priority, expected] of Object.entries({
  immediate: 'hunt_now',
  investigate: 'investigate',
  monitor: 'monitor',
  contextual: 'context_only',
  insufficient: 'insufficient',
})) {
  test(`kernel analyst priority ${priority} maps to decision disposition ${expected}`, () => {
    const out = build({ intelligence: intelligence({ priority }) });
    assert.equal(out.disposition, expected);
    assert.equal(out.assessment.disposition, expected);
  });
}

for (const [strength, expected] of Object.entries({ strong: 'high', moderate: 'medium', weak: 'low', none: 'low' })) {
  test(`kernel evidence strength ${strength} maps to decision confidence ${expected}`, () => {
    const out = build({ intelligence: intelligence({ strength }) });
    assert.equal(out.confidence, expected);
    assert.equal(out.assessment.confidence, expected);
  });
}

test('kernel decision reasons contain priority strength rule IDs and normalized limitations', () => {
  const out = build({
    limitations: ['partial_provider_failure'],
    intelligence: intelligence({
      priority: 'investigate',
      strength: 'moderate',
      limitations: ['single_source_threat_support'],
    }),
  });

  assert.deepEqual(out.reasons, [
    'ip_priority_investigate',
    'ip_strength_moderate',
    'partial_provider_failure',
    'single_source_threat_support',
  ]);
  assert.equal(out.assessment.intelligenceVersion, '1.0');
  assert.equal(out.assessment.intelligencePolicyVersion, '1.0');
});

test('kernel-aware decision keeps existing telemetry ATT&CK graph and hunt machinery', () => {
  const out = build({ intelligence: intelligence() });

  assert.deepEqual(out.telemetry.requiredTables, ['DeviceNetworkEvents', 'CommonSecurityLog']);
  assert.equal(out.telemetry.environmentValidated, false);
  assert.deepEqual(out.attackMappings, [{
    id: 'T1071.001',
    bases: ['evidence'],
    providers: ['alpha'],
    evidenceFingerprints: [FP],
  }]);
  assert.ok(out.entityGraph.nodes.some(node => node.type === 'domain' && node.value === 'pivot.example'));
  assert.equal(out.huntPlan.length, 2);
  assert.equal(out.huntPlan[0].priority, 'high');
  assert.match(out.huntPlan[0].kql, /DeviceNetworkEvents/);
  assert.match(out.huntPlan[1].kql, /pivot\.example/);
});

test('absent malformed wrong-version and wrong-type intelligence preserve the legacy decision byte-for-byte', () => {
  const legacy = build();
  const variants = [
    { schemaVersion: '1.0', type: 'ip' },
    { ...intelligence(), schemaVersion: '2.0' },
    { ...intelligence(), type: 'domain', policy: { type: 'domain', version: '1.0' } },
  ];

  for (const candidate of variants) {
    assert.deepEqual(build({ intelligence: candidate }), legacy);
  }
});
