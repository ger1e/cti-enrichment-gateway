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
