import assert from 'node:assert/strict';
import test from 'node:test';

import { createGatewayClient, GatewayHttpError } from '../app/api-client.js';

const jsonResponse = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('meta is public same-origin no-store and never sends bearer', async () => {
  const calls = [];
  const client = createGatewayClient({
    getToken: () => 'secret-token',
    fetchImpl: async (url, init) => { calls.push({ url, init }); return jsonResponse(200, { gatewayVersion: '2.0.0', profiles: ['fast','standard','full'], limits: {} }); },
  });
  const meta = await client.meta();
  assert.equal(meta.gatewayVersion, '2.0.0');
  assert.equal(calls[0].url, '/api/para11ax/meta');
  assert.equal(calls[0].init.cache, 'no-store');
  assert.equal(calls[0].init.credentials, 'same-origin');
  assert.equal(calls[0].init.headers.Authorization, undefined);
});

test('status remains authenticated and same-origin', async () => {
  const calls = [];
  const client = createGatewayClient({
    getToken: () => 'secret-token',
    fetchImpl: async (url, init) => { calls.push({ url, init }); return jsonResponse(200, { gatewayVersion: '2.0.0', uptimeMs: 42, providers: {} }); },
  });
  assert.equal((await client.status()).uptimeMs, 42);
  assert.equal(calls[0].url, '/api/para11ax/status');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer secret-token');
});

test('batch sends only indicators and fixed profile and rejects unsafe shapes locally', async () => {
  let sent;
  const client = createGatewayClient({
    getToken: () => 't',
    fetchImpl: async (_url, init) => { sent = JSON.parse(init.body); return jsonResponse(200, { requestId: 'b1', profile: 'standard', inputCount: 2, uniqueIndicators: 2, results: [] }); },
  });
  const result = await client.batch(['a.example','b.example'], 'standard');
  assert.equal(result.requestId, 'b1');
  assert.deepEqual(sent, { indicators: ['a.example','b.example'], profile: 'standard' });
  await assert.rejects(() => client.batch([], 'standard'), /1\.\.20/i);
  await assert.rejects(() => client.batch(Array.from({ length: 21 }, () => 'x.example'), 'standard'), /1\.\.20/i);
  await assert.rejects(() => client.batch(['x.example'], 'virustotal'), /invalid profile/i);
});

test('authenticated shell API methods still fail closed without bearer', async () => {
  const client = createGatewayClient({ getToken: () => null, fetchImpl: async () => { throw new Error('network must not run'); } });
  await assert.rejects(() => client.status(), (e) => e instanceof GatewayHttpError && e.status === 401);
  await assert.rejects(() => client.batch(['x.example'], 'fast'), (e) => e instanceof GatewayHttpError && e.status === 401);
});
