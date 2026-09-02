import assert from 'node:assert/strict';
import test from 'node:test';
import { createBrowserShellExecutor } from '../app/shell-browser-executor.js';
import { COMMAND_REGISTRY } from '../app/shell-core/catalog.js';
import { parseShellTokens } from '../app/shell-core/parser.js';
import { executePipeline } from '../app/shell-core/runtime.js';
import { createNodeShellExecutor } from '../src/control/shell-node-executor.js';

test('browser-only investigation persistence fails before CLI executor dispatch', async () => {
  let calls = 0;
  const ast = parseShellTokens(['investigation', 'open', 'inv-001']);
  await assert.rejects(executePipeline(ast, {
    registry: COMMAND_REGISTRY,
    executor: { async execute() { calls += 1; } },
    context: { surface: 'cli', authenticated: true, capabilities: new Set() },
  }), error => error.code === 'SURFACE_UNAVAILABLE');
  assert.equal(calls, 0);
});

test('inline import payloads are rejected without reflecting secret content', async () => {
  const secret = 'unique-secret-value';
  const descriptor = COMMAND_REGISTRY.resolve(['investigation', 'import'], 'web').descriptor;
  const executor = createBrowserShellExecutor({ client: {}, session: {}, investigations: { handle: async () => ({}), reset() {}, state: () => ({}) } });
  await assert.rejects(
    executor.execute({ descriptor, args: [`{"token":"${secret}"}`], context: { surface: 'web' } }),
    error => error.code === 'INVALID_ARGUMENT' && !JSON.stringify(error).includes(secret) && !error.message.includes(secret),
  );
});

test('CLI status reads only an explicit bounded file transport and performs no persistence', async () => {
  const bundle = JSON.stringify({ marker: 'fixture' });
  const reads = [];
  const executor = createNodeShellExecutor({
    registry: COMMAND_REGISTRY,
    investigationReadFile: async path => { reads.push(path); return bundle; },
  });
  await assert.rejects(executePipeline(parseShellTokens(['investigation', 'status']), {
    registry: COMMAND_REGISTRY,
    executor,
    context: { surface: 'cli', authenticated: true, capabilities: new Set() },
  }), /--file|--stdin/);

  await assert.rejects(executePipeline(parseShellTokens(['investigation', 'status', '--file', '/tmp/inv.json']), {
    registry: COMMAND_REGISTRY,
    executor,
    context: { surface: 'cli', authenticated: true, capabilities: new Set() },
  }), /invalid investigation/i);
  assert.deepEqual(reads, ['/tmp/inv.json']);
});
