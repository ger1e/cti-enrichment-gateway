import test from 'node:test';
import assert from 'node:assert/strict';
import { safeFetch } from '../src/core/egress.js';
import { fetchJson } from '../src/core/fetch-json.js';
import { BoundedCache, TtlCache } from '../src/core/cache.js';
import { runProvider } from '../src/core/provider-runner.js';
import { runScheduledProviders } from '../src/core/scheduler.js';
import { createProviderRegistry } from '../src/core/provider-registry.js';
import { enrich } from '../src/core/orchestrator.js';

const POLICY = { fixedHosts: ['api.example.test'], methods: ['GET'], protocols: ['https:'], maxResponseBytes: 64 };

function adapter(name, run, overrides = {}) {
  return Object.freeze({
    name, types: ['domain'], observationTypes: ['reputation'], costClass: 'free', tier: 1,
    timeoutMs: 20, cacheTtlMs: 60_000, negativeCacheTtlMs: 1_000, maxResponseBytes: 1024,
    fixedHosts: ['api.example.test'], methods: ['GET'], protocols: ['https:'], parserVersion: 'chaos', sourceUrl: 'https://api.example.test/',
    run, ...overrides,
  });
}

test('redirect responses fail closed and never follow attacker-selected locations', async () => {
  let options;
  const fetchImpl = async (_url, init) => {
    options = init;
    return new Response('', { status: 302, headers: { location: 'https://evil.example/' } });
  };
  await assert.rejects(
    safeFetch('https://api.example.test/x', POLICY, { fetchImpl }),
    error => error?.message === 'provider_http_error' && error?.status === 302,
  );
  assert.equal(options.redirect, 'error');
});

test('oversized response without Content-Length fails after bounded read', async () => {
  const fetchImpl = async () => new Response('x'.repeat(65), { status: 200 });
  await assert.rejects(safeFetch('https://api.example.test/x', POLICY, { fetchImpl }), /provider_response_too_large/);
});

test('HTML masquerading as JSON fails as parser error rather than false evidence', async () => {
  const fetchImpl = async () => new Response('<html>upstream error</html>', { status: 200, headers: { 'content-type': 'text/html' } });
  await assert.rejects(fetchJson('https://api.example.test/x', { fetchImpl, maxBytes: 1024 }));
});

test('provider timeout normalizes to timeout without throwing through orchestrator boundary', async () => {
  const p = adapter('slow', async (_input, context) => new Promise((_resolve, reject) => {
    context.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })), { once: true });
  }));
  const out = await runProvider(p, { value: 'evil.example', type: 'domain' }, { timeoutMs: 2 });
  assert.equal(out.ok, false);
  assert.equal(out.failure.reason, 'timeout');
});

test('retryable 5xx receives exactly one retry while 4xx receives none', async () => {
  let calls5 = 0;
  const five = await runScheduledProviders({ providers: [{ name: 'p5', tier: 1, timeoutMs: 50 }], execute: async () => {
    calls5 += 1; return { ok: false, failure: { reason: 'http_error', status: 503 } };
  }});
  assert.equal(calls5, 2);
  assert.equal(five.results[0].attempts, 2);

  let calls4 = 0;
  const four = await runScheduledProviders({ providers: [{ name: 'p4', tier: 1, timeoutMs: 50 }], execute: async () => {
    calls4 += 1; return { ok: false, failure: { reason: 'http_error', status: 404 } };
  }});
  assert.equal(calls4, 1);
  assert.equal(four.results[0].attempts, 1);
});

test('partial provider outage preserves successful evidence and explicit failure', async () => {
  const good = adapter('good', async () => ({ observationType: 'reputation', verdict: 'observed', attributes: { source: 'good' }, relationships: [], references: [] }));
  const bad = adapter('bad', async () => { throw Object.assign(new Error('upstream down'), { status: 503 }); });
  const registry = createProviderRegistry([good, bad]);
  const out = await enrich({ indicator: 'evil.example', type: 'domain', providerNames: ['good','bad'], registry, cache: new TtlCache(), requestId: 'r-chaos' });
  assert.equal(out.status, 'partial');
  assert.deepEqual(out.evidence.map(item => item.provider), ['good']);
  assert.equal(out.failures.some(item => item.provider === 'bad' && item.reason === 'http_error' && item.status === 503), true);
});

test('transient provider failures are never negative-cached and recovery is immediate', async () => {
  let calls = 0;
  const flaky = adapter('flaky', async () => {
    calls += 1;
    if (calls <= 2) throw Object.assign(new Error('temporary'), { status: 503 });
    return { observationType: 'reputation', verdict: 'observed', attributes: { recovered: true }, relationships: [], references: [] };
  });
  const registry = createProviderRegistry([flaky]);
  const cache = new TtlCache();
  const first = await enrich({ indicator: 'evil.example', type: 'domain', providerNames: ['flaky'], registry, cache, requestId: 'r1' });
  assert.equal(first.status, 'error');
  assert.equal(calls, 2);
  assert.equal(cache.stats().entries, 0, 'transport/provider failure must not be cached');
  const second = await enrich({ indicator: 'evil.example', type: 'domain', providerNames: ['flaky'], registry, cache, requestId: 'r2' });
  assert.equal(second.status, 'ok');
  assert.equal(calls, 3);
});

test('successful semantic negative observations use negative TTL while positive observations use normal TTL', async () => {
  let now = 1000;
  let verdict = 'not_listed';
  let calls = 0;
  const p = adapter('semantic', async () => { calls += 1; return { observationType: 'reputation', verdict, attributes: {}, relationships: [], references: [] }; }, { cacheTtlMs: 1000, negativeCacheTtlMs: 10 });
  const registry = createProviderRegistry([p]);
  const cache = new TtlCache({ now: () => now });
  const common = { indicator: 'evil.example', type: 'domain', providerNames: ['semantic'], registry, cache, nowMs: () => now };
  await enrich({ ...common, requestId: 'a' });
  now += 9;
  await enrich({ ...common, requestId: 'b' });
  assert.equal(calls, 1);
  now += 2;
  verdict = 'observed';
  await enrich({ ...common, requestId: 'c' });
  assert.equal(calls, 2);
  now += 999;
  await enrich({ ...common, requestId: 'd' });
  assert.equal(calls, 2);
});

test('rejected in-flight cache load is removed and never poisons subsequent recovery', async () => {
  const cache = new BoundedCache();
  await assert.rejects(cache.getOrLoad('k', async () => { throw new Error('bad'); }, { ttlMs: 1000 }));
  assert.equal(cache.stats().entries, 0);
  assert.equal(cache.stats().inflight, 0);
  assert.equal(await cache.getOrLoad('k', async () => 'recovered', { ttlMs: 1000 }), 'recovered');
  assert.equal(cache.get('k'), 'recovered');
});
