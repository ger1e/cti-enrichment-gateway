import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIntelligenceKernel } from '../src/core/intelligence-kernel.js';
import { IP_INTELLIGENCE_POLICY } from '../src/core/intelligence-policy/ip.js';
import { sha256Hex } from '../src/core/sha256.js';

const INDICATOR = '203.0.113.7';
const NOW = '2026-08-30T10:00:00.000Z';

function build(relationships, evidence = []) {
  return buildIntelligenceKernel({
    indicator: INDICATOR, type: 'ip', evidence, relationships, correlation: {}, coverage: {}, now: NOW,
    policy: IP_INTELLIGENCE_POLICY,
  });
}

function evidence(provider, marker) {
  return {
    provider,
    observation: { kind: 'reputation', verdict: 'malicious', attributes: {} },
    semantics: { sourceRole: 'first_party', semanticClass: 'reputation' },
    integrity: { fingerprint: marker.repeat(64) },
  };
}

function relation(type, target, targetType, provider = 'alpha', extra = {}) {
  return { type, source: INDICATOR, target, targetType, provider, ...extra };
}

function expectedRelationshipId(item) {
  return sha256Hex([
    'ip',
    item.source,
    item.type,
    item.targetType,
    item.target,
    item.provider,
  ].join('\u0000'));
}

test('relationship value uses stable SHA-256 identity and policy classes', () => {
  const relationships = [
    relation('c2', 'evil.example', 'domain', 'alpha'),
    relation('hostname', 'host.example', 'domain', 'beta'),
    relation('asn', 'AS64500', 'asn', 'gamma'),
    relation('related_to', 'CVE-2026-12345', 'cve', 'delta'),
  ];
  const out = build(relationships, [evidence('alpha', '1'), evidence('beta', '2'), evidence('gamma', '3'), evidence('delta', '4')]);
  assert.deepEqual(out.relationshipValue.map(item => ({ id: item.id, valueClass: item.valueClass, pivotPriority: item.pivotPriority })), [
    { id: expectedRelationshipId(relationships[0]), valueClass: 'direct', pivotPriority: 'high' },
    { id: expectedRelationshipId(relationships[1]), valueClass: 'supporting', pivotPriority: 'medium' },
    { id: expectedRelationshipId(relationships[2]), valueClass: 'contextual', pivotPriority: 'none' },
    { id: expectedRelationshipId(relationships[3]), valueClass: 'low_value', pivotPriority: 'low' },
  ]);
  assert.deepEqual(out.relationshipValue[0].evidenceFingerprints, ['1'.repeat(64)]);
});

test('duplicate explicit relationships collapse by stable identity without losing provenance', () => {
  const duplicate = relation('c2', 'evil.example', 'domain', 'alpha');
  const out = build([duplicate, structuredClone(duplicate), relation('c2', 'evil.example', 'domain', 'beta')], [
    evidence('alpha', '1'), evidence('beta', '2'),
  ]);
  assert.equal(out.relationshipValue.length, 2);
  assert.equal(new Set(out.relationshipValue.map(item => item.id)).size, 2);
  assert.deepEqual(out.relationshipValue.map(item => item.provider), ['alpha', 'beta']);
});

test('one-hop pivot candidates are explicit bounded ranked and source-traceable', () => {
  const relationships = [
    relation('c2', 'z.example', 'domain', 'alpha'),
    relation('c2', 'a.example', 'domain', 'beta'),
    relation('hostname', 'm.example', 'domain', 'gamma'),
    relation('related_to', 'CVE-2026-12345', 'cve', 'delta'),
    relation('asn', 'AS64500', 'asn', 'epsilon'),
    relation('certificate', 'f'.repeat(64), 'certificate', 'zeta'),
  ];
  const out = build(relationships, [evidence('alpha', '1'), evidence('beta', '2'), evidence('gamma', '3'), evidence('delta', '4')]);
  assert.deepEqual(out.pivotCandidates.map(item => [item.priority, item.type, item.value]), [
    ['high', 'domain', 'a.example'],
    ['high', 'domain', 'z.example'],
    ['medium', 'domain', 'm.example'],
    ['low', 'cve', 'CVE-2026-12345'],
  ]);
  assert.ok(out.pivotCandidates.every(item => item.relationshipIds.length >= 1));
  assert.ok(out.pivotCandidates.every(item => item.evidenceFingerprints.length >= 1));
});

test('pivot candidates deduplicate target identity and cap output at eight', () => {
  const relationships = [];
  for (let index = 0; index < 12; index += 1) relationships.push(relation('c2', `host-${String(index).padStart(2, '0')}.example`, 'domain', 'alpha'));
  relationships.push(relation('c2', 'host-00.example', 'domain', 'beta'));
  const out = build(relationships, [evidence('alpha', '1'), evidence('beta', '2')]);
  assert.equal(out.pivotCandidates.length, 8);
  assert.deepEqual(out.pivotCandidates.map(item => item.value), [
    'host-00.example', 'host-01.example', 'host-02.example', 'host-03.example',
    'host-04.example', 'host-05.example', 'host-06.example', 'host-07.example',
  ]);
  assert.deepEqual(out.pivotCandidates[0].evidenceFingerprints, ['1'.repeat(64), '2'.repeat(64)]);
  assert.equal(out.pivotCandidates[0].relationshipIds.length, 2);
});

test('relationship and pivot ordering is identical under input permutation', () => {
  const relationships = [
    relation('hostname', 'b.example', 'domain', 'beta'),
    relation('c2', 'a.example', 'domain', 'alpha'),
    relation('related_to', 'CVE-2026-12345', 'cve', 'gamma'),
  ];
  const evidenceItems = [evidence('alpha', '1'), evidence('beta', '2'), evidence('gamma', '3')];
  const first = build(relationships, evidenceItems);
  const second = build([...relationships].reverse(), [...evidenceItems].reverse());
  assert.deepEqual(first.relationshipValue, second.relationshipValue);
  assert.deepEqual(first.pivotCandidates, second.pivotCandidates);
});

test('free-text observation attributes never manufacture relationships or pivots', () => {
  const out = build([], [{
    provider: 'alpha',
    observation: { kind: 'reputation', verdict: 'malicious', attributes: { hostname: 'evil.example', ip: '198.51.100.9', cve: 'CVE-2026-12345' } },
    semantics: { sourceRole: 'first_party', semanticClass: 'reputation' },
    integrity: { fingerprint: '1'.repeat(64) },
  }]);
  assert.deepEqual(out.relationshipValue, []);
  assert.deepEqual(out.pivotCandidates, []);
});