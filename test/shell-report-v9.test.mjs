import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { COMMAND_REGISTRY } from '../app/shell-core/catalog.js';
import { completeShellInput } from '../app/shell-core/completion.js';
import { renderManual } from '../app/shell-core/help.js';
import { parseShellLine } from '../app/shell-core/parser.js';
import { executePipeline } from '../app/shell-core/runtime.js';
import { createBrowserShellExecutor } from '../app/shell-browser-executor.js';
import { createNodeShellExecutor } from '../src/control/shell-node-executor.js';
import { makeAudio, makeClient, makeSession } from './helpers/shell-v9-fixtures.mjs';

const snapshot = JSON.parse(readFileSync(new URL('./fixtures/report/enrichment.json', import.meta.url), 'utf8'));
const FIXED_NOW = new Date('2026-08-30T12:34:56.000Z');

function resolve(tokens, surface) {
  const resolved = COMMAND_REGISTRY.resolve(tokens, surface);
  assert.ok(resolved, `missing command ${tokens.join(' ')}`);
  return resolved;
}

async function executeBrowser(executor, tokens, { args = [], input = { type: 'enrichment', value: snapshot } } = {}) {
  const resolved = resolve(tokens, 'web');
  assert.equal(resolved.surfaceAvailable, true, `expected Web command ${tokens.join(' ')}`);
  return executor.execute({
    descriptor: resolved.descriptor,
    args,
    input,
    context: { surface: 'web', authenticated: true, capabilities: new Set(['gateway-read', 'provider-read']) },
    signal: new AbortController().signal,
  });
}

async function executeNode(executor, tokens, { args = [], input = { type: 'enrichment', value: snapshot } } = {}) {
  const resolved = resolve(tokens, 'cli');
  assert.equal(resolved.surfaceAvailable, true, `expected CLI command ${tokens.join(' ')}`);
  return executor.execute({
    descriptor: resolved.descriptor,
    args,
    input,
    context: { surface: 'cli', authenticated: true, capabilities: new Set(['gateway-read', 'provider-read']) },
    signal: new AbortController().signal,
  });
}

test('report discovery is surface-aware while manuals retain CLI-only visibility', () => {
  const web = completeShellInput('report ', { surface: 'web' });
  const cli = completeShellInput('report ', { surface: 'cli' });
  assert.ok(web.includes('text'));
  assert.ok(web.includes('html'));
  assert.ok(web.includes('quality'));
  assert.equal(web.includes('compile'), false);
  assert.equal(web.includes('diff'), false);
  assert.equal(web.includes('manifest'), false);
  assert.ok(cli.includes('compile'));
  assert.ok(cli.includes('diff'));
  assert.ok(cli.includes('manifest'));
  assert.match(renderManual(['report', 'compile']), /\[CLI ONLY\]/);
});

test('Web report compile rejects at the runtime surface gate before executor or filesystem work', async () => {
  let calls = 0;
  const executor = { execute: async () => { calls += 1; return { type: 'void', value: null }; } };
  const ast = parseShellLine('report compile snapshot.json /tmp/out');
  await assert.rejects(
    executePipeline(ast, {
      registry: COMMAND_REGISTRY,
      executor,
      context: { surface: 'web', authenticated: true, capabilities: new Set(['gateway-read', 'provider-read']) },
    }),
    error => error?.code === 'SURFACE_UNAVAILABLE',
  );
  assert.equal(calls, 0);
});

test('Web report projections stay in memory and explicit download consumes only registered artifacts', async () => {
  const events = [];
  const executor = createBrowserShellExecutor({
    client: makeClient(),
    session: makeSession(),
    cases: null,
    downloads: { save: (...args) => events.push(args) },
    clipboard: { writeText: async () => {} },
    audio: makeAudio(),
    now: () => FIXED_NOW,
    monotonicNow: () => 0,
    version: '2.0.0',
    initialState: { currentResult: snapshot },
  });

  const text = await executeBrowser(executor, ['report', 'text']);
  assert.equal(text.type, 'artifact');
  assert.equal(text.value.filename, 'report.txt');
  assert.equal(text.value.mimeType, 'text/plain;charset=utf-8');
  assert.equal(text.value.encoding, 'utf8');
  assert.match(text.value.content, /PARA11AX/);
  assert.equal(events.length, 0);

  const html = await executeBrowser(executor, ['report', 'html']);
  assert.equal(html.type, 'artifact');
  assert.equal(html.value.filename, 'report.html');
  assert.match(html.value.content, /<!doctype html>/i);
  assert.equal(events.length, 0);

  const quality = await executeBrowser(executor, ['report', 'quality']);
  assert.deepEqual(quality.value.ok, true);
  assert.match(quality.value.reportId, /^rpt-/);

  const download = resolve(['download'], 'web');
  const downloaded = await executor.execute({
    descriptor: download.descriptor,
    args: [],
    input: html,
    context: { surface: 'web', authenticated: true, capabilities: new Set(['gateway-read', 'provider-read']) },
    signal: new AbortController().signal,
  });
  assert.equal(downloaded.type, 'artifact');
  assert.equal(events.length, 1);
  assert.equal(events[0][1], 'text/html;charset=utf-8');
  assert.equal(events[0][2], 'report.html');
});

test('Node report projections expose every approved format without filesystem writes', async () => {
  const executor = createNodeShellExecutor({
    registry: COMMAND_REGISTRY,
    env: {},
    now: () => FIXED_NOW,
    nowMs: () => FIXED_NOW.getTime(),
    monotonicNow: () => 0,
  });

  const expected = new Map([
    ['text', ['report.txt', 'utf8']],
    ['html', ['report.html', 'utf8']],
    ['pdf', ['report.pdf', 'base64']],
    ['csv', ['observables.csv', 'utf8']],
    ['kql', ['hunts.kql', 'utf8']],
    ['navigator', ['attack-navigator.json', 'utf8']],
    ['stix', ['intelligence.stix.json', 'utf8']],
    ['evidence', ['evidence.json', 'utf8']],
  ]);

  for (const [format, [filename, encoding]] of expected) {
    const output = await executeNode(executor, ['report', format]);
    assert.equal(output.type, 'artifact', format);
    assert.equal(output.value.filename, filename, format);
    assert.equal(output.value.encoding, encoding, format);
    assert.ok(output.value.content.length > 0, format);
  }

  const pdf = await executeNode(executor, ['report', 'pdf']);
  assert.match(pdf.value.content, /^JVBERi0xLjQ/);
  const evidence = JSON.parse((await executeNode(executor, ['report', 'evidence'])).value.content);
  assert.equal(evidence.requestId, snapshot.requestId);
  const stix = JSON.parse((await executeNode(executor, ['report', 'stix'])).value.content);
  assert.equal(stix.type, 'bundle');

  const manifest = await executeNode(executor, ['report', 'manifest']);
  assert.equal(manifest.type, 'record');
  assert.match(manifest.value.reportId, /^rpt-/);
  assert.equal(manifest.value.preset, 'all');
  assert.ok(manifest.value.files.some(file => file.name === 'report.pdf'));
});
