import assert from 'node:assert/strict';
import test from 'node:test';

import { createPara11axBootSequence, PARA11AX_BOOT_LINES } from '../app/boot.js';

test('reduced motion preserves PARA11AX boot, modem, Pepe, services and shell readiness', async () => {
  const stages = [];
  const cues = [];
  const sleeps = [];
  const boot = createPara11axBootSequence({
    reducedMotion: true,
    audio: { enable: async () => {}, play: (name) => cues.push(name), stopAll: () => {} },
    sleep: async (ms) => sleeps.push(ms),
    onStage: (name, payload) => stages.push([name, payload]),
  });

  assert.equal(await boot.start(), true);
  assert.equal(stages[0][0], 'reduced');
  assert.deepEqual(stages.slice(1, 4).map(([name]) => name), ['power', 'modem', 'pepe']);
  assert.equal(stages.filter(([name]) => name === 'boot-line').length, PARA11AX_BOOT_LINES.length);
  assert.equal(stages.at(-2)[0], 'target');
  assert.equal(stages.at(-1)[0], 'ready');
  assert.deepEqual(cues, ['boot-power', 'modem-56k', 'boot-lock', 'boot-ready']);
  assert.ok(sleeps.some((ms) => ms >= 2500), 'reduced motion must not skip the modem handshake');
});
