import { createHash } from 'node:crypto';

function hashRaw(data) {
  return createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

function normalizeFailure(error, timedOut) {
  if (timedOut || error?.name === 'AbortError') return { reason: 'timeout' };
  if (error?.status === 429) return { reason: 'rate_limited', status: 429, retryAfter: error.retryAfter ?? null };
  if (Number.isInteger(error?.status)) return { reason: 'http_error', status: error.status };
  return { reason: 'provider_error' };
}

export async function runProvider(adapter, input, {
  timeoutMs = 5000,
  now = () => new Date().toISOString(),
  nowMs = () => Date.now(),
  context = {},
} = {}) {
  const controller = new AbortController();
  const started = nowMs();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const data = await adapter.run(input, { ...context, signal: controller.signal });
    const retrievedAt = now();
    return {
      ok: true,
      provider: adapter.name,
      data,
      retrievedAt,
      rawHash: hashRaw(data),
      durationMs: Math.max(0, nowMs() - started),
    };
  } catch (error) {
    return {
      ok: false,
      provider: adapter.name,
      failure: normalizeFailure(error, timedOut),
      retrievedAt: now(),
      durationMs: Math.max(0, nowMs() - started),
    };
  } finally {
    clearTimeout(timer);
  }
}
