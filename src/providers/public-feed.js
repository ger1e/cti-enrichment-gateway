const DEFAULT_FEED_CACHE = new Map();

function httpError(response) {
  const error = new Error(`provider HTTP ${response.status}`);
  error.status = response.status;
  error.retryAfter = response.headers.get('retry-after');
  return error;
}

async function fetchText(url, {
  fetchImpl = fetch,
  signal,
  maxBytes = 2_000_000,
  headers = {},
} = {}) {
  const response = await fetchImpl(url, {
    method: 'GET',
    signal,
    headers: { accept: 'text/plain,*/*;q=0.1', ...headers },
    redirect: 'error',
  });
  if (!response.ok) throw httpError(response);
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw Object.assign(new Error('provider response too large'), { status: 502 });
  }
  const value = await response.text();
  if (Buffer.byteLength(value, 'utf8') > maxBytes) {
    throw Object.assign(new Error('provider response too large'), { status: 502 });
  }
  return value;
}

export async function loadTextFeed(url, context = {}, {
  ttlMs = 60 * 60 * 1000,
  maxBytes = 2_000_000,
} = {}) {
  const cache = context.feedCache ?? DEFAULT_FEED_CACHE;
  const now = typeof context.nowMs === 'function' ? context.nowMs() : Date.now();
  const cached = cache.get(url);
  if (cached && cached.expiresAt > now) return cached.value;

  const value = await fetchText(url, {
    fetchImpl: context.fetchImpl,
    signal: context.signal,
    maxBytes,
  });
  cache.set(url, { value, expiresAt: now + Math.max(1, ttlMs) });
  return value;
}
