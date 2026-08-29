const REASONS = Object.freeze({
  decision_changed: 'decision support changed',
  contradiction_changed: 'cross-provider contradiction state changed',
  evidence_added: 'new normalized evidence was observed',
  evidence_removed: 'normalized evidence is no longer present',
  provider_coverage_changed: 'provider coverage changed',
  relationship_added: 'new evidence relationship was observed',
  relationship_removed: 'evidence relationship is no longer present',
  attack_mapping_changed: 'ATT&CK mapping support changed',
  huntability_changed: 'huntability changed',
  telemetry_changed: 'telemetry guidance changed',
  freshness_changed: 'evidence freshness changed',
});

export function explainSemanticDiff(diff) {
  const reasons = [];
  const seen = new Set();
  for (const change of Array.isArray(diff?.changes) ? diff.changes : []) {
    const reason = REASONS[change?.category] ?? 'semantic evidence changed';
    if (seen.has(reason)) continue;
    seen.add(reason);
    reasons.push(reason);
    if (reasons.length >= 16) break;
  }
  return Object.freeze(reasons);
}

export { REASONS as SEMANTIC_CHANGE_REASONS };
