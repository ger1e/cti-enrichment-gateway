import test from 'node:test';
import assert from 'node:assert/strict';
import { TtlCache } from '../src/core/cache.js';
import { createProviderRegistry } from '../src/core/provider-registry.js';
import { normalizeEvidence } from '../src/core/normalize.js';
import { enrich } from '../src/core/orchestrator.js';

function adapter(name, {
  types = ['ip'],
  observationTypes = ['fixture_context'],
  run,
  parserVersion = '1',
  tier = 1,
  costClass = 'free',
  schedulerByType,
  sourceRole = 'community',
  coverageObservationTypesByType,
} = {}) {
  return {
    name,
    types,
    observationTypes,
    cacheTtlMs: 1000,
    negativeCacheTtlMs: 100,
    costClass,
    tier,
    timeoutMs: 100,
    maxResponseBytes: 2048,
    fixedHosts: ['example.test'],
    parserVersion,
    sourceUrl: 'https://example.test/docs',
    sourceRole,
    ...(coverageObservationTypesByType ? { coverageObservationTypesByType } : {}),
    ...(schedulerByType ? { schedulerByType } : {}),
    run,
  };
}

const PRIORITY_BASE = Object.freeze({
  semanticUniqueness: 'unique',
  intelligenceValue: 'direct',
  pivotValue: 'high',
  latencyClass: 'fast',
});

test('normalizes provider result into canonical evidence', () => {
  const evidence = normalizeEvidence('demo', '8.8.8.8', 'ip', { verdict: 'benign', confidence: 90, firstSeen: '2026-01-01T00:00:00Z', tags: ['resolver'], references: ['https://example.test/ref'] }, { retrievedAt: '2026-08-20T12:00:00Z', rawHash: 'a'.repeat(64), parserVersion: '1' });
  assert.equal(evidence.provider, 'demo');
  assert.equal(evidence.indicator, '8.8.8.8');
  assert.equal(evidence.observation.verdict, 'benign');
  assert.equal(evidence.integrity.rawHash, 'a'.repeat(64));
  assert.deepEqual(evidence.references, ['https://example.test/ref']);
});

test('enrich uses cache and returns ok when all providers succeed', async () => {
  let calls = 0;
  const one = adapter('one', { run: async () => { calls++; return { verdict: 'unknown' }; } });
  const registry = createProviderRegistry([one]);
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
  const good = adapter('good', { run: async () => ({ verdict: 'unknown' }) });
  const bad = adapter('bad', { run: async () => { throw new Error('down'); } });
  const registry = createProviderRegistry([good, bad]);
  const result = await enrich({ indicator: '8.8.8.8', type: 'ip', providerNames: ['good', 'bad'], registry, cache: new TtlCache(), requestId: 'r', now: () => '2026-08-20T12:00:00Z' });
  assert.equal(result.status, 'partial');
  assert.equal(result.evidence.length, 1);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].provider, 'bad');
});

test('all provider failures return error response without throwing', async () => {
  const bad = adapter('bad', { types: ['cve'], run: async () => { const e = new Error('limited'); e.status = 429; throw e; } });
  const registry = createProviderRegistry([bad]);
  const result = await enrich({ indicator: 'CVE-2026-12345', type: 'cve', providerNames: ['bad'], registry, cache: new TtlCache(), requestId: 'r', now: () => '2026-08-20T12:00:00Z' });
  assert.equal(result.status, 'error');
  assert.equal(result.evidence.length, 0);
  assert.equal(result.failures[0].reason, 'rate_limited');
});

test('empty provider selection returns explicit gateway failure', async () => {
  const result = await enrich({ indicator: 'https://example.com/', type: 'url', providerNames: [], registry: createProviderRegistry([]), cache: new TtlCache(), requestId: 'r', now: () => '2026-08-20T12:00:00Z' });
  assert.equal(result.status, 'error');
  assert.deepEqual(result.failures, [{ provider: 'gateway', reason: 'no_configured_providers' }]);
  assert.deepEqual(result.evidence, []);
});

test('coverage separates selected executed succeeded failed skipped and cached success', async () => {
  let calls = 0;
  const good = adapter('good', { run: async () => { calls++; return { verdict: 'unknown' }; } });
  const bad = adapter('bad', { run: async () => { calls++; throw new Error('down'); } });
  const registry = createProviderRegistry([good, bad]);
  const cache = new TtlCache();
  const base = { indicator: '8.8.8.8', type: 'ip', providerNames: ['good', 'bad', 'missing'], registry, cache, now: () => '2026-08-20T12:00:00Z' };
  const first = await enrich({ ...base, requestId: 'r1' });
  assert.deepEqual(first.coverage, {
    selected: 3, executed: 2, succeeded: 1, failed: 1, skipped: 1, materialLoss: true,
    providerCapabilities: [
      { provider: 'good', state: 'ok', observationTypes: ['fixture_context'], semanticClassHints: ['fixture_context'], sourceRole: 'community' },
      { provider: 'bad', state: 'failed', observationTypes: ['fixture_context'], semanticClassHints: ['fixture_context'], sourceRole: 'community' },
      { provider: 'missing', state: 'skipped', observationTypes: [], semanticClassHints: [], sourceRole: null },
    ],
  });
  assert.ok(first.limitations.includes('partial_provider_failure'));
  assert.ok(first.limitations.includes('material_coverage_loss'));
  const second = await enrich({ ...base, providerNames: ['good'], requestId: 'r2' });
  assert.deepEqual(second.coverage, {
    selected: 1, executed: 0, succeeded: 1, failed: 0, skipped: 0, materialLoss: false,
    providerCapabilities: [
      { provider: 'good', state: 'cached', observationTypes: ['fixture_context'], semanticClassHints: ['fixture_context'], sourceRole: 'community' },
    ],
  });
  assert.equal(calls >= 2, true);
});

test('coverage capability detail uses typed declarations, semantic hints, source role, and final provider state', async () => {
  const good = adapter('good', {
    observationTypes: ['network_identity', 'registration'],
    coverageObservationTypesByType: { ip: ['registration'] },
    sourceRole: 'first_party',
    run: async () => ({ observationType: 'registration', verdict: 'observed' }),
  });
  const bad = adapter('bad', {
    observationTypes: ['ioc_reputation'],
    sourceRole: 'community',
    run: async () => { throw new Error('down'); },
  });
  const result = await enrich({
    indicator: '8.8.8.8', type: 'ip', providerNames: ['good', 'bad'], registry: createProviderRegistry([good, bad]),
    cache: new TtlCache(), requestId: 'coverage-capabilities', now: () => '2026-08-20T12:00:00Z',
  });
  assert.deepEqual(result.coverage.providerCapabilities, [
    { provider: 'good', state: 'ok', observationTypes: ['registration'], semanticClassHints: ['network_context'], sourceRole: 'first_party' },
    { provider: 'bad', state: 'failed', observationTypes: ['ioc_reputation'], semanticClassHints: ['reputation'], sourceRole: 'community' },
  ]);
});

test('loss of every selected provider for a semantic class is material coverage loss', async () => {
  const reputation = adapter('rep', { observationTypes: ['reputation'], run: async () => { throw new Error('down'); } });
  const context = adapter('ctx', { observationTypes: ['network_identity'], run: async () => ({ verdict: 'observed' }) });
  const registry = createProviderRegistry([reputation, context]);
  const result = await enrich({ indicator: '8.8.8.8', type: 'ip', providerNames: ['rep', 'ctx'], registry, cache: new TtlCache(), requestId: 'r', now: () => '2026-08-20T12:00:00Z' });
  assert.equal(result.coverage.materialLoss, true);
  assert.ok(result.limitations.includes('material_coverage_loss'));
});

test('IP orchestration starts admitted providers in value order while preserving envelope evidence order', async () => {
  const starts = [];
  const community = adapter('community-first-in-workflow', {
    tier: 1,
    schedulerByType: { ip: { authorityClass: 'community', ...PRIORITY_BASE } },
    observationTypes: ['network_identity'],
    run: async () => { starts.push('community-first-in-workflow'); return { observationType: 'network_identity', verdict: 'observed' }; },
  });
  const authoritative = adapter('authoritative-second-in-workflow', {
    tier: 5,
    schedulerByType: { ip: { authorityClass: 'authoritative', ...PRIORITY_BASE } },
    observationTypes: ['registration'],
    run: async () => { starts.push('authoritative-second-in-workflow'); return { observationType: 'registration', verdict: 'observed' }; },
  });
  const registry = createProviderRegistry([community, authoritative]);
  const result = await enrich({
    indicator: '8.8.8.8', type: 'ip',
    providerNames: ['community-first-in-workflow', 'authoritative-second-in-workflow'],
    registry, cache: new TtlCache(), requestId: 'priority',
    now: () => '2026-08-20T12:00:00Z',
  });
  assert.deepEqual(starts, ['authoritative-second-in-workflow', 'community-first-in-workflow']);
  assert.deepEqual(result.evidence.map(item => item.provider), ['community-first-in-workflow', 'authoritative-second-in-workflow']);
});

test('orchestrator keeps the fixed two-attempt provider call ceiling under typed scheduling', async () => {
  const calls = new Map();
  const providers = ['a', 'b', 'c'].map((name, index) => adapter(name, {
    tier: index + 1,
    schedulerByType: { ip: { authorityClass: 'specialist', ...PRIORITY_BASE } },
    run: async () => {
      calls.set(name, (calls.get(name) ?? 0) + 1);
      throw new Error('transient');
    },
  }));
  const result = await enrich({
    indicator: '8.8.8.8', type: 'ip', providerNames: providers.map(item => item.name),
    registry: createProviderRegistry(providers), cache: new TtlCache(), requestId: 'budget',
    now: () => '2026-08-20T12:00:00Z',
  });
  assert.equal(result.budget.providerCallLimit, providers.length * 2);
  assert.equal(result.budget.providerCalls <= providers.length * 2, true);
  for (const name of providers.map(item => item.name)) assert.equal((calls.get(name) ?? 0) <= 2, true, name);
});
