import test from 'node:test';
import assert from 'node:assert/strict';
import {
  IP_INTELLIGENCE_POLICY,
  IP_INTELLIGENCE_POLICY_VERSION,
  ipEvidenceCategory,
  ipRelationshipClass,
  ipPivotPriority,
} from '../src/core/intelligence-policy/ip.js';

const EVIDENCE_CASES = new Map([
  ['reputation', 'direct_threat'],
  ['ioc_reputation', 'direct_threat'],
  ['abuse_reports', 'direct_threat'],
  ['drop_netblock', 'direct_threat'],
  ['botnet_c2', 'direct_threat'],
  ['malware_association', 'direct_threat'],
  ['misp_feed_hit', 'direct_threat'],
  ['threat_context', 'supporting_threat'],
  ['community_ioc_report', 'supporting_threat'],
  ['web_intelligence', 'supporting_threat'],
  ['ransomware_post_reference', 'supporting_threat'],
  ['scanner_activity', 'scanner_noise'],
  ['internet_noise', 'scanner_noise'],
  ['tor_exit', 'tor_proxy'],
  ['network_identity', 'infrastructure'],
  ['registration', 'infrastructure'],
  ['routing', 'infrastructure'],
  ['passive_dns', 'infrastructure'],
  ['internet_exposure', 'exposure'],
  ['web_scan_history', 'exposure'],
]);

test('IP intelligence policy classifies every approved evidence kind and leaves unknown kinds as other', () => {
  for (const [kind, expected] of EVIDENCE_CASES) assert.equal(ipEvidenceCategory(kind), expected, kind);
  assert.equal(ipEvidenceCategory('future_unknown_kind'), 'other');
  assert.equal(ipEvidenceCategory(null), 'other');
});

test('IP relationship policy separates direct supporting contextual and low-value explicit relations', () => {
  assert.equal(ipRelationshipClass({ type: 'c2', source: '203.0.113.7', target: 'evil.example', targetType: 'domain' }), 'direct');
  assert.equal(ipRelationshipClass({ type: 'malware', source: '203.0.113.7', target: 'a'.repeat(64), targetType: 'hash' }), 'direct');
  assert.equal(ipRelationshipClass({ type: 'communicates_with', source: '203.0.113.7', target: '198.51.100.9', targetType: 'ip' }), 'direct');
  assert.equal(ipRelationshipClass({ type: 'hostname', source: '203.0.113.7', target: 'host.example', targetType: 'domain' }), 'supporting');
  assert.equal(ipRelationshipClass({ type: 'certificate', source: '203.0.113.7', target: 'f'.repeat(64), targetType: 'certificate' }), 'supporting');
  assert.equal(ipRelationshipClass({ type: 'asn', source: '203.0.113.7', target: 'AS64500', targetType: 'asn' }), 'contextual');
  assert.equal(ipRelationshipClass({ type: 'netblock', source: '203.0.113.7', target: '203.0.113.0/24', targetType: 'cidr' }), 'contextual');
  assert.equal(ipRelationshipClass({ type: 'related_to', source: '203.0.113.7', target: 'opaque-value', targetType: 'unknown' }), 'low_value');
});

test('IP pivot priority is bounded to explicit eligible target types and never infers from string shape', () => {
  assert.equal(ipPivotPriority({ type: 'c2', source: '203.0.113.7', target: 'evil.example', targetType: 'domain' }), 'high');
  assert.equal(ipPivotPriority({ type: 'hostname', source: '203.0.113.7', target: 'host.example', targetType: 'domain' }), 'medium');
  assert.equal(ipPivotPriority({ type: 'related_to', source: '203.0.113.7', target: 'CVE-2026-12345', targetType: 'cve' }), 'low');
  assert.equal(ipPivotPriority({ type: 'asn', source: '203.0.113.7', target: 'AS64500', targetType: 'asn' }), 'none');
  assert.equal(ipPivotPriority({ type: 'certificate', source: '203.0.113.7', target: 'f'.repeat(64), targetType: 'certificate' }), 'none');
  assert.equal(ipPivotPriority({ type: 'related_to', source: '203.0.113.7', target: '198.51.100.9' }), 'none');
  assert.equal(ipPivotPriority({ observation: { attributes: { hostname: 'evil.example', ip: '198.51.100.9' } } }), 'none');
});

test('IP policy exports are frozen data with the canonical version', () => {
  assert.equal(IP_INTELLIGENCE_POLICY_VERSION, '1.0');
  assert.equal(IP_INTELLIGENCE_POLICY.type, 'ip');
  assert.equal(IP_INTELLIGENCE_POLICY.version, '1.0');
  assert.equal(Object.isFrozen(IP_INTELLIGENCE_POLICY), true);
  assert.equal(Object.isFrozen(IP_INTELLIGENCE_POLICY.evidenceKinds), true);
  assert.equal(Object.isFrozen(IP_INTELLIGENCE_POLICY.relationshipTypes), true);
  assert.equal(Object.isFrozen(IP_INTELLIGENCE_POLICY.pivotTargetTypes), true);
});
