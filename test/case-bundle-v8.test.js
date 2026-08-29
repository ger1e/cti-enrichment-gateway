import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CASE_BUNDLE_MEDIA_TYPE,
  MAX_CASE_BUNDLE_BYTES,
  serializeCaseBundle,
  parseCaseBundle,
} from '../app/case-bundle.js';

const NOW = '2026-08-28T20:00:00.000Z';
const fp = 'a'.repeat(64);
const clone = value => structuredClone(value);

function evidence({ type = 'certificate', indicator = fp } = {}) {
  return {
    schemaVersion: '2.0', requestId: 'req-1', indicator, type,
    evidence: [], relationships: [], failures: [],
  };
}

function fixture() {
  return {
    schemaVersion: '1.0', id: 'case-1', title: 'Operation Fixture', createdAt: NOW, updatedAt: NOW,
    notes: [{ id: 'note-1', text: 'analyst note may mention session or authorization as words', addedAt: NOW }],
    pins: [{ type: 'certificate', value: fp, addedAt: NOW }],
    snapshots: [{ id: 'snap-1', type: 'certificate', indicator: fp, capturedAt: NOW, requestId: 'req-1', evidence: evidence() }],
    diffs: [{ id: 'diff-1', type: 'certificate', indicator: fp, capturedAt: NOW, fromSnapshotId: 'snap-0', toSnapshotId: 'snap-1', diff: { changed: true, changes: [] } }],
  };
}

function bundle(caseValue = fixture(), overrides = {}) {
  return JSON.stringify({ format: 'para11ax-case', version: '1.0', exportedAt: NOW, case: caseValue, ...overrides });
}

test('bundle media type and deterministic JSON export use the exact top-level contract', () => {
  assert.equal(CASE_BUNDLE_MEDIA_TYPE, 'application/vnd.para11ax.case+json');
  assert.equal(MAX_CASE_BUNDLE_BYTES, 8 * 1024 * 1024);
  const original = fixture();
  const text = serializeCaseBundle(original, { now: () => NOW });
  assert.deepEqual(JSON.parse(text), { format: 'para11ax-case', version: '1.0', exportedAt: NOW, case: original });
  const parsed = JSON.parse(text);
  parsed.case.title = 'outside';
  assert.equal(original.title, 'Operation Fixture');
});

test('parser returns a detached case and accepts all nine canonical observable types', () => {
  const value = fixture();
  value.pins = ['asn','attack','certificate','cidr','cve','domain','hash','ip','url'].map((type, i) => ({ type, value: `v-${i}`, addedAt: NOW }));
  value.snapshots = [];
  value.diffs = [];
  const parsed = parseCaseBundle(bundle(value));
  assert.deepEqual(parsed, value);
  parsed.title = 'mutated';
  assert.equal(value.title, 'Operation Fixture');
});

test('bundle size is checked as UTF-8 bytes before JSON parsing', () => {
  const oversized = 'x'.repeat(MAX_CASE_BUNDLE_BYTES + 1);
  assert.throws(() => parseCaseBundle(oversized), /case_bundle_too_large/);
});

test('parser rejects malformed JSON, unexpected top-level keys, format mismatch, and unsupported versions deterministically', () => {
  assert.throws(() => parseCaseBundle('{'), /case_bundle_invalid/);
  assert.throws(() => parseCaseBundle(bundle(fixture(), { extra: true })), /case_bundle_schema_invalid/);
  assert.throws(() => parseCaseBundle(JSON.stringify({ format: 'wrong', version: '1.0', exportedAt: NOW, case: fixture() })), /case_bundle_schema_invalid/);
  for (const version of ['0.9', '1.1', '2.0', 'future']) {
    assert.throws(() => parseCaseBundle(JSON.stringify({ format: 'para11ax-case', version, exportedAt: NOW, case: fixture() })), /case_bundle_version_unsupported/);
  }
});

test('structural secret-bearing keys are rejected recursively but arbitrary note words are allowed', () => {
  assert.doesNotThrow(() => parseCaseBundle(bundle()));
  for (const key of ['authorization', 'Authorization', 'PARA11AX_TOKEN', 'provider_credentials', 'Session']) {
    const value = fixture();
    value.snapshots[0].evidence.meta = { [key]: 'secret' };
    assert.throws(() => serializeCaseBundle(value, { now: () => NOW }), /case_bundle_forbidden_key/);
    assert.throws(() => parseCaseBundle(bundle(value)), /case_bundle_forbidden_key/);
  }
});

test('case bounds and minimum Evidence v2 snapshot shape are validated before return', () => {
  const badTitle = fixture(); badTitle.title = '';
  assert.throws(() => parseCaseBundle(bundle(badTitle)), /case_title_invalid/);
  const badEvidence = fixture(); delete badEvidence.snapshots[0].evidence.relationships;
  assert.throws(() => parseCaseBundle(bundle(badEvidence)), /case_bundle_evidence_invalid/);
  const tooManyPins = fixture(); tooManyPins.pins = Array.from({ length: 257 }, (_, i) => ({ type: 'domain', value: `d${i}.test`, addedAt: NOW }));
  assert.throws(() => parseCaseBundle(bundle(tooManyPins)), /case_pin_limit/);
});

test('unsupported pin, snapshot, and diff subject types are rejected before any caller can persist them', () => {
  for (const field of ['pins', 'snapshots', 'diffs']) {
    const value = fixture();
    if (field === 'pins') value.pins[0].type = 'email';
    if (field === 'snapshots') { value.snapshots[0].type = 'email'; value.snapshots[0].evidence.type = 'email'; }
    if (field === 'diffs') value.diffs[0].type = 'email';
    assert.throws(() => parseCaseBundle(bundle(value)), /case_bundle_observable_type_unsupported/);
  }
});

test('supportedTypes option is authoritative for import admission', () => {
  assert.throws(() => parseCaseBundle(bundle(), { supportedTypes: ['ip', 'domain'] }), /case_bundle_observable_type_unsupported/);
});
