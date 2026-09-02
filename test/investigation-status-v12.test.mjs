import assert from 'node:assert/strict';
import test from 'node:test';
import { createInvestigation, deriveInvestigationStatus } from '../src/core/investigation/index.js';

const NOW = '2026-09-02T12:00:00.000Z';

function base() {
  return structuredClone(createInvestigation({ title: 'Status', now: () => NOW, uuid: () => 'inv-status' }));
}

function scoped() {
  const value = base();
  value.scope = { profile: { id: 'client', name: 'Client' }, context: { technologies: ['fortinet'] } };
  return value;
}

function withEvidence() {
  const value = scoped();
  value.evidenceSnapshots = [{ id: 'snapshot-1' }];
  return value;
}

function withHunt() {
  const value = withEvidence();
  value.workflow.relevance = { id: 'relevance' };
  value.workflow.hunt = { id: 'hunt' };
  value.workflow.kqlValidations = [{ query: 'DeviceEvents | take 1', validation: { valid: true } }];
  return value;
}

function withResult() {
  const value = withHunt();
  value.workflow.result = { state: 'NO_RESULTS', limitations: ['no_results_is_not_benign_evidence'] };
  return value;
}

function ready() {
  const value = withResult();
  value.workflow.disposition = { state: 'NO_EVIDENCE_IDENTIFIED' };
  value.workflow.report = { id: 'report' };
  return value;
}

test('status advances only with current required artifacts', () => {
  assert.equal(deriveInvestigationStatus(base()).phase, 'SCOPING');
  assert.equal(deriveInvestigationStatus(scoped()).phase, 'EVIDENCE');
  assert.equal(deriveInvestigationStatus(withEvidence()).phase, 'HUNT_DESIGN');
  assert.equal(deriveInvestigationStatus(withHunt()).phase, 'EXECUTION_PENDING');
  assert.equal(deriveInvestigationStatus(withResult()).phase, 'DISPOSITION');
  assert.equal(deriveInvestigationStatus(ready()).phase, 'REPORT_READY');
});

test('no-results remains incomplete and explicitly not benign before disposition', () => {
  const status = deriveInvestigationStatus(withResult());
  assert.equal(status.readiness, 'INCOMPLETE');
  assert.equal(status.reportReady, false);
  assert.ok(status.limitations.includes('no_results_is_not_benign_evidence'));
  assert.ok(status.nextActions.includes('SET_DISPOSITION'));
});

test('stale artifacts cannot satisfy phase or report gates', () => {
  const value = ready();
  value.freshness.stale = [
    { artifact: 'hunt', reason: 'EVIDENCE_CHANGED' },
    { artifact: 'report', reason: 'EVIDENCE_CHANGED' },
  ];
  const status = deriveInvestigationStatus(value);
  assert.equal(status.phase, 'HUNT_DESIGN');
  assert.equal(status.reportReady, false);
  assert.deepEqual(status.staleArtifacts, value.freshness.stale);
  assert.ok(status.gaps.includes('CURRENT_HUNT_REQUIRED'));
});

test('export readiness requires a valid identity but not a complete workflow', () => {
  const status = deriveInvestigationStatus(base());
  assert.equal(status.exportReady, true);
  assert.equal(status.reportReady, false);
  assert.deepEqual(status.nextActions, ['SET_SCOPE']);
});
