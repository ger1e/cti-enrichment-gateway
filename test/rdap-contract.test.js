import test from 'node:test';
import assert from 'node:assert/strict';
import { rdapProvider } from '../src/providers/rdap.js';

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

test('RDAP routes IPv4 through IANA bootstrap to authoritative RIR without redirects', async () => {
  const requests = [];
  const output = await rdapProvider.run(
    { type: 'ip', value: '8.8.8.8' },
    {
      feedCache: new Map(),
      fetchImpl: async (url, init) => {
        requests.push({ url: String(url), init });
        if (String(url) === 'https://data.iana.org/rdap/ipv4.json') {
          return json({ version: '1.0', services: [
            [['1.0.0.0/8'], ['https://rdap.apnic.net/']],
            [['8.0.0.0/8'], ['https://rdap.arin.net/registry/']],
          ] });
        }
        if (String(url) === 'https://rdap.arin.net/registry/ip/8.8.8.8') {
          return json({ handle: 'NET-8-0-0-0-1', name: 'LVLT-ORG-8-8', country: 'US', startAddress: '8.0.0.0', endAddress: '8.255.255.255' });
        }
        throw new Error(`unexpected request ${url}`);
      },
    },
  );
  assert.deepEqual(requests.map(item => item.url), [
    'https://data.iana.org/rdap/ipv4.json',
    'https://rdap.arin.net/registry/ip/8.8.8.8',
  ]);
  assert.equal(requests.some(item => item.url.includes('rdap.org')), false);
  assert.equal(output.attributes.ip, '8.8.8.8');
  assert.equal(output.attributes.handle, 'NET-8-0-0-0-1');
});

test('RDAP routes ASN through IANA bootstrap to authoritative RIR', async () => {
  const requests = [];
  const output = await rdapProvider.run(
    { type: 'asn', value: 'AS15169' },
    {
      feedCache: new Map(),
      fetchImpl: async (url) => {
        requests.push(String(url));
        if (String(url) === 'https://data.iana.org/rdap/asn.json') {
          return json({ version: '1.0', services: [
            [['1-1876', '10240-12287', '13312-15359'], ['https://rdap.arin.net/registry/']],
          ] });
        }
        if (String(url) === 'https://rdap.arin.net/registry/autnum/15169') {
          return json({ handle: 'AS15169', name: 'GOOGLE', startAutnum: 15169, endAutnum: 15169, country: 'US' });
        }
        throw new Error(`unexpected request ${url}`);
      },
    },
  );
  assert.deepEqual(requests, [
    'https://data.iana.org/rdap/asn.json',
    'https://rdap.arin.net/registry/autnum/15169',
  ]);
  assert.equal(output.attributes.asn, 'AS15169');
  assert.equal(output.attributes.name, 'GOOGLE');
});

test('RDAP no longer advertises unsafe generic domain bootstrap support', () => {
  assert.deepEqual(rdapProvider.types, ['ip', 'asn', 'cidr']);
});
