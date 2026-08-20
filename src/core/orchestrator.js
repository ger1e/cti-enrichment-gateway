import { runProvider } from './provider-runner.js';
import { normalizeEvidence } from './normalize.js';

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

export async function enrich({ indicator, type, providerNames, registry, cache, requestId, now = () => new Date().toISOString(), gatewayVersion = '1.0.0', context = {} }) {
  if (!Array.isArray(providerNames) || providerNames.length === 0) {
    return {
      requestId,
      indicator,
      type,
      queriedAt: now(),
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
      failures.push({ provider: name, reason: 'unsupported_provider' });
      providerHealth[name] = 'unsupported';
      continue;
    }

    const key = cacheKey(name, type, indicator);
    let result = cache?.get(key);
    if (result) {
      cacheMeta[name] = 'hit';
    } else {
      cacheMeta[name] = 'miss';
      result = await runProvider(adapter, { value: indicator, type }, {
        timeoutMs: adapter.timeoutMs ?? 5000,
        now,
        context,
      });
      const ttl = result.ok ? adapter.cacheTtlMs : adapter.negativeCacheTtlMs;
      cache?.set(key, result, ttl ?? 1000);
    }

    if (result.ok) {
      providerHealth[name] = 'ok';
      const item = normalizeEvidence(name, indicator, type, result.data, {
        retrievedAt: result.retrievedAt,
        rawHash: result.rawHash,
        parserVersion: adapter.parserVersion ?? '1',
      });
      evidence.push(item);
      relationships.push(...item.relationships.map(rel => ({ ...rel, provider: rel.provider ?? name })));
    } else {
      providerHealth[name] = result.failure.reason;
      failures.push({ provider: name, ...result.failure, retrievedAt: result.retrievedAt });
    }
  }

  const status = evidence.length === 0 ? 'error' : failures.length ? 'partial' : 'ok';
  const references = [...new Set(evidence.flatMap(item => item.references))];

  return {
    requestId,
    indicator,
    type,
    queriedAt: now(),
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
