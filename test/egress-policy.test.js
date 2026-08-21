import test from 'node:test';
import assert from 'node:assert/strict';
import { safeFetch } from '../src/core/egress.js';

function response(body = '{}', { status = 200, headers = {} } = {}) {
  return new Response(body, { status, headers });
}

function streamedResponse(chunks, { status = 200, headers = {}, onCancel = () => {} } = {}) {
  let index = 0;
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: '',
    headers: new Headers(headers),
    body: new ReadableStream({
      pull(controller) {
        if (index >= chunks.length) {
          controller.close();
          return;
        }
        controller.enqueue(Uint8Array.from(chunks[index]));
        index += 1;
      },
      cancel() { onCancel(); },
    }),
  };
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

test('safeFetch stops a chunked body as soon as the response ceiling is exceeded', async () => {
  let cancelled = false;
  const chunks = [Buffer.from('a'.repeat(40)), Buffer.from('b'.repeat(40)), Buffer.from('c'.repeat(40))];
  const fetchImpl = async () => streamedResponse(chunks, { onCancel: () => { cancelled = true; } });
  await assert.rejects(safeFetch('https://api.example.test/x', policy, { fetchImpl }), /provider_response_too_large/);
  assert.equal(cancelled, true);
});

test('safeFetch accepts a streamed response exactly at the byte ceiling', async () => {
  const fetchImpl = async () => streamedResponse([Buffer.from('x'.repeat(64))]);
  const result = await safeFetch('https://api.example.test/x', policy, { fetchImpl });
  assert.equal(await result.text(), 'x'.repeat(64));
});

test('safeFetch bounds streamed UTF-8 by bytes rather than JavaScript characters', async () => {
  const bytes = Buffer.from('€'.repeat(22), 'utf8');
  assert.equal(bytes.byteLength, 66);
  const fetchImpl = async () => streamedResponse([bytes]);
  await assert.rejects(safeFetch('https://api.example.test/x', policy, { fetchImpl }), /provider_response_too_large/);
});

test('safeFetch does not trust an undersized content length over streamed bytes', async () => {
  const fetchImpl = async () => streamedResponse(
    [Buffer.from('x'.repeat(40)), Buffer.from('y'.repeat(40))],
    { headers: { 'content-length': '10' } },
  );
  await assert.rejects(safeFetch('https://api.example.test/x', policy, { fetchImpl }), /provider_response_too_large/);
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
