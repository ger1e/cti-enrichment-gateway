import assert from 'node:assert/strict';
import test from 'node:test';
import { createCase } from '../app/case-model.js';
import { createCaseRepository } from '../app/case-repository.js';
import { createInvestigationRepository } from '../app/investigation-repository.js';

const NOW = '2026-09-02T12:00:00.000Z';

function createStorage() {
  const values = new Map();
  const calls = { get: 0, put: 0, delete: 0, list: 0 };
  return {
    values,
    calls,
    async get(id) { calls.get += 1; return values.has(id) ? structuredClone(values.get(id)) : null; },
    async put(value) { calls.put += 1; values.set(value.id, structuredClone(value)); return structuredClone(value); },
    async delete(id) { calls.delete += 1; values.delete(id); },
    async list() { calls.list += 1; return [...values.values()].map(value => structuredClone(value)); },
  };
}

function ids(...values) {
  let index = 0;
  return () => values[index++] ?? `id-${index}`;
}

test('concurrent mutations serialize and each successful mutation writes once', async () => {
  const storage = createStorage();
  const repo = createInvestigationRepository({ storage, now: () => NOW, uuid: ids('inv-1', 'event-1', 'note-1', 'event-2', 'note-2') });
  const created = await repo.create('Concurrent');
  await Promise.all([
    repo.mutate(created.id, { type: 'NOTE_ADD', text: 'one' }),
    repo.mutate(created.id, { type: 'NOTE_ADD', text: 'two' }),
  ]);
  const saved = await repo.get(created.id);
  assert.deepEqual(saved.notes.map(note => note.text).sort(), ['one', 'two']);
  assert.equal(storage.calls.put, 3);
});

test('failed mutation performs no write and leaves storage byte-identical', async () => {
  const storage = createStorage();
  const repo = createInvestigationRepository({ storage, now: () => NOW, uuid: ids('inv-1') });
  const created = await repo.create('Atomic');
  const before = JSON.stringify(storage.values.get(created.id));
  const puts = storage.calls.put;
  await assert.rejects(repo.mutate(created.id, { type: 'NOTE_ADD', text: '' }), /note/i);
  assert.equal(storage.calls.put, puts);
  assert.equal(JSON.stringify(storage.values.get(created.id)), before);
});

test('list is deterministic and returned values are detached', async () => {
  const storage = createStorage();
  let currentNow = '2026-09-02T10:00:00.000Z';
  const repo = createInvestigationRepository({ storage, now: () => currentNow, uuid: ids('inv-b', 'inv-a') });
  const first = await repo.create('First');
  currentNow = '2026-09-02T11:00:00.000Z';
  await repo.create('Second');
  const listed = await repo.list();
  assert.deepEqual(listed.map(value => value.id), ['inv-a', 'inv-b']);
  listed[1].title = 'outside';
  assert.equal((await repo.get(first.id)).title, 'First');
});

test('legacy migration persists only after validation and conflicts remain explicit', async () => {
  const storage = createStorage();
  const legacy = createCase({ title: 'Legacy', now: () => NOW, uuid: () => 'legacy-1' });
  storage.values.set(legacy.id, legacy);
  const repo = createInvestigationRepository({ storage, now: () => NOW, uuid: ids('migration-event') });
  const migrated = await repo.get('legacy-1');
  assert.equal(migrated.format, 'para11ax-investigation-v2.0');
  assert.equal(storage.values.get('legacy-1').format, 'para11ax-investigation-v2.0');
  assert.equal(storage.calls.put, 1);
  await assert.rejects(repo.save(migrated), /already exists/i);
});

test('legacy case and Investigation v2 repositories coexist in the shared object store', async () => {
  const storage = createStorage();
  const caseRepo = createCaseRepository({ storage, now: () => NOW, uuid: ids('case-1') });
  const investigationRepo = createInvestigationRepository({ storage, now: () => NOW, uuid: ids('inv-1') });
  await caseRepo.create('Legacy case');
  await investigationRepo.create('Investigation');
  assert.deepEqual((await caseRepo.list()).map(value => value.id), ['case-1']);
  assert.deepEqual((await investigationRepo.list()).map(value => value.id), ['case-1', 'inv-1']);
});
