import test from 'node:test';
import assert from 'node:assert/strict';
import { rdapProvider } from '../src/providers/rdap.js';
import { epssProvider } from '../src/providers/epss.js';
import { cisaKevProvider } from '../src/providers/cisa-kev.js';
import { WORKFLOWS, WORKFLOW_BLUEPRINTS } from '../src/workflows.js';

function jsonFetch(expectedUrl, payload) {
  return async (url, options = {}) => {
    assert.equal(String(url), expectedUrl);
    assert.equal(options.method ?? 'GET', 'GET');
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
  };
}

test('RDAP adapter uses a fixed bootstrap host and normalizes registration fields', async () => {
  assert.deepEqual(rdapProvider.types, ['ip']);
  const data = await rdapProvider.run({ value: '8.8.8.8', type: 'ip' }, {
    fetchImpl: jsonFetch('https://rdap.org/ip/8.8.8.8', { handle: 'NET-8-8-8-0-2', name: 'GOGL', country: 'US', startAddress: '8.8.8.0', endAddress: '8.8.8.255' }),
    signal: new AbortController().signal,
  });
  assert.equal(data.observationType, 'registration');
  assert.equal(data.attributes.handle, 'NET-8-8-8-0-2');
  assert.deepEqual(data.references, ['https://rdap.org/ip/8.8.8.8']);
});

test('EPSS adapter queries FIRST by CVE and preserves probability separately', async () => {
  const data = await epssProvider.run({ value: 'CVE-2026-12345', type: 'cve' }, {
    fetchImpl: jsonFetch('https://api.first.org/data/v1/epss?cve=CVE-2026-12345', { data: [{ cve: 'CVE-2026-12345', epss: '0.42', percentile: '0.91', date: '2026-08-20' }] }),
    signal: new AbortController().signal,
  });
  assert.equal(data.observationType, 'exploit_probability');
  assert.equal(data.attributes.epss, 0.42);
  assert.equal(data.attributes.percentile, 0.91);
});

test('CISA KEV adapter uses the fixed official feed and identifies catalog membership', async () => {
  const url = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';
  const data = await cisaKevProvider.run({ value: 'CVE-2026-12345', type: 'cve' }, {
    fetchImpl: jsonFetch(url, { vulnerabilities: [{ cveID: 'CVE-2026-12345', vendorProject: 'Vendor', product: 'Thing', vulnerabilityName: 'Thing RCE', dateAdded: '2026-08-20', dueDate: '2026-09-10', knownRansomwareCampaignUse: 'Known', requiredAction: 'Patch', notes: '', cwes: ['CWE-78'] }] }),
    signal: new AbortController().signal,
  });
  assert.equal(data.verdict, 'known_exploited');
  assert.equal(data.confidence, 100);
  assert.equal(data.attributes.product, 'Thing');
});

test('active workflows only contain implemented providers and blueprints preserve MAX order', () => {
  assert.deepEqual(WORKFLOWS.ip, ['rdap']);
  assert.deepEqual(WORKFLOWS.cve, ['cisa-kev', 'epss']);
  assert.deepEqual(WORKFLOW_BLUEPRINTS.ip, ['ipinfo', 'rdap', 'ripestat', 'greynoise', 'abuseipdb', 'shodan', 'censys', 'otx', 'threatfox', 'urlscan']);
  assert.deepEqual(WORKFLOW_BLUEPRINTS.cve, ['cisa-kev', 'epss', 'nvd', 'osv']);
});
