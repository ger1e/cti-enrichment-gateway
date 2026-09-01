import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMissionKql } from '../src/core/mission/kql-validator.js';

test('known Microsoft hunt query validates against the bounded static schema', () => {
  const result = validateMissionKql(`
DeviceNetworkEvents
| where Timestamp > ago(24h)
| where RemoteIP == "203.0.113.10"
| project Timestamp, DeviceName, RemoteIP, RemoteUrl
`);
  assert.equal(result.state, 'VALID');
  assert.deepEqual(result.tables, ['DeviceNetworkEvents']);
  assert.deepEqual(result.unknownTables, []);
  assert.deepEqual(result.unknownColumns, []);
  assert.deepEqual(result.warnings, []);
  assert.equal(Object.isFrozen(result), true);
});

test('unknown table fails closed as schema unverified', () => {
  const result = validateMissionKql('ImaginarySecurityEvents | where Foo == "x" | project Foo');
  assert.equal(result.state, 'SCHEMA_UNVERIFIED');
  assert.deepEqual(result.unknownTables, ['ImaginarySecurityEvents']);
});

test('deterministically extractable unknown columns fail closed', () => {
  const result = validateMissionKql('DeviceNetworkEvents | where ImaginaryColumn == "x" | project Timestamp, ImaginaryColumn');
  assert.equal(result.state, 'SCHEMA_UNVERIFIED');
  assert.deepEqual(result.unknownColumns, ['DeviceNetworkEvents.ImaginaryColumn']);
});

test('broad wildcard search patterns are never treated as validated hunts', () => {
  for (const query of ['search *', 'union * | take 10']) {
    const result = validateMissionKql(query);
    assert.equal(result.state, 'SCHEMA_UNVERIFIED');
    assert.equal(result.warnings.includes('broad_unbounded_query'), true);
  }
});

test('query management/control commands are rejected rather than linted as hunts', () => {
  for (const query of ['.show tables', '.drop table DeviceNetworkEvents', '.set-or-append X <| DeviceNetworkEvents']) {
    assert.throws(() => validateMissionKql(query), /control command/i);
  }
});

test('empty and oversized KQL are rejected before analysis', () => {
  assert.throws(() => validateMissionKql('  '), /empty/i);
  assert.throws(() => validateMissionKql('x'.repeat(32_001)), /too large/i);
});
