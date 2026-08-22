function safeComment(value) {
  return String(value ?? '').replace(/[\r\n]+/g, ' ').slice(0, 1000);
}

export function renderHuntsKql(model) {
  if (!model.huntOpportunities.length) return '// No defensible KQL hunt opportunities were generated.\n';
  const blocks = model.huntOpportunities.filter(item => typeof item.kql === 'string' && item.kql.trim()).map(item => [
    `// Hunt: ${safeComment(item.id)}`,
    `// Hypothesis: ${safeComment(item.hypothesis)}`,
    `// Telemetry: ${safeComment(item.telemetry.join(', '))}`,
    `// Evidence: ${safeComment(item.evidenceIds.join(', '))}`,
    item.kql.trim(),
  ].join('\n'));
  return blocks.length ? `${blocks.join('\n\n')}\n` : '// No defensible KQL hunt opportunities were generated.\n';
}
