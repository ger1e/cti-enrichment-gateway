import { sha256Hex } from '../sha256.js';
import { canonicalJson, clone, deepFreeze } from './canonical.js';

export const INVESTIGATION_INVALIDATION = Object.freeze({
  SCOPE_CHANGED: Object.freeze(['relevance', 'hunt', 'result', 'disposition', 'report', 'serviceNow']),
  OBSERVABLES_CHANGED: Object.freeze(['hunt', 'disposition', 'report', 'serviceNow']),
  EVIDENCE_CHANGED: Object.freeze(['hunt', 'result', 'disposition', 'report', 'serviceNow']),
  HUNT_CHANGED: Object.freeze(['result', 'disposition', 'report', 'serviceNow']),
  KQL_CHANGED: Object.freeze(['result', 'disposition', 'report', 'serviceNow']),
  RESULT_CHANGED: Object.freeze(['disposition', 'report', 'serviceNow']),
  DISPOSITION_CHANGED: Object.freeze(['report', 'serviceNow']),
  NOTE_CHANGED: Object.freeze(['report']),
});

const ARTIFACT_ORDER = Object.freeze(['relevance', 'hunt', 'result', 'disposition', 'report', 'serviceNow']);

export function fingerprintDependency(type, value) {
  if (typeof type !== 'string' || !type) throw new TypeError('invalid investigation dependency type');
  return sha256Hex(`${type}\n${canonicalJson(value)}`);
}

export function invalidateInvestigation(current, changeType) {
  const targets = INVESTIGATION_INVALIDATION[changeType];
  if (!targets) throw new TypeError('invalid investigation change type');
  const next = clone(current);
  const stale = new Map((next.freshness?.stale ?? []).map(item => [item.artifact, item.reason]));
  for (const artifact of targets) {
    if (next.workflow?.[artifact] !== null && next.workflow?.[artifact] !== undefined) stale.set(artifact, changeType);
  }
  next.freshness = {
    dependencies: clone(next.freshness?.dependencies ?? {}),
    stale: ARTIFACT_ORDER.filter(artifact => stale.has(artifact)).map(artifact => ({ artifact, reason: stale.get(artifact) })),
  };
  return deepFreeze(next);
}

export function clearStaleArtifacts(current, artifacts) {
  const cleared = new Set(artifacts);
  const next = clone(current);
  next.freshness.stale = next.freshness.stale.filter(item => !cleared.has(item.artifact));
  return deepFreeze(next);
}

