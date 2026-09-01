import test from 'node:test';
import assert from 'node:assert/strict';

import { COMMAND_REGISTRY } from '../app/shell-core/catalog.js';
import { createBrowserShellExecutor } from '../app/shell-browser-executor.js';
import { createNodeShellExecutor } from '../src/control/shell-node-executor.js';
import { executeMissionCommand } from '../src/core/mission/command-adapter.js';
import { importMissionWorkspace } from '../src/core/mission/workspace.js';
import { makeAudio, makeClient, makeSession } from './helpers/shell-v9-fixtures.mjs';

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

const kql = 'DeviceNetworkEvents | where Timestamp > ago(24h) | project Timestamp, DeviceName, RemoteIP';
const hunt = {
  subject: 'Remote-access credential abuse',
  hypothesis: 'Valid-account abuse may produce anomalous endpoint activity.',
  attackIds: ['T1078'],
  evidenceFingerprints: ['a'.repeat(64)],
  sourceReferences: ['https://example.org/research'],
  kqlCandidates: [kql],
};
const csv = 'DeviceName,RemoteIP\nhost-1,203.0.113.10\n';

const stages = Object.freeze([
  ['mission-profile-set', [JSON.stringify(profile)]],
  ['mission-context-set', [JSON.stringify(context)]],
  ['mission-relevance', []],
  ['mission-hunt-build', [JSON.stringify(hunt)]],
  ['mission-kql-validate', [kql]],
  ['mission-result-analyze', [csv]],
  ['mission-servicenow', []],
]);

function tokensFor(handler) {
  const descriptor = COMMAND_REGISTRY.all().find(item => item.handler === handler);
  assert.ok(descriptor, handler);
  return descriptor.tokens;
}

async function adapterWorkflow() {
  let outcome = await executeMissionCommand({ handler: 'mission-new' });
  for (const [handler, args] of stages) {
    outcome = await executeMissionCommand({ handler, args, workspace: outcome.workspace });
  }
  const exported = await executeMissionCommand({ handler: 'mission-export', workspace: outcome.workspace });
  const content = exported.output.value.content;
  const imported = await executeMissionCommand({
    handler: 'mission-import',
    workspace: outcome.workspace,
    loadContent: async () => content,
  });
  return (await executeMissionCommand({ handler: 'mission-export', workspace: imported.workspace })).output.value.content;
}

async function executorWorkflow(surface) {
  let roundTrip = null;
  const executor = surface === 'web'
    ? createBrowserShellExecutor({
      client: makeClient(),
      session: makeSession(),
      downloads: { save: () => {} },
      missionFiles: { select: async () => roundTrip },
      clipboard: { writeText: async () => {} },
      audio: makeAudio(),
    })
    : createNodeShellExecutor({
      registry: COMMAND_REGISTRY,
      fetchImpl: async () => { throw new Error('gateway must not run'); },
      missionReadFile: async () => roundTrip,
    });

  const invoke = async (handler, args = [], input = { type: 'void', value: null }) => {
    const descriptor = COMMAND_REGISTRY.resolve(tokensFor(handler), surface).descriptor;
    return executor.execute({ descriptor, args, input, context: { surface, authenticated: true } });
  };

  await invoke('mission-new');
  for (const [handler, args] of stages) await invoke(handler, args);
  const artifact = await invoke('mission-export');
  roundTrip = artifact.value.content;
  await invoke('mission-import', surface === 'cli' ? ['--file', 'roundtrip.json'] : []);
  return (await invoke('mission-export')).value.content;
}

test('shared adapter Web and CLI produce byte-identical complete mission bundles', async () => {
  const [adapter, web, cli] = await Promise.all([
    adapterWorkflow(),
    executorWorkflow('web'),
    executorWorkflow('cli'),
  ]);
  assert.equal(web, adapter);
  assert.equal(cli, adapter);
  const bundle = importMissionWorkspace(adapter);
  assert.equal(bundle.hunt.state, 'READY');
  assert.equal(bundle.result.state, 'RESULTS_PRESENT');
  assert.equal(bundle.serviceNow.provenance.projectionOnly, true);
  assert.equal(bundle.serviceNow.provenance.autoSubmission, false);
  assert.match(bundle.serviceNow.recommendedActions.join(' '), /Analyst approval required/i);
  assert.equal(bundle.revision, 7);
});
