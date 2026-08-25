import assert from 'node:assert/strict';
import test from 'node:test';

import { createBootSequence, POST_LINES } from '../app/app.js';

test('reduced motion preserves the full boot sequence while CSS suppresses motion', async () => {
  const stages = [];
  const cues = [];
  const sleeps = [];
  const boot = createBootSequence({
    reducedMotion: true,
    audio: { enable: async () => {}, play: (name) => cues.push(name) },
    sleep: async (ms) => sleeps.push(ms),
    onStage: (name, payload) => stages.push([name, payload]),
  });

  assert.equal(await boot.start(), true);
  assert.equal(stages[0][0], 'reduced');
  assert.deepEqual(stages.slice(1, 4).map(([name]) => name), ['power', 'modem', 'pepe']);
  assert.equal(stages.filter(([name]) => name === 'post-line').length, POST_LINES.length);
  assert.equal(stages.at(-2)[0], 'scanner');
  assert.equal(stages.at(-1)[0], 'ready');
  assert.deepEqual(cues, ['boot-power', 'modem-56k', 'boot-lock', 'boot-ready']);
  assert.ok(sleeps.some((ms) => ms >= 2500), 'reduced motion must not skip the modem boot beat');
});
