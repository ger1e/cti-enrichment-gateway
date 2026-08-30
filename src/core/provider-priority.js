export const PROVIDER_SCHEDULER_POLICY_VERSION = '1.0';

const RANK = Object.freeze({
  authorityClass: Object.freeze({ authoritative: 0, first_party: 1, specialist: 2, aggregator: 3, community: 4, contextual: 5 }),
  semanticUniqueness: Object.freeze({ unique: 0, complementary: 1, duplicative: 2 }),
  intelligenceValue: Object.freeze({ direct: 0, supporting: 1, contextual: 2 }),
  pivotValue: Object.freeze({ high: 0, medium: 1, low: 2, none: 3 }),
  latencyClass: Object.freeze({ fast: 0, normal: 1, slow: 2 }),
  costClass: Object.freeze({ free: 0, quota: 1, scarce: 2 }),
});

const DESCRIPTOR_FIELDS = Object.freeze([
  'authorityClass',
  'semanticUniqueness',
  'intelligenceValue',
  'pivotValue',
  'latencyClass',
]);

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function finiteInteger(value, fallback) {
  return Number.isInteger(value) && value >= 0 ? value : fallback;
}

function normalizeDescriptor(adapter, type) {
  const source = adapter?.schedulerByType?.[type];
  if (!source || typeof source !== 'object' || Array.isArray(source)) return null;
  const normalized = {};
  for (const field of DESCRIPTOR_FIELDS) {
    const value = source[field];
    if (!Object.hasOwn(RANK[field], value)) return null;
    normalized[field] = value;
  }
  return deepFreeze(normalized);
}

export function providerPriority(adapter, type, workflowIndex) {
  const descriptor = normalizeDescriptor(adapter, type);
  const tier = finiteInteger(adapter?.tier, Number.MAX_SAFE_INTEGER);
  const index = finiteInteger(adapter?.workflowIndex, finiteInteger(workflowIndex, Number.MAX_SAFE_INTEGER));
  const costClass = Object.hasOwn(RANK.costClass, adapter?.costClass) ? adapter.costClass : 'scarce';
  const fallback = descriptor === null;
  return deepFreeze({
    version: PROVIDER_SCHEDULER_POLICY_VERSION,
    type: String(type ?? ''),
    provider: String(adapter?.name ?? ''),
    fallback,
    rationale: fallback ? 'legacy_priority_fallback' : 'priority_vector',
    descriptor,
    costClass,
    tier,
    workflowIndex: index,
  });
}

function compareValid(a, b) {
  for (const field of DESCRIPTOR_FIELDS) {
    const delta = RANK[field][a.descriptor[field]] - RANK[field][b.descriptor[field]];
    if (delta !== 0) return delta;
  }
  const costDelta = RANK.costClass[a.costClass] - RANK.costClass[b.costClass];
  if (costDelta !== 0) return costDelta;
  if (a.tier !== b.tier) return a.tier - b.tier;
  return a.workflowIndex - b.workflowIndex;
}

function comparePriority(a, b) {
  if (a.fallback !== b.fallback) return a.fallback ? 1 : -1;
  if (a.fallback) {
    if (a.tier !== b.tier) return a.tier - b.tier;
    return a.workflowIndex - b.workflowIndex;
  }
  return compareValid(a, b);
}

function firstDifference(a, b) {
  if (!b || a.fallback || b.fallback) return a.fallback ? 'legacy_priority_fallback' : 'priority_vector';
  for (const field of DESCRIPTOR_FIELDS) {
    if (a.descriptor[field] !== b.descriptor[field]) return field;
  }
  if (a.costClass !== b.costClass) return 'costClass';
  if (a.tier !== b.tier) return 'tier';
  if (a.workflowIndex !== b.workflowIndex) return 'workflowIndex';
  return 'priority_vector';
}

export function rankProvidersForExecution({ providers = [], type } = {}) {
  const ranked = providers.map((adapter, index) => ({
    adapter,
    priority: providerPriority(adapter, type, index),
  })).sort((left, right) => comparePriority(left.priority, right.priority));

  return Object.freeze(ranked.map((entry, index) => Object.freeze({
    adapter: entry.adapter,
    priority: deepFreeze({
      ...entry.priority,
      rationale: entry.priority.fallback
        ? 'legacy_priority_fallback'
        : firstDifference(entry.priority, ranked[index + 1]?.priority),
    }),
  })));
}
