import test from 'node:test';
import assert from 'node:assert/strict';
import { TtlCache } from '../src/core/cache.js';
import { createProviderRegistry } from '../src/core/provider-registry.js';
import { normalizeEvidence } from '../src/core/normalize.js';
import { enrich } from '../src/core/orchestrator.js';

test('normalizes provider result into canonical evidence', () => {
  const evidence = normalizeEvidence('demo', '8.8.8.8', 'ip', {
    verdict: 'benign', confidence: 90, firstSeen: '2026-01-01T00:00:00Z', tags: ['resolver'], references: ['https://example.test/ref']
  }, { retrievedAt: '2026-08-20T12:00:00Z', rawHash: 'a'.repeat(64), parserVersion: '1' });
  assert.equal(evidence.provider, 'demo');
  assert.equal(evidence.indicator, '8.8.8.8');
  assert.equal(evidence.observation.verdict, 'benign');
  assert.equal(evidence.integrity.rawHash, 'a'.repeat(64));
  assert.deepEqual(evidence.references, ['https://example.test/ref']);
});

test('enrich uses cache and returns ok when all providers succeed', async () => {
  let calls = 0;
  const adapter = { name: 'one', types: ['ip'], cacheTtlMs: 1000, negativeCacheTtlMs: 100, costClass: 'free', parserVersion: '1', run: async () => { calls++; return { verdict: 'unknown' }; } };
  const registry = createProviderRegistry([adapter]);
  const cache = new TtlCache();
  const args = { indicator: '8.8.8.8', type: 'ip', providerNames: ['one'], registry, cache, requestId: 'r1', now: () => '2026-08-20T12:00:00Z' };
  const first = await enrich(args);
  const second = await enrich({ ...args, requestId: 'r2' });
  assert.equal(first.status, 'ok');
  assert.equal(second.status, 'ok');
  assert.equal(calls, 1);
  assert.equal(second.meta.cache.one, 'hit');
});

test('one provider failure produces partial status and structured failure', async () => {
  const good = { name: 'good', types: ['ip'], cacheTtlMs: 1000, negativeCacheTtlMs: 100, costClass: 'free', run: async () => ({ verdict: 'unknown' }) };
  const bad = { name: 'bad', types: ['ip'], cacheTtlMs: 1000, negativeCacheTtlMs: 100, costClass: 'free', run: async () => { throw new Error('down'); } };
  const registry = createProviderRegistry([good, bad]);
  const result = await enrich({ indicator: '8.8.8.8', type: 'ip', providerNames: ['good', 'bad'], registry, cache: new TtlCache(), requestId: 'r', now: () => '2026-08-20T12:00:00Z' });
  assert.equal(result.status, 'partial');
  assert.equal(result.evidence.length, 1);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].provider, 'bad');
});

test('all provider failures return error response without throwing', async () => {
  const bad = { name: 'bad', types: ['cve'], cacheTtlMs: 1000, negativeCacheTtlMs: 100, costClass: 'free', run: async () => { const e = new Error('limited'); e.status = 429; throw e; } };
  const registry = createProviderRegistry([bad]);
  const result = await enrich({ indicator: 'CVE-2026-12345', type: 'cve', providerNames: ['bad'], registry, cache: new TtlCache(), requestId: 'r', now: () => '2026-08-20T12:00:00Z' });
  assert.equal(result.status, 'error');
  assert.equal(result.evidence.length, 0);
  assert.equal(result.failures[0].reason, 'rate_limited');
});
