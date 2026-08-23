import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyIndicator } from '../src/core/validate.js';
import { ALL_PROVIDERS } from '../src/providers/index.js';
import { WORKFLOWS } from '../src/workflows.js';

function provider(name) { return ALL_PROVIDERS.find(item => item.name === name); }
function json(value, status = 200) { return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } }); }
function text(value) { return new Response(value, { status: 200, headers: { 'content-type': 'text/plain' } }); }

test('ASN classifier is strict canonical and range-bounded', () => {
  assert.deepEqual(classifyIndicator('as3333'), { value: 'AS3333', type: 'asn' });
  assert.deepEqual(classifyIndicator('AS4294967295'), { value: 'AS4294967295', type: 'asn' });
  for (const value of ['AS0', 'AS4294967296', 'AS-1', 'AS1.5', 'AS0001']) assert.throws(() => classifyIndicator(value));
});

test('CIDR classifier accepts only canonical network prefixes', () => {
  assert.deepEqual(classifyIndicator('192.0.2.0/24'), { value: '192.0.2.0/24', type: 'cidr' });
  assert.deepEqual(classifyIndicator('2001:0db8::/32'), { value: '2001:db8::/32', type: 'cidr' });
  for (const value of ['192.0.2.1/24', '192.0.2.0/33', '2001:db8::1/32', '2001:db8::/129', '192.0.2.0/024']) assert.throws(() => classifyIndicator(value));
});

test('ASN and CIDR use fixed bounded workflows only', () => {
  assert.deepEqual(WORKFLOWS.asn, ['rdap', 'ripestat', 'spamhaus-drop']);
  assert.deepEqual(WORKFLOWS.cidr, ['rdap', 'ripestat', 'spamhaus-drop']);
});

test('RDAP uses IANA bootstrap then the authoritative RIR for ASN and CIDR', async () => {
  const p = provider('rdap');
  const seenAsn = [];
  const asn = await p.run({ value: 'AS3333', type: 'asn' }, { signal: new AbortController().signal, feedCache: new Map(), fetchImpl: async url => {
    const u = String(url); seenAsn.push(u);
    if (u === 'https://data.iana.org/rdap/asn.json') return json({ services: [[['3333'], ['https://rdap.db.ripe.net/']]] });
    if (u === 'https://rdap.db.ripe.net/autnum/3333') return json({ handle: 'AS3333', name: 'RIPE-NCC-AS', startAutnum: 3333, endAutnum: 3333, country: 'NL', status: ['active'] });
    throw new Error(`unexpected ${u}`);
  }});
  assert.deepEqual(seenAsn, ['https://data.iana.org/rdap/asn.json', 'https://rdap.db.ripe.net/autnum/3333']);
  assert.equal(asn.attributes.startAutnum, 3333);

  const seenCidr = [];
  const cidr = await p.run({ value: '192.0.2.0/24', type: 'cidr' }, { signal: new AbortController().signal, feedCache: new Map(), fetchImpl: async url => {
    const u = String(url); seenCidr.push(u);
    if (u === 'https://data.iana.org/rdap/ipv4.json') return json({ services: [[['192.0.0.0/8'], ['https://rdap.arin.net/registry/']]] });
    if (u === 'https://rdap.arin.net/registry/ip/192.0.2.0/24') return json({ handle: 'NET-TEST', startAddress: '192.0.2.0', endAddress: '192.0.2.255', cidr0_cidrs: [{ v4prefix: '192.0.2.0', length: 24 }] });
    throw new Error(`unexpected ${u}`);
  }});
  assert.deepEqual(seenCidr, ['https://data.iana.org/rdap/ipv4.json', 'https://rdap.arin.net/registry/ip/192.0.2.0/24']);
  assert.equal(cidr.attributes.startAddress, '192.0.2.0');
});

test('RIPEstat uses AS Overview for ASN and bounded Prefix Overview for CIDR', async () => {
  const p = provider('ripestat');
  let seen;
  const asn = await p.run({ value: 'AS3333', type: 'asn' }, { signal: new AbortController().signal, fetchImpl: async url => {
    seen = String(url); return json({ data: { resource: '3333', announced: true, holder: 'RIPE-NCC-AS', block: { resource: 'AS3209 - AS3353', name: 'RIPE NCC' } } });
  }});
  assert.equal(seen, 'https://stat.ripe.net/data/as-overview/data.json?resource=AS3333');
  assert.equal(asn.attributes.announced, true);

  const cidr = await p.run({ value: '192.0.2.0/24', type: 'cidr' }, { signal: new AbortController().signal, fetchImpl: async url => {
    seen = String(url); return json({ data: { resource: '192.0.2.0/24', announced: true, asns: [{ asn: 64496, holder: 'EXAMPLE' }], related_prefixes: ['192.0.2.0/25'], actual_num_related: 1 } });
  }});
  assert.equal(seen, 'https://stat.ripe.net/data/prefix-overview/data.json?resource=192.0.2.0%2F24&max_related=10');
  assert.deepEqual(cidr.relationships, [{ targetType: 'asn', target: 'AS64496', relationship: 'origin_asn' }]);
});

test('Spamhaus ASN-DROP and DROP prefix enrichment remain contextual fixed-feed lookups', async () => {
  const p = provider('spamhaus-drop');
  let seen;
  const asn = await p.run({ value: 'AS208046', type: 'asn' }, { signal: new AbortController().signal, feedCache: new Map(), nowMs: () => 1_787_248_000_000, fetchImpl: async url => {
    seen = String(url); return text('{"asn":208046,"rir":"ripencc","domain":"hostslick.de","cc":"DE","asname":"ColocationX-Datacenter"}\n{"type":"metadata","timestamp":1787248000,"copyright":"Spamhaus"}\n');
  }});
  assert.equal(seen, 'https://www.spamhaus.org/drop/asndrop.json');
  assert.equal(asn.verdict, 'listed');
  assert.equal(asn.attributes.asname, 'ColocationX-Datacenter');

  const cidr = await p.run({ value: '192.0.2.0/25', type: 'cidr' }, { signal: new AbortController().signal, feedCache: new Map(), nowMs: () => 1_787_248_000_000, fetchImpl: async url => {
    seen = String(url); return text('{"cidr":"192.0.2.0/24","sblid":"SBL999999"}\n{"type":"metadata","timestamp":1787248000,"copyright":"Spamhaus"}\n');
  }});
  assert.equal(seen, 'https://www.spamhaus.org/drop/drop_v4.json');
  assert.equal(cidr.verdict, 'listed');
  assert.equal(cidr.attributes.cidr, '192.0.2.0/24');
});
