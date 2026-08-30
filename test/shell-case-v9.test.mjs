import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createCaseRuntime } from '../app/case-runtime.js';
import { createBrowserShellExecutor } from '../app/shell-browser-executor.js';
import { COMMAND_REGISTRY } from '../app/shell-core/catalog.js';
import { parseShellLine } from '../app/shell-core/parser.js';
import { executePipeline } from '../app/shell-core/runtime.js';
import { makeAudio, makeClient, makeSession } from './helpers/shell-v9-fixtures.mjs';

async function executeCase(line, calls, { currentResult = null } = {}) {
  const cases = {
    async handle(action, context) {
      calls.push({ action: structuredClone(action), context: { ...context } });
      return { type: 'text', value: 'ok' };
    },
  };
  const executor = createBrowserShellExecutor({
    client: makeClient(), session: makeSession(), cases,
    downloads: { save: () => {} }, clipboard: { writeText: async () => {} }, audio: makeAudio(),
    initialState: { profile: 'standard', currentResult },
  });
  return executePipeline(parseShellLine(line), {
    registry: COMMAND_REGISTRY,
    executor,
    context: { surface: 'web', authenticated: true, capabilities: new Set(['gateway-read', 'provider-read']) },
  });
}

test('browser executor maps registered case grammar into authoritative case-runtime actions', async () => {
  const calls = [];
  await executeCase('case new Operation Fixture', calls);
  await executeCase('case open case-7', calls);
  await executeCase('case refresh --stale', calls);
  await executeCase('case find domain example.test', calls);
  await executeCase('unpin domain example.test', calls);
  await executeCase('note analyst note text', calls);

  assert.deepEqual(calls.map(call => call.action), [
    { action: 'case-new', title: 'Operation Fixture' },
    { action: 'case-open', caseId: 'case-7' },
    { action: 'case-refresh', staleOnly: true },
    { action: 'case-find', observable: { type: 'domain', value: 'example.test' } },
    { action: 'case-unpin', observable: { type: 'domain', value: 'example.test' } },
    { action: 'case-note', text: 'analyst note text' },
  ]);
  assert.equal(calls[0].context.profile, 'standard');
  assert.equal(calls[0].context.currentResult, null);
});

test('case bridge retains storage import download and capture but never owns shell submit parsing', async () => {
  const source = await readFile(new URL('../app/case-shell-bridge.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /interpretCommand/);
  assert.doesNotMatch(source, /addEventListener\(\s*['"]submit['"]/);
  for (const required of ['createIndexedDbCaseStorage', 'createCaseRuntime', 'readImportText', 'safeDownload', 'addGatewayEnrichmentObserver']) {
    assert.match(source, new RegExp(required));
  }
});

test('shell UI is the sole case submit owner and delegates registered case commands to shared runtime', async () => {
  const source = await readFile(new URL('../app/shell-ui.js', import.meta.url), 'utf8');
  for (const required of ['createBrowserShellExecutor', 'COMMAND_REGISTRY', 'parseShellLine', 'executePipeline', 'caseShellAdapter']) {
    assert.match(source, new RegExp(required));
  }
  assert.match(source, /cases:\s*caseShellAdapter/);
});

test('case runtime exposes deterministic pins notes timeline and evidence graph projections', async () => {
  const caseValue = {
    schemaVersion: '1.0', id: 'case-1', title: 'Fixture',
    createdAt: '2026-08-29T08:00:00.000Z', updatedAt: '2026-08-29T12:00:00.000Z',
    pins: [{ type: 'domain', value: 'example.test', addedAt: '2026-08-29T09:00:00.000Z' }],
    notes: [{ id: 'note-1', text: 'checked pivot', addedAt: '2026-08-29T10:00:00.000Z' }],
    snapshots: [], diffs: [],
  };
  const repository = {
    async get(id) { return id === caseValue.id ? structuredClone(caseValue) : null; },
    async list() { return [structuredClone(caseValue)]; },
  };
  const runtime = createCaseRuntime({
    cases: repository,
    client: { async batch() { throw new Error('gateway must not run'); } },
  });
  await runtime.handle({ action: 'case-open', caseId: caseValue.id });

  const pins = await runtime.handle({ action: 'case-pins' });
  const notes = await runtime.handle({ action: 'case-notes' });
  const timeline = await runtime.handle({ action: 'case-timeline' });
  const graph = await runtime.handle({ action: 'case-graph' });

  assert.deepEqual(pins.pins, caseValue.pins);
  assert.deepEqual(notes.notes, caseValue.notes);
  assert.deepEqual(timeline.timeline.map(event => event.kind), ['case-created', 'pin-added', 'note-added']);
  assert.equal(graph.graph.schemaVersion, '1.0');
  assert.equal(graph.graph.nodes.some(node => node.type === 'case'), true);
  assert.equal(graph.graph.nodes.some(node => node.type === 'observable' && node.value === 'example.test'), true);
});