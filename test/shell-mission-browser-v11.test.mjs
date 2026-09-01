import test from 'node:test';
import assert from 'node:assert/strict';

import { COMMAND_REGISTRY } from '../app/shell-core/catalog.js';
import { createBrowserShellExecutor } from '../app/shell-browser-executor.js';
import { createMissionWorkspace, exportMissionWorkspace } from '../src/core/mission/workspace.js';
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

const hunt = {
  subject: 'Remote-access credential abuse',
  hypothesis: 'Valid-account abuse may produce anomalous endpoint activity.',
  attackIds: ['T1078'],
  evidenceFingerprints: ['a'.repeat(64)],
  sourceReferences: ['https://example.org/research'],
  kqlCandidates: ['DeviceNetworkEvents | where Timestamp > ago(24h) | project Timestamp, DeviceName, RemoteIP'],
};

function browserFixture({ client = makeClient(), session = makeSession(), downloads, missionFiles, ui, initialState } = {}) {
  return {
    client,
    session,
    cases: null,
    history: null,
    ui,
    downloads: downloads ?? { save: () => {} },
    missionFiles,
    clipboard: { writeText: async () => {} },
    audio: makeAudio(),
    now: () => new Date('2026-09-01T12:00:00.000Z'),
    monotonicNow: () => 1000,
    version: '2.0.0',
    initialState,
  };
}

function resolve(tokens) {
  const found = COMMAND_REGISTRY.resolve(tokens, 'web');
  assert.equal(found?.surfaceAvailable, true, tokens.join(' '));
  return found.descriptor;
}

async function run(executor, tokens, args = [], input = { type: 'void', value: null }) {
  return executor.execute({
    descriptor: resolve(tokens),
    args,
    input,
    context: { surface: 'web', authenticated: true },
    signal: new AbortController().signal,
  });
}

test('browser mission state is volatile and sequential', async () => {
  const executor = createBrowserShellExecutor(browserFixture());
  await run(executor, ['mission', 'new']);
  await run(executor, ['mission', 'profile', 'set'], [JSON.stringify(profile)]);
  assert.equal(executor.state().missionWorkspace.profile.id, 'bor');
  await run(executor, ['disconnect']);
  assert.equal(executor.state().missionWorkspace, null);
});

test('browser auth clear preserves mission work while reboot destroys it', async () => {
  const executor = createBrowserShellExecutor(browserFixture({ ui: { reboot: async () => {} } }));
  await run(executor, ['mission', 'new']);
  await run(executor, ['mission', 'profile', 'set'], [JSON.stringify(profile)]);
  await run(executor, ['auth', 'clear']);
  assert.equal(executor.state().missionWorkspace.profile.id, 'bor');
  await run(executor, ['reboot']);
  assert.equal(executor.state().missionWorkspace, null);
});

test('browser mission export remains in memory until explicit download', async () => {
  const saved = [];
  const executor = createBrowserShellExecutor(browserFixture({
    downloads: { save: (...args) => saved.push(args) },
  }));
  const output = await run(executor, ['mission', 'export'], [], {
    type: 'record',
    value: createMissionWorkspace(),
  });
  assert.equal(output.type, 'artifact');
  assert.equal(saved.length, 0);
  await run(executor, ['download'], [], output);
  assert.equal(saved.length, 1);
  assert.deepEqual(saved[0], [output.value.content, output.value.mimeType, output.value.filename]);
});

test('browser import and result selection use only the explicit mission file callback', async () => {
  const requests = [];
  const executor = createBrowserShellExecutor(browserFixture({
    missionFiles: {
      async select(request) {
        requests.push(request);
        if (request.kind === 'workspace') return exportMissionWorkspace(createMissionWorkspace());
        return 'DeviceName\nhost-1\n';
      },
    },
  }));
  await run(executor, ['mission', 'import']);
  await run(executor, ['mission', 'profile', 'set'], [JSON.stringify(profile)]);
  await run(executor, ['mission', 'context', 'set'], [JSON.stringify(context)]);
  await run(executor, ['mission', 'hunt', 'build'], [JSON.stringify(hunt)]);
  await run(executor, ['mission', 'result', 'analyze']);
  assert.deepEqual(requests, [{ kind: 'workspace', args: [] }, { kind: 'result', args: [] }]);
  assert.equal(executor.state().missionWorkspace.result.state, 'RESULTS_PRESENT');
});

test('complete browser mission lifecycle makes zero gateway calls', async () => {
  const calls = [];
  const base = makeClient();
  const client = new Proxy(base, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== 'function') return value;
      return (...args) => {
        calls.push(String(property));
        return value(...args);
      };
    },
  });
  const executor = createBrowserShellExecutor(browserFixture({ client }));
  await run(executor, ['mission', 'new']);
  await run(executor, ['mission', 'profile', 'set'], [JSON.stringify(profile)]);
  await run(executor, ['mission', 'context', 'set'], [JSON.stringify(context)]);
  await run(executor, ['mission', 'relevance']);
  await run(executor, ['mission', 'hunt', 'build'], [JSON.stringify(hunt)]);
  await run(executor, ['mission', 'result', 'analyze'], ['DeviceName,RemoteIP\nhost-1,203.0.113.10\n']);
  await run(executor, ['mission', 'servicenow']);
  assert.equal(executor.state().missionWorkspace.serviceNow.provenance.autoSubmission, false);
  assert.deepEqual(calls, []);
});

test('browser executor validates an injected initial mission workspace', () => {
  assert.throws(() => createBrowserShellExecutor(browserFixture({
    initialState: { missionWorkspace: { schemaVersion: 'mission-workspace-v2.0' } },
  })), /mission workspace/i);
});
