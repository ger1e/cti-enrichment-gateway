const FACT_CLASSES = new Set([
  'network_context',
  'certificate_context',
  'vulnerability_metadata',
  'attack_knowledge',
  'exploitation',
]);
const CONTEXT_CLASSES = new Set(['threat_context', 'malware_association']);
const FACT_SOURCES = new Set(['authoritative', 'first_party']);

export function evidenceRole({ semanticClass, sourceRole } = {}) {
  if (sourceRole === 'contextual' || CONTEXT_CLASSES.has(semanticClass)) return 'contextual_intelligence';
  if (FACT_SOURCES.has(sourceRole) && FACT_CLASSES.has(semanticClass)) return 'observed_fact';
  return 'provider_claim';
}
