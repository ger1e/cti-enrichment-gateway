import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ALL_PROVIDERS } from '../src/providers/index.js';

function provider() {
  return ALL_PROVIDERS.find(item => item.name === 'misp-circl-osint');
}
function md5(value) { return createHash('md5').update(value, 'utf8').digest('hex'); }
function text(value) { return new Response(value, { status: 200, headers: { 'content-type': 'text/plain' } }); }
function json(value) { return new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/json' } }); }
function event(uuid, attributes, extra = {}) {
  return { Event: {
    uuid, info: 'semantic fixture', date: '2026-08-20', threat_level_id: '2', published: true,
    Tag: [{ name: 'tlp:clear' }], Attribute: attributes, Object: [], ...extra,
  } };
}

async function run(input, attributes, extra = {}) {
  const uuid = '11111111-2222-4333-8444-555555555555';
  let calls = 0;
  const data = await provider().run(input, {
    signal: new AbortController().signal,
    feedCache: new Map(),
    nowMs: () => 1_787_248_000_000,
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) return text(`${md5(input.value)},${uuid}\n`);
      return json(event(uuid, attributes, extra));
    },
  });
  return data;
}

test('deleted attributes never verify a MISP feed correlation', async () => {
  await assert.rejects(() => run(
    { value: 'evil.example', type: 'domain' },
    [{ type: 'domain', value: 'evil.example', deleted: true, to_ids: true }],
  ), /hash cache\/event mismatch/);
});

test('domain|ip and hostname|port match only the domain/hostname component for domain input', async () => {
  const domain = await run({ value: 'evil.example', type: 'domain' }, [
    { type: 'domain|ip', value: 'evil.example|192.0.2.44', to_ids: true },
  ]);
  assert.equal(domain.verdict, 'listed');
  assert.deepEqual(domain.attributes.events[0].matchedAttributeTypes, ['domain|ip']);

  const host = await run({ value: 'host.example', type: 'domain' }, [
    { type: 'hostname|port', value: 'host.example|443', to_ids: false },
  ]);
  assert.equal(host.verdict, 'listed');
});

test('IP composite types match only the address component, never the port', async () => {
  for (const type of ['ip-src|port', 'ip-dst|port']) {
    const data = await run({ value: '192.0.2.44', type: 'ip' }, [{ type, value: '192.0.2.44|443', to_ids: true }]);
    assert.equal(data.verdict, 'listed');
  }
  await assert.rejects(() => run({ value: '443', type: 'ip' }, [{ type: 'ip-src|port', value: '192.0.2.44|443' }]));
});

test('filename hash composites match only the hash component for hash input', async () => {
  const fixtures = [
    ['filename|md5', 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'],
    ['filename|sha1', 'b'.repeat(40)],
    ['filename|sha256', 'c'.repeat(64)],
  ];
  for (const [type, hash] of fixtures) {
    const data = await run({ value: hash, type: 'hash' }, [{ type, value: `dropper.exe|${hash}`, to_ids: true }]);
    assert.equal(data.verdict, 'listed');
  }
});

test('composite matching rejects the non-corresponding component', async () => {
  await assert.rejects(() => run(
    { value: '192.0.2.44', type: 'domain' },
    [{ type: 'domain|ip', value: 'evil.example|192.0.2.44' }],
  ), /hash cache\/event mismatch/);
  await assert.rejects(() => run(
    { value: 'dropper.exe', type: 'hash' },
    [{ type: 'filename|sha256', value: `dropper.exe|${'c'.repeat(64)}` }],
  ), /hash cache\/event mismatch/);
});

test('verified MISP context preserves publication state threat level date tags and to_ids', async () => {
  const data = await run({ value: 'evil.example', type: 'domain' }, [
    { type: 'domain', value: 'evil.example', to_ids: true, Tag: [{ name: 'misp-galaxy:threat-actor="Demo"' }] },
  ]);
  const evt = data.attributes.events[0];
  assert.equal(evt.published, true);
  assert.equal(evt.threatLevelId, '2');
  assert.equal(evt.date, '2026-08-20');
  assert.equal(data.attributes.toIds, true);
  assert.ok(data.tags.includes('tlp:clear'));
  assert.ok(data.tags.some(tag => tag.includes('threat-actor')));
});
