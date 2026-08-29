import test from 'node:test';
import assert from 'node:assert/strict';
import { createCaseRuntime } from '../app/case-runtime.js';

const NOW = new Date('2026-08-29T12:00:00.000Z');
const OLD = '2026-08-28T10:00:00.000Z';
const clone = value => structuredClone(value);

function caseValue(id, pins = []) {
  return { schemaVersion: '1.0', id, title: id, createdAt: OLD, updatedAt: OLD, notes: [], pins, snapshots: [], diffs: [] };
}

function enrichment() {
  return {
    schemaVersion: '2.0', gatewayVersion: '2.0.0', requestId: 'refresh-1', queriedAt: NOW.toISOString(), durationMs: 1,
    indicator: '203.0.113.7', type: 'ip', status: 'ok', profile: 'standard', evidence: [], relationships: [], failures: [],
    coverage: { selected: 0, executed: 0, succeeded: 0, failed: 0, skipped: 0, materialLoss: false }, limitations: [],
    correlation: { contradictions: [], freshness: { overall: 'current' }, evidenceQuality: { level: 'low' }, huntability: { level: 'low' } },
    decision: { disposition: 'monitor', confidence: 'low', reasons: [], telemetry: null, attackMappings: [], huntPlan: [] }, meta: { providerHealth: {} },
  };
}

test('refresh keeps writing to the case it started from even if active case changes mid-flight', async () => {
  const values = new Map([
    ['case-a', caseValue('case-a', [{ type: 'ip', value: '203.0.113.7', addedAt: OLD }])],
    ['case-b', caseValue('case-b')],
  ]);
  const captureIds = [];
  const cases = {
    async get(id) { return values.has(id) ? clone(values.get(id)) : null; },
    async capture(id) { captureIds.push(id); return clone(values.get(id)); },
    async list() { return [...values.values()].map(clone); },
  };

  let releaseBatch;
  let markStarted;
  const started = new Promise(resolve => { markStarted = resolve; });
  const client = {
    async batch(indicators, profile) {
      markStarted();
      await new Promise(resolve => { releaseBatch = resolve; });
      return {
        requestId: 'batch-1', profile, inputCount: indicators.length, uniqueIndicators: indicators.length,
        results: [{ index: 0, input: indicators[0], canonical: '203.0.113.7', type: 'ip', status: 'ok', enrichment: enrichment() }],
      };
    },
  };

  const runtime = createCaseRuntime({ cases, client, now: () => NOW });
  await runtime.handle({ action: 'case-open', caseId: 'case-a' });
  const refreshing = runtime.handle({ action: 'case-refresh', staleOnly: false }, { profile: 'standard' });
  await started;
  await runtime.handle({ action: 'case-open', caseId: 'case-b' });
  releaseBatch();
  await refreshing;

  assert.deepEqual(captureIds, ['case-a']);
  assert.equal(runtime.state().activeCaseId, 'case-b');
});
