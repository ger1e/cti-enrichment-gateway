import test from 'node:test';
import assert from 'node:assert/strict';
import { diffEvidenceSnapshots } from '../src/core/semantic-diff.js';

const fp = char => char.repeat(64);

function ev(provider, fingerprint, verdict = 'context') {
  return {
    provider,
    integrity: { fingerprint },
    semantics: { class: 'provider_claim', semanticClass: 'reputation', sourceRole: 'aggregator' },
    observation: { kind: 'reputation', verdict, firstSeen: null, lastSeen: null, tags: [], attributes: {} },
  };
}

function base() {
  return {
    indicator: '203.0.113.7', type: 'ip', status: 'ok', requestId: 'a', queriedAt: '2026-08-29T00:00:00Z', durationMs: 4,
    evidence: [ev('alpha', fp('a'))],
    relationships: [{ type: 'resolves_to', target: '203.0.113.8', targetType: 'ip', provider: 'alpha' }],
    coverage: { selected: 1, executed: 1, succeeded: 1, failed: 0, skipped: 0, materialLoss: false },
    limitations: [],
    correlation: {
      contradictions: [], freshness: { overall: 'current' }, evidenceQuality: { level: 'medium' }, huntability: { level: 'medium' },
    },
    decision: {
      disposition: 'investigate', confidence: 'medium', reasons: ['evidence-supported'],
      telemetry: { status: 'ready', requiredTables: ['DeviceNetworkEvents'] },
      attackMappings: [{ id: 'T1071.004', providers: ['alpha'], evidenceFingerprints: [fp('a')] }],
      huntPlan: [{ id: 'subject-ip-1', priority: 'medium', hypothesis: 'hunt subject', telemetry: ['DeviceNetworkEvents'], evidenceFingerprints: [fp('a')] }],
    },
    meta: { cache: { alpha: 'miss' }, providerHealth: { alpha: 'ok' } },
  };
}

function clone(value) { return JSON.parse(JSON.stringify(value)); }

function categories(diff) { return new Set(diff.changes.map(change => change.category)); }

test('timestamp, cache, duration, and source ordering noise produces no semantic changes', () => {
  const previous = base();
  const current = clone(previous);
  current.requestId = 'b';
  current.queriedAt = '2026-08-29T03:00:00Z';
  current.durationMs = 999;
  current.meta.cache.alpha = 'hit';
  current.evidence[0].cacheState = 'hit';
  current.evidence[0].durationMs = 999;
  const diff = diffEvidenceSnapshots(previous, current);
  assert.equal(diff.changed, false);
  assert.deepEqual(diff.summary, { added: 0, removed: 0, changed: 0, total: 0 });
  assert.deepEqual(diff.changes, []);
});

test('typed semantic changes cover every Train 3 category', () => {
  const previous = base();
  const current = clone(previous);
  current.evidence = [ev('beta', fp('b'), 'malicious')];
  current.relationships = [{ type: 'communicates_with', target: 'example.test', targetType: 'domain', provider: 'beta' }];
  current.coverage = { selected: 2, executed: 2, succeeded: 1, failed: 1, skipped: 0, materialLoss: true };
  current.limitations = ['material_coverage_loss'];
  current.meta.providerHealth = { alpha: 'timeout', beta: 'ok' };
  current.correlation.contradictions = [{ semanticClass: 'reputation', providers: ['alpha', 'beta'] }];
  current.correlation.freshness.overall = 'stale';
  current.correlation.evidenceQuality.level = 'low';
  current.correlation.huntability.level = 'high';
  current.decision.disposition = 'hunt_now';
  current.decision.confidence = 'low';
  current.decision.reasons = ['new evidence'];
  current.decision.telemetry = { status: 'conditional', requiredTables: ['CommonSecurityLog'] };
  current.decision.attackMappings = [{ id: 'T1059.001', providers: ['beta'], evidenceFingerprints: [fp('b')] }];
  current.decision.huntPlan = [{ id: 'subject-ip-1', priority: 'high', hypothesis: 'hunt changed subject', telemetry: ['CommonSecurityLog'], evidenceFingerprints: [fp('b')] }];

  const diff = diffEvidenceSnapshots(previous, current);
  assert.equal(diff.changed, true);
  assert.deepEqual(categories(diff), new Set([
    'evidence_added', 'evidence_removed', 'provider_coverage_changed', 'relationship_added', 'relationship_removed',
    'contradiction_changed', 'freshness_changed', 'attack_mapping_changed', 'decision_changed', 'huntability_changed', 'telemetry_changed',
  ]));
});

test('changes use fixed priority ordering and are bounded to 128 records', () => {
  const previous = base();
  previous.evidence = [];
  const current = clone(previous);
  current.evidence = Array.from({ length: 200 }, (_, index) => ev(`provider-${String(index).padStart(3, '0')}`, index.toString(16).padStart(64, '0')));
  current.decision.disposition = 'monitor';
  const diff = diffEvidenceSnapshots(previous, current);
  assert.equal(diff.changes.length, 128);
  assert.equal(diff.changes[0].category, 'decision_changed');
  assert.equal(Object.isFrozen(diff), true);
  assert.equal(Object.isFrozen(diff.changes), true);
});

test('semantic diff requires the same subject', () => {
  const previous = base();
  const current = clone(previous);
  current.indicator = '203.0.113.9';
  assert.throws(() => diffEvidenceSnapshots(previous, current), /semantic diff requires matching indicator and type/);
});
