import test from 'node:test';
import assert from 'node:assert/strict';
import { TtlCache } from '../src/core/cache.js';
import { createProviderRegistry } from '../src/core/provider-registry.js';
import { enrich } from '../src/core/orchestrator.js';

const adapter = {
  name: 'fixture',
  types: ['ip'],
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
  sourceRole: 'first_party',
  run: async () => ({
    observationType: 'reputation',
    verdict: 'malicious',
    lastSeen: '2026-08-30T09:00:00.000Z',
  }),
};

function args(extra = {}) {
  return {
    indicator: '203.0.113.7',
    type: 'ip',
    providerNames: [adapter.name],
    registry: createProviderRegistry([adapter]),
    cache: new TtlCache(),
    requestId: 'guidance-kernel',
    now: () => '2026-08-30T10:00:00.000Z',
    ...extra,
  };
}

test('successful IP orchestration passes the compatible kernel into Guidance', async () => {
  const result = await enrich(args());
  assert.equal(result.status, 'ok');
  assert.equal(result.intelligence.schemaVersion, '1.0');
  assert.equal(result.guidance.intelligence.schemaVersion, '1.0');
  assert.equal(result.guidance.intelligence.evidenceStrength, result.intelligence.evidenceStrength.level);
  assert.equal(result.guidance.intelligence.analystPriority, result.intelligence.analystPriority.level);
  assert.equal(result.guidance.intelligence.threatState, result.intelligence.threatContext.state);
  assert.equal(result.guidance.intelligence.coverageImpact, result.intelligence.coverageImpact.level);
});

test('failed IP intelligence projection leaves Guidance available without an intelligence summary', async () => {
  const result = await enrich(args({ projectIntelligence: () => { throw new Error('private-detail'); } }));
  assert.equal(result.status, 'ok');
  assert.ok(result.guidance);
  assert.equal('intelligence' in result.guidance, false);
  assert.equal(JSON.stringify(result).includes('private-detail'), false);
});
