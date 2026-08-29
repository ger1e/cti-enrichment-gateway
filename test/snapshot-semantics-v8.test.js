import test from 'node:test';
import assert from 'node:assert/strict';
import { semanticSnapshot } from '../src/core/snapshot-semantics.js';

function evidence(provider, fingerprint, verdict = 'context') {
  return {
    provider,
    integrity: { fingerprint, rawHash: `raw-${provider}` },
    cacheState: 'miss',
    durationMs: 10,
    retrievedAt: '2026-08-29T00:00:00.000Z',
    semantics: { class: 'observed_fact', semanticClass: 'network_context', sourceRole: 'first_party' },
    observation: {
      kind: 'dns_resolution', verdict, firstSeen: null, lastSeen: null,
      tags: ['zeta', 'alpha'], attributes: { z: 2, a: 1 },
    },
  };
}

function fixture() {
  return {
    requestId: 'req-a', indicator: '203.0.113.7', type: 'ip', queriedAt: '2026-08-29T00:00:00.000Z',
    durationMs: 10, status: 'ok',
    evidence: [evidence('b', 'b'.repeat(64)), evidence('a', 'a'.repeat(64))],
    relationships: [
      { type: 'resolves_to', target: '203.0.113.8', targetType: 'ip', provider: 'b' },
      { type: 'resolves_to', target: '203.0.113.9', targetType: 'ip', provider: 'a' },
    ],
    coverage: { selected: 2, executed: 2, succeeded: 2, failed: 0, skipped: 0, materialLoss: false },
    limitations: ['zeta', 'alpha'],
    correlation: {
      contradictions: [{ semanticClass: 'reputation', providers: ['b', 'a'], positiveProviders: ['b'], negativeProviders: ['a'] }],
      freshness: { overall: 'current' }, evidenceQuality: { level: 'high' }, huntability: { level: 'high' },
    },
    decision: {
      disposition: 'investigate', confidence: 'high', reasons: ['b', 'a'],
      telemetry: { status: 'ready', requiredTables: ['CommonSecurityLog', 'DeviceNetworkEvents'], notes: ['verify', 'schema'] },
      attackMappings: [{ id: 'T1071.004', bases: ['subject', 'evidence'], providers: ['b', 'a'], evidenceFingerprints: ['b'.repeat(64), 'a'.repeat(64)] }],
      huntPlan: [{ id: 'subject-ip-1', priority: 'high', hypothesis: 'hunt subject', telemetry: ['DeviceNetworkEvents'], evidenceFingerprints: ['a'.repeat(64)] }],
    },
    meta: { cache: { a: 'miss', b: 'hit' }, providerHealth: { b: 'ok', a: 'ok' } },
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

test('transport, cache, timing, object-key, and set-like ordering churn is ignored', () => {
  const a = fixture();
  const b = clone(a);
  b.requestId = 'req-b';
  b.queriedAt = '2026-08-29T01:00:00.000Z';
  b.durationMs = 999;
  b.meta.cache = { b: 'miss', a: 'hit' };
  b.evidence.reverse();
  b.relationships.reverse();
  b.evidence[0].cacheState = 'hit';
  b.evidence[0].durationMs = 999;
  b.evidence[0].retrievedAt = '2026-08-29T02:00:00.000Z';
  b.correlation.contradictions[0].providers.reverse();
  b.decision.telemetry.requiredTables.reverse();
  b.decision.telemetry.notes.reverse();
  b.decision.attackMappings[0].bases.reverse();
  b.decision.attackMappings[0].providers.reverse();
  b.decision.attackMappings[0].evidenceFingerprints.reverse();
  assert.deepEqual(semanticSnapshot(a), semanticSnapshot(b));
});

test('semantic observation changes alter the projection', () => {
  const a = fixture();
  const b = clone(a);
  b.evidence[0].observation.verdict = 'malicious';
  assert.notDeepEqual(semanticSnapshot(a), semanticSnapshot(b));
});

test('projection is bounded, deterministic, and deeply frozen', () => {
  const value = fixture();
  value.evidence = Array.from({ length: 300 }, (_, index) => evidence(`p${String(index).padStart(3, '0')}`, index.toString(16).padStart(64, '0')));
  const projected = semanticSnapshot(value);
  assert.equal(projected.evidence.length, 256);
  assert.equal(Object.isFrozen(projected), true);
  assert.equal(Object.isFrozen(projected.evidence), true);
  assert.equal(Object.isFrozen(projected.decision), true);
});

test('invalid envelopes are rejected', () => {
  assert.throws(() => semanticSnapshot({ indicator: 'x', type: 'ip' }), /invalid evidence snapshot/);
});
