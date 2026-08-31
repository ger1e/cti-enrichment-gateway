import assert from 'node:assert/strict';
import test from 'node:test';

import { COMMAND_REGISTRY } from '../app/shell-core/catalog.js';
import { ShellCommandError, shellError } from '../app/shell-core/errors.js';
import { parseShellLine, parseShellTokens } from '../app/shell-core/parser.js';
import { createCommandRegistry } from '../app/shell-core/registry.js';
import { executePipeline } from '../app/shell-core/runtime.js';
import { PIPELINE_LIMITS, assertBoundedValue } from '../app/shell-core/types.js';
import { createHistory } from '../app/shell.js';

const descriptor = (overrides = {}) => ({
  id: 'test.emit',
  tokens: ['emit'],
  aliases: [],
  namespace: 'terminal',
  surfaces: ['web', 'cli'],
  auth: 'none',
  inputTypes: ['void'],
  outputType: 'text',
  egressClass: 'none',
  sideEffect: 'none',
  capabilities: [],
  handler: 'emit',
  usage: 'emit',
  summary: 'emit test data',
  ...overrides,
});

const webContext = Object.freeze({
  surface: 'web',
  authenticated: true,
  capabilities: new Set(['gateway-read', 'provider-read']),
});

test('host-shell metacharacters reject before any executor dispatch', async () => {
  const lines = [
    'echo `id`',
    'echo $(id)',
    'help && health',
    'help || health',
    'help; health',
    'echo x > /tmp/x',
    'echo x >> /tmp/x',
    'cat < /etc/passwd',
  ];

  for (const line of lines) {
    let calls = 0;
    assert.throws(() => parseShellLine(line), error => error?.code === 'INVALID_SYNTAX', line);
    assert.equal(calls, 0, line);
  }

  for (const argv of [
    ['echo', '`id`'], ['echo', '$(id)'], ['help', '&&', 'health'], ['help', '||', 'health'],
    ['help;', 'health'], ['echo', 'x', '>', '/tmp/x'], ['echo', 'x', '>>', '/tmp/x'], ['cat', '<', '/etc/passwd'],
  ]) {
    assert.throws(() => parseShellTokens(argv), error => error?.code === 'INVALID_SYNTAX', argv.join(' '));
  }
});

test('provider policy override flags reject before executor or provider work', async () => {
  for (const flag of ['--host', '--method', '--credential']) {
    let executorCalls = 0;
    const executor = {
      execute: async () => {
        executorCalls += 1;
        return { type: 'enrichment', value: {} };
      },
    };
    const ast = parseShellLine(`provider run virustotal 8.8.8.8 ${flag} attacker.invalid`);
    await assert.rejects(
      executePipeline(ast, { registry: COMMAND_REGISTRY, executor, context: webContext }),
      error => error?.code === 'POLICY_DENIED',
      flag,
    );
    assert.equal(executorCalls, 0, flag);
  }

  for (const flag of ['--host', '--method', '--credential']) {
    let executorCalls = 0;
    const executor = { execute: async () => { executorCalls += 1; return { type: 'enrichment', value: {} }; } };
    const ast = parseShellLine(`vt 8.8.8.8 ${flag} attacker.invalid`);
    await assert.rejects(
      executePipeline(ast, { registry: COMMAND_REGISTRY, executor, context: webContext }),
      error => error?.code === 'POLICY_DENIED',
      `direct alias ${flag}`,
    );
    assert.equal(executorCalls, 0, `direct alias ${flag}`);
  }
});

test('dangerous generic host command roots are forbidden by registry construction', () => {
  const forbidden = ['sudo', 'ssh', 'curl', 'wget', 'eval', 'exec', 'source'];
  const liveRoots = new Set(COMMAND_REGISTRY.all().map(item => item.tokens[0]));
  for (const root of forbidden) assert.equal(liveRoots.has(root), false, root);

  for (const root of forbidden) {
    assert.throws(
      () => createCommandRegistry([descriptor({ id: `bad.${root}`, tokens: [root], handler: root, usage: root })]),
      /forbidden|unsafe|host command/i,
      root,
    );
  }
});

test('direct provider descriptors pin provider identity and expose no policy override flags', () => {
  const direct = COMMAND_REGISTRY.all().filter(item => item.id.startsWith('provider.alias.'));
  assert.ok(direct.length > 0);
  for (const item of direct) {
    assert.equal(typeof item.provider, 'string', item.id);
    assert.ok(item.provider.length > 0, item.id);
    assert.equal(item.handler, 'provider-run', item.id);
    assert.equal(item.egressClass, 'provider', item.id);
    assert.doesNotMatch(item.usage, /--(?:host|method|credential)\b/i, item.id);
  }
});

test('login-like secrets never enter history or serialized shell error context', () => {
  const secret = 'TOP-SECRET-BEARER-123';
  const history = createHistory(10);
  history.push(`login ${secret}`);
  history.push('help');
  assert.deepEqual(history.entries(), ['help']);
  assert.doesNotMatch(JSON.stringify(history.entries()), new RegExp(secret));

  const error = shellError('INVALID_ARGUMENT', 'inline bearer rejected', {
    bearer: secret,
    authorization: `Bearer ${secret}`,
    nested: { credential: secret, safe: 'ok' },
  });
  assert.ok(error instanceof ShellCommandError);
  const serialized = JSON.stringify(error);
  assert.doesNotMatch(serialized, new RegExp(secret));
  assert.equal(error.context.bearer, '[REDACTED]');
  assert.equal(error.context.authorization, '[REDACTED]');
  assert.equal(error.context.nested.credential, '[REDACTED]');
  assert.equal(error.context.nested.safe, 'ok');
});

test('all stage, record, intermediate, rendered, and text-line ceilings fail with OUTPUT_LIMIT', async () => {
  const tooManyStages = Array.from({ length: PIPELINE_LIMITS.stages + 1 }, () => 'help').join(' | ');
  assert.throws(() => parseShellLine(tooManyStages), error => error?.code === 'OUTPUT_LIMIT');

  assert.throws(
    () => assertBoundedValue({ type: 'records', value: Array.from({ length: PIPELINE_LIMITS.records + 1 }, () => ({})) }),
    error => error?.code === 'OUTPUT_LIMIT',
  );

  const single = createCommandRegistry([descriptor()]);
  await assert.rejects(
    executePipeline(parseShellLine('emit'), {
      registry: single,
      executor: { execute: async () => ({ type: 'text', value: 'x'.repeat(PIPELINE_LIMITS.renderedBytes + 1) }) },
      context: webContext,
    }),
    error => error?.code === 'OUTPUT_LIMIT' && /render/i.test(error.message),
  );

  await assert.rejects(
    executePipeline(parseShellLine('emit'), {
      registry: single,
      executor: { execute: async () => ({ type: 'text', value: 'x'.repeat(PIPELINE_LIMITS.intermediateBytes + 1) }) },
      context: webContext,
    }),
    error => error?.code === 'OUTPUT_LIMIT' && /intermediate/i.test(error.message),
  );

  await assert.rejects(
    executePipeline(parseShellLine('emit'), {
      registry: single,
      executor: { execute: async () => ({ type: 'text', value: Array.from({ length: PIPELINE_LIMITS.textLines + 1 }, () => 'x').join('\n') }) },
      context: webContext,
    }),
    error => error?.code === 'OUTPUT_LIMIT' && /line/i.test(error.message),
  );
});

test('duplicate canonical and alias metadata fails registry construction', () => {
  assert.throws(() => createCommandRegistry([
    descriptor({ id: 'a', tokens: ['a'], aliases: [['dup']], handler: 'a', usage: 'a' }),
    descriptor({ id: 'b', tokens: ['b'], aliases: [['dup']], handler: 'b', usage: 'b' }),
  ]), /duplicate command token sequence/i);

  assert.throws(() => createCommandRegistry([
    descriptor({ id: 'a', tokens: ['dup'], handler: 'a', usage: 'dup' }),
    descriptor({ id: 'b', tokens: ['b'], aliases: [['dup']], handler: 'b', usage: 'b' }),
  ]), /duplicate command token sequence/i);
});
