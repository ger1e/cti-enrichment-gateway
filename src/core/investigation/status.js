import { deepFreeze } from './canonical.js';

const artifactPresent = (value, artifact, stale) => value.workflow?.[artifact] != null && !stale.has(artifact);

export function deriveInvestigationStatus(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('invalid investigation status input');
  const staleArtifacts = (value.freshness?.stale ?? []).map(item => ({ artifact: item.artifact, reason: item.reason }));
  const stale = new Set(staleArtifacts.map(item => item.artifact));
  const scoped = value.scope?.profile != null && value.scope?.context != null;
  const hasEvidence = Array.isArray(value.evidenceSnapshots) && value.evidenceSnapshots.length > 0;
  const currentHunt = artifactPresent(value, 'hunt', stale);
  const validKql = Array.isArray(value.workflow?.kqlValidations)
    && value.workflow.kqlValidations.some(item => item?.validation?.state === 'VALID' || item?.validation?.valid === true || item?.validation?.ok === true);
  const currentResult = artifactPresent(value, 'result', stale);
  const currentDisposition = artifactPresent(value, 'disposition', stale);
  const currentReport = artifactPresent(value, 'report', stale);

  let phase;
  let gaps;
  let nextActions;
  if (!scoped) {
    phase = 'SCOPING';
    gaps = ['SCOPE_REQUIRED'];
    nextActions = ['SET_SCOPE'];
  } else if (!hasEvidence) {
    phase = 'EVIDENCE';
    gaps = ['EVIDENCE_REQUIRED'];
    nextActions = ['CAPTURE_EVIDENCE'];
  } else if (!currentHunt) {
    phase = 'HUNT_DESIGN';
    gaps = ['CURRENT_HUNT_REQUIRED'];
    nextActions = ['BUILD_RELEVANCE', 'BUILD_HUNT'];
  } else if (!validKql || !currentResult) {
    phase = 'EXECUTION_PENDING';
    gaps = [...(!validKql ? ['VALID_KQL_REQUIRED'] : []), ...(!currentResult ? ['RESULT_IMPORT_REQUIRED'] : [])];
    nextActions = [...(!validKql ? ['VALIDATE_KQL'] : []), ...(!currentResult ? ['IMPORT_RESULTS'] : [])];
  } else if (!currentDisposition) {
    phase = 'DISPOSITION';
    gaps = ['DISPOSITION_REQUIRED'];
    nextActions = ['SET_DISPOSITION'];
  } else if (!currentReport) {
    phase = 'RESULTS';
    gaps = ['CURRENT_REPORT_REQUIRED'];
    nextActions = ['BUILD_REPORT'];
  } else {
    phase = 'REPORT_READY';
    gaps = [];
    nextActions = [];
  }

  const currentArtifacts = [];
  if (artifactPresent(value, 'relevance', stale)) currentArtifacts.push('relevance');
  if (currentHunt) currentArtifacts.push('hunt');
  if (validKql) currentArtifacts.push('kqlValidation');
  if (currentResult) currentArtifacts.push('result');
  if (currentDisposition) currentArtifacts.push('disposition');
  if (currentReport) currentArtifacts.push('report');
  if (artifactPresent(value, 'serviceNow', stale)) currentArtifacts.push('serviceNow');

  const limitations = [...new Set([
    ...(Array.isArray(value.limitations) ? value.limitations : []),
    ...(value.workflow?.result?.state === 'NO_RESULTS' ? ['no_results_is_not_benign_evidence'] : []),
  ])].sort((a, b) => a.localeCompare(b));
  const reportReady = phase === 'REPORT_READY';
  return deepFreeze({
    phase,
    readiness: reportReady ? 'READY' : (phase === 'SCOPING' ? 'BLOCKED' : 'INCOMPLETE'),
    currentArtifacts,
    staleArtifacts,
    gaps,
    nextActions,
    exportReady: typeof value.id === 'string' && value.id.length > 0,
    reportReady,
    limitations,
  });
}
