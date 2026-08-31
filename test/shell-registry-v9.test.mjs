import assert from 'node:assert/strict';
import test from 'node:test';

import { ShellCommandError, shellError } from '../app/shell-core/errors.js';
import { PIPELINE_LIMITS, assertBoundedValue, estimateValueBytes } from '../app/shell-core/types.js';
import { createCommandRegistry } from '../app/shell-core/registry.js';

const descriptor = (overrides = {}) => ({
  id: 'provider.list',
  tokens: ['provider', 'list'],
  aliases: [['providers']],
  namespace: 'provider',
  surfaces: ['web', 'cli'],
  auth: 'none',
  inputTypes: ['void'],
  outputType: 'records',
  egressClass: 'none',
  sideEffect: 'none',
  capabilities: [],
  handler: 'provider-list',
  usage: 'provider list',
  summary: 'list providers',
  ...overrides,
});

test('shell errors are typed and stable', () => {
  const error = shellError('INVALID_ARGUMENT', 'bad input', { field: 'x' });
  assert.ok(error instanceof ShellCommandError);
  assert.equal(error.code, 'INVALID_ARGUMENT');
  assert.deepEqual(error.context, { field: 'x' });
  assert.throws(() => shellError('NOT_A_REAL_CODE', 'nope'), /unknown shell error code/i);
});

test('value bounds enforce record and byte ceilings', () => {
  assert.equal(estimateValueBytes('abc'), 3);
  assert.equal(assertBoundedValue({ type: 'records', value: [{ a: 1 }] }, PIPELINE_LIMITS), true);
  assert.throws(
    () => assertBoundedValue({ type: 'records', value: Array.from({ length: PIPELINE_LIMITS.records + 1 }, () => ({})) }, PIPELINE_LIMITS),
    error => error.code === 'OUTPUT_LIMIT',
  );
});

test('registry resolves longest command token prefix and aliases', () => {
  const registry = createCommandRegistry([
    descriptor(),
    descriptor({
      id: 'provider.run',
      tokens: ['provider', 'run'],
      aliases: [],
      auth: 'required',
      outputType: 'enrichment',
      egressClass: 'provider',
      capabilities: ['provider-read'],
      handler: 'provider-run',
      usage: 'provider run <provider> <observable>',
      summary: 'run one provider',
    }),
  ]);
  const resolved = registry.resolve(['provider', 'run', 'virustotal'], 'web');
  assert.equal(resolved.descriptor.id, 'provider.run');
  assert.deepEqual(resolved.args, ['virustotal']);
  assert.equal(registry.resolve(['providers'], 'web').descriptor.id, 'provider.list');
  assert.equal(registry.get('provider.list').id, 'provider.list');
  assert.equal(registry.byNamespace('provider').length, 2);
  assert.equal(registry.forSurface('cli').length, 2);
});

test('registry rejects duplicate aliases and malformed metadata', () => {
  assert.throws(() => createCommandRegistry([
    descriptor({ id: 'a', tokens: ['a'], aliases: [['x']], handler: 'a' }),
    descriptor({ id: 'b', tokens: ['b'], aliases: [['x']], handler: 'b' }),
  ]), /duplicate command token sequence/i);

  assert.throws(() => createCommandRegistry([descriptor({ surfaces: ['browser'] })]), /surface/i);
  assert.throws(() => createCommandRegistry([descriptor({ inputTypes: ['mystery'] })]), /input type/i);
  assert.throws(() => createCommandRegistry([descriptor({ handler: '' })]), /handler/i);
});

test('registry exposes frozen descriptor copies', () => {
  const input = descriptor();
  const registry = createCommandRegistry([input]);
  const stored = registry.get('provider.list');
  assert.ok(Object.isFrozen(stored));
  assert.ok(Object.isFrozen(stored.tokens));
  assert.ok(Object.isFrozen(stored.aliases));
  assert.ok(Object.isFrozen(stored.aliases[0]));
  input.tokens[0] = 'mutated';
  assert.deepEqual(stored.tokens, ['provider', 'list']);
});
