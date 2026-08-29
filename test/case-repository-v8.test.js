import test from 'node:test';
import assert from 'node:assert/strict';
import { createCaseRepository } from '../app/case-repository.js';

const NOW = '2026-08-28T20:00:00.000Z';
const NEXT = '2026-08-28T21:00:00.000Z';
const clone = value => structuredClone(value);

function createStorage() {
  const values = new Map();
  const calls = { get: 0, put: 0, delete: 0, list: 0 };
  return {
    calls,
    async get(id) { calls.get += 1; return values.has(id) ? clone(values.get(id)) : null; },
    async put(value) { calls.put += 1; values.set(value.id, clone(value)); return clone(value); },
    async delete(id) { calls.delete += 1; values.delete(id); },
    async list() { calls.list += 1; return [...values.values()].map(clone); },
  };
}

function uuidSequence(...ids) {
  let index = 0;
  return () => ids[index++] ?? `id-${index}`;
}

function enrichment() {
  return {
    schemaVersion: '2.0', gatewayVersion: '2.0.0', requestId: 'req-1', queriedAt: NOW, durationMs: 1,
    indicator: '203.0.113.7', type: 'ip', status: 'ok', profile: 'standard', evidence: [], relationships: [], failures: [],
    coverage: { selected: 0, executed: 0, succeeded: 0, failed: 0, skipped: 0, materialLoss: false }, limitations: [],
    correlation: { contradictions: [], freshness: { overall: 'current' }, evidenceQuality: { level: 'low' }, huntability: { level: 'low' } },
    decision: { disposition: 'monitor', confidence: 'low', reasons: [], telemetry: null, attackMappings: [], huntPlan: [] }, meta: { providerHealth: {} },
  };
}

test('repository coordinates create/get/list/save/remove with detached values and deterministic ordering', async () => {
  const storage = createStorage();
  let now = NOW;
  const repo = createCaseRepository({ storage, now: () => now, uuid: uuidSequence('case-b', 'case-a') });
  const b = await repo.create('Beta');
  now = NEXT;
  const a = await repo.create('Alpha');
  assert.equal(storage.calls.put, 2);
  assert.equal((await repo.get(b.id)).title, 'Beta');
  const listed = await repo.list();
  assert.deepEqual(listed.map(item => item.id), ['case-a', 'case-b']);

  const edited = clone(a);
  edited.title = 'Alpha Updated';
  await repo.save(edited);
  edited.title = 'mutated outside';
  assert.equal((await repo.get(a.id)).title, 'Alpha Updated');

  await repo.remove(b.id);
  assert.equal(await repo.get(b.id), null);
  assert.equal(storage.calls.delete, 1);
});

test('every domain mutation performs exactly one persistence write', async () => {
  const storage = createStorage();
  const repo = createCaseRepository({ storage, now: () => NOW, uuid: uuidSequence('case-1', 'note-1', 'snap-1') });
  const created = await repo.create('Fixture');
  let puts = storage.calls.put;
  await repo.addPin(created.id, { type: 'ip', value: '203.0.113.7' });
  assert.equal(storage.calls.put, ++puts);
  await repo.addNote(created.id, 'investigate');
  assert.equal(storage.calls.put, ++puts);
  await repo.capture(created.id, enrichment());
  assert.equal(storage.calls.put, ++puts);
  await repo.removePin(created.id, { type: 'ip', value: '203.0.113.7' });
  assert.equal(storage.calls.put, ++puts);

  const current = await repo.get(created.id);
  assert.equal(current.notes.length, 1);
  assert.equal(current.snapshots.length, 1);
  assert.equal(current.pins.length, 0);
});

test('concurrent read-modify-write mutations are serialized so neither update is lost', async () => {
  const storage = createStorage();
  const repo = createCaseRepository({ storage, now: () => NOW, uuid: uuidSequence('case-1', 'note-1') });
  const created = await repo.create('Fixture');

  await Promise.all([
    repo.addNote(created.id, 'preserve this note'),
    repo.addPin(created.id, { type: 'ip', value: '203.0.113.7' }),
  ]);

  const current = await repo.get(created.id);
  assert.deepEqual(current.notes.map(note => note.text), ['preserve this note']);
  assert.deepEqual(current.pins.map(pin => ({ type: pin.type, value: pin.value })), [{ type: 'ip', value: '203.0.113.7' }]);
});

test('case repository never introduces auth/session/credential properties at case root', async () => {
  const storage = createStorage();
  const repo = createCaseRepository({ storage, now: () => NOW, uuid: uuidSequence('case-1') });
  const created = await repo.create('Fixture');
  const forbidden = new Set(['token', 'authorization', 'credential', 'session']);
  for (const key of Object.keys(created)) assert.equal(forbidden.has(key.toLowerCase()), false);
});

test('mutating a missing case fails without writing', async () => {
  const storage = createStorage();
  const repo = createCaseRepository({ storage, now: () => NOW, uuid: uuidSequence('x') });
  await assert.rejects(() => repo.addNote('missing', 'x'), /case_not_found/);
  assert.equal(storage.calls.put, 0);
});
