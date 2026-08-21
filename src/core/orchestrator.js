import { runProvider } from './provider-runner.js';
import { normalizeEvidence } from './normalize.js';
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
  context = {},
}) {
  const started = nowMs();
  const budget = { providerCallLimit: Array.isArray(providerNames) ? providerNames.length : 0, providerCalls: 0 };
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

  for (const name of providerNames) {
    const adapter = registry.get(name);
    if (!adapter || !adapter.types.includes(type)) {
      summary.skipped += 1;
      failures.push({ provider: name, reason: 'unsupported_provider' });
      providerHealth[name] = 'unsupported';
      continue;
    }

    const key = cacheKey(name, type, indicator);
    let result = cache?.get(key);
    let cacheState = 'hit';
    if (result) {
      summary.cached += 1;
      cacheMeta[name] = 'hit';
    } else {
      cacheState = 'miss';
      cacheMeta[name] = 'miss';
      budget.providerCalls += 1;
      result = await runProvider(adapter, { value: indicator, type }, {
        timeoutMs: adapter.timeoutMs ?? 5000,
        now,
        nowMs,
        context,
      });
      const ttl = result.ok ? adapter.cacheTtlMs : adapter.negativeCacheTtlMs;
      cache?.set(key, result, ttl ?? 1000);
    }

    if (result.ok) {
      summary.ok += 1;
      providerHealth[name] = 'ok';
      const item = normalizeEvidence(name, indicator, type, result.data, {
        retrievedAt: result.retrievedAt,
        rawHash: result.rawHash,
        parserVersion: adapter.parserVersion ?? '1',
        cacheState,
        durationMs: cacheState === 'hit' ? 0 : result.durationMs,
      });
      evidence.push(item);
      relationships.push(...item.relationships.map(rel => ({ ...rel, provider: rel.provider ?? name })));
    } else {
      summary.failed += 1;
      providerHealth[name] = result.failure.reason;
      failures.push({ provider: name, ...result.failure, retrievedAt: result.retrievedAt });
    }
  }

  const status = evidence.length === 0 ? 'error' : failures.length ? 'partial' : 'ok';
  const references = [...new Set(evidence.flatMap(item => item.references))];
  const queriedAt = now();

  return {
    ...baseEnvelope({
      requestId, indicator, type, queriedAt, gatewayVersion, profile,
      durationMs: Math.max(0, nowMs() - started), budget, summary,
    }),
    status,
    evidence,
    relationships,
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
