import test from 'node:test';
import assert from 'node:assert/strict';
import { assertProviderContract, validateProviderSet } from '../src/core/provider-contract.js';
import { OBSERVABLE_MANIFEST } from '../src/core/observable-registry.js';
import { EXECUTION_POLICY_VERSION } from '../src/core/execution-policy.js';

const policy = Object.freeze({
  types: Object.freeze(['ip']),
  observationTypes: Object.freeze(['network_identity']),
  fixedHosts: Object.freeze(['example.test']),
  methods: Object.freeze(['GET']),
  protocols: Object.freeze(['https:']),
  distribution: 'shareable',
  sourceRole: 'first_party',
  freshnessClass: 'near_real_time',
  admissionVersion: 'v8.1',
  executionPolicy: EXECUTION_POLICY_VERSION,
});

const adapter = Object.freeze({
  name: 'fixture',
  ...policy,
  run: async () => ({ ok: true }),
});

test('valid canonical provider contract passes', () => {
  assert.equal(assertProviderContract({ adapter, policy, observableRegistry: OBSERVABLE_MANIFEST }), true);
});

test('contract rejects unknown observable types', () => {
  const badPolicy = { ...policy, types: ['email'] };
  const badAdapter = { ...adapter, types: ['email'] };
  assert.throws(
    () => assertProviderContract({ adapter: badAdapter, policy: badPolicy, observableRegistry: OBSERVABLE_MANIFEST }),
    /provider fixture: unknown observable type email/,
  );
});

test('contract rejects adapter-policy divergence on bounded fields', () => {
  assert.throws(
    () => assertProviderContract({ adapter: { ...adapter, fixedHosts: ['other.test'] }, policy, observableRegistry: OBSERVABLE_MANIFEST }),
    /provider fixture: fixedHosts policy mismatch/,
  );
  assert.throws(
    () => assertProviderContract({ adapter: { ...adapter, protocols: ['http:'] }, policy, observableRegistry: OBSERVABLE_MANIFEST }),
    /provider fixture: protocols policy mismatch/,
  );
});

test('contract requires the canonical execution policy pointer', () => {
  assert.throws(
    () => assertProviderContract({
      adapter: { ...adapter, executionPolicy: 'legacy' },
      policy: { ...policy, executionPolicy: 'legacy' },
      observableRegistry: OBSERVABLE_MANIFEST,
    }),
    /provider fixture: invalid executionPolicy/,
  );
});

test('provider set requires an exact manifest entry for every adapter', () => {
  assert.throws(
    () => validateProviderSet({ adapters: [adapter], manifest: {}, observableRegistry: OBSERVABLE_MANIFEST }),
    /provider fixture: missing canonical policy/,
  );
});
