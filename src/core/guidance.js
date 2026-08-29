export const GUIDANCE_SCHEMA_VERSION = '1.0';

const DISPOSITIONS = new Set(['hunt_now', 'investigate', 'monitor', 'context_only', 'insufficient']);
const FORCING_CHANGE_CATEGORIES = new Set([
  'decision_changed',
  'contradiction_changed',
  'semantic_claim_changed',
  'provider_state_changed',
  'attack_mapping_changed',
  'huntability_changed',
  'telemetry_changed',
]);

const CHANGE_EXPLANATIONS = Object.freeze({
  decision_changed: 'Analyst disposition or decision support changed.',
  contradiction_changed: 'Contradiction state changed.',
  semantic_claim_changed: 'A provider semantic claim changed.',
  evidence_added: 'Evidence was added.',
  evidence_removed: 'Evidence was removed.',
  provider_state_changed: 'Provider operational state changed.',
  provider_coverage_changed: 'Provider coverage changed.',
  relationship_added: 'An explicit relationship was added.',
  relationship_removed: 'An explicit relationship was removed.',
  attack_mapping_changed: 'ATT&CK mapping changed.',
  huntability_changed: 'Huntability changed.',
  telemetry_changed: 'Telemetry guidance changed.',
  freshness_changed: 'Evidence freshness changed.',
});

const FINGERPRINT = /^[0-9a-f]{64}$/i;
const fail = code => { throw new Error(code); };

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function deepFreeze(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return value;
  seen.add(value);
  for (const child of Object.values(value)) deepFreeze(child, seen);
  return Object.freeze(value);
}

function uniqueSorted(values) {
  return [...new Set(values.filter(value => typeof value === 'string' && value.length > 0))]
    .sort((a, b) => a.localeCompare(b));
}

function graphFingerprints(evidenceGraph) {
  if (!evidenceGraph || !Array.isArray(evidenceGraph.nodes)) fail('guidance_graph_invalid');
  const fingerprints = new Set();
  for (const node of evidenceGraph.nodes) {
    if (node?.type !== 'evidence') continue;
    const fingerprint = String(node?.fingerprint ?? '').toLowerCase();
    if (!FINGERPRINT.test(fingerprint)) fail('guidance_graph_invalid');
    fingerprints.add(fingerprint);
  }
  return fingerprints;
}

function decisionReferences(decision) {
  const fingerprints = [];
  for (const hunt of Array.isArray(decision?.huntPlan) ? decision.huntPlan : []) {
    for (const fingerprint of Array.isArray(hunt?.evidenceFingerprints) ? hunt.evidenceFingerprints : []) {
      fingerprints.push(String(fingerprint).toLowerCase());
    }
  }
  for (const mapping of Array.isArray(decision?.attackMappings) ? decision.attackMappings : []) {
    for (const fingerprint of Array.isArray(mapping?.evidenceFingerprints) ? mapping.evidenceFingerprints : []) {
      fingerprints.push(String(fingerprint).toLowerCase());
    }
  }
  return fingerprints;
}

function changeProjection(semanticDiff) {
  if (!semanticDiff || semanticDiff.changed !== true) return null;
  const changes = Array.isArray(semanticDiff.changes) ? semanticDiff.changes : [];
  const categories = [];
  const seen = new Set();
  const explanations = [];

  for (const change of changes) {
    const category = typeof change?.category === 'string' ? change.category : 'unknown_change';
    if (!seen.has(category)) {
      seen.add(category);
      categories.push(category);
    }
    const base = CHANGE_EXPLANATIONS[category] ?? `Semantic change: ${category}.`;
    const key = typeof change?.key === 'string' && change.key ? change.key : null;
    explanations.push(key ? `${base} [${key}]` : base);
  }

  return {
    attentionRequired: categories.some(category => FORCING_CHANGE_CATEGORIES.has(category)),
    categories,
    explanations,
  };
}

export function buildGuidance({ decision, correlation, semanticDiff = null, evidenceGraph } = {}) {
  if (!decision || !DISPOSITIONS.has(decision.disposition) || typeof decision.confidence !== 'string') {
    fail('guidance_decision_invalid');
  }
  const available = graphFingerprints(evidenceGraph);
  const referenced = decisionReferences(decision);
  for (const fingerprint of referenced) {
    if (!FINGERPRINT.test(fingerprint) || !available.has(fingerprint)) fail('guidance_evidence_reference_invalid');
  }

  const evidenceFingerprints = uniqueSorted([...available, ...referenced]);
  const contradictions = Array.isArray(correlation?.contradictions) ? clone(correlation.contradictions) : [];
  const limitations = uniqueSorted(Array.isArray(correlation?.limitations) ? correlation.limitations.map(String) : []);
  const freshness = clone(correlation?.freshness ?? { overall: 'unknown', items: [] });
  const telemetry = clone(decision.telemetry ?? { status: 'conditional', requiredTables: [], environmentValidated: false, notes: [] });
  const attackMappings = clone(Array.isArray(decision.attackMappings) ? decision.attackMappings : []);
  const hunts = clone(Array.isArray(decision.huntPlan) ? decision.huntPlan : []);

  return deepFreeze({
    schemaVersion: GUIDANCE_SCHEMA_VERSION,
    disposition: decision.disposition,
    confidence: decision.confidence,
    reasons: uniqueSorted(Array.isArray(decision.reasons) ? decision.reasons.map(String) : []),
    evidenceFingerprints,
    contradictions,
    limitations,
    freshness,
    coverage: { materialLoss: Boolean(decision?.assessment?.coverageMaterialLoss) },
    telemetry,
    attackMappings,
    hunts,
    change: changeProjection(semanticDiff),
  });
}

export const GUIDANCE_ATTENTION_CATEGORIES = Object.freeze([...FORCING_CHANGE_CATEGORIES]);
