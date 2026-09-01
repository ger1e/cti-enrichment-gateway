import { sha256Hex } from '../sha256.js';
import { normalizeClientProfile } from './client-profile.js';
import { assessClientRelevance } from './relevance.js';
import { validateMissionKql } from './kql-validator.js';

const MAX_TEXT = 2_048;
const MAX_LIST = 64;
const MAX_KQL = 8;
const FINGERPRINT = /^[0-9a-f]{64}$/i;
const ATTACK_ID = /^T\d{4}(?:\.\d{3})?$/i;

function fail(field) {
  throw new TypeError(`invalid hunt package: ${field}`);
}

function text(value, field, { required = false, max = MAX_TEXT } = {}) {
  if (value == null && !required) return '';
  if (typeof value !== 'string') fail(field);
  const out = value.trim();
  if ((required && !out) || out.length > max) fail(field);
  return out;
}

function normalizedList(value, field, { validate = null, lowercase = false, max = MAX_LIST } = {}) {
  if (value == null) return Object.freeze([]);
  if (!Array.isArray(value) || value.length > max) fail(field);
  const out = value.map((item, index) => {
    const clean = text(item, `${field}[${index}]`, { required: true, max: 512 });
    const normalized = lowercase ? clean.toLowerCase() : clean;
    if (validate && !validate(normalized)) fail(field);
    return normalized;
  });
  return Object.freeze([...new Set(out)].sort((a, b) => a.localeCompare(b)));
}

function sourceReferences(value) {
  return normalizedList(value, 'source reference', {
    validate: item => {
      try {
        const parsed = new URL(item);
        return (parsed.protocol === 'https:' || parsed.protocol === 'http:') && !parsed.username && !parsed.password;
      } catch {
        return false;
      }
    },
  });
}

function stateFor({ hasProvenance, requiredTelemetry, telemetryGaps, candidates }) {
  if (!hasProvenance) return 'INSUFFICIENT_EVIDENCE';
  if (requiredTelemetry.length === 0 || telemetryGaps.length > 0) return 'TELEMETRY_GAP';
  if (candidates.some(candidate => candidate.validation.state !== 'VALID')) return 'SCHEMA_UNVERIFIED';
  return 'READY';
}

export function buildHuntPackage(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('root');
  const profile = normalizeClientProfile(input.profile);
  const context = input.context && typeof input.context === 'object' && !Array.isArray(input.context) ? input.context : {};
  const hypothesis = text(input.hypothesis, 'hypothesis', { required: true });
  const subject = text(input.subject, 'subject', { required: true, max: 512 });
  const attackIds = normalizedList(input.attackIds, 'ATT&CK identifier', { validate: item => ATTACK_ID.test(item) })
    .map(item => item.toUpperCase());
  const frozenAttackIds = Object.freeze([...new Set(attackIds)].sort((a, b) => a.localeCompare(b)));
  const evidenceFingerprints = normalizedList(input.evidenceFingerprints, 'fingerprint', { validate: item => FINGERPRINT.test(item), lowercase: true });
  const sources = sourceReferences(input.sourceReferences);
  const requiredTelemetry = normalizedList(context.requiredTelemetry, 'required telemetry', { lowercase: true });
  const availableSet = new Set(profile.telemetry);
  const availableTelemetry = Object.freeze(requiredTelemetry.filter(item => availableSet.has(item)));
  const telemetryGaps = Object.freeze(requiredTelemetry.filter(item => !availableSet.has(item)));
  const relevance = assessClientRelevance(profile, context);

  if (input.kqlCandidates != null && (!Array.isArray(input.kqlCandidates) || input.kqlCandidates.length > MAX_KQL)) fail('kqlCandidates');
  const queries = (input.kqlCandidates ?? []).map((query, index) => text(query, `kqlCandidates[${index}]`, { required: true, max: 32_000 }));
  const kqlCandidates = Object.freeze([...new Set(queries)]
    .sort((a, b) => a.localeCompare(b))
    .map(query => Object.freeze({ query, validation: validateMissionKql(query) })));

  const hasProvenance = evidenceFingerprints.length > 0 || sources.length > 0;
  const state = stateFor({ hasProvenance, requiredTelemetry, telemetryGaps, candidates: kqlCandidates });
  const limitations = [];
  if (!hasProvenance) limitations.push('provenance_missing');
  if (requiredTelemetry.length === 0) limitations.push('required_telemetry_unspecified');
  if (telemetryGaps.length > 0) limitations.push('telemetry_gap');
  if (kqlCandidates.length === 0) limitations.push('no_kql_candidate');
  if (kqlCandidates.some(candidate => candidate.validation.state !== 'VALID')) limitations.push('kql_schema_unverified');
  const frozenLimitations = Object.freeze([...new Set(limitations)].sort((a, b) => a.localeCompare(b)));

  const identity = JSON.stringify({
    profileId: profile.id,
    subject,
    hypothesis,
    attackIds: frozenAttackIds,
    requiredTelemetry,
    evidenceFingerprints,
    sourceReferences: sources,
    kql: kqlCandidates.map(candidate => candidate.query),
  });
  const id = `HNT-${sha256Hex(identity).slice(0, 16)}`;

  return Object.freeze({
    schemaVersion: 'mission-hunt-v1.0',
    id,
    profileId: profile.id,
    profileName: profile.name,
    state,
    subject,
    hypothesis,
    attackIds: frozenAttackIds,
    requiredTelemetry,
    availableTelemetry,
    telemetryGaps,
    evidenceFingerprints,
    sourceReferences: sources,
    relevance,
    kqlCandidates,
    limitations: frozenLimitations,
  });
}
