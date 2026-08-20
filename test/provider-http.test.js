import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchJson } from '../src/core/fetch-json.js';

function response(body, { status = 200, headers = {} } = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
}

test('fetchJson forwards method headers body and redirect policy', async () => {
  let captured;
  const fetchImpl = async (url, init) => {
    captured = { url, init };
    return response({ ok: true });
  };

  const data = await fetchJson('https://example.invalid/query', {
    fetchImpl,
    method: 'POST',
    headers: { 'x-test': 'yes', accept: 'application/vnd.test+json' },
    body: JSON.stringify({ query: 'x' }),
    redirect: 'error',
  });

  assert.deepEqual(data, { ok: true });
  assert.equal(captured.init.method, 'POST');
  assert.equal(captured.init.headers['x-test'], 'yes');
  assert.equal(captured.init.headers.accept, 'application/vnd.test+json');
  assert.equal(captured.init.body, JSON.stringify({ query: 'x' }));
  assert.equal(captured.init.redirect, 'error');
});

test('fetchJson exposes retry-after on HTTP errors without response bodies', async () => {
  const fetchImpl = async () => new Response('', { status: 429, headers: { 'retry-after': '60' } });
  await assert.rejects(
    fetchJson('https://example.invalid/query', { fetchImpl }),
    error => error.status === 429 && error.retryAfter === '60',
  );
});
