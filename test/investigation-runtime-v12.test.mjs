import assert from 'node:assert/strict';
import test from 'node:test';
import { createInvestigationRepository } from '../app/investigation-repository.js';
import { createInvestigationRuntime } from '../app/investigation-runtime.js';

const NOW = '2026-09-02T12:00:00.000Z';

function setup() {
  const values = new Map();
  let id = 0;
  const storage = {
    async get(key) { return values.has(key) ? structuredClone(values.get(key)) : null; },
    async put(value) { values.set(value.id, structuredClone(value)); },
    async delete(key) { values.delete(key); },
    async list() { return [...values.values()].map(value => structuredClone(value)); },
  };
  const repo = createInvestigationRepository({ storage, now: () => NOW, uuid: () => `id-${++id}` });
  const downloads = [];
  const runtime = createInvestigationRuntime({
    investigations: repo,
    now: () => NOW,
    downloadText: (...args) => downloads.push(args),
  });
  return { repo, runtime, downloads };
}

function enrichment() {
  return {
    schemaVersion: '2.0', requestId: 'request-1', type: 'ip', indicator: '203.0.113.10',
    status: 'ok', evidence: [], relationships: [], failures: [],
  };
}

test('runtime owns one active investigation and exports its canonical bundle', async () => {
  const { runtime, downloads } = setup();
  const created = await runtime.handle({ type: 'NEW', title: 'Runtime' });
  assert.equal(runtime.state().activeInvestigationId, created.investigation.id);
  assert.equal(runtime.state().phase, 'SCOPING');
  const status = await runtime.handle({ type: 'STATUS' });
  assert.equal(status.status.phase, 'SCOPING');
  const exported = await runtime.handle({ type: 'EXPORT' });
  assert.match(exported.text, /para11ax-investigation-v2\.0/);
  assert.equal(downloads.length, 1);
  await runtime.handle({ type: 'CLOSE' });
  assert.equal(runtime.state().activeInvestigationId, null);
});

test('captures only explicit compatible current outputs', async () => {
  const { repo, runtime } = setup();
  const { investigation } = await runtime.handle({ type: 'NEW', title: 'Capture' });
  await runtime.captureEvidence(enrichment());
  await runtime.captureOperator({ kind: 'shodan', summary: 'No exposed services', references: ['https://www.shodan.io/host/203.0.113.10'] });
  const value = await repo.get(investigation.id);
  assert.equal(value.evidenceSnapshots.length, 1);
  assert.equal(value.operatorArtifacts[0].kind, 'shodan');
  assert.equal(value.operatorArtifacts[0].promotedToEvidence, undefined);
  await assert.rejects(runtime.captureEvidence({ ...enrichment(), status: 'error' }), /compatible current evidence/i);
  await assert.rejects(runtime.captureOperator({ kind: 'unknown', summary: 'x', references: [] }), /compatible current operator/i);
});

test('missing active state and missing records fail with stable errors', async () => {
  const { repo, runtime } = setup();
  await assert.rejects(runtime.handle({ type: 'SHOW' }), /INVESTIGATION_REQUIRED/);
  await assert.rejects(runtime.handle({ type: 'OPEN', id: 'missing' }), /INVESTIGATION_NOT_FOUND/);
  const created = await repo.create('Removed');
  await runtime.handle({ type: 'OPEN', id: created.id });
  await repo.remove(created.id);
  await assert.rejects(runtime.handle({ type: 'SHOW' }), /INVESTIGATION_NOT_FOUND/);
  assert.equal(runtime.state().activeInvestigationId, null);
});
