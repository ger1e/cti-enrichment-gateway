import assert from 'node:assert/strict';
import test from 'node:test';
import { createGatewayClient, GatewayHttpError } from '../app/api-client.js';
import { createSession } from '../app/session.js';

const jsonResponse = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
});

test('gateway client uses relative same-origin bearer request', async () => {
  const calls = [];
  const client = createGatewayClient({
    getToken: () => 'secret-token',
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse(200, { ready: true });
    },
  });
  assert.deepEqual(await client.health(), { ready: true });
  assert.equal(calls[0].url, '/api/health');
  assert.equal(calls[0].init.credentials, 'same-origin');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer secret-token');
});

test('enrich sends only indicator and fixed profile', async () => {
  let sent;
  const client = createGatewayClient({
    getToken: () => 't',
    fetchImpl: async (_url, init) => {
      sent = JSON.parse(init.body);
      return jsonResponse(200, {
        requestId: 'r',
        indicator: 'example.org',
        type: 'domain',
        profile: 'standard',
        status: 'ok',
        evidence: [],
        failures: [],
        relationships: [],
        correlation: {},
      });
    },
  });
  await client.enrich('example.org', 'standard');
  assert.deepEqual(sent, { indicator: 'example.org', profile: 'standard' });
  await assert.rejects(() => client.enrich('example.org', 'virustotal'), /invalid profile/i);
});

test('malformed enrichment payload fails closed', async () => {
  const client = createGatewayClient({
    getToken: () => 't',
    fetchImpl: async () => jsonResponse(200, { status: 'ok' }),
  });
  await assert.rejects(
    () => client.enrich('example.org', 'fast'),
    (e) => e instanceof GatewayHttpError && e.code === 'invalid_envelope',
  );
});

test('invalid STIX bundle fails closed', async () => {
  const client = createGatewayClient({
    getToken: () => 't',
    fetchImpl: async () => jsonResponse(200, { objects: [] }),
  });
  await assert.rejects(
    () => client.stix('example.org', 'fast'),
    (e) => e instanceof GatewayHttpError && e.code === 'invalid_stix_bundle',
  );
});

test('structured errors never include bearer text', async () => {
  const client = createGatewayClient({
    getToken: () => 'never-echo-me',
    fetchImpl: async () => jsonResponse(401, { error: 'unauthorized', requestId: 'r1' }),
  });
  await assert.rejects(
    () => client.health(),
    (e) => e instanceof GatewayHttpError && e.status === 401 && e.code === 'unauthorized' && !String(e).includes('never-echo-me'),
  );
});

test('session snapshot never exposes token and only one request is active', () => {
  const session = createSession();
  session.setToken('shared-bearer');
  session.unlock();
  assert.equal(JSON.stringify(session.snapshot()).includes('shared-bearer'), false);
  const first = new AbortController();
  session.startRequest(first);
  assert.throws(() => session.startRequest(new AbortController()), /request already active/i);
});

test('disconnect aborts work and clears auth/result state', () => {
  const session = createSession();
  session.setToken('t');
  session.unlock();
  const controller = new AbortController();
  session.startRequest(controller);
  session.disconnect();
  assert.equal(controller.signal.aborted, true);
  assert.equal(session.getToken(), null);
  assert.deepEqual(session.snapshot(), { mode: 'locked', result: null, hasToken: false, requestActive: false });
});
