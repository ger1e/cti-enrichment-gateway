import test from 'node:test';
import assert from 'node:assert/strict';
import { SUPPORTED_OBSERVABLE_TYPES, toGatewayIndicator } from '../app/observable-input.js';

test('browser observable transport exposes exactly the nine canonical v8 types', () => {
  assert.deepEqual(SUPPORTED_OBSERVABLE_TYPES, [
    'asn', 'attack', 'certificate', 'cidr', 'cve', 'domain', 'hash', 'ip', 'url',
  ]);
  assert.equal(Object.isFrozen(SUPPORTED_OBSERVABLE_TYPES), true);
});

test('certificate replay restores the explicit cert-sha256 transport prefix', () => {
  const value = 'a'.repeat(64);
  assert.equal(toGatewayIndicator({ type: 'certificate', value }), `cert-sha256:${value}`);
  assert.equal(toGatewayIndicator({ type: 'hash', value }), value);
  assert.equal(toGatewayIndicator({ type: 'domain', value: 'example.com' }), 'example.com');
});

test('browser transport rejects unsupported or empty typed observables without classification guesses', () => {
  assert.throws(() => toGatewayIndicator({ type: 'email', value: 'a@example.com' }), /unsupported observable type/);
  assert.throws(() => toGatewayIndicator({ type: 'ip', value: '' }), /observable value required/);
  assert.throws(() => toGatewayIndicator({ type: 'ip', value: null }), /observable value required/);
});
