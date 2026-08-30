import assert from 'node:assert/strict';
import test from 'node:test';

import { COMMAND_REGISTRY } from '../app/shell-core/catalog.js';
import { createBrowserShellExecutor } from '../app/shell-browser-executor.js';
import { makeAudio, makeClient, makeEnvelope, makeSession } from './helpers/shell-v9-fixtures.mjs';

function descriptor(tokens) {
  const resolved = COMMAND_REGISTRY.resolve(tokens, 'web');
  assert.ok(resolved?.surfaceAvailable, `missing web command ${tokens.join(' ')}`);
  return resolved.descriptor;
}

function makeExecutor({ client = makeClient(), session = makeSession(), initialState, events = [], history = null, ui = null } = {}) {
  return createBrowserShellExecutor({
    client,
    session,
    cases: null,
    history,
    ui,
    downloads: { save: (...args) => events.push(['download', ...args]) },
    clipboard: { writeText: async value => events.push(['copy', value]) },
    audio: { ...makeAudio(), mute: value => events.push(['mute', value]), setVolume: value => events.push(['volume', value]) },
    now: () => new Date('2026-08-30T12:34:56.000Z'),
    monotonicNow: () => 5000,
    version: '2.0.0',
    initialState,
  });
}

async function execute(executor, tokens, args = [], input = { type: 'void', value: null }) {
  return executor.execute({
    descriptor: descriptor(tokens),
    args,
    input,
    context: { surface: 'web', authenticated: true, profile: executor.state().profile },
    signal: new AbortController().signal,
  });
}

test('browser enrich runs the gateway client and updates current result', async () => {
  const calls = [];
  const result = makeEnvelope('8.8.8.8');
  const executor = makeExecutor({ client: makeClient({ enrich: async (...args) => { calls.push(args); return result; } }) });
  const output = await execute(executor, ['enrich'], ['8.8.8.8']);
  assert.equal(output.type, 'enrichment');
  assert.equal(output.value, result);
  assert.deepEqual(calls[0].slice(0, 2), ['8.8.8.8', 'standard']);
  assert.equal(executor.state().currentResult.requestId, 'req-1');
});

test('profile and gateway read handlers preserve bounded browser state', async () => {
  const executor = makeExecutor();
  assert.deepEqual(await execute(executor, ['profile'], ['full']), { type: 'text', value: 'profile: full' });
  assert.equal(executor.state().profile, 'full');
  assert.deepEqual(await execute(executor, ['system', 'meta']), { type: 'record', value: { providers: [] } });
  assert.deepEqual(await execute(executor, ['system', 'health']), { type: 'record', value: { status: 'ok' } });
});

test('registry discovery and history commands execute through the shared browser executor', async () => {
  const historyEvents = [];
  const history = {
    entries: () => ['help', 'enrich 8.8.8.8'],
    clear: () => historyEvents.push('clear'),
  };
  const executor = makeExecutor({ history });
  const help = await execute(executor, ['help']);
  const aliases = await execute(executor, ['aliases']);
  const limits = await execute(executor, ['limits']);
  const historyOutput = await execute(executor, ['history']);
  const cleared = await execute(executor, ['history', 'clear']);
  assert.equal(help.type, 'text');
  assert.match(help.value, /PARA11AX COMMAND INDEX/);
  assert.equal(aliases.type, 'records');
  assert.equal(limits.type, 'record');
  assert.deepEqual(historyOutput, { type: 'text', value: 'help\nenrich 8.8.8.8' });
  assert.deepEqual(cleared, { type: 'text', value: 'history cleared' });
  assert.deepEqual(historyEvents, ['clear']);
});

test('browser-only presentation effects are delegated without shell UI command dispatch', async () => {
  const events = [];
  const ui = {
    requestLogin: () => events.push('login'),
    clear: () => events.push('clear'),
    reboot: async () => events.push('reboot'),
  };
  const executor = makeExecutor({ ui });
  assert.deepEqual(await execute(executor, ['login']), { type: 'text', value: 'hidden bearer prompt required' });
  assert.deepEqual(await execute(executor, ['clear']), { type: 'text', value: '' });
  assert.deepEqual(await execute(executor, ['reboot']), { type: 'text', value: 'reboot' });
  assert.deepEqual(events, ['login', 'clear', 'reboot']);
});

test('specialist OSINT handlers delegate exact bounded inputs', async () => {
  const calls = [];
  const client = makeClient({
    shodan: async (input) => { calls.push(['shodan', input]); return { requestId: 's1', command: input.command, creditImpact: 'none', durationMs: 1, data: {} }; },
    userScanner: async (input) => { calls.push(['user-scanner', input]); return { scanId: 'u1', durationMs: 1, summary: {}, results: [], erroredSites: [] }; },
  });
  const executor = makeExecutor({ client });
  const shodan = await execute(executor, ['shodan'], ['info']);
  const scanner = await execute(executor, ['user-scanner'], ['username', 'ger1e', '--cross-scan']);
  assert.equal(shodan.type, 'record');
  assert.equal(scanner.type, 'record');
  assert.deepEqual(calls, [
    ['shodan', { command: 'info', target: null, query: null, facets: null }],
    ['user-scanner', { scanType: 'username', target: 'ger1e', category: null, module: null, crossScan: true, noNsfw: true }],
  ]);
});

test('local browser controls are explicit and never evaluate host commands', async () => {
  const events = [];
  const executor = makeExecutor({ events });
  assert.deepEqual(await execute(executor, ['echo'], ['a', 'b']), { type: 'text', value: 'a b' });
  assert.deepEqual(await execute(executor, ['pwd']), { type: 'text', value: '/para11ax' });
  await execute(executor, ['sound'], ['off']);
  await execute(executor, ['volume'], ['75']);
  assert.deepEqual(events, [['mute', true], ['volume', 0.75]]);
});

test('disconnect clears executor result state and delegates volatile session teardown', async () => {
  let disconnected = 0;
  const session = makeSession();
  session.disconnect = () => { disconnected += 1; };
  const executor = makeExecutor({ session, initialState: { profile: 'full', currentResult: makeEnvelope() } });
  const output = await execute(executor, ['disconnect']);
  assert.equal(output.type, 'text');
  assert.equal(executor.state().currentResult, null);
  assert.equal(disconnected, 1);
});
