import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createInvestigation,
  fingerprintDependency,
  invalidateInvestigation,
} from '../src/core/investigation/index.js';

const NOW = '2026-09-02T12:00:00.000Z';

function fullInvestigation() {
  const base = structuredClone(createInvestigation({ title: 'Full', now: () => NOW, uuid: () => 'inv-full' }));
  base.workflow = {
    relevance: { id: 'relevance' },
    hunt: { id: 'hunt' },
    kqlValidations: [{ query: 'DeviceEvents | take 1', validation: {} }],
    result: { id: 'result' },
    disposition: { state: 'INCONCLUSIVE', confidence: 'LOW', rationale: 'Limited data', artifactIds: [], limitations: [] },
    serviceNow: { id: 'serviceNow' },
    report: { id: 'report' },
  };
  return base;
}

test('dependency fingerprints are canonical and domain-separated', () => {
  assert.equal(fingerprintDependency('scope', { a: 1 }), '339c47ba7d4e1f7519e4a2b4be7a4c97418f125dc6ae0f2fcaf54c8247f07617');
  assert.equal(fingerprintDependency('scope', { a: 1 }), fingerprintDependency('scope', { a: 1 }));
  assert.notEqual(fingerprintDependency('scope', { a: 1 }), fingerprintDependency('hunt', { a: 1 }));
});

const cases = [
  ['SCOPE_CHANGED', ['relevance', 'hunt', 'result', 'disposition', 'report', 'serviceNow']],
  ['OBSERVABLES_CHANGED', ['hunt', 'disposition', 'report', 'serviceNow']],
  ['EVIDENCE_CHANGED', ['hunt', 'result', 'disposition', 'report', 'serviceNow']],
  ['HUNT_CHANGED', ['result', 'disposition', 'report', 'serviceNow']],
  ['KQL_CHANGED', ['result', 'disposition', 'report', 'serviceNow']],
  ['RESULT_CHANGED', ['disposition', 'report', 'serviceNow']],
  ['DISPOSITION_CHANGED', ['report', 'serviceNow']],
  ['NOTE_CHANGED', ['report']],
];

for (const [change, expected] of cases) {
  test(`${change} marks the exact downstream artifacts stale`, () => {
    const current = fullInvestigation();
    const before = structuredClone(current);
    const next = invalidateInvestigation(current, change);
    assert.deepEqual(next.freshness.stale.map(item => item.artifact), expected);
    assert.deepEqual(next.freshness.stale.map(item => item.reason), expected.map(() => change));
    assert.deepEqual(current, before);
  });
}

test('repeated invalidation deduplicates artifacts and records the newest reason', () => {
  const first = invalidateInvestigation(fullInvestigation(), 'DISPOSITION_CHANGED');
  const second = invalidateInvestigation(first, 'NOTE_CHANGED');
  assert.deepEqual(second.freshness.stale, [
    { artifact: 'report', reason: 'NOTE_CHANGED' },
    { artifact: 'serviceNow', reason: 'DISPOSITION_CHANGED' },
  ]);
});

test('unknown invalidation changes fail without mutating current state', () => {
  const current = fullInvestigation();
  const before = structuredClone(current);
  assert.throws(() => invalidateInvestigation(current, 'MAGIC_CHANGED'), /change type/i);
  assert.deepEqual(current, before);
});

