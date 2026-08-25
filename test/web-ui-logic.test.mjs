import assert from 'node:assert/strict';
import test from 'node:test';
import { createGatewayClient, GatewayHttpError } from '../app/api-client.js';
import { createSession } from '../app/session.js';
import { buildOverview, buildEvidence, buildCorrelation, buildCoverage, jsonLines } from '../app/view-model.js';
import { createAudioEngine } from '../app/audio.js';

const jsonResponse = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

test('gateway client uses relative same-origin bearer request', async () => {
  const calls = [];
  const client = createGatewayClient({ getToken: () => 'secret-token', fetchImpl: async (url, init) => { calls.push({ url, init }); return jsonResponse(200, { ready: true }); } });
  assert.deepEqual(await client.health(), { ready: true });
  assert.equal(calls[0].url, '/api/health');
  assert.equal(calls[0].init.credentials, 'same-origin');
  assert.equal(calls[0].init.headers.Authorization, 'Bearer secret-token');
});

test('enrich sends only indicator and fixed profile', async () => {
  let sent;
  const client = createGatewayClient({
    getToken: () => 't',
    fetchImpl: async (_url, init) => { sent = JSON.parse(init.body); return jsonResponse(200, { requestId: 'r', indicator: 'example.org', type: 'domain', profile: 'standard', status: 'ok', evidence: [], failures: [], relationships: [], correlation: {} }); },
  });
  await client.enrich('example.org', 'standard');
  assert.deepEqual(sent, { indicator: 'example.org', profile: 'standard' });
  await assert.rejects(() => client.enrich('example.org', 'virustotal'), /invalid profile/i);
});

test('malformed enrichment payload fails closed', async () => {
  const client = createGatewayClient({ getToken: () => 't', fetchImpl: async () => jsonResponse(200, { status: 'ok' }) });
  await assert.rejects(() => client.enrich('example.org', 'fast'), (e) => e instanceof GatewayHttpError && e.code === 'invalid_envelope');
});

test('invalid STIX bundle fails closed', async () => {
  const client = createGatewayClient({ getToken: () => 't', fetchImpl: async () => jsonResponse(200, { objects: [] }) });
  await assert.rejects(() => client.stix('example.org', 'fast'), (e) => e instanceof GatewayHttpError && e.code === 'invalid_stix_bundle');
});

test('structured errors never include bearer text', async () => {
  const client = createGatewayClient({ getToken: () => 'never-echo-me', fetchImpl: async () => jsonResponse(401, { error: 'unauthorized', requestId: 'r1' }) });
  await assert.rejects(() => client.health(), (e) => e instanceof GatewayHttpError && e.status === 401 && e.code === 'unauthorized' && !String(e).includes('never-echo-me'));
});

test('session snapshot never exposes token and only one request is active', () => {
  const session = createSession(); session.setToken('shared-bearer'); session.unlock();
  assert.equal(JSON.stringify(session.snapshot()).includes('shared-bearer'), false);
  const first = new AbortController(); session.startRequest(first);
  assert.throws(() => session.startRequest(new AbortController()), /request already active/i);
});

test('disconnect aborts work and clears auth/result state', () => {
  const session = createSession(); session.setToken('t'); session.unlock();
  const controller = new AbortController(); session.startRequest(controller); session.disconnect();
  assert.equal(controller.signal.aborted, true); assert.equal(session.getToken(), null);
  assert.deepEqual(session.snapshot(), { mode: 'locked', result: null, hasToken: false, requestActive: false });
});

const sampleEnvelope = {
  requestId: 'req-1', indicator: 'evil.example', type: 'domain', profile: 'standard', durationMs: 420, status: 'partial',
  providerSummary: { ok: 2, failed: 1, skipped: 0, cached: 1 },
  evidence: [
    { provider: 'rdap', observation: { kind: 'registration', verdict: 'observed' }, references: [] },
    { provider: 'ransomware-live', observation: { kind: 'ransomware_victim_claim', verdict: 'observed' }, references: [] },
  ],
  failures: [{ provider: 'censys', error: 'rate_limited' }], relationships: [],
  correlation: { corroboration: [], contradictions: [{ kind: 'reputation', providers: ['a', 'b'] }], freshness: 'current', huntability: { level: 'high', rationale: 'actionable pivots' }, riskAxes: { kev: { listed: true }, epss: { score: .94 }, cvss: { score: 9.8 } } },
};

test('partial stays incomplete coverage', () => { const model = buildOverview(sampleEnvelope); assert.equal(model.status, 'partial'); assert.equal(model.tone, 'amber'); });
test('context and claims remain distinct', () => { const cards = buildEvidence(sampleEnvelope); assert.equal(cards[0].semanticClass, 'context'); assert.equal(cards[1].semanticClass, 'claim'); assert.match(cards[1].semanticNote, /claim|report/i); });
test('CVE axes stay separate', () => { const model = buildCorrelation(sampleEnvelope); assert.deepEqual(Object.keys(model.riskAxes).sort(), ['cvss', 'epss', 'kev']); assert.equal(model.combinedScore, undefined); });
test('failures stay outside evidence', () => { assert.equal(buildEvidence(sampleEnvelope).some((x) => x.provider === 'censys'), false); assert.equal(buildCoverage(sampleEnvelope).failures[0].provider, 'censys'); });
test('raw lines reconstruct exact object', () => { assert.deepEqual(JSON.parse(jsonLines(sampleEnvelope).map((x) => x.text).join('\n')), sampleEnvelope); });

class FakeParam { setValueAtTime() {} linearRampToValueAtTime() {} exponentialRampToValueAtTime() {} }
class FakeNode { constructor() { this.frequency = new FakeParam(); this.gain = new FakeParam(); } connect() { return this; } start() {} stop() {} }
class FakeAudioContext { constructor() { this.currentTime = 1; this.destination = {}; this.state = 'running'; } createOscillator() { return new FakeNode(); } createGain() { return new FakeNode(); } resume() { return Promise.resolve(); } }

test('audio is user-enabled and token typing is silent', async () => {
  let clock = 1000;
  const audio = createAudioEngine({ AudioContextCtor: FakeAudioContext, now: () => clock });
  assert.equal(audio.state().enabled, false);
  await audio.enable();
  const before = audio.state().emitted;
  audio.typing('token');
  assert.equal(audio.state().emitted, before);
  audio.typing('pivot');
  const once = audio.state().emitted;
  audio.typing('pivot');
  assert.equal(audio.state().emitted, once);
  clock += 60;
  audio.typing('pivot');
  assert.ok(audio.state().emitted > once);
});

test('mute and volume are bounded', async () => {
  const audio = createAudioEngine({ AudioContextCtor: FakeAudioContext });
  await audio.enable();
  audio.setVolume(5); assert.equal(audio.state().volume, 1);
  audio.setVolume(-1); assert.equal(audio.state().volume, 0);
  audio.setVolume(.35); audio.mute(true);
  const before = audio.state().emitted;
  audio.play('scan');
  assert.equal(audio.state().emitted, before);
});

test('unknown cues are rejected', async () => {
  const audio = createAudioEngine({ AudioContextCtor: FakeAudioContext });
  await audio.enable();
  assert.throws(() => audio.play('ioc-derived-frequency'), /unknown cue/i);
});
