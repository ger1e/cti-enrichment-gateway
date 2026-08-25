const PROFILES = new Set(['fast', 'standard', 'full']);

export class GatewayHttpError extends Error {
  constructor(status, code, requestId = null) {
    super(`gateway request failed: ${code || status}`);
    this.name = 'GatewayHttpError';
    this.status = status;
    this.code = code || 'request_failed';
    this.requestId = requestId;
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
      const code = path === '/api/stix' ? 'invalid_stix_bundle'
        : path === '/api/batch' ? 'invalid_batch_envelope'
          : path === '/api/meta' ? 'invalid_meta_envelope'
            : 'invalid_envelope';
      throw new GatewayHttpError(502, code);
    }
    return payload;
  }

  async function request(path, { method = 'GET', body, signal, validate } = {}) {
    if (!path.startsWith('/api/')) throw new Error('same-origin API path required');
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
    if (!path.startsWith('/api/')) throw new Error('same-origin API path required');
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

  return Object.freeze({
    meta: (signal) => publicRequest('/api/meta', { signal, validate: validMeta }),
    health: (signal) => request('/api/health', { signal }),
    status: (signal) => request('/api/status', { signal }),
    enrich: async (indicator, profile, signal) => request('/api/enrich', {
      method: 'POST',
      body: requestPayload(indicator, profile),
      signal,
      validate: validEnvelope,
    }),
    batch: async (indicators, profile, signal) => request('/api/batch', {
      method: 'POST',
      body: batchPayload(indicators, profile),
      signal,
      validate: validBatch,
    }),
    stix: async (indicator, profile, signal) => request('/api/stix', {
      method: 'POST',
      body: requestPayload(indicator, profile),
      signal,
      validate: validStix,
    }),
  });
}
