import test from 'node:test';
import assert from 'node:assert/strict';
import { ransomlookProvider } from '../src/providers/ransomlook.js';
import { cloudflareRadarProvider } from '../src/providers/cloudflare-radar.js';
import { webamonProvider } from '../src/providers/webamon.js';
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

test('Webamon Pro basic search sends required results fields and parses current result shape', async () => {
  let request;
  const output = await webamonProvider.run(
    { type: 'ip', value: '192.0.2.44' },
    {
      env: { WEBAMON_API_KEY: 'test-key' },
      fetchImpl: async (url, init) => {
        request = { url: String(url), init };
        return json({
          search_string: '192.0.2.44',
          fields: ['server.ip', 'resolved_url', 'submission_url', 'resource.sha256'],
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
  assert.ok(url.searchParams.get('results')?.includes('resource.sha256'));
  assert.equal(request.init.headers['x-api-key'], 'test-key');
  assert.equal(output.attributes.resultCount, 1);
  assert.equal(output.relationships.some(r => r.targetType === 'ip' && r.target === '192.0.2.44'), true);
  assert.equal(output.relationships.some(r => r.targetType === 'domain' && r.target === 'evil.example'), true);
  assert.equal(output.relationships.some(r => r.targetType === 'url' && r.target === 'https://evil.example/login'), true);
});

test('provider probe is sequential, secret-safe, and distinguishes unconfigured/auth/rate/upstream states', async () => {
  let active = 0;
  let maxActive = 0;
  const make = (name, run, requiredEnv) => ({ name, types: ['ip'], requiredEnv, timeoutMs: 50, run });
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
  ];
  const out = await probeProviders({ providers, env: { AUTH_KEY: 'SECRET-MARKER' }, includeCredentialed: true });
  assert.equal(maxActive, 1);
  assert.deepEqual(out.map(x => x.status), ['ok', 'unconfigured', 'auth_failed', 'rate_limited', 'upstream_error']);
  assert.equal(JSON.stringify(out).includes('SECRET-MARKER'), false);
});
