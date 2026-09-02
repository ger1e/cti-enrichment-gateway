export const INVESTIGATION_SCHEMA_VERSION = '2.0';
export const INVESTIGATION_FORMAT = 'para11ax-investigation-v2.0';

export const INVESTIGATION_LIMITS = Object.freeze({
  bundleBytes: 4 * 1024 * 1024,
  title: 120,
  text: 4000,
  observables: 64,
  evidenceSnapshots: 128,
  operatorArtifacts: 32,
  kqlValidations: 16,
  timeline: 256,
  notes: 128,
  limitations: 64,
  references: 64,
});

export const INVESTIGATION_PHASES = Object.freeze([
  'SCOPING',
  'EVIDENCE',
  'HUNT_DESIGN',
  'EXECUTION_PENDING',
  'RESULTS',
  'DISPOSITION',
  'REPORT_READY',
]);

export const INVESTIGATION_READINESS = Object.freeze(['BLOCKED', 'INCOMPLETE', 'READY']);

export const INVESTIGATION_DISPOSITIONS = Object.freeze([
  'CONFIRMED_MALICIOUS',
  'SUSPICIOUS',
  'BENIGN_EXPLAINED',
  'NO_EVIDENCE_IDENTIFIED',
  'INCONCLUSIVE',
]);

export const INVESTIGATION_CONFIDENCE = Object.freeze(['LOW', 'MEDIUM', 'HIGH']);

