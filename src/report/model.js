import { createHash } from 'node:crypto';
import { REPORT_SCHEMA_VERSION } from './version.js';

const MAX_EVIDENCE = 100;
const MAX_ITEMS = 256;
const MAX_TEXT = 4096;
const BEHAVIOR_STATES = new Set(['OBSERVED', 'LOOK_FOR_NEXT', 'CONTEXTUAL_NOT_OBSERVED']);
const MAPPING_STATES = new Set(['OBSERVED', 'INFERRED', 'CONTEXTUAL', 'CONTEXTUAL_NOT_OBSERVED']);

function fail(message) {
  throw new Error(`invalid report snapshot: ${message}`);
}

function object(value, field) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail(field);
  return value;
}

function text(value, field, { nullable = false, max = MAX_TEXT } = {}) {
  if (nullable && value === null) return null;
  if (typeof value !== 'string' || value.length < 1 || value.length > max) fail(field);
  return value;
}

function iso(value, field) {
  const out = text(value, field, { max: 64 });
  if (!Number.isFinite(Date.parse(out))) fail(field);
  return new Date(out).toISOString();
}

function array(value, field, max = MAX_ITEMS) {
  if (!Array.isArray(value) || value.length > max) fail(field);
  return value;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonicalize(value[key])]));
  }
  return value;
}

function sha256(value) {
  return createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex');
}

function uniqueSorted(values) {
  return [...new Set(values.filter(value => typeof value === 'string' && value.length > 0))].sort((a, b) => a.localeCompare(b));
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function evidenceId(item) {
  const fingerprint = item?.integrity?.fingerprint;
  if (typeof fingerprint !== 'string' || !/^[0-9a-f]{64}$/i.test(fingerprint)) fail('evidence.integrity.fingerprint');
  return `ev-${fingerprint.toLowerCase().slice(0, 16)}`;
}

function canonicalObservable(type, value) {
  const normalizedType = text(type, 'observable.type', { max: 32 }).toLowerCase();
  let normalizedValue = text(String(value), 'observable.value', { max: 2048 }).trim();
  if (['domain', 'hostname', 'dns'].includes(normalizedType)) normalizedValue = normalizedValue.toLowerCase();
  return { type: normalizedType, value: normalizedValue };
}

function resolveEvidenceIds(fingerprints, fingerprintToId, field) {
  return uniqueSorted(array(fingerprints ?? [], field, MAX_EVIDENCE).map(fingerprint => {
    const key = text(fingerprint, field, { max: 128 }).toLowerCase();
    const id = fingerprintToId.get(key);
    if (!id) fail(`${field} unknown fingerprint`);
    return id;
  }));
}

function copyEvidence(item, index) {
  object(item, `evidence[${index}]`);
  const id = evidenceId(item);
  const observation = object(item.observation, `evidence[${index}].observation`);
  const integrity = object(item.integrity, `evidence[${index}].integrity`);
  return {
    id,
    provider: text(item.provider, `evidence[${index}].provider`, { max: 80 }),
    indicator: text(item.indicator, `evidence[${index}].indicator`, { max: 2048 }),
    type: text(item.type, `evidence[${index}].type`, { max: 32 }).toLowerCase(),
    observation: {
      kind: text(observation.kind ?? 'enrichment', `evidence[${index}].observation.kind`, { max: 128 }),
      verdict: text(observation.verdict ?? 'unknown', `evidence[${index}].observation.verdict`, { max: 128 }),
      confidence: Number.isFinite(observation.confidence) ? observation.confidence : null,
      firstSeen: observation.firstSeen == null ? null : iso(observation.firstSeen, `evidence[${index}].observation.firstSeen`),
      lastSeen: observation.lastSeen == null ? null : iso(observation.lastSeen, `evidence[${index}].observation.lastSeen`),
      tags: uniqueSorted(array(observation.tags ?? [], `evidence[${index}].observation.tags`, 128).map(String)),
      malwareFamily: observation.malwareFamily == null ? null : text(observation.malwareFamily, `evidence[${index}].observation.malwareFamily`, { max: 256 }),
      actor: observation.actor == null ? null : text(observation.actor, `evidence[${index}].observation.actor`, { max: 256 }),
      attributes: clone(object(observation.attributes ?? {}, `evidence[${index}].observation.attributes`)),
    },
    relationships: clone(array(item.relationships ?? [], `evidence[${index}].relationships`, 128)),
    references: uniqueSorted(array(item.references ?? [], `evidence[${index}].references`, 128).map(String)),
    retrievedAt: iso(item.retrievedAt, `evidence[${index}].retrievedAt`),
    cacheState: text(item.cacheState ?? 'unknown', `evidence[${index}].cacheState`, { max: 32 }),
    durationMs: Number.isFinite(item.durationMs) ? Math.max(0, item.durationMs) : 0,
    integrity: {
      rawHash: integrity.rawHash == null ? null : text(integrity.rawHash, `evidence[${index}].integrity.rawHash`, { max: 256 }),
      parserVersion: text(integrity.parserVersion, `evidence[${index}].integrity.parserVersion`, { max: 128 }),
      fingerprint: text(integrity.fingerprint, `evidence[${index}].integrity.fingerprint`, { max: 128 }).toLowerCase(),
    },
  };
}

function buildAttackMappings(evidence, behaviors) {
  const map = new Map();
  const rank = { CONTEXTUAL_NOT_OBSERVED: 1, CONTEXTUAL: 1, INFERRED: 2, OBSERVED: 3 };
  const add = (id, mappingState, evidenceIds = []) => {
    if (typeof id !== 'string' || !id) return;
    const current = map.get(id) ?? { id, mappingState, evidenceIds: [] };
    if ((rank[mappingState] ?? 0) > (rank[current.mappingState] ?? 0)) current.mappingState = mappingState;
    current.evidenceIds = uniqueSorted([...current.evidenceIds, ...evidenceIds]);
    map.set(id, current);
  };
  for (const item of evidence) {
    const ids = Array.isArray(item.observation.attributes?.attackIds) ? item.observation.attributes.attackIds : [];
    for (const id of ids) add(String(id), 'OBSERVED', [item.id]);
  }
  for (const behavior of behaviors) for (const id of behavior.attackIds) add(id, behavior.mappingState, behavior.evidenceIds);
  return [...map.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function buildReportModel(snapshot, options = {}) {
  object(snapshot, 'root');
  const evidenceInput = array(snapshot.evidence, 'evidence', MAX_EVIDENCE);
  if (evidenceInput.length < 1) fail('evidence empty');
  const generatedAt = iso(options.generatedAt, 'generatedAt');
  const sourceSha = options.sourceSha == null ? null : text(options.sourceSha, 'sourceSha', { max: 64 });
  if (sourceSha !== null && !/^[0-9a-f]{40}$/i.test(sourceSha)) fail('sourceSha');
  const subject = canonicalObservable(snapshot.type, snapshot.indicator);
  const queriedAt = iso(snapshot.queriedAt, 'queriedAt');
  const snapshotSha256 = sha256(snapshot);

  const evidence = evidenceInput.map(copyEvidence);
  const evidenceIndex = {};
  const fingerprintToId = new Map();
  for (const item of evidence) {
    if (evidenceIndex[item.id]) fail('duplicate evidence id');
    evidenceIndex[item.id] = item;
    fingerprintToId.set(item.integrity.fingerprint, item.id);
  }

  const relationshipInput = array(snapshot.relationships ?? [], 'relationships', MAX_ITEMS);
  const observableMap = new Map([[`${subject.type}\u0000${subject.value}`, subject]]);
  for (const relation of relationshipInput) {
    if (!relation || typeof relation !== 'object' || relation.value == null || relation.type == null) continue;
    const observable = canonicalObservable(relation.type, relation.value);
    observableMap.set(`${observable.type}\u0000${observable.value}`, observable);
  }
  const observables = [...observableMap.values()].sort((a, b) => a.type.localeCompare(b.type) || a.value.localeCompare(b.value));

  const context = snapshot.reportContext && typeof snapshot.reportContext === 'object' ? snapshot.reportContext : {};
  const suspiciousBehavior = array(context.behaviors ?? [], 'reportContext.behaviors', 64).map((item, index) => {
    object(item, `reportContext.behaviors[${index}]`);
    const state = text(item.state, `reportContext.behaviors[${index}].state`, { max: 64 });
    const mappingState = text(item.mappingState, `reportContext.behaviors[${index}].mappingState`, { max: 64 });
    if (!BEHAVIOR_STATES.has(state)) fail(`reportContext.behaviors[${index}].state`);
    if (!MAPPING_STATES.has(mappingState)) fail(`reportContext.behaviors[${index}].mappingState`);
    return {
      id: text(item.id, `reportContext.behaviors[${index}].id`, { max: 128 }),
      state,
      mappingState,
      title: text(item.title, `reportContext.behaviors[${index}].title`),
      evidenceIds: resolveEvidenceIds(item.evidenceFingerprints, fingerprintToId, `reportContext.behaviors[${index}].evidenceFingerprints`),
      attackIds: uniqueSorted(array(item.attackIds ?? [], `reportContext.behaviors[${index}].attackIds`, 32).map(String)),
    };
  });

  const generatedHunts = Array.isArray(snapshot.decision?.huntPlan) ? snapshot.decision.huntPlan : [];
  const huntInput = Object.prototype.hasOwnProperty.call(context, 'huntOpportunities') ? context.huntOpportunities : generatedHunts;
  const huntOpportunities = array(huntInput ?? [], 'reportContext.huntOpportunities', 64).map((item, index) => {
    object(item, `reportContext.huntOpportunities[${index}]`);
    return {
      id: text(item.id, `reportContext.huntOpportunities[${index}].id`, { max: 128 }),
      hypothesis: text(item.hypothesis, `reportContext.huntOpportunities[${index}].hypothesis`),
      telemetry: uniqueSorted(array(item.telemetry ?? [], `reportContext.huntOpportunities[${index}].telemetry`, 64).map(String)),
      evidenceIds: resolveEvidenceIds(item.evidenceFingerprints, fingerprintToId, `reportContext.huntOpportunities[${index}].evidenceFingerprints`),
      kql: item.kql == null ? null : text(item.kql, `reportContext.huntOpportunities[${index}].kql`, { max: 32_000 }),
    };
  });

  const keyFindings = evidence.map(item => ({
    id: `finding-${item.id.slice(3)}`,
    state: 'OBSERVED',
    title: `${item.provider}: ${item.observation.kind} — ${item.observation.verdict}`,
    evidenceIds: [item.id],
  }));

  const sources = uniqueSorted([
    ...evidence.flatMap(item => item.references),
    ...(Array.isArray(snapshot.huntContext?.sourceReferences) ? snapshot.huntContext.sourceReferences.map(String) : []),
  ]);
  const limitations = uniqueSorted([
    ...(Array.isArray(snapshot.limitations) ? snapshot.limitations.map(String) : []),
    ...(Array.isArray(snapshot.correlation?.limitations) ? snapshot.correlation.limitations.map(String) : []),
  ]);
  const actors = uniqueSorted(evidence.map(item => item.observation.actor).filter(Boolean));
  const malware = uniqueSorted(evidence.map(item => item.observation.malwareFamily).filter(Boolean));
  const attack = buildAttackMappings(evidence, suspiciousBehavior);
  const timeline = evidence.flatMap(item => [
    item.observation.firstSeen ? { at: item.observation.firstSeen, kind: 'first_seen', evidenceId: item.id } : null,
    item.observation.lastSeen ? { at: item.observation.lastSeen, kind: 'last_seen', evidenceId: item.id } : null,
    { at: item.retrievedAt, kind: 'retrieved', evidenceId: item.id },
  ]).filter(Boolean).sort((a, b) => a.at.localeCompare(b.at) || a.kind.localeCompare(b.kind) || a.evidenceId.localeCompare(b.evidenceId));

  const reproducibility = {
    snapshotSha256,
    generatedAt,
    sourceSha,
    gatewayVersion: text(snapshot.gatewayVersion, 'gatewayVersion', { max: 64 }),
    evidenceSchemaVersion: text(snapshot.schemaVersion, 'schemaVersion', { max: 64 }),
  };
  const reportId = `rpt-${sha256({ snapshotSha256, generatedAt, sourceSha }).slice(0, 24)}`;

  return {
    reportSchemaVersion: REPORT_SCHEMA_VERSION,
    reportId,
    generatedAt,
    tlp: typeof context.tlp === 'string' ? context.tlp : 'CLEAR',
    subject,
    source: {
      queriedAt,
      requestId: typeof snapshot.requestId === 'string' ? snapshot.requestId : null,
      sourceSha,
      gatewayVersion: snapshot.gatewayVersion,
      evidenceSchemaVersion: snapshot.schemaVersion,
      profile: typeof snapshot.profile === 'string' ? snapshot.profile : null,
      status: typeof snapshot.status === 'string' ? snapshot.status : null,
    },
    executiveAssessment: clone(snapshot.correlation?.assessment ?? snapshot.decision?.assessment ?? null),
    keyFindings,
    suspiciousBehavior,
    evidence,
    evidenceIndex,
    observables,
    threatContext: { actors, malware, infrastructure: observables.filter(item => item.type !== subject.type || item.value !== subject.value) },
    relationships: clone(relationshipInput),
    timeline,
    frameworks: {
      attack,
      killChain: [],
      pyramidOfPain: [],
      diamondModel: [],
    },
    huntOpportunities,
    contradictions: clone(Array.isArray(snapshot.correlation?.contradictions) ? snapshot.correlation.contradictions : []),
    actions: [],
    gaps: clone(Array.isArray(snapshot.failures) ? snapshot.failures : []),
    limitations,
    sources,
    coverage: clone(snapshot.coverage ?? null),
    providerSummary: clone(snapshot.providerSummary ?? null),
    reproducibility,
  };
}
