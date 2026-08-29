import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as viewModel from '../app/view-model.js';

const sample = {
  indicator: '203.0.113.42',
  type: 'ip',
  requestId: 'req-ip-depth',
  profile: 'full',
  status: 'partial',
  queriedAt: '2026-08-30T00:30:00.000Z',
  durationMs: 5180,
  providerSummary: { ok: 6, failed: 1, skipped: 0, cached: 1 },
  failures: [{ provider: 'webamon', reason: 'timeout', attempts: 2, retrievedAt: '2026-08-30T00:30:05.000Z' }],
  evidence: [
    {
      provider: 'ipinfo',
      observation: {
        kind: 'network_identity', verdict: 'unknown', confidence: null,
        firstSeen: '2026-08-20T10:00:00.000Z', lastSeen: '2026-08-29T23:00:00.000Z',
        attributes: { ip: '203.0.113.42', asn: 'AS64500', organization: 'Example Transit', country: 'HU' },
      },
      references: ['https://ipinfo.io/'], integrity: { parserVersion: '1', fingerprint: 'a'.repeat(64) },
    },
    {
      provider: 'shodan',
      observation: {
        kind: 'internet_exposure', verdict: 'observed', confidence: null,
        firstSeen: '2026-08-25T09:00:00.000Z', lastSeen: '2026-08-29T21:00:00.000Z',
        attributes: { ports: [22, 443], services: ['ssh', 'https'], hostnames: ['edge.example.test'] },
      },
      references: ['https://www.shodan.io/'], integrity: { parserVersion: '1', fingerprint: 'b'.repeat(64) },
    },
    {
      provider: 'abuseipdb',
      observation: {
        kind: 'abuse_reports', verdict: 'observed', confidence: 0.9,
        firstSeen: '2026-08-27T12:00:00.000Z', lastSeen: '2026-08-29T22:30:00.000Z',
        attributes: { abuseConfidenceScore: 80, totalReports: 73, distinctUsers: 31 },
      },
      references: ['https://www.abuseipdb.com/'], integrity: { parserVersion: '1', fingerprint: 'c'.repeat(64) },
    },
    {
      provider: 'greynoise',
      observation: {
        kind: 'reputation', verdict: 'malicious', confidence: 0.85,
        firstSeen: '2026-08-26T08:00:00.000Z', lastSeen: '2026-08-29T22:00:00.000Z',
        attributes: { classification: 'malicious', attackIds: ['T1046'] },
      },
      references: ['https://viz.greynoise.io/'], integrity: { parserVersion: '1', fingerprint: 'd'.repeat(64) },
    },
  ],
  relationships: [
    { type: 'domain', targetType: 'domain', target: 'edge.example.test', relationship: 'observed_domain', provider: 'shodan' },
  ],
  correlation: {
    freshness: {
      overall: 'current',
      items: [
        { provider: 'ipinfo', observationClass: 'current' },
        { provider: 'shodan', observationClass: 'current' },
        { provider: 'abuseipdb', observationClass: 'current' },
        { provider: 'greynoise', observationClass: 'current' },
      ],
    },
    evidenceQuality: {
      level: 'high', evidenceCount: 4, providerCount: 4,
      currentCount: 4, agingCount: 0, staleCount: 0, unknownFreshnessCount: 0, contradictionCount: 0,
    },
    threatAssessment: {
      state: 'supported',
      assessmentBasis: { providers: ['abuseipdb', 'greynoise'], semanticClasses: ['reputation'] },
    },
    limitations: ['source_specific_reputation_claims'],
    infrastructureContext: { providers: ['ipinfo', 'shodan'], corroboratedFacts: [] },
    huntability: { level: 'high', reason: 'direct_network_or_url_search' },
    corroboration: [{ providers: ['abuseipdb', 'greynoise'], kind: 'reputation', verdict: 'observed' }],
    contradictions: [],
    riskAxes: {},
  },
  decision: {
    version: '1.0',
    disposition: 'hunt_now',
    confidence: 'medium',
    reasons: ['supported_threat_evidence', 'source_specific_reputation_claims'],
    assessment: {
      disposition: 'hunt_now', confidence: 'medium', reasons: ['supported_threat_evidence'],
      evidenceQuality: 'high', threatState: 'supported', freshness: 'current', huntability: 'high', coverageMaterialLoss: false,
    },
    telemetry: {
      status: 'ready', requiredTables: ['DeviceNetworkEvents', 'CommonSecurityLog'], environmentValidated: false,
      notes: ['schema_level_template_only', 'verify_table_availability_and_retention_before_execution'],
    },
    temporal: {
      firstSeen: '2026-08-20T10:00:00.000Z', lastSeen: '2026-08-29T23:00:00.000Z', ageDays: 0, activeSpanDays: 9,
    },
    attackMappings: [{ id: 'T1046', bases: ['evidence'], providers: ['greynoise'], evidenceFingerprints: ['d'.repeat(64)] }],
    huntPlan: [{
      id: 'subject-ip-1', priority: 'high',
      hypothesis: 'Look for direct enterprise telemetry matching the enriched IP subject.',
      telemetry: ['DeviceNetworkEvents', 'CommonSecurityLog'], evidenceFingerprints: ['c'.repeat(64), 'd'.repeat(64)],
      kql: 'let IOC = "203.0.113.42"; DeviceNetworkEvents | where RemoteIP == IOC',
      falsePositives: ['security_scanner_traffic', 'cdn_or_proxy_egress'],
      tuning: ['correlate_with_process_and_identity_context', 'separate_inbound_from_outbound'],
    }],
  },
  guidance: {
    schemaVersion: '1.0', disposition: 'hunt_now', confidence: 'medium',
    reasons: ['source_specific_reputation_claims', 'supported_threat_evidence'],
    evidenceFingerprints: ['a'.repeat(64), 'b'.repeat(64), 'c'.repeat(64), 'd'.repeat(64)],
    contradictions: [], limitations: ['source_specific_reputation_claims'],
    freshness: { overall: 'current', items: [] }, coverage: { materialLoss: false },
    telemetry: {
      status: 'ready', requiredTables: ['DeviceNetworkEvents', 'CommonSecurityLog'], environmentValidated: false,
      notes: ['schema_level_template_only', 'verify_table_availability_and_retention_before_execution'],
    },
    attackMappings: [{ id: 'T1046', bases: ['evidence'], providers: ['greynoise'], evidenceFingerprints: ['d'.repeat(64)] }],
    hunts: [{
      id: 'subject-ip-1', priority: 'high',
      hypothesis: 'Look for direct enterprise telemetry matching the enriched IP subject.',
      telemetry: ['DeviceNetworkEvents', 'CommonSecurityLog'], evidenceFingerprints: ['c'.repeat(64), 'd'.repeat(64)],
      kql: 'let IOC = "203.0.113.42"; DeviceNetworkEvents | where RemoteIP == IOC',
      falsePositives: ['security_scanner_traffic', 'cdn_or_proxy_egress'],
      tuning: ['correlate_with_process_and_identity_context', 'separate_inbound_from_outbound'],
    }],
    change: null,
  },
};

function build() {
  return viewModel.buildIpAnalystReport({
    overview: viewModel.buildOverview(sample),
    evidence: viewModel.buildEvidence(sample),
    correlation: viewModel.buildCorrelation(sample),
    relationships: viewModel.buildRelationships(sample),
    coverage: viewModel.buildCoverage(sample),
  });
}

function fact(section, label) {
  return section.facts.find(item => item.label === label);
}

test('IP executive assessment promotes authoritative decision support and explains confidence', () => {
  const report = build();
  assert.equal(report.assessment.state, 'HUNT NOW');
  assert.equal(report.assessment.confidence, 'MEDIUM');
  assert.equal(report.assessment.decisionSource, 'DECISION SUPPORT V1.0');
  assert.equal(report.assessment.facts.find(item => item.label === 'THREAT STATE')?.value, 'SUPPORTED');
  assert.equal(report.assessment.facts.find(item => item.label === 'EVIDENCE QUALITY')?.value, 'HIGH');
  assert.equal(report.assessment.facts.find(item => item.label === 'FRESHNESS')?.value, 'CURRENT');
  assert.match(report.assessment.facts.find(item => item.label === 'DECISION REASONS')?.value ?? '', /supported threat evidence/i);
  assert.match(report.assessment.summary, /hunt now/i);
  assert.match(report.assessment.summary, /supported/i);
  assert.doesNotMatch(report.assessment.summary, /score\s*[:=]/i);
});

test('IP report adds temporal ATT&CK and analyst-action sections from existing decision data', () => {
  const report = build();
  const ids = report.sections.map(section => section.id);
  assert.ok(ids.includes('temporal-context'));
  assert.ok(ids.includes('attack-behavior'));
  assert.ok(ids.includes('analyst-actions'));

  const temporal = report.sections.find(section => section.id === 'temporal-context');
  assert.equal(fact(temporal, 'FIRST SEEN')?.value, '2026-08-20T10:00:00.000Z');
  assert.equal(fact(temporal, 'LAST SEEN')?.value, '2026-08-29T23:00:00.000Z');
  assert.equal(fact(temporal, 'ACTIVE SPAN')?.value, '9 days');

  const attack = report.sections.find(section => section.id === 'attack-behavior');
  assert.ok(attack.items.some(item => item.title === 'T1046' && item.facts.some(entry => entry.label === 'PROVIDERS' && /greynoise/i.test(entry.value))));

  const actions = report.sections.find(section => section.id === 'analyst-actions');
  assert.ok(actions.items.some(item => item.title === 'HIGH // SUBJECT IP 1'));
  assert.ok(actions.items.some(item => item.facts.some(entry => entry.label === 'TELEMETRY' && /DeviceNetworkEvents/.test(entry.value))));
  assert.ok(actions.items.some(item => item.detailFacts.some(entry => entry.label === 'FALSE POSITIVES' && /security scanner traffic/i.test(entry.value))));
  assert.ok(actions.items.some(item => item.detailFacts.some(entry => entry.label === 'KQL' && /RemoteIP/.test(entry.value))));
});

test('IP correlation explains evidence quality threat basis and limitations without a master score', () => {
  const report = build();
  const correlation = report.sections.find(section => section.id === 'correlation');
  assert.equal(fact(correlation, 'THREAT STATE')?.value, 'SUPPORTED');
  assert.equal(fact(correlation, 'EVIDENCE QUALITY')?.value, 'HIGH');
  assert.equal(fact(correlation, 'EVIDENCE PROVIDERS')?.value, '4');
  assert.match(fact(correlation, 'THREAT BASIS')?.value ?? '', /abuseipdb.*greynoise/i);
  assert.ok(!correlation.facts.some(item => /master score|maliciousness score/i.test(`${item.label} ${item.value}`)));

  const coverage = report.sections.find(section => section.id === 'coverage');
  assert.ok(coverage.facts.some(item => /source specific reputation claims/i.test(item.value)));
});

test('copy-ready IP report carries decision rationale timeline ATT&CK and hunt instructions', () => {
  const text = viewModel.renderIpAnalystReportText(build());
  assert.match(text, /DISPOSITION:\s+HUNT NOW/i);
  assert.match(text, /EVIDENCE QUALITY:\s+HIGH/i);
  assert.match(text, /TEMPORAL CONTEXT/);
  assert.match(text, /FIRST SEEN:\s+2026-08-20/i);
  assert.match(text, /ATT&CK \/ BEHAVIOR/);
  assert.match(text, /T1046/);
  assert.match(text, /ANALYST NEXT ACTIONS/);
  assert.match(text, /DeviceNetworkEvents/);
  assert.match(text, /FALSE POSITIVES:\s+security scanner traffic/i);
  assert.doesNotMatch(text, /^\s*[{}]\s*$/m);
});

test('IP UI keeps at-a-glance findings dense while making source and hunt details expandable', () => {
  const renderers = readFileSync('app/renderers.js', 'utf8');
  const css = readFileSync('app/analyst-facts.css', 'utf8');
  assert.match(renderers, /ip-source-details/);
  assert.match(renderers, /document\.createElement\(['"]details['"]\)|el\(['"]details['"]/);
  assert.match(renderers, /ip-action-details/);
  assert.match(css, /\.ip-at-a-glance\s*\{/);
  assert.match(css, /\.ip-source-details\s*\{/);
  assert.match(css, /\.ip-action-details\s*\{/);
  assert.match(css, /@media\(max-width:430px\)[\s\S]*\.ip-at-a-glance/);
});
