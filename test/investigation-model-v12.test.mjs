import assert from 'node:assert/strict';
import test from 'node:test';
import {
  INVESTIGATION_FORMAT,
  INVESTIGATION_LIMITS,
  INVESTIGATION_SCHEMA_VERSION,
  createInvestigation,
  exportInvestigation,
  importInvestigation,
  validateInvestigation,
} from '../src/core/investigation/index.js';

const NOW = '2026-09-02T12:00:00.000Z';
const fixed = { now: () => NOW, uuid: () => 'inv-001' };

test('creates the exact frozen empty Investigation v2 aggregate', () => {
  const value = createInvestigation({ title: ' Fortinet access review ', ...fixed });
  assert.equal(value.format, INVESTIGATION_FORMAT);
  assert.equal(value.format, 'para11ax-investigation-v2.0');
  assert.equal(value.version, INVESTIGATION_SCHEMA_VERSION);
  assert.equal(value.id, 'inv-001');
  assert.equal(value.title, 'Fortinet access review');
  assert.equal(value.revision, 0);
  assert.deepEqual(value.scope, { profile: null, context: null });
  assert.deepEqual(value.observables, []);
  assert.deepEqual(value.workflow, {
    relevance: null,
    hunt: null,
    kqlValidations: [],
    result: null,
    disposition: null,
    serviceNow: null,
    report: null,
  });
  assert.equal(Object.isFrozen(value), true);
  assert.equal(Object.isFrozen(value.workflow), true);
  assert.equal(validateInvestigation(value), true);
});

test('canonical export round-trips byte-for-byte', () => {
  const value = createInvestigation({ title: 'Case', ...fixed });
  const text = exportInvestigation(value);
  assert.equal(text.endsWith('\n'), true);
  assert.equal(exportInvestigation(importInvestigation(text)), text);
});

test('rejects malformed, unknown, inherited, accessor, sparse, and secret-bearing structures', () => {
  const base = structuredClone(createInvestigation({ title: 'Case', ...fixed }));
  assert.throws(() => importInvestigation('{'), /malformed JSON/i);
  assert.throws(() => importInvestigation({ ...base, extra: true }), /top-level keys/i);
  assert.throws(() => importInvestigation(Object.assign(Object.create({ inherited: true }), base)), /plain object/i);

  const accessor = structuredClone(base);
  Object.defineProperty(accessor.scope, 'profile', { enumerable: true, get: () => null });
  assert.throws(() => importInvestigation(accessor), /accessor/i);

  const sparse = structuredClone(base);
  sparse.notes = new Array(1);
  assert.throws(() => importInvestigation(sparse), /sparse/i);

  const secret = structuredClone(base);
  secret.scope.context = { nested: { authorization: 'Bearer nope' } };
  assert.throws(() => importInvestigation(secret), /secret-bearing key/i);
});

test('rejects invalid timestamps, non-HTTPS references, duplicates, and hard bounds', () => {
  const base = structuredClone(createInvestigation({ title: 'Case', ...fixed }));
  assert.throws(() => importInvestigation({ ...base, updatedAt: 'yesterday' }), /timestamp/i);

  const artifact = {
    id: 'operator-1',
    kind: 'shodan',
    capturedAt: NOW,
    source: 'current-result',
    summary: 'Context only',
    references: ['http://example.test/not-safe'],
  };
  assert.throws(() => importInvestigation({ ...base, operatorArtifacts: [artifact] }), /https URL/i);

  const observable = { type: 'ip', value: '203.0.113.10', addedAt: NOW };
  assert.throws(() => importInvestigation({ ...base, observables: [observable, observable] }), /duplicate observable/i);
  assert.throws(() => importInvestigation(' '.repeat(INVESTIGATION_LIMITS.bundleBytes + 1)), /too large/i);
  assert.throws(() => importInvestigation({ ...base, notes: Array.from({ length: INVESTIGATION_LIMITS.notes + 1 }, (_, index) => ({ id: `n-${index}`, at: NOW, text: 'x' })) }), /notes limit/i);
});

test('rejects forged deterministic status projections', () => {
  const value = structuredClone(createInvestigation({ title: 'Case', ...fixed }));
  value.status = {
    phase: 'REPORT_READY', readiness: 'READY', currentArtifacts: ['report'], staleArtifacts: [],
    gaps: [], nextActions: [], exportReady: true, reportReady: true, limitations: [],
  };
  assert.throws(() => importInvestigation(value), /status mismatch/i);
});
