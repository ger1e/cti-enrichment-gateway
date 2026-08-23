import test from 'node:test';
import assert from 'node:assert/strict';

import { modatProvider } from '../src/providers/modat.js';
import { otxProvider } from '../src/providers/otx.js';
import { webamonProvider } from '../src/providers/webamon.js';
import { probeProvider } from '../src/control/provider-probe.js';

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('Modat IP enrichment uses the current host search contract', async () => {
  let seen;
  const fetchImpl = async (url, options = {}) => {
    seen = { url: String(url), options };
    return jsonResponse({
      page_nr: 1,
      total_pages: 1,
      total_records: 1,
      page: [{
        ip: '8.8.8.8',
        fqdns: ['dns.google'],
        asn: { number: 15169, organization: 'Google LLC' },
        geo: { country_code: 'US' },
        services: [{ port: 53, tags: ['dns'], cves: [] }],
      }],
    });
  };

  const result = await modatProvider.run(
    { type: 'ip', value: '8.8.8.8' },
    { env: { MODAT_API_KEY: 'test-key' }, fetchImpl },
  );

  assert.equal(seen.url, 'https://api.magnify.modat.io/host/search/v1');
  assert.equal(seen.options.method, 'POST');
  assert.equal(seen.options.headers.Authorization, 'Bearer test-key');
  assert.equal(seen.options.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(seen.options.body), {
    query: 'ip:"8.8.8.8"',
    page: 1,
    page_size: 10,
  });
  assert.equal(result.verdict, 'observed');
  assert.equal(result.attributes.ip, '8.8.8.8');
  assert.deepEqual(result.attributes.ports, [53]);
});

test('slow but healthy OTX and Webamon adapters have bounded headroom under the gateway deadline', () => {
  assert.equal(otxProvider.timeoutMs, 12_000);
  assert.equal(webamonProvider.timeoutMs, 12_000);
});

test('Webamon bounds search fanout to the official CLI default page size', async () => {
  let seenUrl;
  const fetchImpl = async url => {
    seenUrl = new URL(String(url));
    return jsonResponse({ results: [], total: 0 });
  };
  const result = await webamonProvider.run(
    { type: 'ip', value: '8.8.8.8' },
    { env: { WEBAMON_API_KEY: 'test-key' }, fetchImpl },
  );
  assert.equal(seenUrl.hostname, 'pro.webamon.com');
  assert.equal(seenUrl.searchParams.get('size'), '10');
  assert.equal(result.verdict, 'no_result');
});

test('provider probe respects an adapter probe interval between supported types', async () => {
  const sleeps = [];
  const provider = {
    name: 'paced-provider',
    types: ['ip', 'domain'],
    timeoutMs: 1000,
    probeIntervalMs: 1100,
    async run(input) {
      return {
        observationType: input.type === 'ip' ? 'network_identity' : 'threat_context',
        verdict: 'no_result',
        relationships: [],
        references: [],
      };
    },
  };

  const result = await probeProvider(provider, {
    env: {},
    fetchImpl: async () => { throw new Error('unexpected fetch'); },
    sleep: async ms => sleeps.push(ms),
  });

  assert.equal(result.status, 'ok');
  assert.deepEqual(sleeps, [1100]);
});
