import test from 'node:test';
import assert from 'node:assert/strict';
import { greynoiseProvider } from '../src/providers/greynoise.js';
import { PROVIDER_MANIFEST } from '../src/providers/manifest.js';

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

test('GreyNoise Community works without a key and only sends key header when configured', async () => {
  let unauthRequest;
  const unauth = await greynoiseProvider.run(
    { type: 'ip', value: '8.8.8.8' },
    { fetchImpl: async (url, init) => {
      unauthRequest = { url: String(url), init };
      return json({ ip: '8.8.8.8', noise: false, riot: true, classification: 'benign', name: 'Google Public DNS' });
    } },
  );
  assert.equal(new URL(unauthRequest.url).pathname, '/v3/community/8.8.8.8');
  assert.equal(Object.hasOwn(unauthRequest.init.headers ?? {}, 'key'), false);
  assert.equal(unauth.verdict, 'benign');

  let authRequest;
  await greynoiseProvider.run(
    { type: 'ip', value: '8.8.8.8' },
    { env: { GREYNOISE_API_KEY: 'test-key' }, fetchImpl: async (url, init) => {
      authRequest = { url: String(url), init };
      return json({ ip: '8.8.8.8', noise: false, riot: true, classification: 'benign' });
    } },
  );
  assert.equal(authRequest.init.headers.key, 'test-key');
});

test('GreyNoise manifest marks the Community API credential optional', () => {
  assert.equal(PROVIDER_MANIFEST.greynoise.credentialEnv, 'GREYNOISE_API_KEY');
  assert.equal(PROVIDER_MANIFEST.greynoise.optionalCredential, true);
});
