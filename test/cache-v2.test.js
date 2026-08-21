import test from 'node:test';
import assert from 'node:assert/strict';
import { BoundedCache, TtlCache } from '../src/core/cache.js';

test('BoundedCache enforces max entries with deterministic LRU eviction', () => {
  let now = 1000;
  const cache = new BoundedCache({ maxEntries: 2, now: () => now });
  cache.set('a', 1, 1000);
  now += 1;
  cache.set('b', 2, 1000);
  assert.equal(cache.get('a'), 1);
  now += 1;
  cache.set('c', 3, 1000);
  assert.equal(cache.get('b'), undefined);
  assert.equal(cache.get('a'), 1);
  assert.equal(cache.get('c'), 3);
});

test('BoundedCache expires entries and records count-only stats', () => {
  let now = 1000;
  const cache = new BoundedCache({ maxEntries: 2, now: () => now });
  cache.set('a', { secret: 'not exposed' }, 10);
  assert.deepEqual(cache.stats(), { entries: 1, inflight: 0, hits: 0, misses: 0, evictions: 0, expirations: 0 });
  now = 1011;
  assert.equal(cache.get('a'), undefined);
  assert.deepEqual(cache.stats(), { entries: 0, inflight: 0, hits: 0, misses: 1, evictions: 0, expirations: 1 });
});

test('BoundedCache namespaces isolate equal keys', () => {
  const cache = new BoundedCache();
  cache.set('ioc', 'one', 1000, { namespace: 'one' });
  cache.set('ioc', 'two', 1000, { namespace: 'two' });
  assert.equal(cache.get('ioc', { namespace: 'one' }), 'one');
  assert.equal(cache.get('ioc', { namespace: 'two' }), 'two');
});

test('BoundedCache getOrLoad deduplicates in-flight loads', async () => {
  const cache = new BoundedCache();
  let calls = 0;
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  const load = async () => {
    calls += 1;
    await gate;
    return 'value';
  };
  const one = cache.getOrLoad('p:k', load, { ttlMs: 1000 });
  const two = cache.getOrLoad('p:k', load, { ttlMs: 1000 });
  assert.equal(calls, 1);
  release();
  assert.deepEqual(await Promise.all([one, two]), ['value', 'value']);
  assert.equal(calls, 1);
});

test('BoundedCache getOrLoad supports cache opt-out', async () => {
  const cache = new BoundedCache();
  let calls = 0;
  const load = async () => ++calls;
  assert.equal(await cache.getOrLoad('x', load, { ttlMs: 1000, cache: false }), 1);
  assert.equal(await cache.getOrLoad('x', load, { ttlMs: 1000, cache: false }), 2);
  assert.equal(cache.stats().entries, 0);
});

test('TtlCache remains a backward-compatible alias', () => {
  const cache = new TtlCache();
  cache.set('x', 1, 1000);
  assert.equal(cache.get('x'), 1);
});
