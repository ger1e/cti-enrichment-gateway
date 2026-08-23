import test from 'node:test';
import assert from 'node:assert/strict';
import { urlscanProvider } from '../src/providers/urlscan.js';
import { PROVIDER_MANIFEST } from '../src/providers/manifest.js';

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

test('urlscan Search API uses configured api-key header', async () => {
  let request;
  const output = await urlscanProvider.run(
    { type: 'domain', value: 'example.com' },
    {
      env: { URLSCAN_API_KEY: 'test-key' },
      fetchImpl: async (url, init) => {
        request = { url: String(url), init };
        return json({ results: [] });
      },
    },
  );
  assert.equal(new URL(request.url).pathname, '/api/v1/search');
  assert.equal(request.init.headers['api-key'], 'test-key');
  assert.equal(output.verdict, 'no_result');
});

test('urlscan adapter fails closed when the configured key is missing', async () => {
  await assert.rejects(
    () => urlscanProvider.run(
      { type: 'ip', value: '8.8.8.8' },
      { fetchImpl: async () => json({ results: [] }) },
    ),
    /URLSCAN_API_KEY/,
  );
});

test('urlscan manifest requires the configured API credential', () => {
  assert.equal(PROVIDER_MANIFEST.urlscan.credentialEnv, 'URLSCAN_API_KEY');
  assert.equal(PROVIDER_MANIFEST.urlscan.optionalCredential, false);
});
