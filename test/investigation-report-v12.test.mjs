import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createInvestigation,
  importInvestigation,
  reduceInvestigation,
} from '../src/core/investigation/index.js';
import { buildInvestigationReport, renderInvestigationText } from '../src/report/render-investigation.js';

const NOW = '2026-09-02T12:00:00.000Z';
let sequence = 0;
const deps = { now: () => NOW, uuid: () => `generated-${++sequence}` };

function evidence() {
  return {
    schemaVersion: '2.0', requestId: 'request-1', type: 'ip', indicator: '203.0.113.10', status: 'ok',
    evidence: [{ provider: 'fixture', references: ['https://example.test/research'] }], relationships: [], failures: [],
  };
}

function dispositionReady() {
  sequence = 0;
  let value = createInvestigation({ title: 'Fortinet access review', now: () => NOW, uuid: () => 'inv-report' });
  value = reduceInvestigation(value, {
    type: 'SCOPE_SET',
    profile: { id: 'client', name: 'Example Client', technologies: ['fortinet'], telemetry: ['DeviceNetworkEvents'] },
    context: { technologies: ['fortinet'], requiredTelemetry: ['devicenetworkevents'], observedExploitation: true },
  }, deps);
  value = reduceInvestigation(value, { type: 'OBSERVABLE_ADD', observable: { type: 'ip', value: '203.0.113.10' } }, deps);
  value = reduceInvestigation(value, { type: 'EVIDENCE_CAPTURE', value: evidence() }, deps);
  value = reduceInvestigation(value, { type: 'RELEVANCE_BUILD' }, deps);
  value = reduceInvestigation(value, {
    type: 'HUNT_BUILD',
    value: {
      subject: 'Remote-access credential abuse',
      hypothesis: 'Valid-account abuse may produce anomalous endpoint activity.',
      attackIds: ['T1078'], evidenceFingerprints: ['a'.repeat(64)],
      sourceReferences: ['https://example.test/research'],
      kqlCandidates: ['DeviceNetworkEvents | where Timestamp > ago(24h) | project Timestamp, DeviceName, RemoteIP'],
    },
  }, deps);
  value = reduceInvestigation(value, { type: 'RESULT_SET', value: '[]' }, deps);
  return reduceInvestigation(value, {
    type: 'DISPOSITION_SET',
    value: {
      state: 'NO_EVIDENCE_IDENTIFIED', confidence: 'MEDIUM',
      rationale: 'No related activity was identified in the reviewed telemetry.',
      artifactIds: [], limitations: ['telemetry_scope_limited'],
    },
  }, deps);
}

test('report preserves evidence, context, results, and judgment as separate authority layers', () => {
  const current = dispositionReady();
  const report = buildInvestigationReport(current);
  assert.deepEqual(Object.keys(report), ['identity', 'scope', 'evidence', 'operatorContext', 'hunt', 'results', 'disposition', 'limitations', 'provenance']);
  assert.equal(report.results.state, 'NO_RESULTS');
  assert.equal(report.disposition.state, 'NO_EVIDENCE_IDENTIFIED');
  assert.equal(report.evidence.length, 1);
  assert.equal(report.operatorContext.length, 0);
  assert.match(renderInvestigationText(current), /ANALYST DISPOSITION[\s\S]*NO_EVIDENCE_IDENTIFIED/);
});

test('report refuses stale required dependencies', () => {
  const current = structuredClone(dispositionReady());
  current.freshness.stale.push({ artifact: 'disposition', reason: 'RESULT_CHANGED' });
  current.status = null;
  assert.throws(() => buildInvestigationReport(importInvestigation(current)), /STALE_DEPENDENCY/);
});

test('report rendering is deterministic across canonical export/import', () => {
  const current = dispositionReady();
  assert.equal(renderInvestigationText(current), renderInvestigationText(importInvestigation(current)));
});

test('benign disposition requires a linked current artifact or note', () => {
  let current = dispositionReady();
  current = structuredClone(current);
  current.workflow.disposition = null;
  current.status = null;
  assert.throws(() => reduceInvestigation(importInvestigation(current), {
    type: 'DISPOSITION_SET',
    value: { state: 'BENIGN_EXPLAINED', confidence: 'HIGH', rationale: 'Approved maintenance', artifactIds: ['missing'], limitations: [] },
  }, deps), /linked current artifact or note/i);
});

test('report transition stores the deterministic projection and opens the report-ready gate', () => {
  const current = dispositionReady();
  const next = reduceInvestigation(current, { type: 'REPORT_BUILD' }, { ...deps, buildReport: buildInvestigationReport });
  assert.equal(next.workflow.report.disposition.state, 'NO_EVIDENCE_IDENTIFIED');
  assert.equal(next.status.phase, 'REPORT_READY');
  assert.equal(next.status.reportReady, true);
});

test('ServiceNow projection carries investigation judgment but never submits or invents incident priority', () => {
  const current = dispositionReady();
  const next = reduceInvestigation(current, { type: 'SERVICENOW_BUILD' }, deps);
  assert.equal(next.workflow.serviceNow.schemaVersion, 'investigation-servicenow-v2.0');
  assert.equal(next.workflow.serviceNow.investigationId, current.id);
  assert.equal(next.workflow.serviceNow.disposition.state, 'NO_EVIDENCE_IDENTIFIED');
  assert.equal(next.workflow.serviceNow.approvalRequired, true);
  assert.equal(next.workflow.serviceNow.autoSubmission, false);
  assert.equal(next.workflow.serviceNow.suggestedPriority, undefined);
});
