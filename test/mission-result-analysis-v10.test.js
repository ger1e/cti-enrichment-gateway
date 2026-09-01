import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMissionResults } from '../src/core/mission/result-analysis.js';

test('JSON result rows are analyzed deterministically without evidence promotion', () => {
  const result = analyzeMissionResults([
    { DeviceName: 'host-01', RemoteIP: '203.0.113.10', Count: 2 },
    { DeviceName: 'host-02', RemoteIP: '', Count: 0 },
  ]);
  assert.equal(result.format, 'json');
  assert.equal(result.state, 'RESULTS_PRESENT');
  assert.equal(result.rowCount, 2);
  assert.equal(result.nonEmptyRowCount, 2);
  assert.deepEqual(result.columns, ['Count', 'DeviceName', 'RemoteIP']);
  assert.equal(result.formulaLikeCellCount, 0);
  assert.equal(Object.isFrozen(result), true);
});

test('CSV parser handles quoted fields and keeps spreadsheet-like strings inert', () => {
  const result = analyzeMissionResults('DeviceName,CommandLine\r\nhost-01,"powershell, -enc AAA"\r\nhost-02,"=cmd|\' /C calc\'!A0"\r\n');
  assert.equal(result.format, 'csv');
  assert.equal(result.state, 'RESULTS_PRESENT');
  assert.equal(result.rowCount, 2);
  assert.equal(result.formulaLikeCellCount, 1);
  assert.deepEqual(result.columns, ['CommandLine', 'DeviceName']);
});

test('zero-row input is explicit NO_RESULTS and never a benign verdict', () => {
  const result = analyzeMissionResults([]);
  assert.equal(result.state, 'NO_RESULTS');
  assert.equal(result.rowCount, 0);
  assert.deepEqual(result.limitations, ['no_results_is_not_benign_evidence']);
});

test('empty text is represented explicitly without inventing a result', () => {
  const result = analyzeMissionResults('   ');
  assert.equal(result.state, 'IMPORT_EMPTY');
  assert.equal(result.rowCount, 0);
});

test('malformed, nested and oversized result input fails closed', () => {
  assert.throws(() => analyzeMissionResults('{bad json'), /invalid result/i);
  assert.throws(() => analyzeMissionResults([{ Nested: { bad: true } }]), /flat primitive/i);
  assert.throws(() => analyzeMissionResults('x'.repeat((2 * 1024 * 1024) + 1)), /too large/i);
  assert.throws(() => analyzeMissionResults(Array.from({ length: 5001 }, (_, i) => ({ i }))), /too many rows/i);
});
