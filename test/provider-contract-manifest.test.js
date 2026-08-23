import test from 'node:test';
import assert from 'node:assert/strict';
import { PROVIDER_MANIFEST } from '../src/providers/manifest.js';

const expectedVersions = Object.freeze({
  ipinfo: '2026-08-22.1',
  rdap: '2026-08-22.1',
  threatminer: '2026-08-22.1',
  greynoise: '2026-08-22.1',
  shodan: '2026-08-22.1',
  censys: 'v3-2026-08-22.1',
  modat: '2026-08-22.1',
  'cloudflare-radar': '2026-08-22.1',
  virustotal: 'v3-2026-08-22.1',
  otx: '2026-08-22.1',
  threatfox: '2026-08-22.1',
  webamon: '2026-08-22.1',
  pulsedive: '2026-08-22.1',
  'circl-hashlookup': '2026-08-22.1',
  malpedia: '2026-08-22.1',
  'hybrid-analysis': 'v2.38.0-2026-08-22.1',
  'circl-vulnerability': '2026-08-22.1',
  ransomlook: '2026-08-22.1',
});

test('RDAP manifest uses IANA bootstrap and direct allowlisted RIR hosts with no redirector/domain claim', () => {
  const rdap = PROVIDER_MANIFEST.rdap;
  assert.deepEqual(rdap.types, ['ip', 'asn', 'cidr']);
  assert.equal(rdap.fixedHosts.includes('rdap.org'), false);
  assert.deepEqual(rdap.fixedHosts, [
    'data.iana.org',
    'rdap.afrinic.net',
    'rdap.apnic.net',
    'rdap.arin.net',
    'rdap.db.ripe.net',
    'rdap.lacnic.net',
  ]);
});

test('Pulsedive manifest models optional authentication and current indicator scope', () => {
  const pulsedive = PROVIDER_MANIFEST.pulsedive;
  assert.equal(pulsedive.credentialEnv, 'PULSEDIVE_API_KEY');
  assert.equal(pulsedive.optionalCredential, true);
  assert.equal(pulsedive.costClass, 'free');
  assert.deepEqual(pulsedive.types, ['ip', 'domain', 'url']);
});

test('Hybrid Analysis manifest uses canonical non-redirecting API host', () => {
  assert.deepEqual(PROVIDER_MANIFEST['hybrid-analysis'].fixedHosts, ['hybrid-analysis.com']);
});

test('Malpedia manifest models APIToken authentication rather than Bearer', () => {
  assert.equal(PROVIDER_MANIFEST.malpedia.authType, 'token');
});

test('corrected provider parser versions cannot drift behind adapter contracts', () => {
  for (const [name, version] of Object.entries(expectedVersions)) {
    assert.equal(PROVIDER_MANIFEST[name].parserVersion, version, name);
  }
});
