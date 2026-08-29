import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

const adapter = Object.freeze({
  name: 'rdap',
  types: ['ip'],
  observationTypes: ['registration'],
  costClass: 'free',
  tier: 1,
  timeoutMs: 1000,
  cacheTtlMs: 60_000,
  negativeCacheTtlMs: 10_000,
  maxResponseBytes: 2048,
  fixedHosts: ['fixture.invalid'],
  methods: ['GET'],
  protocols: ['https:'],
  parserVersion: 'fixture-1',
  sourceUrl: 'https://fixture.invalid/docs',
  sourceRole: 'first_party',
  distribution: 'shareable',
  freshnessClass: 'live',
  executionPolicy: 'v8.1',
  async run() {
    return {
      observationType: 'registration',
      verdict: 'context',
      tags: ['fixture'],
      attributes: { registered: true },
      relationships: [],
      references: ['https://fixture.invalid/reference'],
    };
  },
});

const authRequest = body => ({
  method: 'POST',
  headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
  body,
});

test('Train 1 keeps public meta shape backward-compatible and does not expose internal capability metadata', async () => {
  const app = createApp({ env: { PARA11AX_TOKEN: 'test-token' }, adapters: [adapter] });
  const out = await app.handleMeta({ method: 'GET', headers: {} });
  assert.equal(out.status, 200);
  assert.equal(Object.hasOwn(out.body, 'capabilities'), false);
  assert.deepEqual(Object.keys(out.body.providers.rdap).sort(), [
    'active', 'cacheTtlMs', 'costClass', 'fixedHosts', 'maxResponseBytes', 'methods',
    'negativeCacheTtlMs', 'observationTypes', 'optionalCredential', 'parserVersion',
    'protocols', 'requiresCredential', 'sourceUrl', 'tier', 'timeoutMs', 'types',
  ]);
  const serialized = JSON.stringify(out.body);
  assert.equal(serialized.includes('sourceRole'), false);
  assert.equal(serialized.includes('freshnessClass'), false);
  assert.equal(serialized.includes('executionPolicy'), false);
});

test('Train 1 compatibility remains stable except Train 3 additive evidence semantics', async () => {
  const app = createApp({ env: { PARA11AX_TOKEN: 'test-token' }, adapters: [adapter] });
  const out = await app.handleEnrich(authRequest({ indicator: '203.0.113.7' }));
  assert.equal(out.status, 200);
  assert.equal(out.body.schemaVersion, '2.0');
  assert.equal(out.body.gatewayVersion, '2.0.0');
  assert.deepEqual(out.body.evidence[0].semantics, {
    class: 'observed_fact',
    semanticClass: 'network_context',
    sourceRole: 'first_party',
  });

  const serialized = JSON.stringify(out.body);
  for (const field of ['freshnessClass', 'executionPolicy', 'capabilities', 'distribution']) {
    assert.equal(serialized.includes(field), false, field);
  }

  const withoutEvidenceSourceRole = structuredClone(out.body);
  for (const item of withoutEvidenceSourceRole.evidence ?? []) {
    if (item?.semantics) delete item.semantics.sourceRole;
  }
  assert.equal(JSON.stringify(withoutEvidenceSourceRole).includes('sourceRole'), false);
});
