export const INTELLIGENCE_KERNEL_SCHEMA_VERSION = '1.0';

const FINGERPRINT_RE = /^[a-f0-9]{64}$/i;

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function stableUnique(values) {
  return [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b)));
}

function validEvidenceFingerprints(evidence) {
  return stableUnique((Array.isArray(evidence) ? evidence : [])
    .map(item => item?.integrity?.fingerprint)
    .filter(value => typeof value === 'string' && FINGERPRINT_RE.test(value))
    .map(value => value.toLowerCase()));
}

function validateInputs({ indicator, type, evidence, relationships, correlation, coverage, policy }) {
  if (typeof indicator !== 'string' || indicator.length === 0) throw new TypeError('intelligence_indicator_required');
  if (typeof type !== 'string' || type.length === 0) throw new TypeError('intelligence_type_required');
  if (!Array.isArray(evidence)) throw new TypeError('intelligence_evidence_array_required');
  if (!Array.isArray(relationships)) throw new TypeError('intelligence_relationships_array_required');
  if (!correlation || typeof correlation !== 'object' || Array.isArray(correlation)) throw new TypeError('intelligence_correlation_object_required');
  if (!coverage || typeof coverage !== 'object' || Array.isArray(coverage)) throw new TypeError('intelligence_coverage_object_required');
  if (!policy || typeof policy !== 'object' || policy.type !== type || typeof policy.version !== 'string' || policy.version.length === 0) {
    throw new TypeError('intelligence_policy_incompatible');
  }
}

export function buildIntelligenceKernel({
  indicator,
  type,
  evidence = [],
  relationships = [],
  correlation = {},
  coverage = {},
  now,
  policy,
} = {}) {
  validateInputs({ indicator, type, evidence, relationships, correlation, coverage, policy });
  const fingerprints = validEvidenceFingerprints(evidence);
  void now;

  return deepFreeze({
    schemaVersion: INTELLIGENCE_KERNEL_SCHEMA_VERSION,
    policy: { type: policy.type, version: policy.version },
    indicator,
    type,
    evidenceStrength: {
      level: 'none',
      reasons: [],
      providers: [],
      evidenceFingerprints: fingerprints,
    },
    sourceDiversity: {
      providerCount: 0,
      providers: [],
      sourceRoles: [],
      semanticClasses: [],
      evidenceCategories: [],
      capabilityGroups: [],
    },
    corroboration: [],
    contradiction: { level: 'none', items: [] },
    temporalRelevance: {
      firstSeen: null,
      lastSeen: null,
      ageDays: null,
      activeSpanDays: null,
      overall: 'unknown',
      distribution: { current: 0, aging: 0, stale: 0, unknown: 0 },
    },
    relationshipValue: [],
    pivotCandidates: [],
    threatContext: {
      state: 'insufficient',
      direct: [],
      supporting: [],
      scannerNoise: [],
      torProxy: [],
      infrastructure: [],
      exposure: [],
    },
    huntRelevance: {
      level: 'none',
      directSearch: false,
      telemetry: [],
      pivotCount: 0,
      evidenceFingerprints: [],
      ruleIds: [],
    },
    coverageImpact: {
      level: 'none',
      uniqueCapabilityLoss: [],
      duplicateCoverageLoss: [],
      reasons: [],
    },
    analystPriority: {
      level: 'insufficient',
      reasons: [],
      evidenceFingerprints: [],
    },
    limitations: [],
    trace: { ruleIds: [] },
  });
}
