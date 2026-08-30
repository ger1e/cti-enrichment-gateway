import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIntelligenceKernel } from '../src/core/intelligence-kernel.js';
import { IP_INTELLIGENCE_POLICY } from '../src/core/intelligence-policy/ip.js';

const INDICATOR = '203.0.113.7';
const NOW = '2026-08-30T10:00:00.000Z';

function evidence({
  provider,
  kind = 'reputation',
  verdict = 'malicious',
  sourceRole = 'first_party',
  semanticClass = 'reputation',
  fingerprint = 'a',
  firstSeen,
  lastSeen,
} = {}) {
  const observation = { kind, verdict };
  if (firstSeen !== undefined) observation.firstSeen = firstSeen;
  if (lastSeen !== undefined) observation.lastSeen = lastSeen;
  return {
    provider,
    observation,
    semantics: { sourceRole, semanticClass },
    integrity: { fingerprint: fingerprint.repeat(64) },
  };
}

function capability(provider, state, observationTypes, sourceRole = 'community') {
  return { provider, state, observationTypes, sourceRole };
}

function build({ evidence: items = [], relationships = [], coverage = {} } = {}) {
  return buildIntelligenceKernel({
    indicator: INDICATOR,
    type: 'ip',
    evidence: items,
    relationships,
    correlation: {},
    coverage,
    now: NOW,
    policy: IP_INTELLIGENCE_POLICY,
  });
}

const current = '2026-08-29T10:00:00.000Z';
const stale = '2026-07-01T10:00:00.000Z';

test('Case A independent direct reputation plus fresh C2 becomes strong immediate hunt context', () => {
  const out = build({ evidence: [
    evidence({ provider: 'alpha', kind: 'reputation', sourceRole: 'first_party', fingerprint: '1', lastSeen: current }),
    evidence({ provider: 'beta', kind: 'ioc_reputation', sourceRole: 'specialist', fingerprint: '2', lastSeen: current }),
    evidence({ provider: 'feodo', kind: 'botnet_c2', sourceRole: 'first_party', fingerprint: '3', lastSeen: current }),
  ] });

  assert.equal(out.threatContext.state, 'supported');
  assert.equal(out.threatContext.direct.length, 3);
  assert.equal(out.evidenceStrength.level, 'strong');
  assert.deepEqual(out.evidenceStrength.reasons, ['ip_strength_strong_independent_direct']);
  assert.deepEqual(out.evidenceStrength.providers, ['alpha', 'beta', 'feodo']);
  assert.equal(out.huntRelevance.level, 'high');
  assert.equal(out.huntRelevance.directSearch, true);
  assert.deepEqual(out.huntRelevance.telemetry, ['CommonSecurityLog', 'DeviceNetworkEvents']);
  assert.equal(out.analystPriority.level, 'immediate');
  assert.deepEqual(out.analystPriority.reasons, ['ip_priority_immediate']);
  assert.deepEqual(out.analystPriority.evidenceFingerprints, ['1'.repeat(64), '2'.repeat(64), '3'.repeat(64)]);
  assert.ok(out.trace.ruleIds.includes('ip_strength_strong_independent_direct'));
  assert.ok(out.trace.ruleIds.includes('ip_priority_immediate'));
});

test('Case B infrastructure exposure and current scanner activity stays weak and monitor priority', () => {
  const out = build({ evidence: [
    evidence({ provider: 'rdap', kind: 'registration', verdict: 'observed', sourceRole: 'authoritative', semanticClass: 'network_context', fingerprint: '1', lastSeen: current }),
    evidence({ provider: 'shodan', kind: 'internet_exposure', verdict: 'observed', sourceRole: 'specialist', semanticClass: 'infrastructure_context', fingerprint: '2', lastSeen: current }),
    evidence({ provider: 'greynoise', kind: 'scanner_activity', verdict: 'observed', sourceRole: 'first_party', semanticClass: 'scanner_context', fingerprint: '3', lastSeen: current }),
  ] });

  assert.equal(out.threatContext.state, 'context_only');
  assert.equal(out.threatContext.direct.length, 0);
  assert.equal(out.threatContext.infrastructure.length, 1);
  assert.equal(out.threatContext.exposure.length, 1);
  assert.equal(out.threatContext.scannerNoise.length, 1);
  assert.equal(out.evidenceStrength.level, 'weak');
  assert.deepEqual(out.evidenceStrength.reasons, ['ip_strength_weak_context_or_conflict']);
  assert.equal(out.huntRelevance.level, 'medium');
  assert.equal(out.huntRelevance.directSearch, true);
  assert.equal(out.analystPriority.level, 'monitor');
  assert.deepEqual(out.analystPriority.reasons, ['ip_priority_monitor']);
});

test('single-source positive direct threat remains moderate investigate with explicit limitation', () => {
  const out = build({ evidence: [
    evidence({ provider: 'alpha', kind: 'reputation', fingerprint: '4', lastSeen: current }),
  ] });

  assert.equal(out.threatContext.state, 'single_source');
  assert.equal(out.evidenceStrength.level, 'moderate');
  assert.deepEqual(out.evidenceStrength.reasons, ['ip_strength_moderate_direct']);
  assert.equal(out.huntRelevance.level, 'high');
  assert.equal(out.analystPriority.level, 'investigate');
  assert.ok(out.limitations.includes('single_source_threat_support'));
});

test('explicit negative direct threat stays negative and maps to monitor without invented positive support', () => {
  const out = build({ evidence: [
    evidence({ provider: 'alpha', kind: 'reputation', verdict: 'benign', fingerprint: '5', lastSeen: current }),
  ] });

  assert.equal(out.threatContext.state, 'negative');
  assert.equal(out.threatContext.direct.length, 1);
  assert.equal(out.threatContext.direct[0].polarity, 'negative');
  assert.equal(out.evidenceStrength.level, 'weak');
  assert.equal(out.analystPriority.level, 'monitor');
  assert.equal(out.threatContext.direct.some(item => item.polarity === 'positive'), false);
});

test('direct positive and negative evidence remains contradicted weak and investigate priority', () => {
  const out = build({ evidence: [
    evidence({ provider: 'alpha', kind: 'reputation', verdict: 'malicious', fingerprint: '6', lastSeen: current }),
    evidence({ provider: 'beta', kind: 'reputation', verdict: 'benign', sourceRole: 'specialist', fingerprint: '7', lastSeen: current }),
  ] });

  assert.equal(out.threatContext.state, 'contradicted');
  assert.equal(out.contradiction.level, 'high');
  assert.equal(out.evidenceStrength.level, 'weak');
  assert.equal(out.analystPriority.level, 'investigate');
  assert.ok(out.limitations.includes('contradictory_threat_evidence'));
});

test('stale infrastructure-only evidence stays weak contextual and surfaces both limitations', () => {
  const out = build({ evidence: [
    evidence({ provider: 'rdap', kind: 'registration', verdict: 'observed', sourceRole: 'authoritative', semanticClass: 'network_context', fingerprint: '8', lastSeen: stale }),
  ] });

  assert.equal(out.threatContext.state, 'context_only');
  assert.equal(out.temporalRelevance.overall, 'stale');
  assert.equal(out.evidenceStrength.level, 'weak');
  assert.equal(out.analystPriority.level, 'contextual');
  assert.ok(out.limitations.includes('stale_evidence_only'));
  assert.ok(out.limitations.includes('infrastructure_only_evidence'));
});

test('current infrastructure-only evidence is contextual rather than threat support', () => {
  const out = build({ evidence: [
    evidence({ provider: 'rdap', kind: 'registration', verdict: 'observed', sourceRole: 'authoritative', semanticClass: 'network_context', fingerprint: '9', lastSeen: current }),
    evidence({ provider: 'ripestat', kind: 'routing', verdict: 'observed', sourceRole: 'authoritative', semanticClass: 'network_context', fingerprint: 'a', lastSeen: current }),
  ] });

  assert.equal(out.threatContext.state, 'context_only');
  assert.equal(out.evidenceStrength.level, 'weak');
  assert.equal(out.analystPriority.level, 'contextual');
  assert.ok(out.limitations.includes('infrastructure_only_evidence'));
  assert.equal(out.limitations.includes('single_source_threat_support'), false);
});

test('material direct-threat capability loss prevents strong confidence and remains a limitation only', () => {
  const out = build({
    evidence: [
      evidence({ provider: 'alpha', kind: 'reputation', sourceRole: 'first_party', fingerprint: 'b', lastSeen: current }),
      evidence({ provider: 'beta', kind: 'ioc_reputation', sourceRole: 'specialist', fingerprint: 'c', lastSeen: current }),
    ],
    coverage: {
      providerCapabilities: [
        capability('alpha', 'ok', ['reputation'], 'first_party'),
        capability('beta', 'ok', ['ioc_reputation'], 'specialist'),
        capability('threatfox', 'failed', ['botnet_c2'], 'first_party'),
      ],
    },
  });

  assert.equal(out.coverageImpact.level, 'material');
  assert.notEqual(out.evidenceStrength.level, 'strong');
  assert.ok(out.limitations.includes('material_coverage_loss'));
  assert.equal(JSON.stringify(out.threatContext).includes('threatfox'), false);
});

test('unknown observation time is explicit and retrieval state never upgrades analyst priority', () => {
  const out = build({ evidence: [
    evidence({ provider: 'alpha', kind: 'reputation', fingerprint: 'd' }),
  ] });

  assert.equal(out.temporalRelevance.overall, 'unknown');
  assert.ok(out.limitations.includes('unknown_observation_time'));
  assert.equal(out.analystPriority.level, 'investigate');
});

test('priority reasons are deterministic rule IDs and evidence-backed priorities carry fingerprints', () => {
  const out = build({ evidence: [
    evidence({ provider: 'alpha', kind: 'reputation', sourceRole: 'first_party', fingerprint: 'e', lastSeen: current }),
    evidence({ provider: 'beta', kind: 'ioc_reputation', sourceRole: 'specialist', fingerprint: 'f', lastSeen: current }),
  ] });

  assert.ok(out.analystPriority.reasons.length > 0);
  assert.ok(out.analystPriority.reasons.every(reason => /^ip_priority_[a-z0-9_]+$/.test(reason)));
  assert.ok(out.analystPriority.evidenceFingerprints.length > 0);
  assert.deepEqual(out.trace.ruleIds, [...out.trace.ruleIds].sort());
});
