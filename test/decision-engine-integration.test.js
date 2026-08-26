import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TtlCache } from '../src/core/cache.js';
import { createProviderRegistry } from '../src/core/provider-registry.js';
import { enrich } from '../src/core/orchestrator.js';
import { buildReportModel } from '../src/report/model.js';

function reputationAdapter(name) {
  return {
    name,
    types: ['domain'],
    observationTypes: ['reputation'],
    cacheTtlMs: 1000,
    negativeCacheTtlMs: 100,
    costClass: 'free',
    tier: 1,
    timeoutMs: 100,
    maxResponseBytes: 2048,
    fixedHosts: ['example.test'],
    parserVersion: '1',
    sourceUrl: 'https://example.test/docs',
    run: async () => ({
      verdict: 'malicious',
      observationType: 'reputation',
      lastSeen: '2026-08-26T17:00:00Z',
      references: ['https://example.test/evidence'],
    }),
  };
}

test('orchestrator emits decision support and mirrors its compact assessment into correlation', async () => {
  const registry = createProviderRegistry([reputationAdapter('rep-a'), reputationAdapter('rep-b')]);
  const result = await enrich({
    indicator: 'evil.example',
    type: 'domain',
    providerNames: ['rep-a', 'rep-b'],
    registry,
    cache: new TtlCache(),
    requestId: 'decision-integration',
    now: () => '2026-08-26T18:00:00Z',
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.decision.disposition, 'hunt_now');
  assert.equal(result.correlation.evidenceQuality.level, 'medium');
  assert.equal(result.decision.confidence, 'medium');
  assert.deepEqual(result.correlation.assessment, result.decision.assessment);
  assert.ok(result.decision.huntPlan.some(item => item.kql.includes('DeviceNetworkEvents')));
  assert.equal('score' in result.decision, false);
});

test('report model consumes generated decision hunts when no explicit report override exists', () => {
  const snapshot = JSON.parse(readFileSync(new URL('./fixtures/report/enrichment.json', import.meta.url), 'utf8'));
  delete snapshot.reportContext.huntOpportunities;
  snapshot.correlation.assessment = {
    disposition: 'hunt_now',
    confidence: 'high',
    reasons: ['supported_threat_evidence'],
  };
  snapshot.decision = {
    huntPlan: [{
      id: 'generated-ip-1',
      hypothesis: 'Look for the subject IP in endpoint network telemetry.',
      telemetry: ['DeviceNetworkEvents'],
      evidenceFingerprints: ['1'.repeat(64)],
      kql: 'DeviceNetworkEvents\n| where RemoteIP == "203.0.113.10"',
      falsePositives: ['shared_hosting'],
      tuning: ['correlate_with_process_context'],
    }],
  };

  const model = buildReportModel(snapshot, {
    generatedAt: '2026-08-26T18:30:00.000Z',
    sourceSha: '0123456789abcdef0123456789abcdef01234567',
  });

  assert.equal(model.executiveAssessment.disposition, 'hunt_now');
  assert.equal(model.huntOpportunities.length, 1);
  assert.equal(model.huntOpportunities[0].id, 'generated-ip-1');
  assert.deepEqual(model.huntOpportunities[0].evidenceIds, ['ev-1111111111111111']);
});
