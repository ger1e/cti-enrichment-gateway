import test from 'node:test';
import assert from 'node:assert/strict';
import rawManifest from '../config/providers.json' with { type: 'json' };
import {
  providerPolicy,
  sanitizeSchedulerMetadata,
  validateProviderPolicy,
} from '../src/providers/manifest.js';
import { EXECUTION_POLICY_VERSION } from '../src/core/execution-policy.js';
import { WORKFLOWS } from '../src/workflows.js';

const VALID = Object.freeze({
  authorityClass: 'specialist',
  semanticUniqueness: 'unique',
  intelligenceValue: 'direct',
  pivotValue: 'high',
  latencyClass: 'normal',
});

function basePolicy() {
  return {
    displayName: 'Fixture',
    credentialEnv: null,
    optionalCredential: false,
    authType: 'none',
    tier: 1,
    costClass: 'free',
    types: ['ip'],
    observationTypes: ['network_identity'],
    semanticClassHints: ['network_context'],
    timeoutMs: 1000,
    cacheTtlMs: 60_000,
    negativeCacheTtlMs: 10_000,
    maxResponseBytes: 2048,
    fixedHosts: ['example.test'],
    methods: ['GET'],
    protocols: ['https:'],
    parserVersion: 'fixture-1',
    sourceUrl: 'https://example.test/docs',
    distribution: 'shareable',
    active: true,
    sourceRole: 'first_party',
    freshnessClass: 'near_real_time',
    admissionVersion: 'v8.1',
    executionPolicy: EXECUTION_POLICY_VERSION,
  };
}

test('valid scheduler metadata is normalized and deeply frozen', () => {
  const result = sanitizeSchedulerMetadata(['ip'], { ip: { ...VALID } });
  assert.deepEqual(result.schedulerByType, { ip: VALID });
  assert.deepEqual(result.schedulerMetadataInvalidTypes, []);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.schedulerByType), true);
  assert.equal(Object.isFrozen(result.schedulerByType.ip), true);
  assert.equal(Object.isFrozen(result.schedulerMetadataInvalidTypes), true);
});

test('scheduler metadata cannot widen provider type coverage', () => {
  const result = sanitizeSchedulerMetadata(['domain'], { ip: { ...VALID } });
  assert.deepEqual(result.schedulerByType, {});
  assert.deepEqual(result.schedulerMetadataInvalidTypes, ['ip']);
});

test('invalid scheduler descriptors degrade locally without invalidating provider policy', () => {
  const cases = [
    { input: { ip: { ...VALID, pivotValue: 'maximum' } }, expected: ['ip'] },
    { input: { ip: { authorityClass: 'specialist' } }, expected: ['ip'] },
    { input: { ip: 'not-an-object' }, expected: ['ip'] },
    { input: 'not-an-object', expected: ['ip'] },
  ];
  for (const fixture of cases) {
    const result = sanitizeSchedulerMetadata(['ip'], fixture.input);
    assert.deepEqual(result.schedulerByType, {});
    assert.deepEqual(result.schedulerMetadataInvalidTypes, fixture.expected);
  }
});

test('provider policy accepts malformed scheduler metadata but preserves strict core validation', () => {
  const malformedScheduler = validateProviderPolicy('fixture', {
    ...basePolicy(),
    schedulerByType: { ip: { ...VALID, latencyClass: 'instant' } },
  });
  assert.deepEqual(malformedScheduler.schedulerByType, {});
  assert.deepEqual(malformedScheduler.schedulerMetadataInvalidTypes, ['ip']);

  const invalidCases = [
    ['tier', 0],
    ['fixedHosts', ['bad host']],
    ['methods', ['DELETE']],
    ['protocols', ['http:']],
    ['sourceRole', 'mystery'],
    ['executionPolicy', 'v0'],
  ];
  for (const [field, value] of invalidCases) {
    assert.throws(
      () => validateProviderPolicy('fixture', { ...basePolicy(), [field]: value }),
      /invalid provider manifest/,
      field,
    );
  }
});

test('every configured IP provider has a complete valid scheduler descriptor', () => {
  assert.equal(WORKFLOWS.ip.length, 24);
  for (const name of WORKFLOWS.ip) {
    const policy = providerPolicy(name);
    assert.deepEqual(policy.schedulerMetadataInvalidTypes ?? [], [], `${name} has invalid scheduler metadata`);
    const descriptor = policy.schedulerByType?.ip;
    assert.ok(descriptor, `${name} missing schedulerByType.ip`);
    const normalized = sanitizeSchedulerMetadata(['ip'], { ip: descriptor });
    assert.deepEqual(normalized.schedulerMetadataInvalidTypes, [], `${name} descriptor must validate`);
    assert.deepEqual(normalized.schedulerByType.ip, descriptor, `${name} descriptor must be canonical`);
  }
});

test('IP scheduler descriptors do not alter transport or credential boundaries', () => {
  for (const name of WORKFLOWS.ip) {
    const raw = rawManifest[name];
    const policy = providerPolicy(name);
    assert.deepEqual(policy.types, raw.types, `${name} types`);
    assert.deepEqual(policy.fixedHosts, raw.fixedHosts, `${name} fixedHosts`);
    assert.deepEqual(policy.methods, raw.methods, `${name} methods`);
    assert.deepEqual(policy.protocols, raw.protocols, `${name} protocols`);
    assert.equal(policy.credentialEnv, raw.credentialEnv, `${name} credentialEnv`);
    assert.equal(policy.optionalCredential, raw.optionalCredential, `${name} optionalCredential`);
    assert.equal(policy.authType, raw.authType, `${name} authType`);
  }
});
