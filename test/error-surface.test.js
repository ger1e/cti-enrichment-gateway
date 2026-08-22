import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp, renderHttpError, writeVercelResponse } from '../src/app.js';

const env = { CTI_GATEWAY_TOKEN: 'gateway-secret-value' };

function req({ method = 'POST', auth = false, accept = 'application/json', body = { indicator: '8.8.8.8' }, headers = {} } = {}) {
  return {
    method,
    headers: {
      accept,
      ...(auth ? { authorization: `Bearer ${env.CTI_GATEWAY_TOKEN}` } : {}),
      ...headers,
    },
    body,
  };
}

function fakeResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: undefined,
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; },
    end(value) { this.body = value; },
  };
}

test('API clients retain deterministic JSON errors with a bounded correlation id', async () => {
  const app = createApp({ env });
  const result = await app.handleEnrich(req());
  assert.equal(result.status, 401);
  assert.equal(result.body.error, 'unauthorized');
  assert.match(result.body.requestId, /^[0-9a-f-]{36}$/i);
  assert.equal(result.headers['cache-control'], 'no-store');
  assert.equal(result.headers['content-type'], 'application/json; charset=utf-8');
  assert.equal(JSON.stringify(result).includes(env.CTI_GATEWAY_TOKEN), false);
});

test('browser clients receive branded HTML for the same 401 without changing status semantics', async () => {
  const app = createApp({ env });
  const result = await app.handleEnrich(req({ accept: 'text/html,application/xhtml+xml' }));
  assert.equal(result.status, 401);
  assert.equal(result.headers['content-type'], 'text/html; charset=utf-8');
  assert.equal(result.headers['cache-control'], 'no-store');
  assert.match(result.body, /401/);
  assert.match(result.body, /AUTHENTICATION REQUIRED/);
  assert.match(result.body, /REQUEST ID/i);
  assert.match(result.body, /\/api\/meta/);
  assert.equal(result.body.includes(env.CTI_GATEWAY_TOKEN), false);
});

test('renderer supports the hardened error status catalogue and never reflects unsafe detail', () => {
  const statuses = [400, 401, 403, 404, 405, 408, 413, 415, 422, 429, 500, 502, 503, 504];
  for (const status of statuses) {
    const result = renderHttpError(req({ accept: 'text/html' }), status, undefined, {
      unsafeDetail: '<script>alert(1)</script>',
      headers: status === 405 ? { allow: 'POST' } : {},
    });
    assert.equal(result.status, status);
    assert.equal(result.headers['cache-control'], 'no-store');
    assert.equal(result.headers['content-type'], 'text/html; charset=utf-8');
    assert.equal(result.body.includes('<script>alert(1)</script>'), false);
    assert.equal(result.body.includes('gateway-secret-value'), false);
    assert.match(result.body, new RegExp(String(status)));
  }
});

test('wildcard and absent Accept headers remain JSON-safe for CLI and Maltego callers', () => {
  for (const accept of ['*/*', undefined]) {
    const request = { method: 'GET', headers: accept ? { accept } : {} };
    const result = renderHttpError(request, 403, 'forbidden');
    assert.deepEqual(Object.keys(result.body).sort(), ['error', 'requestId']);
    assert.equal(result.body.error, 'forbidden');
    assert.equal(result.headers['content-type'], 'application/json; charset=utf-8');
  }
});

test('writeVercelResponse emits HTML raw and JSON encoded without content confusion', () => {
  const htmlResult = renderHttpError(req({ accept: 'text/html' }), 404, 'not_found');
  const htmlRes = fakeResponse();
  writeVercelResponse(htmlRes, htmlResult);
  assert.equal(htmlRes.statusCode, 404);
  assert.equal(htmlRes.headers['content-type'], 'text/html; charset=utf-8');
  assert.match(htmlRes.body, /^<!doctype html>/i);

  const jsonResult = renderHttpError(req({ accept: 'application/json' }), 404, 'not_found');
  const jsonRes = fakeResponse();
  writeVercelResponse(jsonRes, jsonResult);
  assert.equal(jsonRes.statusCode, 404);
  assert.equal(jsonRes.headers['content-type'], 'application/json; charset=utf-8');
  assert.deepEqual(JSON.parse(jsonRes.body).error, 'not_found');
});
