import test from 'node:test';
import assert from 'node:assert/strict';
import { threatminerProvider } from '../src/providers/threatminer.js';
import { threatfoxProvider } from '../src/providers/threatfox.js';

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

test('ThreatMiner status_code 404 is neutral absence rather than an unknown observation', async () => {
  const output = await threatminerProvider.run(
    { type: 'ip', value: '192.0.2.44' },
    { fetchImpl: async () => json({ status_code: 404, status_message: 'No results found', results: [] }) },
  );
  assert.equal(output.observationType, 'passive_dns');
  assert.equal(output.verdict, 'no_result');
  assert.equal(output.attributes.statusCode, 404);
  assert.equal(output.attributes.resultCount, 0);
});

test('ThreatFox search_ioc request matches the vendor sample contract without undocumented exact_match', async () => {
  let request;
  await threatfoxProvider.run(
    { type: 'domain', value: 'example.com' },
    {
      env: { ABUSECH_API_KEY: 'test-key' },
      fetchImpl: async (url, init) => {
        request = { url: String(url), init };
        return json({ query_status: 'no_result', data: [] });
      },
    },
  );
  const body = JSON.parse(request.init.body);
  assert.deepEqual(body, { query: 'search_ioc', search_term: 'example.com' });
  assert.equal(request.init.headers['Auth-Key'], 'test-key');
});
