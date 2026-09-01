import test from 'node:test';
import assert from 'node:assert/strict';

import { COMMAND_REGISTRY } from '../app/shell-core/catalog.js';
import { createMissionContentLoader } from '../src/control/mission-content-loader.js';
import { createNodeShellExecutor, renderNodeShellOutput } from '../src/control/shell-node-executor.js';
import { createMissionWorkspace, exportMissionWorkspace } from '../src/core/mission/workspace.js';

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

function descriptor(tokens) {
  const found = COMMAND_REGISTRY.resolve(tokens, 'cli');
  assert.equal(found?.surfaceAvailable, true, tokens.join(' '));
  return found.descriptor;
}

async function run(executor, tokens, args = [], input = { type: 'void', value: null }) {
  return executor.execute({
    descriptor: descriptor(tokens),
    args,
    input,
    context: { surface: 'cli', authenticated: true },
  });
}

test('node loader accepts exactly one explicit transport', async () => {
  const loader = createMissionContentLoader({
    readFile: async path => path === 'profile.json' ? '{"id":"x","name":"X"}' : '',
    stdinContent: 'DeviceName\nhost-1\n',
  });
  assert.equal(await loader({ kind: 'profile', args: ['--file', 'profile.json'] }), '{"id":"x","name":"X"}');
  assert.equal(await loader({ kind: 'result', args: ['--stdin'] }), 'DeviceName\nhost-1\n');
  await assert.rejects(
    loader({ kind: 'result', args: ['--file', 'x', '--stdin'] }),
    error => error.code === 'POLICY_DENIED',
  );
});

test('node loader rejects implicit unknown and oversized content', async () => {
  const loader = createMissionContentLoader({
    readFile: async () => 'x'.repeat((2 * 1024 * 1024) + 1),
    stdinContent: null,
  });
  await assert.rejects(loader({ kind: 'workspace', args: [] }), error => error.code === 'POLICY_DENIED');
  await assert.rejects(loader({ kind: 'unknown', args: ['--file', 'x'] }), error => error.code === 'POLICY_DENIED');
  await assert.rejects(loader({ kind: 'profile', args: ['--path', 'x'] }), error => error.code === 'POLICY_DENIED');
  await assert.rejects(loader({ kind: 'profile', args: ['--file', 'x'] }), error => error.code === 'OUTPUT_LIMIT');
  await assert.rejects(loader({ kind: 'result', args: ['--stdin'] }), error => error.code === 'POLICY_DENIED');
});

test('Node executor owns process-local mission state and explicit file import', async () => {
  const files = new Map([
    ['mission.json', exportMissionWorkspace(createMissionWorkspace())],
    ['profile.json', JSON.stringify(profile)],
    ['context.json', JSON.stringify(context)],
  ]);
  const executor = createNodeShellExecutor({
    registry: COMMAND_REGISTRY,
    missionReadFile: async path => files.get(path) ?? (() => { throw new Error('not found'); })(),
  });
  await run(executor, ['mission', 'import'], ['--file', 'mission.json']);
  await run(executor, ['mission', 'profile', 'set'], ['--file', 'profile.json']);
  await run(executor, ['mission', 'context', 'set'], ['--file', 'context.json']);
  const relevance = await run(executor, ['mission', 'relevance']);
  assert.equal(relevance.value.relevance.schemaVersion, 'mission-relevance-v1.0');
  assert.equal(executor.state().missionWorkspace.revision, 3);
  await run(executor, ['disconnect']);
  assert.equal(executor.state().missionWorkspace, null);
});

test('Node mission export renders deterministic artifact content directly', async () => {
  const executor = createNodeShellExecutor({ registry: COMMAND_REGISTRY });
  const workspace = await run(executor, ['mission', 'new']);
  const artifact = await run(executor, ['mission', 'export'], [], workspace);
  assert.equal(artifact.type, 'artifact');
  assert.equal(renderNodeShellOutput(artifact, {
    descriptor: descriptor(['mission', 'export']),
    pipelineLength: 1,
  }), artifact.value.content);
});

test('Node mission commands never use the gateway fetch path', async () => {
  const executor = createNodeShellExecutor({
    registry: COMMAND_REGISTRY,
    fetchImpl: async () => { throw new Error('gateway called'); },
  });
  await run(executor, ['mission', 'new']);
  await run(executor, ['mission', 'profile', 'set'], [JSON.stringify(profile)]);
  await run(executor, ['mission', 'context', 'set'], [JSON.stringify(context)]);
  const output = await run(executor, ['mission', 'relevance']);
  assert.equal(output.value.relevance.label, 'moderate');
});
