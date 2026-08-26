import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDecisionSupport } from '../src/core/decision-engine.js';

function e(provider, kind, verdict, {
  firstSeen = null,
  lastSeen = null,
  attributes = {},
  malwareFamily = null,
  actor = null,
  fingerprint = `${provider}`.padEnd(64, '0').slice(0, 64),
} = {}) {
  return {
    provider,
    observation: { kind, verdict, firstSeen, lastSeen, attributes, malwareFamily, actor },
    integrity: { fingerprint },
    retrievedAt: '2026-08-26T18:00:00Z',
  };
}

function correlation(overrides = {}) {
  return {
    evidenceQuality: { level: 'high', evidenceCount: 2, providerCount: 2, currentCount: 2, agingCount: 0, staleCount: 0, unknownFreshnessCount: 0, contradictionCount: 0 },
    threatAssessment: { state: 'supported', assessmentBasis: { providers: ['a', 'b'], semanticClasses: ['reputation'] } },
    freshness: { overall: 'current', items: [] },
    huntability: { level: 'high', reason: 'direct_file_and_process_search' },
    contradictions: [],
    limitations: [],
    relationships: [],
    ...overrides,
  };
}

test('supported current hash evidence becomes an explainable hunt-now decision with bounded KQL', () => {
  const evidence = [
    e('a', 'reputation', 'malicious', { lastSeen: '2026-08-26T17:00:00Z' }),
    e('b', 'ioc_reputation', 'malicious', { lastSeen: '2026-08-26T16:00:00Z' }),
  ];
  const out = buildDecisionSupport({
    indicator: 'a'.repeat(64), type: 'hash', evidence, relationships: [],
    correlation: correlation(), coverage: { materialLoss: false }, limitations: [], now: '2026-08-26T18:00:00Z',
  });

  assert.equal(out.disposition, 'hunt_now');
  assert.equal(out.confidence, 'high');
  assert.equal(out.telemetry.status, 'ready');
  assert.ok(out.telemetry.requiredTables.includes('DeviceProcessEvents'));
  assert.ok(out.huntPlan[0].kql.includes('DeviceProcessEvents'));
  assert.ok(out.huntPlan[0].kql.includes('DeviceFileEvents'));
  assert.equal('score' in out, false);
  assert.equal(JSON.stringify(out).toLowerCase().includes('maliciousness'), false);
});

test('infrastructure-only context never becomes a threat disposition', () => {
  const evidence = [e('shodan', 'internet_exposure', 'observed'), e('rdap', 'registration', 'observed')];
  const out = buildDecisionSupport({
    indicator: '198.51.100.10', type: 'ip', evidence,
    relationships: [{ type: 'asn', source: '198.51.100.10', target: 'AS64500', provider: 'shodan' }],
    correlation: correlation({
      evidenceQuality: { level: 'medium', evidenceCount: 2, providerCount: 2, currentCount: 0, agingCount: 0, staleCount: 0, unknownFreshnessCount: 2, contradictionCount: 0 },
      threatAssessment: { state: 'insufficient', assessmentBasis: { providers: [], semanticClasses: [] } },
      freshness: { overall: 'unknown', items: [] },
      limitations: ['infrastructure_only_evidence'],
    }),
    coverage: { materialLoss: false }, limitations: ['infrastructure_only_evidence'], now: '2026-08-26T18:00:00Z',
  });

  assert.equal(out.disposition, 'context_only');
  assert.ok(out.reasons.includes('infrastructure_only_evidence'));
  assert.equal(out.entityGraph.edges[0].provider, 'shodan');
});

test('contradiction, staleness and material coverage loss downgrade decision confidence', () => {
  const out = buildDecisionSupport({
    indicator: 'evil.example', type: 'domain', evidence: [e('a', 'reputation', 'malicious', { lastSeen: '2026-05-01T00:00:00Z' }), e('b', 'reputation', 'benign', { lastSeen: '2026-05-01T00:00:00Z' })], relationships: [],
    correlation: correlation({
      evidenceQuality: { level: 'medium', evidenceCount: 2, providerCount: 2, currentCount: 0, agingCount: 0, staleCount: 2, unknownFreshnessCount: 0, contradictionCount: 1 },
      threatAssessment: { state: 'contradicted', assessmentBasis: { providers: ['a', 'b'], semanticClasses: ['reputation'] } },
      freshness: { overall: 'stale', items: [] },
      contradictions: [{ semanticClass: 'reputation', providers: ['a', 'b'] }],
      limitations: ['contradictory_threat_evidence', 'stale_evidence_only'],
    }),
    coverage: { materialLoss: true }, limitations: ['contradictory_threat_evidence', 'stale_evidence_only', 'material_coverage_loss'], now: '2026-08-26T18:00:00Z',
  });

  assert.equal(out.disposition, 'investigate');
  assert.equal(out.confidence, 'low');
  assert.ok(out.reasons.includes('material_coverage_loss'));
});

test('CVE decisions preserve KEV EPSS CVSS separation and generate TVM validation KQL', () => {
  const out = buildDecisionSupport({
    indicator: 'CVE-2026-12345', type: 'cve', evidence: [e('cisa-kev', 'known_exploited', 'known_exploited'), e('epss', 'exploit_probability', 'scored')], relationships: [],
    correlation: correlation({
      threatAssessment: { state: 'not_applicable', assessmentBasis: { providers: [], semanticClasses: [] } },
      huntability: { level: 'medium', reason: 'requires_exposure_or_behavior_telemetry' },
      riskAxes: { kev: { listed: true, ransomwareUse: 'Known', provider: 'cisa-kev' }, epss: { score: 0.91, percentile: 0.99, provider: 'epss' }, cvss: { score: 9.8, provider: 'nvd' } },
    }),
    coverage: { materialLoss: false }, limitations: [], now: '2026-08-26T18:00:00Z',
  });

  assert.equal(out.disposition, 'investigate');
  assert.deepEqual(out.riskAxes.kev, { listed: true, ransomwareUse: 'Known', provider: 'cisa-kev' });
  assert.ok(out.huntPlan[0].kql.includes('DeviceTvmSoftwareVulnerabilities'));
  assert.ok(out.reasons.includes('known_exploited_cve'));
});

test('ATT&CK mappings and temporal summary come only from explicit subject or evidence fields', () => {
  const evidence = [e('source-a', 'threat_intelligence', 'malicious', {
    firstSeen: '2026-08-20T00:00:00Z', lastSeen: '2026-08-25T00:00:00Z', attributes: { attackIds: ['T1059.001', 'T1105'] }, actor: 'Example Actor', malwareFamily: 'ExampleRAT',
  })];
  const out = buildDecisionSupport({
    indicator: 'example.test', type: 'domain', evidence,
    relationships: [{ type: 'uses', source: 'Example Actor', target: 'ExampleRAT', targetType: 'malware', provider: 'source-a' }],
    correlation: correlation({ evidenceQuality: { level: 'low', evidenceCount: 1, providerCount: 1, currentCount: 1, agingCount: 0, staleCount: 0, unknownFreshnessCount: 0, contradictionCount: 0 }, threatAssessment: { state: 'insufficient', assessmentBasis: { providers: ['source-a'], semanticClasses: ['reputation'] } } }),
    coverage: { materialLoss: false }, limitations: ['single_source_threat_support'], now: '2026-08-26T18:00:00Z',
  });

  assert.deepEqual(out.attackMappings.map(x => x.id), ['T1059.001', 'T1105']);
  assert.equal(out.temporal.firstSeen, '2026-08-20T00:00:00.000Z');
  assert.equal(out.temporal.lastSeen, '2026-08-25T00:00:00.000Z');
  assert.ok(out.entityGraph.nodes.some(node => node.type === 'actor' && node.value === 'Example Actor'));
  assert.ok(out.entityGraph.nodes.some(node => node.type === 'malware' && node.value === 'ExampleRAT'));
});
