import assert from 'node:assert/strict';
import test from 'node:test';

import { createBrowserShellExecutor } from '../app/shell-browser-executor.js';
import { COMMAND_REGISTRY } from '../app/shell-core/catalog.js';
import { parseShellLine } from '../app/shell-core/parser.js';
import { executePipeline } from '../app/shell-core/runtime.js';
import { makeAudio, makeClient, makeEnvelope, makeSession } from './helpers/shell-v9-fixtures.mjs';

async function runLine(line, { client = makeClient(), authenticated = true, initialState = {} } = {}) {
  const executor = createBrowserShellExecutor({
    client,
    session: makeSession({ authenticated }),
    cases: null,
    downloads: { save: () => {} },
    clipboard: { writeText: async () => {} },
    audio: makeAudio(),
    monotonicNow: () => 0,
    version: '2.0.0',
    initialState,
  });
  const value = await executePipeline(parseShellLine(line), {
    registry: COMMAND_REGISTRY,
    executor,
    context: { surface: 'web', authenticated, capabilities: new Set(['gateway-read', 'provider-read']), profile: 'standard' },
  });
  return { value, executor };
}

const providerMeta = {
  gatewayVersion: '2.0.0',
  profiles: ['fast', 'standard', 'full'],
  limits: {},
  providers: {
    virustotal: { types: ['ip', 'domain', 'url', 'hash'], observationTypes: ['reputation'], requiresCredential: true, costClass: 'quota', tier: 2, active: true },
    greynoise: { types: ['ip'], observationTypes: ['scanner_context'], requiresCredential: true, costClass: 'quota', tier: 2, active: true },
    rdap: { types: ['ip', 'asn', 'cidr'], observationTypes: ['registration'], requiresCredential: false, costClass: 'free', tier: 1, active: true },
  },
};

test('direct provider aliases execute exactly one named provider and become current result', async () => {
  const calls = [];
  const result = makeEnvelope('example.com');
  result.type = 'domain';
  const { value, executor } = await runLine('vt example.com', {
    client: makeClient({ provider: async (...args) => { calls.push(args); return result; } }),
  });
  assert.equal(value.type, 'enrichment');
  assert.equal(value.value, result);
  assert.deepEqual(calls[0].slice(0, 2), ['virustotal', 'example.com']);
  assert.equal(calls.length, 1);
  assert.equal(executor.state().currentResult, result);
});

test('generic provider run uses the same bounded client operation', async () => {
  const calls = [];
  const result = makeEnvelope('8.8.8.8');
  const { value } = await runLine('provider run greynoise 8.8.8.8', {
    client: makeClient({ provider: async (...args) => { calls.push(args); return result; } }),
  });
  assert.equal(value.type, 'enrichment');
  assert.deepEqual(calls[0].slice(0, 2), ['greynoise', '8.8.8.8']);
});

test('typed intel front doors reject mismatched observable types before gateway work', async () => {
  let enrichCalls = 0;
  const client = makeClient({ enrich: async () => { enrichCalls += 1; return makeEnvelope(); } });
  await assert.rejects(
    () => runLine('intel ip example.com', { client }),
    error => error.code === 'INVALID_ARGUMENT',
  );
  assert.equal(enrichCalls, 0);
});

test('normalize type and validate are pure browser observable operations', async () => {
  assert.deepEqual((await runLine('normalize EXAMPLE.COM')).value, { type: 'record', value: { type: 'domain', value: 'example.com' } });
  assert.deepEqual((await runLine('type CVE-2026-12345')).value, { type: 'scalar', value: 'cve' });
  assert.deepEqual((await runLine('validate 8.8.8.8')).value, { type: 'record', value: { valid: true, type: 'ip', value: '8.8.8.8' } });
  await assert.rejects(() => runLine('validate not-an-observable'), error => error.code === 'INVALID_ARGUMENT');
});

test('provider discovery projects public meta and authenticated provider status', async () => {
  const client = makeClient({
    meta: async () => providerMeta,
    status: async () => ({ providers: { virustotal: { configured: true, auth: 'secret', parserVersion: '3', active: true } } }),
  });
  const list = (await runLine('provider list', { client })).value;
  assert.equal(list.type, 'records');
  assert.deepEqual(list.value.map(item => item.name), ['greynoise', 'rdap', 'virustotal']);

  const show = (await runLine('provider show virustotal', { client })).value;
  assert.equal(show.type, 'record');
  assert.equal(show.value.name, 'virustotal');
  assert.equal(show.value.costClass, 'quota');

  const coverage = (await runLine('provider coverage ip', { client })).value;
  assert.deepEqual(coverage.value.map(item => item.name), ['greynoise', 'rdap', 'virustotal']);

  const status = (await runLine('provider status virustotal', { client })).value;
  assert.deepEqual(status, { type: 'records', value: [{ name: 'virustotal', configured: true, auth: 'secret', parserVersion: '3', active: true }] });
});

test('provider probe remains unavailable on the browser surface before execution', async () => {
  let calls = 0;
  await assert.rejects(
    () => runLine('provider probe virustotal', { client: makeClient({ provider: async () => { calls += 1; return makeEnvelope(); } }) }),
    error => error.code === 'SURFACE_UNAVAILABLE',
  );
  assert.equal(calls, 0);
});
