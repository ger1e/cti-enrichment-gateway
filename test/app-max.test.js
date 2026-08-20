import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { TtlCache } from '../src/core/cache.js';
import { rdapProvider, ripestatProvider, shodanProvider } from '../src/providers/index.js';

const baseEnv = { CTI_GATEWAY_TOKEN: 'gateway' };
const routingAdapters = [rdapProvider, ripestatProvider, shodanProvider];
function req(indicator) { return { method: 'POST', headers: { authorization: 'Bearer gateway' }, body: { indicator } }; }
function r(body, status = 200) { return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }); }

test('gateway skips credentialed adapters with missing secrets but keeps no-key IP adapters', async () => {
  const seen = [];
  const fetchImpl = async url => { const u = String(url); seen.push(u); if (u.startsWith('https://rdap.org/ip/')) return r({ handle: 'X' }); if (u.startsWith('https://stat.ripe.net/')) return r({ data: { asns: [15169], prefix: '8.8.8.0/24' } }); throw new Error(`unexpected ${u}`); };
  const app = createApp({ env: baseEnv, fetchImpl, cache: new TtlCache(), adapters: routingAdapters }); const out = await app.handleEnrich(req('8.8.8.8'));
  assert.equal(out.body.status, 'ok'); assert.deepEqual(out.body.evidence.map(x => x.provider), ['rdap', 'ripestat']); assert.equal(seen.length, 2);
});

test('configured provider is activated in deterministic IP workflow position', async () => {
  const env = { ...baseEnv, SHODAN_API_KEY: 'secret' }; const seen = [];
  const fetchImpl = async url => { const u = String(url); seen.push(u); if (u.startsWith('https://rdap.org/ip/')) return r({}); if (u.startsWith('https://stat.ripe.net/')) return r({ data: { asns: [] } }); if (u.startsWith('https://api.shodan.io/')) return r({ ip_str: '8.8.8.8', ports: [], data: [] }); throw new Error(`unexpected ${u}`); };
  const app = createApp({ env, fetchImpl, cache: new TtlCache(), adapters: routingAdapters }); const out = await app.handleEnrich(req('8.8.8.8'));
  assert.deepEqual(out.body.evidence.map(x => x.provider), ['rdap', 'ripestat', 'shodan']); assert.equal(seen.length, 3); assert.equal(JSON.stringify(out.body).includes('secret'), false);
});
