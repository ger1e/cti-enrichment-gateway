import { diffEvidenceSnapshots } from '../src/core/semantic-diff.js';
import { SUPPORTED_OBSERVABLE_TYPES } from './observable-input.js';

export const CASE_SCHEMA_VERSION = '1.0';
export const CASE_LIMITS = Object.freeze({
  title: 120,
  note: 4000,
  pins: 256,
  notes: 500,
  snapshots: 500,
  diffs: 500,
});

const clone = value => structuredClone(value);
const fail = code => { throw new Error(code); };

export function observableKey({ type, value } = {}) {
  return `${String(type)}\u0000${String(value)}`;
}

function validateObservable(observable) {
  if (!observable || !SUPPORTED_OBSERVABLE_TYPES.includes(observable.type) || typeof observable.value !== 'string' || observable.value.length === 0) {
    fail('case_observable_invalid');
  }
  return { type: observable.type, value: observable.value };
}

function validateTitle(title) {
  if (typeof title !== 'string' || title.length === 0 || title.length > CASE_LIMITS.title) fail('case_title_invalid');
}

function validateNote(text) {
  if (typeof text !== 'string' || text.length === 0 || text.length > CASE_LIMITS.note) fail('case_note_invalid');
}

function requireCase(caseValue) {
  if (!caseValue || caseValue.schemaVersion !== CASE_SCHEMA_VERSION || typeof caseValue.id !== 'string' || !caseValue.id) fail('case_schema_invalid');
  validateTitle(caseValue.title);
  for (const field of ['notes', 'pins', 'snapshots', 'diffs']) {
    if (!Array.isArray(caseValue[field])) fail('case_schema_invalid');
  }
  return caseValue;
}

export function validateCaseValue(caseValue) {
  requireCase(caseValue);
  if (caseValue.pins.length > CASE_LIMITS.pins) fail('case_pin_limit');
  if (caseValue.notes.length > CASE_LIMITS.notes) fail('case_note_limit');
  if (caseValue.snapshots.length > CASE_LIMITS.snapshots) fail('case_snapshot_limit');
  if (caseValue.diffs.length > CASE_LIMITS.diffs) fail('case_diff_limit');
  for (const pin of caseValue.pins) validateObservable(pin);
  for (const note of caseValue.notes) validateNote(note?.text);
  return true;
}

export function createCase({ title, now = () => new Date().toISOString(), uuid = () => crypto.randomUUID() } = {}) {
  validateTitle(title);
  const timestamp = now();
  return {
    schemaVersion: CASE_SCHEMA_VERSION,
    id: uuid(),
    title,
    createdAt: timestamp,
    updatedAt: timestamp,
    notes: [],
    pins: [],
    snapshots: [],
    diffs: [],
  };
}

export function addNote(caseValue, text, { now = () => new Date().toISOString(), uuid = () => crypto.randomUUID() } = {}) {
  requireCase(caseValue);
  validateNote(text);
  if (caseValue.notes.length >= CASE_LIMITS.notes) fail('case_note_limit');
  const next = clone(caseValue);
  const timestamp = now();
  next.notes.push({ id: uuid(), text, addedAt: timestamp });
  next.updatedAt = timestamp;
  return next;
}

export function addPin(caseValue, observable, { now = () => new Date().toISOString() } = {}) {
  requireCase(caseValue);
  const canonical = validateObservable(observable);
  if (caseValue.pins.length >= CASE_LIMITS.pins) fail('case_pin_limit');
  const key = observableKey(canonical);
  if (caseValue.pins.some(pin => observableKey(pin) === key)) fail('case_pin_duplicate');
  const next = clone(caseValue);
  const timestamp = now();
  next.pins.push({ ...canonical, addedAt: timestamp });
  next.updatedAt = timestamp;
  return next;
}

export function removePin(caseValue, observable, { now } = {}) {
  requireCase(caseValue);
  const canonical = validateObservable(observable);
  const key = observableKey(canonical);
  const next = clone(caseValue);
  next.pins = next.pins.filter(pin => observableKey(pin) !== key);
  if (next.pins.length !== caseValue.pins.length && typeof now === 'function') next.updatedAt = now();
  return next;
}

export function latestSnapshot(caseValue, observable) {
  requireCase(caseValue);
  const canonical = validateObservable(observable);
  const matches = caseValue.snapshots.filter(snapshot => snapshot?.type === canonical.type && snapshot?.indicator === canonical.value);
  if (!matches.length) return null;
  return clone(matches.reduce((latest, snapshot) => {
    if (!latest) return snapshot;
    const timeOrder = String(snapshot.capturedAt ?? '').localeCompare(String(latest.capturedAt ?? ''));
    if (timeOrder > 0) return snapshot;
    if (timeOrder === 0 && String(snapshot.id ?? '').localeCompare(String(latest.id ?? '')) > 0) return snapshot;
    return latest;
  }, null));
}

export function appendSnapshot(caseValue, enrichment, { now = () => new Date().toISOString(), uuid = () => crypto.randomUUID() } = {}) {
  requireCase(caseValue);
  if (caseValue.snapshots.length >= CASE_LIMITS.snapshots) fail('case_snapshot_limit');
  if (!enrichment || typeof enrichment.type !== 'string' || typeof enrichment.indicator !== 'string' || typeof enrichment.requestId !== 'string') fail('case_snapshot_invalid');
  validateObservable({ type: enrichment.type, value: enrichment.indicator });

  const previous = latestSnapshot(caseValue, { type: enrichment.type, value: enrichment.indicator });
  if (previous && caseValue.diffs.length >= CASE_LIMITS.diffs) fail('case_diff_limit');

  const timestamp = now();
  const next = clone(caseValue);
  const snapshot = {
    id: uuid(),
    type: enrichment.type,
    indicator: enrichment.indicator,
    capturedAt: timestamp,
    requestId: enrichment.requestId,
    evidence: clone(enrichment),
  };
  next.snapshots.push(snapshot);

  if (previous) {
    next.diffs.push({
      id: uuid(),
      type: enrichment.type,
      indicator: enrichment.indicator,
      capturedAt: timestamp,
      fromSnapshotId: previous.id,
      toSnapshotId: snapshot.id,
      diff: diffEvidenceSnapshots(previous.evidence, enrichment),
    });
  }

  next.updatedAt = timestamp;
  return next;
}
