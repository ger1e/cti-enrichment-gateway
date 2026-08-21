import test from 'node:test';
import assert from 'node:assert/strict';
import { createProviderRegistry } from '../src/core/provider-registry.js';
import { manifestForRegistry } from '../src/core/provider-manifest.js';

function adapter(overrides = {}) {
  return {
    name: 'fixture',
    types: ['ip'],
    observationTypes: ['fixture_context'],
    costClass: 'free',
    tier: 2,
    timeoutMs: 1000,
    cacheTtlMs: 60_000,
    negativeCacheTtlMs: 10_000,
    maxResponseBytes: 2048,
    fixedHosts: ['example.test'],
    parserVersion: '1',
    sourceUrl: 'https://example.test/docs',
    async run() { return { observationType: 'fixture_context', verdict: 'context' }; },
    ...overrides,
  };
}

test('provider registry requires complete bounded static metadata', () => {
  const required = ['observationTypes','costClass','tier','timeoutMs','cacheTtlMs','negativeCacheTtlMs','maxResponseBytes','fixedHosts','parserVersion','sourceUrl'];
  for (const field of required) {
    const candidate = adapter();
    delete candidate[field];
    assert.throws(() => createProviderRegistry([candidate]), /provider/i, field);
  }
});

test('provider manifest is complete, stable and secret-free', () => {
  const registry = createProviderRegistry([
    adapter({ requiredEnv: 'SECRET_KEY' }),
    adapter({ name: 'public', requiredEnv: undefined, sourceUrl: 'https://public.example/docs', fixedHosts: ['public.example'] }),
  ]);
  const manifest = manifestForRegistry(registry);
  assert.deepEqual(manifest.map(x => x.name), ['fixture', 'public']);
  assert.equal(manifest[0].credentialEnv, 'SECRET_KEY');
  assert.equal(manifest[0].requiresCredential, true);
  assert.equal(manifest[1].requiresCredential, false);
  assert.equal(JSON.stringify(manifest).includes(process.env.SECRET_KEY ?? '__never__'), false);
  assert.deepEqual(manifest[0].fixedHosts, ['example.test']);
  assert.equal(manifest[0].maxResponseBytes, 2048);
  assert.ok(Object.isFrozen(manifest));
});
