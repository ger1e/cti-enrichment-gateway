import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { COMMANDS, completeCommand, interpretCommand } from '../app/shell.js';
import { createGatewayClient, GatewayHttpError } from '../app/api-client.js';
import { createShodanCommandHandler } from '../src/shodan-command.js';

const jsonResponse = (status, body) => new Response(JSON.stringify(body), {
  status,
  headers: { 'content-type': 'application/json' },
});

function request(body, token = 'gateway-token') {
  return {
    method: 'POST',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
    },
    body,
  };
}

function envelope(command, data = {}) {
  return {
    requestId: '11111111-1111-4111-8111-111111111111',
    source: 'shodan',
    command,
    input: {},
    creditImpact: 'none',
    data,
    durationMs: 12,
  };
}

test('terminal exposes bounded native Shodan command surface', () => {
  const names = new Set(COMMANDS.map(item => item.name));
  assert.ok(names.has('shodan'));

  assert.deepEqual(
    interpretCommand('shodan host 8.8.8.8', { authenticated: true }),
    { action: 'shodan', command: 'host', target: '8.8.8.8', query: null, facets: null, historySafe: true },
  );
  assert.deepEqual(
    interpretCommand('shodan domain example.com', { authenticated: true }),
    { action: 'shodan', command: 'domain', target: 'example.com', query: null, facets: null, historySafe: true },
  );
  assert.deepEqual(
    interpretCommand('shodan info', { authenticated: true }),
    { action: 'shodan', command: 'info', target: null, query: null, facets: null, historySafe: true },
  );
});

test('Shodan search/count/stats preserve bounded query grammar and reject unsafe options', () => {
  assert.deepEqual(
    interpretCommand('shodan search product:"FortiGate" country:HU', { authenticated: true }),
    { action: 'shodan', command: 'search', target: null, query: 'product:FortiGate country:HU', facets: null, historySafe: true },
  );
  assert.deepEqual(
    interpretCommand('shodan count port:443 country:HU', { authenticated: true }),
    { action: 'shodan', command: 'count', target: null, query: 'port:443 country:HU', facets: null, historySafe: true },
  );
  assert.deepEqual(
    interpretCommand('shodan stats product:nginx --facets country:20,org:10', { authenticated: true }),
    { action: 'shodan', command: 'stats', target: null, query: 'product:nginx', facets: 'country:20,org:10', historySafe: true },
  );

  assert.equal(interpretCommand('shodan host https://evil.example', { authenticated: true }).action, 'error');
  assert.equal(interpretCommand('shodan search port:443 --page 9', { authenticated: true }).action, 'error');
  assert.equal(interpretCommand('shodan download x port:443', { authenticated: true }).action, 'error');
  assert.equal(interpretCommand('shodan stats port:443 --facets country --page 2', { authenticated: true }).action, 'error');
});

test('Shodan shell requires auth and completes only approved subcommands/options', () => {
  assert.equal(interpretCommand('shodan info', { authenticated: false }).action, 'auth-required');
  assert.deepEqual(completeCommand('shodan h'), ['host']);
  assert.deepEqual(completeCommand('shodan s'), ['search', 'stats']);
  assert.deepEqual(completeCommand('shodan stats port:443 --f'), ['--facets']);
});

test('gateway client sends exact Shodan command to same-origin authenticated endpoint', async () => {
  const calls = [];
  const expected = envelope('stats', { total: 42, facets: { country: [{ value: 'HU', count: 42 }] } });
  const client = createGatewayClient({
    getToken: () => 'secret-token',
    fetchImpl: async (url, init) => { calls.push({ url, init }); return jsonResponse(200, expected); },
  });

  assert.deepEqual(await client.shodan({ command: 'stats', query: 'port:443', facets: 'country:20' }), expected);
  assert.equal(calls[0].url, '/api/para11ax/shodan');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer secret-token');
  assert.deepEqual(JSON.parse(calls[0].init.body), { command: 'stats', query: 'port:443', facets: 'country:20' });
});

test('gateway client fails closed on malformed Shodan response', async () => {
  const client = createGatewayClient({ getToken: () => 't', fetchImpl: async () => jsonResponse(200, { ok: true }) });
  await assert.rejects(
    () => client.shodan({ command: 'info' }),
    error => error instanceof GatewayHttpError && error.code === 'invalid_shodan_envelope',
  );
});

test('Shodan handler is authenticated, fixed-destination, key-safe, and command bounded', async () => {
  const calls = [];
  const handleShodan = createShodanCommandHandler({
    env: { PARA11AX_TOKEN: 'gateway-token', SHODAN_API_KEY: 'shodan-secret' },
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse(200, {
        ip_str: '8.8.8.8', org: 'Google LLC', asn: 'AS15169', country_code: 'US',
        ports: [53, 443], hostnames: ['dns.google'], domains: ['dns.google'], tags: ['dns'],
        last_update: '2026-08-29T00:00:00.000000',
        data: Array.from({ length: 80 }, (_, index) => ({
          port: index + 1, transport: 'tcp', product: 'svc', version: '1', data: 'x'.repeat(10000),
        })),
      });
    },
    nowMs: (() => { let value = 1000; return () => value += 25; })(),
  });

  const result = await handleShodan(request({ command: 'host', target: '8.8.8.8' }));
  assert.equal(result.status, 200);
  assert.equal(calls.length, 1);
  const upstream = new URL(calls[0].url);
  assert.equal(upstream.origin, 'https://api.shodan.io');
  assert.equal(upstream.pathname, '/shodan/host/8.8.8.8');
  assert.equal(upstream.searchParams.get('key'), 'shodan-secret');
  assert.equal(upstream.searchParams.get('minify'), 'false');
  assert.equal(result.body.source, 'shodan');
  assert.equal(result.body.command, 'host');
  assert.equal(result.body.creditImpact, 'none');
  assert.equal(result.body.data.services.length, 50);
  assert.equal(JSON.stringify(result.body).includes('shodan-secret'), false);
  assert.equal(JSON.stringify(result.body).includes('x'.repeat(1000)), false);

  assert.equal((await handleShodan(request({ command: 'host', target: '8.8.8.8' }, 'wrong'))).status, 401);
  assert.equal((await handleShodan(request({ command: 'host', target: 'https://evil.example' }))).status, 400);
  assert.equal((await handleShodan(request({ command: 'download', query: 'port:443' }))).status, 400);
  assert.equal((await handleShodan(request({ command: 'search', query: 'port:443', page: 50 }))).status, 400);
});

test('Shodan handler maps count/stats/domain/info to official fixed API endpoints and credit classes', async () => {
  const calls = [];
  const responses = [
    { total: 100, matches: [] },
    { total: 100, matches: [], facets: { country: [{ value: 'HU', count: 5 }] } },
    { domain: 'example.com', tags: [], data: [{ subdomain: 'www', type: 'A', value: '192.0.2.1' }], subdomains: ['www'], more: false },
    { plan: 'dev', query_credits: 20, scan_credits: 5, monitored_ips: 0, usage_limits: { query_credits: 100 } },
  ];
  const handleShodan = createShodanCommandHandler({
    env: { PARA11AX_TOKEN: 'gateway-token', SHODAN_API_KEY: 'key' },
    fetchImpl: async (url) => { calls.push(new URL(url)); return jsonResponse(200, responses.shift()); },
  });

  const counted = await handleShodan(request({ command: 'count', query: 'port:443' }));
  const stats = await handleShodan(request({ command: 'stats', query: 'port:443', facets: 'country:10' }));
  const domain = await handleShodan(request({ command: 'domain', target: 'example.com' }));
  const info = await handleShodan(request({ command: 'info' }));

  assert.equal(calls[0].pathname, '/shodan/host/count');
  assert.equal(calls[1].pathname, '/shodan/host/count');
  assert.equal(calls[1].searchParams.get('facets'), 'country:10');
  assert.equal(calls[2].pathname, '/dns/domain/example.com');
  assert.equal(calls[3].pathname, '/api-info');
  assert.equal(counted.body.creditImpact, 'none');
  assert.equal(stats.body.creditImpact, 'none');
  assert.equal(domain.body.creditImpact, 'consumes_query_credit');
  assert.equal(info.body.creditImpact, 'none');
});

test('Shodan search is first-page only and explicitly marks possible query-credit use', async () => {
  const calls = [];
  const handleShodan = createShodanCommandHandler({
    env: { PARA11AX_TOKEN: 'gateway-token', SHODAN_API_KEY: 'key' },
    fetchImpl: async (url) => {
      calls.push(new URL(url));
      return jsonResponse(200, {
        total: 200,
        matches: Array.from({ length: 75 }, (_, index) => ({
          ip_str: `192.0.2.${(index % 250) + 1}`, port: 443, transport: 'tcp', org: 'Example',
          product: 'nginx', version: '1.0', data: 'banner'.repeat(1000),
        })),
      });
    },
  });

  const result = await handleShodan(request({ command: 'search', query: 'product:nginx country:HU' }));
  assert.equal(calls[0].pathname, '/shodan/host/search');
  assert.equal(calls[0].searchParams.get('page'), null);
  assert.equal(calls[0].searchParams.get('minify'), 'true');
  assert.equal(result.body.creditImpact, 'may_consume_query_credit');
  assert.equal(result.body.data.matches.length, 50);
  assert.equal(JSON.stringify(result.body).includes('bannerbannerbanner'), false);
});

test('Shodan handler reports missing configuration and upstream throttling safely', async () => {
  const unconfigured = createShodanCommandHandler({ env: { PARA11AX_TOKEN: 'gateway-token' } });
  assert.equal((await unconfigured(request({ command: 'info' }))).status, 503);

  const throttled = createShodanCommandHandler({
    env: { PARA11AX_TOKEN: 'gateway-token', SHODAN_API_KEY: 'key' },
    fetchImpl: async () => jsonResponse(429, { error: 'Too many requests' }),
  });
  const result = await throttled(request({ command: 'info' }));
  assert.equal(result.status, 429);
  assert.equal(result.body.error, 'shodan_rate_limited');
});

test('public documentation covers the Shodan analyst-shell contract', () => {
  const docs = new Map([
    ['README.md', readFileSync(new URL('../README.md', import.meta.url), 'utf8')],
    ['index.html', readFileSync(new URL('../index.html', import.meta.url), 'utf8')],
    ['docs/API.md', readFileSync(new URL('../docs/API.md', import.meta.url), 'utf8')],
    ['docs/ARCHITECTURE.md', readFileSync(new URL('../docs/ARCHITECTURE.md', import.meta.url), 'utf8')],
    ['docs/PROVIDERS.md', readFileSync(new URL('../docs/PROVIDERS.md', import.meta.url), 'utf8')],
    ['docs/OPERATIONS.md', readFileSync(new URL('../docs/OPERATIONS.md', import.meta.url), 'utf8')],
    ['docs/SECURITY-CONTROLS.md', readFileSync(new URL('../docs/SECURITY-CONTROLS.md', import.meta.url), 'utf8')],
    ['docs/THREAT-MODEL.md', readFileSync(new URL('../docs/THREAT-MODEL.md', import.meta.url), 'utf8')],
    ['SECURITY.md', readFileSync(new URL('../SECURITY.md', import.meta.url), 'utf8')],
    ['CHANGELOG.md', readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8')],
  ]);

  for (const [name, text] of docs) {
    assert.match(text, /Shodan/i, `${name} must mention Shodan`);
  }

  for (const name of ['README.md', 'index.html', 'docs/API.md', 'docs/OPERATIONS.md']) {
    const text = docs.get(name);
    for (const command of ['shodan host', 'shodan search', 'shodan count', 'shodan stats', 'shodan domain', 'shodan info']) {
      assert.ok(text.includes(command), `${name} missing ${command}`);
    }
  }

  const contract = [...docs.values()].join('\n');
  assert.match(contract, /\/api\/para11ax\/shodan/);
  assert.match(contract, /SHODAN_API_KEY/);
  assert.match(contract, /api\.shodan\.io/);
  assert.match(contract, /query credit/i);
  assert.match(contract, /first[- ]page/i);
  assert.match(contract, /Evidence v2.*unchanged|unchanged.*Evidence v2/i);
  assert.match(contract, /download.*(disabled|unsupported|excluded|not supported)/i);
});
