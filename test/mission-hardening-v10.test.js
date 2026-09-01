import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeClientProfile } from '../src/core/mission/client-profile.js';
import { assessClientRelevance } from '../src/core/mission/relevance.js';
import { validateMissionKql } from '../src/core/mission/kql-validator.js';
import { buildHuntPackage } from '../src/core/mission/hunt-package.js';
import { analyzeMissionResults } from '../src/core/mission/result-analysis.js';
import { buildServiceNowProjection } from '../src/report/render-servicenow.js';

const baseProfile = {
  id: 'example',
  name: 'Example Industrial',
  technologies: ['fortinet'],
  telemetry: ['DeviceNetworkEvents'],
};

const baseHunt = {
  profile: baseProfile,
  context: {
    technologies: ['fortinet'],
    observedExploitation: true,
    requiredTelemetry: ['DeviceNetworkEvents'],
    evidenceConfidence: 0.8,
  },
  hypothesis: 'Valid-account abuse may create anomalous endpoint network activity.',
  subject: 'Remote-access credential abuse',
  attackIds: ['T1078'],
  evidenceFingerprints: ['c'.repeat(64)],
  sourceReferences: ['https://example.org/research'],
  kqlCandidates: ['DeviceNetworkEvents | where Timestamp > ago(24h) | project Timestamp, DeviceName, RemoteIP'],
};

test('missing client-side factor facts remain explicit relevance gaps', () => {
  const profile = normalizeClientProfile(baseProfile);
  const assessment = assessClientRelevance(profile, { industries: ['chemicals'] });
  assert.equal(assessment.score, 0);
  assert.equal(assessment.gaps.includes('industry'), true);
  assert.match(assessment.factors.find(item => item.id === 'industry').rationale, /client profile/i);
});

test('multi-table KQL fails closed when column scope cannot be proven', () => {
  const result = validateMissionKql('DeviceNetworkEvents | join DeviceProcessEvents on DeviceId | project Timestamp, DeviceName');
  assert.equal(result.state, 'SCHEMA_UNVERIFIED');
  assert.equal(result.warnings.includes('multi_table_column_scope_unverified'), true);
});

test('unsupported where/project expressions fail closed rather than receiving VALID', () => {
  const whereResult = validateMissionKql('DeviceNetworkEvents | where isnotempty(RemoteIP) | project Timestamp, RemoteIP');
  assert.equal(whereResult.state, 'SCHEMA_UNVERIFIED');
  assert.equal(whereResult.warnings.includes('where_expression_unverified'), true);

  const projectResult = validateMissionKql('DeviceNetworkEvents | where Timestamp > ago(1h) | project Host=strcat(DeviceName, ":", RemoteIP)');
  assert.equal(projectResult.state, 'SCHEMA_UNVERIFIED');
  assert.equal(projectResult.warnings.includes('project_expression_unverified'), true);
});

test('profile and hunt fields reject control characters at their input boundary', () => {
  assert.throws(() => normalizeClientProfile({ id: 'x', name: 'Bad\nName' }), /control/i);
  assert.throws(() => buildHuntPackage({ ...baseHunt, subject: 'Bad\nSubject' }), /control/i);
});

test('ServiceNow projection strips CR/LF even when passed a defensively malformed hunt object', () => {
  const hunt = buildHuntPackage(baseHunt);
  const tainted = { ...hunt, profileName: 'Client\nInjected: yes', subject: 'Subject\r\nResult state: spoofed' };
  const projection = buildServiceNowProjection(tainted, analyzeMissionResults([]));
  assert.equal(/[\r\n]/.test(projection.client.name), false);
  assert.equal(/[\r\n]/.test(projection.title), false);
  assert.equal(projection.title.includes('Result state: spoofed'), true);
});

test('content-derived hunt ID changes when client telemetry changes derived state', () => {
  const ready = buildHuntPackage(baseHunt);
  const gap = buildHuntPackage({ ...baseHunt, profile: { ...baseProfile, telemetry: [] } });
  assert.equal(ready.state, 'READY');
  assert.equal(gap.state, 'TELEMETRY_GAP');
  assert.notEqual(ready.id, gap.id);
});

test('CSV parser rejects characters after a closing quoted field before a delimiter', () => {
  assert.throws(() => analyzeMissionResults('A,B\n"ok"junk,value\n'), /CSV/i);
});
