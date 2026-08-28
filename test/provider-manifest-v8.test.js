import test from 'node:test';
import assert from 'node:assert/strict';
import { createProviderRegistry } from '../src/core/provider-registry.js';
import { manifestForRegistry } from '../src/core/provider-manifest.js';

function adapter(overrides = {}) {
  return {
    name: 'fixture',
    types: ['ip'],
    observationTypes: ['network_identity'],
    costClass: 'free',
    tier: 1,
    timeoutMs: 1000,
    cacheTtlMs: 60_000,
    negativeCacheTtlMs: 10_000,
    maxResponseBytes: 2048,
    fixedHosts: ['example.test'],
    methods: ['GET'],
    protocols: ['https:'],
    parserVersion: 'fixture-1',
    sourceUrl: 'https://example.test/docs',
    distribution: 'shareable',
    sourceRole: 'first_party',
    freshnessClass: 'near_real_time',
    admissionVersion: 'v8.1',
    executionPolicy: 'v8.1',
    async run() { return { observationType: 'network_identity', verdict: 'observed' }; },
    ...overrides,
  };
}

test('runtime provider manifest projects v8 source and execution semantics additively', () => {
  const registry = createProviderRegistry([adapter()]);
  const [item] = manifestForRegistry(registry);
  assert.equal(item.sourceRole, 'first_party');
  assert.equal(item.freshnessClass, 'near_real_time');
  assert.equal(item.admissionVersion, 'v8.1');
  assert.equal(item.executionPolicy, 'v8.1');
  assert.equal(item.distribution, 'shareable');
});

test('generic fixture adapters remain compatible with null v8 projection fields', () => {
  const fixture = adapter({
    sourceRole: undefined,
    freshnessClass: undefined,
    admissionVersion: undefined,
    executionPolicy: undefined,
    distribution: undefined,
  });
  const registry = createProviderRegistry([fixture]);
  const [item] = manifestForRegistry(registry);
  assert.equal(item.sourceRole, null);
  assert.equal(item.freshnessClass, null);
  assert.equal(item.admissionVersion, null);
  assert.equal(item.executionPolicy, null);
  assert.equal(item.distribution, null);
});
