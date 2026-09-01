import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MISSION_HANDLERS,
  executeMissionCommand,
} from '../src/core/mission/command-adapter.js';
import {
  createMissionWorkspace,
  exportMissionWorkspace,
  reduceMissionWorkspace,
} from '../src/core/mission/workspace.js';

const profile = {
  id: 'bor',
  name: 'Example Industrial',
  technologies: ['fortinet'],
  telemetry: ['DeviceNetworkEvents'],
};

const context = {
  technologies: ['fortinet'],
  observedExploitation: true,
  requiredTelemetry: ['DeviceNetworkEvents'],
  evidenceConfidence: 0.8,
};

const hunt = {
  subject: 'Remote-access credential abuse',
  hypothesis: 'Valid-account abuse may produce anomalous endpoint activity.',
  attackIds: ['T1078'],
  evidenceFingerprints: ['a'.repeat(64)],
  sourceReferences: ['https://example.org/research'],
  kqlCandidates: ['DeviceNetworkEvents | where Timestamp > ago(24h) | project Timestamp, DeviceName, RemoteIP'],
};

function seededWorkspace() {
  let state = createMissionWorkspace();
  state = reduceMissionWorkspace(state, { type: 'PROFILE_SET', value: profile });
  state = reduceMissionWorkspace(state, { type: 'CONTEXT_SET', value: context });
  state = reduceMissionWorkspace(state, { type: 'HUNT_BUILD', value: hunt });
  return state;
}

test('shared adapter creates shows and mutates a workspace', async () => {
  const created = await executeMissionCommand({
    handler: 'mission-new',
    args: [],
    input: { type: 'void', value: null },
    workspace: null,
  });
  assert.equal(created.output.type, 'record');
  const updated = await executeMissionCommand({
    handler: 'mission-profile-set',
    args: [JSON.stringify(profile)],
    input: created.output,
    workspace: null,
  });
  assert.equal(updated.workspace.profile.id, 'bor');
  assert.deepEqual(updated.output.value, updated.workspace);
});

test('mission export returns one deterministic artifact contract', async () => {
  const workspace = createMissionWorkspace();
  const result = await executeMissionCommand({
    handler: 'mission-export',
    args: [],
    input: { type: 'record', value: workspace },
    workspace: null,
  });
  assert.deepEqual(Object.keys(result.output.value), ['filename', 'mimeType', 'encoding', 'content']);
  assert.deepEqual(result.output.value, {
    filename: 'para11ax-mission.json',
    mimeType: 'application/json;charset=utf-8',
    encoding: 'utf8',
    content: exportMissionWorkspace(workspace),
  });
});

test('adapter rejects malformed JSON without reflecting parser internals', async () => {
  await assert.rejects(
    executeMissionCommand({
      handler: 'mission-profile-set',
      args: ['{bad'],
      input: { type: 'void', value: null },
      workspace: createMissionWorkspace(),
    }),
    error => error.code === 'INVALID_ARGUMENT' && !error.message.toLowerCase().includes('position'),
  );
});

test('result analysis requests explicit content when inline input is absent', async () => {
  const calls = [];
  const outcome = await executeMissionCommand({
    handler: 'mission-result-analyze',
    args: [],
    input: { type: 'void', value: null },
    workspace: seededWorkspace(),
    loadContent: async request => {
      calls.push(request);
      return 'DeviceName\nhost-1\n';
    },
  });
  assert.deepEqual(calls, [{ kind: 'result', args: [] }]);
  assert.equal(outcome.workspace.result.state, 'RESULTS_PRESENT');
});

test('structured file and stdin flags delegate to the transport without interpretation', async () => {
  const calls = [];
  const outcome = await executeMissionCommand({
    handler: 'mission-context-set',
    args: ['--file', 'context.json'],
    input: { type: 'void', value: null },
    workspace: reduceMissionWorkspace(createMissionWorkspace(), { type: 'PROFILE_SET', value: profile }),
    loadContent: async request => {
      calls.push(request);
      return JSON.stringify(context);
    },
  });
  assert.deepEqual(calls, [{ kind: 'context', args: ['--file', 'context.json'] }]);
  assert.deepEqual(outcome.workspace.context.technologies, ['fortinet']);
});

test('loader cancellation aborts before any workspace mutation', async () => {
  const workspace = seededWorkspace();
  await assert.rejects(
    executeMissionCommand({
      handler: 'mission-import',
      args: [],
      input: { type: 'void', value: null },
      workspace,
      loadContent: async () => null,
    }),
    error => error.code === 'OPERATION_ABORTED',
  );
  assert.equal(workspace.revision, 3);
});

test('piped record is validated as the action workspace', async () => {
  const piped = seededWorkspace();
  const stale = createMissionWorkspace();
  const outcome = await executeMissionCommand({
    handler: 'mission-servicenow',
    args: [],
    input: { type: 'record', value: piped },
    workspace: stale,
  });
  assert.equal(outcome.workspace.serviceNow.huntId, piped.hunt.id);
});

test('mission handler registry is immutable and exact', () => {
  assert.equal(Object.isFrozen(MISSION_HANDLERS), true);
  assert.deepEqual(MISSION_HANDLERS, [
    'mission-new', 'mission-show', 'mission-profile-set', 'mission-context-set',
    'mission-relevance', 'mission-hunt-build', 'mission-kql-validate',
    'mission-result-analyze', 'mission-servicenow', 'mission-export', 'mission-import', 'mission-clear',
  ]);
});
