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

export function createGatewayClient({ fetchImpl = fetch, getToken }) {
  if (typeof getToken !== 'function') throw new TypeError('getToken must be a function');
  if (typeof fetchImpl !== 'function') throw new TypeError('fetchImpl must be a function');

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

    const isJson = response.headers.get('content-type')?.includes('application/json');
    let payload = null;
    if (isJson) {
      try {
        payload = await response.json();
      } catch {
        throw new GatewayHttpError(502, 'unexpected_response');
      }
    }

    if (!response.ok) {
      throw new GatewayHttpError(response.status, payload?.error, payload?.requestId);
    }
    if (!isJson) throw new GatewayHttpError(502, 'unexpected_response');
    if (validate && !validate(payload)) {
      throw new GatewayHttpError(502, path === '/api/stix' ? 'invalid_stix_bundle' : 'invalid_envelope');
    }
    return payload;
  }

  function requestPayload(indicator, profile) {
    if (!PROFILES.has(profile)) throw new TypeError('invalid profile');
    return { indicator: String(indicator), profile };
  }

  return Object.freeze({
    health: (signal) => request('/api/health', { signal }),
    enrich: (indicator, profile, signal) => request('/api/enrich', {
      method: 'POST',
      body: requestPayload(indicator, profile),
      signal,
      validate: validEnvelope,
    }),
    stix: (indicator, profile, signal) => request('/api/stix', {
      method: 'POST',
      body: requestPayload(indicator, profile),
      signal,
      validate: validStix,
    }),
  });
}
