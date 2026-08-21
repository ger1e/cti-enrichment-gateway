function positiveInteger(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

function serializedBytes(value) {
  try {
    const json = JSON.stringify(value);
    return typeof json === 'string' ? Buffer.byteLength(json, 'utf8') : null;
  } catch {
    return null;
  }
}

export class BoundedCache {
  constructor({ maxEntries = 500, maxBytes = 32_000_000, now = () => Date.now() } = {}) {
    if (!Number.isInteger(maxEntries) || maxEntries < 1) throw new TypeError('maxEntries must be a positive integer');
    if (!Number.isInteger(maxBytes) || maxBytes < 1) throw new TypeError('maxBytes must be a positive integer');
    if (typeof now !== 'function') throw new TypeError('now must be a function');
    this.maxEntries = maxEntries;
    this.maxBytes = maxBytes;
    this.bytes = 0;
    this.now = now;
    this.map = new Map();
    this.inflight = new Map();
    this.counters = { hits: 0, misses: 0, evictions: 0, expirations: 0 };
  }

  #key(key, namespace = 'default') {
    return `${String(namespace)}\u0000${String(key)}`;
  }

  #remove(fullKey, { eviction = false, expiration = false } = {}) {
    const entry = this.map.get(fullKey);
    if (!entry) return false;
    this.map.delete(fullKey);
    this.bytes = Math.max(0, this.bytes - (Number(entry.bytes) || 0));
    if (eviction) this.counters.evictions += 1;
    if (expiration) this.counters.expirations += 1;
    return true;
  }

  #deleteExpired(fullKey, entry) {
    if (!entry || entry.expiresAt > this.now()) return false;
    this.#remove(fullKey, { expiration: true });
    return true;
  }

  get(key, { namespace = 'default' } = {}) {
    const fullKey = this.#key(key, namespace);
    const entry = this.map.get(fullKey);
    if (!entry || this.#deleteExpired(fullKey, entry)) {
      this.counters.misses += 1;
      return undefined;
    }
    this.map.delete(fullKey);
    this.map.set(fullKey, entry);
    this.counters.hits += 1;
    return entry.value;
  }

  set(key, value, ttlMs, { namespace = 'default' } = {}) {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) return false;
    const bytes = serializedBytes(value);
    if (bytes == null || bytes > this.maxBytes) return false;

    const fullKey = this.#key(key, namespace);
    if (this.map.has(fullKey)) this.#remove(fullKey);
    while (this.map.size >= this.maxEntries || this.bytes + bytes > this.maxBytes) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) return false;
      this.#remove(oldest, { eviction: true });
    }
    this.map.set(fullKey, { value, expiresAt: this.now() + ttlMs, bytes });
    this.bytes += bytes;
    return true;
  }

  async getOrLoad(key, loader, {
    namespace = 'default',
    ttlMs = 1000,
    cache = true,
  } = {}) {
    if (typeof loader !== 'function') throw new TypeError('loader must be a function');
    if (!cache) return loader();

    const cached = this.get(key, { namespace });
    if (cached !== undefined) return cached;

    const fullKey = this.#key(key, namespace);
    if (this.inflight.has(fullKey)) return this.inflight.get(fullKey);

    let loaded;
    try {
      loaded = loader();
    } catch (error) {
      throw error;
    }

    const promise = Promise.resolve(loaded)
      .then(value => {
        this.set(key, value, ttlMs, { namespace });
        return value;
      })
      .finally(() => {
        this.inflight.delete(fullKey);
      });
    this.inflight.set(fullKey, promise);
    return promise;
  }

  delete(key, { namespace = 'default' } = {}) {
    return this.#remove(this.#key(key, namespace));
  }

  clear() {
    this.map.clear();
    this.inflight.clear();
    this.bytes = 0;
  }

  stats() {
    return Object.freeze({
      entries: this.map.size,
      inflight: this.inflight.size,
      hits: this.counters.hits,
      misses: this.counters.misses,
      evictions: this.counters.evictions,
      expirations: this.counters.expirations,
      bytes: this.bytes,
      maxBytes: this.maxBytes,
    });
  }
}

export class TtlCache extends BoundedCache {
  constructor(options = {}) {
    super({ ...options, maxEntries: positiveInteger(options.maxEntries, 500) });
  }
}
