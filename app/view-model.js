const CONTEXT = new Set([
  'registration', 'routing', 'network_identity', 'internet_exposure',
  'scanner_activity', 'internet_noise', 'tor_exit', 'attack_knowledge',
]);
const CLAIM = new Set(['community_ioc_report', 'ransomware_post_reference', 'ransomware_victim_claim']);
const SKIPPED_FAILURES = new Set(['provider_call_budget_exhausted', 'request_deadline_exhausted', 'circuit_open']);

function labelize(value) {
  return String(value ?? 'unknown').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().toUpperCase();
}

function scalar(value) {
  if (value == null) return '—';
  if (typeof value === 'boolean') return value ? 'YES' : 'NO';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '—';
  if (typeof value === 'string') return value || '—';
  return null;
}

export function toFactRows(value, { limit = 24 } = {}) {
  const facts = [];
  const push = (label, item) => {
    if (facts.length >= limit) return;
    const simple = scalar(item);
    if (simple !== null) {
      facts.push({ label: labelize(label), value: simple });
      return;
    }
    if (Array.isArray(item)) {
      const simpleItems = item.map(scalar);
      if (simpleItems.every(entry => entry !== null)) {
        facts.push({ label: labelize(label), value: simpleItems.join(', ') || '—' });
        return;
      }
      item.forEach((entry, index) => push(`${label} ${index + 1}`, entry));
      return;
    }
    if (item && typeof item === 'object') {
      for (const [key, nested] of Object.entries(item)) push(label ? `${label} ${key}` : key, nested);
    }
  };

  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const [key, item] of Object.entries(value)) push(key, item);
  } else {
    push('value', value);
  }
  return facts;
}

function riskAxis(name, value) {
  if (value == null) return { display: 'UNAVAILABLE', facts: [] };
  if (name === 'kev' && typeof value?.listed === 'boolean') {
    return { display: value.listed ? 'LISTED' : 'NOT LISTED', facts: toFactRows(value) };
  }
  if (name === 'epss' && value?.score != null) return { display: String(value.score), facts: toFactRows(value) };
  if (name === 'cvss' && value?.score != null) return { display: String(value.score), facts: toFactRows(value) };
  const facts = toFactRows(value);
  return { display: facts[0]?.value ?? 'AVAILABLE', facts };
}

function normalizedCorrelationItem(item, index, kind) {
  const source = item && typeof item === 'object' ? item : { value: item };
  const providers = Array.isArray(source.providers) ? source.providers.filter(Boolean) : [];
  const title = providers.length
    ? `${providers.join(' + ')} // ${labelize(source.kind ?? kind)}`
    : `${kind.toUpperCase()} ${index + 1}`;
  return { title, facts: toFactRows(source) };
}

function failureCopy(reason, status) {
  if (reason === 'timeout') return { label: 'UPSTREAM TIMEOUT', summary: 'Upstream provider timed out before returning evidence.' };
  if (reason === 'http_error') return { label: `UPSTREAM HTTP ${status ?? 'ERROR'}`, summary: 'Upstream provider returned an HTTP error; no evidence was inferred from the failure.' };
  if (reason === 'provider_call_budget_exhausted') return { label: 'NOT RUN / CALL BUDGET', summary: 'Provider was not called because the bounded request call budget was exhausted.' };
  if (reason === 'request_deadline_exhausted') return { label: 'NOT RUN / DEADLINE', summary: 'Provider was not run because the bounded request deadline was exhausted.' };
  if (reason === 'circuit_open') return { label: 'NOT RUN / CIRCUIT OPEN', summary: 'Provider was skipped because its bounded circuit breaker is open after recent upstream failures.' };
  if (reason === 'rate_limited') return { label: 'UPSTREAM RATE LIMITED', summary: 'Upstream provider rejected the request due to rate limiting.' };
  if (reason === 'provider_transport_error') return { label: 'UPSTREAM TRANSPORT ERROR', summary: 'Provider transport failed before a usable evidence response was received.' };
  if (reason === 'provider_error') return { label: 'UPSTREAM PROVIDER ERROR', summary: 'Provider failed without producing usable evidence.' };
  return { label: labelize(reason), summary: 'Provider did not produce usable evidence; the failure remains explicit and is not treated as negative evidence.' };
}

function normalizeFailure(failure) {
  const source = failure && typeof failure === 'object' ? failure : { reason: String(failure ?? 'unknown') };
  const reason = source.reason ?? source.error ?? 'unknown';
  const status = source.status ?? null;
  const copy = failureCopy(reason, status);
  const state = SKIPPED_FAILURES.has(reason) ? 'skipped' : 'failed';
  const details = [];
  if (status != null) details.push({ label: 'HTTP STATUS', value: String(status) });
  if (source.attempts != null) details.push({ label: 'ATTEMPTS', value: String(source.attempts) });
  if (source.retryAfter != null) details.push({ label: 'RETRY AFTER', value: String(source.retryAfter) });
  if (source.retryAfterMs != null) details.push({ label: 'RETRY AFTER', value: `${source.retryAfterMs} ms` });
  if (source.retrievedAt) details.push({ label: 'RECORDED', value: String(source.retrievedAt) });
  return {
    provider: source.provider ?? 'unknown-provider',
    state,
    reason,
    status,
    label: copy.label,
    summary: copy.summary,
    details,
  };
}

export function buildOverview(envelope) {
  const summary = envelope.providerSummary || {};
  const ok = summary.ok ?? 0;
  const failed = summary.failed ?? 0;
  const skipped = summary.skipped ?? 0;
  const coverage = `${ok} succeeded · ${failed} failed · ${skipped} not run · ${summary.cached ?? 0} cached`;
  const limitations = [];
  if (failed) limitations.push(`${failed} provider${failed === 1 ? '' : 's'} failed; treat coverage as incomplete.`);
  if (skipped) limitations.push(`${skipped} provider${skipped === 1 ? '' : 's'} did not run; absence from those sources is unknown.`);
  return {
    indicator: envelope.indicator,
    type: envelope.type,
    requestId: envelope.requestId,
    profile: envelope.profile,
    status: envelope.status,
    tone: envelope.status === 'ok' ? 'green' : envelope.status === 'partial' ? 'amber' : 'red',
    durationMs: envelope.durationMs,
    budget: envelope.budget || null,
    providerSummary: summary,
    coverage,
    limitations,
    freshness: envelope.correlation?.freshness || 'unknown',
    huntability: envelope.correlation?.huntability || null,
    decision: envelope.decision || null,
  };
}

export function buildEvidence(envelope) {
  return (envelope.evidence || []).map((item) => {
    const kind = item.observation?.kind || 'unknown';
    const semanticClass = CONTEXT.has(kind) ? 'context' : CLAIM.has(kind) ? 'claim' : 'evidence';
    return {
      provider: item.provider,
      kind,
      verdict: item.observation?.verdict ?? null,
      semanticClass,
      semanticNote: semanticClass === 'claim' ? 'Reported/claimed evidence; not proof of compromise.' : '',
      confidence: item.observation?.confidence ?? null,
      firstSeen: item.observation?.firstSeen ?? null,
      lastSeen: item.observation?.lastSeen ?? null,
      attributeFacts: toFactRows(item.observation?.attributes ?? {}),
      tags: (item.observation?.tags ?? []).map(value => scalar(value) ?? String(value)),
      malwareFamily: item.observation?.malwareFamily ?? null,
      actorFacts: item.observation?.actor ? toFactRows(item.observation.actor) : [],
      references: item.references ?? [],
      cacheState: item.cacheState ?? null,
      retrievedAt: item.retrievedAt ?? null,
      parserVersion: item.integrity?.parserVersion ?? null,
      fingerprint: item.integrity?.fingerprint ?? null,
    };
  });
}

export function buildCorrelation(envelope) {
  const correlation = envelope.correlation || {};
  return {
    corroboration: (correlation.corroboration || []).map((item, index) => normalizedCorrelationItem(item, index, 'corroboration')),
    contradictions: (correlation.contradictions || []).map((item, index) => normalizedCorrelationItem(item, index, 'contradiction')),
    freshness: correlation.freshness || 'unknown',
    huntability: correlation.huntability || null,
    riskAxes: {
      kev: riskAxis('kev', correlation.riskAxes?.kev ?? null),
      epss: riskAxis('epss', correlation.riskAxes?.epss ?? null),
      cvss: riskAxis('cvss', correlation.riskAxes?.cvss ?? null),
    },
    attributionConfidence: correlation.attributionConfidence ?? null,
  };
}

export function buildRelationships(envelope) {
  return (envelope.relationships || envelope.correlation?.relationships || []).map((item, index) => ({
    title: `RELATIONSHIP ${index + 1}`,
    facts: toFactRows(item),
  }));
}

export function buildCoverage(envelope) {
  const summary = envelope.providerSummary || {};
  const ok = summary.ok ?? 0;
  const failed = summary.failed ?? 0;
  const skipped = summary.skipped ?? 0;
  const cached = summary.cached ?? 0;
  return {
    failures: (envelope.failures || []).map(normalizeFailure),
    summary,
    summaryText: `${ok} succeeded · ${failed} failed · ${skipped} not run · ${cached} cached`,
  };
}

export function jsonLines(envelope) {
  return JSON.stringify(envelope, null, 2)
    .split('\n')
    .map((text, index) => ({ number: index + 1, text }));
}
