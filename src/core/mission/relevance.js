import { normalizeClientProfile } from './client-profile.js';

const FACTORS = Object.freeze([
  Object.freeze({ id: 'technology', weight: 25, profile: 'technologies', context: 'technologies' }),
  Object.freeze({ id: 'observed_exploitation', weight: 20, scalar: 'observedExploitation' }),
  Object.freeze({ id: 'industry', weight: 15, profile: 'industries', context: 'industries' }),
  Object.freeze({ id: 'geography', weight: 10, profile: 'geographies', context: 'geographies' }),
  Object.freeze({ id: 'attack_path', weight: 10, profile: 'attackPaths', context: 'attackPaths' }),
  Object.freeze({ id: 'actor', weight: 10, profile: 'priorityActors', context: 'actors' }),
  Object.freeze({ id: 'telemetry', weight: 5, profile: 'telemetry', context: 'requiredTelemetry' }),
  Object.freeze({ id: 'evidence_confidence', weight: 5, scalar: 'evidenceConfidence' }),
]);

const MAX_CONTEXT_ITEMS = 64;
const MAX_CONTEXT_ITEM = 256;
const CONTROL = /[\u0000-\u001F\u007F]/;

function fail(field) {
  throw new TypeError(`invalid relevance context: ${field}`);
}

function contextList(value, field) {
  if (value == null) return null;
  if (!Array.isArray(value) || value.length > MAX_CONTEXT_ITEMS) fail(field);
  const normalized = value.map((item, index) => {
    if (typeof item !== 'string') fail(`${field}[${index}]`);
    const out = item.trim().toLowerCase();
    if (!out || out.length > MAX_CONTEXT_ITEM) fail(`${field}[${index}]`);
    if (CONTROL.test(out)) fail(`${field}[${index}] contains control characters`);
    return out;
  });
  const unique = [...new Set(normalized)].sort((a, b) => a.localeCompare(b));
  return unique.length ? unique : null;
}

function round(value) {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

function overlapFactor(factor, profile, context) {
  const wanted = contextList(context[factor.context], factor.context);
  if (!wanted) return { factor: Object.freeze({ id: factor.id, score: 0, weight: factor.weight, rationale: 'context unavailable' }), gap: factor.id };
  if (profile[factor.profile].length === 0) {
    return {
      factor: Object.freeze({ id: factor.id, score: 0, weight: factor.weight, rationale: 'client profile fact unavailable' }),
      gap: factor.id,
    };
  }
  const available = new Set(profile[factor.profile]);
  const matched = wanted.filter(item => available.has(item));
  const score = round(factor.weight * (matched.length / wanted.length));
  return {
    factor: Object.freeze({
      id: factor.id,
      score,
      weight: factor.weight,
      rationale: `${matched.length}/${wanted.length} context values matched explicit client facts`,
    }),
    gap: null,
  };
}

function scalarFactor(factor, context) {
  if (factor.scalar === 'observedExploitation') {
    if (context.observedExploitation == null) {
      return { factor: Object.freeze({ id: factor.id, score: 0, weight: factor.weight, rationale: 'context unavailable' }), gap: factor.id };
    }
    if (typeof context.observedExploitation !== 'boolean') fail('observedExploitation');
    return {
      factor: Object.freeze({
        id: factor.id,
        score: context.observedExploitation ? factor.weight : 0,
        weight: factor.weight,
        rationale: context.observedExploitation ? 'observed exploitation explicitly present' : 'observed exploitation explicitly absent',
      }),
      gap: null,
    };
  }

  if (context.evidenceConfidence == null) {
    return { factor: Object.freeze({ id: factor.id, score: 0, weight: factor.weight, rationale: 'context unavailable' }), gap: factor.id };
  }
  if (!Number.isFinite(context.evidenceConfidence) || context.evidenceConfidence < 0 || context.evidenceConfidence > 1) fail('evidenceConfidence');
  return {
    factor: Object.freeze({
      id: factor.id,
      score: round(factor.weight * context.evidenceConfidence),
      weight: factor.weight,
      rationale: `evidence confidence ${round(context.evidenceConfidence)}`,
    }),
    gap: null,
  };
}

function label(score) {
  if (score >= 80) return 'immediate';
  if (score >= 60) return 'high';
  if (score >= 40) return 'moderate';
  if (score >= 20) return 'low';
  return 'contextual';
}

export function assessClientRelevance(profileInput, context = {}) {
  if (!context || typeof context !== 'object' || Array.isArray(context)) fail('root');
  const profile = normalizeClientProfile(profileInput);
  const evaluated = FACTORS.map(factor => factor.scalar ? scalarFactor(factor, context) : overlapFactor(factor, profile, context));
  const factors = Object.freeze(evaluated.map(item => item.factor));
  const score = round(factors.reduce((sum, factor) => sum + factor.score, 0));
  const gaps = Object.freeze(evaluated.map(item => item.gap).filter(Boolean).sort((a, b) => a.localeCompare(b)));
  return Object.freeze({
    schemaVersion: 'mission-relevance-v1.0',
    profileId: profile.id,
    score,
    label: label(score),
    factors,
    gaps,
  });
}
