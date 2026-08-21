import test from 'node:test';
import assert from 'node:assert/strict';
import { createTelemetry } from '../src/core/telemetry.js';

const SECRET = 'super-secret-api-key';

test('telemetry allowlists operational fields and strips raw indicators and arbitrary values by default', () => {
  const events = [];
  const telemetry = createTelemetry({ sink: event => events.push(event) });
  telemetry.emit({ event: 'provider_complete', requestId: 'r1', type: 'domain', provider: 'rdap', status: 'ok', durationMs: 12, indicator: 'evil.example', apiKey: SECRET, authorization: `Bearer ${SECRET}`, random: 'drop-me' });
  assert.deepEqual(events, [{ event: 'provider_complete', requestId: 'r1', type: 'domain', provider: 'rdap', status: 'ok', durationMs: 12 }]);
  assert.equal(JSON.stringify(events).includes('evil.example'), false);
  assert.equal(JSON.stringify(events).includes(SECRET), false);
});

test('indicator logging requires explicitly injected local debug mode', () => {
  const events = [];
  const telemetry = createTelemetry({ sink: event => events.push(event), includeIndicator: true });
  telemetry.emit({ event: 'request_start', requestId: 'r1', type: 'ip', indicator: '192.0.2.44', status: 'start' });
  assert.equal(events[0].indicator, '192.0.2.44');
});

test('sink failure cannot break enrichment and stats remain aggregate-only', () => {
  const telemetry = createTelemetry({ sink: () => { throw new Error('sink down'); } });
  assert.doesNotThrow(() => telemetry.emit({ event: 'request_start', requestId: 'r1', type: 'ip', indicator: '192.0.2.44' }));
  telemetry.emit({ event: 'provider_complete', requestId: 'r1', provider: 'rdap', type: 'ip', status: 'ok', durationMs: 3 });
  const stats = telemetry.stats();
  assert.equal(stats.events, 2);
  assert.equal(stats.sinkErrors, 2);
  assert.deepEqual(Object.keys(stats).sort(), ['byEvent', 'byProvider', 'byStatus', 'events', 'sinkErrors']);
  assert.equal(JSON.stringify(stats).includes('192.0.2.44'), false);
});

test('numeric telemetry fields are bounded and malformed values are omitted', () => {
  const events = [];
  const telemetry = createTelemetry({ sink: event => events.push(event) });
  telemetry.emit({ event: 'budget', durationMs: -5, providerCalls: 9999999, providerCallLimit: 25, deadlineMs: 20000, status: 'partial' });
  assert.equal(events[0].durationMs, undefined);
  assert.equal(events[0].providerCalls, 1_000_000);
  assert.equal(events[0].providerCallLimit, 25);
  assert.equal(events[0].deadlineMs, 20000);
});

test('stats aggregate provider and status counts deterministically without retaining secrets', () => {
  const telemetry = createTelemetry();
  telemetry.emit({ event: 'provider_complete', provider: 'modat', status: 'ok', indicator: '198.51.100.10', authorization: `Bearer ${SECRET}` });
  telemetry.emit({ event: 'provider_complete', provider: 'modat', status: 'error', reason: 'rate_limited' });
  telemetry.emit({ event: 'provider_complete', provider: 'rdap', status: 'ok' });
  telemetry.emit({ event: 'request_complete', status: 'partial' });

  const stats = telemetry.stats();
  assert.deepEqual(stats.byProvider, { modat: 2, rdap: 1 });
  assert.deepEqual(stats.byStatus, { error: 1, ok: 2, partial: 1 });
  const serialized = JSON.stringify(stats);
  assert.equal(serialized.includes('198.51.100.10'), false);
  assert.equal(serialized.includes(SECRET), false);
});
