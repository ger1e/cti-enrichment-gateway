import { randomUUID } from 'node:crypto';
import { requireGatewayAuth } from './core/auth.js';
import { securityHeaders } from './core/http.js';
import { classifyIndicator } from './core/validate.js';
import { TtlCache } from './core/cache.js';
import { createProviderRegistry } from './core/provider-registry.js';
import { enrich } from './core/orchestrator.js';
import { ALL_PROVIDERS } from './providers/index.js';
import { WORKFLOWS } from './workflows.js';

const MAX_BODY_BYTES = 16 * 1024;

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
  if (mediaType === 'application/json') return true;
  return mediaType.startsWith('application/') && mediaType.endsWith('+json');
}

function parseBody(request) {
  const contentLength = Number(headerValue(request.headers, 'content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    throw Object.assign(new Error('request body too large'), { status: 413 });
  }

  let body = request.body;
  if (typeof body === 'string') {
    if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
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
  if (Buffer.byteLength(JSON.stringify(body), 'utf8') > MAX_BODY_BYTES) {
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

export function createApp({
  env = process.env,
  fetchImpl = fetch,
  now = () => new Date().toISOString(),
  cache = new TtlCache(),
  gatewayVersion = env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || '1.0.0',
  adapters = ALL_PROVIDERS,
} = {}) {
  const registry = createProviderRegistry(adapters);
  const configured = name => {
    const adapter = registry.get(name);
    return Boolean(adapter) && (!adapter.requiredEnv || Boolean(env[adapter.requiredEnv]));
  };

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
      if (request?.method !== 'POST') {
        return response(405, { error: 'method_not_allowed' }, { allow: 'POST' });
      }
      if (!requireGatewayAuth(request, env.CTI_GATEWAY_TOKEN)) {
        return response(401, { error: 'unauthorized' });
      }

      const contentType = headerValue(request.headers, 'content-type');
      if (contentType && !isJsonMediaType(contentType)) {
        return response(415, { error: 'unsupported_media_type' });
      }

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

      const workflow = WORKFLOWS[classified.type];
      if (!workflow) return response(400, { error: 'unsupported_indicator_type' });
      const providerNames = workflow.filter(configured);
      const result = await enrich({
        indicator: classified.value,
        type: classified.type,
        providerNames,
        registry,
        cache,
        requestId: randomUUID(),
        now,
        gatewayVersion,
        context: { fetchImpl, env },
      });
      return response(200, result);
    },
  };
}

export function writeVercelResponse(res, result) {
  res.statusCode = result.status;
  for (const [name, value] of Object.entries(result.headers)) res.setHeader(name, value);
  res.end(JSON.stringify(result.body));
}
