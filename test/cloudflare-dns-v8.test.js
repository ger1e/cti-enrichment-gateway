import test from 'node:test';
import assert from 'node:assert/strict';
import { cloudflareDnsProvider } from '../src/providers/cloudflare-dns.js';

function json(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/dns-json', ...headers } });
}

const INPUT = Object.freeze({ type: 'domain', value: 'example.com' });

test('Cloudflare DNS uses one fixed read-only JSON DoH A lookup and emits contextual resolution evidence', async () => {
  let request;
  const output = await cloudflareDnsProvider.run(INPUT, {
    fetchImpl: async (url, init) => {
      request = { url: String(url), init };
      return json({
        Status: 0,
        AD: true,
        Answer: [{ name: 'example.com.', type: 1, TTL: 300, data: '93.184.216.34' }],
      });
    },
  });
  const url = new URL(request.url);
  assert.equal(url.hostname, 'cloudflare-dns.com');
  assert.equal(url.pathname, '/dns-query');
  assert.equal(url.searchParams.get('name'), 'example.com');
  assert.equal(url.searchParams.get('type'), 'A');
  assert.equal(request.init.method, 'GET');
  assert.equal(request.init.headers.Accept, 'application/dns-json');
  assert.equal(output.observationType, 'dns_resolution');
  assert.equal(output.verdict, 'observed');
  assert.deepEqual(output.attributes.addresses, ['93.184.216.34']);
  assert.equal(output.attributes.authenticatedData, true);
  assert.deepEqual(output.relationships, [{ type: 'resolves_to', target: '93.184.216.34', targetType: 'ip' }]);
});

test('Cloudflare DNS empty NOERROR and NXDOMAIN are neutral absence, never benign evidence', async () => {
  for (const body of [
    { Status: 0, AD: false, Answer: [] },
    { Status: 3, AD: false },
  ]) {
    const output = await cloudflareDnsProvider.run(INPUT, { fetchImpl: async () => json(body) });
    assert.equal(output.observationType, 'dns_resolution');
    assert.equal(output.verdict, 'no_result');
    assert.deepEqual(output.attributes.addresses, []);
    assert.deepEqual(output.relationships, []);
  }
});

test('Cloudflare DNS non-NXDOMAIN resolver failures remain provider failures', async () => {
  for (const Status of [1, 2, 4, 5]) {
    await assert.rejects(
      () => cloudflareDnsProvider.run(INPUT, { fetchImpl: async () => json({ Status, AD: false }) }),
      /provider_dns_error/,
    );
  }
});

test('Cloudflare DNS ignores non-A records and caps accepted A answers at 100', async () => {
  const answers = [
    { name: 'example.com.', type: 5, TTL: 60, data: 'alias.example.net.' },
    ...Array.from({ length: 105 }, (_, index) => ({ name: 'example.com.', type: 1, TTL: 60, data: `192.0.2.${(index % 250) + 1}` })),
  ];
  const output = await cloudflareDnsProvider.run(INPUT, { fetchImpl: async () => json({ Status: 0, AD: false, Answer: answers }) });
  assert.equal(output.attributes.addresses.length, 100);
  assert.equal(output.relationships.length, 100);
  assert.equal(output.relationships.every(item => item.type === 'resolves_to' && item.targetType === 'ip'), true);
});

test('Cloudflare DNS malformed successful schemas fail closed', async () => {
  for (const body of [
    {},
    { Status: '0', Answer: [] },
    { Status: 0, Answer: {} },
  ]) {
    await assert.rejects(
      () => cloudflareDnsProvider.run(INPUT, { fetchImpl: async () => json(body) }),
      /provider_schema_invalid/,
    );
  }
});

test('Cloudflare DNS rejects unsupported input types before network access', async () => {
  let calls = 0;
  await assert.rejects(
    () => cloudflareDnsProvider.run({ type: 'ip', value: '192.0.2.1' }, { fetchImpl: async () => { calls += 1; return json({ Status: 0 }); } }),
    /unsupported indicator type/,
  );
  assert.equal(calls, 0);
});

test('Cloudflare DNS response cap is enforced before parser evidence', async () => {
  await assert.rejects(
    () => cloudflareDnsProvider.run(INPUT, {
      fetchImpl: async () => new Response('{}', {
        status: 200,
        headers: { 'content-type': 'application/dns-json', 'content-length': '1000001' },
      }),
    }),
    /provider response too large/,
  );
});
