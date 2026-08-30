import test from 'node:test';
import assert from 'node:assert/strict';
import { TtlCache } from '../src/core/cache.js';
import { createProviderRegistry } from '../src/core/provider-registry.js';
import { enrich } from '../src/core/orchestrator.js';

function adapter(name, { types = ['ip'], observationType = 'reputation', verdict = 'malicious' } = {}) {
  return {
    name,
    types,
    observationTypes: [observationType],
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
      observationType,
      verdict,
      lastSeen: '2026-08-30T09:00:00.000Z',
    }),
  };
}

function baseArgs(provider, type = 'ip') {
  return {
    indicator: type === 'ip' ? '203.0.113.7' : 'example.com',
    type,
    providerNames: [provider.name],
    registry: createProviderRegistry([provider]),
    cache: new TtlCache(),
    requestId: `kernel-${type}`,
    now: () => '2026-08-30T10:00:00.000Z',
  };
}

test('successful IP enrichment exposes Intelligence Kernel v1 separately from Evidence v2', async () => {
  const provider = adapter('fixture');
  const result = await enrich(baseArgs(provider));

  assert.equal(result.status, 'ok');
  assert.equal(result.intelligence.schemaVersion, '1.0');
  assert.equal(result.intelligence.type, 'ip');
  assert.notEqual(result.intelligence, result.evidence);
  assert.equal(result.evidence.some(item => item === result.intelligence), false);
  assert.equal(result.intelligence.evidenceStrength.evidenceFingerprints[0], result.evidence[0].integrity.fingerprint);
});

test('kernel projection failure is isolated and never reflects internal exception detail', async () => {
  const provider = adapter('fixture');
  const result = await enrich({
    ...baseArgs(provider),
    projectIntelligence: () => { throw new Error('boom'); },
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.evidence.length, 1);
  assert.ok(result.decision);
  assert.equal('intelligence' in result, false);
  assert.deepEqual(result.limitations.filter(item => item === 'intelligence_projection_unavailable'), ['intelligence_projection_unavailable']);
  assert.equal(JSON.stringify(result).includes('boom'), false);
});

test('non-IP enrichment never invokes the Stage 1 IP intelligence projection', async () => {
  let calls = 0;
  const provider = adapter('domain-fixture', { types: ['domain'], observationType: 'reputation' });
  const result = await enrich({
    ...baseArgs(provider, 'domain'),
    projectIntelligence: () => { calls += 1; throw new Error('must-not-run'); },
  });

  assert.equal(result.status, 'ok');
  assert.equal(calls, 0);
  assert.equal('intelligence' in result, false);
  assert.equal(result.limitations.includes('intelligence_projection_unavailable'), false);
  assert.equal(JSON.stringify(result).includes('must-not-run'), false);
});
