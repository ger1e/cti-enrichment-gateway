import test from 'node:test';
import assert from 'node:assert/strict';
import { urlscanProvider } from '../src/providers/urlscan.js';
import { PROVIDER_MANIFEST } from '../src/providers/manifest.js';

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

test('urlscan Search API works without a key and only sends api-key when configured', async () => {
  let unauthRequest;
  const unauth = await urlscanProvider.run(
    { type: 'domain', value: 'example.com' },
    { fetchImpl: async (url, init) => {
      unauthRequest = { url: String(url), init };
      return json({ results: [] });
    } },
  );
  assert.equal(new URL(unauthRequest.url).pathname, '/api/v1/search');
  assert.equal(Object.hasOwn(unauthRequest.init.headers ?? {}, 'api-key'), false);
  assert.equal(unauth.verdict, 'no_result');

  let authRequest;
  await urlscanProvider.run(
    { type: 'ip', value: '8.8.8.8' },
    { env: { URLSCAN_API_KEY: 'test-key' }, fetchImpl: async (url, init) => {
      authRequest = { url: String(url), init };
      return json({ results: [] });
    } },
  );
  assert.equal(authRequest.init.headers['api-key'], 'test-key');
});

test('urlscan manifest marks Search API credential optional', () => {
  assert.equal(PROVIDER_MANIFEST.urlscan.credentialEnv, 'URLSCAN_API_KEY');
  assert.equal(PROVIDER_MANIFEST.urlscan.optionalCredential, true);
});
