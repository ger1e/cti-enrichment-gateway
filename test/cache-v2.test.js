import test from 'node:test';
import assert from 'node:assert/strict';
import { BoundedCache, TtlCache } from '../src/core/cache.js';

const DEFAULT_MAX_BYTES = 32_000_000;
const bytesOf = value => Buffer.byteLength(JSON.stringify(value), 'utf8');

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

test('BoundedCache expires entries and records bounded count and byte stats', () => {
  let now = 1000;
  const value = { secret: 'not exposed' };
  const cache = new BoundedCache({ maxEntries: 2, now: () => now });
  cache.set('a', value, 10);
  assert.deepEqual(cache.stats(), {
    entries: 1, inflight: 0, hits: 0, misses: 0, evictions: 0, expirations: 0,
    bytes: bytesOf(value), maxBytes: DEFAULT_MAX_BYTES,
  });
  now = 1011;
  assert.equal(cache.get('a'), undefined);
  assert.deepEqual(cache.stats(), {
    entries: 0, inflight: 0, hits: 0, misses: 1, evictions: 0, expirations: 1,
    bytes: 0, maxBytes: DEFAULT_MAX_BYTES,
  });
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
  assert.equal(cache.stats().bytes, 0);
});

test('BoundedCache evicts LRU entries until the aggregate byte ceiling is satisfied', () => {
  const cache = new BoundedCache({ maxEntries: 10, maxBytes: 16 });
  assert.equal(cache.set('a', '12345678', 1000), true); // JSON string: 10 bytes
  assert.equal(cache.set('b', 'abcdefgh', 1000), true);
  assert.equal(cache.get('a'), undefined);
  assert.equal(cache.get('b'), 'abcdefgh');
  assert.equal(cache.stats().entries, 1);
  assert.equal(cache.stats().bytes, 10);
  assert.equal(cache.stats().bytes <= cache.stats().maxBytes, true);
});

test('BoundedCache never retains a single value larger than maxBytes', () => {
  const cache = new BoundedCache({ maxBytes: 8 });
  assert.equal(cache.set('x', '12345678', 1000), false);
  assert.equal(cache.stats().entries, 0);
  assert.equal(cache.stats().bytes, 0);
  assert.equal(cache.stats().maxBytes, 8);
});

test('BoundedCache byte accounting handles replacement delete expiry and clear', () => {
  let now = 0;
  const cache = new BoundedCache({ maxBytes: 100, now: () => now });
  assert.equal(cache.set('a', '12345678', 5), true);
  assert.equal(cache.stats().bytes, 10);
  assert.equal(cache.set('a', 'x', 5), true);
  assert.equal(cache.stats().bytes, 3);
  assert.equal(cache.delete('a'), true);
  assert.equal(cache.stats().bytes, 0);

  assert.equal(cache.set('b', { x: '1234' }, 5), true);
  assert.equal(cache.stats().bytes, bytesOf({ x: '1234' }));
  now = 6;
  assert.equal(cache.get('b'), undefined);
  assert.equal(cache.stats().bytes, 0);

  assert.equal(cache.set('c', 'ok', 100), true);
  assert.equal(cache.stats().bytes, 4);
  cache.clear();
  assert.equal(cache.stats().entries, 0);
  assert.equal(cache.stats().bytes, 0);
});

test('BoundedCache skips values that cannot be deterministically serialized', () => {
  const cache = new BoundedCache({ maxBytes: 100 });
  assert.equal(cache.set('bigint', 1n, 1000), false);
  assert.equal(cache.set('undefined', undefined, 1000), false);
  assert.equal(cache.stats().entries, 0);
  assert.equal(cache.stats().bytes, 0);
});

test('TtlCache remains a backward-compatible alias', () => {
  const cache = new TtlCache({ maxBytes: 100 });
  cache.set('x', 1, 1000);
  assert.equal(cache.get('x'), 1);
  assert.equal(cache.stats().maxBytes, 100);
});
