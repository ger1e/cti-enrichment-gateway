import { ALL_PROVIDERS } from '../src/providers/index.js';
import { runProvider } from '../src/core/provider-runner.js';
import { PROBE_SAMPLE_BY_TYPE } from '../src/control/provider-probe.js';

export const config = { maxDuration: 300 };

const EXPIRES_AT = Date.parse('2026-08-23T16:30:00Z');
const CONCURRENCY = 4;

function writeJson(res, statusCode, body) {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.setHeader('content-security-policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  res.setHeader('x-content-type-options', 'nosniff');
  res.setHeader('x-frame-options', 'DENY');
  res.setHeader('referrer-policy', 'no-referrer');
  res.setHeader('x-robots-tag', 'noindex');
  res.end(JSON.stringify(body));
}

function configured(env, name) {
  return typeof name === 'string' && typeof env?.[name] === 'string' && env[name].trim().length > 0;
}

function classifyFailure(failure) {
  const status = Number(failure?.status);
  if (status === 401 || status === 403) return 'auth_failed';
  if (failure?.reason === 'rate_limited' || status === 429) return 'rate_limited';
  if (failure?.reason === 'timeout' || status === 408 || status === 504) return 'timeout';
  if ((Number.isFinite(status) && status >= 500) || failure?.reason === 'provider_transport_error') return 'upstream_error';
  return 'contract_error';
}

async function probe(provider) {
  const type = Array.isArray(provider.types) ? provider.types[0] : null;
  const value = type ? PROBE_SAMPLE_BY_TYPE[type] : null;
  if (!type || !value) return { provider: provider.name, type: type ?? 'unknown', status: 'contract_error' };
  if (provider.requiredEnv && !configured(process.env, provider.requiredEnv)) {
    return { provider: provider.name, type, status: 'unconfigured' };
  }

  const timeoutMs = Math.min(Math.max(Number(provider.timeoutMs) || 5000, 1000), 15000);
  const result = await runProvider(provider, Object.freeze({ type, value }), {
    timeoutMs,
    context: { env: process.env, fetchImpl: fetch },
  });

  if (!result.ok) {
    const httpStatus = Number(result.failure?.status);
    return {
      provider: provider.name,
      type,
      status: classifyFailure(result.failure),
      latencyMs: result.durationMs,
      ...(Number.isFinite(httpStatus) ? { httpStatus } : {}),
    };
  }

  const data = result.data;
  if (!data || typeof data !== 'object' || typeof data.observationType !== 'string' || !data.observationType) {
    return { provider: provider.name, type, status: 'contract_error', latencyMs: result.durationMs };
  }

  return {
    provider: provider.name,
    type,
    status: 'ok',
    latencyMs: result.durationMs,
    observationType: data.observationType,
    verdict: typeof data.verdict === 'string' ? data.verdict : 'unknown',
  };
}

async function mapBounded(items, limit, mapper) {
  const output = new Array(items.length);
  let next = 0;
  async function worker() {
    while (true) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      output[index] = await mapper(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return output;
}

export default async function handler(req, res) {
  if (process.env.VERCEL_ENV !== 'preview' || process.env.VERCEL_GIT_COMMIT_REF !== 'matrixprobe') {
    return writeJson(res, 404, { error: 'not_found' });
  }
  if (Date.now() > EXPIRES_AT) return writeJson(res, 410, { error: 'expired' });
  if (req.method !== 'GET') return writeJson(res, 405, { error: 'method_not_allowed' });

  const providers = ALL_PROVIDERS.filter(provider => provider?.active !== false);
  const startedAt = new Date().toISOString();
  const results = await mapBounded(providers, CONCURRENCY, probe);
  const summary = results.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] ?? 0) + 1;
    return acc;
  }, {});

  return writeJson(res, 200, {
    startedAt,
    finishedAt: new Date().toISOString(),
    providerCount: results.length,
    concurrency: CONCURRENCY,
    summary,
    results,
  });
}
