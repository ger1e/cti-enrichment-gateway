import test from 'node:test';
import assert from 'node:assert/strict';
import { correlateEvidence } from '../src/core/correlate.js';

function e(provider, kind, verdict, attributes = {}, extra = {}) {
  return {
    provider,
    observation: { kind, verdict, attributes, firstSeen: null, lastSeen: null, ...extra.observation },
    retrievedAt: extra.retrievedAt ?? '2026-08-21T00:00:00Z',
    relationships: extra.relationships ?? [],
  };
}

test('independent same-class observations corroborate without a master score', () => {
  const out = correlateEvidence({ indicator: 'evil.example', type: 'domain', now: '2026-08-21T01:00:00Z', evidence: [e('a', 'reputation', 'malicious'), e('b', 'ioc_reputation', 'malicious')], relationships: [] });
  assert.equal(out.corroboration.length, 1);
  assert.deepEqual(out.corroboration[0].providers, ['a', 'b']);
  assert.equal('score' in out, false);
  assert.equal('maliciousness' in out, false);
});

test('opposite observations in the same semantic class are contradictions', () => {
  const out = correlateEvidence({ indicator: 'evil.example', type: 'domain', now: '2026-08-21T01:00:00Z', evidence: [e('a', 'reputation', 'malicious'), e('b', 'reputation', 'benign')], relationships: [] });
  assert.equal(out.contradictions.length, 1);
  assert.deepEqual(out.contradictions[0].providers, ['a', 'b']);
});

test('Tor and scanner context cannot corroborate malware reputation', () => {
  const out = correlateEvidence({ indicator: '192.0.2.44', type: 'ip', now: '2026-08-21T01:00:00Z', evidence: [e('tor', 'tor_exit', 'observed'), e('scan', 'scanner_activity', 'observed'), e('vt', 'reputation', 'malicious')], relationships: [] });
  assert.equal(out.corroboration.some(x => x.semanticClass === 'reputation'), false);
});

test('ATT&CK knowledge never contributes to reputation correlation', () => {
  const out = correlateEvidence({ indicator: 'T1059.001', type: 'attack', now: '2026-08-21T01:00:00Z', evidence: [e('attack-a', 'attack_knowledge', 'cataloged'), e('attack-b', 'attack_knowledge', 'cataloged')], relationships: [] });
  assert.equal(out.corroboration.some(x => x.semanticClass === 'reputation'), false);
  assert.equal(out.huntability.level, 'medium');
});

test('freshness is derived from observation time without pretending unknown is fresh', () => {
  const current = correlateEvidence({ indicator: 'x', type: 'hash', now: '2026-08-21T00:00:00Z', evidence: [e('a', 'reputation', 'malicious', {}, { observation: { lastSeen: '2026-08-20T00:00:00Z' }, retrievedAt: '2026-08-21T00:00:00Z' })], relationships: [] });
  const stale = correlateEvidence({ indicator: 'x', type: 'hash', now: '2026-08-21T00:00:00Z', evidence: [e('a', 'reputation', 'malicious', {}, { observation: { firstSeen: '2026-06-01T00:00:00Z' }, retrievedAt: '2026-08-21T00:00:00Z' })], relationships: [] });
  const unknown = correlateEvidence({ indicator: 'x', type: 'hash', now: '2026-08-21T00:00:00Z', evidence: [e('a', 'reputation', 'malicious', {}, { retrievedAt: '2026-08-21T00:00:00Z' })], relationships: [] });
  assert.equal(current.freshness.overall, 'current');
  assert.equal(current.freshness.items[0].observationClass, 'current');
  assert.equal(current.freshness.items[0].retrievalClass, 'current');
  assert.equal(stale.freshness.overall, 'stale');
  assert.equal(stale.freshness.items[0].retrievalClass, 'current');
  assert.equal(unknown.freshness.overall, 'unknown');
  assert.equal(unknown.freshness.items[0].observationClass, 'unknown');
  assert.equal(unknown.freshness.items[0].retrievalClass, 'current');
  assert.ok(unknown.limitations.includes('unknown_observation_time'));
});

test('CVE risk axes remain separate KEV EPSS and CVSS fields', () => {
  const out = correlateEvidence({ indicator: 'CVE-2026-12345', type: 'cve', now: '2026-08-21T01:00:00Z', evidence: [e('cisa-kev', 'known_exploited', 'known_exploited', { cataloged: true, knownRansomwareCampaignUse: 'Known' }), e('epss', 'exploit_probability', 'scored', { epss: 0.81, percentile: 0.98 }), e('nvd', 'vulnerability_metadata', 'cataloged', { cvss: 8.8 })], relationships: [] });
  assert.deepEqual(out.riskAxes.kev, { listed: true, ransomwareUse: 'Known', provider: 'cisa-kev' });
  assert.deepEqual(out.riskAxes.epss, { score: 0.81, percentile: 0.98, provider: 'epss' });
  assert.deepEqual(out.riskAxes.cvss, { score: 8.8, provider: 'nvd' });
});

test('relationships are deduplicated and actor attribution is emitted only from explicit evidence', () => {
  const relationships = [{ type: 'uses', source: 'campaign:x', target: 'malware:y', provider: 'p' }, { type: 'uses', source: 'campaign:x', target: 'malware:y', provider: 'p' }, { type: 'attributed_to', source: 'campaign:x', target: 'actor:z', targetType: 'actor', provider: 'p' }];
  const out = correlateEvidence({ indicator: 'x', type: 'domain', now: '2026-08-21T01:00:00Z', evidence: [], relationships });
  assert.equal(out.relationships.length, 2);
  assert.equal(out.attributionConfidence.basis, 'explicit_relationship');
  assert.deepEqual(out.attributionConfidence.actors, ['actor:z']);
});

test('evidence quality measures support without implying maliciousness', () => {
  const out = correlateEvidence({ indicator: '198.51.100.10', type: 'ip', now: '2026-08-21T01:00:00Z', evidence: [e('modat', 'internet_exposure', 'observed', {}, { observation: { lastSeen: '2026-08-21T00:00:00Z' } }), e('shodan', 'internet_exposure', 'observed', {}, { observation: { lastSeen: '2026-08-21T00:00:00Z' } }), e('rdap', 'registration', 'observed', {}, { observation: { lastSeen: '2026-08-21T00:00:00Z' } })], relationships: [] });
  assert.equal(out.corroboration.length, 0);
  assert.equal(out.evidenceQuality.level, 'high');
  assert.equal(out.evidenceQuality.providerCount, 3);
  assert.equal('verdict' in out.evidenceQuality, false);
  assert.equal(JSON.stringify(out.evidenceQuality).toLowerCase().includes('malicious'), false);
});

test('decision-grade threat assessment separates support contradiction negative and insufficiency', () => {
  const supported = correlateEvidence({ indicator: 'evil.example', type: 'domain', evidence: [e('virustotal', 'reputation', 'malicious'), e('threatfox', 'ioc_reputation', 'malicious')] });
  assert.equal(supported.threatAssessment.state, 'supported');
  assert.deepEqual(supported.threatAssessment.assessmentBasis.providers, ['threatfox', 'virustotal']);
  const single = correlateEvidence({ indicator: 'evil.example', type: 'domain', evidence: [e('virustotal', 'reputation', 'malicious')] });
  assert.equal(single.threatAssessment.state, 'insufficient');
  assert.ok(single.limitations.includes('single_source_threat_support'));
  const contradicted = correlateEvidence({ indicator: 'evil.example', type: 'domain', evidence: [e('virustotal', 'reputation', 'malicious'), e('other', 'reputation', 'benign')] });
  assert.equal(contradicted.threatAssessment.state, 'contradicted');
  assert.ok(contradicted.limitations.includes('contradictory_threat_evidence'));
  const negative = correlateEvidence({ indicator: 'safe.example', type: 'domain', evidence: [e('virustotal', 'reputation', 'benign')] });
  assert.equal(negative.threatAssessment.state, 'negative');
  const attack = correlateEvidence({ indicator: 'T1059.001', type: 'attack', evidence: [e('attack-taxii', 'attack_knowledge', 'cataloged')] });
  assert.equal(attack.threatAssessment.state, 'not_applicable');
});

test('duplicate evidence from one provider never becomes independent threat corroboration', () => {
  const out = correlateEvidence({ indicator: 'evil.example', type: 'domain', evidence: [e('virustotal', 'reputation', 'malicious'), e('virustotal', 'reputation', 'malicious')] });
  assert.equal(out.threatAssessment.state, 'insufficient');
  assert.deepEqual(out.threatAssessment.assessmentBasis.providers, ['virustotal']);
});

test('infrastructure context corroborates only approved infrastructure relationship types', () => {
  const relationships = [
    { type: 'asn', source: '198.51.100.10', target: 'AS64500', provider: 'modat' },
    { type: 'asn', source: '198.51.100.10', target: 'AS64500', provider: 'shodan' },
    { type: 'hostname', source: '198.51.100.10', target: 'edge.example', provider: 'modat' },
    { type: 'hostname', source: '198.51.100.10', target: 'edge.example', provider: 'censys' },
    { type: 'uses', source: 'x', target: 'malware:y', provider: 'modat' },
    { type: 'uses', source: 'x', target: 'malware:y', provider: 'shodan' },
  ];
  const out = correlateEvidence({ indicator: '198.51.100.10', type: 'ip', evidence: [e('modat', 'internet_exposure', 'observed'), e('shodan', 'internet_exposure', 'observed'), e('censys', 'internet_exposure', 'observed')], relationships });
  assert.deepEqual(out.infrastructureContext.corroboratedFacts, [
    { type: 'asn', target: 'AS64500', providers: ['modat', 'shodan'] },
    { type: 'hostname', target: 'edge.example', providers: ['censys', 'modat'] },
  ]);
  assert.equal(out.threatAssessment.state, 'insufficient');
  assert.ok(out.limitations.includes('infrastructure_only_evidence'));
});
