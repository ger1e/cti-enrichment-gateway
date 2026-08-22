import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileReportBundle, REPORT_PRESETS } from '../src/report/compiler.js';
import { ReportQualityError } from '../src/report/quality.js';

const snapshot = JSON.parse(readFileSync(new URL('./fixtures/report/enrichment.json', import.meta.url), 'utf8'));
const options = { generatedAt: '2026-08-22T08:30:00.000Z', sourceSha: '0123456789abcdef0123456789abcdef01234567', preset: 'all' };
const required = [
  'attack-navigator.json',
  'evidence.json',
  'hunts.kql',
  'intelligence.stix.json',
  'manifest.json',
  'observables.csv',
  'report.html',
  'report.pdf',
  'report.txt',
];
const hash = buffer => createHash('sha256').update(buffer).digest('hex');

test('all preset compiles the canonical deterministic bundle byte-for-byte', () => {
  const firstDir = mkdtempSync(join(tmpdir(), 'cti-report-a-'));
  const secondDir = mkdtempSync(join(tmpdir(), 'cti-report-b-'));
  try {
    const first = compileReportBundle(snapshot, { ...options, outDir: firstDir });
    const second = compileReportBundle(snapshot, { ...options, outDir: secondDir });
    assert.deepEqual(readdirSync(firstDir).sort(), required);
    assert.deepEqual(readdirSync(secondDir).sort(), required);
    assert.equal(first.model.reportId, second.model.reportId);
    for (const name of required) assert.deepEqual(readFileSync(join(firstDir, name)), readFileSync(join(secondDir, name)), name);

    const manifest = JSON.parse(readFileSync(join(firstDir, 'manifest.json'), 'utf8'));
    assert.equal(manifest.reportId, first.model.reportId);
    assert.equal(manifest.generatedAt, options.generatedAt);
    assert.deepEqual(manifest.files.map(item => item.name), required.filter(name => name !== 'manifest.json'));
    for (const item of manifest.files) {
      const bytes = readFileSync(join(firstDir, item.name));
      assert.equal(item.bytes, bytes.length, item.name);
      assert.equal(item.sha256, hash(bytes), item.name);
    }
  } finally {
    rmSync(firstDir, { recursive: true, force: true });
    rmSync(secondDir, { recursive: true, force: true });
  }
});

test('bundle compiler runs the hard quality gate before writing any artifact', () => {
  const outDir = mkdtempSync(join(tmpdir(), 'cti-report-reject-'));
  const bad = JSON.parse(JSON.stringify(snapshot));
  bad.evidence[0].references.push('javascript:alert(1)');
  try {
    assert.throws(() => compileReportBundle(bad, { ...options, outDir }), ReportQualityError);
    assert.deepEqual(readdirSync(outDir), []);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});

test('report presets are a fixed bounded allowlist and invalid presets fail before output', () => {
  assert.deepEqual(Object.keys(REPORT_PRESETS).sort(), ['all', 'analyst', 'case', 'evidence', 'quick', 'sharing', 'soc']);
  for (const files of Object.values(REPORT_PRESETS)) {
    assert.ok(Array.isArray(files));
    assert.ok(files.length >= 2 && files.length <= required.length);
    assert.equal(files.includes('manifest.json'), true);
  }
  const outDir = mkdtempSync(join(tmpdir(), 'cti-report-preset-'));
  try {
    assert.throws(() => compileReportBundle(snapshot, { ...options, preset: '../../oops', outDir }), /unknown report preset/i);
    assert.deepEqual(readdirSync(outDir), []);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});

test('STIX export in the bundle is deterministic and structurally valid STIX 2.1', () => {
  const outDir = mkdtempSync(join(tmpdir(), 'cti-report-stix-'));
  try {
    compileReportBundle(snapshot, { ...options, outDir });
    const bundle = JSON.parse(readFileSync(join(outDir, 'intelligence.stix.json'), 'utf8'));
    assert.equal(bundle.type, 'bundle');
    assert.match(bundle.id, /^bundle--[0-9a-f-]{36}$/);
    assert.ok(bundle.objects.length >= 1);
    assert.equal(bundle.objects[0].spec_version, '2.1');
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});
