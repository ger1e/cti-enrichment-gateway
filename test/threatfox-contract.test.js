import test from 'node:test';
import assert from 'node:assert/strict';
import { threatfoxProvider } from '../src/providers/threatfox.js';

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

test('ThreatFox uses exact IOC matching and required Auth-Key', async () => {
  let request;
  await threatfoxProvider.run(
    { type: 'ip', value: '139.180.203.104' },
    {
      env: { ABUSECH_API_KEY: 'test-key' },
      fetchImpl: async (_url, init) => {
        request = init;
        return json({ query_status: 'ok', data: [] });
      },
    },
  );
  assert.equal(request.headers['Auth-Key'], 'test-key');
  assert.deepEqual(JSON.parse(request.body), {
    query: 'search_ioc',
    search_term: '139.180.203.104',
    exact_match: true,
  });
});

test('ThreatFox hash lookup uses search_hash contract', async () => {
  let body;
  await threatfoxProvider.run(
    { type: 'hash', value: 'a'.repeat(64) },
    {
      env: { ABUSECH_API_KEY: 'test-key' },
      fetchImpl: async (_url, init) => {
        body = JSON.parse(init.body);
        return json({ query_status: 'ok', data: [] });
      },
    },
  );
  assert.deepEqual(body, { query: 'search_hash', hash: 'a'.repeat(64) });
});
