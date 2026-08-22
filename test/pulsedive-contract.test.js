import test from 'node:test';
import assert from 'node:assert/strict';
import { pulsediveProvider } from '../src/providers/pulsedive.js';

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

test('Pulsedive indicator lookup works without an API key and omits key parameter', async () => {
  let request;
  const output = await pulsediveProvider.run(
    { type: 'domain', value: 'example.com' },
    { fetchImpl: async (url, init) => {
      request = { url: String(url), init };
      return json({ indicator: 'example.com', type: 'domain', risk: 'none', threats: [] });
    } },
  );
  const url = new URL(request.url);
  assert.equal(url.pathname, '/api/indicator.php');
  assert.equal(url.searchParams.get('indicator'), 'example.com');
  assert.equal(url.searchParams.has('key'), false);
  assert.equal(output.observationType, 'threat_intelligence');
});

test('Pulsedive adds an API key only when configured', async () => {
  let request;
  await pulsediveProvider.run(
    { type: 'ip', value: '8.8.8.8' },
    { env: { PULSEDIVE_API_KEY: 'secret-marker' }, fetchImpl: async (url, init) => {
      request = { url: String(url), init };
      return json({ indicator: '8.8.8.8', type: 'ip', risk: 'none', threats: [] });
    } },
  );
  assert.equal(new URL(request.url).searchParams.get('key'), 'secret-marker');
});

test('Pulsedive documented 404 is neutral absence', async () => {
  const output = await pulsediveProvider.run(
    { type: 'url', value: 'https://missing.example/' },
    { fetchImpl: async () => json({ error: 'Indicator not found.' }, 404) },
  );
  assert.equal(output.verdict, 'no_result');
  assert.equal(output.attributes.risk, null);
});

test('Pulsedive advertises only current indicator lookup types', () => {
  assert.deepEqual(pulsediveProvider.types, ['ip', 'domain', 'url']);
});
