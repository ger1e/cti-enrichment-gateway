import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { PROVIDER_MANIFEST } from '../src/providers/manifest.js';

const run = (args = [], env = {}) => spawnSync(process.execPath, ['bin/cti.mjs', ...args], {
  cwd: new URL('..', import.meta.url),
  encoding: 'utf8',
  env: { ...process.env, ...env },
  timeout: 10_000,
});

const combined = result => `${result.stdout ?? ''}\n${result.stderr ?? ''}`;

test('cti help is deterministic and lists the bounded control-plane commands', () => {
  const first = run(['--help']);
  const second = run(['--help']);
  assert.equal(first.status, 0, combined(first));
  assert.equal(second.status, 0, combined(second));
  assert.equal(first.stdout, second.stdout);
  for (const command of ['doctor','providers list','providers env-template','maltego check','release verify','setup','repair','report compile','report diff']) {
    assert.match(first.stdout, new RegExp(command.replace(' ', '\\s+')));
  }
  assert.doesNotMatch(first.stdout, /token|secret value|password/i);
});

test('cti rejects unknown commands without shell evaluation', () => {
  const result = run(['wat;echo', 'pwned']);
  assert.notEqual(result.status, 0);
  assert.match(combined(result), /unknown command/i);
  assert.doesNotMatch(combined(result), /\bpwned\b.*\bpwned\b/i);
});

test('providers list is manifest-backed, stable, and never prints credential identifiers', () => {
  const result = run(['providers', 'list']);
  assert.equal(result.status, 0, combined(result));
  const lines = result.stdout.trim().split(/\r?\n/).filter(Boolean);
  assert.equal(lines.length, Object.keys(PROVIDER_MANIFEST).length);
  assert.deepEqual(lines, [...lines].sort((a, b) => a.localeCompare(b)));
  for (const name of Object.keys(PROVIDER_MANIFEST)) assert.ok(lines.some(line => line.startsWith(`${name}\t`)), name);
  for (const policy of Object.values(PROVIDER_MANIFEST)) {
    if (policy.credentialEnv) assert.doesNotMatch(result.stdout, new RegExp(policy.credentialEnv));
  }
});

test('providers env-template emits only canonical provider variable names with empty values', () => {
  const result = run(['providers', 'env-template']);
  assert.equal(result.status, 0, combined(result));
  const expected = [...new Set(Object.values(PROVIDER_MANIFEST).map(p => p.credentialEnv).filter(Boolean))]
    .sort()
    .map(name => `${name}=`)
    .join('\n') + '\n';
  assert.equal(result.stdout, expected);
});

test('doctor reports presence booleans and never reflects configured secret values', () => {
  const marker = 'TOP-SECRET-MARKER-DO-NOT-PRINT';
  const credential = Object.values(PROVIDER_MANIFEST).find(p => p.credentialEnv)?.credentialEnv;
  assert.ok(credential);
  const result = run(['doctor'], { [credential]: marker, CTI_GATEWAY_TOKEN: marker, SENTRY_AUTH_TOKEN: marker });
  assert.equal(result.status, 0, combined(result));
  assert.doesNotMatch(combined(result), new RegExp(marker));
  const output = JSON.parse(result.stdout);
  assert.equal(output.node.ok, true);
  assert.equal(output.manifest.ok, true);
  assert.equal(typeof output.configuration.providersConfigured, 'number');
  assert.equal(typeof output.configuration.gatewayTokenConfigured, 'boolean');
});
