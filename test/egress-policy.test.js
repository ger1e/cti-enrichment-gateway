import test from 'node:test';
import assert from 'node:assert/strict';
import { safeFetch } from '../src/core/egress.js';

function response(body = '{}', { status = 200, headers = {} } = {}) {
  return new Response(body, { status, headers });
}

const policy = Object.freeze({
  fixedHosts: ['api.example.test'],
  methods: ['GET'],
  maxResponseBytes: 64,
  protocols: ['https:'],
});

test('safeFetch refuses off-manifest hosts before network access', async () => {
  let calls = 0;
  await assert.rejects(
    safeFetch('https://evil.example/x', policy, { fetchImpl: async () => { calls += 1; return response(); } }),
    /egress_host_not_allowed/,
  );
  assert.equal(calls, 0);
});

test('safeFetch refuses protocol drift and undeclared methods', async () => {
  const fetchImpl = async () => response();
  await assert.rejects(safeFetch('http://api.example.test/x', policy, { fetchImpl }), /egress_protocol_not_allowed/);
  await assert.rejects(safeFetch('https://api.example.test/x', policy, { fetchImpl, method: 'POST' }), /egress_method_not_allowed/);
});

test('safeFetch enforces redirect error and body ceilings', async () => {
  let seen;
  const fetchImpl = async (_url, options) => {
    seen = options;
    return response('x'.repeat(65));
  };
  await assert.rejects(safeFetch('https://api.example.test/x', policy, { fetchImpl }), /provider_response_too_large/);
  assert.equal(seen.redirect, 'error');
});

test('safeFetch rejects oversized declared content length without reading body', async () => {
  let read = false;
  const fetchImpl = async () => ({
    ok: true,
    status: 200,
    headers: new Headers({ 'content-length': '65' }),
    text: async () => { read = true; return ''; },
  });
  await assert.rejects(safeFetch('https://api.example.test/x', policy, { fetchImpl }), /provider_response_too_large/);
  assert.equal(read, false);
});

test('safeFetch does not reflect credential-bearing URLs in errors', async () => {
  const fetchImpl = async () => { throw new Error('network exploded'); };
  const target = 'https://api.example.test/x?api_key=super-secret&token=also-secret';
  await assert.rejects(
    safeFetch(target, policy, { fetchImpl }),
    error => {
      assert.equal(error.message.includes('super-secret'), false);
      assert.equal(error.message.includes('also-secret'), false);
      assert.equal(error.message.includes(target), false);
      return true;
    },
  );
});

test('safeFetch preserves normalized HTTP status and retry-after', async () => {
  const fetchImpl = async () => response('nope', { status: 429, headers: { 'retry-after': '7' } });
  await assert.rejects(
    safeFetch('https://api.example.test/x', policy, { fetchImpl }),
    error => {
      assert.equal(error.status, 429);
      assert.equal(error.retryAfter, '7');
      return true;
    },
  );
});
