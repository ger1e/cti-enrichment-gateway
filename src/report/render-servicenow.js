function cleanText(value, max = 2_048) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, max);
}

function frozenUnique(values) {
  return Object.freeze([...new Set((values ?? []).map(value => cleanText(value, 512)).filter(Boolean))].sort((a, b) => a.localeCompare(b)));
}

function priorityFor(label) {
  if (label === 'immediate') return 'P2';
  if (label === 'high' || label === 'moderate') return 'P3';
  return 'P4';
}

function actionsFor(hunt, result) {
  const actions = [];
  if (hunt.telemetryGaps.length) actions.push('Close or document telemetry gaps before relying on hunt coverage.');
  if (hunt.state === 'SCHEMA_UNVERIFIED') actions.push('Validate KQL against the target tenant schema before execution.');
  if (result?.state === 'RESULTS_PRESENT') actions.push('Review supplied result rows and corroborate suspicious activity against authoritative telemetry.');
  if (result?.state === 'NO_RESULTS') actions.push('Validate telemetry coverage, query scope, retention, and execution window before drawing conclusions.');
  if (!result) actions.push('Execute the approved hunt and attach bounded result output before finding classification.');
  actions.push('Analyst approval required before escalation or ticket submission.');
  return frozenUnique(actions);
}

export function buildServiceNowProjection(hunt, result = null) {
  if (!hunt || typeof hunt !== 'object' || hunt.schemaVersion !== 'mission-hunt-v1.0') {
    throw new TypeError('invalid ServiceNow projection: mission hunt package required');
  }
  if (result && (typeof result !== 'object' || result.schemaVersion !== 'mission-result-v1.0')) {
    throw new TypeError('invalid ServiceNow projection: mission result analysis required');
  }

  const limitations = frozenUnique([...(hunt.limitations ?? []), ...(result?.limitations ?? [])]);
  const projection = {
    schemaVersion: 'mission-servicenow-v1.0',
    title: cleanText(`[PARA11AX] ${hunt.subject}`, 512),
    suggestedPriority: priorityFor(hunt.relevance?.label),
    priorityBasis: 'client_relevance_only_not_incident_severity',
    summary: cleanText(hunt.hypothesis),
    client: Object.freeze({ id: cleanText(hunt.profileId, 128), name: cleanText(hunt.profileName, 256) }),
    huntId: cleanText(hunt.id, 128),
    huntState: cleanText(hunt.state, 64),
    resultState: cleanText(result?.state ?? 'NOT_PROVIDED', 64),
    relevance: Object.freeze({ score: Number(hunt.relevance?.score ?? 0), label: cleanText(hunt.relevance?.label, 32) }),
    attackIds: frozenUnique(hunt.attackIds),
    evidenceFingerprints: frozenUnique(hunt.evidenceFingerprints),
    sourceReferences: frozenUnique(hunt.sourceReferences),
    telemetryGaps: frozenUnique(hunt.telemetryGaps),
    kqlValidationStates: frozenUnique((hunt.kqlCandidates ?? []).map(candidate => candidate.validation?.state)),
    limitations,
    recommendedActions: actionsFor(hunt, result),
    provenance: Object.freeze({ projectionOnly: true, autoSubmission: false, sourceHuntId: cleanText(hunt.id, 128) }),
  };
  return Object.freeze(projection);
}

export function renderServiceNowText(projection) {
  if (!projection || projection.schemaVersion !== 'mission-servicenow-v1.0') {
    throw new TypeError('invalid ServiceNow text projection');
  }
  const lines = [
    'PARA11AX SERVICENOW PROJECTION',
    `Title: ${projection.title}`,
    `Suggested priority: ${projection.suggestedPriority} (${projection.priorityBasis})`,
    `Client: ${projection.client.name} [${projection.client.id}]`,
    `Hunt: ${projection.huntId} / ${projection.huntState}`,
    `Result state: ${projection.resultState}`,
    `Relevance: ${projection.relevance.score}/100 ${projection.relevance.label}`,
    `ATT&CK: ${projection.attackIds.join(', ') || 'none'}`,
    `Telemetry gaps: ${projection.telemetryGaps.join(', ') || 'none'}`,
    `KQL validation: ${projection.kqlValidationStates.join(', ') || 'none'}`,
    `Evidence: ${projection.evidenceFingerprints.join(', ') || 'none'}`,
    `Sources: ${projection.sourceReferences.join(', ') || 'none'}`,
    `Summary: ${projection.summary}`,
    `Limitations: ${projection.limitations.join('; ') || 'none'}`,
    'Recommended actions:',
    ...projection.recommendedActions.map(value => `- ${value}`),
    'Projection only: no ticket has been submitted.',
  ];
  return `${lines.join('\n')}\n`;
}
