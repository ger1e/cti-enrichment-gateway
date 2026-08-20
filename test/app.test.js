import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { TtlCache } from '../src/core/cache.js';
import { rdapProvider, cisaKevProvider, epssProvider } from '../src/providers/index.js';

const env = {
  CTI_GATEWAY_TOKEN: 'super-secret-gateway-token',
  SHODAN_API_KEY: 'shodan-secret',
  MALPEDIA_API_TOKEN: 'malpedia-secret',
};

function req({ method = 'POST', auth = true, body = undefined, headers = {} } = {}) {
  return { method, headers: { ...(auth ? { authorization: `Bearer ${env.CTI_GATEWAY_TOKEN}` } : {}), ...headers }, body };
}

test('health exposes configuration booleans but never secret values', async () => {
  const app = createApp({ env });
  const response = await app.handleHealth(req({ method: 'GET', auth: false }));
  assert.equal(response.status, 200);
  assert.equal(response.body.gatewayAuthConfigured, true);
  assert.equal(response.body.providers.shodan.configured, true);
  assert.equal(response.body.providers.malpedia.configured, true);
  const serialized = JSON.stringify(response.body);
  assert.equal(serialized.includes('shodan-secret'), false);
  assert.equal(serialized.includes('malpedia-secret'), false);
  assert.equal(serialized.includes('super-secret-gateway-token'), false);
});

test('enrichment rejects unauthorized requests', async () => {
  const app = createApp({ env });
  const response = await app.handleEnrich(req({ auth: false, body: { indicator: '8.8.8.8' } }));
  assert.equal(response.status, 401);
  assert.equal(response.body.error, 'unauthorized');
});

test('IP enrichment can run an isolated RDAP workflow fixture', async () => {
  const seen = [];
  const fetchImpl = async url => { seen.push(String(url)); return new Response(JSON.stringify({ handle: 'NET-X', country: 'US' }), { status: 200 }); };
  const app = createApp({ env, fetchImpl, adapters: [rdapProvider], cache: new TtlCache(), now: () => '2026-08-20T12:00:00Z' });
  const response = await app.handleEnrich(req({ body: { indicator: '8.8.8.8' } }));
  assert.equal(response.status, 200);
  assert.equal(response.body.type, 'ip');
  assert.equal(response.body.status, 'ok');
  assert.deepEqual(seen, ['https://rdap.org/ip/8.8.8.8']);
});

test('CVE enrichment fixture preserves KEV and EPSS as separate semantics', async () => {
  const seen = [];
  const fetchImpl = async url => {
    const u = String(url); seen.push(u);
    if (u.includes('known_exploited_vulnerabilities.json')) return new Response(JSON.stringify({ vulnerabilities: [{ cveID: 'CVE-2026-12345', product: 'Thing', dateAdded: '2026-08-20' }] }), { status: 200 });
    if (u.startsWith('https://api.first.org/')) return new Response(JSON.stringify({ data: [{ cve: 'CVE-2026-12345', epss: '0.7', percentile: '0.95', date: '2026-08-20' }] }), { status: 200 });
    throw new Error(`unexpected URL ${u}`);
  };
  const app = createApp({ env, fetchImpl, adapters: [cisaKevProvider, epssProvider], cache: new TtlCache(), now: () => '2026-08-20T12:00:00Z' });
  const response = await app.handleEnrich(req({ body: { indicator: 'CVE-2026-12345' } }));
  assert.equal(response.status, 200);
  assert.equal(response.body.evidence.length, 2);
  assert.equal(response.body.evidence[0].observation.kind, 'known_exploited');
  assert.equal(response.body.evidence[1].observation.kind, 'exploit_probability');
  assert.equal(seen.length, 2);
});

test('enrichment rejects unsupported methods, invalid bodies and oversized input', async () => {
  const app = createApp({ env });
  assert.equal((await app.handleEnrich(req({ method: 'GET', body: { indicator: '8.8.8.8' } }))).status, 405);
  assert.equal((await app.handleEnrich(req({ body: { indicator: 'garbage' } }))).status, 400);
  assert.equal((await app.handleEnrich(req({ body: { indicator: '8.8.8.8', type: 'cve' } }))).status, 400);
  const huge = JSON.stringify({ indicator: '8.8.8.8', pad: 'x'.repeat(20_000) });
  assert.equal((await app.handleEnrich(req({ body: huge, headers: { 'content-length': String(Buffer.byteLength(huge)) } }))).status, 413);
});
