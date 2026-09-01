import test from 'node:test';
import assert from 'node:assert/strict';
import { buildHuntPackage } from '../src/core/mission/hunt-package.js';

const profile = {
  id: 'bor-eu',
  name: 'Borealis',
  technologies: ['fortinet'],
  industries: ['chemicals'],
  geographies: ['eu'],
  attackPaths: ['remote access'],
  priorityActors: ['lynx'],
  telemetry: ['DeviceNetworkEvents', 'SigninLogs'],
};

const base = {
  profile,
  context: {
    technologies: ['fortinet'],
    observedExploitation: true,
    industries: ['chemicals'],
    geographies: ['eu'],
    attackPaths: ['remote access'],
    actors: ['lynx'],
    requiredTelemetry: ['DeviceNetworkEvents'],
    evidenceConfidence: 0.8,
  },
  hypothesis: 'Threat activity using valid remote-access credentials may create anomalous external connections from managed endpoints.',
  subject: 'Fortinet remote-access credential abuse',
  attackIds: ['T1078', 'T1021'],
  evidenceFingerprints: ['a'.repeat(64)],
  sourceReferences: ['https://example.org/research/fortinet'],
  kqlCandidates: [
    'DeviceNetworkEvents | where Timestamp > ago(24h) | project Timestamp, DeviceName, RemoteIP, RemoteUrl',
  ],
};

test('hunt package is deterministic, immutable and READY only with sufficient evidence and telemetry', () => {
  const a = buildHuntPackage(base);
  const b = buildHuntPackage(JSON.parse(JSON.stringify(base)));
  assert.equal(a.id, b.id);
  assert.match(a.id, /^HNT-[0-9a-f]{16}$/);
  assert.equal(a.state, 'READY');
  assert.equal(a.relevance.score, 99);
  assert.deepEqual(a.requiredTelemetry, ['devicenetworkevents']);
  assert.deepEqual(a.availableTelemetry, ['devicenetworkevents']);
  assert.deepEqual(a.telemetryGaps, []);
  assert.equal(a.kqlCandidates[0].validation.state, 'VALID');
  assert.equal(Object.isFrozen(a), true);
  assert.equal(Object.isFrozen(a.kqlCandidates), true);
});

test('missing required client telemetry fails closed as TELEMETRY_GAP', () => {
  const hunt = buildHuntPackage({
    ...base,
    context: { ...base.context, requiredTelemetry: ['DeviceProcessEvents'] },
  });
  assert.equal(hunt.state, 'TELEMETRY_GAP');
  assert.deepEqual(hunt.telemetryGaps, ['deviceprocessevents']);
});

test('unverified KQL schema fails closed as SCHEMA_UNVERIFIED', () => {
  const hunt = buildHuntPackage({ ...base, kqlCandidates: ['ImaginarySecurityEvents | project Foo'] });
  assert.equal(hunt.state, 'SCHEMA_UNVERIFIED');
  assert.equal(hunt.kqlCandidates[0].validation.state, 'SCHEMA_UNVERIFIED');
});

test('lack of defensible provenance produces INSUFFICIENT_EVIDENCE', () => {
  const hunt = buildHuntPackage({ ...base, evidenceFingerprints: [], sourceReferences: [] });
  assert.equal(hunt.state, 'INSUFFICIENT_EVIDENCE');
});

test('hunt inputs reject malformed provenance and unsupported ATT&CK identifiers', () => {
  assert.throws(() => buildHuntPackage({ ...base, evidenceFingerprints: ['bad'] }), /fingerprint/i);
  assert.throws(() => buildHuntPackage({ ...base, sourceReferences: ['javascript:alert(1)'] }), /source reference/i);
  assert.throws(() => buildHuntPackage({ ...base, attackIds: ['TA0001'] }), /ATT&CK/i);
});
