import test from 'node:test';
import assert from 'node:assert/strict';
import {
  OBSERVABLE_MANIFEST,
  observablePolicy,
  observableTypes,
  isObservableType,
} from '../src/core/observable-registry.js';

const EXPECTED = ['asn', 'attack', 'cidr', 'cve', 'domain', 'hash', 'ip', 'url'];

test('v8 observable registry exposes exactly the current eight types', () => {
  assert.deepEqual(observableTypes(), EXPECTED);
  assert.deepEqual(Object.keys(OBSERVABLE_MANIFEST).sort(), EXPECTED);
});

test('observable policies are immutable and document canonicalization plus STIX posture', () => {
  const cve = observablePolicy('cve');
  assert.equal(cve.canonicalization, 'cve');
  assert.equal(cve.stixExport, 'vulnerability');
  assert.equal(cve.active, true);
  assert.equal(Object.isFrozen(cve), true);
  assert.throws(() => observablePolicy('email'), /unknown observable type: email/);
});

test('observable type lookup is strict', () => {
  assert.equal(isObservableType('ip'), true);
  assert.equal(isObservableType('IP'), false);
  assert.equal(isObservableType('anything'), false);
});
