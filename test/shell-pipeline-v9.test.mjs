import assert from 'node:assert/strict';
import test from 'node:test';

import { createCommandRegistry } from '../app/shell-core/registry.js';
import { executePipeline } from '../app/shell-core/runtime.js';

const base = {
  namespace: 'intel', surfaces: ['web', 'cli'], auth: 'none', inputTypes: ['void'], outputType: 'records',
  egressClass: 'none', sideEffect: 'none', capabilities: [], usage: 'emit', summary: 'fixture emitter',
};

const registry = createCommandRegistry([
  { ...base, id: 'fixture.emit', tokens: ['emit'], aliases: [], handler: 'emit' },
  { ...base, id: 'fixture.secure', tokens: ['secure'], aliases: [], auth: 'required', handler: 'secure' },
  { ...base, id: 'fixture.capability', tokens: ['cap'], aliases: [], capabilities: ['provider-read'], handler: 'cap' },
  { ...base, id: 'fixture.cli', tokens: ['cli-only'], aliases: [], surfaces: ['cli'], handler: 'cli-only' },
  { ...base, id: 'fixture.text', tokens: ['text-only'], aliases: [], inputTypes: ['text'], outputType: 'text', handler: 'text-only' },
  { ...base, id: 'transform.head', tokens: ['head'], aliases: [], inputTypes: ['records', 'text'], outputType: 'records', handler: 'head', namespace: 'transform', usage: 'head <n>', summary: 'head transform' },
]);

function executor(calls, overrides = {}) {
  return {
    async execute({ descriptor, args, input, signal }) {
      calls.push({ handler: descriptor.handler, args: [...args], input });
      if (overrides[descriptor.handler]) return overrides[descriptor.handler]({ descriptor, args, input, signal });
      if (descriptor.handler === 'emit') return { type: 'records', value: [{ id: 1 }, { id: 2 }, { id: 3 }] };
      if (descriptor.handler === 'secure') return { type: 'records', value: [] };
      if (descriptor.handler === 'cap') return { type: 'records', value: [] };
      if (descriptor.handler === 'cli-only') return { type: 'records', value: [] };
      if (descriptor.handler === 'text-only') return { type: 'text', value: input.value };
      throw new Error('unexpected executor handler');
    },
  };
}

test('typed output from one stage becomes input to the next transform', async () => {
  const calls = [];
  const ast = { type: 'pipeline', stages: [
    { type: 'invocation', tokens: ['emit'] },
    { type: 'invocation', tokens: ['head', '2'] },
  ] };
  const output = await executePipeline(ast, {
    registry,
    executor: executor(calls),
    context: { surface: 'web', authenticated: false, capabilities: [] },
    signal: new AbortController().signal,
  });
  assert.deepEqual(output, { type: 'records', value: [{ id: 1 }, { id: 2 }] });
  assert.equal(calls.length, 1, 'shared transform must not route through surface executor');
});

test('runtime stops after the first failing stage', async () => {
  const calls = [];
  const ast = { type: 'pipeline', stages: [
    { type: 'invocation', tokens: ['emit'] },
    { type: 'invocation', tokens: ['text-only'] },
    { type: 'invocation', tokens: ['emit'] },
  ] };
  await assert.rejects(
    () => executePipeline(ast, { registry, executor: executor(calls), context: { surface: 'web', authenticated: false, capabilities: [] }, signal: new AbortController().signal }),
    error => error.code === 'PIPELINE_TYPE_MISMATCH',
  );
  assert.deepEqual(calls.map(call => call.handler), ['emit']);
});

test('surface auth and capability gates happen before executor calls', async () => {
  for (const [tokens, context, code] of [
    [['secure'], { surface: 'web', authenticated: false, capabilities: [] }, 'AUTH_REQUIRED'],
    [['cap'], { surface: 'web', authenticated: true, capabilities: [] }, 'CAPABILITY_UNAVAILABLE'],
    [['cli-only'], { surface: 'web', authenticated: true, capabilities: ['provider-read'] }, 'SURFACE_UNAVAILABLE'],
  ]) {
    const calls = [];
    await assert.rejects(
      () => executePipeline({ type: 'pipeline', stages: [{ type: 'invocation', tokens }] }, { registry, executor: executor(calls), context, signal: new AbortController().signal }),
      error => error.code === code,
    );
    assert.equal(calls.length, 0, `${code} must fail before executor`);
  }
});

test('unknown commands fail with a stable code before execution', async () => {
  const calls = [];
  await assert.rejects(
    () => executePipeline({ type: 'pipeline', stages: [{ type: 'invocation', tokens: ['does-not-exist'] }] }, { registry, executor: executor(calls), context: { surface: 'web', authenticated: true, capabilities: [] }, signal: new AbortController().signal }),
    error => error.code === 'COMMAND_NOT_FOUND',
  );
  assert.equal(calls.length, 0);
});

test('abort and unexpected upstream failures are normalized without leaking executor text', async () => {
  const aborted = new AbortController();
  aborted.abort();
  await assert.rejects(
    () => executePipeline({ type: 'pipeline', stages: [{ type: 'invocation', tokens: ['emit'] }] }, { registry, executor: executor([]), context: { surface: 'web', authenticated: true, capabilities: [] }, signal: aborted.signal }),
    error => error.code === 'OPERATION_ABORTED',
  );

  const secret = 'TOPSECRET-UPSTREAM';
  await assert.rejects(
    () => executePipeline({ type: 'pipeline', stages: [{ type: 'invocation', tokens: ['emit'] }] }, {
      registry,
      executor: executor([], { emit: async () => { throw new Error(secret); } }),
      context: { surface: 'web', authenticated: true, capabilities: [] },
      signal: new AbortController().signal,
    }),
    error => error.code === 'UPSTREAM_FAILED' && !JSON.stringify(error).includes(secret) && !String(error.message).includes(secret),
  );
});

test('runtime enforces output bounds after executor execution', async () => {
  const calls = [];
  await assert.rejects(
    () => executePipeline({ type: 'pipeline', stages: [{ type: 'invocation', tokens: ['emit'] }] }, {
      registry,
      executor: executor(calls, { emit: async () => ({ type: 'records', value: [{}, {}] }) }),
      context: { surface: 'web', authenticated: true, capabilities: [] },
      signal: new AbortController().signal,
      limits: { stages: 12, records: 1, intermediateBytes: 1000, renderedBytes: 1000, textLines: 100 },
    }),
    error => error.code === 'OUTPUT_LIMIT',
  );
  assert.equal(calls.length, 1);
});