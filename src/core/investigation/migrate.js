import { importMissionWorkspace } from '../mission/workspace.js';
import { canonicalJson, clone } from './canonical.js';
import { INVESTIGATION_LIMITS } from './constants.js';
import { createInvestigation, importInvestigation } from './model.js';

function fail(message, ErrorType = TypeError) {
  throw new ErrorType(`invalid investigation migration: ${message}`);
}

function requireLegacyCase(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || value.schemaVersion !== '1.0') fail('legacy case');
  for (const field of ['pins', 'snapshots', 'diffs', 'notes']) {
    if (!Array.isArray(value[field])) fail(`legacy case ${field}`);
  }
  if (value.pins.length > INVESTIGATION_LIMITS.observables
    || value.snapshots.length > INVESTIGATION_LIMITS.evidenceSnapshots
    || value.diffs.length > INVESTIGATION_LIMITS.evidenceSnapshots
    || value.notes.length > INVESTIGATION_LIMITS.notes) {
    fail('legacy case exceeds investigation limits', RangeError);
  }
  return value;
}

function same(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function mergeScope(current, mission) {
  for (const field of ['profile', 'context']) {
    if (current.scope[field] !== null && mission[field] !== null && !same(current.scope[field], mission[field])) {
      fail(`scope conflict: ${field}`);
    }
  }
  return {
    profile: clone(current.scope.profile ?? mission.profile),
    context: clone(current.scope.context ?? mission.context),
  };
}

export function migrateCaseToInvestigation(caseValue, { now = () => new Date().toISOString() } = {}) {
  const source = requireLegacyCase(caseValue);
  const migratedAt = now();
  const base = createInvestigation({
    title: source.title,
    now: () => source.createdAt,
    uuid: () => source.id,
  });
  const diffs = new Map(source.diffs.map(diff => [diff.toSnapshotId, diff]));
  return importInvestigation({
    ...base,
    updatedAt: migratedAt,
    revision: 1,
    observables: source.pins.map(({ type, value, addedAt }) => ({ type, value, addedAt })),
    evidenceSnapshots: source.snapshots.map(snapshot => ({
      ...clone(snapshot),
      diffFromPrevious: clone(diffs.get(snapshot.id) ?? null),
    })),
    notes: source.notes.map(({ id, text, addedAt }) => ({ id, text, at: addedAt })),
    timeline: [{
      id: `migration:${source.id}`,
      at: migratedAt,
      action: 'MIGRATED_CASE_V1',
      details: { sourceVersion: source.schemaVersion },
    }],
  });
}

export function adoptMissionWorkspace(investigation, missionInput, {
  now = () => new Date().toISOString(),
  uuid = () => crypto.randomUUID(),
} = {}) {
  const current = importInvestigation(investigation);
  const mission = importMissionWorkspace(missionInput);
  const at = now();
  const scope = mergeScope(current, mission);
  return importInvestigation({
    ...current,
    updatedAt: at,
    revision: current.revision + 1,
    scope,
    workflow: {
      ...current.workflow,
      relevance: clone(mission.relevance),
      hunt: clone(mission.hunt),
      kqlValidations: clone(mission.kqlValidations),
      result: clone(mission.result),
      serviceNow: clone(mission.serviceNow),
      disposition: null,
      report: null,
    },
    timeline: [...current.timeline, {
      id: uuid(),
      at,
      action: 'ADOPTED_MISSION_WORKSPACE_V1',
      details: { sourceRevision: mission.revision },
    }],
  });
}

