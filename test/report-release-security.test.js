import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileReportBundle } from '../src/report/compiler.js';
import { ReportQualityError } from '../src/report/quality.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/report/enrichment.json', import.meta.url), 'utf8'));
const baseOptions = {
  generatedAt: '2026-08-22T08:30:00.000Z',
  sourceSha: '0123456789abcdef0123456789abcdef01234567',
};

test('raw snapshot secret material fails closed before evidence.json can be written', () => {
  const snapshot = JSON.parse(JSON.stringify(fixture));
  snapshot.debug = {
    MODAT_API_KEY: 'synthetic-test-secret-never-emit',
    authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0In0.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  };
  const outDir = mkdtempSync(join(tmpdir(), 'cti-report-secret-'));
  try {
    assert.throws(
      () => compileReportBundle(snapshot, { ...baseOptions, preset: 'all', outDir }),
      ReportQualityError,
    );
    assert.deepEqual(readdirSync(outDir), []);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});

test('sharing preset rejects internal or internal-only provider evidence before output', () => {
  const outDir = mkdtempSync(join(tmpdir(), 'cti-report-sharing-'));
  try {
    assert.throws(
      () => compileReportBundle(fixture, { ...baseOptions, preset: 'sharing', outDir }),
      error => error instanceof ReportQualityError && error.violations.some(item => item.code === 'restricted_distribution'),
    );
    assert.deepEqual(readdirSync(outDir), []);
  } finally {
    rmSync(outDir, { recursive: true, force: true });
  }
});
