import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CASE_SCHEMA_VERSION,
  createCase,
  addNote,
  addPin,
  removePin,
  appendSnapshot,
  latestSnapshot,
} from '../app/case-model.js';

const NOW = '2026-08-28T20:00:00.000Z';
const NEXT = '2026-08-28T21:00:00.000Z';
const fp = char => char.repeat(64);
const clone = value => JSON.parse(JSON.stringify(value));

function enrichment({ verdict = 'context', fingerprint = fp('a'), requestId = 'req-1', queriedAt = NOW } = {}) {
  return {
    schemaVersion: '2.0',
    gatewayVersion: '2.0.0',
    requestId,
    queriedAt,
    durationMs: 4,
    indicator: '203.0.113.7',
    type: 'ip',
    status: 'ok',
    profile: 'standard',
    evidence: [{
      provider: 'alpha',
      integrity: { fingerprint },
      semantics: { class: 'provider_claim', semanticClass: 'reputation', sourceRole: 'aggregator' },
      observation: { kind: 'reputation', verdict, firstSeen: null, lastSeen: null, tags: [], attributes: {} },
    }],
    relationships: [],
    failures: [],
    coverage: { selected: 1, executed: 1, succeeded: 1, failed: 0, skipped: 0, materialLoss: false },
    limitations: [],
    correlation: { contradictions: [], freshness: { overall: 'current' }, evidenceQuality: { level: 'medium' }, huntability: { level: 'medium' } },
    decision: { disposition: 'investigate', confidence: 'medium', reasons: [], telemetry: null, attackMappings: [], huntPlan: [] },
    meta: { providerHealth: { alpha: 'ok' } },
  };
}

function ids(...values) {
  let index = 0;
  return () => values[index++] ?? `id-${index}`;
}

test('createCase returns the exact v8.1 local schema without mutating inputs', () => {
  assert.equal(CASE_SCHEMA_VERSION, '1.0');
  const created = createCase({ title: 'Operation Fixture', now: () => NOW, uuid: ids('case-1') });
  assert.deepEqual(created, {
    schemaVersion: '1.0',
    id: 'case-1',
    title: 'Operation Fixture',
    createdAt: NOW,
    updatedAt: NOW,
    notes: [],
    pins: [],
    snapshots: [],
    diffs: [],
  });
});

test('case mutations return detached values and exact observable pins', () => {
  const original = createCase({ title: 'Operation Fixture', now: () => NOW, uuid: ids('case-1') });
  const pinned = addPin(original, { type: 'ip', value: '203.0.113.7' }, { now: () => NEXT });
  assert.deepEqual(original.pins, []);
  assert.deepEqual(pinned.pins, [{ type: 'ip', value: '203.0.113.7', addedAt: NEXT }]);
  assert.equal(pinned.updatedAt, NEXT);

  const noted = addNote(pinned, 'investigate beacon overlap', { now: () => NEXT, uuid: ids('note-1') });
  assert.deepEqual(noted.notes, [{ id: 'note-1', text: 'investigate beacon overlap', addedAt: NEXT }]);
  noted.pins[0].value = 'mutated';
  assert.equal(pinned.pins[0].value, '203.0.113.7');

  const removed = removePin(pinned, { type: 'ip', value: '203.0.113.7' }, { now: () => NEXT });
  assert.deepEqual(removed.pins, []);
  assert.equal(pinned.pins.length, 1);
});

test('duplicate pins, invalid titles and notes, and configured bounds fail with stable codes', () => {
  assert.throws(() => createCase({ title: '', now: () => NOW, uuid: ids('case-1') }), /case_title_invalid/);
  assert.throws(() => createCase({ title: 'x'.repeat(121), now: () => NOW, uuid: ids('case-1') }), /case_title_invalid/);

  const created = createCase({ title: 'Operation Fixture', now: () => NOW, uuid: ids('case-1') });
  const pinned = addPin(created, { type: 'ip', value: '203.0.113.7' }, { now: () => NOW });
  assert.throws(() => addPin(pinned, { type: 'ip', value: '203.0.113.7' }, { now: () => NOW }), /case_pin_duplicate/);
  assert.throws(() => addNote(created, '', { now: () => NOW, uuid: ids('note-1') }), /case_note_invalid/);
  assert.throws(() => addNote(created, 'x'.repeat(4001), { now: () => NOW, uuid: ids('note-1') }), /case_note_invalid/);

  const pinFull = { ...clone(created), pins: Array.from({ length: 256 }, (_, i) => ({ type: 'ip', value: `203.0.113.${i}`, addedAt: NOW })) };
  assert.throws(() => addPin(pinFull, { type: 'ip', value: '198.51.100.1' }, { now: () => NOW }), /case_pin_limit/);
  const notesFull = { ...clone(created), notes: Array.from({ length: 500 }, (_, i) => ({ id: `n-${i}`, text: 'x', addedAt: NOW })) };
  assert.throws(() => addNote(notesFull, 'more', { now: () => NOW, uuid: ids('note-x') }), /case_note_limit/);
});

test('snapshots detach Evidence v2 input and second capture records the canonical semantic diff', () => {
  const created = createCase({ title: 'Operation Fixture', now: () => NOW, uuid: ids('case-1') });
  const firstInput = enrichment();
  const first = appendSnapshot(created, firstInput, { now: () => NOW, uuid: ids('snap-1') });
  assert.equal(first.diffs.length, 0);
  assert.deepEqual(first.snapshots[0], {
    id: 'snap-1',
    type: 'ip',
    indicator: '203.0.113.7',
    capturedAt: NOW,
    requestId: 'req-1',
    evidence: firstInput,
  });
  first.snapshots[0].evidence.evidence[0].observation.verdict = 'mutated';
  assert.equal(firstInput.evidence[0].observation.verdict, 'context');

  const cleanFirst = appendSnapshot(created, firstInput, { now: () => NOW, uuid: ids('snap-1') });
  const secondInput = enrichment({ verdict: 'malicious', fingerprint: fp('b'), requestId: 'req-2', queriedAt: NEXT });
  const second = appendSnapshot(cleanFirst, secondInput, { now: () => NEXT, uuid: ids('snap-2', 'diff-1') });
  assert.equal(second.snapshots.length, 2);
  assert.equal(second.diffs.length, 1);
  assert.equal(second.diffs[0].id, 'diff-1');
  assert.equal(second.diffs[0].fromSnapshotId, 'snap-1');
  assert.equal(second.diffs[0].toSnapshotId, 'snap-2');
  assert.equal(second.diffs[0].diff.changes.some(change => change.category === 'semantic_claim_changed'), true);
  assert.equal(latestSnapshot(second, { type: 'ip', value: '203.0.113.7' }).id, 'snap-2');
});

test('snapshot and diff bounds fail before appending', () => {
  const created = createCase({ title: 'Operation Fixture', now: () => NOW, uuid: ids('case-1') });
  const snapshotsFull = { ...clone(created), snapshots: Array.from({ length: 500 }, (_, i) => ({ id: `s-${i}`, type: 'domain', indicator: `x${i}.test`, capturedAt: NOW, requestId: `r-${i}`, evidence: enrichment() })) };
  assert.throws(() => appendSnapshot(snapshotsFull, enrichment(), { now: () => NOW, uuid: ids('snap-x') }), /case_snapshot_limit/);

  const prior = { id: 'prior', type: 'ip', indicator: '203.0.113.7', capturedAt: NOW, requestId: 'req-0', evidence: enrichment() };
  const diffsFull = { ...clone(created), snapshots: [prior], diffs: Array.from({ length: 500 }, (_, i) => ({ id: `d-${i}` })) };
  assert.throws(() => appendSnapshot(diffsFull, enrichment({ verdict: 'malicious', fingerprint: fp('b') }), { now: () => NEXT, uuid: ids('snap-x', 'diff-x') }), /case_diff_limit/);
});
