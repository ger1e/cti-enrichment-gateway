import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp, renderHttpError } from '../src/app.js';
import { createTelemetry } from '../src/core/telemetry.js';

function request(accept) {
  return { method: 'GET', headers: accept == null ? {} : { accept } };
}

test('error content negotiation honors q-values and prefers JSON on ties or explicit HTML rejection', () => {
  const cases = [
    ['text/html;q=0, application/json;q=1', 'application/json; charset=utf-8'],
    ['text/html;q=0.4, application/json;q=0.9', 'application/json; charset=utf-8'],
    ['application/json;q=0.4, text/html;q=0.9', 'text/html; charset=utf-8'],
    ['text/html;q=1, application/json;q=1', 'application/json; charset=utf-8'],
    ['text/html;q=0.9, */*;q=1', 'application/json; charset=utf-8'],
    ['text/html, application/xhtml+xml, */*;q=0.8', 'text/html; charset=utf-8'],
  ];
  for (const [accept, expected] of cases) {
    const result = renderHttpError(request(accept), 403, 'forbidden');
    assert.equal(result.headers['content-type'], expected, accept);
  }
});

test('unexpected handler failures emit correlation-safe telemetry without exception or indicator leakage', async () => {
  const secretMarker = 'TOP-SECRET-EXCEPTION-MARKER';
  const events = [];
  const telemetry = createTelemetry({ sink: event => events.push(event) });
  const cache = {
    get() { throw new Error(secretMarker); },
    stats() { return { entries: 0, inflight: 0, hits: 0, misses: 0, evictions: 0, expirations: 0 }; },
  };
  const env = { CTI_GATEWAY_TOKEN: 'gateway-test-token' };
  const app = createApp({ env, cache, telemetry });
  const result = await app.handleEnrich({
    method: 'POST',
    headers: {
      accept: 'application/json',
      authorization: `Bearer ${env.CTI_GATEWAY_TOKEN}`,
      'content-type': 'application/json',
    },
    body: { indicator: '8.8.8.8' },
  });

  assert.equal(result.status, 500);
  assert.equal(result.body.error, 'internal_error');
  const failure = events.find(event => event.event === 'handler_error');
  assert.ok(failure, 'expected bounded handler_error telemetry');
  assert.equal(failure.requestId, result.body.requestId);
  assert.equal(failure.status, 'failure');
  assert.equal(failure.reason, 'enrich');
  const serialized = JSON.stringify({ result, events });
  assert.equal(serialized.includes(secretMarker), false);
  assert.equal(serialized.includes('8.8.8.8'), false);
});
