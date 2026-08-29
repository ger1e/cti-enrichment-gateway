import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

const adapter = Object.freeze({
  name: 'source-role-fixture',
  types: ['ip'],
  observationTypes: ['dns_resolution'],
  sourceRole: 'first_party',
  costClass: 'free',
  tier: 1,
  timeoutMs: 1000,
  cacheTtlMs: 60_000,
  negativeCacheTtlMs: 10_000,
  maxResponseBytes: 2048,
  fixedHosts: ['example.test'],
  parserVersion: 'fixture-1',
  sourceUrl: 'https://example.test/docs',
  async run() {
    return {
      observationType: 'dns_resolution',
      verdict: 'context',
      attributes: { answers: ['203.0.113.9'] },
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

test('orchestrator preserves provider source role in additive evidence semantics', async () => {
  const app = createApp({ env: { PARA11AX_TOKEN: 'test-token' }, adapters: [adapter] });
  const response = await app.handleEnrich(request({ indicator: '203.0.113.7' }));
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.evidence[0].semantics, {
    class: 'observed_fact',
    semanticClass: 'network_context',
    sourceRole: 'first_party',
  });
});
