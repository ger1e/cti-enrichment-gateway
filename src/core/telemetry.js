const STRING_FIELDS = new Set(['event', 'requestId', 'type', 'provider', 'status', 'reason', 'profile', 'cacheState']);
const NUMBER_FIELDS = new Set(['durationMs', 'providerCalls', 'providerCallLimit', 'deadlineMs', 'retryAfterMs', 'attempts']);
const BOOLEAN_FIELDS = new Set(['deadlineExhausted', 'callBudgetExhausted']);
const MAX_STRING = 128;
const MAX_NUMBER = 1_000_000;

function boundedString(value) {
  if (typeof value !== 'string' || value.length === 0) return undefined;
  return value.slice(0, MAX_STRING);
}

function boundedNumber(value) {
  if (!Number.isFinite(value) || value < 0) return undefined;
  return Math.min(MAX_NUMBER, value);
}

function sanitize(input, includeIndicator) {
  if (!input || typeof input !== 'object') return null;
  const output = {};
  for (const key of STRING_FIELDS) {
    const value = boundedString(input[key]);
    if (value !== undefined) output[key] = value;
  }
  for (const key of NUMBER_FIELDS) {
    const value = boundedNumber(input[key]);
    if (value !== undefined) output[key] = value;
  }
  for (const key of BOOLEAN_FIELDS) if (typeof input[key] === 'boolean') output[key] = input[key];
  if (includeIndicator) {
    const indicator = boundedString(input.indicator);
    if (indicator !== undefined) output.indicator = indicator;
  }
  if (!output.event) return null;
  return Object.freeze(output);
}

function sortedCounts(map) {
  return Object.freeze(Object.fromEntries([...map.entries()].sort(([a], [b]) => a.localeCompare(b))));
}

export function createTelemetry({ sink = null, includeIndicator = false } = {}) {
  if (sink != null && typeof sink !== 'function') throw new TypeError('telemetry sink must be a function');
  let events = 0;
  let sinkErrors = 0;
  const byEvent = new Map();
  const byProvider = new Map();
  const byStatus = new Map();

  return Object.freeze({
    emit(input) {
      const event = sanitize(input, includeIndicator === true);
      if (!event) return false;
      events += 1;
      byEvent.set(event.event, (byEvent.get(event.event) ?? 0) + 1);
      if (event.provider) byProvider.set(event.provider, (byProvider.get(event.provider) ?? 0) + 1);
      if (event.status) byStatus.set(event.status, (byStatus.get(event.status) ?? 0) + 1);
      if (sink) {
        try { sink(event); } catch { sinkErrors += 1; }
      }
      return true;
    },
    stats() {
      return Object.freeze({
        events,
        sinkErrors,
        byEvent: sortedCounts(byEvent),
        byProvider: sortedCounts(byProvider),
        byStatus: sortedCounts(byStatus),
      });
    },
  });
}
