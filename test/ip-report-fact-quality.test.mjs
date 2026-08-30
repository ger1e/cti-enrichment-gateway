import test from 'node:test';
import assert from 'node:assert/strict';
import * as viewModel from '../app/view-model.js';

test('analyst fact labels split camelCase into readable words', () => {
  const rows = viewModel.toFactRows({ abuseConfidenceScore: 80, totalReports: 73, lastReportedAt: '2026-08-29T18:00:00.000Z' });
  assert.deepEqual(rows.map(row => row.label), ['ABUSE CONFIDENCE SCORE', 'TOTAL REPORTS', 'LAST REPORTED AT']);
});

test('IP section aggregation never leaks reputation report fields into exposure or scanner sections', () => {
  const envelope = {
    indicator: '203.0.113.42', type: 'ip', profile: 'full', status: 'ok', durationMs: 100,
    providerSummary: { ok: 2, failed: 0, skipped: 0, cached: 0 }, failures: [], relationships: [],
    evidence: [
      { provider: 'shodan', observation: { kind: 'internet_exposure', verdict: 'observed', attributes: { ports: [22], services: ['ssh'] } }, references: [], integrity: {} },
      { provider: 'abuseipdb', observation: { kind: 'abuse_reports', verdict: 'observed', attributes: { totalReports: 73, abuseConfidenceScore: 80 } }, references: [], integrity: {} },
    ],
    correlation: { freshness: 'current', huntability: { level: 'high' }, corroboration: [], contradictions: [], riskAxes: {} },
  };
  const report = viewModel.buildIpAnalystReport({
    overview: viewModel.buildOverview(envelope),
    evidence: viewModel.buildEvidence(envelope),
    correlation: viewModel.buildCorrelation(envelope),
    relationships: viewModel.buildRelationships(envelope),
    coverage: viewModel.buildCoverage(envelope),
  });
  const exposureLabels = report.sections.find(section => section.id === 'exposure').facts.map(fact => fact.label);
  const scannerLabels = report.sections.find(section => section.id === 'tor-scanner').facts.map(fact => fact.label);
  assert.ok(!exposureLabels.some(label => /TOTAL\s*REPORTS|ABUSE\s*CONFIDENCE/i.test(label)));
  assert.ok(!scannerLabels.some(label => /TOTAL\s*REPORTS|ABUSE\s*CONFIDENCE/i.test(label)));
});

test('kernel-derived context never becomes a raw evidence card and provider failure semantics stay operational', () => {
  const envelope = {
    indicator: '203.0.113.42', type: 'ip', profile: 'full', status: 'partial', durationMs: 100,
    providerSummary: { ok: 1, failed: 1, skipped: 0, cached: 0 },
    failures: [{ provider: 'webamon', reason: 'timeout' }], relationships: [],
    evidence: [
      { provider: 'abuseipdb', observation: { kind: 'abuse_reports', verdict: 'observed', attributes: { totalReports: 73 } }, references: [], integrity: { fingerprint: 'a'.repeat(64) } },
    ],
    correlation: { freshness: 'current', huntability: { level: 'high' }, corroboration: [], contradictions: [], limitations: [], riskAxes: {} },
    intelligence: {
      schemaVersion: '1.0', policy: { type: 'ip', version: '1.0' }, type: 'ip', indicator: '203.0.113.42',
      evidenceStrength: { level: 'moderate', reasons: ['ip_strength_single_direct'], providers: ['abuseipdb'], evidenceFingerprints: ['a'.repeat(64)] },
      threatContext: { state: 'single_source', direct: [{ provider: 'abuseipdb' }], supporting: [], scannerNoise: [], torProxy: [], infrastructure: [], exposure: [] },
      corroboration: [], contradiction: { level: 'none', items: [] },
      temporalRelevance: { firstSeen: null, lastSeen: null, ageDays: null, activeSpanDays: null, overall: 'unknown', distribution: { current: 0, aging: 0, stale: 0, unknown: 1 } },
      relationshipValue: [], pivotCandidates: [],
      huntRelevance: { level: 'high', directSearch: true, telemetry: ['DeviceNetworkEvents'], pivotCount: 0, evidenceFingerprints: ['a'.repeat(64)], ruleIds: ['ip_hunt_high_direct'] },
      coverageImpact: { level: 'degraded', uniqueCapabilityLoss: [], duplicateCoverageLoss: ['web_intelligence'], reasons: ['ip_coverage_duplicate_loss'] },
      analystPriority: { level: 'investigate', reasons: ['ip_priority_single_source'], evidenceFingerprints: ['a'.repeat(64)] },
      limitations: ['partial_provider_failure'], trace: { ruleIds: ['ip_priority_single_source'] },
    },
  };
  const evidence = viewModel.buildEvidence(envelope);
  const report = viewModel.buildIpAnalystReport({
    overview: viewModel.buildOverview(envelope),
    evidence,
    correlation: viewModel.buildCorrelation(envelope),
    relationships: viewModel.buildRelationships(envelope),
    coverage: viewModel.buildCoverage(envelope),
  });

  assert.equal(evidence.length, 1);
  assert.equal(evidence[0].provider, 'abuseipdb');
  assert.ok(!report.sections.flatMap(section => section.items || []).some(item => item.provider === 'intelligence-kernel'));
  const coverage = report.sections.find(section => section.id === 'coverage');
  assert.equal(coverage.failures[0].label, 'UPSTREAM TIMEOUT');
  assert.doesNotMatch(`${coverage.failures[0].label} ${coverage.failures[0].summary}`, /benign|malicious/i);
});
