import {
  PROVIDER_CONCURRENCY_MAX,
  PROVIDER_MAX_ATTEMPTS,
  REQUEST_DEADLINE_MS,
} from './execution-policy.js';

function retryableFailure(result) {
  if (!result || result.ok || !result.failure) return false;
  const reason = result.failure.reason;
  if (reason === 'timeout' || reason === 'provider_error' || reason === 'provider_transport_error' || reason === 'rate_limited') return true;
  return reason === 'http_error' && Number(result.failure.status) >= 500;
}

function retryDelayMs(result, nowMs) {
  const raw = result?.failure?.retryAfter;
  if (raw == null) return 0;
  const text = String(raw).trim();
  if (/^\d+(?:\.\d+)?$/.test(text)) {
    const seconds = Number(text);
    return Number.isFinite(seconds) && seconds >= 0 ? Math.floor(seconds * 1000) : 0;
  }
  const at = Date.parse(text);
  if (!Number.isFinite(at)) return 0;
  return Math.max(0, Math.floor(at - nowMs()));
}

function groupByTier(providers) {
  const ranked = providers.map((provider, index) => ({ provider, index, tier: Number.isInteger(provider.tier) ? provider.tier : 5 }));
  ranked.sort((a, b) => a.tier - b.tier || a.index - b.index);
  const groups = [];
  for (const item of ranked) {
    let group = groups.at(-1);
    if (!group || group.tier !== item.tier) {
      group = { tier: item.tier, providers: [] };
      groups.push(group);
    }
    group.providers.push(item.provider);
  }
  return groups;
}

async function runPool(items, concurrency, worker) {
  const results = new Array(items.length);
  let next = 0;
  const count = Math.min(concurrency, items.length);
  await Promise.all(Array.from({ length: count }, async () => {
    while (true) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  }));
  return results;
}

export async function runScheduledProviders({
  providers = [],
  execute,
  concurrency = PROVIDER_CONCURRENCY_MAX,
  deadlineMs = REQUEST_DEADLINE_MS,
  callLimit = Math.max(1, providers.length * 2),
  nowMs = () => Date.now(),
  circuitBreaker = null,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
} = {}) {
  if (!Array.isArray(providers)) throw new TypeError('providers must be an array');
  if (typeof execute !== 'function') throw new TypeError('execute must be a function');
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > PROVIDER_CONCURRENCY_MAX) throw new TypeError(`concurrency must be between 1 and ${PROVIDER_CONCURRENCY_MAX}`);
  if (!Number.isFinite(deadlineMs) || deadlineMs <= 0) throw new TypeError('deadlineMs must be positive');
  if (!Number.isInteger(callLimit) || callLimit < 1) throw new TypeError('callLimit must be a positive integer');

  const startedAt = nowMs();
  const deadlineAt = startedAt + deadlineMs;
  let calls = 0;
  const all = [];

  const runOne = async adapter => {
    if (nowMs() >= deadlineAt) return { provider: adapter.name, skipped: true, reason: 'request_deadline_exhausted', attempts: 0 };
    if (calls >= callLimit) return { provider: adapter.name, skipped: true, reason: 'provider_call_budget_exhausted', attempts: 0 };
    const circuit = circuitBreaker?.canRun?.(adapter.name);
    if (circuit && !circuit.allowed) return { provider: adapter.name, skipped: true, reason: 'circuit_open', attempts: 0, retryAfterMs: circuit.retryAfterMs };

    let attempts = 0;
    let result;
    while (attempts < PROVIDER_MAX_ATTEMPTS) {
      const remainingMs = deadlineAt - nowMs();
      if (remainingMs <= 0) {
        if (attempts === 0) return { provider: adapter.name, skipped: true, reason: 'request_deadline_exhausted', attempts: 0 };
        break;
      }
      if (calls >= callLimit) {
        if (attempts === 0) return { provider: adapter.name, skipped: true, reason: 'provider_call_budget_exhausted', attempts: 0 };
        break;
      }
      attempts += 1;
      calls += 1;
      result = await execute(adapter, {
        attempt: attempts,
        remainingMs,
        timeoutMs: Math.max(1, Math.min(adapter.timeoutMs ?? remainingMs, remainingMs)),
      });

      if (result?.ok) {
        circuitBreaker?.recordSuccess?.(adapter.name);
        break;
      }

      const retryable = retryableFailure(result);
      circuitBreaker?.recordFailure?.(adapter.name, {
        retryable,
        retryAfter: result?.failure?.retryAfter ?? null,
      });
      if (!retryable || attempts >= PROVIDER_MAX_ATTEMPTS || calls >= callLimit) break;

      const delay = retryDelayMs(result, nowMs);
      const remainingAfter = deadlineAt - nowMs();
      if (delay >= remainingAfter) break;
      if (delay > 0) await sleep(delay);
    }
    return { provider: adapter.name, skipped: false, attempts, result };
  };

  for (const group of groupByTier(providers)) {
    if (nowMs() >= deadlineAt) {
      all.push(...group.providers.map(adapter => ({ provider: adapter.name, skipped: true, reason: 'request_deadline_exhausted', attempts: 0 })));
      continue;
    }
    if (calls >= callLimit) {
      all.push(...group.providers.map(adapter => ({ provider: adapter.name, skipped: true, reason: 'provider_call_budget_exhausted', attempts: 0 })));
      continue;
    }
    all.push(...await runPool(group.providers, concurrency, runOne));
  }

  return Object.freeze({
    results: all,
    calls,
    callLimit,
    durationMs: Math.max(0, nowMs() - startedAt),
    deadlineMs,
    deadlineExhausted: all.some(item => item.reason === 'request_deadline_exhausted'),
    callBudgetExhausted: all.some(item => item.reason === 'provider_call_budget_exhausted'),
  });
}
