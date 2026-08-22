import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildReportModel } from '../src/report/model.js';
import { diffReportModels } from '../src/report/diff.js';

const baseSnapshot = JSON.parse(readFileSync(new URL('./fixtures/report/enrichment.json', import.meta.url), 'utf8'));
const clone = value => JSON.parse(JSON.stringify(value));

function models() {
  const beforeSnapshot = clone(baseSnapshot);
  const afterSnapshot = clone(baseSnapshot);
  afterSnapshot.queriedAt = '2026-08-22T09:00:00.000Z';
  afterSnapshot.status = 'ok';
  afterSnapshot.limitations = [];
  afterSnapshot.correlation.limitations = [];
  afterSnapshot.failures = [];
  afterSnapshot.evidence[0].observation.verdict = 'suspicious';
  afterSnapshot.evidence[0].observation.attributes.attackIds = ['T1071.001', 'T1105'];
  afterSnapshot.evidence[0].retrievedAt = '2026-08-22T08:59:50.000Z';
  afterSnapshot.evidence[0].integrity.fingerprint = '3333333333333333333333333333333333333333333333333333333333333333';
  afterSnapshot.reportContext.behaviors[0].evidenceFingerprints = ['3333333333333333333333333333333333333333333333333333333333333333'];
  afterSnapshot.reportContext.behaviors[0].attackIds = ['T1071.001', 'T1105'];
  afterSnapshot.reportContext.behaviors[1].evidenceFingerprints[0] = '3333333333333333333333333333333333333333333333333333333333333333';
  afterSnapshot.reportContext.behaviors[2].evidenceFingerprints = ['3333333333333333333333333333333333333333333333333333333333333333'];
  afterSnapshot.reportContext.huntOpportunities[0].evidenceFingerprints[0] = '3333333333333333333333333333333333333333333333333333333333333333';
  afterSnapshot.relationships.push({ type: 'domain', value: 'new-c2.example.test', relationship: 'passive_dns', provider: 'modat' });
  afterSnapshot.evidence[1].relationships.push({ type: 'domain', value: 'new-c2.example.test', relationship: 'passive_dns' });
  afterSnapshot.reportContext.huntOpportunities.push({
    id: 'hunt-new-domain',
    hypothesis: 'Endpoints resolving new-c2.example.test may show follow-on HTTPS connections.',
    telemetry: ['DeviceNetworkEvents'],
    evidenceFingerprints: ['2222222222222222222222222222222222222222222222222222222222222222'],
    kql: 'DeviceNetworkEvents | where RemoteUrl =~ "new-c2.example.test"'
  });

  const before = buildReportModel(beforeSnapshot, { generatedAt: '2026-08-22T08:30:00.000Z', sourceSha: null });
  const after = buildReportModel(afterSnapshot, { generatedAt: '2026-08-22T09:30:00.000Z', sourceSha: null });
  return { before, after };
}

test('report diff is deterministic and separates structural change classes', () => {
  const { before, after } = models();
  const first = diffReportModels(before, after);
  const second = diffReportModels(before, after);
  assert.deepEqual(first, second);
  assert.equal(first.diffVersion, '1.0');
  assert.deepEqual(first.subject, { type: 'ip', value: '203.0.113.10' });
  assert.deepEqual(first.status, { before: 'partial', after: 'ok', changed: true });
  assert.deepEqual(first.observables.added, [{ type: 'domain', value: 'new-c2.example.test' }]);
  assert.deepEqual(first.providers, { added: [], removed: [] });
  assert.deepEqual(first.verdictChanges, [{ provider: 'virustotal', kind: 'reputation', before: 'malicious', after: 'suspicious' }]);
  assert.deepEqual(first.attack.added.map(item => item.id), ['T1105']);
  assert.deepEqual(first.hunts.added.map(item => item.id), ['hunt-new-domain']);
  assert.deepEqual(first.limitations.removed, ['partial_provider_failure']);
  assert.equal(first.evidence.added.includes('ev-3333333333333333'), true);
  assert.equal(first.evidence.removed.includes('ev-1111111111111111'), true);
  assert.equal(first.relationships.added.some(item => item.value === 'new-c2.example.test'), true);
});

test('report diff does not convert mere presence into a maliciousness score', () => {
  const { before, after } = models();
  const diff = diffReportModels(before, after);
  const serialized = JSON.stringify(diff);
  assert.doesNotMatch(serialized, /riskScore|maliciousnessScore|scoreDelta/i);
  assert.equal(Object.hasOwn(diff, 'score'), false);
});

test('report diff rejects different subjects instead of comparing unrelated investigations', () => {
  const { before, after } = models();
  after.subject = { type: 'ip', value: '198.51.100.7' };
  assert.throws(() => diffReportModels(before, after), /same subject/i);
});
