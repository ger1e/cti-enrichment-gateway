import test from 'node:test';
import assert from 'node:assert/strict';
import { serializeCaseBundle } from '../app/case-bundle.js';
import { createCaseRuntime } from '../app/case-runtime.js';

const NOW = new Date('2026-08-29T12:00:00.000Z');
const OLD = '2026-08-28T10:00:00.000Z';
const FRESH = '2026-08-29T11:30:00.000Z';
const fp = 'a'.repeat(64);
const clone = value => structuredClone(value);

function emptyCase(id = 'case-1', title = 'Fixture') {
  return { schemaVersion: '1.0', id, title, createdAt: OLD, updatedAt: OLD, notes: [], pins: [], snapshots: [], diffs: [] };
}

function envelope({ type = 'ip', indicator = '203.0.113.7', status = 'ok', requestId = 'req-1' } = {}) {
  return {
    schemaVersion: '2.0', gatewayVersion: '2.0.0', requestId, queriedAt: NOW.toISOString(), durationMs: 1,
    indicator, type, status, profile: 'standard', evidence: [], relationships: [], failures: [],
    coverage: { selected: 0, executed: 0, succeeded: 0, failed: 0, skipped: 0, materialLoss: false }, limitations: [],
    correlation: { contradictions: [], freshness: { overall: 'current' }, evidenceQuality: { level: 'low' }, huntability: { level: 'low' } },
    decision: { disposition: 'monitor', confidence: 'low', reasons: [], telemetry: null, attackMappings: [], huntPlan: [] }, meta: { providerHealth: {} },
  };
}

function fakeRepository(initial = []) {
  const values = new Map(initial.map(value => [value.id, clone(value)]));
  const calls = { create: 0, get: 0, list: 0, save: 0, remove: 0, addPin: 0, removePin: 0, addNote: 0, capture: 0 };
  let sequence = values.size;
  return {
    calls,
    values,
    async create(title) { calls.create++; const value = emptyCase(`case-${++sequence}`, title); values.set(value.id, clone(value)); return clone(value); },
    async get(id) { calls.get++; return values.has(id) ? clone(values.get(id)) : null; },
    async list() { calls.list++; return [...values.values()].map(clone); },
    async save(value) { calls.save++; values.set(value.id, clone(value)); return clone(value); },
    async remove(id) { calls.remove++; values.delete(id); },
    async addPin(id, observable) { calls.addPin++; const value = clone(values.get(id)); value.pins.push({ ...observable, addedAt: NOW.toISOString() }); values.set(id, clone(value)); return value; },
    async removePin(id, observable) { calls.removePin++; const value = clone(values.get(id)); value.pins = value.pins.filter(pin => pin.type !== observable.type || pin.value !== observable.value); values.set(id, clone(value)); return value; },
    async addNote(id, text) { calls.addNote++; const value = clone(values.get(id)); value.notes.push({ id: `n-${calls.addNote}`, text, addedAt: NOW.toISOString() }); values.set(id, clone(value)); return value; },
    async capture(id, result) { calls.capture++; const value = clone(values.get(id)); value.snapshots.push({ id: `s-${calls.capture}`, type: result.type, indicator: result.indicator, capturedAt: NOW.toISOString(), requestId: result.requestId, evidence: clone(result) }); values.set(id, clone(value)); return value; },
  };
}

function fakeClient() {
  const calls = { batch: [], concurrent: 0, peak: 0 };
  return {
    calls,
    async batch(indicators, profile) {
      calls.concurrent++;
      calls.peak = Math.max(calls.peak, calls.concurrent);
      calls.batch.push({ indicators: [...indicators], profile });
      await Promise.resolve();
      calls.concurrent--;
      return {
        requestId: `batch-${calls.batch.length}`, profile, inputCount: indicators.length, uniqueIndicators: indicators.length,
        results: indicators.map((input, index) => {
          const certificate = input.startsWith('cert-sha256:');
          const result = envelope({
            type: certificate ? 'certificate' : input.startsWith('AS') ? 'asn' : 'ip',
            indicator: certificate ? input.slice('cert-sha256:'.length) : input,
            requestId: `refresh-${calls.batch.length}-${index}`,
          });
          return { index, input, canonical: result.indicator, type: result.type, status: 'ok', enrichment: result };
        }),
      };
    },
  };
}

test('case new/open/close control memory-only activeCaseId and reset clears it', async () => {
  const cases = fakeRepository();
  const runtime = createCaseRuntime({ cases, client: fakeClient(), now: () => NOW });
  assert.equal(runtime.state().activeCaseId, null);
  const created = await runtime.handle({ action: 'case-new', title: 'Operation Fixture' });
  assert.equal(runtime.state().activeCaseId, created.case.id);
  await runtime.handle({ action: 'case-close' });
  assert.equal(runtime.state().activeCaseId, null);
  await runtime.handle({ action: 'case-open', caseId: created.case.id });
  assert.equal(runtime.state().activeCaseId, created.case.id);
  runtime.reset();
  assert.equal(runtime.state().activeCaseId, null);
});

test('successful active-case enrichment captures once while no-active and error results capture zero times', async () => {
  const cases = fakeRepository();
  const runtime = createCaseRuntime({ cases, client: fakeClient(), now: () => NOW });
  assert.deepEqual(await runtime.captureResult(envelope()), { captured: false, warning: null });
  assert.equal(cases.calls.capture, 0);
  await runtime.handle({ action: 'case-new', title: 'Fixture' });
  assert.deepEqual(await runtime.captureResult(envelope()), { captured: true, warning: null });
  assert.equal(cases.calls.capture, 1);
  await runtime.captureResult(envelope({ status: 'error', requestId: 'err-1' }));
  assert.equal(cases.calls.capture, 1);
});

test('capture storage failure is isolated and returns the required local warning', async () => {
  const cases = fakeRepository();
  const runtime = createCaseRuntime({ cases, client: fakeClient(), now: () => NOW });
  await runtime.handle({ action: 'case-new', title: 'Fixture' });
  cases.capture = async () => { throw new Error('workspace_storage_failed'); };
  const outcome = await runtime.captureResult(envelope());
  assert.deepEqual(outcome, { captured: false, warning: 'case capture failed; enrichment result remains valid' });
});

test('refresh is sequential, chunks at 20, caps at 100, and restores certificate transport syntax', async () => {
  const value = emptyCase();
  value.pins = Array.from({ length: 44 }, (_, i) => ({ type: 'ip', value: `203.0.113.${i + 1}`, addedAt: OLD }));
  value.pins.push({ type: 'certificate', value: fp, addedAt: OLD });
  const cases = fakeRepository([value]);
  const client = fakeClient();
  const runtime = createCaseRuntime({ cases, client, now: () => NOW });
  await runtime.handle({ action: 'case-open', caseId: value.id });
  const refreshed = await runtime.handle({ action: 'case-refresh', staleOnly: false }, { profile: 'standard' });
  assert.deepEqual(client.calls.batch.map(call => call.indicators.length), [20, 20, 5]);
  assert.equal(client.calls.peak, 1);
  assert.equal(client.calls.batch.flatMap(call => call.indicators).at(-1), `cert-sha256:${fp}`);
  assert.equal(refreshed.selected, 45);
  assert.equal(refreshed.captured, 45);

  const tooMany = emptyCase('case-many');
  tooMany.pins = Array.from({ length: 101 }, (_, i) => ({ type: 'ip', value: `198.51.100.${i}`, addedAt: OLD }));
  cases.values.set(tooMany.id, clone(tooMany));
  await runtime.handle({ action: 'case-open', caseId: tooMany.id });
  const before = client.calls.batch.length;
  await assert.rejects(() => runtime.handle({ action: 'case-refresh', staleOnly: false }, { profile: 'standard' }), /case refresh limit is 100 observables/);
  assert.equal(client.calls.batch.length, before);
});

test('--stale refresh selects missing or older-than-24h snapshots only', async () => {
  const value = emptyCase();
  value.pins = [
    { type: 'ip', value: '203.0.113.1', addedAt: OLD },
    { type: 'ip', value: '203.0.113.2', addedAt: OLD },
    { type: 'ip', value: '203.0.113.3', addedAt: OLD },
  ];
  value.snapshots = [
    { id: 'old', type: 'ip', indicator: '203.0.113.1', capturedAt: OLD, requestId: 'old', evidence: envelope({ indicator: '203.0.113.1', requestId: 'old' }) },
    { id: 'fresh', type: 'ip', indicator: '203.0.113.2', capturedAt: FRESH, requestId: 'fresh', evidence: envelope({ indicator: '203.0.113.2', requestId: 'fresh' }) },
  ];
  const cases = fakeRepository([value]);
  const client = fakeClient();
  const runtime = createCaseRuntime({ cases, client, now: () => NOW });
  await runtime.handle({ action: 'case-open', caseId: value.id });
  const result = await runtime.handle({ action: 'case-refresh', staleOnly: true }, { profile: 'standard' });
  assert.deepEqual(client.calls.batch[0].indicators, ['203.0.113.1', '203.0.113.3']);
  assert.equal(result.selected, 2);
});

test('export uses .para11ax media type and import validates then refuses collisions before save', async () => {
  const value = emptyCase('case-1', 'Operation Fixture');
  const cases = fakeRepository([value]);
  const downloads = [];
  const runtime = createCaseRuntime({ cases, client: fakeClient(), now: () => NOW, downloadText: (...args) => downloads.push(args) });
  await runtime.handle({ action: 'case-open', caseId: value.id });
  await runtime.handle({ action: 'case-export' });
  assert.equal(downloads.length, 1);
  assert.equal(downloads[0][1], 'application/vnd.para11ax.case+json');
  assert.match(downloads[0][2], /\.para11ax$/);

  const text = serializeCaseBundle(value, { now: () => NOW.toISOString() });
  const before = cases.calls.save;
  await assert.rejects(() => runtime.importText(text), /case_import_conflict/);
  assert.equal(cases.calls.save, before);

  const unsupported = clone(value);
  unsupported.id = 'case-new';
  unsupported.pins = [{ type: 'email', value: 'a@example.test', addedAt: OLD }];
  const unsafeText = JSON.stringify({ format: 'para11ax-case', version: '1.0', exportedAt: NOW.toISOString(), case: unsupported });
  await assert.rejects(() => runtime.importText(unsafeText), /case_bundle_observable_type_unsupported/);
  assert.equal(cases.calls.save, before);
});

test('case find rebuilds the local index and performs zero gateway calls', async () => {
  const value = emptyCase();
  value.pins = [{ type: 'domain', value: 'example.test', addedAt: OLD }];
  const cases = fakeRepository([value]);
  const client = fakeClient();
  const runtime = createCaseRuntime({ cases, client, now: () => NOW });
  const result = await runtime.handle({ action: 'case-find', observable: { type: 'domain', value: 'example.test' } });
  assert.equal(result.sightings.length, 1);
  assert.equal(result.sightings[0].type, 'domain');
  assert.equal(client.calls.batch.length, 0);
});

test('missing workspace produces stable local errors while transient enrichment remains usable', async () => {
  const runtime = createCaseRuntime({ cases: null, client: fakeClient(), now: () => NOW });
  await assert.rejects(() => runtime.handle({ action: 'case-list' }), /workspace unavailable/);
  assert.deepEqual(await runtime.captureResult(envelope()), { captured: false, warning: null });
});
