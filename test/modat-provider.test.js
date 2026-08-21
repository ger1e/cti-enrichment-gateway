import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_PROVIDERS } from '../src/providers/index.js';
import { WORKFLOWS } from '../src/workflows.js';

const SECRET = 'MODAT_TEST_SECRET';

function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

function provider() {
  const adapter = ALL_PROVIDERS.find(item => item.name === 'modat');
  assert.ok(adapter, 'Modat provider must be registered');
  return adapter;
}

test('Modat is a quota-bounded infrastructure provider in IP and domain workflows', () => {
  const adapter = provider();
  assert.deepEqual(adapter.types, ['ip', 'domain']);
  assert.equal(adapter.requiredEnv, 'MODAT_API_KEY');
  assert.equal(adapter.costClass, 'quota');
  assert.equal(adapter.tier, 3);
  assert.deepEqual(adapter.fixedHosts, ['api.magnify.modat.io']);
  assert.ok(adapter.observationTypes.includes('internet_exposure'));
  assert.ok(adapter.observationTypes.includes('passive_dns'));
  assert.ok(WORKFLOWS.ip.includes('modat'));
  assert.ok(WORKFLOWS.domain.includes('modat'));
});

test('Modat IP lookup uses the fixed host endpoint and bearer header without leaking the key', async () => {
  const adapter = provider();
  let captured;
  const fetchImpl = async (url, init) => {
    captured = { url: String(url), init };
    return json({
      ip: '203.0.113.10',
      asn: { number: 64500, organization: 'Example Transit' },
      geo: { country_code: 'NL' },
      fqdns: ['node.example.test'],
      services: [
        { port: 443, transport_protocol: 'tcp', tags: ['C2'], cves: [{ id: 'CVE-2026-12345' }] },
      ],
      last_seen: '2026-08-20T12:00:00Z',
    });
  };

  const data = await adapter.run(
    { value: '203.0.113.10', type: 'ip' },
    { fetchImpl, env: { MODAT_API_KEY: SECRET }, signal: new AbortController().signal },
  );

  const url = new URL(captured.url);
  assert.equal(url.protocol, 'https:');
  assert.equal(url.hostname, 'api.magnify.modat.io');
  assert.equal(url.pathname, '/host/203.0.113.10/v1');
  assert.equal(captured.init.method, 'GET');
  assert.equal(captured.init.headers.Authorization, `Bearer ${SECRET}`);
  assert.equal(data.observationType, 'internet_exposure');
  assert.equal(data.verdict, 'observed');
  assert.ok(data.relationships.some(item => item.targetType === 'domain' && item.target === 'node.example.test'));
  assert.ok(data.relationships.some(item => item.targetType === 'asn' && item.target === 'AS64500'));
  assert.equal(JSON.stringify(data).includes(SECRET), false);
});

test('Modat domain lookup uses fixed passive-DNS zone endpoint and treats presence as context, not maliciousness', async () => {
  const adapter = provider();
  let captured;
  const fetchImpl = async (url, init) => {
    captured = { url: String(url), init };
    return json({
      fqdn: 'example.test',
      records: {
        A: [{ value: '203.0.113.10', first_seen: '2026-08-01T00:00:00Z', last_seen: '2026-08-20T00:00:00Z' }],
        AAAA: [{ value: '2001:db8::10' }],
        CNAME: [{ value: 'alias.example.test' }],
      },
    });
  };

  const data = await adapter.run(
    { value: 'example.test', type: 'domain' },
    { fetchImpl, env: { MODAT_API_KEY: SECRET }, signal: new AbortController().signal },
  );

  const url = new URL(captured.url);
  assert.equal(url.hostname, 'api.magnify.modat.io');
  assert.equal(url.pathname, '/dns/zones/example.test/v1');
  assert.equal(captured.init.method, 'GET');
  assert.equal(captured.init.headers.Authorization, `Bearer ${SECRET}`);
  assert.equal(data.observationType, 'passive_dns');
  assert.equal(data.verdict, 'observed');
  assert.notEqual(data.verdict, 'malicious');
  assert.ok(data.relationships.some(item => item.targetType === 'ip' && item.target === '203.0.113.10'));
  assert.ok(data.relationships.some(item => item.targetType === 'ip' && item.target === '2001:db8::10'));
  assert.ok(data.relationships.some(item => item.targetType === 'domain' && item.target === 'alias.example.test'));
  assert.equal(JSON.stringify(data).includes(SECRET), false);
});

test('Modat malformed successful bodies fail closed instead of manufacturing observed evidence', async () => {
  const adapter = provider();
  const context = {
    fetchImpl: async () => json({}),
    env: { MODAT_API_KEY: SECRET },
    signal: new AbortController().signal,
  };
  await assert.rejects(
    adapter.run({ value: '203.0.113.10', type: 'ip' }, context),
    error => error?.status === 502,
  );
  await assert.rejects(
    adapter.run({ value: 'example.test', type: 'domain' }, context),
    error => error?.status === 502,
  );
});
