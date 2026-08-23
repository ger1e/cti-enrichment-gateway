import test from 'node:test';
import assert from 'node:assert/strict';
import { ransomlookProvider } from '../src/providers/ransomlook.js';
import { cloudflareRadarProvider } from '../src/providers/cloudflare-radar.js';
import { webamonProvider } from '../src/providers/webamon.js';
import { censysProvider } from '../src/providers/censys.js';
import { circlHashlookupProvider } from '../src/providers/circl-hashlookup.js';
import { greynoiseProvider } from '../src/providers/greynoise.js';
import { shodanProvider } from '../src/providers/shodan.js';
import { virustotalProvider } from '../src/providers/virustotal.js';
import { probeProviders } from '../src/control/provider-probe.js';

function json(value, status = 200) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } });
}

test('RansomLook v2 uses q= and parses the structured search response', async () => {
  let request;
  const output = await ransomlookProvider.run(
    { type: 'domain', value: 'victim.example' },
    { fetchImpl: async (url, init) => {
      request = { url: String(url), init };
      return json({
        groups: [], markets: [], leaks: [], notes: [],
        posts: [{ group_name: 'lockbit', post_title: 'Victim Example', discovered: '2026-08-22 10:00:00' }],
      });
    } },
  );
  const url = new URL(request.url);
  assert.equal(url.pathname, '/api/search');
  assert.equal(url.searchParams.get('q'), 'victim.example');
  assert.equal(url.searchParams.has('query'), false);
  assert.equal(output.verdict, 'observed');
  assert.equal(output.attributes.postCount, 1);
  assert.deepEqual(output.attributes.groups, ['lockbit']);
});

test('Cloudflare Radar parses the current nested result.ip response', async () => {
  const output = await cloudflareRadarProvider.run(
    { type: 'ip', value: '8.8.8.8' },
    {
      env: { CLOUDFLARE_RADAR_TOKEN: 'test-token' },
      fetchImpl: async () => json({
        success: true,
        result: {
          ip: {
            asn: '15169',
            asnLocation: 'US',
            asnName: 'GOOGLE',
            asnOrgName: 'Google LLC',
            ip: '8.8.8.8',
            ipVersion: 'IPv4',
            location: 'GB',
            locationName: 'United Kingdom',
          },
        },
      }),
    },
  );
  assert.equal(output.attributes.ip, '8.8.8.8');
  assert.equal(output.attributes.asn, 'AS15169');
  assert.equal(output.attributes.organization, 'Google LLC');
  assert.equal(output.attributes.country, 'GB');
  assert.equal(output.attributes.locationName, 'United Kingdom');
  assert.equal(output.attributes.asnLocation, 'US');
});

test('Webamon Pro basic IP search sends documented IP fields and parses current result shape', async () => {
  let request;
  const output = await webamonProvider.run(
    { type: 'ip', value: '192.0.2.44' },
    {
      env: { WEBAMON_API_KEY: 'test-key' },
      fetchImpl: async (url, init) => {
        request = { url: String(url), init };
        return json({
          search_string: '192.0.2.44',
          fields: ['server.ip', 'request.response.ip'],
          total_hits: 1,
          results: [{
            resolved_url: 'https://evil.example/login',
            submission_url: 'https://evil.example/',
            server: { ip: '192.0.2.44', domain: 'evil.example' },
            meta: { risk_score: 90, report_id: 'r1', submission_url: 'https://evil.example/' },
          }],
        });
      },
    },
  );
  const url = new URL(request.url);
  assert.equal(url.hostname, 'pro.webamon.com');
  assert.equal(url.searchParams.get('search'), '192.0.2.44');
  assert.ok(url.searchParams.get('results')?.includes('server.ip'));
  assert.ok(url.searchParams.get('results')?.includes('request.response.ip'));
  assert.equal(url.searchParams.get('results')?.includes('resource.sha256'), false);
  assert.equal(request.init.headers['x-api-key'], 'test-key');
  assert.equal(output.attributes.resultCount, 1);
  assert.equal(output.relationships.some(r => r.targetType === 'ip' && r.target === '192.0.2.44'), true);
  assert.equal(output.relationships.some(r => r.targetType === 'domain' && r.target === 'evil.example'), true);
  assert.equal(output.relationships.some(r => r.targetType === 'url' && r.target === 'https://evil.example/login'), true);
});

test('Webamon hash search uses documented resource SHA-256 fields only', async () => {
  let request;
  await webamonProvider.run(
    { type: 'hash', value: 'a'.repeat(64) },
    {
      env: { WEBAMON_API_KEY: 'test-key' },
      fetchImpl: async (url, init) => { request = { url: String(url), init }; return json({ results: [] }); },
    },
  );
  const fields = new URL(request.url).searchParams.get('results')?.split(',') ?? [];
  assert.deepEqual(fields, ['resource.sha256', 'server.resource.sha256']);
});

test('Censys treats documented 404 no-host response as absence rather than provider failure', async () => {
  const output = await censysProvider.run(
    { type: 'ip', value: '192.0.2.44' },
    {
      env: { CENSYS_PAT: 'test-pat' },
      fetchImpl: async () => json({ detail: 'No host found' }, 404),
    },
  );
  assert.equal(output.observationType, 'internet_exposure');
  assert.equal(output.verdict, 'no_result');
  assert.equal(output.attributes.ip, '192.0.2.44');
  assert.equal(output.attributes.serviceCount, 0);
});

test('CIRCL Hashlookup treats 404 as absence and accepts current hyphenated hash fields', async () => {
  const missing = await circlHashlookupProvider.run(
    { type: 'hash', value: 'a'.repeat(64) },
    { fetchImpl: async () => json({ message: 'not found' }, 404) },
  );
  assert.equal(missing.verdict, 'no_result');

  const found = await circlHashlookupProvider.run(
    { type: 'hash', value: 'a'.repeat(64) },
    { fetchImpl: async () => json({
      MD5: 'b'.repeat(32),
      'SHA-1': 'c'.repeat(40),
      'SHA-256': 'a'.repeat(64),
      FileName: 'demo.exe',
    }) },
  );
  assert.equal(found.verdict, 'known');
  assert.equal(found.relationships.some(r => r.target === 'c'.repeat(40)), true);
  assert.equal(found.relationships.some(r => r.target === 'a'.repeat(64)), true);
});

test('GreyNoise Community 404 means not observed, not provider failure or benign', async () => {
  const output = await greynoiseProvider.run(
    { type: 'ip', value: '192.0.2.44' },
    {
      env: { GREYNOISE_API_KEY: 'test-key' },
      fetchImpl: async () => json({ ip: '192.0.2.44', noise: false, riot: false, message: 'IP not observed' }, 404),
    },
  );
  assert.equal(output.observationType, 'internet_noise');
  assert.equal(output.verdict, 'no_result');
  assert.equal(output.attributes.noise, false);
  assert.equal(output.attributes.riot, false);
  assert.equal(output.attributes.classification, null);
});

test('Shodan documented 404 means no host information, not provider failure', async () => {
  const output = await shodanProvider.run(
    { type: 'ip', value: '192.0.2.44' },
    {
      env: { SHODAN_API_KEY: 'test-key' },
      fetchImpl: async () => json({ error: 'No information available for that IP.' }, 404),
    },
  );
  assert.equal(output.observationType, 'internet_exposure');
  assert.equal(output.verdict, 'no_result');
  assert.equal(output.attributes.ip, '192.0.2.44');
  assert.deepEqual(output.attributes.ports, []);
});

test('VirusTotal v3 NotFoundError is neutral absence for every lookup type', async () => {
  for (const input of [
    { type: 'ip', value: '192.0.2.44' },
    { type: 'domain', value: 'missing.example' },
    { type: 'url', value: 'https://missing.example/' },
    { type: 'hash', value: 'a'.repeat(64) },
  ]) {
    const output = await virustotalProvider.run(input, {
      env: { VIRUSTOTAL_API_KEY: 'test-key' },
      fetchImpl: async () => json({ error: { code: 'NotFoundError', message: 'not found' } }, 404),
    });
    assert.equal(output.observationType, 'multi_engine_reputation');
    assert.equal(output.verdict, 'no_result');
    assert.deepEqual(output.relationships, []);
  }
});

test('provider probe is sequential, secret-safe, and distinguishes auth, quota, transport, and contract states', async () => {
  let active = 0;
  let maxActive = 0;
  const make = (name, run, requiredEnv) => ({ name, types: ['ip'], requiredEnv, timeoutMs: 50, fixedHosts: ['api.example.test'], methods: ['GET'], protocols: ['https:'], maxResponseBytes: 1024, run });
  const providers = [
    make('ok', async () => {
      active += 1; maxActive = Math.max(maxActive, active);
      await new Promise(resolve => setTimeout(resolve, 2)); active -= 1;
      return { observationType: 'network_identity', verdict: 'unknown' };
    }),
    make('missing', async () => { throw new Error('must not run'); }, 'MISSING_KEY'),
    make('auth', async () => { throw Object.assign(new Error('provider HTTP 401 SECRET-MARKER'), { status: 401 }); }, 'AUTH_KEY'),
    make('rate', async () => { throw Object.assign(new Error('provider HTTP 429'), { status: 429 }); }),
    make('upstream', async () => { throw Object.assign(new Error('provider HTTP 503'), { status: 503 }); }),
    make('transport', async () => { throw new Error('provider_transport_error'); }),
    make('contract', async () => { throw new Error('unexpected schema'); }),
  ];
  const out = await probeProviders({ providers, env: { AUTH_KEY: 'SECRET-MARKER' }, includeCredentialed: true });
  assert.equal(maxActive, 1);
  assert.deepEqual(out.map(x => x.status), ['ok', 'unconfigured', 'auth_failed', 'rate_limited', 'upstream_error', 'upstream_error', 'contract_error']);
  assert.equal(JSON.stringify(out).includes('SECRET-MARKER'), false);
});

test('provider probe preserves the production fixed-host egress boundary', async () => {
  let networkCalls = 0;
  const offHost = {
    name: 'offhost', types: ['ip'], timeoutMs: 50,
    fixedHosts: ['api.example.test'], methods: ['GET'], protocols: ['https:'], maxResponseBytes: 1024,
    async run(_input, context) {
      await context.fetchImpl('https://evil.example/x');
      return { observationType: 'network_identity', verdict: 'unknown' };
    },
  };
  const out = await probeProviders({
    providers: [offHost],
    includeCredentialed: true,
    fetchImpl: async () => { networkCalls += 1; return json({}); },
  });
  assert.equal(networkCalls, 0);
  assert.equal(out[0].status, 'contract_error');
});
