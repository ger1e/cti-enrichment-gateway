function lines(items, render, empty = 'None recorded.') {
  return items.length ? items.map(render) : [empty];
}

function section(title, body) {
  return [title.toUpperCase(), '-'.repeat(title.length), ...body, ''];
}

function assessment(model) {
  const state = model.executiveAssessment?.state ?? 'insufficient';
  const confidence = model.executiveAssessment?.confidence ?? 'unknown';
  return [`Assessment: ${state}`, `Confidence: ${confidence}`, `TLP:${model.tlp}`, `Report ID: ${model.reportId}`];
}

export function renderText(model) {
  const out = [
    'CTI ENRICHMENT GATEWAY',
    `${model.subject.type.toUpperCase()}: ${model.subject.value}`,
    `Generated: ${model.generatedAt}`,
    '',
  ];

  out.push(...section('Executive Summary', assessment(model)));
  out.push(...section('Scope & Subject', [
    `Subject: ${model.subject.type}:${model.subject.value}`,
    `Queried: ${model.source.queriedAt}`,
    `Profile: ${model.source.profile ?? 'unknown'}`,
    `Gateway: ${model.source.gatewayVersion}`,
    `Evidence schema: ${model.source.evidenceSchemaVersion}`,
  ]));
  out.push(...section('Key Findings', lines(model.keyFindings, item => `- [${item.state}] ${item.title} (${item.evidenceIds.join(', ')})`)));
  out.push(...section('Suspicious Behavior to Look Out For', lines(model.suspiciousBehavior, item => `- [${item.state}/${item.mappingState}] ${item.title} (${item.evidenceIds.join(', ')})`)));
  out.push(...section('Indicators & Observables', lines(model.observables, item => `- ${item.type}: ${item.value}`)));
  out.push(...section('Threat Context', [
    `Actors: ${model.threatContext.actors.join(', ') || 'None evidenced.'}`,
    `Malware/tooling: ${model.threatContext.malware.join(', ') || 'None evidenced.'}`,
    ...lines(model.threatContext.infrastructure, item => `- Infrastructure: ${item.type}:${item.value}`, 'Infrastructure: none.'),
  ]));
  out.push(...section('Correlation & Relationships', lines(model.relationships, item => `- ${item.provider ?? 'gateway'}: ${item.relationship ?? item.type ?? 'related'} -> ${item.value ?? item.target ?? 'unknown'}`)));
  out.push(...section('Timeline', lines(model.timeline, item => `- ${item.at} ${item.kind} ${item.evidenceId}`)));
  out.push(...section('Analytical Frameworks', [
    ...lines(model.frameworks.attack, item => `- MITRE ATT&CK ${item.id} [${item.mappingState}] (${item.evidenceIds.join(', ')})`, 'MITRE ATT&CK: no defensible mappings.'),
    `Cyber Kill Chain: ${model.frameworks.killChain.length ? model.frameworks.killChain.join(', ') : 'No defensible mapping.'}`,
    `Pyramid of Pain: ${model.frameworks.pyramidOfPain.length ? model.frameworks.pyramidOfPain.join(', ') : 'No defensible mapping.'}`,
    `Diamond Model: ${model.frameworks.diamondModel.length ? model.frameworks.diamondModel.join(', ') : 'No defensible mapping.'}`,
  ]));
  out.push(...section('Hunt Opportunities', lines(model.huntOpportunities, item => `- ${item.id}: ${item.hypothesis} | telemetry=${item.telemetry.join(',')} | evidence=${item.evidenceIds.join(',')}`)));
  out.push(...section('Contradictions & Alternative Explanations', lines(model.contradictions, item => `- ${typeof item === 'string' ? item : JSON.stringify(item)}`)));
  out.push(...section('Recommended Actions', lines(model.actions, item => `- ${typeof item === 'string' ? item : JSON.stringify(item)}`)));
  out.push(...section('Intelligence & Telemetry Gaps', lines(model.gaps, item => `- ${typeof item === 'string' ? item : JSON.stringify(item)}`)));
  out.push(...section('Confidence & Limitations', [
    `Confidence: ${model.executiveAssessment?.confidence ?? 'unknown'}`,
    ...lines(model.limitations, item => `- ${item}`),
  ]));
  out.push(...section('Sources & Evidence Provenance', [
    ...lines(model.evidence, item => `- ${item.id}: ${item.provider} parser=${item.integrity.parserVersion} retrieved=${item.retrievedAt}`),
    ...lines(model.sources, item => `- ${item}`, 'No external references.'),
  ]));
  out.push(...section('Reproducibility / Integrity', [
    `Report schema: ${model.reportSchemaVersion}`,
    `Snapshot SHA-256: ${model.reproducibility.snapshotSha256}`,
    `Source SHA: ${model.reproducibility.sourceSha ?? 'unavailable'}`,
    `Generated: ${model.reproducibility.generatedAt}`,
  ]));
  return `${out.join('\n').trimEnd()}\n`;
}
