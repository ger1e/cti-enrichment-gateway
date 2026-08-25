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

test('typing, erase, enter and paste cues are distinct while bearer typing stays silent', async () => {
  let clock = 1000;
  const audio = createAudioEngine({ AudioContextCtor: FakeAudioContext, now: () => clock });
  await audio.enable();
  const start = audio.state().emitted;
  audio.typing('token');
  assert.equal(audio.state().emitted, start);
  audio.typing('character');
  assert.equal(audio.state().lastCue, 'key');
  const afterCharacter = audio.state().emitted;
  audio.typing('character');
  assert.equal(audio.state().emitted, afterCharacter, 'held/repeated typing is throttled');
  clock += 60;
  audio.typing('backspace');
  assert.equal(audio.state().lastCue, 'key-backspace');
  clock += 60;
  audio.typing('enter');
  assert.equal(audio.state().lastCue, 'key-enter');
  clock += 60;
  audio.typing('paste');
  assert.equal(audio.state().lastCue, 'paste');
});

test('mute and volume are bounded', async () => {
  const audio = createAudioEngine({ AudioContextCtor: FakeAudioContext }); await audio.enable();
  audio.setVolume(5); assert.equal(audio.state().volume, 1); audio.setVolume(-1); assert.equal(audio.state().volume, 0);
  audio.setVolume(.35); audio.mute(true); const before = audio.state().emitted; audio.play('scan'); assert.equal(audio.state().emitted, before);
});

test('unknown cues are rejected', async () => {
  const audio = createAudioEngine({ AudioContextCtor: FakeAudioContext }); await audio.enable();
  assert.throws(() => audio.play('ioc-derived-frequency'), /unknown cue/i);
});

test('JSON serialization is exact', async () => {
  const { serializeJson } = await import('../app/app.js');
  const value = { status: 'partial', evidence: [{ provider: 'x' }] };
  assert.deepEqual(JSON.parse(serializeJson(value)), value);
});

test('hostile terminal boot runs modem then Pepe then dense POST and ready cue once', async () => {
  const { createBootSequence, POST_LINES } = await import('../app/app.js');
  assert.ok(Array.isArray(POST_LINES));
  assert.ok(POST_LINES.length >= 30, 'POST should feel like a real module wall');
  assert.match(POST_LINES.at(-2), /LOCAL MODULE SELF-TEST.*\[ PASS \]/);
  assert.match(POST_LINES.at(-1), /PARA11AX TERMINAL.*\[ READY \]/);
  const stages = [];
  const cues = [];
  const sleeps = [];
  let enables = 0;
  const boot = createBootSequence({
    audio: { enable: async () => { enables += 1; }, play: (name) => cues.push(name) },
    sleep: async (ms) => { sleeps.push(ms); },
    onStage: (name, payload) => stages.push([name, payload]),
  });
  assert.equal(await boot.start(), true);
  assert.equal(await boot.start(), false);
  assert.equal(enables, 1);
  assert.deepEqual(cues, ['boot-power', 'modem-56k', 'boot-lock', 'boot-ready']);
  assert.deepEqual(stages.slice(0, 3).map(([name]) => name), ['power', 'modem', 'pepe']);
  assert.equal(stages.filter(([name]) => name === 'post-line').length, POST_LINES.length);
  assert.equal(stages.at(-1)[0], 'ready');
  assert.ok(sleeps.some((ms) => ms >= 2500), '56k handshake must occupy a real boot beat');
  assert.ok(sleeps.some((ms) => ms >= 500 && ms <= 900), 'Pepe gets a brief firmware Easter-egg beat');
  assert.deepEqual(boot.state(), { started: true, done: true, skipped: false });
});

test('boot skip unlocks audio and finishes immediately without modem wait', async () => {
  const { createBootSequence } = await import('../app/app.js');
  const stages = [];
  const cues = [];
  let enables = 0;
  const boot = createBootSequence({
    audio: { enable: async () => { enables += 1; }, play: (name) => cues.push(name) },
    sleep: async () => { throw new Error('skip must not wait'); },
    onStage: (name) => stages.push(name),
  });
  assert.equal(await boot.skip(), true);
  assert.equal(await boot.skip(), false);
  assert.equal(enables, 1);
  assert.deepEqual(cues, ['boot-ready']);
  assert.deepEqual(stages, ['ready']);
  assert.deepEqual(boot.state(), { started: true, done: true, skipped: true });
});

test('skip during active modem cuts scheduled audio and advances directly to ready', async () => {
  const { createBootSequence } = await import('../app/app.js');
  const stages = [];
  const cues = [];
  let stopCalls = 0;
  let releaseModem;
  const boot = createBootSequence({
    audio: {
      enable: async () => {},
      play: (name) => cues.push(name),
      stopAll: () => { stopCalls += 1; },
    },
    sleep: async (ms) => {
      if (ms >= 2500) await new Promise((resolve) => { releaseModem = resolve; });
    },
    onStage: (name) => stages.push(name),
  });
  const starting = boot.start();
  while (!stages.includes('modem')) await Promise.resolve();
  assert.equal(await boot.skip(), true);
  assert.equal(stopCalls, 1);
  assert.deepEqual(cues, ['boot-power', 'modem-56k', 'boot-ready']);
  assert.equal(stages.at(-1), 'ready');
  releaseModem();
  await starting;
  assert.deepEqual(boot.state(), { started: true, done: true, skipped: true });
});

test('audio stopAll cancels scheduled modem tones', async () => {
  const audio = createAudioEngine({ AudioContextCtor: FakeAudioContext });
  await audio.enable();
  audio.play('modem-56k');
  assert.ok(audio.state().active > 0);
  audio.stopAll();
  assert.equal(audio.state().active, 0);
});

test('reduced-motion boot keeps a short static initialization and ready cue', async () => {
  const { createBootSequence } = await import('../app/app.js');
  const stages = [];
  const sleeps = [];
  const cues = [];
  const boot = createBootSequence({
    reducedMotion: true,
    audio: { enable: async () => {}, play: (name) => cues.push(name) },
    sleep: async (ms) => sleeps.push(ms),
    onStage: (name) => stages.push(name),
  });
  assert.equal(await boot.start(), true);
  assert.deepEqual(sleeps, [300]);
  assert.deepEqual(stages, ['reduced', 'ready']);
  assert.deepEqual(cues, ['boot-ready']);
});

test('boot and terminal audio cues are fixed synthesized recipes', async () => {
  const audio = createAudioEngine({ AudioContextCtor: FakeAudioContext });
  await audio.enable();
  const before = audio.state().emitted;
  for (const cue of ['boot-power', 'modem-56k', 'boot-lock', 'boot-ready', 'key', 'key-backspace', 'key-enter', 'paste']) audio.play(cue);
  assert.equal(audio.state().emitted, before + 8);
});
