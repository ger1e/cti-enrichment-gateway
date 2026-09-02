import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createInvestigation,
  exportInvestigation,
  reduceInvestigation,
} from '../src/core/investigation/index.js';

const NOW = '2026-09-02T12:00:00.000Z';
let id = 0;
const dependencies = { now: () => NOW, uuid: () => `generated-${++id}` };

function empty() {
  id = 0;
  return createInvestigation({ title: 'Reducer', now: () => NOW, uuid: () => 'inv-reducer' });
}

const profile = { id: 'client-1', name: 'Example Client', technologies: ['fortinet'], telemetry: ['DeviceNetworkEvents'] };
const context = { technologies: ['fortinet'], requiredTelemetry: ['devicenetworkevents'], observedExploitation: true };

test('scope transition normalizes input, advances one revision, records history, and derives status', () => {
  const current = empty();
  const next = reduceInvestigation(current, { type: 'SCOPE_SET', profile, context }, dependencies);
  assert.equal(next.revision, 1);
  assert.equal(next.scope.profile.name, 'Example Client');
  assert.deepEqual(next.scope.context.technologies, ['fortinet']);
  assert.equal(next.status.phase, 'EVIDENCE');
  assert.equal(next.timeline.at(-1).action, 'SCOPE_SET');
  assert.equal(Object.isFrozen(next), true);
  assert.equal(current.revision, 0);
});

test('successful note and observable actions each advance exactly one revision', () => {
  const scoped = reduceInvestigation(empty(), { type: 'SCOPE_SET', profile, context }, dependencies);
  const pinned = reduceInvestigation(scoped, { type: 'OBSERVABLE_ADD', observable: { type: 'ip', value: '203.0.113.10' } }, dependencies);
  const noted = reduceInvestigation(pinned, { type: 'NOTE_ADD', text: 'Review VPN activity' }, dependencies);
  assert.equal(pinned.revision, scoped.revision + 1);
  assert.equal(noted.revision, pinned.revision + 1);
  assert.deepEqual(noted.observables.map(({ type, value }) => ({ type, value })), [{ type: 'ip', value: '203.0.113.10' }]);
  assert.equal(noted.notes[0].text, 'Review VPN activity');
});

test('failed transition leaves the input byte-identical', () => {
  const current = empty();
  const before = exportInvestigation(current);
  assert.throws(() => reduceInvestigation(current, {
    type: 'DISPOSITION_SET',
    value: { state: 'BENIGN_EXPLAINED', confidence: 'HIGH', rationale: '', artifactIds: [], limitations: [] },
  }, dependencies), /disposition/i);
  assert.equal(exportInvestigation(current), before);
});

test('unsupported actions fail closed and revision overflow is rejected', () => {
  const current = empty();
  assert.throws(() => reduceInvestigation(current, { type: 'DO_MAGIC' }, dependencies), /action/i);
  const exhausted = structuredClone(current);
  exhausted.revision = Number.MAX_SAFE_INTEGER;
  assert.throws(() => reduceInvestigation(exhausted, { type: 'NOTE_ADD', text: 'x' }, dependencies), /revision limit/i);
});

test('one mutation samples its clock exactly once', () => {
  const current = empty();
  let calls = 0;
  const next = reduceInvestigation(current, { type: 'NOTE_ADD', text: 'Clock check' }, {
    uuid: dependencies.uuid,
    now: () => {
      calls += 1;
      return NOW;
    },
  });
  assert.equal(calls, 1);
  assert.equal(next.updatedAt, next.timeline.at(-1).at);
});
