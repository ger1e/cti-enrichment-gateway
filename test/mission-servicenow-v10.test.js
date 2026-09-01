import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildHuntPackage } from '../src/core/mission/hunt-package.js';
import { analyzeMissionResults } from '../src/core/mission/result-analysis.js';
import { buildServiceNowProjection, renderServiceNowText } from '../src/report/render-servicenow.js';

function hunt() {
  return buildHuntPackage({
    profile: { id: 'client-1', name: 'Client\u0000 One', technologies: ['fortinet'], telemetry: ['DeviceNetworkEvents'] },
    context: { technologies: ['fortinet'], observedExploitation: true, requiredTelemetry: ['DeviceNetworkEvents'], evidenceConfidence: 0.8 },
    subject: 'Remote-access credential abuse',
    hypothesis: 'Valid-account abuse may produce anomalous endpoint network activity.',
    attackIds: ['T1078'],
    evidenceFingerprints: ['b'.repeat(64)],
    sourceReferences: ['https://example.org/research'],
    kqlCandidates: ['DeviceNetworkEvents | where Timestamp > ago(24h) | project Timestamp, DeviceName, RemoteIP'],
  });
}

test('ServiceNow projection is deterministic, bounded, explicit and submission-free', () => {
  const results = analyzeMissionResults([{ DeviceName: 'host-01', RemoteIP: '203.0.113.10' }]);
  const a = buildServiceNowProjection(hunt(), results);
  const b = buildServiceNowProjection(hunt(), results);
  assert.deepEqual(a, b);
  assert.equal(a.title, '[PARA11AX] Remote-access credential abuse');
  assert.equal(a.client.name.includes('\u0000'), false);
  assert.equal(a.resultState, 'RESULTS_PRESENT');
  assert.deepEqual(a.attackIds, ['T1078']);
  assert.deepEqual(a.evidenceFingerprints, ['b'.repeat(64)]);
  assert.deepEqual(a.kqlValidationStates, ['VALID']);
  assert.equal(a.provenance.projectionOnly, true);
  assert.equal(a.provenance.autoSubmission, false);
  assert.equal(Object.isFrozen(a), true);
});

test('no-result projection preserves the explicit non-benign limitation', () => {
  const projection = buildServiceNowProjection(hunt(), analyzeMissionResults([]));
  assert.equal(projection.resultState, 'NO_RESULTS');
  assert.equal(projection.limitations.includes('no_results_is_not_benign_evidence'), true);
  assert.equal(projection.recommendedActions.some(value => /telemetry coverage/i.test(value)), true);
});

test('text projection is stable and carries analyst approval boundary', () => {
  const projection = buildServiceNowProjection(hunt(), analyzeMissionResults([]));
  const text = renderServiceNowText(projection);
  assert.match(text, /PARA11AX SERVICENOW PROJECTION/);
  assert.match(text, /T1078/);
  assert.match(text, /Analyst approval required/i);
  assert.equal(text, renderServiceNowText(projection));
});

test('renderer source contains no network or automatic ticket-write path', () => {
  const source = readFileSync(new URL('../src/report/render-servicenow.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\bfetch\s*\(|https?:\/\/|process\.env|child_process|exec\s*\(/i);
});
