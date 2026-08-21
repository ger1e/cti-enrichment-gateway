import { runProvider } from './provider-runner.js';
import { normalizeEvidence } from './normalize.js';
import { correlateEvidence } from './correlate.js';
import { runScheduledProviders } from './scheduler.js';
import { EVIDENCE_SCHEMA_VERSION } from './version.js';

function cacheKey(provider, type, indicator) {
  return `${provider}:${type}:${indicator}`;
}

function emptyHuntContext(indicator, type) {
  return {
    indicator,
    type,
    firstSeen: null,
    lastSeen: null,
    families: [],
    actors: [],
    sourceReferences: [],
  };
}

function providerSummary() {
  return { ok: 0, failed: 0, skipped: 0, cached: 0 };
}

function baseEnvelope({ requestId, indicator, type, queriedAt, gatewayVersion, profile, durationMs, budget, summary }) {
  return {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    gatewayVersion,
    requestId,
    indicator,
    type,
    queriedAt,
    profile,
    durationMs,
    budget,
    providerSummary: summary,
  };
}

export async function enrich({
  indicator,
  type,
  providerNames,
  registry,
  cache,
  requestId,
  now = () => new Date().toISOString(),
  nowMs = () => Date.now(),
  gatewayVersion = '1.0.0',
  profile = 'standard',
  deadlineMs = 20_000,
  callLimit = Array.isArray(providerNames) ? Math.max(1, providerNames.length * 2) : 1,
  circuitBreaker = null,
  context = {},
}) {
  const started = nowMs();
  const budget = {
    providerCallLimit: callLimit,
    providerCalls: 0,
    deadlineMs,
    deadlineExhausted: false,
    callBudgetExhausted: false,
  };
  const summary = providerSummary();

  if (!Array.isArray(providerNames) || providerNames.length === 0) {
    const queriedAt = now();
    return {
      ...baseEnvelope({
        requestId, indicator, type, queriedAt, gatewayVersion, profile,
        durationMs: Math.max(0, nowMs() - started), budget, summary,
      }),
      status: 'error',
      evidence: [],
      relationships: [],
      correlation: correlateEvidence({ indicator, type, evidence: [], relationships: [], now: queriedAt }),
      failures: [{ provider: 'gateway', reason: 'no_configured_providers' }],
      huntContext: emptyHuntContext(indicator, type),
      meta: { gatewayVersion, cache: {}, providerHealth: {} },
    };
  }

  const evidence = [];
  const failures = [];
  const cacheMeta = {};
  const providerHealth = {};
  const relationships = [];
  const records = new Map();
  const pending = [];

  for (const name of providerNames) {
    const adapter = registry.get(name);
    if (!adapter || !adapter.types.includes(type)) {
      records.set(name, { skipped: true, reason: 'unsupported_provider' });
      continue;
    }

    const key = cacheKey(name, type, indicator);
    const cached = cache?.get(key);
    if (cached !== undefined) {
      records.set(name, { result: cached, cacheState: 'hit', attempts: 0 });
    } else {
      pending.push(adapter);
    }
  }

  const scheduled = await runScheduledProviders({
    providers: pending,
    deadlineMs,
    callLimit,
    nowMs,
    circuitBreaker,
    execute: async (adapter, { timeoutMs }) => runProvider(adapter, { value: indicator, type }, {
      timeoutMs,
      now,
      nowMs,
      context,
    }),
  });
  budget.providerCalls = scheduled.calls;
  budget.deadlineExhausted = scheduled.deadlineExhausted;
  budget.callBudgetExhausted = scheduled.callBudgetExhausted;

  for (const item of scheduled.results) {
    if (item.skipped) {
      records.set(item.provider, { skipped: true, reason: item.reason, retryAfterMs: item.retryAfterMs ?? null, attempts: item.attempts });
      continue;
    }
    const adapter = registry.get(item.provider);
    const result = item.result;
    if (result) {
      const ttl = result.ok ? adapter.cacheTtlMs : adapter.negativeCacheTtlMs;
      cache?.set(cacheKey(item.provider, type, indicator), result, ttl ?? 1000);
    }
    records.set(item.provider, { result, cacheState: 'miss', attempts: item.attempts });
  }

  for (const name of providerNames) {
    const record = records.get(name);
    const adapter = registry.get(name);
    if (!record || record.skipped) {
      summary.skipped += 1;
      const reason = record?.reason ?? 'not_scheduled';
      failures.push({ provider: name, reason, ...(record?.retryAfterMs ? { retryAfterMs: record.retryAfterMs } : {}) });
      providerHealth[name] = reason;
      cacheMeta[name] = 'skipped';
      continue;
    }

    const result = record.result;
    cacheMeta[name] = record.cacheState;
    if (record.cacheState === 'hit') summary.cached += 1;

    if (result?.ok) {
      summary.ok += 1;
      providerHealth[name] = 'ok';
      const item = normalizeEvidence(name, indicator, type, result.data, {
        retrievedAt: result.retrievedAt,
        rawHash: result.rawHash,
        parserVersion: adapter?.parserVersion ?? '1',
        cacheState: record.cacheState,
        durationMs: record.cacheState === 'hit' ? 0 : result.durationMs,
      });
      evidence.push(item);
      relationships.push(...item.relationships.map(rel => ({ ...rel, provider: rel.provider ?? name })));
    } else {
      summary.failed += 1;
      const failure = result?.failure ?? { reason: 'provider_error' };
      providerHealth[name] = failure.reason;
      failures.push({ provider: name, ...failure, retrievedAt: result?.retrievedAt ?? now() });
    }
  }

  const status = evidence.length === 0 ? 'error' : failures.length ? 'partial' : 'ok';
  const references = [...new Set(evidence.flatMap(item => item.references))];
  const queriedAt = now();
  const correlation = correlateEvidence({ indicator, type, evidence, relationships, now: queriedAt });

  return {
    ...baseEnvelope({
      requestId, indicator, type, queriedAt, gatewayVersion, profile,
      durationMs: Math.max(0, nowMs() - started), budget, summary,
    }),
    status,
    evidence,
    relationships: correlation.relationships,
    correlation,
    failures,
    huntContext: {
      indicator,
      type,
      firstSeen: evidence.map(x => x.observation.firstSeen).filter(Boolean).sort()[0] ?? null,
      lastSeen: evidence.map(x => x.observation.lastSeen).filter(Boolean).sort().at(-1) ?? null,
      families: [...new Set(evidence.map(x => x.observation.malwareFamily).filter(Boolean))],
      actors: [...new Set(evidence.map(x => x.observation.actor).filter(Boolean))],
      sourceReferences: references,
    },
    meta: {
      gatewayVersion,
      cache: cacheMeta,
      providerHealth,
    },
  };
}
