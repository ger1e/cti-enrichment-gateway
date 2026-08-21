export class CircuitBreaker {
  constructor({
    failureThreshold = 3,
    openMs = 60_000,
    maxProviders = 128,
    now = () => Date.now(),
  } = {}) {
    if (!Number.isInteger(failureThreshold) || failureThreshold < 1) throw new TypeError('failureThreshold must be positive');
    if (!Number.isFinite(openMs) || openMs < 1) throw new TypeError('openMs must be positive');
    if (!Number.isInteger(maxProviders) || maxProviders < 1) throw new TypeError('maxProviders must be positive');
    this.failureThreshold = failureThreshold;
    this.openMs = openMs;
    this.maxProviders = maxProviders;
    this.now = now;
    this.map = new Map();
  }

  #touch(name, create = true) {
    let state = this.map.get(name);
    if (!state && create) {
      while (this.map.size >= this.maxProviders) this.map.delete(this.map.keys().next().value);
      state = { consecutiveFailures: 0, openUntil: 0, lastFailureAt: null, lastSuccessAt: null, retryAfter: null };
      this.map.set(name, state);
      return state;
    }
    if (state) {
      this.map.delete(name);
      this.map.set(name, state);
    }
    return state;
  }

  canRun(name) {
    const state = this.#touch(name, false);
    if (!state) return { allowed: true, retryAfterMs: 0 };
    const now = this.now();
    if (state.openUntil > now) return { allowed: false, retryAfterMs: state.openUntil - now };
    if (state.openUntil) {
      state.openUntil = 0;
      state.consecutiveFailures = 0;
      state.retryAfter = null;
    }
    return { allowed: true, retryAfterMs: 0 };
  }

  recordSuccess(name) {
    const state = this.#touch(name);
    state.consecutiveFailures = 0;
    state.openUntil = 0;
    state.retryAfter = null;
    state.lastSuccessAt = this.now();
  }

  recordFailure(name, { retryable = false, retryAfter = null } = {}) {
    const state = this.#touch(name);
    state.lastFailureAt = this.now();
    state.retryAfter = retryAfter == null ? null : String(retryAfter);
    if (!retryable) {
      state.consecutiveFailures = 0;
      return;
    }
    state.consecutiveFailures += 1;
    if (state.consecutiveFailures >= this.failureThreshold) {
      state.openUntil = this.now() + this.openMs;
    }
  }

  state(name) {
    const state = this.#touch(name, false);
    if (!state) return { consecutiveFailures: 0, open: false, openUntil: null, lastFailureAt: null, lastSuccessAt: null, retryAfter: null };
    const open = state.openUntil > this.now();
    return Object.freeze({
      consecutiveFailures: state.consecutiveFailures,
      open,
      openUntil: open ? state.openUntil : null,
      lastFailureAt: state.lastFailureAt,
      lastSuccessAt: state.lastSuccessAt,
      retryAfter: state.retryAfter,
    });
  }

  stats() {
    const now = this.now();
    let open = 0;
    for (const state of this.map.values()) if (state.openUntil > now) open += 1;
    return Object.freeze({ providers: this.map.size, open });
  }
}
