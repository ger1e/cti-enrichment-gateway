import test from 'node:test';
import assert from 'node:assert/strict';
import { greynoiseProvider } from '../src/providers/greynoise.js';
import { PROVIDER_MANIFEST } from '../src/providers/manifest.js';

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

test('GreyNoise Community uses the configured key header', async () => {
  let request;
  const output = await greynoiseProvider.run(
    { type: 'ip', value: '8.8.8.8' },
    {
      env: { GREYNOISE_API_KEY: 'test-key' },
      fetchImpl: async (url, init) => {
        request = { url: String(url), init };
        return json({ ip: '8.8.8.8', noise: false, riot: true, classification: 'benign', name: 'Google Public DNS' });
      },
    },
  );
  assert.equal(new URL(request.url).pathname, '/v3/community/8.8.8.8');
  assert.equal(request.init.headers.key, 'test-key');
  assert.equal(output.verdict, 'benign');
});

test('GreyNoise adapter fails closed without revealing credential identifiers', async () => {
  await assert.rejects(
    () => greynoiseProvider.run(
      { type: 'ip', value: '8.8.8.8' },
      { fetchImpl: async () => json({}) },
    ),
    error => error?.message === 'provider credential not configured' && !error.message.includes('GREYNOISE_API_KEY'),
  );
});

test('GreyNoise manifest requires the configured API credential', () => {
  assert.equal(PROVIDER_MANIFEST.greynoise.credentialEnv, 'GREYNOISE_API_KEY');
  assert.equal(PROVIDER_MANIFEST.greynoise.optionalCredential, false);
});
