const PROFILES = new Set(['fast', 'standard', 'full']);
const ENRICHMENT_OBSERVERS = new Set();
let latestGatewayClient = null;

export class GatewayHttpError extends Error {
  constructor(status, code, requestId = null) {
    super(`gateway request failed: ${code || status}`);
    this.name = 'GatewayHttpError';
    this.status = status;
    this.code = code || 'request_failed';
    this.requestId = requestId;
  }
}

export function addGatewayEnrichmentObserver(observer) {
  if (typeof observer !== 'function') throw new TypeError('enrichment observer must be a function');
  ENRICHMENT_OBSERVERS.add(observer);
  return () => ENRICHMENT_OBSERVERS.delete(observer);
}

export function getLatestGatewayClient() {
  return latestGatewayClient;
}

async function notifyEnrichmentObservers(result) {
  for (const observer of [...ENRICHMENT_OBSERVERS]) {
    try {
      await observer(structuredClone(result));
    } catch {
      // Local observers must never alter or invalidate a successful gateway result.
    }
  }
}

function validEnvelope(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof value.requestId === 'string' &&
    typeof value.indicator === 'string' &&
    typeof value.type === 'string' &&
    PROFILES.has(value.profile) &&
    ['ok', 'partial', 'error'].includes(value.status) &&
    Array.isArray(value.evidence) &&
    Array.isArray(value.failures) &&
    Array.isArray(value.relationships) &&
    value.correlation &&
    typeof value.correlation === 'object'
  );
}

function validStix(value) {
  return Boolean(value && typeof value === 'object' && value.type === 'bundle' && Array.isArray(value.objects));
}

function validBatch(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof value.requestId === 'string' &&
    PROFILES.has(value.profile) &&
    Number.isInteger(value.inputCount) &&
    value.inputCount >= 1 &&
    Array.isArray(value.results)
  );
}

function validMeta(value) {
  return Boolean(value && typeof value === 'object' && typeof value.gatewayVersion === 'string' && Array.isArray(value.profiles) && value.limits && typeof value.limits === 'object');
}

function validUserScanner(value) {
  return Boolean(
    value &&
    typeof value === 'object' &&
    typeof value.scanId === 'string' &&
    ['email', 'username'].includes(value.scanType) &&
    typeof value.target === 'string' &&
    value.summary && typeof value.summary === 'object' &&
    Number.isInteger(value.summary.totalScanned) && value.summary.totalScanned >= 0 &&
    Number.isInteger(value.summary.found) && value.summary.found >= 0 &&
    Number.isInteger(value.summary.notFound) && value.summary.notFound >= 0 &&
    Number.isInteger(value.summary.errors) && value.summary.errors >= 0 &&
    Number.isInteger(value.summary.skipped) && value.summary.skipped >= 0 &&
    Array.isArray(value.results) &&
    Array.isArray(value.erroredSites) &&
    Number.isFinite(value.durationMs) && value.durationMs >= 0 &&
    value.source === 'user-scanner'
  );
}

export function createGatewayClient({ fetchImpl = fetch, getToken }) {
  if (typeof getToken !== 'function') throw new TypeError('getToken must be a function');
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');

  async function readJsonResponse(path, response, validate) {
    const isJson = response.headers.get('content-type')?.includes('application/json');
    let payload = null;
    if (isJson) {
      try {
        payload = await response.json();
      } catch {
        throw new GatewayHttpError(502, 'unexpected_response');
      }
    }
    if (!response.ok) throw new GatewayHttpError(response.status, payload?.error, payload?.requestId);
    if (!isJson) throw new GatewayHttpError(502, 'unexpected_response');
    if (validate && !validate(payload)) {
      const code = path === '/api/para11ax/stix' ? 'invalid_stix_bundle'
        : path === '/api/para11ax/batch' ? 'invalid_batch_envelope'
          : path === '/api/para11ax/meta' ? 'invalid_meta_envelope'
            : path === '/api/para11ax/user-scanner' ? 'invalid_user_scanner_envelope'
              : 'invalid_envelope';
      throw new GatewayHttpError(502, code);
    }
    return payload;
  }

  async function request(path, { method = 'GET', body, signal, validate } = {}) {
    if (!path.startsWith('/api/para11ax/')) throw new Error('same-origin PARA11AX API path required');
    const token = getToken();
    if (!token) throw new GatewayHttpError(401, 'unauthorized');

    const headers = { Authorization: `Bearer ${token}` };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const response = await fetchImpl(path, {
      method,
      headers,
      credentials: 'same-origin',
      cache: 'no-store',
      signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return readJsonResponse(path, response, validate);
  }

  async function publicRequest(path, { signal, validate } = {}) {
    if (!path.startsWith('/api/para11ax/')) throw new Error('same-origin PARA11AX API path required');
    const response = await fetchImpl(path, {
      method: 'GET',
      headers: {},
      credentials: 'same-origin',
      cache: 'no-store',
      signal,
    });
    return readJsonResponse(path, response, validate);
  }

  function requestPayload(indicator, profile) {
    if (!PROFILES.has(profile)) throw new TypeError('invalid profile');
    return { indicator: String(indicator), profile };
  }

  function batchPayload(indicators, profile) {
    if (!PROFILES.has(profile)) throw new TypeError('invalid profile');
    if (!Array.isArray(indicators) || indicators.length < 1 || indicators.length > 20 || indicators.some(value => typeof value !== 'string')) {
      throw new TypeError('batch accepts 1..20 strings');
    }
    return { indicators: [...indicators], profile };
  }

  function userScannerPayload(input) {
    if (!input || typeof input !== 'object') throw new TypeError('user-scanner request required');
    if (!['email', 'username'].includes(input.scanType)) throw new TypeError('invalid user-scanner scan type');
    const target = String(input.target || '').trim();
    if (!target) throw new TypeError('user-scanner target required');
    if (input.category && input.module) throw new TypeError('category and module are mutually exclusive');
    const payload = {
      scanType: input.scanType,
      target,
      crossScan: Boolean(input.crossScan),
      noNsfw: input.noNsfw !== false,
    };
    if (input.category) payload.category = String(input.category);
    if (input.module) payload.module = String(input.module);
    return payload;
  }

  const client = Object.freeze({
    meta: (signal) => publicRequest('/api/para11ax/meta', { signal, validate: validMeta }),
    health: (signal) => request('/api/para11ax/health', { signal }),
    status: (signal) => request('/api/para11ax/status', { signal }),
    enrich: async (indicator, profile, signal) => {
      const result = await request('/api/para11ax/enrich', {
        method: 'POST',
        body: requestPayload(indicator, profile),
        signal,
        validate: validEnvelope,
      });
      await notifyEnrichmentObservers(result);
      return result;
    },
    batch: async (indicators, profile, signal) => request('/api/para11ax/batch', {
      method: 'POST',
      body: batchPayload(indicators, profile),
      signal,
      validate: validBatch,
    }),
    stix: async (indicator, profile, signal) => request('/api/para11ax/stix', {
      method: 'POST',
      body: requestPayload(indicator, profile),
      signal,
      validate: validStix,
    }),
    userScanner: async (input, signal) => request('/api/para11ax/user-scanner', {
      method: 'POST',
      body: userScannerPayload(input),
      signal,
      validate: validUserScanner,
    }),
  });

  latestGatewayClient = client;
  return client;
}
