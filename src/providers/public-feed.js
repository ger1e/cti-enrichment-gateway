import { BoundedCache } from '../core/cache.js';

const DEFAULT_FEED_CACHE = new BoundedCache({ maxEntries: 64 });
const TRANSIENT_HTTP = new Set([502, 503, 504]);
const defaultSleep = ms => new Promise(resolve => setTimeout(resolve, ms));

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

async function fetchTextWithRetry(url, options = {}, {
  sleep = defaultSleep,
  retryDelayMs = 150,
} = {}) {
  try {
    return await fetchText(url, options);
  } catch (error) {
    if (!TRANSIENT_HTTP.has(Number(error?.status)) || options.signal?.aborted) throw error;
    await sleep(Math.max(0, retryDelayMs));
    if (options.signal?.aborted) throw Object.assign(new Error('provider request aborted'), { name: 'AbortError' });
    return fetchText(url, options);
  }
}

async function loadWithLegacyMap(store, url, loader, ttlMs, cache, now) {
  if (cache) {
    const cached = store.get(url);
    if (cached && cached.expiresAt > now) return cached.value;
  }
  const value = await loader();
  if (cache) store.set(url, { value, expiresAt: now + Math.max(1, ttlMs) });
  return value;
}

export async function loadTextFeed(url, context = {}, {
  ttlMs = 60 * 60 * 1000,
  maxBytes = 2_000_000,
  cache = true,
} = {}) {
  const store = context.feedCache ?? DEFAULT_FEED_CACHE;
  const loader = () => fetchTextWithRetry(url, {
    fetchImpl: context.fetchImpl,
    signal: context.signal,
    maxBytes,
  }, {
    sleep: context.sleep ?? defaultSleep,
  });

  if (store && typeof store.getOrLoad === 'function') {
    return store.getOrLoad(url, loader, {
      namespace: 'public-feed',
      ttlMs: Math.max(1, ttlMs),
      cache,
    });
  }

  const now = typeof context.nowMs === 'function' ? context.nowMs() : Date.now();
  return loadWithLegacyMap(store, url, loader, ttlMs, cache, now);
}

export function publicFeedCacheStats() {
  return DEFAULT_FEED_CACHE.stats();
}
