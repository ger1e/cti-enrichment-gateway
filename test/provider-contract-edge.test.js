import test from 'node:test';
import assert from 'node:assert/strict';
import { ipinfoProvider } from '../src/providers/ipinfo.js';
import { circlVulnerabilityProvider } from '../src/providers/circl-vulnerability.js';

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

test('IPinfo Lite uses bearer auth instead of placing the token in the URL', async () => {
  let request;
  const output = await ipinfoProvider.run(
    { type: 'ip', value: '8.8.8.8' },
    {
      env: { IPINFO_TOKEN: 'test-token' },
      fetchImpl: async (url, init) => {
        request = { url: String(url), init };
        return json({ ip: '8.8.8.8', asn: 'AS15169', as_name: 'Google LLC', as_domain: 'google.com', country_code: 'US', continent_code: 'NA' });
      },
    },
  );
  const url = new URL(request.url);
  assert.equal(url.searchParams.has('token'), false);
  assert.equal(request.init.headers.Authorization, 'Bearer test-token');
  assert.equal(output.attributes.asn, 'AS15169');
});

test('IPinfo missing IP response is neutral absence', async () => {
  const output = await ipinfoProvider.run(
    { type: 'ip', value: '192.0.2.44' },
    {
      env: { IPINFO_TOKEN: 'test-token' },
      fetchImpl: async () => json({ error: { title: 'Wrong ip', message: 'not found' } }, 404),
    },
  );
  assert.equal(output.observationType, 'network_identity');
  assert.equal(output.verdict, 'no_result');
  assert.equal(output.attributes.ip, '192.0.2.44');
});

test('CIRCL Vulnerability-Lookup does not manufacture cataloged evidence for a missing record', async () => {
  for (const response of [json({ message: 'not found' }, 404), json({})]) {
    const output = await circlVulnerabilityProvider.run(
      { type: 'cve', value: 'CVE-2099-999999' },
      { fetchImpl: async () => response },
    );
    assert.equal(output.observationType, 'vulnerability_catalog');
    assert.equal(output.verdict, 'no_result');
    assert.equal(output.attributes.state, null);
  }
});
