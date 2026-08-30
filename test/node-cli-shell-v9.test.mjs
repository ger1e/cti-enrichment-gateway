import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const ROOT = new URL('..', import.meta.url);
const run = args => spawnSync(process.execPath, ['bin/para11ax.mjs', ...args], {
  cwd: ROOT,
  encoding: 'utf8',
  env: { ...process.env },
  timeout: 10_000,
});
const combined = result => `${result.stdout ?? ''}\n${result.stderr ?? ''}`;

test('Node CLI is a thin adapter over the shared registry parser runtime and Node executor', () => {
  const source = readFileSync(new URL('../bin/para11ax.mjs', import.meta.url), 'utf8');
  assert.match(source, /parseShellTokens/);
  assert.match(source, /executePipeline/);
  assert.match(source, /COMMAND_REGISTRY/);
  assert.match(source, /createNodeShellExecutor/);
  assert.doesNotMatch(source, /if\s*\(\s*command\s*===/);
  const executor = readFileSync(new URL('../src/control/shell-node-executor.js', import.meta.url), 'utf8');
  assert.match(executor, /export function createNodeShellExecutor/);
});

test('literal argv pipe executes an internal PARA11AX text pipeline', () => {
  const result = run(['echo', 'alpha', '|', 'grep', 'alp']);
  assert.equal(result.status, 0, combined(result));
  assert.equal(result.stdout, 'alpha\n');
  assert.equal(result.stderr, '');
});

test('typed Node command output composes through structured transforms', () => {
  const result = run(['doctor', '|', 'jsonpath', 'node.ok']);
  assert.equal(result.status, 0, combined(result));
  assert.equal(result.stdout, 'true\n');
  assert.equal(result.stderr, '');
});

test('CLI surface gate rejects Web-only commands before executor effects', () => {
  const result = run(['login']);
  assert.notEqual(result.status, 0);
  assert.match(combined(result), /SURFACE_UNAVAILABLE/);
  assert.doesNotMatch(combined(result), /bearer|token/i);
});

test('typed provider list remains composable while direct legacy output stays compatible', () => {
  const piped = run(['provider', 'list', '|', 'head', '1']);
  assert.equal(piped.status, 0, combined(piped));
  const rows = JSON.parse(piped.stdout);
  assert.equal(Array.isArray(rows), true);
  assert.equal(rows.length, 1);
  assert.equal(typeof rows[0].name, 'string');

  const legacy = run(['providers', 'list']);
  assert.equal(legacy.status, 0, combined(legacy));
  assert.match(legacy.stdout, /^[a-z0-9-]+\t[^\n]+$/m);
}