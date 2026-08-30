import assert from 'node:assert/strict';
import test from 'node:test';

import { createBrowserShellExecutor } from '../app/shell-browser-executor.js';
import { COMMAND_REGISTRY } from '../app/shell-core/catalog.js';
import { parseShellLine } from '../app/shell-core/parser.js';
import { executePipeline } from '../app/shell-core/runtime.js';
import { makeAudio, makeClient, makeRichEnvelope, makeSession } from './helpers/shell-v9-fixtures.mjs';

async function runLine(line, { currentResult = makeRichEnvelope() } = {}) {
  const executor = createBrowserShellExecutor({
    client: makeClient(),
    session: makeSession(),
    cases: null,
    downloads: { save: () => {} },
    clipboard: { writeText: async () => {} },
    audio: makeAudio(),
    monotonicNow: () => 0,
    version: '2.0.0',
    initialState: { profile: 'standard', currentResult },
  });
  return executePipeline(parseShellLine(line), {
    registry: COMMAND_REGISTRY,
    executor,
    context: {
      surface: 'web',
      authenticated: true,
      capabilities: new Set(['gateway-read', 'provider-read']),
      profile: 'standard',
    },
  });
}

test('result evidence composes with record transforms without losing evidence typing', async () => {
  const output = await runLine('result evidence | fields provider | unique');
  assert.equal(output.type, 'records');
  assert.deepEqual(output.value, [
    { provider: 'virustotal' },
    { provider: 'greynoise' },
  ]);
});

test('result graph and guidance return authoritative enrichment projections', async () => {
  const currentResult = makeRichEnvelope();
  const graph = await runLine('result graph', { currentResult });
  const guidance = await runLine('result guidance', { currentResult });

  assert.equal(graph.type, 'graph');
  assert.strictEqual(graph.value, currentResult.evidenceGraph);
  assert.equal(guidance.type, 'guidance');
  assert.strictEqual(guidance.value, currentResult.guidance);
});

test('result raw remains a typed enrichment value for downstream structured stages', async () => {
  const currentResult = makeRichEnvelope();
  const output = await runLine('raw', { currentResult });
  assert.equal(output.type, 'enrichment');
  assert.strictEqual(output.value, currentResult);
});

test('legacy direct result aliases resolve through the shared registry', () => {
  for (const alias of ['overview', 'evidence', 'cor', 'rel', 'coverage', 'raw', 'last', 'request', 'failures', 'contradictions', 'corroboration', 'references', 'providers']) {
    const resolved = COMMAND_REGISTRY.resolve([alias], 'web');
    assert.ok(resolved?.surfaceAvailable, `${alias} should resolve on web`);
    assert.equal(resolved.args.length, 0);
  }
});
