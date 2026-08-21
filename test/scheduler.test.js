import test from 'node:test';
import assert from 'node:assert/strict';
import { runScheduledProviders } from '../src/core/scheduler.js';
import { CircuitBreaker } from '../src/core/circuit-breaker.js';

function provider(name, tier = 1, timeoutMs = 5000) {
  return { name, tier, timeoutMs };
}

test('scheduler preserves tier order and never exceeds four simultaneous providers', async () => {
  const providers = [
    provider('t2a', 2), provider('t1a', 1), provider('t1b', 1), provider('t1c', 1),
    provider('t1d', 1), provider('t1e', 1), provider('t2b', 2),
  ];
  let active = 0;
  let peak = 0;
  const starts = [];
  const result = await runScheduledProviders({
    providers,
    concurrency: 4,
    execute: async adapter => {
      active += 1;
      peak = Math.max(peak, active);
      starts.push(adapter.name);
      await new Promise(resolve => setImmediate(resolve));
      active -= 1;
      return { ok: true, provider: adapter.name };
    },
  });
  assert.equal(peak <= 4, true);
  assert.equal(starts.slice(0, 5).every(name => name.startsWith('t1')), true);
  assert.equal(result.results.length, providers.length);
});

test('scheduler performs at most one retry for retryable failures', async () => {
  let calls = 0;
  const output = await runScheduledProviders({
    providers: [provider('p')],
    execute: async () => {
      calls += 1;
      return calls === 1
        ? { ok: false, failure: { reason: 'rate_limited', status: 429, retryAfter: '0' } }
        : { ok: true, provider: 'p' };
    },
  });
  assert.equal(calls, 2);
  assert.equal(output.results[0].attempts, 2);
  assert.equal(output.results[0].result.ok, true);
});

test('scheduler honors numeric Retry-After delta-seconds', async () => {
  let now = 0;
  let calls = 0;
  const sleeps = [];
  const output = await runScheduledProviders({
    providers: [provider('p')],
    deadlineMs: 5000,
    nowMs: () => now,
    sleep: async ms => { sleeps.push(ms); now += ms; },
    execute: async () => {
      calls += 1;
      return calls === 1
        ? { ok: false, failure: { reason: 'rate_limited', status: 429, retryAfter: '2' } }
        : { ok: true, provider: 'p' };
    },
  });
  assert.deepEqual(sleeps, [2000]);
  assert.equal(output.results[0].attempts, 2);
});

test('scheduler honors Retry-After HTTP-date relative to the injected clock', async () => {
  const base = Date.parse('2026-08-21T03:00:00Z');
  let now = base;
  const sleeps = [];
  let calls = 0;
  const output = await runScheduledProviders({
    providers: [provider('p')],
    deadlineMs: 10_000,
    nowMs: () => now,
    sleep: async ms => { sleeps.push(ms); now += ms; },
    execute: async () => {
      calls += 1;
      return calls === 1
        ? { ok: false, failure: { reason: 'rate_limited', status: 429, retryAfter: 'Fri, 21 Aug 2026 03:00:05 GMT' } }
        : { ok: true, provider: 'p' };
    },
  });
  assert.deepEqual(sleeps, [5000]);
  assert.equal(output.results[0].attempts, 2);
});

test('scheduler does not retry when HTTP-date Retry-After exhausts the deadline', async () => {
  const base = Date.parse('2026-08-21T03:00:00Z');
  let calls = 0;
  const output = await runScheduledProviders({
    providers: [provider('p')],
    deadlineMs: 4000,
    nowMs: () => base,
    sleep: async () => { throw new Error('sleep must not run'); },
    execute: async () => {
      calls += 1;
      return { ok: false, failure: { reason: 'rate_limited', status: 429, retryAfter: 'Fri, 21 Aug 2026 03:00:05 GMT' } };
    },
  });
  assert.equal(calls, 1);
  assert.equal(output.results[0].attempts, 1);
});

test('scheduler treats expired or malformed Retry-After as zero delay', async () => {
  const base = Date.parse('2026-08-21T03:00:05Z');
  for (const retryAfter of ['Fri, 21 Aug 2026 03:00:00 GMT', 'not-a-date']) {
    const sleeps = [];
    let calls = 0;
    await runScheduledProviders({
      providers: [provider('p')],
      nowMs: () => base,
      sleep: async ms => sleeps.push(ms),
      execute: async () => (++calls === 1
        ? { ok: false, failure: { reason: 'rate_limited', retryAfter } }
        : { ok: true }),
    });
    assert.deepEqual(sleeps, []);
    assert.equal(calls, 2);
  }
});

test('scheduler does not retry semantic client errors', async () => {
  let calls = 0;
  const output = await runScheduledProviders({
    providers: [provider('p')],
    execute: async () => {
      calls += 1;
      return { ok: false, failure: { reason: 'http_error', status: 404 } };
    },
  });
  assert.equal(calls, 1);
  assert.equal(output.results[0].attempts, 1);
});

test('deadline exhaustion yields explicit skips rather than negative evidence', async () => {
  let now = 0;
  const output = await runScheduledProviders({
    providers: [provider('a'), provider('b'), provider('c')],
    concurrency: 1,
    deadlineMs: 15,
    nowMs: () => now,
    execute: async adapter => {
      now += 10;
      return { ok: true, provider: adapter.name };
    },
  });
  assert.equal(output.results.filter(item => item.skipped).length, 1);
  assert.equal(output.results.find(item => item.skipped).reason, 'request_deadline_exhausted');
});

test('open circuit skips provider without calling execute', async () => {
  const circuit = new CircuitBreaker({ failureThreshold: 1, openMs: 60_000, now: () => 1000 });
  circuit.recordFailure('p', { retryable: true });
  let calls = 0;
  const output = await runScheduledProviders({
    providers: [provider('p')],
    circuitBreaker: circuit,
    nowMs: () => 1000,
    execute: async () => { calls += 1; return { ok: true }; },
  });
  assert.equal(calls, 0);
  assert.equal(output.results[0].skipped, true);
  assert.equal(output.results[0].reason, 'circuit_open');
});
