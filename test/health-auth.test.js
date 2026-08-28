import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

const env = { PARA11AX_TOKEN: 'health-secret', SHODAN_API_KEY: 'provider-secret' };

function request(auth = true, method = 'GET') {
  return { method, headers: auth ? { authorization: `Bearer ${env.PARA11AX_TOKEN}` } : {} };
}

test('health rejects unauthenticated callers and uses no-store', async () => {
  const app = createApp({ env });
  const result = await app.handleHealth(request(false));
  assert.equal(result.status, 401);
  assert.equal(result.body.error, 'unauthorized');
  assert.equal(result.headers['cache-control'], 'no-store');
});

test('authenticated health exposes configuration booleans but never secret values', async () => {
  const app = createApp({ env });
  const result = await app.handleHealth(request(true));
  assert.equal(result.status, 200);
  assert.equal(result.headers['cache-control'], 'no-store');
  assert.equal(result.body.gatewayAuthConfigured, true);
  assert.equal(result.body.providers.shodan.configured, true);
  const serialized = JSON.stringify(result.body);
  assert.equal(serialized.includes('health-secret'), false);
  assert.equal(serialized.includes('provider-secret'), false);
});

test('health remains GET-only', async () => {
  const app = createApp({ env });
  const result = await app.handleHealth(request(true, 'POST'));
  assert.equal(result.status, 405);
  assert.equal(result.headers.allow, 'GET');
});
