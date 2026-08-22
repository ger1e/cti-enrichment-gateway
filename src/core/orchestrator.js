import { runProvider } from './provider-runner.js';
import { normalizeEvidence } from './normalize.js';
import { correlateEvidence } from './correlate.js';
import { runScheduledProviders } from './scheduler.js';
import { EVIDENCE_SCHEMA_VERSION } from './version.js';

const NEGATIVE_SEMANTIC_VERDICTS = new Set(['not_listed', 'not_found', 'no_result', 'no_association', 'clean', 'benign']);
const REPUTATION_TYPES = new Set(['reputation', 'ioc_reputation', 'threat_intelligence', 'malicious_url', 'malware_distribution', 'phishing_feed', 'phishing_feed_match', 'botnet_c2']);
const NETWORK_TYPES = new Set(['network_identity', 'routing', 'registration', 'internet_exposure', 'passive_dns']);
const MAX_LIMITATIONS = 16;

function cacheKey(provider, type, indicator) {
  return `${provider}:${type}:${indicator}`;
}

function cacheTtlFor(adapter, result) {
  if (!result?.ok) return null;
  const verdict = String(result?.data?.verdict ?? '').toLowerCase();
  return NEGATIVE_SEMANTIC_VERDICTS.has(verdict) ? adapter.negativeCacheTtlMs : adapter.cacheTtlMs;
}

function emptyHuntContext(indicator, type) {
  return { indicator, type, firstSeen: null, lastSeen: null, families: [], actors: [], sourceReferences: [] };
}

function providerSummary() {
  return { ok: 0, failed: 0, skipped: 0, cached: 0 };
}

function baseEnvelope({ requestId, indicator, type, queriedAt, gatewayVersion, profile, durationMs, budget, summary }) {
  return { schemaVersion: EVIDENCE_SCHEMA_VERSION, gatewayVersion, requestId, indicator, type, queriedAt, profile, durationMs, budget, providerSummary: summary };
}

function coverageClass(observationType) {
  if (REPUTATION_TYPES.has(observationType)) return 'reputation';
  if (NETWORK_TYPES.has(observationType)) return 'network_context';
  if (observationType === 'known_exploited') return 'exploitation';
  if (observationType === 'exploit_probability') return 'exploit_probability';
  if (['vulnerability_metadata', 'vulnerability_catalog', 'open_source_vulnerability'].includes(observationType)) return 'vulnerability_metadata';
  if (observationType === 'attack_knowledge') return 'attack_knowledge';
  if (observationType === 'scanner_activity') return 'scanner_activity';
  if (observationType === 'tor_exit') return 'tor_exit';
  return observationType || 'unknown';
}

function buildCoverage(providerNames, registry, type, records, summary, executedProviders) {
  const successful = new Set();
  const classProviders = new Map();
  for (const name of providerNames) {
    const adapter = registry.get(name);
    if (adapter?.types?.includes(type)) {
      for (const observationType of adapter.observationTypes ?? []) {
        const cls = coverageClass(observationType);
        if (!classProviders.has(cls)) classProviders.set(cls, new Set());
        classProviders.get(cls).add(name);
      }
    }
    if (records.get(name)?.result?.ok) successful.add(name);
  }
  const selected = providerNames.length;
  const lost = summary.failed + summary.skipped;
  const ratioLoss = selected > 0 && (lost / selected) > 0.25;
  let semanticLoss = false;
  for (const providers of classProviders.values()) {
    if (providers.size && ![...providers].some(name => successful.has(name))) {
      semanticLoss = true;
      break;
    }
  }
  return {
    selected,
    executed: executedProviders.size,
    succeeded: summary.ok,
    failed: summary.failed,
    skipped: summary.skipped,
    materialLoss: ratioLoss || semanticLoss,
  };
}

function mergeLimitations(correlation, coverage) {
  const limitations = new Set(correlation?.limitations ?? []);
  if (coverage.succeeded > 0 && (coverage.failed > 0 || coverage.skipped > 0)) limitations.add('partial_provider_failure');
  if (coverage.materialLoss) limitations.add('material_coverage_loss');
  return [...limitations].sort().slice(0, MAX_LIMITATIONS);
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
  telemetry = null,
  context = {},
}) {
  const started = nowMs();
  telemetry?.emit?.({ event: 'request_start', requestId, type, profile, status: 'start', indicator });
  const budget = { providerCallLimit: callLimit, providerCalls: 0, deadlineMs, deadlineExhausted: false, callBudgetExhausted: false };
  const summary = providerSummary();

  if (!Array.isArray(providerNames) || providerNames.length === 0) {
    const queriedAt = now();
    const durationMs = Math.max(0, nowMs() - started);
    const correlation = correlateEvidence({ indicator, type, evidence: [], relationships: [], now: queriedAt });
    const coverage = { selected: 0, executed: 0, succeeded: 0, failed: 0, skipped: 0, materialLoss: false };
    telemetry?.emit?.({ event: 'budget', requestId, type, status: 'error', providerCalls: 0, providerCallLimit: callLimit, deadlineMs });
    telemetry?.emit?.({ event: 'request_complete', requestId, type, profile, status: 'error', durationMs, indicator });
    return {
      ...baseEnvelope({ requestId, indicator, type, queriedAt, gatewayVersion, profile, durationMs, budget, summary }),
      status: 'error', evidence: [], relationships: [], correlation, coverage, limitations: correlation.limitations ?? [],
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
  const executedProviders = new Set();

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
      telemetry?.emit?.({ event: 'cache', requestId, type, provider: name, status: 'hit', cacheState: 'hit' });
    } else {
      pending.push(adapter);
      telemetry?.emit?.({ event: 'cache', requestId, type, provider: name, status: 'miss', cacheState: 'miss' });
    }
  }

  const scheduled = await runScheduledProviders({
    providers: pending,
    deadlineMs,
    callLimit,
    nowMs,
    circuitBreaker,
    execute: async (adapter, { timeoutMs }) => runProvider(adapter, { value: indicator, type }, { timeoutMs, now, nowMs, requestId, telemetry, context }),
  });
  budget.providerCalls = scheduled.calls;
  budget.deadlineExhausted = scheduled.deadlineExhausted;
  budget.callBudgetExhausted = scheduled.callBudgetExhausted;
  telemetry?.emit?.({ event: 'budget', requestId, type, status: scheduled.deadlineExhausted || scheduled.callBudgetExhausted ? 'exhausted' : 'within_limit', providerCalls: scheduled.calls, providerCallLimit: callLimit, deadlineMs, deadlineExhausted: scheduled.deadlineExhausted, callBudgetExhausted: scheduled.callBudgetExhausted });

  for (const item of scheduled.results) {
    if (item.skipped) {
      records.set(item.provider, { skipped: true, reason: item.reason, retryAfterMs: item.retryAfterMs ?? null, attempts: item.attempts });
      if (item.reason === 'circuit_open') telemetry?.emit?.({ event: 'circuit', requestId, type, provider: item.provider, status: 'open', reason: 'circuit_open', retryAfterMs: item.retryAfterMs ?? 0 });
      continue;
    }
    executedProviders.add(item.provider);
    const adapter = registry.get(item.provider);
    const result = item.result;
    const ttl = cacheTtlFor(adapter, result);
    if (ttl != null) cache?.set(cacheKey(item.provider, type, indicator), result, ttl);
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
      telemetry?.emit?.({ event: 'provider_outcome', requestId, type, provider: name, status: 'skipped', reason });
      continue;
    }

    const result = record.result;
    cacheMeta[name] = record.cacheState;
    if (record.cacheState === 'hit') summary.cached += 1;
    if (result?.ok) {
      summary.ok += 1;
      providerHealth[name] = 'ok';
      telemetry?.emit?.({ event: 'provider_outcome', requestId, type, provider: name, status: 'success' });
      const item = normalizeEvidence(name, indicator, type, result.data, {
        retrievedAt: result.retrievedAt, rawHash: result.rawHash, parserVersion: adapter?.parserVersion ?? '1',
        cacheState: record.cacheState, durationMs: record.cacheState === 'hit' ? 0 : result.durationMs,
      });
      evidence.push(item);
      relationships.push(...item.relationships.map(rel => ({ ...rel, provider: rel.provider ?? name })));
    } else {
      summary.failed += 1;
      const failure = result?.failure ?? { reason: 'provider_error' };
      providerHealth[name] = failure.reason;
      failures.push({ provider: name, ...failure, retrievedAt: result?.retrievedAt ?? now() });
      const outcome = failure.reason === 'timeout' ? 'timeout' : failure.reason === 'rate_limited' ? 'rate_limited' : 'failure';
      telemetry?.emit?.({ event: 'provider_outcome', requestId, type, provider: name, status: outcome, reason: failure.reason });
    }
  }

  const status = evidence.length === 0 ? 'error' : failures.length ? 'partial' : 'ok';
  const references = [...new Set(evidence.flatMap(item => item.references))];
  const queriedAt = now();
  const rawCorrelation = correlateEvidence({ indicator, type, evidence, relationships, now: queriedAt });
  const coverage = buildCoverage(providerNames, registry, type, records, summary, executedProviders);
  const limitations = mergeLimitations(rawCorrelation, coverage);
  const correlation = { ...rawCorrelation, limitations };
  const durationMs = Math.max(0, nowMs() - started);
  telemetry?.emit?.({ event: 'request_complete', requestId, type, profile, status, durationMs, indicator });

  return {
    ...baseEnvelope({ requestId, indicator, type, queriedAt, gatewayVersion, profile, durationMs, budget, summary }),
    status, evidence, relationships: correlation.relationships, correlation, coverage, limitations, failures,
    huntContext: {
      indicator, type,
      firstSeen: evidence.map(x => x.observation.firstSeen).filter(Boolean).sort()[0] ?? null,
      lastSeen: evidence.map(x => x.observation.lastSeen).filter(Boolean).sort().at(-1) ?? null,
      families: [...new Set(evidence.map(x => x.observation.malwareFamily).filter(Boolean))],
      actors: [...new Set(evidence.map(x => x.observation.actor).filter(Boolean))],
      sourceReferences: references,
    },
    meta: { gatewayVersion, cache: cacheMeta, providerHealth },
  };
}
