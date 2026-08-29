import test from 'node:test';
import assert from 'node:assert/strict';
import { TtlCache } from '../src/core/cache.js';
import { createProviderRegistry } from '../src/core/provider-registry.js';
import { enrich } from '../src/core/orchestrator.js';

function adapter(name, { fail = false } = {}) {
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
    run: async () => {
      if (fail) throw new Error('down');
      return {
        verdict: 'malicious',
        observationType: 'reputation',
        lastSeen: '2026-08-29T12:00:00Z',
        references: [`https://example.test/${name}`],
        attributes: { attackIds: ['T1105'] },
      };
    },
  };
}

async function run(providerNames, registry, requestId) {
  return enrich({
    indicator: 'evil.example',
    type: 'domain',
    providerNames,
    registry,
    cache: new TtlCache(),
    requestId,
    now: () => '2026-08-29T12:30:00Z',
    nowMs: (() => { let value = 0; return () => value++; })(),
  });
}

test('ok enrichment additively exposes evidenceGraph and guidance after decision support', async () => {
  const registry = createProviderRegistry([adapter('rep-a'), adapter('rep-b')]);
  const result = await run(['rep-a', 'rep-b'], registry, 'train5-ok');

  assert.equal(result.status, 'ok');
  assert.ok(result.decision, 'existing decision contract remains present');
  assert.equal(result.evidenceGraph.schemaVersion, '1.0');
  assert.equal(result.guidance.schemaVersion, '1.0');
  assert.equal(result.guidance.disposition, result.decision.disposition);
  assert.equal(result.guidance.confidence, result.decision.confidence);
  assert.equal(result.evidenceGraph.rootId, result.evidenceGraph.nodes.find(node => node.type === 'observable' && node.value === result.indicator)?.id);
  assert.equal(result.evidenceGraph.nodes.filter(node => node.type === 'evidence').length, result.evidence.length);
  assert.deepEqual(
    result.guidance.evidenceFingerprints,
    result.evidence.map(item => item.integrity.fingerprint).sort(),
  );
  assert.equal('score' in result.evidenceGraph, false);
  assert.equal('score' in result.guidance, false);
});

test('partial enrichment still exposes graph and guidance for successful evidence only', async () => {
  const registry = createProviderRegistry([adapter('good'), adapter('bad', { fail: true })]);
  const result = await run(['good', 'bad'], registry, 'train5-partial');

  assert.equal(result.status, 'partial');
  assert.equal(result.evidence.length, 1);
  assert.equal(result.failures.length, 1);
  assert.equal(result.evidenceGraph.nodes.filter(node => node.type === 'evidence').length, 1);
  assert.deepEqual(result.guidance.evidenceFingerprints, [result.evidence[0].integrity.fingerprint]);
  assert.equal(result.guidance.coverage.materialLoss, result.coverage.materialLoss);
  assert.deepEqual(result.guidance.limitations, result.correlation.limitations);
});

test('error enrichment does not manufacture graph or guidance', async () => {
  const registry = createProviderRegistry([adapter('bad', { fail: true })]);
  const result = await run(['bad'], registry, 'train5-error');

  assert.equal(result.status, 'error');
  assert.equal('evidenceGraph' in result, false);
  assert.equal('guidance' in result, false);
  assert.ok(result.decision, 'legacy decision output remains available on error responses');
});

test('empty provider selection retains the legacy error envelope without graph or guidance', async () => {
  const result = await run([], createProviderRegistry([]), 'train5-empty');
  assert.equal(result.status, 'error');
  assert.equal('evidenceGraph' in result, false);
  assert.equal('guidance' in result, false);
  assert.deepEqual(result.failures, [{ provider: 'gateway', reason: 'no_configured_providers' }]);
});
