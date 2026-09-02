import { isObservableType, observablePolicy } from '../observable-registry.js';
import {
  INVESTIGATION_CONFIDENCE,
  INVESTIGATION_DISPOSITIONS,
  INVESTIGATION_FORMAT,
  INVESTIGATION_LIMITS,
  INVESTIGATION_PHASES,
  INVESTIGATION_READINESS,
  INVESTIGATION_SCHEMA_VERSION,
} from './constants.js';
import { assertPlainJsonTree, canonicalize, clone, deepFreeze, encodedBytes, sameCanonicalJson } from './canonical.js';
import { deriveInvestigationStatus } from './status.js';

const TOP_LEVEL = Object.freeze([
  'format', 'version', 'id', 'title', 'createdAt', 'updatedAt', 'revision', 'scope', 'observables',
  'evidenceSnapshots', 'operatorArtifacts', 'workflow', 'notes', 'timeline', 'freshness', 'status', 'limitations',
]);
const WORKFLOW_KEYS = Object.freeze(['relevance', 'hunt', 'kqlValidations', 'result', 'disposition', 'serviceNow', 'report']);
const CONTROL = /[\u0000-\u001F\u007F]/;

const fail = reason => { throw new TypeError(`invalid investigation: ${reason}`); };

function assertExactKeys(value, keys, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(`${field} object`);
  const actual = Object.keys(value).sort((a, b) => a.localeCompare(b));
  const expected = [...keys].sort((a, b) => a.localeCompare(b));
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) fail(`${field} keys`);
}

function assertText(value, minimum, maximum, field) {
  if (typeof value !== 'string' || value.length < minimum || value.length > maximum || CONTROL.test(value)) fail(field);
  return value;
}

function assertIdentifier(value, field) {
  assertText(value, 1, 160, field);
}

function assertTimestamp(value, field) {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) fail(`${field} timestamp`);
  try {
    if (new Date(value).toISOString() !== value) fail(`${field} timestamp`);
  } catch {
    fail(`${field} timestamp`);
  }
}

function assertCollection(value, limit, field) {
  if (!Array.isArray(value)) fail(field);
  if (value.length > limit) fail(`${field} limit`);
}

function validateScope(scope) {
  assertExactKeys(scope, ['profile', 'context'], 'scope');
  for (const field of ['profile', 'context']) {
    if (scope[field] !== null && (!scope[field] || typeof scope[field] !== 'object' || Array.isArray(scope[field]))) fail(`scope ${field}`);
  }
}

function validateObservables(observables) {
  assertCollection(observables, INVESTIGATION_LIMITS.observables, 'observables');
  const seen = new Set();
  for (const observable of observables) {
    assertExactKeys(observable, ['type', 'value', 'addedAt'], 'observable');
    if (!isObservableType(observable.type)) fail('observable type');
    assertText(observable.value, 1, observablePolicy(observable.type).maxLength, 'observable value');
    assertTimestamp(observable.addedAt, 'observable addedAt');
    const key = `${observable.type}\u0000${observable.value}`;
    if (seen.has(key)) fail('duplicate observable');
    seen.add(key);
  }
}

function validateEvidenceSnapshots(snapshots) {
  assertCollection(snapshots, INVESTIGATION_LIMITS.evidenceSnapshots, 'evidenceSnapshots');
  const ids = new Set();
  for (const snapshot of snapshots) {
    assertExactKeys(snapshot, ['id', 'type', 'indicator', 'capturedAt', 'requestId', 'evidence', 'diffFromPrevious'], 'evidence snapshot');
    assertIdentifier(snapshot.id, 'evidence snapshot id');
    if (ids.has(snapshot.id)) fail('duplicate evidence snapshot');
    ids.add(snapshot.id);
    if (!isObservableType(snapshot.type)) fail('evidence snapshot type');
    assertText(snapshot.indicator, 1, observablePolicy(snapshot.type).maxLength, 'evidence snapshot indicator');
    assertTimestamp(snapshot.capturedAt, 'evidence snapshot capturedAt');
    assertIdentifier(snapshot.requestId, 'evidence snapshot requestId');
    if (!snapshot.evidence || typeof snapshot.evidence !== 'object' || Array.isArray(snapshot.evidence)) fail('evidence snapshot evidence');
    if (snapshot.evidence.schemaVersion !== '2.0' || snapshot.evidence.type !== snapshot.type || snapshot.evidence.indicator !== snapshot.indicator || snapshot.evidence.requestId !== snapshot.requestId) fail('evidence snapshot mismatch');
    if (!Array.isArray(snapshot.evidence.evidence) || !Array.isArray(snapshot.evidence.relationships) || !Array.isArray(snapshot.evidence.failures)) fail('evidence snapshot shape');
    if (snapshot.diffFromPrevious !== null && (!snapshot.diffFromPrevious || typeof snapshot.diffFromPrevious !== 'object' || Array.isArray(snapshot.diffFromPrevious))) fail('evidence snapshot diff');
  }
}

function validateReferences(references, field) {
  assertCollection(references, INVESTIGATION_LIMITS.references, field);
  for (const reference of references) {
    assertText(reference, 1, 2048, field);
    let url;
    try { url = new URL(reference); } catch { fail(`${field} https URL`); }
    if (url.protocol !== 'https:') fail(`${field} https URL`);
  }
}

function validateOperatorArtifacts(artifacts) {
  assertCollection(artifacts, INVESTIGATION_LIMITS.operatorArtifacts, 'operatorArtifacts');
  const ids = new Set();
  for (const artifact of artifacts) {
    assertExactKeys(artifact, ['id', 'kind', 'capturedAt', 'source', 'summary', 'references'], 'operator artifact');
    assertIdentifier(artifact.id, 'operator artifact id');
    if (ids.has(artifact.id)) fail('duplicate operator artifact');
    ids.add(artifact.id);
    assertText(artifact.kind, 1, 64, 'operator artifact kind');
    assertTimestamp(artifact.capturedAt, 'operator artifact capturedAt');
    assertText(artifact.source, 1, 160, 'operator artifact source');
    assertText(artifact.summary, 1, INVESTIGATION_LIMITS.text, 'operator artifact summary');
    validateReferences(artifact.references, 'operator artifact references');
  }
}

function validateWorkflow(workflow) {
  assertExactKeys(workflow, WORKFLOW_KEYS, 'workflow');
  assertCollection(workflow.kqlValidations, INVESTIGATION_LIMITS.kqlValidations, 'KQL validations');
  for (const key of WORKFLOW_KEYS) {
    if (key === 'kqlValidations') continue;
    if (workflow[key] !== null && (!workflow[key] || typeof workflow[key] !== 'object' || Array.isArray(workflow[key]))) fail(`workflow ${key}`);
  }
  if (workflow.disposition !== null) {
    assertExactKeys(workflow.disposition, ['state', 'confidence', 'rationale', 'artifactIds', 'limitations'], 'disposition');
    if (!INVESTIGATION_DISPOSITIONS.includes(workflow.disposition.state)) fail('disposition state');
    if (!INVESTIGATION_CONFIDENCE.includes(workflow.disposition.confidence)) fail('disposition confidence');
  }
}

function validateNotes(notes) {
  assertCollection(notes, INVESTIGATION_LIMITS.notes, 'notes');
  for (const note of notes) {
    assertExactKeys(note, ['id', 'at', 'text'], 'note');
    assertIdentifier(note.id, 'note id');
    assertTimestamp(note.at, 'note at');
    assertText(note.text, 1, INVESTIGATION_LIMITS.text, 'note text');
  }
}

function validateTimeline(timeline) {
  assertCollection(timeline, INVESTIGATION_LIMITS.timeline, 'timeline');
  for (const entry of timeline) {
    assertExactKeys(entry, ['id', 'at', 'action', 'details'], 'timeline record');
    assertIdentifier(entry.id, 'timeline id');
    assertTimestamp(entry.at, 'timeline at');
    assertText(entry.action, 1, 96, 'timeline action');
    if (!entry.details || typeof entry.details !== 'object' || Array.isArray(entry.details)) fail('timeline details');
  }
}

function validateFreshness(freshness) {
  assertExactKeys(freshness, ['dependencies', 'stale'], 'freshness');
  if (!freshness.dependencies || typeof freshness.dependencies !== 'object' || Array.isArray(freshness.dependencies)) fail('freshness dependencies');
  for (const fingerprint of Object.values(freshness.dependencies)) {
    if (typeof fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(fingerprint)) fail('freshness fingerprint');
  }
  if (!Array.isArray(freshness.stale)) fail('freshness stale');
}

function validateStatus(status, investigation) {
  if (status === null) return;
  assertExactKeys(status, ['phase', 'readiness', 'currentArtifacts', 'staleArtifacts', 'gaps', 'nextActions', 'exportReady', 'reportReady', 'limitations'], 'status');
  if (!INVESTIGATION_PHASES.includes(status.phase)) fail('status phase');
  if (!INVESTIGATION_READINESS.includes(status.readiness)) fail('status readiness');
  for (const field of ['currentArtifacts', 'staleArtifacts', 'gaps', 'nextActions', 'limitations']) {
    if (!Array.isArray(status[field])) fail(`status ${field}`);
  }
  if (typeof status.exportReady !== 'boolean' || typeof status.reportReady !== 'boolean') fail('status readiness flags');
  if (!sameCanonicalJson(status, deriveInvestigationStatus(investigation))) fail('status mismatch');
}

function validateLimitations(limitations) {
  assertCollection(limitations, INVESTIGATION_LIMITS.limitations, 'limitations');
  const normalized = [];
  for (const value of limitations) normalized.push(assertText(value, 1, 256, 'limitation'));
  if (new Set(normalized).size !== normalized.length) fail('duplicate limitation');
}

export function createInvestigation({ title, now = () => new Date().toISOString(), uuid = () => crypto.randomUUID() } = {}) {
  if (typeof title !== 'string') fail('title');
  const normalizedTitle = title.trim();
  assertText(normalizedTitle, 1, INVESTIGATION_LIMITS.title, 'title');
  const at = now();
  assertTimestamp(at, 'createdAt');
  const id = uuid();
  assertIdentifier(id, 'id');
  return deepFreeze({
    format: INVESTIGATION_FORMAT,
    version: INVESTIGATION_SCHEMA_VERSION,
    id,
    title: normalizedTitle,
    createdAt: at,
    updatedAt: at,
    revision: 0,
    scope: { profile: null, context: null },
    observables: [],
    evidenceSnapshots: [],
    operatorArtifacts: [],
    workflow: { relevance: null, hunt: null, kqlValidations: [], result: null, disposition: null, serviceNow: null, report: null },
    notes: [],
    timeline: [],
    freshness: { dependencies: {}, stale: [] },
    status: null,
    limitations: [],
  });
}

export function importInvestigation(input) {
  if (typeof input === 'string' && encodedBytes(input) > INVESTIGATION_LIMITS.bundleBytes) fail('input too large');
  let value = input;
  if (typeof input === 'string') {
    try { value = JSON.parse(input); } catch { fail('malformed JSON'); }
  }
  assertPlainJsonTree(value);
  assertExactKeys(value, TOP_LEVEL, 'top-level');
  if (value.format !== INVESTIGATION_FORMAT || value.version !== INVESTIGATION_SCHEMA_VERSION) fail('unsupported version');
  assertIdentifier(value.id, 'id');
  assertText(value.title, 1, INVESTIGATION_LIMITS.title, 'title');
  assertTimestamp(value.createdAt, 'createdAt');
  assertTimestamp(value.updatedAt, 'updatedAt');
  if (!Number.isSafeInteger(value.revision) || value.revision < 0) fail('revision');
  validateScope(value.scope);
  validateObservables(value.observables);
  validateEvidenceSnapshots(value.evidenceSnapshots);
  validateOperatorArtifacts(value.operatorArtifacts);
  validateWorkflow(value.workflow);
  validateNotes(value.notes);
  validateTimeline(value.timeline);
  validateFreshness(value.freshness);
  validateStatus(value.status, value);
  validateLimitations(value.limitations);
  if (encodedBytes(JSON.stringify(value)) > INVESTIGATION_LIMITS.bundleBytes) fail('input too large');
  return deepFreeze(clone(value));
}

export function validateInvestigation(value) {
  importInvestigation(value);
  return true;
}

export function exportInvestigation(value) {
  return `${JSON.stringify(canonicalize(importInvestigation(value)), null, 2)}\n`;
}
