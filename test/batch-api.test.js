import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { runBatch } from '../src/core/batch.js';

function adapter(name = 'rdap', { delay = null } = {}) {
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
  return createApp({ env: { CTI_GATEWAY_TOKEN: 'secret' }, adapters: [adapter('rdap', options)], fetchImpl: async () => { throw new Error('network not expected'); } });
}

test('batch requires POST bearer auth and JSON media type', async () => {
  assert.equal((await app().handleBatch(request({ indicators: ['192.0.2.1'] }, { method: 'GET' }))).status, 405);
  assert.equal((await app().handleBatch(request({ indicators: ['192.0.2.1'] }, { token: '' }))).status, 401);
  assert.equal((await app().handleBatch(request({ indicators: ['192.0.2.1'] }, { contentType: 'text/plain' }))).status, 415);
});

test('batch accepts 1..20 strings and rejects 21 or provider overrides', async () => {
  assert.equal((await app().handleBatch(request({ indicators: [] }))).status, 400);
  assert.equal((await app().handleBatch(request({ indicators: Array.from({ length: 21 }, (_, i) => `192.0.2.${i + 1}`) }))).status, 400);
  const override = await app().handleBatch(request({ indicators: ['192.0.2.1'], providers: ['rdap'] }));
  assert.equal(override.status, 400);
  assert.equal(override.body.error, 'unsupported_request_field');
});

test('canonical duplicates perform provider work once and re-associate to input order', async () => {
  let calls = 0;
  const counted = name => {
    const a = adapter(name);
    return Object.freeze({ ...a, async run(input) { calls += 1; return a.run(input); } });
  };
  const target = createApp({ env: { CTI_GATEWAY_TOKEN: 'secret' }, adapters: [counted('rdap'), counted('threatminer')] });
  const result = await target.handleBatch(request({ indicators: ['AS3333', 'as3333', 'EXAMPLE.com', 'example.com'], profile: 'full' }));
  assert.equal(result.status, 200);
  assert.equal(calls, 2);
  assert.equal(result.body.results.length, 4);
  assert.equal(result.body.results[1].duplicateOf, 0);
  assert.equal(result.body.results[3].duplicateOf, 2);
  assert.equal(result.body.uniqueIndicators, 2);
});

test('an invalid individual indicator is represented independently instead of rejecting the batch', async () => {
  const target = createApp({ env: { CTI_GATEWAY_TOKEN: 'secret' }, adapters: [adapter('rdap'), adapter('threatminer')] });
  const result = await target.handleBatch(request({ indicators: ['192.0.2.1', 'not an indicator', 'example.com'] }));
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
  const names = ['ipinfo', 'rdap', 'ripestat', 'dshield', 'spamhaus-drop', 'tor-exit', 'feodo-tracker', 'threatminer', 'misp-circl-osint', 'misp-botvrij-osint', 'greynoise'];
  const adapters = names.map(name => adapter(name));
  const target = createApp({ env: { CTI_GATEWAY_TOKEN: 'secret' }, adapters, batchProviderCallLimit: 2 });
  const result = await target.handleBatch(request({ indicators: ['192.0.2.1', '192.0.2.2', '192.0.2.3'] }));
  assert.equal(result.status, 200);
  assert.equal(result.body.budget.providerCallLimit, 2);
  assert.equal(result.body.budget.providerCalls <= 2, true);
  assert.equal(result.body.results.some(item => item.status === 'skipped' && item.reason === 'batch_provider_call_budget_exhausted'), true);
});

test('batch charges the full reservation when enrichment throws and consumption is unknowable', async () => {
  const started = [];
  const result = await runBatch({
    indicators: ['192.0.2.1', '192.0.2.2'],
    classify: value => ({ type: 'ip', value }),
    callLimitFor: () => 2,
    providerCallLimit: 2,
    indicatorConcurrency: 1,
    enrichOne: async classified => {
      started.push(classified.value);
      if (classified.value === '192.0.2.1') throw new Error('unknown consumption');
      return { status: 'ok', budget: { providerCalls: 1 } };
    },
  });

  assert.deepEqual(started, ['192.0.2.1']);
  assert.equal(result.budget.providerCalls, 2);
  assert.equal(result.budget.providerCalls <= result.budget.providerCallLimit, true);
  assert.equal(result.results[0].status, 'error');
  assert.equal(result.results[0].reason, 'batch_enrichment_error');
  assert.equal(result.results[1].status, 'skipped');
  assert.equal(result.results[1].reason, 'batch_provider_call_budget_exhausted');
});

test('batch deadline exhaustion is explicit', async () => {
  let clock = 0;
  const target = createApp({ env: { CTI_GATEWAY_TOKEN: 'secret' }, adapters: [adapter()], nowMs: () => { clock += 10; return clock; }, batchDeadlineMs: 5 });
  const result = await target.handleBatch(request({ indicators: ['192.0.2.1', '192.0.2.2'] }));
  assert.equal(result.status, 200);
  assert.equal(result.body.budget.deadlineMs, 5);
  assert.equal(result.body.budget.deadlineExhausted, true);
  assert.equal(result.body.results.every(item => item.status === 'skipped' && item.reason === 'batch_deadline_exhausted'), true);
});
