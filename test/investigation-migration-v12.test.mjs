import assert from 'node:assert/strict';
import test from 'node:test';
import { addNote, addPin, appendSnapshot, createCase } from '../app/case-model.js';
import { createMissionWorkspace, reduceMissionWorkspace } from '../src/core/mission/workspace.js';
import {
  INVESTIGATION_LIMITS,
  adoptMissionWorkspace,
  createInvestigation,
  exportInvestigation,
  migrateCaseToInvestigation,
} from '../src/core/investigation/index.js';

const NOW = '2026-09-02T12:00:00.000Z';
let sequence = 0;
const uuid = () => `id-${++sequence}`;
const now = () => NOW;

function evidence(requestId, verdict) {
  return {
    schemaVersion: '2.0',
    requestId,
    type: 'ip',
    indicator: '203.0.113.10',
    evidence: [{ provider: 'fixture', observation: { verdict } }],
    relationships: [],
    failures: [],
  };
}

function legacyCase() {
  sequence = 0;
  let value = createCase({ title: 'Legacy case', now, uuid });
  value = addPin(value, { type: 'ip', value: '203.0.113.10' }, { now });
  value = addNote(value, 'Analyst note', { now, uuid });
  value = appendSnapshot(value, evidence('request-1', 'unknown'), { now, uuid });
  value = appendSnapshot(value, evidence('request-2', 'observed'), { now, uuid });
  return value;
}

function missionWorkspace() {
  let value = createMissionWorkspace();
  value = reduceMissionWorkspace(value, {
    type: 'PROFILE_SET',
    value: { id: 'client-1', name: 'Example Client', technologies: ['fortinet'] },
  });
  value = reduceMissionWorkspace(value, {
    type: 'CONTEXT_SET',
    value: { technologies: ['fortinet'], observedExploitation: true },
  });
  return reduceMissionWorkspace(value, { type: 'RELEVANCE_ASSESS' });
}

test('migrates compatible authoritative case content without synthesizing evidence', () => {
  const source = legacyCase();
  const migrated = migrateCaseToInvestigation(source, { now });
  assert.equal(migrated.id, source.id);
  assert.equal(migrated.title, source.title);
  assert.deepEqual(migrated.observables.map(({ type, value }) => ({ type, value })), [{ type: 'ip', value: '203.0.113.10' }]);
  assert.equal(migrated.evidenceSnapshots.length, 2);
  assert.equal(migrated.evidenceSnapshots[0].diffFromPrevious, null);
  assert.deepEqual(migrated.evidenceSnapshots[1].diffFromPrevious, source.diffs[0]);
  assert.deepEqual(migrated.notes, source.notes.map(({ id, text, addedAt }) => ({ id, text, at: addedAt })));
  assert.equal(migrated.operatorArtifacts.length, 0);
  assert.equal(migrated.workflow.hunt, null);
  assert.equal(migrated.timeline.at(-1).action, 'MIGRATED_CASE_V1');
});

test('rejects legacy cases exceeding Investigation v2 limits without changing the source', () => {
  const source = legacyCase();
  source.pins = Array.from({ length: INVESTIGATION_LIMITS.observables + 1 }, (_, index) => ({ type: 'ip', value: `203.0.113.${index}`, addedAt: NOW }));
  const before = structuredClone(source);
  assert.throws(() => migrateCaseToInvestigation(source, { now }), /exceeds investigation limits/i);
  assert.deepEqual(source, before);
});

test('adopts a validated mission by rebuilding derived state', () => {
  const current = createInvestigation({ title: 'Mission adoption', now, uuid: () => 'inv-adopt' });
  const mission = missionWorkspace();
  const adopted = adoptMissionWorkspace(current, mission, { now, uuid });
  assert.deepEqual(adopted.scope.profile, mission.profile);
  assert.deepEqual(adopted.scope.context, mission.context);
  assert.deepEqual(adopted.workflow.relevance, mission.relevance);
  assert.notStrictEqual(adopted.workflow.relevance, mission.relevance);
  assert.equal(adopted.revision, 1);
});

test('mission scope conflicts fail atomically', () => {
  const empty = createInvestigation({ title: 'Scoped', now, uuid: () => 'inv-conflict' });
  const current = structuredClone(empty);
  current.scope.profile = { id: 'different', name: 'Different', technologies: [], industries: [], geographies: [], telemetry: [], criticalAssets: [], constraints: [] };
  const before = exportInvestigation(current);
  assert.throws(() => adoptMissionWorkspace(current, missionWorkspace(), { now, uuid }), /scope conflict/i);
  assert.equal(exportInvestigation(current), before);
});
