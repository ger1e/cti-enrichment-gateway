import { isDecisivePolarity, polarity, semanticClass } from './semantics.js';
import { sha256Hex } from './sha256.js';

export const INTELLIGENCE_KERNEL_SCHEMA_VERSION = '1.0';

const FINGERPRINT_RE = /^[a-f0-9]{64}$/i;
const DAY_MS = 24 * 60 * 60 * 1000;
const CONTRADICTION_LEVEL = Object.freeze({ none: 0, low: 1, medium: 2, high: 3 });
const HEALTHY_CAPABILITY_STATES = new Set(['ok', 'cached']);
const LOST_CAPABILITY_STATES = new Set(['failed', 'skipped']);
const RELATIONSHIP_CLASS_ORDER = Object.freeze({ direct: 0, supporting: 1, contextual: 2, low_value: 3 });
const PIVOT_PRIORITY_ORDER = Object.freeze({ high: 0, medium: 1, low: 2, none: 3 });
const MAX_PIVOT_CANDIDATES = 8;

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

function stableUnique(values) {
  return [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b)));
}

function validFingerprint(item) {
  const value = item?.integrity?.fingerprint;
  return typeof value === 'string' && FINGERPRINT_RE.test(value) ? value.toLowerCase() : null;
}

function validEvidenceFingerprints(evidence) {
  return stableUnique((Array.isArray(evidence) ? evidence : []).map(validFingerprint).filter(Boolean));
}

function snakeCase(value) {
  return String(value).replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/-/g, '_').toLowerCase();
}

function evidenceCategory(kind, policy) {
  for (const [category, kinds] of Object.entries(policy?.evidenceKinds ?? {})) {
    if (Array.isArray(kinds) && kinds.includes(kind)) return snakeCase(category);
  }
  return 'other';
}

function normalizedEvidence(item, policy) {
  const kind = typeof item?.observation?.kind === 'string' ? item.observation.kind : '';
  const sourceRole = typeof item?.semantics?.sourceRole === 'string' && item.semantics.sourceRole.length > 0 ? item.semantics.sourceRole : 'unknown';
  const semantic = typeof item?.semantics?.semanticClass === 'string' && item.semantics.semanticClass.length > 0
    ? item.semantics.semanticClass
    : semanticClass(kind);
  return {
    provider: typeof item?.provider === 'string' ? item.provider : '',
    kind,
    category: evidenceCategory(kind, policy),
    sourceRole,
    semanticClass: semantic,
    polarity: polarity(item?.observation?.verdict),
    fingerprint: validFingerprint(item),
    firstSeen: item?.observation?.firstSeen,
    lastSeen: item?.observation?.lastSeen,
  };
}

function sourceDiversity(items) {
  const providers = stableUnique(items.map(item => item.provider).filter(Boolean));
  return {
    providerCount: providers.length,
    providers,
    sourceRoles: stableUnique(items.map(item => item.sourceRole).filter(Boolean)),
    semanticClasses: stableUnique(items.map(item => item.semanticClass).filter(Boolean)),
    evidenceCategories: stableUnique(items.map(item => item.category).filter(Boolean)),
    capabilityGroups: stableUnique(items.filter(item => item.kind).map(item => `${item.sourceRole}:${item.kind}`)),
  };
}

function corroboration(items) {
  const groups = new Map();
  for (const item of items) {
    if (!item.provider || !isDecisivePolarity(item.polarity)) continue;
    const key = `${item.semanticClass}\u0000${item.category}\u0000${item.polarity}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return [...groups.values()]
    .filter(group => new Set(group.map(item => item.provider)).size >= 2)
    .map(group => {
      const providers = stableUnique(group.map(item => item.provider));
      const sourceRoles = stableUnique(group.map(item => item.sourceRole));
      const kinds = stableUnique(group.map(item => item.kind));
      return {
        semanticClass: group[0].semanticClass,
        category: group[0].category,
        polarity: group[0].polarity,
        providers,
        sourceRoles,
        evidenceFingerprints: stableUnique(group.map(item => item.fingerprint).filter(Boolean)),
        independence: sourceRoles.length > 1 || kinds.length > 1 ? 'independent' : 'same_capability',
      };
    })
    .sort((a, b) => `${a.semanticClass}:${a.category}:${a.polarity}`.localeCompare(`${b.semanticClass}:${b.category}:${b.polarity}`));
}

function contradictionSeverity(category) {
  if (category === 'direct_threat') return 'high';
  if (category === 'supporting_threat') return 'medium';
  return 'low';
}

function contradictions(items) {
  const groups = new Map();
  for (const item of items) {
    if (!item.provider || !isDecisivePolarity(item.polarity)) continue;
    const key = `${item.semanticClass}\u0000${item.category}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }

  const contradictionItems = [];
  let level = 'none';
  for (const group of groups.values()) {
    const positive = group.filter(item => item.polarity === 'positive');
    const negative = group.filter(item => item.polarity === 'negative');
    const positiveProviders = stableUnique(positive.map(item => item.provider));
    const negativeProviders = stableUnique(negative.map(item => item.provider));
    const crossProvider = positiveProviders.some(provider => !negativeProviders.includes(provider))
      || negativeProviders.some(provider => !positiveProviders.includes(provider));
    if (!positiveProviders.length || !negativeProviders.length || !crossProvider) continue;
    const severity = contradictionSeverity(group[0].category);
    if (CONTRADICTION_LEVEL[severity] > CONTRADICTION_LEVEL[level]) level = severity;
    contradictionItems.push({
      semanticClass: group[0].semanticClass,
      category: group[0].category,
      level: severity,
      positiveProviders,
      negativeProviders,
      sourceRoles: stableUnique(group.map(item => item.sourceRole)),
      evidenceFingerprints: stableUnique(group.map(item => item.fingerprint).filter(Boolean)),
    });
  }
  contradictionItems.sort((a, b) => `${a.semanticClass}:${a.category}`.localeCompare(`${b.semanticClass}:${b.category}`));
  return { level, items: contradictionItems };
}

function validDate(value) {
  if (typeof value !== 'string' || value.length === 0) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? { value, ms } : null;
}

function temporalRelevance(items, now) {
  const nowDate = validDate(now);
  const firstSeen = items.map(item => validDate(item.firstSeen)).filter(Boolean).sort((a, b) => a.ms - b.ms);
  const lastSeen = items.map(item => validDate(item.lastSeen)).filter(Boolean).sort((a, b) => a.ms - b.ms);
  const observed = items.map(item => validDate(item.lastSeen) ?? validDate(item.firstSeen));
  const distribution = { current: 0, aging: 0, stale: 0, unknown: 0 };

  for (const observation of observed) {
    if (!observation || !nowDate) {
      distribution.unknown += 1;
      continue;
    }
    const ageDays = Math.max(0, (nowDate.ms - observation.ms) / DAY_MS);
    if (ageDays <= 7) distribution.current += 1;
    else if (ageDays <= 30) distribution.aging += 1;
    else distribution.stale += 1;
  }

  const overall = distribution.stale > 0 ? 'stale'
    : distribution.aging > 0 ? 'aging'
      : distribution.current > 0 ? 'current'
        : 'unknown';
  const first = firstSeen[0] ?? null;
  const last = lastSeen.at(-1) ?? null;
  const latestObserved = observed.filter(Boolean).sort((a, b) => a.ms - b.ms).at(-1) ?? null;
  const ageDays = nowDate && latestObserved ? Math.max(0, (nowDate.ms - latestObserved.ms) / DAY_MS) : null;
  const activeSpanDays = first && last && last.ms >= first.ms ? (last.ms - first.ms) / DAY_MS : null;

  return {
    firstSeen: first?.value ?? null,
    lastSeen: last?.value ?? null,
    ageDays,
    activeSpanDays,
    overall,
    distribution,
  };
}

function relationshipClass(relationshipType, policy) {
  for (const [valueClass, types] of Object.entries(policy?.relationshipTypes ?? {})) {
    if (Array.isArray(types) && types.includes(relationshipType)) return snakeCase(valueClass);
  }
  return 'low_value';
}

function pivotPriority(valueClass, targetType, policy) {
  const eligible = Array.isArray(policy?.pivotTargetTypes) && policy.pivotTargetTypes.includes(targetType);
  if (!eligible) return 'none';
  if (valueClass === 'direct') return 'high';
  if (valueClass === 'supporting') return 'medium';
  if (valueClass === 'contextual') return 'none';
  return 'low';
}

function relationshipValues({ indicator, type, relationships, normalizedEvidence: evidence, policy }) {
  const fingerprintsByProvider = new Map();
  for (const item of evidence) {
    if (!item.provider || !item.fingerprint) continue;
    if (!fingerprintsByProvider.has(item.provider)) fingerprintsByProvider.set(item.provider, []);
    fingerprintsByProvider.get(item.provider).push(item.fingerprint);
  }

  const byId = new Map();
  for (const relationship of relationships) {
    if (!relationship || typeof relationship !== 'object') continue;
    const relationshipType = typeof relationship.type === 'string' ? relationship.type : '';
    const source = typeof relationship.source === 'string' && relationship.source.length > 0 ? relationship.source : indicator;
    const target = relationship.target ?? relationship.value;
    const targetType = typeof relationship.targetType === 'string' && relationship.targetType.length > 0 ? relationship.targetType.toLowerCase() : '';
    const provider = typeof relationship.provider === 'string' ? relationship.provider : '';
    if (!relationshipType || (typeof target !== 'string' && typeof target !== 'number') || String(target).length === 0 || !provider) continue;
    const targetValue = String(target);
    const valueClass = relationshipClass(relationshipType, policy);
    const priority = pivotPriority(valueClass, targetType, policy);
    const id = sha256Hex([type, source, relationshipType, targetType, targetValue, provider].join('\u0000'));
    if (byId.has(id)) continue;
    byId.set(id, {
      id,
      sourceType: type,
      source,
      type: relationshipType,
      targetType: targetType || null,
      target: targetValue,
      provider,
      valueClass,
      pivotPriority: priority,
      evidenceFingerprints: stableUnique(fingerprintsByProvider.get(provider) ?? []),
    });
  }

  return [...byId.values()].sort((a, b) => {
    const classDiff = (RELATIONSHIP_CLASS_ORDER[a.valueClass] ?? 99) - (RELATIONSHIP_CLASS_ORDER[b.valueClass] ?? 99);
    if (classDiff) return classDiff;
    return `${a.targetType ?? ''}\u0000${a.target}\u0000${a.provider}\u0000${a.id}`.localeCompare(`${b.targetType ?? ''}\u0000${b.target}\u0000${b.provider}\u0000${b.id}`);
  });
}

function relationshipFreshness(providers, evidence, now) {
  const supporting = evidence.filter(item => providers.includes(item.provider));
  return temporalRelevance(supporting, now).overall;
}

function pivotCandidates(relationshipValuesList, evidence, now) {
  const groups = new Map();
  for (const relationship of relationshipValuesList) {
    if (relationship.pivotPriority === 'none' || !relationship.targetType) continue;
    const key = `${relationship.targetType}\u0000${relationship.target}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(relationship);
  }

  const candidates = [...groups.values()].map(group => {
    const priority = [...group].sort((a, b) => (PIVOT_PRIORITY_ORDER[a.pivotPriority] ?? 99) - (PIVOT_PRIORITY_ORDER[b.pivotPriority] ?? 99))[0].pivotPriority;
    const providers = stableUnique(group.map(item => item.provider));
    const relationshipClasses = stableUnique(group.map(item => item.valueClass));
    const reasonCodes = stableUnique([
      ...relationshipClasses.map(valueClass => valueClass === 'direct'
        ? 'explicit_direct_relationship'
        : valueClass === 'supporting'
          ? 'explicit_supporting_relationship'
          : 'explicit_low_value_relationship'),
      ...(providers.length > 1 ? ['multi_provider_relationship'] : []),
    ]);
    return {
      priority,
      type: group[0].targetType,
      value: group[0].target,
      relationshipTypes: stableUnique(group.map(item => item.type)),
      relationshipClasses,
      providers,
      independentProviders: providers,
      providerCount: providers.length,
      freshness: relationshipFreshness(providers, evidence, now),
      relationshipIds: stableUnique(group.map(item => item.id)),
      evidenceFingerprints: stableUnique(group.flatMap(item => item.evidenceFingerprints)),
      reasonCodes,
    };
  });

  return candidates.sort((a, b) => {
    const priorityDiff = (PIVOT_PRIORITY_ORDER[a.priority] ?? 99) - (PIVOT_PRIORITY_ORDER[b.priority] ?? 99);
    if (priorityDiff) return priorityDiff;
    return `${a.type}\u0000${a.value}`.localeCompare(`${b.type}\u0000${b.value}`);
  }).slice(0, MAX_PIVOT_CANDIDATES);
}

function normalizedCapabilityRecords(coverage) {
  const values = Array.isArray(coverage?.providerCapabilities) ? coverage.providerCapabilities : [];
  return values
    .filter(item => item && typeof item === 'object' && typeof item.provider === 'string' && item.provider.length > 0)
    .map(item => ({
      provider: item.provider,
      state: typeof item.state === 'string' ? item.state : 'skipped',
      observationTypes: stableUnique((Array.isArray(item.observationTypes) ? item.observationTypes : [])
        .filter(value => typeof value === 'string' && value.length > 0)),
      sourceRole: typeof item.sourceRole === 'string' && item.sourceRole.length > 0 ? item.sourceRole : 'unknown',
    }));
}

function coverageImpact(coverage, policy) {
  const capabilities = normalizedCapabilityRecords(coverage);
  const healthy = capabilities.filter(item => HEALTHY_CAPABILITY_STATES.has(item.state));
  const lost = capabilities.filter(item => LOST_CAPABILITY_STATES.has(item.state));
  const uniqueCapabilityLoss = [];
  const duplicateCoverageLoss = [];

  for (const item of lost) {
    for (const observationType of item.observationTypes) {
      const record = {
        provider: item.provider,
        observationType,
        semanticClass: semanticClass(observationType),
        category: evidenceCategory(observationType, policy),
        sourceRole: item.sourceRole,
      };
      const healthyDuplicate = healthy.some(candidate => candidate.provider !== item.provider && candidate.observationTypes.includes(observationType));
      (healthyDuplicate ? duplicateCoverageLoss : uniqueCapabilityLoss).push(record);
    }
  }

  const byIdentity = (a, b) => `${a.observationType}:${a.provider}:${a.sourceRole}`.localeCompare(`${b.observationType}:${b.provider}:${b.sourceRole}`);
  uniqueCapabilityLoss.sort(byIdentity);
  duplicateCoverageLoss.sort(byIdentity);

  const uniqueThreatLoss = uniqueCapabilityLoss.some(item => item.category === 'direct_threat' || item.category === 'supporting_threat');
  const reasons = [];
  if (uniqueThreatLoss) reasons.push('unique_threat_capability_loss');
  if (duplicateCoverageLoss.length > 0) reasons.push('duplicate_capability_loss');
  if (uniqueCapabilityLoss.some(item => item.category !== 'direct_threat' && item.category !== 'supporting_threat')) reasons.push('contextual_capability_loss');

  return {
    level: uniqueThreatLoss ? 'material' : (uniqueCapabilityLoss.length > 0 || duplicateCoverageLoss.length > 0 ? 'degraded' : 'none'),
    uniqueCapabilityLoss,
    duplicateCoverageLoss,
    reasons: stableUnique(reasons),
  };
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
  const normalized = evidence.map(item => normalizedEvidence(item, policy));
  const projectedRelationships = relationshipValues({ indicator, type, relationships, normalizedEvidence: normalized, policy });

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
    sourceDiversity: sourceDiversity(normalized),
    corroboration: corroboration(normalized),
    contradiction: contradictions(normalized),
    temporalRelevance: temporalRelevance(normalized, now),
    relationshipValue: projectedRelationships,
    pivotCandidates: pivotCandidates(projectedRelationships, normalized, now),
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
    coverageImpact: coverageImpact(coverage, policy),
    analystPriority: {
      level: 'insufficient',
      reasons: [],
      evidenceFingerprints: [],
    },
    limitations: [],
    trace: { ruleIds: [] },
  });
}
