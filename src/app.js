import { randomUUID } from 'node:crypto';
import { requireGatewayAuth } from './core/auth.js';
import { securityHeaders } from './core/http.js';
import { classifyIndicator } from './core/validate.js';
import { TtlCache } from './core/cache.js';
import { CircuitBreaker } from './core/circuit-breaker.js';
import { createTelemetry } from './core/telemetry.js';
import { createProviderRegistry } from './core/provider-registry.js';
import { enrich } from './core/orchestrator.js';
import { runBatch } from './core/batch.js';
import { toStixBundle } from './export/stix.js';
import { GATEWAY_VERSION, EVIDENCE_SCHEMA_VERSION } from './core/version.js';
import { ALL_PROVIDERS } from './providers/index.js';
import { PROFILE_NAMES, selectProviders } from './profiles.js';
import { WORKFLOWS, WORKFLOW_CALL_LIMITS } from './workflows.js';

const MAX_BODY_BYTES = 16 * 1024;
const MAX_BATCH_BODY_BYTES = 96 * 1024;
const REQUEST_DEADLINE_MS = 20_000;
const PROVIDER_CONCURRENCY = 4;
const BATCH_INPUT_LIMIT = 20;
const BATCH_PROVIDER_CALL_LIMIT = 200;
const BATCH_INDICATOR_CONCURRENCY = 3;
const STIX_OBJECT_LIMIT = 100;

function response(status, body, extraHeaders = {}) {
  return { status, headers: { ...securityHeaders(), ...extraHeaders }, body };
}

function headerValue(headers, name) {
  if (!headers) return undefined;
  if (typeof headers.get === 'function') return headers.get(name) ?? undefined;
  return headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];
}

function isJsonMediaType(value) {
  const mediaType = String(value).split(';', 1)[0].trim().toLowerCase();
  return /^application\/(?:json|[!#$&^_.a-z0-9-]+\+json)$/.test(mediaType);
}

function parseBody(request, maxBytes = MAX_BODY_BYTES) {
  const contentLength = Number(headerValue(request.headers, 'content-length'));
  if (Number.isFinite(contentLength) && contentLength > maxBytes) throw Object.assign(new Error('request body too large'), { status: 413 });
  let body = request.body;
  if (typeof body === 'string') {
    if (Buffer.byteLength(body, 'utf8') > maxBytes) throw Object.assign(new Error('request body too large'), { status: 413 });
    try { body = JSON.parse(body); } catch { throw Object.assign(new Error('invalid JSON body'), { status: 400 }); }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw Object.assign(new Error('JSON object body required'), { status: 400 });
  if (Buffer.byteLength(JSON.stringify(body), 'utf8') > maxBytes) throw Object.assign(new Error('request body too large'), { status: 413 });
  return body;
}

function providerStatus(adapter, env) {
  if (adapter.requiredEnv) return { configured: Boolean(env[adapter.requiredEnv]), auth: 'secret' };
  if (adapter.optionalEnv) return { configured: true, auth: 'optional', optionalCredentialConfigured: Boolean(env[adapter.optionalEnv]) };
  return { configured: true, auth: 'none' };
}

function publicProvider(adapter) {
  return Object.freeze({
    types: [...adapter.types], observationTypes: [...adapter.observationTypes],
    requiresCredential: Boolean(adapter.requiredEnv), optionalCredential: Boolean(adapter.optionalEnv),
    costClass: adapter.costClass, tier: adapter.tier, timeoutMs: adapter.timeoutMs,
    cacheTtlMs: adapter.cacheTtlMs, negativeCacheTtlMs: adapter.negativeCacheTtlMs,
    maxResponseBytes: adapter.maxResponseBytes, fixedHosts: [...adapter.fixedHosts],
    methods: [...(adapter.methods ?? ['GET'])], protocols: [...(adapter.protocols ?? ['https:'])],
    parserVersion: adapter.parserVersion, sourceUrl: adapter.sourceUrl, active: adapter.active !== false,
  });
}

function requestGate(request, env, method = 'POST') {
  if (request?.method !== method) return response(405, { error: 'method_not_allowed' }, { allow: method });
  if (!requireGatewayAuth(request, env.CTI_GATEWAY_TOKEN)) return response(401, { error: 'unauthorized' });
  const contentType = headerValue(request.headers, 'content-type');
  if (contentType && !isJsonMediaType(contentType)) return response(415, { error: 'unsupported_media_type' });
  return null;
}

export function createApp({
  env = process.env,
  fetchImpl = fetch,
  now = () => new Date().toISOString(),
  nowMs = () => Date.now(),
  cache = new TtlCache(),
  gatewayVersion = GATEWAY_VERSION,
  adapters = ALL_PROVIDERS,
  circuitBreaker = null,
  telemetry = null,
  batchProviderCallLimit = BATCH_PROVIDER_CALL_LIMIT,
  batchDeadlineMs = REQUEST_DEADLINE_MS,
} = {}) {
  const startedAtMs = nowMs();
  const registry = createProviderRegistry(adapters);
  const breaker = circuitBreaker ?? new CircuitBreaker({ maxProviders: Math.max(1, registry.names().length), now: nowMs });
  const events = telemetry ?? createTelemetry();
  const configured = name => {
    const adapter = registry.get(name);
    return Boolean(adapter) && (!adapter.requiredEnv || Boolean(env[adapter.requiredEnv]));
  };

  async function enrichClassified(classified, profile = 'standard', { deadlineMs = REQUEST_DEADLINE_MS, callLimit = null } = {}) {
    const workflow = WORKFLOWS[classified.type];
    if (!workflow) throw new TypeError('unsupported_indicator_type');
    const selected = selectProviders({ type: classified.type, profile, workflow, registry });
    const providerNames = selected.filter(configured);
    const defaultCallLimit = WORKFLOW_CALL_LIMITS[classified.type] ?? Math.max(1, providerNames.length * 2);
    const effectiveCallLimit = callLimit == null ? defaultCallLimit : Math.max(1, Math.min(defaultCallLimit, callLimit));
    return enrich({
      indicator: classified.value, type: classified.type, providerNames, registry, cache,
      requestId: randomUUID(), now, nowMs, gatewayVersion, profile, deadlineMs,
      callLimit: effectiveCallLimit, circuitBreaker: breaker, telemetry: events,
      context: { fetchImpl, env },
    });
  }

  async function parseSingleIndicatorRequest(request, allowedFields) {
    let body;
    try { body = parseBody(request); }
    catch (error) { return { error: response(error.status ?? 400, { error: error.status === 413 ? 'payload_too_large' : 'invalid_request' }) }; }
    const allowed = new Set(allowedFields);
    if (Object.keys(body).some(key => !allowed.has(key))) return { error: response(400, { error: 'unsupported_request_field' }) };
    let classified;
    try { classified = classifyIndicator(body.indicator); }
    catch { return { error: response(400, { error: 'invalid_indicator' }) }; }
    if (body.type !== undefined && body.type !== classified.type) return { error: response(400, { error: 'indicator_type_mismatch' }) };
    const profile = body.profile ?? 'standard';
    if (!PROFILE_NAMES.includes(profile)) return { error: response(400, { error: 'invalid_profile' }) };
    return { body, classified, profile };
  }

  return {
    async handleHealth(request) {
      if (request?.method !== 'GET') return response(405, { error: 'method_not_allowed' }, { allow: 'GET' });
      if (!requireGatewayAuth(request, env.CTI_GATEWAY_TOKEN)) return response(401, { error: 'unauthorized' }, { 'cache-control': 'no-store' });
      const providers = Object.fromEntries(registry.names().map(name => [name, providerStatus(registry.get(name), env)]));
      return response(200, {
        status: 'ok', version: gatewayVersion, gatewayAuthConfigured: Boolean(env.CTI_GATEWAY_TOKEN), providers,
        operations: { sentry: { configured: Boolean(env.SENTRY_AUTH_TOKEN), role: 'observability_only' } }, activeWorkflows: WORKFLOWS,
      }, { 'cache-control': 'no-store' });
    },

    async handleMeta(request) {
      if (request?.method !== 'GET') return response(405, { error: 'method_not_allowed' }, { allow: 'GET' });
      const providers = Object.fromEntries(registry.names().map(name => [name, publicProvider(registry.get(name))]));
      return response(200, {
        gatewayVersion, schemaVersion: EVIDENCE_SCHEMA_VERSION,
        types: Object.keys(WORKFLOWS), profiles: [...PROFILE_NAMES],
        limits: {
          requestBodyBytes: MAX_BODY_BYTES, batchBodyBytes: MAX_BATCH_BODY_BYTES, requestDeadlineMs: REQUEST_DEADLINE_MS,
          providerConcurrency: PROVIDER_CONCURRENCY, batchInputs: BATCH_INPUT_LIMIT,
          batchProviderCalls: BATCH_PROVIDER_CALL_LIMIT, batchIndicatorConcurrency: BATCH_INDICATOR_CONCURRENCY, stixObjects: STIX_OBJECT_LIMIT,
          workflowProviderCalls: { ...WORKFLOW_CALL_LIMITS },
        },
        providers,
      });
    },

    async handleStatus(request) {
      if (request?.method !== 'GET') return response(405, { error: 'method_not_allowed' }, { allow: 'GET' });
      if (!requireGatewayAuth(request, env.CTI_GATEWAY_TOKEN)) return response(401, { error: 'unauthorized' }, { 'cache-control': 'no-store' });
      const providers = Object.fromEntries(registry.names().map(name => {
        const adapter = registry.get(name);
        return [name, { ...providerStatus(adapter, env), parserVersion: adapter.parserVersion, active: adapter.active !== false }];
      }));
      return response(200, {
        gatewayVersion, schemaVersion: EVIDENCE_SCHEMA_VERSION,
        uptimeMs: Math.max(0, nowMs() - startedAtMs),
        gatewayAuthConfigured: Boolean(env.CTI_GATEWAY_TOKEN), providers,
        cache: typeof cache?.stats === 'function' ? cache.stats() : { entries: 0, inflight: 0, hits: 0, misses: 0, evictions: 0, expirations: 0 },
        circuit: typeof breaker?.stats === 'function' ? breaker.stats() : { providers: 0, open: 0 },
        telemetry: typeof events?.stats === 'function' ? events.stats() : { events: 0, sinkErrors: 0, byEvent: {} },
      }, { 'cache-control': 'no-store' });
    },

    async handleEnrich(request) {
      const gate = requestGate(request, env); if (gate) return gate;
      const parsed = await parseSingleIndicatorRequest(request, ['indicator', 'type', 'profile']); if (parsed.error) return parsed.error;
      try { return response(200, await enrichClassified(parsed.classified, parsed.profile)); }
      catch (error) { if (error?.message === 'unsupported_indicator_type') return response(400, { error: 'unsupported_indicator_type' }); throw error; }
    },

    async handleBatch(request) {
      const gate = requestGate(request, env); if (gate) return gate;
      let body;
      try { body = parseBody(request, MAX_BATCH_BODY_BYTES); }
      catch (error) { return response(error.status ?? 400, { error: error.status === 413 ? 'payload_too_large' : 'invalid_request' }); }
      const allowed = new Set(['indicators', 'profile']);
      if (Object.keys(body).some(key => !allowed.has(key))) return response(400, { error: 'unsupported_request_field' });
      if (!Array.isArray(body.indicators) || body.indicators.length < 1 || body.indicators.length > BATCH_INPUT_LIMIT || body.indicators.some(value => typeof value !== 'string')) return response(400, { error: 'invalid_batch' });
      const profile = body.profile ?? 'standard';
      if (!PROFILE_NAMES.includes(profile)) return response(400, { error: 'invalid_profile' });
      const batch = await runBatch({
        indicators: body.indicators, profile, classify: classifyIndicator,
        enrichOne: (classified, options) => enrichClassified(classified, profile, options),
        callLimitFor: type => WORKFLOW_CALL_LIMITS[type] ?? 1,
        providerCallLimit: batchProviderCallLimit, indicatorConcurrency: BATCH_INDICATOR_CONCURRENCY,
        deadlineMs: batchDeadlineMs, nowMs,
      });
      return response(200, { requestId: randomUUID(), gatewayVersion, ...batch });
    },

    async handleStix(request) {
      const gate = requestGate(request, env); if (gate) return gate;
      const parsed = await parseSingleIndicatorRequest(request, ['indicator', 'type', 'profile']); if (parsed.error) return parsed.error;
      let enrichment;
      try { enrichment = await enrichClassified(parsed.classified, parsed.profile); }
      catch (error) { if (error?.message === 'unsupported_indicator_type') return response(400, { error: 'unsupported_indicator_type' }); throw error; }
      return response(200, toStixBundle(enrichment, { maxObjects: STIX_OBJECT_LIMIT, now }));
    },
  };
}

export function writeVercelResponse(res, result) {
  res.statusCode = result.status;
  for (const [name, value] of Object.entries(result.headers)) res.setHeader(name, value);
  res.end(JSON.stringify(result.body));
}
