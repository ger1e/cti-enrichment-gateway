import { providerSecretNames } from '../providers/manifest.js';

const MAX_VIOLATIONS = 64;
const STALE_AFTER_MS = 30 * 24 * 60 * 60 * 1000;
const ATTACK_ID = /^T\d{4}(?:\.\d{3})?$/;
const KNOWN_SECRET_IDENTIFIERS = Object.freeze([
  ...providerSecretNames(),
  'CTI_GATEWAY_TOKEN',
  'SENTRY_AUTH_TOKEN',
]);
const SECRET_VALUE_PATTERNS = [
  /\bsk-[A-Za-z0-9_-]{16,}\b/,
  /\bsntryu_[A-Za-z0-9_-]{16,}\b/,
  /\bAIza[A-Za-z0-9_-]{20,}\b/,
  /\bAKIA[A-Z0-9]{12,}\b/,
];

export class ReportQualityError extends Error {
  constructor(violations) {
    super(`report quality gate failed with ${violations.length} violation${violations.length === 1 ? '' : 's'}`);
    this.name = 'ReportQualityError';
    this.violations = violations;
  }
}

function add(violations, code, path) {
  if (violations.length < MAX_VIOLATIONS) violations.push({ code, path });
}

function strings(value, path = '$', output = []) {
  if (typeof value === 'string') {
    output.push({ value, path });
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => strings(item, `${path}[${index}]`, output));
  } else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) strings(item, `${path}.${key}`, output);
  }
  return output;
}

function safeReference(value) {
  if (typeof value !== 'string' || value.length < 1 || value.length > 2048) return false;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function canonicalObservable(item) {
  const type = String(item?.type ?? '').trim().toLowerCase();
  let value = String(item?.value ?? '').trim();
  if (['domain', 'hostname', 'dns'].includes(type)) value = value.toLowerCase();
  return `${type}\u0000${value}`;
}

function validDate(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function checkClaims(model, violations) {
  const evidenceIds = new Set((model.evidence ?? []).map(item => item.id));
  const collections = [
    ['keyFindings', model.keyFindings ?? []],
    ['suspiciousBehavior', model.suspiciousBehavior ?? []],
    ['huntOpportunities', model.huntOpportunities ?? []],
  ];
  for (const [name, claims] of collections) {
    claims.forEach((claim, index) => {
      const ids = Array.isArray(claim?.evidenceIds) ? claim.evidenceIds : [];
      const explicitNonObserved = ['INFERRED', 'CONTEXTUAL', 'CONTEXTUAL_NOT_OBSERVED'].includes(claim?.mappingState);
      if (ids.length === 0 && !explicitNonObserved) add(violations, 'orphan_claim', `${name}[${index}]`);
      for (const id of ids) if (!evidenceIds.has(id)) add(violations, 'orphan_claim', `${name}[${index}].evidenceIds`);
    });
  }
}

function checkEvidence(model, violations) {
  (model.evidence ?? []).forEach((item, index) => {
    const path = `evidence[${index}]`;
    if (typeof item?.provider !== 'string' || !item.provider || !validDate(item.retrievedAt) ||
        typeof item?.observation?.kind !== 'string' || !item.observation.kind ||
        typeof item?.integrity?.parserVersion !== 'string' || !item.integrity.parserVersion ||
        !/^[0-9a-f]{64}$/i.test(String(item?.integrity?.fingerprint ?? ''))) {
      add(violations, 'missing_provenance', path);
    }
    const first = item?.observation?.firstSeen;
    const last = item?.observation?.lastSeen;
    if ((first != null && !validDate(first)) || (last != null && !validDate(last)) ||
        (first != null && last != null && Date.parse(first) > Date.parse(last))) {
      add(violations, 'impossible_timestamp', `${path}.observation`);
    }
    if (validDate(item?.retrievedAt) && validDate(model.generatedAt) && Date.parse(item.retrievedAt) > Date.parse(model.generatedAt)) {
      add(violations, 'impossible_timestamp', `${path}.retrievedAt`);
    }
    for (const [refIndex, ref] of (Array.isArray(item?.references) ? item.references : []).entries()) {
      if (!safeReference(ref)) add(violations, 'unsafe_reference', `${path}.references[${refIndex}]`);
    }
  });
}

function checkFrameworks(model, violations) {
  (model.frameworks?.attack ?? []).forEach((item, index) => {
    if (!ATTACK_ID.test(String(item?.id ?? ''))) add(violations, 'malformed_attack_id', `frameworks.attack[${index}].id`);
  });
  (model.suspiciousBehavior ?? []).forEach((item, index) => {
    if (item?.state === 'OBSERVED' && ['CONTEXTUAL', 'CONTEXTUAL_NOT_OBSERVED'].includes(item?.mappingState)) {
      add(violations, 'contextual_as_observed', `suspiciousBehavior[${index}]`);
    }
    (item?.attackIds ?? []).forEach((id, attackIndex) => {
      if (!ATTACK_ID.test(String(id))) add(violations, 'malformed_attack_id', `suspiciousBehavior[${index}].attackIds[${attackIndex}]`);
    });
  });
}

function checkObservables(model, violations) {
  const seen = new Set();
  (model.observables ?? []).forEach((item, index) => {
    const key = canonicalObservable(item);
    if (seen.has(key)) add(violations, 'duplicate_observable', `observables[${index}]`);
    seen.add(key);
  });
}

function checkAttribution(model, violations) {
  const supported = new Set((model.evidence ?? []).map(item => item?.observation?.actor).filter(Boolean));
  (model.threatContext?.actors ?? []).forEach((actor, index) => {
    if (!supported.has(actor)) add(violations, 'unsupported_attribution', `threatContext.actors[${index}]`);
  });
}

function checkReferences(model, violations) {
  (model.sources ?? []).forEach((ref, index) => {
    if (!safeReference(ref)) add(violations, 'unsafe_reference', `sources[${index}]`);
  });
}

function checkSecrets(model, violations) {
  for (const entry of strings(model)) {
    if (KNOWN_SECRET_IDENTIFIERS.some(identifier => entry.value.includes(identifier)) || SECRET_VALUE_PATTERNS.some(pattern => pattern.test(entry.value))) {
      add(violations, 'secret_material', entry.path);
    }
  }
}

function checkStaleness(model, violations) {
  if (!validDate(model.generatedAt) || (model.limitations ?? []).includes('stale_evidence')) return;
  const timestamps = (model.evidence ?? []).flatMap(item => [item?.observation?.lastSeen, item?.retrievedAt]).filter(validDate);
  if (timestamps.length === 0) return;
  const newest = Math.max(...timestamps.map(value => Date.parse(value)));
  if (Date.parse(model.generatedAt) - newest > STALE_AFTER_MS) add(violations, 'stale_without_warning', 'limitations');
}

export function assertReportQuality(model) {
  if (!model || typeof model !== 'object' || Array.isArray(model)) throw new ReportQualityError([{ code: 'invalid_report_model', path: '$' }]);
  const violations = [];
  checkClaims(model, violations);
  checkEvidence(model, violations);
  checkFrameworks(model, violations);
  checkObservables(model, violations);
  checkAttribution(model, violations);
  checkReferences(model, violations);
  checkSecrets(model, violations);
  checkStaleness(model, violations);
  if (violations.length) throw new ReportQualityError(violations);
  return { ok: true, violations: [], warnings: [] };
}
