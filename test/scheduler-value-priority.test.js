import test from 'node:test';
import assert from 'node:assert/strict';
import { runScheduledProviders } from '../src/core/scheduler.js';
import { rankProvidersForExecution } from '../src/core/provider-priority.js';

const BASE = Object.freeze({
  semanticUniqueness: 'unique',
  intelligenceValue: 'direct',
  pivotValue: 'high',
  latencyClass: 'fast',
});

function provider(name, { tier = 3, authorityClass = 'specialist', costClass = 'free' } = {}) {
  return {
    name,
    tier,
    costClass,
    timeoutMs: 5000,
    schedulerByType: { ip: { authorityClass, ...BASE } },
  };
}

test('typed scheduler starts the first four providers in deterministic value order rather than tier order', async () => {
  const providers = [
    provider('community-tier1', { tier: 1, authorityClass: 'community' }),
    provider('specialist-tier5', { tier: 5, authorityClass: 'specialist' }),
    provider('authoritative-tier5', { tier: 5, authorityClass: 'authoritative' }),
    provider('aggregator-tier1', { tier: 1, authorityClass: 'aggregator' }),
    provider('first-party-tier5', { tier: 5, authorityClass: 'first_party' }),
  ];
  const expected = rankProvidersForExecution({ providers, type: 'ip' }).map(item => item.adapter.name);
  const starts = [];
  await runScheduledProviders({
    providers,
    type: 'ip',
    concurrency: 4,
    execute: async adapter => {
      starts.push(adapter.name);
      await new Promise(resolve => setImmediate(resolve));
      return { ok: true, provider: adapter.name };
    },
  });
  assert.deepEqual(starts.slice(0, 4), expected.slice(0, 4));
});

test('typed scheduler releases the next ranked provider as soon as any active slot completes', async () => {
  const providers = [
    provider('a', { authorityClass: 'authoritative' }),
    provider('b', { authorityClass: 'first_party' }),
    provider('c', { authorityClass: 'specialist' }),
    provider('d', { authorityClass: 'aggregator' }),
    provider('e', { authorityClass: 'community' }),
  ];
  const starts = [];
  let releaseA;
  let releaseB;
  const waitA = new Promise(resolve => { releaseA = resolve; });
  const waitB = new Promise(resolve => { releaseB = resolve; });
  let fifthStartedResolve;
  const fifthStarted = new Promise(resolve => { fifthStartedResolve = resolve; });

  const run = runScheduledProviders({
    providers,
    type: 'ip',
    concurrency: 2,
    execute: async adapter => {
      starts.push(adapter.name);
      if (starts.length === 5) fifthStartedResolve();
      if (adapter.name === 'a') await waitA;
      if (adapter.name === 'b') await waitB;
      return { ok: true, provider: adapter.name };
    },
  });

  while (starts.length < 2) await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(starts, ['a', 'b']);
  releaseB();
  while (starts.length < 3) await new Promise(resolve => setImmediate(resolve));
  assert.equal(starts[2], 'c');
  while (starts.length < 5) await new Promise(resolve => setImmediate(resolve));
  await fifthStarted;
  assert.equal(starts[4], 'e');
  releaseA();
  await run;
});

test('typed value queue never exceeds configured concurrency', async () => {
  const providers = Array.from({ length: 9 }, (_, index) => provider(`p${index}`, { authorityClass: index < 2 ? 'authoritative' : 'specialist' }));
  let active = 0;
  let peak = 0;
  await runScheduledProviders({
    providers,
    type: 'ip',
    concurrency: 4,
    execute: async adapter => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise(resolve => setImmediate(resolve));
      active -= 1;
      return { ok: true, provider: adapter.name };
    },
  });
  assert.equal(peak, 4);
});

test('typed scheduler attempts or explicitly skips every admitted provider regardless of earlier positive results', async () => {
  const providers = Array.from({ length: 6 }, (_, index) => provider(`p${index}`));
  const attempted = [];
  const output = await runScheduledProviders({
    providers,
    type: 'ip',
    concurrency: 2,
    callLimit: 4,
    execute: async adapter => {
      attempted.push(adapter.name);
      return { ok: true, provider: adapter.name };
    },
  });
  assert.equal(attempted.length, 4);
  assert.equal(output.results.length, providers.length);
  assert.equal(output.results.filter(item => item.skipped && item.reason === 'provider_call_budget_exhausted').length, 2);
});

test('untyped scheduler retains legacy tier-first compatibility', async () => {
  const providers = [provider('tier3', { tier: 3 }), provider('tier1', { tier: 1 })];
  const starts = [];
  await runScheduledProviders({
    providers,
    concurrency: 1,
    execute: async adapter => { starts.push(adapter.name); return { ok: true }; },
  });
  assert.deepEqual(starts, ['tier1', 'tier3']);
});
