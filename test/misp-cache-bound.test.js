import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ALL_PROVIDERS } from '../src/providers/index.js';

function md5(value) {
  return createHash('md5').update(value, 'utf8').digest('hex');
}

test('MISP event bodies are request-bounded and never retained in the shared source cache', async () => {
  const provider = ALL_PROVIDERS.find(item => item.name === 'misp-circl-osint');
  assert.ok(provider);
  const feedCache = new Map();
  const eventUuid = '11111111-2222-4333-8444-555555555555';

  const fetchImpl = async url => {
    const target = String(url);
    if (target.endsWith('/hashes.csv')) {
      return new Response(`${md5('evil.example')},${eventUuid}\n`, { status: 200 });
    }
    assert.equal(target, `https://www.circl.lu/doc/misp/feed-osint/${eventUuid}.json`);
    return new Response(JSON.stringify({ Event: {
      uuid: eventUuid,
      info: 'bounded cache fixture',
      Attribute: [{ type: 'domain', value: 'evil.example', to_ids: true }],
      Object: [],
    } }), { status: 200, headers: { 'content-type': 'application/json' } });
  };

  const result = await provider.run(
    { value: 'evil.example', type: 'domain' },
    { fetchImpl, feedCache, signal: new AbortController().signal, nowMs: () => 1_787_248_000_000 },
  );

  assert.equal(result.verdict, 'listed');
  assert.deepEqual([...feedCache.keys()], ['https://www.circl.lu/doc/misp/feed-osint/hashes.csv']);
});
