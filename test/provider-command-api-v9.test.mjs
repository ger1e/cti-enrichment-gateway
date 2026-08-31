import assert from 'node:assert/strict';
import test from 'node:test';

import { createGatewayClient, GatewayHttpError } from '../app/api-client.js';
import { createApp } from '../src/app.js';
import { TtlCache } from '../src/core/cache.js';
import { makeProviderAdapter } from './helpers/shell-v9-fixtures.mjs';

const env = { PARA11AX_TOKEN: 'gateway-secret' };
const req = ({ auth = true, method = 'POST', body, headers = {} } = {}) => ({
  method,
  headers: { ...(auth ? { authorization: `Bearer ${env.PARA11AX_TOKEN}` } : {}), ...headers },
  body,
});

function provider(name = 'unit-provider', overrides = {}) {
  return { ...makeProviderAdapter({ name }), ...overrides };
}

test('named provider endpoint executes exactly one registered provider through Evidence v2', async () => {
  let calls = 0;
  const adapter = provider('unit-provider', {
    run: async () => { calls += 1; return { observationType: 'fixture_context', verdict: 'unknown', confidence: 0.5, references: [] }; },
  });
  const app = createApp({ env, adapters: [adapter], cache: new TtlCache(), now: () => '2026-08-30T12:00:00.000Z', nowMs: () => 1000 });
  const response = await app.handleProvider(req({ body: { provider: 'unit-provider', indicator: '8.8.8.8' } }));
  assert.equal(response.status, 200);
  assert.equal(response.body.type, 'ip');
  assert.equal(response.body.profile, 'standard');
  assert.equal(response.body.evidence.length, 1);
  assert.equal(response.body.evidence[0].provider, 'unit-provider');
  assert.equal(calls, 1);
});

test('named provider endpoint rejects unsafe fields before provider execution', async () => {
  let calls = 0;
  const app = createApp({ env, adapters: [provider('unit-provider', { run: async () => { calls += 1; return {}; } })] });
  for (const body of [
    { provider: 'unit-provider', indicator: '8.8.8.8', host: 'evil.example' },
    { provider: 'unit-provider', indicator: '8.8.8.8', method: 'POST' },
    { provider: 'unit-provider', indicator: '8.8.8.8', credential: 'TOPSECRET' },
    { provider: '../unit-provider', indicator: '8.8.8.8' },
  ]) {
    const response = await app.handleProvider(req({ body }));
    assert.equal(response.status, 400);
  }
  assert.equal(calls, 0);
});

test('named provider endpoint has explicit provider state and type errors', async () => {
  const active = provider('active-provider', { types: ['ip'] });
  const inactive = provider('inactive-provider', { active: false });
  const unconfigured = provider('credential-provider', { requiredEnv: 'UNIT_PROVIDER_KEY' });
  const app = createApp({ env, adapters: [active, inactive, unconfigured] });

  let response = await app.handleProvider(req({ body: { provider: 'missing-provider', indicator: '8.8.8.8' } }));
  assert.equal(response.status, 404); assert.equal(response.body.error, 'provider_not_found');
  response = await app.handleProvider(req({ body: { provider: 'inactive-provider', indicator: '8.8.8.8' } }));
  assert.equal(response.status, 409); assert.equal(response.body.error, 'provider_inactive');
  response = await app.handleProvider(req({ body: { provider: 'active-provider', indicator: 'example.com' } }));
  assert.equal(response.status, 400); assert.equal(response.body.error, 'provider_type_unsupported');
  response = await app.handleProvider(req({ body: { provider: 'credential-provider', indicator: '8.8.8.8' } }));
  assert.equal(response.status, 409); assert.equal(response.body.error, 'provider_unconfigured');
});

test('named provider endpoint inherits auth media type and indicator type gates', async () => {
  const app = createApp({ env, adapters: [provider()] });
  assert.equal((await app.handleProvider(req({ auth: false, body: { provider: 'unit-provider', indicator: '8.8.8.8' } }))).status, 401);
  assert.equal((await app.handleProvider(req({ method: 'GET', body: { provider: 'unit-provider', indicator: '8.8.8.8' } }))).status, 405);
  assert.equal((await app.handleProvider(req({ body: { provider: 'unit-provider', indicator: 'garbage' } }))).status, 400);
  assert.equal((await app.handleProvider(req({ body: { provider: 'unit-provider', indicator: '8.8.8.8', type: 'domain' } }))).status, 400);
});

test('gateway client sends only provider and indicator to same-origin named-provider route', async () => {
  const calls = [];
  const envelope = {
    schemaVersion: '2.0', gatewayVersion: 'test', requestId: 'p1', indicator: '8.8.8.8', type: 'ip', profile: 'standard',
    status: 'ok', evidence: [], failures: [], relationships: [], correlation: {},
  };
  const client = createGatewayClient({
    getToken: () => 'secret-token',
    fetchImpl: async (url, init) => { calls.push({ url, init }); return new Response(JSON.stringify(envelope), { status: 200, headers: { 'content-type': 'application/json' } }); },
  });
  assert.equal((await client.provider('virustotal', '8.8.8.8')).requestId, 'p1');
  assert.equal(calls[0].url, '/api/para11ax/provider');
  assert.equal(calls[0].init.credentials, 'same-origin');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer secret-token');
  assert.deepEqual(JSON.parse(calls[0].init.body), { provider: 'virustotal', indicator: '8.8.8.8' });
  await assert.rejects(() => client.provider('../bad', '8.8.8.8'), TypeError);
});

test('gateway client fails closed without bearer before named-provider network access', async () => {
  const client = createGatewayClient({ getToken: () => null, fetchImpl: async () => { throw new Error('network must not run'); } });
  await assert.rejects(() => client.provider('virustotal', '8.8.8.8'), error => error instanceof GatewayHttpError && error.status === 401);
});
