import { randomUUID } from 'node:crypto';
import { requireGatewayAuth } from './core/auth.js';
import { securityHeaders } from './core/http.js';
import { classifyIndicator } from './core/validate.js';
import { TtlCache } from './core/cache.js';
import { CircuitBreaker } from './core/circuit-breaker.js';
import { createProviderRegistry } from './core/provider-registry.js';
import { enrich } from './core/orchestrator.js';
import { runBatch } from './core/batch.js';
import { GATEWAY_VERSION } from './core/version.js';
import { ALL_PROVIDERS } from './providers/index.js';
import { PROFILE_NAMES, selectProviders } from './profiles.js';
import { WORKFLOWS, WORKFLOW_CALL_LIMITS } from './workflows.js';

const MAX_BODY_BYTES = 16 * 1024;
const MAX_BATCH_BODY_BYTES = 96 * 1024;

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
  if (Number.isFinite(contentLength) && contentLength > maxBytes) {
    throw Object.assign(new Error('request body too large'), { status: 413 });
  }

  let body = request.body;
  if (typeof body === 'string') {
    if (Buffer.byteLength(body, 'utf8') > maxBytes) {
      throw Object.assign(new Error('request body too large'), { status: 413 });
    }
    try {
      body = JSON.parse(body);
    } catch {
      throw Object.assign(new Error('invalid JSON body'), { status: 400 });
    }
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw Object.assign(new Error('JSON object body required'), { status: 400 });
  }
  if (Buffer.byteLength(JSON.stringify(body), 'utf8') > maxBytes) {
    throw Object.assign(new Error('request body too large'), { status: 413 });
  }
  return body;
}

function providerStatus(adapter, env) {
  if (adapter.requiredEnv) return { configured: Boolean(env[adapter.requiredEnv]), auth: 'secret' };
  if (adapter.optionalEnv) {
    return {
      configured: true,
      auth: 'optional',
      optionalCredentialConfigured: Boolean(env[adapter.optionalEnv]),
    };
  }
  return { configured: true, auth: 'none' };
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
  batchProviderCallLimit = 200,
  batchDeadlineMs = 20_000,
} = {}) {
  const registry = createProviderRegistry(adapters);
  const breaker = circuitBreaker ?? new CircuitBreaker({ maxProviders: Math.max(1, registry.names().length), now: nowMs });
  const configured = name => {
    const adapter = registry.get(name);
    return Boolean(adapter) && (!adapter.requiredEnv || Boolean(env[adapter.requiredEnv]));
  };

  async function enrichClassified(classified, profile = 'standard', { deadlineMs = 20_000, callLimit = null } = {}) {
    const workflow = WORKFLOWS[classified.type];
    if (!workflow) throw new TypeError('unsupported_indicator_type');
    const selected = selectProviders({ type: classified.type, profile, workflow, registry });
    const providerNames = selected.filter(configured);
    const defaultCallLimit = WORKFLOW_CALL_LIMITS[classified.type] ?? Math.max(1, providerNames.length * 2);
    const effectiveCallLimit = callLimit == null ? defaultCallLimit : Math.max(1, Math.min(defaultCallLimit, callLimit));
    return enrich({
      indicator: classified.value,
      type: classified.type,
      providerNames,
      registry,
      cache,
      requestId: randomUUID(),
      now,
      nowMs,
      gatewayVersion,
      profile,
      deadlineMs,
      callLimit: effectiveCallLimit,
      circuitBreaker: breaker,
      context: { fetchImpl, env },
    });
  }

  return {
    async handleHealth(request) {
      if (request?.method && request.method !== 'GET') {
        return response(405, { error: 'method_not_allowed' }, { allow: 'GET' });
      }
      const providers = Object.fromEntries(registry.names().map(name => {
        const adapter = registry.get(name);
        return [name, providerStatus(adapter, env)];
      }));
      return response(200, {
        status: 'ok',
        version: gatewayVersion,
        gatewayAuthConfigured: Boolean(env.CTI_GATEWAY_TOKEN),
        providers,
        operations: {
          sentry: {
            configured: Boolean(env.SENTRY_AUTH_TOKEN),
            role: 'observability_only',
          },
        },
        activeWorkflows: WORKFLOWS,
      });
    },

    async handleEnrich(request) {
      const gate = requestGate(request, env);
      if (gate) return gate;

      let body;
      try {
        body = parseBody(request);
      } catch (error) {
        return response(error.status ?? 400, { error: error.status === 413 ? 'payload_too_large' : 'invalid_request' });
      }

      let classified;
      try {
        classified = classifyIndicator(body.indicator);
      } catch {
        return response(400, { error: 'invalid_indicator' });
      }
      if (body.type !== undefined && body.type !== classified.type) {
        return response(400, { error: 'indicator_type_mismatch' });
      }

      const profile = body.profile ?? 'standard';
      let result;
      try {
        result = await enrichClassified(classified, profile);
      } catch (error) {
        if (error?.message === 'invalid_profile') return response(400, { error: 'invalid_profile' });
        if (error?.message === 'unsupported_indicator_type') return response(400, { error: 'unsupported_indicator_type' });
        throw error;
      }
      return response(200, result);
    },

    async handleBatch(request) {
      const gate = requestGate(request, env);
      if (gate) return gate;

      let body;
      try {
        body = parseBody(request, MAX_BATCH_BODY_BYTES);
      } catch (error) {
        return response(error.status ?? 400, { error: error.status === 413 ? 'payload_too_large' : 'invalid_request' });
      }

      const allowed = new Set(['indicators', 'profile']);
      if (Object.keys(body).some(key => !allowed.has(key))) return response(400, { error: 'unsupported_request_field' });
      if (!Array.isArray(body.indicators) || body.indicators.length < 1 || body.indicators.length > 20 || body.indicators.some(value => typeof value !== 'string')) {
        return response(400, { error: 'invalid_batch' });
      }
      const profile = body.profile ?? 'standard';
      if (!PROFILE_NAMES.includes(profile)) return response(400, { error: 'invalid_profile' });

      const batch = await runBatch({
        indicators: body.indicators,
        profile,
        classify: classifyIndicator,
        enrichOne: (classified, options) => enrichClassified(classified, profile, options),
        callLimitFor: type => WORKFLOW_CALL_LIMITS[type] ?? 1,
        providerCallLimit: batchProviderCallLimit,
        indicatorConcurrency: 3,
        deadlineMs: batchDeadlineMs,
        nowMs,
      });
      return response(200, { requestId: randomUUID(), gatewayVersion, ...batch });
    },
  };
}

export function writeVercelResponse(res, result) {
  res.statusCode = result.status;
  for (const [name, value] of Object.entries(result.headers)) res.setHeader(name, value);
  res.end(JSON.stringify(result.body));
}
