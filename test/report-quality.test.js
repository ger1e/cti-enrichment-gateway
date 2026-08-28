import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildReportModel } from '../src/report/model.js';
import { assertReportQuality, ReportQualityError } from '../src/report/quality.js';

const snapshot = JSON.parse(readFileSync(new URL('./fixtures/report/enrichment.json', import.meta.url), 'utf8'));
const options = { generatedAt: '2026-08-22T08:30:00.000Z', sourceSha: '0123456789abcdef0123456789abcdef01234567' };
const base = () => buildReportModel(snapshot, options);
const clone = value => JSON.parse(JSON.stringify(value));

function expectViolation(mutator, code) {
  const model = clone(base());
  mutator(model);
  assert.throws(
    () => assertReportQuality(model),
    error => error instanceof ReportQualityError && error.violations.some(item => item.code === code),
    code,
  );
}

test('valid frozen ReportModel passes the hard quality gate', () => {
  const model = base();
  const result = assertReportQuality(model);
  assert.equal(result.ok, true);
  assert.deepEqual(result.violations, []);
});

test('quality gate rejects orphan material claims', () => {
  expectViolation(model => model.keyFindings.push({ id: 'finding-orphan', state: 'OBSERVED', title: 'Orphan claim', evidenceIds: [] }), 'orphan_claim');
});

test('quality gate rejects evidence with missing provenance', () => {
  expectViolation(model => { model.evidence[0].provider = ''; }, 'missing_provenance');
});

test('quality gate rejects malformed ATT&CK IDs', () => {
  expectViolation(model => { model.frameworks.attack[0].id = 'TA-LOL'; }, 'malformed_attack_id');
});

test('quality gate rejects contextual mappings represented as observed', () => {
  expectViolation(model => {
    model.suspiciousBehavior[2].state = 'OBSERVED';
  }, 'contextual_as_observed');
});

test('quality gate rejects duplicate canonical observables', () => {
  expectViolation(model => model.observables.push({ type: 'IP', value: '203.0.113.10' }), 'duplicate_observable');
});

test('quality gate rejects impossible timestamps', () => {
  expectViolation(model => {
    model.evidence[0].observation.firstSeen = '2026-08-23T00:00:00.000Z';
    model.evidence[0].observation.lastSeen = '2026-08-22T00:00:00.000Z';
  }, 'impossible_timestamp');
});

test('quality gate rejects unsafe references', () => {
  expectViolation(model => model.sources.push('javascript:alert(1)'), 'unsafe_reference');
});

test('quality gate rejects known secret identifiers and secret-like values anywhere in output', () => {
  expectViolation(model => { model.limitations.push('PARA11AX_TOKEN'); }, 'secret_material');
  expectViolation(model => { model.limitations.push('sk-live-1234567890abcdefghijklmnop'); }, 'secret_material');
});

test('quality gate rejects unsupported actor attribution', () => {
  expectViolation(model => model.threatContext.actors.push('Imaginary APT'), 'unsupported_attribution');
});

test('quality gate rejects stale evidence represented as current without an explicit limitation', () => {
  const model = clone(base());
  model.generatedAt = '2027-01-22T08:30:00.000Z';
  model.reproducibility.generatedAt = model.generatedAt;
  model.limitations = model.limitations.filter(item => item !== 'stale_evidence');
  assert.throws(
    () => assertReportQuality(model),
    error => error instanceof ReportQualityError && error.violations.some(item => item.code === 'stale_without_warning'),
  );
  model.limitations.push('stale_evidence');
  assert.equal(assertReportQuality(model).ok, true);
});
