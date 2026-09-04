function policyError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function normalizedHttpError(response) {
  const error = new Error('provider_http_error');
  error.status = Number(response?.status) || 502;
  error.retryAfter = response?.headers?.get?.('retry-after') ?? null;
  return error;
}

function transportError(error) {
  if (error?.code && String(error.code).startsWith('egress_')) return error;
  if (error?.message === 'provider_response_too_large') return error;
  if (error?.message === 'provider_request_too_large') return error;
  if (error?.message === 'provider_http_error') return error;
  const safe = new Error('provider_transport_error');
  if (error?.name === 'AbortError') safe.name = 'AbortError';
  if (Number.isInteger(error?.status)) safe.status = error.status;
  if (error?.retryAfter != null) safe.retryAfter = String(error.retryAfter);
  return safe;
}

function bodyBytes(body) {
  if (body == null) return 0;
  if (typeof body === 'string') return Buffer.byteLength(body, 'utf8');
  if (Buffer.isBuffer(body) || body instanceof Uint8Array) return body.byteLength;
  return null;
}

function exactHostAllowed(hostname, fixedHosts) {
  const host = hostname.toLowerCase();
  return fixedHosts.some(value => String(value).toLowerCase() === host);
}

function responseView(response, text) {
  return Object.freeze({
    ok: Boolean(response?.ok),
    status: Number(response?.status) || 0,
    statusText: response?.statusText ?? '',
    headers: response?.headers ?? new Headers(),
    text: async () => text,
    json: async () => text ? JSON.parse(text) : null,
  });
}

async function readBoundedText(response, maxBytes) {
  const reader = response?.body?.getReader?.();
  if (!reader) {
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > maxBytes) {
      throw Object.assign(new Error('provider_response_too_large'), { status: 502 });
    }
    return text;
  }

  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value ?? 0);
      if (total + chunk.byteLength > maxBytes) {
        try { await reader.cancel(); } catch {}
        throw Object.assign(new Error('provider_response_too_large'), { status: 502 });
      }
      chunks.push(chunk);
      total += chunk.byteLength;
    }
  } finally {
    try { reader.releaseLock?.(); } catch {}
  }

  const body = Buffer.allocUnsafe(total);
  let offset = 0;
  for (const chunk of chunks) {
    Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength).copy(body, offset);
    offset += chunk.byteLength;
  }
  return body.toString('utf8');
}

export async function safeFetch(url, policy = {}, options = {}) {
  let target;
  try {
    target = url instanceof URL ? new URL(url.href) : new URL(String(url));
  } catch {
    throw policyError('egress_invalid_url');
  }

  const protocols = Array.isArray(policy.protocols) && policy.protocols.length ? policy.protocols : ['https:'];
  const fixedHosts = Array.isArray(policy.fixedHosts) ? policy.fixedHosts : [];
  const methods = Array.isArray(policy.methods) && policy.methods.length ? policy.methods.map(value => String(value).toUpperCase()) : ['GET'];
  const method = String(options.method ?? 'GET').toUpperCase();
  const maxResponseBytes = Number.isFinite(policy.maxResponseBytes) && policy.maxResponseBytes > 0
    ? policy.maxResponseBytes
    : 2_000_000;
  const requestedMax = Number.isFinite(options.maxBytes) && options.maxBytes > 0 ? options.maxBytes : maxResponseBytes;
  const responseLimit = Math.min(maxResponseBytes, requestedMax);
  const maxRequestBytes = Number.isFinite(policy.maxRequestBytes) && policy.maxRequestBytes >= 0
    ? policy.maxRequestBytes
    : 1_000_000;

  if (!protocols.includes(target.protocol)) throw policyError('egress_protocol_not_allowed');
  if (!fixedHosts.length || !exactHostAllowed(target.hostname, fixedHosts)) throw policyError('egress_host_not_allowed');
  if (target.port) throw policyError('egress_port_not_allowed');
  if (target.username || target.password) throw policyError('egress_userinfo_not_allowed');
  if (!methods.includes(method)) throw policyError('egress_method_not_allowed');

  const outboundBytes = bodyBytes(options.body);
  if (options.body != null && outboundBytes == null) throw policyError('egress_request_body_unsupported');
  if (outboundBytes != null && outboundBytes > maxRequestBytes) {
    throw Object.assign(new Error('provider_request_too_large'), { status: 413 });
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  let response;
  try {
    response = await fetchImpl(target.href, {
      method,
      signal: options.signal,
      headers: options.headers ?? {},
      body: options.body,
      redirect: 'error',
    });

    const declared = Number(response?.headers?.get?.('content-length'));
    if (Number.isFinite(declared) && declared > responseLimit) {
      throw Object.assign(new Error('provider_response_too_large'), { status: 502 });
    }
    if (!response?.ok) throw normalizedHttpError(response);

    const text = await readBoundedText(response, responseLimit);
    return responseView(response, text);
  } catch (error) {
    throw transportError(error);
  }
}

export function egressPolicyForAdapter(adapter) {
  if (!adapter || typeof adapter !== 'object') throw new TypeError('adapter is required');
  return Object.freeze({
    fixedHosts: Object.freeze([...(adapter.fixedHosts ?? [])]),
    methods: Object.freeze([...(adapter.methods ?? ['GET'])]),
    protocols: Object.freeze([...(adapter.protocols ?? ['https:'])]),
    maxResponseBytes: adapter.maxResponseBytes,
    maxRequestBytes: adapter.maxRequestBytes ?? 1_000_000,
  });
}
