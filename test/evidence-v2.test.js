import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { EVIDENCE_SCHEMA_VERSION, GATEWAY_VERSION } from '../src/core/version.js';

const fixture = Object.freeze({
  name: 'fixture',
  types: ['ip'],
  observationTypes: ['fixture_context'],
  costClass: 'free',
  tier: 2,
  timeoutMs: 1000,
  cacheTtlMs: 60_000,
  negativeCacheTtlMs: 10_000,
  maxResponseBytes: 2048,
  fixedHosts: ['example.test'],
  parserVersion: 'fixture-1',
  sourceUrl: 'https://example.test/docs',
  async run() {
    return {
      observationType: 'fixture_context',
      verdict: 'context',
      tags: ['fixture'],
      attributes: { value: 1 },
      relationships: [],
      references: ['https://example.test/reference'],
    };
  },
});

function request(body) {
  return {
    method: 'POST',
    headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
    body,
  };
}

test('enrichment adds evidence-v2 envelope without removing legacy fields', async () => {
  const app = createApp({
    env: { CTI_GATEWAY_TOKEN: 'test-token' },
    adapters: [fixture],
    gatewayVersion: GATEWAY_VERSION,
    now: (() => { let i = 0; return () => new Date(Date.UTC(2026, 7, 21, 0, 0, i++)).toISOString(); })(),
  });
  const response = await app.handleEnrich(request({ indicator: '203.0.113.7' }));
  assert.equal(response.status, 200);
  const result = response.body;
  assert.equal(result.schemaVersion, EVIDENCE_SCHEMA_VERSION);
  assert.equal(result.gatewayVersion, GATEWAY_VERSION);
  assert.equal(result.profile, 'standard');
  assert.equal(typeof result.durationMs, 'number');
  assert.equal(result.durationMs >= 0, true);
  assert.equal(result.requestId.length > 0, true);
  assert.equal(result.indicator, '203.0.113.7');
  assert.equal(result.type, 'ip');
  assert.ok(result.queriedAt);
  assert.equal(result.status, 'ok');
  assert.deepEqual(Object.keys(result.providerSummary).sort(), ['cached','failed','ok','skipped']);
  assert.equal(result.providerSummary.ok, 1);
  assert.equal(result.providerSummary.failed, 0);
  assert.equal(typeof result.budget, 'object');
  assert.equal(Array.isArray(result.evidence), true);
  assert.equal(Array.isArray(result.relationships), true);
  assert.equal(Array.isArray(result.failures), true);
  assert.equal(typeof result.huntContext, 'object');
  assert.equal(typeof result.meta, 'object');
});

test('evidence v2 carries cache/duration/parser provenance and normalized fingerprint', async () => {
  const app = createApp({ env: { CTI_GATEWAY_TOKEN: 'test-token' }, adapters: [fixture], gatewayVersion: GATEWAY_VERSION });
  const first = await app.handleEnrich(request({ indicator: '203.0.113.7' }));
  const second = await app.handleEnrich(request({ indicator: '203.0.113.7' }));
  const item = second.body.evidence[0];
  assert.equal(item.provider, 'fixture');
  assert.equal(item.cacheState, 'hit');
  assert.equal(typeof item.durationMs, 'number');
  assert.equal(item.integrity.parserVersion, 'fixture-1');
  assert.match(item.integrity.fingerprint, /^[a-f0-9]{64}$/);
  assert.equal(item.integrity.rawHash === undefined || typeof item.integrity.rawHash === 'string', true);
  assert.equal(first.body.evidence[0].cacheState, 'miss');
});
