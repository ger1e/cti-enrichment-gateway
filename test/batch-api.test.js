import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

function adapter(name = 'fixture', { delay = null } = {}) {
  return Object.freeze({
    name,
    types: ['ip', 'domain', 'hash', 'cve', 'attack', 'asn', 'cidr', 'url'],
    observationTypes: ['reputation'],
    costClass: 'free', tier: 1, timeoutMs: 5000,
    cacheTtlMs: 1000, negativeCacheTtlMs: 1000, maxResponseBytes: 1024,
    fixedHosts: ['fixture.invalid'], methods: ['GET'], protocols: ['https:'], parserVersion: 'test', sourceUrl: 'https://fixture.invalid/',
    async run(input) {
      if (delay) await delay(input);
      return { observationType: 'reputation', verdict: 'unknown', attributes: { value: input.value }, relationships: [], references: [] };
    },
  });
}

function request(body, { token = 'secret', method = 'POST', contentType = 'application/json' } = {}) {
  return { method, headers: { authorization: token ? `Bearer ${token}` : '', 'content-type': contentType }, body };
}

function app(options = {}) {
  return createApp({ env: { CTI_GATEWAY_TOKEN: 'secret' }, adapters: [adapter('fixture', options)], fetchImpl: async () => { throw new Error('network not expected'); } });
}

test('batch requires POST bearer auth and JSON media type', async () => {
  assert.equal((await app().handleBatch(request({ indicators: ['192.0.2.1'] }, { method: 'GET' }))).status, 405);
  assert.equal((await app().handleBatch(request({ indicators: ['192.0.2.1'] }, { token: '' }))).status, 401);
  assert.equal((await app().handleBatch(request({ indicators: ['192.0.2.1'] }, { contentType: 'text/plain' }))).status, 415);
});

test('batch accepts 1..20 strings and rejects 21 or provider overrides', async () => {
  assert.equal((await app().handleBatch(request({ indicators: [] }))).status, 400);
  assert.equal((await app().handleBatch(request({ indicators: Array.from({ length: 21 }, (_, i) => `192.0.2.${i + 1}`) }))).status, 400);
  const override = await app().handleBatch(request({ indicators: ['192.0.2.1'], providers: ['fixture'] }));
  assert.equal(override.status, 400);
  assert.equal(override.body.error, 'unsupported_request_field');
});

test('canonical duplicates perform provider work once and re-associate to input order', async () => {
  let calls = 0;
  const a = adapter('fixture');
  const counted = Object.freeze({ ...a, async run(input) { calls += 1; return a.run(input); } });
  const target = createApp({ env: { CTI_GATEWAY_TOKEN: 'secret' }, adapters: [counted] });
  const result = await target.handleBatch(request({ indicators: ['AS3333', 'as3333', 'EXAMPLE.com', 'example.com'], profile: 'full' }));
  assert.equal(result.status, 200);
  assert.equal(calls, 2);
  assert.equal(result.body.results.length, 4);
  assert.equal(result.body.results[1].duplicateOf, 0);
  assert.equal(result.body.results[3].duplicateOf, 2);
  assert.equal(result.body.uniqueIndicators, 2);
});

test('an invalid individual indicator is represented independently instead of rejecting the batch', async () => {
  const result = await app().handleBatch(request({ indicators: ['192.0.2.1', 'not an indicator', 'example.com'] }));
  assert.equal(result.status, 200);
  assert.equal(result.body.results[0].status, 'ok');
  assert.equal(result.body.results[1].status, 'invalid');
  assert.equal(result.body.results[1].error, 'invalid_indicator');
  assert.equal(result.body.results[2].status, 'ok');
});

test('batch never runs more than three indicator enrichments concurrently', async () => {
  let active = 0;
  let peak = 0;
  let releases = [];
  const delay = async () => {
    active += 1; peak = Math.max(peak, active);
    await new Promise(resolve => releases.push(resolve));
    active -= 1;
  };
  const target = app({ delay });
  const pending = target.handleBatch(request({ indicators: ['192.0.2.1', '192.0.2.2', '192.0.2.3', '192.0.2.4'] }));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(peak, 3);
  while (releases.length) releases.shift()();
  await new Promise(resolve => setImmediate(resolve));
  while (releases.length) releases.shift()();
  const result = await pending;
  assert.equal(result.status, 200);
  assert.equal(peak <= 3, true);
});

test('batch reports global call-budget exhaustion explicitly', async () => {
  const adapters = Array.from({ length: 11 }, (_, i) => adapter(`p${i}`));
  const target = createApp({ env: { CTI_GATEWAY_TOKEN: 'secret' }, adapters, batchProviderCallLimit: 2 });
  const result = await target.handleBatch(request({ indicators: ['192.0.2.1', '192.0.2.2', '192.0.2.3'] }));
  assert.equal(result.status, 200);
  assert.equal(result.body.budget.providerCallLimit, 2);
  assert.equal(result.body.budget.providerCalls <= 2, true);
  assert.equal(result.body.results.some(item => item.status === 'skipped' && item.reason === 'batch_provider_call_budget_exhausted'), true);
});

test('batch deadline exhaustion is explicit', async () => {
  let now = 0;
  const target = createApp({ env: { CTI_GATEWAY_TOKEN: 'secret' }, adapters: [adapter()], nowMs: () => now, batchDeadlineMs: 5 });
  const original = target.enrichClassifiedForTest;
  assert.equal(original, undefined);
  const result = await target.handleBatch(request({ indicators: ['192.0.2.1', '192.0.2.2'] }));
  assert.equal(result.status, 200);
  assert.equal(result.body.budget.deadlineMs, 5);
});
