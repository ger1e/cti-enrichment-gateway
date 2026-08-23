import test from 'node:test';
import assert from 'node:assert/strict';

import { modatProvider, pulsediveProvider, webamonProvider } from '../src/providers/index.js';
import { loadTextFeed } from '../src/providers/public-feed.js';
import { probeProviders } from '../src/control/provider-probe.js';

function response(body, status = 200, headers = {}) {
  return new Response(body, { status, headers });
}

test('canonical Modat policy permits host POST and spaces multi-type probes across the rate window', () => {
  assert.deepEqual([...modatProvider.methods].sort(), ['GET', 'POST']);
  assert.equal(modatProvider.parserVersion, '2026-08-23.1');
  assert.equal(modatProvider.probeIntervalMs, 3100);
});

test('Pulsedive probes respect the documented one-request-per-second free limit', () => {
  assert.equal(pulsediveProvider.probeIntervalMs, 1100);
});

test('Webamon canonical runtime policy preserves the adapter headroom observed in live E2E', () => {
  assert.equal(webamonProvider.timeoutMs, 12000);
  assert.equal(webamonProvider.parserVersion, '2026-08-23.1');
});

test('public feeds retry one transient 502 before surfacing an upstream failure', async () => {
  let calls = 0;
  const feedCache = new Map();
  const text = await loadTextFeed('https://feed.example.invalid/hashes.csv', {
    feedCache,
    sleep: async () => {},
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) return response('temporary', 502);
      return response('abc,def\n', 200, { 'content-type': 'text/csv' });
    },
  }, { cache: false });

  assert.equal(calls, 2);
  assert.equal(text, 'abc,def\n');
});

test('probe output identifies the credential variable shared by auth failures without exposing its value', async () => {
  const providers = [
    {
      name: 'one', active: true, types: ['ip'], requiredEnv: 'SHARED_API_KEY', timeoutMs: 1000,
      fixedHosts: ['example.invalid'], methods: ['GET'], protocols: ['https:'], maxResponseBytes: 1024,
      async run() { throw Object.assign(new Error('denied'), { status: 403 }); },
    },
    {
      name: 'two', active: true, types: ['ip'], requiredEnv: 'SHARED_API_KEY', timeoutMs: 1000,
      fixedHosts: ['example.invalid'], methods: ['GET'], protocols: ['https:'], maxResponseBytes: 1024,
      async run() { throw Object.assign(new Error('denied'), { status: 403 }); },
    },
  ];

  const results = await probeProviders({
    providers,
    env: { SHARED_API_KEY: 'never-print-this-value' },
    fetchImpl: async () => response('{}'),
    includeCredentialed: true,
  });

  assert.equal(results.length, 2);
  for (const result of results) {
    assert.equal(result.status, 'auth_failed');
    assert.equal(result.credentialEnv, 'SHARED_API_KEY');
    assert.doesNotMatch(JSON.stringify(result), /never-print-this-value/);
  }
});
