import assert from 'node:assert/strict';
import test from 'node:test';

import { createSession } from '../app/session.js';
import { runEnrichmentOperation } from '../app/shell-runtime.js';

function readySession() {
  const session = createSession();
  session.setToken('volatile-test-token');
  session.unlock();
  return session;
}

test('successful shell enrichment finishes the session with the returned result', async () => {
  const session = readySession();
  const result = { requestId: 'r1', indicator: 'example.org', type: 'domain', profile: 'standard', status: 'ok', evidence: [], failures: [], relationships: [], correlation: {} };
  const client = { enrich: async () => result };
  const controller = new AbortController();

  const returned = await runEnrichmentOperation({ session, client, controller, indicator: 'example.org', profile: 'standard' });
  assert.equal(returned, result);
  assert.equal(session.snapshot().mode, 'result');
  assert.equal(session.snapshot().requestActive, false);
});

test('failed shell enrichment restores authenticated session to ready and preserves bearer', async () => {
  const session = readySession();
  const client = { enrich: async () => { throw new Error('upstream failed'); } };
  const controller = new AbortController();

  await assert.rejects(
    () => runEnrichmentOperation({ session, client, controller, indicator: 'example.org', profile: 'standard' }),
    /upstream failed/,
  );
  assert.equal(session.snapshot().mode, 'ready');
  assert.equal(session.snapshot().requestActive, false);
  assert.equal(session.snapshot().hasToken, true);
});
