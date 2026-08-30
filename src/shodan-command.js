import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { requireGatewayAuth } from './core/auth.js';
import { securityHeaders } from './core/http.js';

const MAX_BODY_BYTES = 4 * 1024;
const MAX_UPSTREAM_RESPONSE_BYTES = 4 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_QUERY_LENGTH = 1024;
const MAX_FACETS_LENGTH = 256;
const MAX_MATCHES = 50;
const MAX_SERVICES = 50;
const MAX_DOMAIN_RECORDS = 100;
const MAX_LIST = 200;
const COMMANDS = new Set(['host', 'search', 'count', 'stats', 'domain', 'info']);
const FACET = /^[a-z0-9_.-]{1,64}(?::(?:[1-9]\d{0,2}))?$/i;
const DOMAIN_LABEL = /^(?!-)[a-z0-9-]{1,63}(?<!-)$/i;

function response(status, body, extraHeaders = {}) {
  return {
    status,
    headers: { ...securityHeaders(), 'cache-control': 'no-store', ...extraHeaders },
    body,
  };
}

function errorResponse(status, error, requestId = null) {
  return response(status, { error, ...(requestId ? { requestId } : {}) });
}

function headerValue(headers, name) {
  if (!headers) return undefined;
  if (typeof headers.get === 'function') return headers.get(name) ?? undefined;
  return headers[name] ?? headers[name.toLowerCase()] ?? headers[name.toUpperCase()];
}

function isJsonMediaType(value) {
  const mediaType = String(value || '').split(';', 1)[0].trim().toLowerCase();
  return mediaType === 'application/json' || mediaType.endsWith('+json');
}

function parseBody(request) {
  const contentLength = Number(headerValue(request.headers, 'content-length'));
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) throw Object.assign(new Error('payload_too_large'), { status: 413 });
  let body = request.body;
  if (typeof body === 'string') {
    if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) throw Object.assign(new Error('payload_too_large'), { status: 413 });
    try { body = JSON.parse(body); } catch { throw Object.assign(new Error('invalid_request'), { status: 400 }); }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw Object.assign(new Error('invalid_request'), { status: 400 });
  if (Buffer.byteLength(JSON.stringify(body), 'utf8') > MAX_BODY_BYTES) throw Object.assign(new Error('payload_too_large'), { status: 413 });
  return body;
}

function validDomain(value) {
  if (typeof value !== 'string') return false;
  const domain = value.trim().toLowerCase().replace(/\.$/, '');
  if (!domain || domain.length > 253 || domain.includes('..')) return false;
  const labels = domain.split('.');
  return labels.length >= 2 && labels.every(label => DOMAIN_LABEL.test(label));
}

function validFacets(value) {
  if (typeof value !== 'string' || value.length < 1 || value.length > MAX_FACETS_LENGTH) return false;
  const items = value.split(',');
  return items.length <= 16 && items.every(item => FACET.test(item));
}

function cleanText(value, max = 256) {
  if (value === undefined || value === null) return null;
  return String(value).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) || null;
}

function cleanList(value, limit = MAX_LIST, maxText = 256) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, limit).map(item => cleanText(item, maxText)).filter(Boolean);
}

function cleanNumber(value) {
  return Number.isFinite(value) ? value : null;
}

function normalizeFacets(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).slice(0, 32).map(([name, rows]) => [
    cleanText(name, 64) || 'unknown',
    Array.isArray(rows) ? rows.slice(0, 50).map(row => ({
      value: cleanText(row?.value, 256),
      count: Number.isSafeInteger(row?.count) && row.count >= 0 ? row.count : 0,
    })) : [],
  ]));
}

function normalizeService(item) {
  return {
    port: Number.isSafeInteger(item?.port) ? item.port : null,
    transport: cleanText(item?.transport, 16),
    product: cleanText(item?.product, 128),
    version: cleanText(item?.version, 128),
    timestamp: cleanText(item?.timestamp, 64),
    asn: cleanText(item?.asn, 64),
    organization: cleanText(item?.org, 256),
    hostnames: cleanList(item?.hostnames, 16, 253),
    domains: cleanList(item?.domains, 16, 253),
    httpTitle: cleanText(item?.http?.title, 256),
    sslSubject: cleanText(item?.ssl?.cert?.subject?.CN ?? item?.ssl?.cert?.subject?.commonName, 256),
  };
}

function vulnerabilityNames(value) {
  if (Array.isArray(value)) return cleanList(value, MAX_LIST, 64);
  if (value && typeof value === 'object') return Object.keys(value).slice(0, MAX_LIST).map(item => cleanText(item, 64)).filter(Boolean);
  return [];
}

function normalizeHost(raw) {
  return {
    ip: cleanText(raw?.ip_str, 64),
    organization: cleanText(raw?.org, 256),
    isp: cleanText(raw?.isp, 256),
    asn: cleanText(raw?.asn, 64),
    countryCode: cleanText(raw?.country_code, 8),
    countryName: cleanText(raw?.country_name, 128),
    city: cleanText(raw?.city, 128),
    os: cleanText(raw?.os, 128),
    lastUpdate: cleanText(raw?.last_update, 64),
    ports: Array.isArray(raw?.ports) ? raw.ports.filter(Number.isSafeInteger).slice(0, MAX_LIST) : [],
    hostnames: cleanList(raw?.hostnames, MAX_LIST, 253),
    domains: cleanList(raw?.domains, MAX_LIST, 253),
    tags: cleanList(raw?.tags, MAX_LIST, 128),
    vulnerabilities: vulnerabilityNames(raw?.vulns),
    services: Array.isArray(raw?.data) ? raw.data.slice(0, MAX_SERVICES).map(normalizeService) : [],
  };
}

function normalizeSearch(raw) {
  return {
    total: Number.isSafeInteger(raw?.total) && raw.total >= 0 ? raw.total : 0,
    matches: Array.isArray(raw?.matches) ? raw.matches.slice(0, MAX_MATCHES).map(normalizeService).map((item, index) => ({
      ...item,
      ip: cleanText(raw.matches[index]?.ip_str, 64),
      location: {
        countryCode: cleanText(raw.matches[index]?.location?.country_code, 8),
        countryName: cleanText(raw.matches[index]?.location?.country_name, 128),
        city: cleanText(raw.matches[index]?.location?.city, 128),
      },
    })) : [],
  };
}

function normalizeCount(raw) {
  return {
    total: Number.isSafeInteger(raw?.total) && raw.total >= 0 ? raw.total : 0,
    facets: normalizeFacets(raw?.facets),
  };
}

function normalizeDomain(raw) {
  return {
    domain: cleanText(raw?.domain, 253),
    tags: cleanList(raw?.tags, MAX_LIST, 128),
    subdomains: cleanList(raw?.subdomains, MAX_LIST, 253),
    more: Boolean(raw?.more),
    records: Array.isArray(raw?.data) ? raw.data.slice(0, MAX_DOMAIN_RECORDS).map(item => ({
      subdomain: cleanText(item?.subdomain, 253),
      type: cleanText(item?.type, 32),
      value: cleanText(item?.value, 512),
      lastSeen: cleanText(item?.last_seen, 64),
    })) : [],
  };
}

function normalizeInfo(raw) {
  return {
    plan: cleanText(raw?.plan, 128),
    queryCredits: cleanNumber(raw?.query_credits),
    scanCredits: cleanNumber(raw?.scan_credits),
    monitoredIps: cleanNumber(raw?.monitored_ips),
    unlocked: Boolean(raw?.unlocked),
    usageLimits: raw?.usage_limits && typeof raw.usage_limits === 'object' && !Array.isArray(raw.usage_limits)
      ? Object.fromEntries(Object.entries(raw.usage_limits).slice(0, 32).map(([key, value]) => [cleanText(key, 64) || 'unknown', cleanNumber(value) ?? cleanText(value, 128)]))
      : {},
  };
}

function validateRequest(body) {
  const allowed = new Set(['command', 'target', 'query', 'facets']);
  if (Object.keys(body).some(key => !allowed.has(key))) throw new Error('unsupported_request_field');
  const command = typeof body.command === 'string' ? body.command.trim().toLowerCase() : '';
  if (!COMMANDS.has(command)) throw new Error('invalid_shodan_command');

  const target = body.target === undefined || body.target === null ? null : String(body.target).trim();
  const query = body.query === undefined || body.query === null ? null : String(body.query).trim();
  const facets = body.facets === undefined || body.facets === null ? null : String(body.facets).trim();

  if (target && /[\u0000-\u001f\u007f]/.test(target)) throw new Error('invalid_target');
  if (query && (query.length > MAX_QUERY_LENGTH || /[\u0000-\u001f\u007f]/.test(query))) throw new Error('invalid_query');
  if (facets && !validFacets(facets)) throw new Error('invalid_facets');

  if (command === 'host') {
    if (!target || !isIP(target) || query || facets) throw new Error('invalid_host_request');
  } else if (command === 'domain') {
    if (!target || !validDomain(target) || query || facets) throw new Error('invalid_domain_request');
  } else if (command === 'info') {
    if (target || query || facets) throw new Error('invalid_info_request');
  } else if (command === 'search' || command === 'count') {
    if (!query || target || facets) throw new Error(`invalid_${command}_request`);
  } else if (command === 'stats') {
    if (!query || target) throw new Error('invalid_stats_request');
  }

  return { command, target, query, facets };
}

function buildUpstream(scan, key) {
  const url = new URL('https://api.shodan.io');
  if (scan.command === 'host') url.pathname = `/shodan/host/${encodeURIComponent(scan.target)}`;
  else if (scan.command === 'search') url.pathname = '/shodan/host/search';
  else if (scan.command === 'count' || scan.command === 'stats') url.pathname = '/shodan/host/count';
  else if (scan.command === 'domain') url.pathname = `/dns/domain/${encodeURIComponent(scan.target.toLowerCase().replace(/\.$/, ''))}`;
  else url.pathname = '/api-info';
  url.searchParams.set('key', key);
  if (scan.command === 'host') url.searchParams.set('minify', 'false');
  if (scan.command === 'search') url.searchParams.set('minify', 'true');
  if (scan.query) url.searchParams.set('query', scan.query);
  if (scan.command === 'stats' && scan.facets) url.searchParams.set('facets', scan.facets);
  return url;
}

function creditImpact(command) {
  if (command === 'domain') return 'consumes_query_credit';
  if (command === 'search') return 'may_consume_query_credit';
  return 'none';
}

function normalizePayload(command, raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('invalid_shodan_response');
  if (command === 'host') return normalizeHost(raw);
  if (command === 'search') return normalizeSearch(raw);
  if (command === 'count' || command === 'stats') return normalizeCount(raw);
  if (command === 'domain') return normalizeDomain(raw);
  return normalizeInfo(raw);
}

async function readUpstreamJson(upstream) {
  const declared = Number(upstream.headers?.get?.('content-length'));
  if (Number.isFinite(declared) && declared > MAX_UPSTREAM_RESPONSE_BYTES) throw new Error('shodan_response_too_large');
  const bytes = new Uint8Array(await upstream.arrayBuffer());
  if (bytes.byteLength > MAX_UPSTREAM_RESPONSE_BYTES) throw new Error('shodan_response_too_large');
  try { return JSON.parse(new TextDecoder().decode(bytes)); }
  catch { throw new Error('invalid_shodan_response'); }
}

export function createShodanCommandHandler({
  env = process.env,
  fetchImpl = fetch,
  nowMs = () => Date.now(),
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  return async function handleShodanCommand(request) {
    if (request?.method !== 'POST') return errorResponse(405, 'method_not_allowed');
    if (!requireGatewayAuth(request, env.PARA11AX_TOKEN)) return errorResponse(401, 'unauthorized');
    const contentType = headerValue(request.headers, 'content-type');
    if (contentType && !isJsonMediaType(contentType)) return errorResponse(415, 'unsupported_media_type');
    if (!env.SHODAN_API_KEY) return errorResponse(503, 'shodan_unconfigured');

    let body;
    try { body = parseBody(request); }
    catch (error) { return errorResponse(error.status ?? 400, error.message === 'payload_too_large' ? 'payload_too_large' : 'invalid_request'); }

    let scan;
    try { scan = validateRequest(body); }
    catch (error) { return errorResponse(400, error.message); }

    const requestId = randomUUID();
    const url = buildUpstream(scan, env.SHODAN_API_KEY);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1000, Math.min(30_000, timeoutMs)));
    const started = nowMs();

    try {
      const upstream = await fetchImpl(url.toString(), {
        method: 'GET',
        headers: { accept: 'application/json' },
        redirect: 'error',
        cache: 'no-store',
        signal: controller.signal,
      });
      if (!upstream.ok) {
        if (upstream.status === 429) return errorResponse(429, 'shodan_rate_limited', requestId);
        if (upstream.status === 401 || upstream.status === 403) return errorResponse(502, 'shodan_auth_failed', requestId);
        if (upstream.status === 404) return errorResponse(404, 'shodan_no_result', requestId);
        return errorResponse(502, 'shodan_upstream_error', requestId);
      }
      const raw = await readUpstreamJson(upstream);
      const data = normalizePayload(scan.command, raw);
      return response(200, {
        requestId,
        source: 'shodan',
        command: scan.command,
        input: {
          ...(scan.target ? { target: scan.target } : {}),
          ...(scan.query ? { query: scan.query } : {}),
          ...(scan.facets ? { facets: scan.facets } : {}),
        },
        creditImpact: creditImpact(scan.command),
        data,
        durationMs: Math.max(0, Math.round(nowMs() - started)),
      });
    } catch (error) {
      if (error?.name === 'AbortError') return errorResponse(504, 'shodan_timeout', requestId);
      if (error?.message === 'shodan_response_too_large') return errorResponse(502, 'shodan_response_too_large', requestId);
      if (error?.message === 'invalid_shodan_response') return errorResponse(502, 'invalid_shodan_response', requestId);
      return errorResponse(502, 'shodan_unavailable', requestId);
    } finally {
      clearTimeout(timer);
    }
  };
}
