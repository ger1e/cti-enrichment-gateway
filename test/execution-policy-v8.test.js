import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  EXECUTION_POLICY,
  EXECUTION_POLICY_VERSION,
  PROVIDER_CONCURRENCY_MAX,
  PROVIDER_MAX_ATTEMPTS,
  REQUEST_DEADLINE_MS,
} from '../src/core/execution-policy.js';
import { runScheduledProviders } from '../src/core/scheduler.js';
import { createApp } from '../src/app.js';

function provider(name) {
  return { name, tier: 1, timeoutMs: 5000 };
}

test('v8 execution policy preserves the existing bounded scheduler contract', () => {
  assert.equal(EXECUTION_POLICY_VERSION, 'v8.1');
  assert.equal(PROVIDER_CONCURRENCY_MAX, 4);
  assert.equal(PROVIDER_MAX_ATTEMPTS, 2);
  assert.equal(REQUEST_DEADLINE_MS, 20_000);
  assert.deepEqual(EXECUTION_POLICY, {
    version: 'v8.1',
    providerConcurrencyMax: 4,
    providerMaxAttempts: 2,
    requestDeadlineMs: 20_000,
  });
  assert.equal(Object.isFrozen(EXECUTION_POLICY), true);
});

test('scheduler and app consume the canonical execution-policy constants', () => {
  const scheduler = readFileSync(new URL('../src/core/scheduler.js', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../src/app.js', import.meta.url), 'utf8');
  assert.match(scheduler, /from ['"]\.\/execution-policy\.js['"]/);
  assert.match(scheduler, /concurrency\s*=\s*PROVIDER_CONCURRENCY_MAX/);
  assert.match(scheduler, /deadlineMs\s*=\s*REQUEST_DEADLINE_MS/);
  assert.match(scheduler, /attempts\s*<\s*PROVIDER_MAX_ATTEMPTS/);
  assert.match(app, /from ['"]\.\/core\/execution-policy\.js['"]/);
  assert.match(app, /providerConcurrency:\s*PROVIDER_CONCURRENCY_MAX/);
  assert.match(app, /requestDeadlineMs:\s*REQUEST_DEADLINE_MS/);
});

test('scheduler defaults remain four concurrent providers, two attempts and a 20 second deadline', async () => {
  let active = 0;
  let peak = 0;
  const attempts = new Map();
  const providers = Array.from({ length: 6 }, (_, index) => provider(`p${index}`));
  const result = await runScheduledProviders({
    providers,
    execute: async adapter => {
      active += 1;
      peak = Math.max(peak, active);
      attempts.set(adapter.name, (attempts.get(adapter.name) ?? 0) + 1);
      await new Promise(resolve => setImmediate(resolve));
      active -= 1;
      return attempts.get(adapter.name) === 1
        ? { ok: false, failure: { reason: 'provider_error' } }
        : { ok: true, provider: adapter.name };
    },
  });
  assert.equal(peak <= PROVIDER_CONCURRENCY_MAX, true);
  assert.equal(result.deadlineMs, REQUEST_DEADLINE_MS);
  assert.equal(Math.max(...attempts.values()), PROVIDER_MAX_ATTEMPTS);
});

test('public meta publishes the same execution bounds without changing its contract', async () => {
  const fixture = Object.freeze({
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
    parserVersion: 'fixture-1',
    sourceUrl: 'https://example.test/docs',
    async run() { return { observationType: 'network_identity', verdict: 'observed' }; },
  });
  const app = createApp({ env: { PARA11AX_TOKEN: 'test-token' }, adapters: [fixture] });
  const out = await app.handleMeta({ method: 'GET', headers: {} });
  assert.equal(out.status, 200);
  assert.equal(out.body.limits.providerConcurrency, PROVIDER_CONCURRENCY_MAX);
  assert.equal(out.body.limits.requestDeadlineMs, REQUEST_DEADLINE_MS);
});
