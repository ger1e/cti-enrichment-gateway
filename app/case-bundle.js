import { validateCaseValue } from './case-model.js';
import { SUPPORTED_OBSERVABLE_TYPES } from './observable-input.js';

export const CASE_BUNDLE_MEDIA_TYPE = 'application/vnd.para11ax.case+json';
export const MAX_CASE_BUNDLE_BYTES = 8 * 1024 * 1024;

const FORMAT = 'para11ax-case';
const VERSION = '1.0';
const TOP_LEVEL_KEYS = Object.freeze(['case', 'exportedAt', 'format', 'version']);
const FORBIDDEN_KEYS = new Set([
  'authorization',
  'para11ax_token',
  'provider_credentials',
  'session',
]);

const clone = value => structuredClone(value);
const fail = code => { throw new Error(code); };

function utf8Length(text) {
  return new TextEncoder().encode(text).byteLength;
}

function assertNoForbiddenKeys(value) {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (const item of value) assertNoForbiddenKeys(item);
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) fail('case_bundle_forbidden_key');
    assertNoForbiddenKeys(child);
  }
}

function assertSupportedType(type, supported) {
  if (typeof type !== 'string' || !supported.has(type)) fail('case_bundle_observable_type_unsupported');
}

function assertObservableAdmission(caseValue, supportedTypes) {
  const supported = new Set(Array.isArray(supportedTypes) ? supportedTypes : []);

  for (const pin of Array.isArray(caseValue?.pins) ? caseValue.pins : []) {
    assertSupportedType(pin?.type, supported);
  }
  for (const snapshot of Array.isArray(caseValue?.snapshots) ? caseValue.snapshots : []) {
    assertSupportedType(snapshot?.type, supported);
    if (snapshot?.evidence && Object.prototype.hasOwnProperty.call(snapshot.evidence, 'type')) {
      assertSupportedType(snapshot.evidence.type, supported);
    }
  }
  for (const diff of Array.isArray(caseValue?.diffs) ? caseValue.diffs : []) {
    assertSupportedType(diff?.type, supported);
  }
}

function assertEvidenceMinimum(snapshot) {
  const evidence = snapshot?.evidence;
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) fail('case_bundle_evidence_invalid');
  if (typeof evidence.schemaVersion !== 'string' || !evidence.schemaVersion) fail('case_bundle_evidence_invalid');
  if (typeof evidence.requestId !== 'string' || !evidence.requestId) fail('case_bundle_evidence_invalid');
  if (typeof evidence.indicator !== 'string' || !evidence.indicator) fail('case_bundle_evidence_invalid');
  if (typeof evidence.type !== 'string' || !evidence.type) fail('case_bundle_evidence_invalid');
  if (!Array.isArray(evidence.evidence) || !Array.isArray(evidence.relationships) || !Array.isArray(evidence.failures)) {
    fail('case_bundle_evidence_invalid');
  }
  if (evidence.indicator !== snapshot.indicator || evidence.type !== snapshot.type || evidence.requestId !== snapshot.requestId) {
    fail('case_bundle_evidence_invalid');
  }
}

function validateBundleCase(caseValue, supportedTypes) {
  if (!caseValue || typeof caseValue !== 'object' || Array.isArray(caseValue)) fail('case_bundle_schema_invalid');
  assertNoForbiddenKeys(caseValue);
  assertObservableAdmission(caseValue, supportedTypes);
  validateCaseValue(caseValue);
  for (const snapshot of caseValue.snapshots) assertEvidenceMinimum(snapshot);
  return true;
}

function assertEnvelopeShape(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('case_bundle_schema_invalid');
  const keys = Object.keys(value).sort((a, b) => a.localeCompare(b));
  if (keys.length !== TOP_LEVEL_KEYS.length || keys.some((key, index) => key !== TOP_LEVEL_KEYS[index])) {
    fail('case_bundle_schema_invalid');
  }
  if (value.format !== FORMAT) fail('case_bundle_schema_invalid');
  if (value.version !== VERSION) fail('case_bundle_version_unsupported');
  if (typeof value.exportedAt !== 'string' || !value.exportedAt || Number.isNaN(Date.parse(value.exportedAt))) {
    fail('case_bundle_schema_invalid');
  }
}

export function serializeCaseBundle(caseValue, { now = () => new Date().toISOString() } = {}) {
  validateBundleCase(caseValue, SUPPORTED_OBSERVABLE_TYPES);
  const envelope = {
    format: FORMAT,
    version: VERSION,
    exportedAt: now(),
    case: clone(caseValue),
  };
  assertEnvelopeShape(envelope);
  assertNoForbiddenKeys(envelope.case);
  const text = JSON.stringify(envelope);
  if (utf8Length(text) > MAX_CASE_BUNDLE_BYTES) fail('case_bundle_too_large');
  return text;
}

export function parseCaseBundle(text, { supportedTypes = SUPPORTED_OBSERVABLE_TYPES } = {}) {
  if (typeof text !== 'string') fail('case_bundle_invalid');
  if (utf8Length(text) > MAX_CASE_BUNDLE_BYTES) fail('case_bundle_too_large');

  let envelope;
  try {
    envelope = JSON.parse(text);
  } catch {
    fail('case_bundle_invalid');
  }

  assertEnvelopeShape(envelope);
  assertNoForbiddenKeys(envelope.case);
  validateBundleCase(envelope.case, supportedTypes);
  return clone(envelope.case);
}
