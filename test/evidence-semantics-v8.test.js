import test from 'node:test';
import assert from 'node:assert/strict';
import { evidenceRole } from '../src/core/evidence-semantics.js';
import { semanticClass } from '../src/core/semantics.js';
import { normalizeEvidence } from '../src/core/normalize.js';

test('direct and authoritative factual context is observed fact', () => {
  assert.equal(evidenceRole({ semanticClass: 'network_context', sourceRole: 'first_party' }), 'observed_fact');
  assert.equal(evidenceRole({ semanticClass: 'vulnerability_metadata', sourceRole: 'authoritative' }), 'observed_fact');
  assert.equal(evidenceRole({ semanticClass: 'certificate_context', sourceRole: 'first_party' }), 'observed_fact');
});

test('probability and reputation remain provider claims', () => {
  assert.equal(evidenceRole({ semanticClass: 'exploit_probability', sourceRole: 'authoritative' }), 'provider_claim');
  assert.equal(evidenceRole({ semanticClass: 'reputation', sourceRole: 'aggregator' }), 'provider_claim');
  assert.equal(evidenceRole({ semanticClass: 'abuse_reports', sourceRole: 'first_party' }), 'provider_claim');
});

test('contextual feeds remain contextual intelligence', () => {
  assert.equal(evidenceRole({ semanticClass: 'threat_context', sourceRole: 'contextual' }), 'contextual_intelligence');
  assert.equal(evidenceRole({ semanticClass: 'malware_association', sourceRole: 'contextual' }), 'contextual_intelligence');
});

test('Train 2 kinds retain canonical semantic classes', () => {
  assert.equal(semanticClass('dns_resolution'), 'network_context');
  assert.equal(semanticClass('certificate_metadata'), 'certificate_context');
});

test('additive semantics do not change the historical evidence fingerprint', () => {
  const item = normalizeEvidence('fixture', '203.0.113.7', 'ip', {
    observationType: 'dns_resolution',
    verdict: 'context',
    tags: ['dns'],
    attributes: { a: 1 },
    relationships: [],
    references: [],
  }, {
    parserVersion: '1',
    retrievedAt: '2026-08-29T00:00:00.000Z',
    sourceRole: 'first_party',
  });
  assert.deepEqual(item.semantics, {
    class: 'observed_fact',
    semanticClass: 'network_context',
    sourceRole: 'first_party',
  });
  assert.equal(item.integrity.fingerprint, '7b09437041026b7d614f5563221c83774fcfd6eeddfd8932b35282ef1fbf3fd5');
});
