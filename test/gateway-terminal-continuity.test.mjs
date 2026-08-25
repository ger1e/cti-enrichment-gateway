import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { createAudioEngine } from '../app/audio.js';
import { createPara11axBootSequence, PARA11AX_BOOT_LINES } from '../app/boot.js';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

class FakeParam { setValueAtTime() {} linearRampToValueAtTime() {} exponentialRampToValueAtTime() {} }
class FakeNode { constructor() { this.frequency = new FakeParam(); this.gain = new FakeParam(); } connect() { return this; } start() {} stop() {} }
class FakeAudioContext { constructor() { this.currentTime = 1; this.destination = {}; this.state = 'running'; this.sampleRate = 48000; } createOscillator() { return new FakeNode(); } createGain() { return new FakeNode(); } resume() { return Promise.resolve(); } }

test('PARA11AX service OK wall completes before Pepe and gateway readiness', async () => {
  const stages = [];
  const boot = createPara11axBootSequence({
    audio: { enable: async () => {}, play: () => {}, stopAll: () => {} },
    sleep: async () => {},
    onStage: (name, payload) => stages.push([name, payload]),
  });
  await boot.start();
  const pepeIndex = stages.findIndex(([name]) => name === 'pepe');
  const lineIndexes = stages.map(([name], index) => name === 'boot-line' ? index : -1).filter(index => index >= 0);
  assert.equal(lineIndexes.length, PARA11AX_BOOT_LINES.length);
  assert.ok(lineIndexes.every(index => index < pepeIndex), 'all service lines must render before Pepe');
  assert.ok(pepeIndex < stages.findIndex(([name]) => name === 'target'), 'Pepe must precede final gateway readiness');
});

test('terminal runtime restores the complete boot transcript and Pepe into shell scrollback', async () => {
  const entry = await read('app/terminal-entry.js');
  assert.match(entry, /bootTranscript/);
  assert.match(entry, /pepe\.textContent/);
  assert.match(entry, /restoreBootTranscript/);
  assert.match(entry, /shell-scrollback/);
  assert.match(entry, /shell-boot-pepe/);
  assert.doesNotMatch(entry, /bootLog\.replaceChildren\(\)[\s\S]{0,400}stage === ['"]boot-line['"]/, 'boot lines must not be discarded during the sequence');
});

test('backspace cue is not suppressed by character typing throttle', async () => {
  let clock = 1000;
  const audio = createAudioEngine({ AudioContextCtor: FakeAudioContext, now: () => clock });
  await audio.enable();
  audio.typing('character');
  const afterCharacter = audio.state().emitted;
  audio.typing('backspace');
  assert.equal(audio.state().emitted, afterCharacter + 1);
  assert.equal(audio.state().lastCue, 'key-backspace');
});

test('duplicate erase reports collapse to one clack without throttling real erases', async () => {
  let clock = 1000;
  const audio = createAudioEngine({ AudioContextCtor: FakeAudioContext, now: () => clock });
  await audio.enable();
  audio.typing('backspace');
  const once = audio.state().emitted;
  audio.typing('backspace');
  assert.equal(audio.state().emitted, once, 'keydown + beforeinput for one erase must not double-fire');
  clock += 20;
  audio.typing('backspace');
  assert.equal(audio.state().emitted, once + 1, 'a later erase must remain audible');
});

test('mobile virtual-keyboard deletion has a beforeinput backspace cue path', async () => {
  const entry = await read('app/terminal-entry.js');
  assert.match(entry, /beforeinput/);
  assert.match(entry, /deleteContentBackward|deleteContentForward/);
  assert.match(entry, /typing\(['"]backspace['"]\)/);
});

test('56k handshake includes synthesized carrier noise rather than tones only', async () => {
  const source = await read('app/audio.js');
  assert.match(source, /createBufferSource|modemNoise|noiseBurst/);
  assert.match(source, /modem-56k/);
  assert.match(source, /350[\s\S]{0,120}440/, 'dial tone pair should remain present');
});

test('mobile shell uses one coherent operational type scale and compact help layout', async () => {
  const css = await read('app/shell.css');
  assert.match(css, /--terminal-font\s*:\s*14px/);
  assert.match(css, /--terminal-input\s*:\s*16px/);
  assert.doesNotMatch(css, /@media\(max-width:430px\)[\s\S]*\.shell-pre\{[^}]*font-size:\s*11px/);
  assert.match(css, /@media\(max-width:430px\)[\s\S]*\.shell-help[^}]*white-space:\s*pre-line/);
  assert.match(css, /@media\(max-width:430px\)[\s\S]*\.shell-pre[^}]*white-space:\s*pre-wrap/);
});

test('active boot and shell branding is Gateway Terminal', async () => {
  const boot = await read('app/boot.js');
  const entry = await read('app/terminal-entry.js');
  const shell = await read('app/shell-ui.js');
  const commands = await read('app/shell.js');
  const active = `${boot}\n${entry}\n${shell}\n${commands}`;
  assert.match(active, /Gateway Terminal/);
  assert.match(shell, /para11ax@gateway:~\$/);
  assert.doesNotMatch(active, /replay the Unix boot sequence|EVIDENCE TERMINAL/);
});

test('boot has a slow non-interactive wireframe globe that becomes static under reduced motion', async () => {
  const entry = await read('app/terminal-entry.js');
  const css = await read('app/shell.css');
  assert.match(entry, /boot-globe/);
  assert.match(entry, /createElementNS/);
  assert.match(css, /\.boot-globe[^}]*pointer-events:\s*none/);
  assert.match(css, /globe-spin\s+2[4-9]s\s+linear\s+infinite/);
  assert.match(css, /prefers-reduced-motion:reduce[\s\S]*\.boot-globe[^}]*animation:\s*none/);
});
