import test from 'node:test';
import assert from 'node:assert/strict';
import { rdapProvider } from '../src/providers/rdap.js';
import { epssProvider } from '../src/providers/epss.js';
import { cisaKevProvider } from '../src/providers/cisa-kev.js';
import { ALL_PROVIDERS } from '../src/providers/index.js';
import { WORKFLOWS, WORKFLOW_BLUEPRINTS } from '../src/workflows.js';

function jsonFetch(expectedUrl, payload) {
  return async (url, options = {}) => {
    assert.equal(String(url), expectedUrl);
    assert.equal(options.method ?? 'GET', 'GET');
    return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } });
  };
}

test('RDAP adapter uses fixed bootstrap host for IP registration', async () => {
  assert.deepEqual(rdapProvider.types, ['ip', 'domain']);
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

test('CISA KEV adapter identifies catalog membership', async () => {
  const url = 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json';
  const data = await cisaKevProvider.run({ value: 'CVE-2026-12345', type: 'cve' }, {
    fetchImpl: jsonFetch(url, { vulnerabilities: [{ cveID: 'CVE-2026-12345', vendorProject: 'Vendor', product: 'Thing', vulnerabilityName: 'Thing RCE', dateAdded: '2026-08-20', dueDate: '2026-09-10', knownRansomwareCampaignUse: 'Known', requiredAction: 'Patch', notes: '', cwes: ['CWE-78'] }] }),
    signal: new AbortController().signal,
  });
  assert.equal(data.verdict, 'known_exploited');
  assert.equal(data.confidence, 100);
  assert.equal(data.attributes.product, 'Thing');
});

test('every active workflow provider has an implemented adapter', () => {
  const names = new Set(ALL_PROVIDERS.map(p => p.name));
  for (const [type, providers] of Object.entries(WORKFLOWS)) {
    assert.ok(providers.length > 0, `${type} workflow must not be empty`);
    for (const name of providers) assert.equal(names.has(name), true, `${name} missing adapter`);
  }
});

test('active workflows preserve MAX routing order', () => {
  assert.deepEqual(WORKFLOWS.ip, ['ipinfo', 'rdap', 'ripestat', 'dshield', 'spamhaus-drop', 'tor-exit', 'feodo-tracker', 'threatminer', 'misp-circl-osint', 'misp-botvrij-osint', 'greynoise', 'abuseipdb', 'shodan', 'censys', 'cloudflare-radar', 'virustotal', 'otx', 'threatfox', 'urlscan', 'webamon', 'pulsedive']);
  assert.deepEqual(WORKFLOWS.domain, ['rdap', 'threatminer', 'openphish', 'misp-circl-osint', 'misp-botvrij-osint', 'urlscan', 'webamon', 'virustotal', 'otx', 'threatfox', 'pulsedive']);
  assert.deepEqual(WORKFLOWS.url, ['openphish', 'threatminer', 'misp-circl-osint', 'misp-botvrij-osint', 'urlscan', 'webamon', 'urlhaus', 'virustotal', 'otx', 'threatfox', 'pulsedive']);
  assert.deepEqual(WORKFLOWS.hash, ['circl-hashlookup', 'threatminer', 'misp-circl-osint', 'misp-botvrij-osint', 'malwarebazaar', 'malpedia', 'virustotal', 'hybrid-analysis', 'otx', 'threatfox', 'pulsedive']);
  assert.deepEqual(WORKFLOWS.cve, ['cisa-kev', 'epss', 'circl-vulnerability', 'misp-circl-osint', 'misp-botvrij-osint', 'nvd', 'osv', 'otx']);
  assert.deepEqual(WORKFLOWS.attack, ['attack-taxii']);
  assert.equal(WORKFLOW_BLUEPRINTS, WORKFLOWS);
});
