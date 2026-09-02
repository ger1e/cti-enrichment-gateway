import assert from 'node:assert/strict';
import test from 'node:test';
import { createInvestigationRepository } from '../app/investigation-repository.js';
import { createInvestigationRuntime } from '../app/investigation-runtime.js';
import { importInvestigation } from '../src/core/investigation/index.js';
import { buildInvestigationReport } from '../src/report/render-investigation.js';

const NOW = '2026-09-02T12:00:00.000Z';

function harness() {
  const values = new Map();
  let sequence = 0;
  const storage = {
    async get(id) { return values.has(id) ? structuredClone(values.get(id)) : null; },
    async put(value) { values.set(value.id, structuredClone(value)); },
    async delete(id) { values.delete(id); },
    async list() { return [...values.values()].map(value => structuredClone(value)); },
  };
  const investigations = createInvestigationRepository({ storage, now: () => NOW, uuid: () => `id-${++sequence}` });
  const runtime = createInvestigationRuntime({ investigations, now: () => NOW, buildReport: buildInvestigationReport });
  return { runtime, investigations };
}

const profile = { id: 'client', name: 'Example Client', technologies: ['fortinet'], telemetry: ['DeviceNetworkEvents'] };
const context = { technologies: ['fortinet'], requiredTelemetry: ['devicenetworkevents'], observedExploitation: true };
const kql = 'DeviceNetworkEvents | where Timestamp > ago(24h) | project Timestamp, DeviceName, RemoteIP';

function enrichment(requestId = 'request-1') {
  return {
    schemaVersion: '2.0', requestId, type: 'ip', indicator: '203.0.113.10', status: 'ok',
    evidence: [{ provider: 'fixture', references: ['https://example.test/research'] }], relationships: [], failures: [],
  };
}

test('one investigation completes the explicit analyst lifecycle without semantic promotion', async () => {
  const { runtime } = harness();
  await runtime.handle({ type: 'NEW', title: 'Fortinet access review' });
  await runtime.handle({ type: 'SCOPE_SET', profile, context });
  await runtime.handle({ type: 'OBSERVABLE_ADD', observable: { type: 'ip', value: '203.0.113.10' } });
  await runtime.captureEvidence(enrichment());
  await runtime.handle({ type: 'RELEVANCE_BUILD' });
  await runtime.handle({
    type: 'HUNT_BUILD',
    value: {
      subject: 'Remote-access credential abuse',
      hypothesis: 'Valid-account abuse may produce anomalous endpoint activity.',
      attackIds: ['T1078'], evidenceFingerprints: ['a'.repeat(64)],
      sourceReferences: ['https://example.test/research'], kqlCandidates: [kql],
    },
  });
  await runtime.handle({ type: 'KQL_VALIDATE', query: kql });
  await runtime.handle({ type: 'RESULT_SET', value: '[]' });
  await runtime.handle({
    type: 'DISPOSITION_SET',
    value: {
      state: 'NO_EVIDENCE_IDENTIFIED', confidence: 'MEDIUM',
      rationale: 'No related activity was identified in the reviewed telemetry.',
      artifactIds: [], limitations: ['telemetry_scope_limited'],
    },
  });
  await runtime.handle({ type: 'SERVICENOW_BUILD' });
  await runtime.handle({ type: 'REPORT_BUILD' });
  const exported = await runtime.handle({ type: 'EXPORT' });
  const restored = importInvestigation(exported.text);

  assert.equal(restored.status.phase, 'REPORT_READY');
  assert.equal(restored.workflow.result.state, 'NO_RESULTS');
  assert.equal(restored.workflow.disposition.state, 'NO_EVIDENCE_IDENTIFIED');
  assert.equal(restored.evidenceSnapshots.length, 1);
  assert.equal(restored.operatorArtifacts.some(item => item.promotedToEvidence), false);
  assert.equal(restored.workflow.serviceNow.autoSubmission, false);
});

test('new evidence makes the old hunt, result, disposition, report, and ticket projection stale', async () => {
  const { runtime } = harness();
  await runtime.handle({ type: 'NEW', title: 'Stale graph' });
  await runtime.handle({ type: 'SCOPE_SET', profile, context });
  await runtime.captureEvidence(enrichment());
  await runtime.handle({
    type: 'HUNT_BUILD',
    value: {
      subject: 'Access review', hypothesis: 'Access may be anomalous.', attackIds: ['T1078'],
      evidenceFingerprints: ['a'.repeat(64)], sourceReferences: ['https://example.test/research'], kqlCandidates: [kql],
    },
  });
  await runtime.handle({ type: 'RESULT_SET', value: '[]' });
  await runtime.handle({ type: 'DISPOSITION_SET', value: { state: 'INCONCLUSIVE', confidence: 'LOW', rationale: 'Telemetry is incomplete.', artifactIds: [], limitations: ['limited'] } });
  await runtime.handle({ type: 'SERVICENOW_BUILD' });
  await runtime.handle({ type: 'REPORT_BUILD' });
  await runtime.captureEvidence(enrichment('request-2'));
  const status = (await runtime.handle({ type: 'STATUS' })).status;
  assert.deepEqual(status.staleArtifacts.map(item => item.artifact), ['hunt', 'result', 'disposition', 'report', 'serviceNow']);
  assert.equal(status.phase, 'HUNT_DESIGN');
  assert.equal(status.reportReady, false);
});
