import test from 'node:test';
import assert from 'node:assert/strict';
import { correlateEvidence } from '../src/core/correlate.js';
import { normalizeEvidence } from '../src/core/normalize.js';
import { enrich } from '../src/core/orchestrator.js';
import { createProviderRegistry } from '../src/core/provider-registry.js';
import { TtlCache } from '../src/core/cache.js';
import { threatminerProvider, virustotalProvider, threatfoxProvider } from '../src/providers/index.js';

// Regression contract for decision-grade semantic interpretation and coverage.
const SECRET = 'semantic-regression-secret';

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

async function invoke(adapter, input, raw, env = {}) {
  const fetchImpl = async () => json(raw);
  return adapter.run(input, { fetchImpl, env, signal: new AbortController().signal });
}

function normalized(provider, indicator, type, data) {
  return normalizeEvidence(provider, indicator, type, data, {
    retrievedAt: '2026-08-22T09:00:00Z',
    rawHash: 'a'.repeat(64),
    parserVersion: 'test',
  });
}

function adapter(name, { observationTypes, run }) {
  return {
    name,
    types: ['ip'],
    observationTypes,
    cacheTtlMs: 1000,
    negativeCacheTtlMs: 100,
    costClass: 'free',
    tier: 1,
    timeoutMs: 100,
    maxResponseBytes: 2048,
    fixedHosts: ['example.test'],
    parserVersion: '1',
    sourceUrl: 'https://example.test/docs',
    run,
  };
}

test('real VirusTotal and ThreatFox adapter outputs corroborate as reputation evidence', async () => {
  const indicator = 'evil.example';
  const vt = await invoke(
    virustotalProvider,
    { value: indicator, type: 'domain' },
    { data: { id: indicator, attributes: { last_analysis_stats: { malicious: 8, suspicious: 1, harmless: 0, undetected: 1 }, reputation: -20, last_analysis_date: 1787300000 } } },
    { VIRUSTOTAL_API_KEY: SECRET },
  );
  const tf = await invoke(
    threatfoxProvider,
    { value: indicator, type: 'domain' },
    { query_status: 'ok', data: [{ ioc: indicator, ioc_type: 'domain', threat_type: 'botnet_cc', confidence_level: 95, first_seen: '2026-08-21 00:00:00 UTC', last_seen: '2026-08-22 00:00:00 UTC' }] },
    { ABUSECH_API_KEY: SECRET },
  );

  assert.equal(vt.observationType, 'multi_engine_reputation');
  assert.equal(tf.observationType, 'threat_intelligence');
  const out = correlateEvidence({
    indicator,
    type: 'domain',
    now: '2026-08-22T09:00:00Z',
    evidence: [normalized('virustotal', indicator, 'domain', vt), normalized('threatfox', indicator, 'domain', tf)],
  });
  assert.equal(out.threatAssessment.state, 'supported');
  assert.deepEqual(out.threatAssessment.assessmentBasis.providers, ['threatfox', 'virustotal']);
});

test('feed absence is not negative evidence while explicit benign remains negative', async () => {
  const indicator = 'quiet.example';
  const threatfoxMiss = await invoke(
    threatfoxProvider,
    { value: indicator, type: 'domain' },
    { query_status: 'no_result' },
    { ABUSECH_API_KEY: SECRET },
  );
  assert.equal(threatfoxMiss.verdict, 'no_association');

  const absence = correlateEvidence({
    indicator,
    type: 'domain',
    evidence: [
      normalized('threatfox', indicator, 'domain', threatfoxMiss),
      normalized('openphish', indicator, 'domain', { observationType: 'phishing_feed_match', verdict: 'not_listed' }),
    ],
  });
  assert.equal(absence.threatAssessment.state, 'insufficient');
  assert.deepEqual(absence.threatAssessment.assessmentBasis.providers, []);
  assert.equal(absence.contradictions.length, 0);

  const explicitBenign = correlateEvidence({
    indicator,
    type: 'domain',
    evidence: [normalized('explicit-reputation', indicator, 'domain', { observationType: 'reputation', verdict: 'benign' })],
  });
  assert.equal(explicitBenign.threatAssessment.state, 'negative');
});

test('coverage compares canonical runtime evidence classes with declared semantic classes', async () => {
  const alias = adapter('alias', {
    observationTypes: ['abuse_reports'],
    run: async () => ({ observationType: 'reported_abuse', verdict: 'suspicious' }),
  });
  const aliasResult = await enrich({
    indicator: '198.51.100.20',
    type: 'ip',
    providerNames: ['alias'],
    registry: createProviderRegistry([alias]),
    cache: new TtlCache(),
    requestId: 'alias',
    now: () => '2026-08-22T09:00:00Z',
  });
  assert.equal(aliasResult.coverage.materialLoss, false);

  const mixed = adapter('mixed', {
    observationTypes: ['reputation', 'network_identity'],
    run: async () => ({ observationType: 'network_identity', verdict: 'observed' }),
  });
  const mixedResult = await enrich({
    indicator: '198.51.100.21',
    type: 'ip',
    providerNames: ['mixed'],
    registry: createProviderRegistry([mixed]),
    cache: new TtlCache(),
    requestId: 'mixed',
    now: () => '2026-08-22T09:00:00Z',
  });
  assert.equal(mixedResult.coverage.materialLoss, true);
  assert.ok(mixedResult.limitations.includes('material_coverage_loss'));
});

test('real multi-semantic providers use type-specific coverage expectations', async () => {
  const vt = await enrich({
    indicator: 'evil.example',
    type: 'domain',
    providerNames: ['virustotal'],
    registry: createProviderRegistry([virustotalProvider]),
    cache: new TtlCache(),
    requestId: 'vt-coverage',
    now: () => '2026-08-22T09:00:00Z',
    context: {
      env: { VIRUSTOTAL_API_KEY: SECRET },
      fetchImpl: async () => json({ data: { attributes: { last_analysis_stats: { malicious: 3, suspicious: 0, harmless: 0, undetected: 1 }, last_analysis_date: 1787300000 } } }),
    },
  });
  assert.equal(vt.status, 'ok');
  assert.equal(vt.coverage.materialLoss, false);

  const threatminer = await enrich({
    indicator: 'example.com',
    type: 'domain',
    providerNames: ['threatminer'],
    registry: createProviderRegistry([threatminerProvider]),
    cache: new TtlCache(),
    requestId: 'tm-coverage',
    now: () => '2026-08-22T09:00:00Z',
    context: {
      fetchImpl: async () => json({ status_code: 200, results: [{ ip: '192.0.2.10', first_seen: '2026-08-20', last_seen: '2026-08-22' }] }),
    },
  });
  assert.equal(threatminer.status, 'ok');
  assert.equal(threatminer.coverage.materialLoss, false);
});
