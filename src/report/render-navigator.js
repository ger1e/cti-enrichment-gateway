function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}

export function renderAttackNavigator(model) {
  const score = state => state === 'OBSERVED' ? 100 : state === 'INFERRED' ? 60 : 30;
  const layer = {
    name: `CTI ${model.subject.type}:${model.subject.value}`,
    versions: { attack: '18', navigator: '5.1.0', layer: '4.5' },
    domain: 'enterprise-attack',
    description: `Generated from ${model.reportId}; mappings retain observed/inferred/contextual state.`,
    techniques: model.frameworks.attack.map(item => ({
      techniqueID: item.id,
      score: score(item.mappingState),
      enabled: true,
      comment: `${item.mappingState}; evidence=${item.evidenceIds.join(',')}`,
      metadata: [{ name: 'mappingState', value: item.mappingState }],
    })),
  };
  return `${JSON.stringify(canonical(layer), null, 2)}\n`;
}
