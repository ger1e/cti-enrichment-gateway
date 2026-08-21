import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_PROVIDERS } from '../src/providers/index.js';

function provider() { return ALL_PROVIDERS.find(item => item.name === 'attack-taxii'); }
function json(value) { return new Response(JSON.stringify(value), { status: 200, headers: { 'content-type': 'application/taxii+json;version=2.1' } }); }

test('ATT&CK lookup stays on fixed collections with server-side type filtering and no unbounded relationship fetch', async () => {
  const urls = [];
  const data = await provider().run({ value: 'T1059.001', type: 'attack' }, {
    signal: new AbortController().signal,
    feedCache: new Map(),
    nowMs: () => 1_787_248_000_000,
    fetchImpl: async url => {
      urls.push(String(url));
      return json({ more: false, objects: [{
        type: 'attack-pattern', id: 'attack-pattern--970a3432-3237-47ad-bcca-7d8cbb217736', name: 'PowerShell',
        created: '2020-03-09T14:00:00.000Z', modified: '2026-05-12T14:00:00.000Z',
        external_references: [{ source_name: 'mitre-attack', external_id: 'T1059.001', url: 'https://attack.mitre.org/techniques/T1059/001/' }],
      }] });
    },
  });
  assert.equal(urls.length, 1);
  assert.match(urls[0], /^https:\/\/attack-taxii\.mitre\.org\/api\/v21\/collections\/x-mitre-collection--1f5f1533-f617-4ca8-9ab4-6a02367fa019\/objects\/\?match%5Btype%5D=attack-pattern$/);
  assert.equal(urls.some(url => /relationship/i.test(url)), false);
  assert.equal(data.attributes.relationshipExpansion, 'omitted_boundedness');
  assert.deepEqual(data.relationships, []);
});

test('ATT&CK miss never falls back to a collection-wide relationship download', async () => {
  const urls = [];
  const data = await provider().run({ value: 'G9999', type: 'attack' }, {
    signal: new AbortController().signal,
    feedCache: new Map(),
    nowMs: () => 1_787_248_000_000,
    fetchImpl: async url => { urls.push(String(url)); return json({ more: false, objects: [] }); },
  });
  assert.equal(urls.length, 3);
  assert.equal(urls.every(url => url.includes('match%5Btype%5D=intrusion-set')), true);
  assert.equal(urls.some(url => /relationship/i.test(url)), false);
  assert.equal(data.attributes.relationshipExpansion, 'omitted_boundedness');
});
