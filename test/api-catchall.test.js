import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/para11ax/[...path].js';

function fakeResponse() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; },
    end(value) { this.body = value; },
  };
}

test('unknown API routes fail closed as JSON by default', async () => {
  const req = { method: 'GET', headers: { accept: 'application/json' }, url: '/api/para11ax/nope' };
  const res = fakeResponse();
  await handler(req, res);
  assert.equal(res.statusCode, 404);
  assert.equal(res.headers['cache-control'], 'no-store');
  assert.equal(res.headers['content-type'], 'application/json; charset=utf-8');
  const body = JSON.parse(res.body);
  assert.equal(body.error, 'not_found');
  assert.match(body.requestId, /^[0-9a-f-]{36}$/i);
});

test('unknown API routes render the branded 404 for browser clients', async () => {
  const req = { method: 'GET', headers: { accept: 'text/html' }, url: '/api/para11ax/nope' };
  const res = fakeResponse();
  await handler(req, res);
  assert.equal(res.statusCode, 404);
  assert.equal(res.headers['content-type'], 'text/html; charset=utf-8');
  assert.match(res.body, /ROUTE NOT FOUND/);
  assert.match(res.body, /FAIL CLOSED/);
});
