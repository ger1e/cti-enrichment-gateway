import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildReportModel } from '../src/report/model.js';
import { REPORT_SCHEMA_VERSION } from '../src/report/version.js';

const snapshot = JSON.parse(readFileSync(new URL('./fixtures/report/enrichment.json', import.meta.url), 'utf8'));
const options = { generatedAt: '2026-08-22T08:30:00.000Z', sourceSha: '0123456789abcdef0123456789abcdef01234567' };

test('ReportModel identity and evidence indexes are deterministic for a frozen snapshot', () => {
  const first = buildReportModel(snapshot, options);
  const second = buildReportModel(snapshot, options);
  assert.deepEqual(first, second);
  assert.equal(first.reportSchemaVersion, REPORT_SCHEMA_VERSION);
  assert.match(first.reportId, /^rpt-[0-9a-f]{24}$/);
  assert.equal(first.subject.type, 'ip');
  assert.equal(first.subject.value, '203.0.113.10');
  assert.equal(first.generatedAt, options.generatedAt);
  assert.equal(first.source.sourceSha, options.sourceSha);
  assert.equal(first.evidence.length, 2);
  assert.deepEqual(Object.keys(first.evidenceIndex).sort(), first.evidence.map(item => item.id).sort());
  assert.equal(first.evidence[0].id, 'ev-1111111111111111');
  assert.equal(first.evidence[1].id, 'ev-2222222222222222');
  assert.match(first.reproducibility.snapshotSha256, /^[0-9a-f]{64}$/);
});

test('ReportModel preserves observed, look-for-next and contextual-not-observed behavior states separately', () => {
  const model = buildReportModel(snapshot, options);
  assert.deepEqual(model.suspiciousBehavior.map(item => item.state), [
    'OBSERVED',
    'LOOK_FOR_NEXT',
    'CONTEXTUAL_NOT_OBSERVED',
  ]);
  assert.deepEqual(model.suspiciousBehavior.map(item => item.mappingState), [
    'OBSERVED',
    'INFERRED',
    'CONTEXTUAL_NOT_OBSERVED',
  ]);
  for (const item of model.suspiciousBehavior) {
    assert.ok(item.evidenceIds.length >= 1);
    for (const id of item.evidenceIds) assert.ok(model.evidenceIndex[id], `${item.id} missing ${id}`);
  }
});

test('ReportModel extracts bounded observables, source provenance, ATT&CK mappings and hunt opportunities without network access', () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('network must not be used by report model'); };
  try {
    const model = buildReportModel(snapshot, options);
    assert.deepEqual(model.observables, [
      { type: 'domain', value: 'c2.example.test' },
      { type: 'ip', value: '203.0.113.10' },
    ]);
    assert.deepEqual(model.frameworks.attack.map(item => item.id), ['T1071.001']);
    assert.equal(model.huntOpportunities.length, 1);
    assert.equal(model.huntOpportunities[0].telemetry.includes('DeviceNetworkEvents'), true);
    assert.equal(model.sources.length, 2);
    assert.equal(model.limitations.includes('partial_provider_failure'), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
