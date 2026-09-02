import { diffEvidenceSnapshots } from '../semantic-diff.js';
import {
  analyzeMissionResults,
  assessClientRelevance,
  buildHuntPackage,
  createMissionWorkspace,
  normalizeClientProfile,
  reduceMissionWorkspace,
  validateMissionKql,
} from '../mission/index.js';
import { buildServiceNowProjection } from '../../report/render-servicenow.js';
import { assertPlainJsonTree, canonicalJson, clone } from './canonical.js';
import { INVESTIGATION_CONFIDENCE, INVESTIGATION_DISPOSITIONS, INVESTIGATION_LIMITS } from './constants.js';
import { clearStaleArtifacts, fingerprintDependency, invalidateInvestigation } from './dependencies.js';
import { importInvestigation } from './model.js';
import { deriveInvestigationStatus } from './status.js';

const ACTIONS = new Set([
  'SCOPE_SET', 'OBSERVABLE_ADD', 'OBSERVABLE_REMOVE', 'EVIDENCE_CAPTURE',
  'OPERATOR_CAPTURE', 'RELEVANCE_BUILD', 'HUNT_BUILD', 'KQL_VALIDATE',
  'RESULT_SET', 'DISPOSITION_SET', 'REPORT_BUILD', 'SERVICENOW_BUILD', 'NOTE_ADD',
]);
const CONTROL = /[\u0000-\u001F\u007F]/;

function fail(message, ErrorType = TypeError) {
  throw new ErrorType(`invalid investigation action: ${message}`);
}

function text(value, maximum, field) {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum || CONTROL.test(value)) fail(field);
  return value.trim();
}

function normalizeScope(profileInput, contextInput) {
  let mission = createMissionWorkspace();
  mission = reduceMissionWorkspace(mission, { type: 'PROFILE_SET', value: profileInput });
  mission = reduceMissionWorkspace(mission, { type: 'CONTEXT_SET', value: contextInput });
  return { profile: mission.profile, context: mission.context };
}

function invalidate(candidate, reason) {
  return clone(invalidateInvestigation(candidate, reason));
}

function clearStale(candidate, artifacts) {
  return clone(clearStaleArtifacts(candidate, artifacts));
}

function addTimeline(candidate, action, at, uuid, details = {}) {
  if (candidate.timeline.length >= INVESTIGATION_LIMITS.timeline) fail('timeline limit', RangeError);
  candidate.timeline.push({ id: uuid(), at, action, details });
}

function dependency(candidate, artifact, type, input) {
  candidate.freshness.dependencies[artifact] = fingerprintDependency(type, input);
}

function applyAction(current, action, { at, uuid, buildReport }) {
  let next = clone(current);
  switch (action.type) {
    case 'SCOPE_SET': {
      next = invalidate(next, 'SCOPE_CHANGED');
      next.scope = normalizeScope(action.profile, action.context);
      dependency(next, 'scope', 'scope', next.scope);
      break;
    }
    case 'OBSERVABLE_ADD': {
      const observable = action.observable;
      if (!observable || typeof observable !== 'object' || Array.isArray(observable)) fail('observable');
      const key = `${observable.type}\u0000${observable.value}`;
      if (next.observables.some(item => `${item.type}\u0000${item.value}` === key)) fail('duplicate observable');
      if (next.observables.length >= INVESTIGATION_LIMITS.observables) fail('observables limit', RangeError);
      next = invalidate(next, 'OBSERVABLES_CHANGED');
      next.observables.push({ type: observable.type, value: observable.value, addedAt: at });
      next.observables.sort((left, right) => `${left.type}\u0000${left.value}`.localeCompare(`${right.type}\u0000${right.value}`));
      dependency(next, 'observables', 'observables', next.observables);
      break;
    }
    case 'OBSERVABLE_REMOVE': {
      const key = `${action.observable?.type}\u0000${action.observable?.value}`;
      const filtered = next.observables.filter(item => `${item.type}\u0000${item.value}` !== key);
      if (filtered.length === next.observables.length) fail('observable not found');
      next = invalidate(next, 'OBSERVABLES_CHANGED');
      next.observables = filtered;
      dependency(next, 'observables', 'observables', next.observables);
      break;
    }
    case 'EVIDENCE_CAPTURE': {
      const evidence = action.value;
      if (!evidence || evidence.schemaVersion !== '2.0') fail('Evidence v2 required');
      if (next.evidenceSnapshots.length >= INVESTIGATION_LIMITS.evidenceSnapshots) fail('evidence snapshot limit', RangeError);
      next = invalidate(next, 'EVIDENCE_CHANGED');
      const previous = [...next.evidenceSnapshots].reverse().find(item => item.type === evidence.type && item.indicator === evidence.indicator);
      const snapshotId = uuid();
      const diffFromPrevious = previous ? {
        id: uuid(),
        type: evidence.type,
        indicator: evidence.indicator,
        capturedAt: at,
        fromSnapshotId: previous.id,
        toSnapshotId: snapshotId,
        diff: diffEvidenceSnapshots(previous.evidence, evidence),
      } : null;
      next.evidenceSnapshots.push({
        id: snapshotId,
        type: evidence.type,
        indicator: evidence.indicator,
        capturedAt: at,
        requestId: evidence.requestId,
        evidence: clone(evidence),
        diffFromPrevious,
      });
      dependency(next, 'evidence', 'evidence', next.evidenceSnapshots);
      break;
    }
    case 'OPERATOR_CAPTURE': {
      if (next.operatorArtifacts.length >= INVESTIGATION_LIMITS.operatorArtifacts) fail('operator artifact limit', RangeError);
      const value = action.value;
      if (!value || typeof value !== 'object' || Array.isArray(value)) fail('operator artifact');
      next.operatorArtifacts.push({
        id: uuid(),
        kind: text(value.kind, 64, 'operator artifact kind'),
        capturedAt: at,
        source: text(value.source ?? 'current-result', 160, 'operator artifact source'),
        summary: text(value.summary, INVESTIGATION_LIMITS.text, 'operator artifact summary'),
        references: Array.isArray(value.references) ? [...value.references] : [],
      });
      dependency(next, 'operatorArtifacts', 'operatorArtifacts', next.operatorArtifacts);
      break;
    }
    case 'RELEVANCE_BUILD': {
      if (!next.scope.profile || next.scope.context === null) fail('scope required');
      next.workflow.relevance = assessClientRelevance(next.scope.profile, next.scope.context);
      next = clearStale(next, ['relevance']);
      dependency(next, 'relevance', 'relevance', { scope: next.scope });
      break;
    }
    case 'HUNT_BUILD': {
      if (!next.scope.profile || next.scope.context === null) fail('scope required');
      next = invalidate(next, 'HUNT_CHANGED');
      next.workflow.hunt = buildHuntPackage({ ...action.value, profile: next.scope.profile, context: next.scope.context });
      next.workflow.kqlValidations = clone(next.workflow.hunt.kqlCandidates);
      next = clearStale(next, ['hunt']);
      dependency(next, 'hunt', 'hunt', { scope: next.scope, observables: next.observables, evidence: next.evidenceSnapshots, input: action.value });
      break;
    }
    case 'KQL_VALIDATE': {
      const query = text(action.query ?? action.value, 64 * 1024, 'KQL query');
      const validation = validateMissionKql(query);
      const byQuery = new Map(next.workflow.kqlValidations.map(item => [item.query, item]));
      byQuery.set(query, { query, validation });
      if (byQuery.size > INVESTIGATION_LIMITS.kqlValidations) fail('KQL validation limit', RangeError);
      next = invalidate(next, 'KQL_CHANGED');
      next.workflow.kqlValidations = [...byQuery.values()].sort((left, right) => left.query.localeCompare(right.query));
      dependency(next, 'kql', 'kql', next.workflow.kqlValidations);
      break;
    }
    case 'RESULT_SET': {
      next = invalidate(next, 'RESULT_CHANGED');
      next.workflow.result = analyzeMissionResults(action.value);
      next = clearStale(next, ['result']);
      dependency(next, 'result', 'result', { hunt: next.workflow.hunt, result: next.workflow.result });
      break;
    }
    case 'DISPOSITION_SET': {
      const value = action.value;
      if (!value || typeof value !== 'object' || Array.isArray(value)) fail('disposition');
      if (!INVESTIGATION_DISPOSITIONS.includes(value.state)) fail('disposition state');
      if (!INVESTIGATION_CONFIDENCE.includes(value.confidence)) fail('disposition confidence');
      const rationale = text(value.rationale, INVESTIGATION_LIMITS.text, 'disposition rationale');
      if (!Array.isArray(value.artifactIds) || !Array.isArray(value.limitations)) fail('disposition links');
      const currentIds = new Set([
        ...next.evidenceSnapshots.map(item => item.id),
        ...next.operatorArtifacts.map(item => item.id),
        ...next.notes.map(item => item.id),
        next.workflow.hunt?.id,
      ].filter(Boolean));
      const hasCurrentLink = value.artifactIds.some(id => currentIds.has(id));
      if (value.state === 'BENIGN_EXPLAINED' && !hasCurrentLink && next.notes.length === 0) fail('disposition requires linked current artifact or note');
      next = invalidate(next, 'DISPOSITION_CHANGED');
      next.workflow.disposition = { state: value.state, confidence: value.confidence, rationale, artifactIds: [...value.artifactIds], limitations: [...value.limitations] };
      next = clearStale(next, ['disposition']);
      dependency(next, 'disposition', 'disposition', { result: next.workflow.result, disposition: next.workflow.disposition });
      break;
    }
    case 'REPORT_BUILD': {
      if (typeof buildReport !== 'function') fail('report builder unavailable');
      next.workflow.report = buildReport(next);
      next = clearStale(next, ['report']);
      dependency(next, 'report', 'report', { disposition: next.workflow.disposition, notes: next.notes });
      break;
    }
    case 'SERVICENOW_BUILD': {
      if (!next.workflow.hunt) fail('hunt required');
      if (!next.workflow.disposition) fail('disposition required');
      const missionProjection = buildServiceNowProjection(next.workflow.hunt, next.workflow.result);
      next.workflow.serviceNow = {
        schemaVersion: 'investigation-servicenow-v2.0',
        investigationId: next.id,
        investigationRevision: next.revision + 1,
        title: `[PARA11AX] ${next.title}`,
        summary: missionProjection.summary,
        disposition: clone(next.workflow.disposition),
        evidenceSnapshotIds: next.evidenceSnapshots.map(item => item.id),
        sourceReferences: [...missionProjection.sourceReferences],
        limitations: [...new Set([...missionProjection.limitations, ...next.workflow.disposition.limitations])].sort((a, b) => a.localeCompare(b)),
        recommendedActions: [...missionProjection.recommendedActions],
        approvalRequired: true,
        autoSubmission: false,
        missionProjection,
      };
      next = clearStale(next, ['serviceNow']);
      dependency(next, 'serviceNow', 'serviceNow', { hunt: next.workflow.hunt, result: next.workflow.result, disposition: next.workflow.disposition });
      break;
    }
    case 'NOTE_ADD': {
      if (next.notes.length >= INVESTIGATION_LIMITS.notes) fail('notes limit', RangeError);
      next = invalidate(next, 'NOTE_CHANGED');
      next.notes.push({ id: uuid(), at, text: text(action.text, INVESTIGATION_LIMITS.text, 'note') });
      dependency(next, 'notes', 'notes', next.notes);
      break;
    }
    default:
      fail('unsupported action');
  }
  addTimeline(next, action.type, at, uuid, { dependencyHash: fingerprintDependency('action', { type: action.type, revision: current.revision + 1 }) });
  return next;
}

export function reduceInvestigation(current, action, dependencies = {}) {
  const valid = importInvestigation(current);
  assertPlainJsonTree(action, '$action');
  if (!action || typeof action !== 'object' || Array.isArray(action) || !ACTIONS.has(action.type)) fail('unsupported action');
  if (valid.revision === Number.MAX_SAFE_INTEGER) fail('revision limit', RangeError);
  const now = dependencies.now ?? (() => new Date().toISOString());
  const uuid = dependencies.uuid ?? (() => crypto.randomUUID());
  const at = now();
  const candidate = applyAction(valid, action, { ...dependencies, at, uuid });
  candidate.revision = valid.revision + 1;
  candidate.updatedAt = at;
  candidate.status = deriveInvestigationStatus(candidate);
  const result = importInvestigation(candidate);
  if (canonicalJson(valid) === canonicalJson(result)) fail('mutation produced no change');
  return result;
}
