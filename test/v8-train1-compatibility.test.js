import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

const adapter = {
  name: 'rdap',
  displayName: 'RDAP',
  active: true,
  distribution: 'public',
  types: ['ip'],
  observationTypes: ['registration'],
  tier: 1,
  costClass: 'free',
  timeoutMs: 100,
  probeIntervalMs: 0,
  cacheTtlMs: 1000,
  negativeCacheTtlMs: 100,
  maxResponseBytes: 2048,
  fixedHosts: ['rdap.arin.net'],
  methods: ['GET'],
  protocols: ['https:'],
  parserVersion: '1',
  sourceUrl: 'https://rdap.arin.net/',
  authType: 'none',
  credentialEnv: null,
  credentialRequired: false,
  sourceRole: 'first_party',
  freshnessClass: 'live',
  admissionVersion: 'v8.0',
  executionPolicy: 'v8.1',
  semanticClassHints: ['network_context'],
  coverageObservationTypesByType: { ip: ['registration'] },
  run: async () => ({ observationType: 'registration', verdict: 'observed' }),
};

function authRequest(body) {
  return new Request('https://example.test/api/enrich', {
    method: 'POST',
    headers: { authorization: 'Bearer test-token', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('Train 1 keeps public meta backward-compatible with additive deterministic scheduler metadata only', async () => {
  const app = createApp({ env: { PARA11AX_TOKEN: 'test-token' }, adapters: [adapter] });
  const out = await app.handleMeta(new Request('https://example.test/api/meta'));
  assert.equal(out.status, 200);
  assert.deepEqual(Object.keys(out.body.providers.rdap).sort(), [
    'active', 'authType', 'cacheTtlMs', 'costClass', 'displayName', 'distribution', 'fixedHosts', 'maxResponseBytes',
    'methods', 'negativeCacheTtlMs', 'observationTypes', 'parserVersion', 'probeIntervalMs', 'protocols',
    'requiresCredential', 'scheduler', 'sourceUrl', 'tier', 'timeoutMs', 'types',
  ]);
  assert.deepEqual(out.body.providers.rdap.scheduler.byType.ip, {
    fallback: true,
    rationale: 'legacy_priority_fallback',
  });
  const serialized = JSON.stringify(out.body);
  assert.equal(serialized.includes('sourceRole'), false);
  assert.equal(serialized.includes('freshnessClass'), false);
  assert.equal(serialized.includes('executionPolicy'), false);
  assert.doesNotMatch(serialized, /"rank"|"workflowIndex"/);
});

test('Train 1 compatibility remains stable except approved additive evidence coverage and intelligence semantics', async () => {
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
  assert.deepEqual(out.body.coverage.providerCapabilities, [{
    provider: 'rdap',
    state: 'ok',
    observationTypes: ['registration'],
    semanticClassHints: ['network_context'],
    sourceRole: 'first_party',
  }]);

  const withoutApprovedIntelligence = structuredClone(out.body);
  delete withoutApprovedIntelligence.intelligence;
  const serialized = JSON.stringify(withoutApprovedIntelligence);
  for (const field of ['freshnessClass', 'executionPolicy', 'capabilities', 'distribution']) {
    assert.equal(serialized.includes(field), false, field);
  }

  const withoutApprovedSourceRoles = structuredClone(withoutApprovedIntelligence);
  for (const item of withoutApprovedSourceRoles.evidence ?? []) {
    if (item?.semantics) delete item.semantics.sourceRole;
  }
  for (const item of withoutApprovedSourceRoles.coverage?.providerCapabilities ?? []) {
    delete item.sourceRole;
  }
  assert.equal(JSON.stringify(withoutApprovedSourceRoles).includes('sourceRole'), false);
});