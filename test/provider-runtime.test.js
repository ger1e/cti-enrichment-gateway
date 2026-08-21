import test from 'node:test';
import assert from 'node:assert/strict';
import { TtlCache } from '../src/core/cache.js';
import { createProviderRegistry } from '../src/core/provider-registry.js';
import { runProvider } from '../src/core/provider-runner.js';

function registeredAdapter(name) {
  return {
    name,
    types: ['ip'],
    observationTypes: ['fixture_context'],
    cacheTtlMs: 1000,
    negativeCacheTtlMs: 100,
    costClass: 'free',
    tier: 1,
    timeoutMs: 100,
    maxResponseBytes: 2048,
    fixedHosts: ['example.test'],
    parserVersion: '1',
    sourceUrl: 'https://example.test/docs',
    run: async () => ({ ok: true }),
  };
}

test('TTL cache expires values and bounds entry count', () => {
  let now = 1000;
  const cache = new TtlCache({ maxEntries: 2, now: () => now });
  cache.set('a', 1, 100);
  cache.set('b', 2, 100);
  assert.equal(cache.get('a'), 1);
  cache.set('c', 3, 100);
  assert.equal(cache.get('b'), undefined);
  assert.equal(cache.get('c'), 3);
  now = 1200;
  assert.equal(cache.get('a'), undefined);
  assert.equal(cache.get('c'), undefined);
});

test('provider registry rejects duplicate names and exposes metadata', () => {
  const a = registeredAdapter('a');
  const registry = createProviderRegistry([a]);
  assert.equal(registry.get('a').costClass, 'free');
  assert.deepEqual(registry.forType('ip').map(p => p.name), ['a']);
  assert.throws(() => createProviderRegistry([a, a]), /duplicate provider/i);
});

test('provider runner hashes successful raw data without credentials', async () => {
  const adapter = { name: 'demo', run: async () => ({ answer: 42, token: undefined }) };
  const result = await runProvider(adapter, { value: '8.8.8.8', type: 'ip' }, { timeoutMs: 100 });
  assert.equal(result.ok, true);
  assert.equal(result.provider, 'demo');
  assert.match(result.rawHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(result.data, { answer: 42, token: undefined });
});

test('provider runner normalizes 429 with retry-after as failure', async () => {
  const adapter = { name: 'limited', run: async () => { const error = new Error('slow down'); error.status = 429; error.retryAfter = '60'; throw error; } };
  const result = await runProvider(adapter, { value: '8.8.8.8', type: 'ip' }, { timeoutMs: 100 });
  assert.equal(result.ok, false);
  assert.deepEqual(result.failure, { reason: 'rate_limited', status: 429, retryAfter: '60' });
});

test('provider runner aborts a provider that exceeds its timeout', async () => {
  const adapter = {
    name: 'slow',
    run: (_input, { signal }) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve({ late: true }), 500);
      signal.addEventListener('abort', () => { clearTimeout(timer); reject(Object.assign(new Error('aborted'), { name: 'AbortError' })); }, { once: true });
    }),
  };
  const result = await runProvider(adapter, { value: '8.8.8.8', type: 'ip' }, { timeoutMs: 10 });
  assert.equal(result.ok, false);
  assert.equal(result.failure.reason, 'timeout');
});

test('provider runner never reflects provider exception text', async () => {
  const adapter = {
    name: 'secret-url',
    run: async () => { throw new Error('request failed https://x.test/?key=TOPSECRET'); },
  };
  const result = await runProvider(adapter, { value: '8.8.8.8', type: 'ip' }, { timeoutMs: 100 });
  assert.equal(result.ok, false);
  assert.equal(JSON.stringify(result).includes('TOPSECRET'), false);
  assert.equal('message' in result.failure, false);
});
