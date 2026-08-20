import { randomUUID } from 'node:crypto';
import { requireGatewayAuth } from './core/auth.js';
import { securityHeaders } from './core/http.js';
import { classifyIndicator } from './core/validate.js';
import { TtlCache } from './core/cache.js';
import { createProviderRegistry } from './core/provider-registry.js';
import { enrich } from './core/orchestrator.js';
import { rdapProvider } from './providers/rdap.js';
import { epssProvider } from './providers/epss.js';
import { cisaKevProvider } from './providers/cisa-kev.js';
import { WORKFLOWS } from './workflows.js';

const MAX_BODY_BYTES = 16 * 1024;

const PROVIDER_SECRETS = Object.freeze({
  abusech: 'ABUSECH_API_KEY',
  abuseipdb: 'ABUSEIPDB_API_KEY',
  greynoise: 'GREYNOISE_API_KEY',
  virustotal: 'VIRUSTOTAL_API_KEY',
  'hybrid-analysis': 'HYBRID_ANALYSIS_API_KEY',
  urlscan: 'URLSCAN_API_KEY',
  webamon: 'WEBAMON_API_KEY',
  otx: 'OTX_API_KEY',
  shodan: 'SHODAN_API_KEY',
  censys: 'CENSYS_PAT',
  ipinfo: 'IPINFO_TOKEN',
  malpedia: 'MALPEDIA_API_TOKEN',
  pulsedive: 'PULSEDIVE_API_KEY',
  nvd: 'NVD_API_KEY',
  'cloudflare-radar': 'CLOUDFLARE_RADAR_TOKEN',
  sentry: 'SENTRY_AUTH_TOKEN',
});

const NO_KEY_PROVIDERS = Object.freeze(['rdap', 'ripestat', 'epss', 'cisa-kev', 'osv', 'circl-hashlookup', 'mitre-attack']);

function response(status, body, extraHeaders = {}) {
  return { status, headers: { ...securityHeaders(), ...extraHeaders }, body };
}

function headerValue(headers, name) {
  if (!headers) return undefined;
  if (typeof headers.get === 'function') return headers.get(name) ?? undefined;
  return headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];
}

function parseBody(request) {
  const contentLength = Number(headerValue(request.headers, 'content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    const error = new Error('request body too large');
    error.status = 413;
    throw error;
  }

  let body = request.body;
  if (typeof body === 'string') {
    if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
      const error = new Error('request body too large');
      error.status = 413;
      throw error;
    }
    try { body = JSON.parse(body); } catch { throw Object.assign(new Error('invalid JSON body'), { status: 400 }); }
  }

  if (!body || typeof body !== 'object' || Array.isArray(body)) throw Object.assign(new Error('JSON object body required'), { status: 400 });
  if (Buffer.byteLength(JSON.stringify(body), 'utf8') > MAX_BODY_BYTES) throw Object.assign(new Error('request body too large'), { status: 413 });
  return body;
}

export function createApp({ env = process.env, fetchImpl = fetch, now = () => new Date().toISOString(), cache = new TtlCache(), gatewayVersion = env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || '1.0.0' } = {}) {
  const registry = createProviderRegistry([rdapProvider, cisaKevProvider, epssProvider]);

  return {
    async handleHealth(request) {
      if (request?.method && request.method !== 'GET') return response(405, { error: 'method_not_allowed' }, { allow: 'GET' });
      const providers = {};
      for (const name of NO_KEY_PROVIDERS) providers[name] = { configured: true, auth: 'none' };
      for (const [name, secretName] of Object.entries(PROVIDER_SECRETS)) providers[name] = { configured: Boolean(env[secretName]), auth: 'secret' };
      return response(200, {
        status: 'ok',
        version: gatewayVersion,
        gatewayAuthConfigured: Boolean(env.CTI_GATEWAY_TOKEN),
        providers,
        activeWorkflows: WORKFLOWS,
      });
    },

    async handleEnrich(request) {
      if (request?.method !== 'POST') return response(405, { error: 'method_not_allowed' }, { allow: 'POST' });
      if (!requireGatewayAuth(request, env.CTI_GATEWAY_TOKEN)) return response(401, { error: 'unauthorized' });

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
      if (body.type !== undefined && body.type !== classified.type) return response(400, { error: 'indicator_type_mismatch' });

      const providerNames = WORKFLOWS[classified.type];
      if (!providerNames) return response(400, { error: 'unsupported_indicator_type' });

      const result = await enrich({
        indicator: classified.value,
        type: classified.type,
        providerNames,
        registry,
        cache,
        requestId: randomUUID(),
        now,
        gatewayVersion,
        context: { fetchImpl },
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
