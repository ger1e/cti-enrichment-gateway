import assert from 'node:assert/strict';
import test from 'node:test';
import { createAudioEngine } from '../app/audio.js';

class FakeParam {
  constructor() { this.events = []; }
  setValueAtTime(value, time) { this.events.push(['set', value, time]); }
  linearRampToValueAtTime(value, time) { this.events.push(['ramp', value, time]); }
}

class FakeGain {
  constructor() {
    this.gain = {
      setValueAtTime() {},
      linearRampToValueAtTime() {},
      exponentialRampToValueAtTime() {},
    };
  }
  connect() { return this; }
}

class FakeOscillator {
  constructor() {
    this.frequency = new FakeParam();
    this.type = 'sine';
    this.startedAt = null;
    this.stoppedAt = null;
    this.onended = null;
  }
  connect(node) { return node; }
  start(time) { this.startedAt = time; }
  stop(time) { this.stoppedAt = time; }
}

class FakeAudioContext {
  constructor() {
    this.state = 'running';
    this.currentTime = 10;
    this.destination = {};
    this.oscillators = [];
    FakeAudioContext.instance = this;
  }
  createOscillator() {
    const oscillator = new FakeOscillator();
    this.oscillators.push(oscillator);
    return oscillator;
  }
  createGain() { return new FakeGain(); }
  async resume() { this.state = 'running'; }
}

const closeTo = (actual, expected, epsilon = 1e-9) => {
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);
};

test('backspace uses a sharp CRT erase click followed by a muted low thunk', async () => {
  const engine = createAudioEngine({ AudioContextCtor: FakeAudioContext, now: () => 100 });
  await engine.enable();
  engine.typing('backspace');

  const { oscillators } = FakeAudioContext.instance;
  assert.equal(oscillators.length, 2);

  const [click, thunk] = oscillators;
  assert.equal(click.type, 'square');
  assert.deepEqual(click.frequency.events.map(([kind, value]) => [kind, value]), [
    ['set', 1250],
    ['ramp', 720],
  ]);
  closeTo(click.startedAt, 10);
  closeTo(click.stoppedAt, 10.034);

  assert.equal(thunk.type, 'triangle');
  assert.deepEqual(thunk.frequency.events.map(([kind, value]) => [kind, value]), [
    ['set', 180],
    ['ramp', 95],
  ]);
  closeTo(thunk.startedAt, 10.01728);
  closeTo(thunk.stoppedAt, 10.04328);
});
