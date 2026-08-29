import assert from 'node:assert/strict';
import test from 'node:test';

import { COMMANDS, completeCommand, interpretCommand } from '../app/shell.js';
import { createGatewayClient, GatewayHttpError } from '../app/api-client.js';
import { createApp } from '../src/app.js';

const jsonResponse = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
});

function request(body, token = 'gateway-token') {
  return {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body,
  };
}

test('terminal exposes bounded user-scanner command and aliases', () => {
  const names = new Set(COMMANDS.flatMap(item => [item.name, ...(item.aliases || [])]));
  for (const name of ['user-scanner', 'osint', 'identity']) assert.ok(names.has(name), `missing ${name}`);

  const expected = {
    action: 'user-scanner',
    scanType: 'email',
    target: 'analyst@example.com',
    category: null,
    module: null,
    crossScan: false,
    noNsfw: true,
    historySafe: true,
  };
  assert.deepEqual(interpretCommand('user-scanner email analyst@example.com', { authenticated: true }), expected);
  assert.deepEqual(interpretCommand('osint email analyst@example.com', { authenticated: true }), expected);
  assert.deepEqual(interpretCommand('identity email analyst@example.com', { authenticated: true }), expected);
});

test('user-scanner requires auth and parses only bounded scan options', () => {
  assert.equal(interpretCommand('user-scanner username kaifcodec', { authenticated: false }).action, 'auth-required');

  assert.deepEqual(
    interpretCommand('user-scanner username kaifcodec --category dev --cross-scan --include-nsfw', { authenticated: true }),
    {
      action: 'user-scanner', scanType: 'username', target: 'kaifcodec', category: 'dev', module: null,
      crossScan: true, noNsfw: false, historySafe: true,
    },
  );

  assert.deepEqual(
    interpretCommand('user-scanner username kaifcodec --module github', { authenticated: true }),
    {
      action: 'user-scanner', scanType: 'username', target: 'kaifcodec', category: null, module: 'github',
      crossScan: false, noNsfw: true, historySafe: true,
    },
  );

  assert.equal(interpretCommand('user-scanner phone +361234567', { authenticated: true }).action, 'error');
  assert.equal(interpretCommand('user-scanner username x --category dev --module github', { authenticated: true }).action, 'error');
  assert.equal(interpretCommand('user-scanner username x --proxy socks5://127.0.0.1:9050', { authenticated: true }).action, 'error');
  assert.equal(interpretCommand('user-scanner username x --allow-loud', { authenticated: true }).action, 'error');
});

test('user-scanner autocomplete offers scan type and safe flags', () => {
  assert.deepEqual(completeCommand('user-scanner e'), ['email']);
  assert.deepEqual(completeCommand('user-scanner u'), ['username']);
  assert.ok(completeCommand('user-scanner username target --c').includes('--cross-scan'));
});

test('gateway client sends exact user-scanner body to same-origin authenticated endpoint', async () => {
  const calls = [];
  const envelope = {
    scanId: 'scan-1', scanType: 'username', target: 'kaifcodec',
    summary: { totalScanned: 10, found: 2, notFound: 7, errors: 1, skipped: 0 },
    results: [{ siteName: 'GitHub', category: 'Dev', url: 'https://github.com/kaifcodec', extra: {} }],
    erroredSites: ['Example'], durationMs: 1234, source: 'user-scanner',
  };
  const client = createGatewayClient({
    getToken: () => 'secret-token',
    fetchImpl: async (url, init) => { calls.push({ url, init }); return jsonResponse(200, envelope); },
  });

  assert.deepEqual(await client.userScanner({
    scanType: 'username', target: 'kaifcodec', category: null, module: 'github', crossScan: false, noNsfw: true,
  }), envelope);
  assert.equal(calls[0].url, '/api/para11ax/user-scanner');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer secret-token');
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    scanType: 'username', target: 'kaifcodec', module: 'github', crossScan: false, noNsfw: true,
  });
});

test('gateway client fails closed on malformed user-scanner response', async () => {
  const client = createGatewayClient({ getToken: () => 't', fetchImpl: async () => jsonResponse(200, { ok: true }) });
  await assert.rejects(
    () => client.userScanner({ scanType: 'username', target: 'x', crossScan: false, noNsfw: true }),
    error => error instanceof GatewayHttpError && error.code === 'invalid_user_scanner_envelope',
  );
});

test('gateway user-scanner proxy is authenticated, fixed-destination, and bounded', async () => {
  const calls = [];
  const app = createApp({
    env: {
      PARA11AX_TOKEN: 'gateway-token',
      PARA11AX_USER_SCANNER_URL: 'https://worker.example/scan',
      PARA11AX_USER_SCANNER_TOKEN: 'worker-secret',
    },
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse(200, {
        summary: { total_scanned: 20, found: 1, not_found: 18, errors: 1, skipped: 0 },
        results: [{ status: 'Found', username: 'kaifcodec', site_name: 'Github', category: 'Dev', url: 'https://github.com/kaifcodec', extra: { followers: 1 } }],
        errored_sites: ['Broken'],
      });
    },
    nowMs: (() => { let value = 1000; return () => value += 25; })(),
  });

  const result = await app.handleUserScanner(request({
    scanType: 'username', target: 'kaifcodec', module: 'github', crossScan: false, noNsfw: true,
  }));
  assert.equal(result.status, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://worker.example/scan');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer worker-secret');
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    scan_type: 'username', target: 'kaifcodec', module: 'github', cross_scan: false, no_nsfw: true,
  });
  assert.equal(result.body.scanType, 'username');
  assert.equal(result.body.source, 'user-scanner');
  assert.equal(result.body.results[0].siteName, 'Github');
  assert.equal(result.body.summary.found, 1);

  assert.equal((await app.handleUserScanner(request({ scanType: 'username', target: 'x' }, 'wrong'))).status, 401);
  assert.equal((await app.handleUserScanner(request({ scanType: 'phone', target: 'x' }))).status, 400);
  assert.equal((await app.handleUserScanner(request({ scanType: 'username', target: 'x', category: 'dev', module: 'github' }))).status, 400);
  assert.equal((await app.handleUserScanner(request({ scanType: 'username', target: 'x', proxy: 'https://evil.example' }))).status, 400);
});

test('gateway reports user-scanner worker as unavailable when not configured', async () => {
  const app = createApp({ env: { PARA11AX_TOKEN: 'gateway-token' } });
  const result = await app.handleUserScanner(request({ scanType: 'username', target: 'kaifcodec' }));
  assert.equal(result.status, 503);
  assert.equal(result.body.error, 'user_scanner_unconfigured');
});
