import test from 'node:test';
import assert from 'node:assert/strict';
import { otxProvider } from '../src/providers/otx.js';

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

test('OTX uses official indicator slugs and X-OTX-API-KEY header', async () => {
  for (const [input, slug] of [
    [{ type: 'ip', value: '8.8.8.8' }, 'IPv4'],
    [{ type: 'domain', value: 'example.com' }, 'domain'],
    [{ type: 'url', value: 'https://example.com/' }, 'url'],
    [{ type: 'hash', value: 'a'.repeat(64) }, 'file'],
    [{ type: 'cve', value: 'CVE-2021-44228' }, 'cve'],
  ]) {
    let request;
    await otxProvider.run(input, {
      env: { OTX_API_KEY: 'test-key' },
      fetchImpl: async (url, init) => {
        request = { url: String(url), init };
        return json({ pulse_info: { count: 0, pulses: [] } });
      },
    });
    const url = new URL(request.url);
    assert.equal(url.pathname, `/api/v1/indicators/${slug}/${encodeURIComponent(input.value)}/general`);
    assert.equal(request.init.headers['X-OTX-API-KEY'], 'test-key');
  }
});

test('OTX 404 is neutral indicator absence rather than provider outage', async () => {
  const output = await otxProvider.run(
    { type: 'domain', value: 'missing.example' },
    {
      env: { OTX_API_KEY: 'test-key' },
      fetchImpl: async () => json({ detail: 'Not found' }, 404),
    },
  );
  assert.equal(output.observationType, 'community_intelligence');
  assert.equal(output.verdict, 'no_result');
  assert.equal(output.attributes.pulseCount, 0);
  assert.deepEqual(output.relationships, []);
});
