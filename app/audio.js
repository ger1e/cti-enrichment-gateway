export const MODEM_HANDSHAKE_MS = 11200;

const CUES = Object.freeze({
  'boot-power': [[52, .16, 'sine', 38, .12], [78, .12, 'square', 104, .08], [156, .08, 'square', 620, .07]],
  'boot-lock': [[180, .06, 'square', 180, .08], [360, .07, 'square', 520, .08], [720, .09, 'square', 1040, .07]],
  'boot-ready': [[110, .045, 'square', 88, .09], [494, .07, 'triangle', 494, .08], [740, .10, 'triangle', 740, .08]],
  'access-ok': [[120, .05, 'square', 90, .08], [330, .07, 'triangle', 330, .08], [660, .10, 'triangle', 660, .08]],
  'access-denied': [[190, .12, 'square', 140, .10], [120, .15, 'square', 82, .11]],
  key: [[1880, .022, 'square', 1460, .065]],
  'key-backspace': [[690, .032, 'square', 360, .11], [210, .018, 'square', 150, .07]],
  'key-enter': [[190, .045, 'square', 95, .10], [620, .035, 'square', 620, .06]],
  paste: [[480, .035, 'square', 980, .07], [980, .035, 'square', 1560, .07], [1560, .045, 'square', 620, .06]],
  tab: [[720, .035, 'square', 880, .06]],
  scan: [[180, .14, 'sawtooth', 980, .08], [980, .18, 'triangle', 180, .07]],
  glitch: [[3380, .018, 'square', 760, .10], [140, .024, 'square', 1680, .08], [2510, .016, 'sawtooth', 420, .07]],
  'result-ok': [[330, .06, 'triangle', 330, .07], [494, .07, 'triangle', 494, .07], [660, .10, 'triangle', 660, .07]],
  'result-partial': [[370, .09, 'triangle', 330, .08], [311, .14, 'triangle', 260, .08]],
  'result-error': [[150, .12, 'square', 110, .11], [105, .16, 'square', 75, .11]],
  contradiction: [[240, .07, 'square', 95, .10], [95, .11, 'square', 210, .10]],
  copy: [[840, .03, 'square', 1040, .06]],
  'stix-start': [[220, .08, 'square', 880, .07], [880, .13, 'square', 1760, .07]],
  'stix-ok': [[440, .055, 'triangle', 440, .07], [660, .09, 'triangle', 660, .07]],
  disconnect: [[330, .07, 'square', 165, .08], [165, .10, 'square', 82, .09], [82, .14, 'square', 52, .10]],
});

const TAU = Math.PI * 2;
const DTMF = Object.freeze([
  [770, 1336], [770, 1336], [770, 1477], [770, 1477], [697, 1209], [852, 1477], [852, 1477], [941, 1336],
]);

function segmentEnvelope(time, start, end, fade = .012) {
  if (time < start || time >= end) return 0;
  return Math.min(1, (time - start) / fade, (end - time) / fade);
}

export function createAudioEngine({
  AudioContextCtor = globalThis.AudioContext || globalThis.webkitAudioContext,
  now = () => performance.now(),
} = {}) {
  let context = null;
  let enabled = false;
  let muted = false;
  let volume = .6;
  let emitted = 0;
  let lastCue = null;
  let lastTyping = -Infinity;
  let lastErase = -Infinity;
  let fault = null;
  const activeNodes = new Set();

  const state = () => Object.freeze({ enabled, muted, volume, emitted, lastCue, active: activeNodes.size, supported: Boolean(AudioContextCtor), fault });

  async function enable() {
    if (!AudioContextCtor) {
      fault = 'unsupported';
      return state();
    }
    try {
      context ||= new AudioContextCtor();
      if (context.state === 'suspended') await context.resume();
      enabled = context.state === 'running' || context.state == null;
      fault = enabled ? null : 'blocked';
    } catch {
      enabled = false;
      fault = 'blocked';
    }
    return state();
  }

  function tone(frequency, duration, offset, type = 'square', endFrequency = null, gainScale = .09) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const start = context.currentTime + offset;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (Number.isFinite(endFrequency) && endFrequency > 0 && endFrequency !== frequency) {
      oscillator.frequency.linearRampToValueAtTime(endFrequency, start + duration);
    }
    const audibleScale = Math.min(.34, gainScale * 1.9);
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.linearRampToValueAtTime(Math.max(.0001, volume * audibleScale), start + Math.min(.008, duration / 3));
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.onended = () => activeNodes.delete(oscillator);
    activeNodes.add(oscillator);
    oscillator.start(start);
    oscillator.stop(start + duration + .01);
  }

  function renderModemHandshake() {
    // A single deterministic PCM timeline is used instead of the generic cue sequencer.
    // The phases model recognizable dial-up landmarks: DTMF, the 2100 Hz answer carrier
    // with periodic phase reversal, V.8 menu exchange, probing, training noise, and lock.
    if (typeof context.createBuffer !== 'function' || typeof context.createBufferSource !== 'function') {
      tone(2100, .45, 0, 'sine', 2100, .16);
      return;
    }

    const sampleRate = Number(context.sampleRate) || 48000;
    const duration = MODEM_HANDSHAKE_MS / 1000;
    const frameCount = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = context.createBuffer(1, frameCount, sampleRate);
    const channel = buffer.getChannelData(0);
    let noiseState = 0x11a05690;

    for (let index = 0; index < frameCount; index += 1) {
      const time = index / sampleRate;
      let sample = 0;

      // Local dial tone: recognizable 350/440 Hz pair.
      if (time < .68) {
        const env = segmentEnvelope(time, 0, .68, .018);
        sample += env * (.17 * Math.sin(TAU * 350 * time) + .17 * Math.sin(TAU * 440 * time));
      }

      // DTMF dial burst train with inter-digit gaps.
      if (time >= .78 && time < 1.82) {
        const local = time - .78;
        const slot = Math.floor(local / .13);
        const inSlot = local - slot * .13;
        if (slot < DTMF.length && inSlot < .085) {
          const [low, high] = DTMF[slot];
          const env = Math.sin(Math.PI * Math.min(1, inSlot / .085));
          sample += env * (.17 * Math.sin(TAU * low * time) + .17 * Math.sin(TAU * high * time));
        }
      }

      // Short ringback impression before the remote modem answers.
      if (time >= 1.88 && time < 2.34) {
        const env = segmentEnvelope(time, 1.88, 2.34, .018);
        sample += env * (.08 * Math.sin(TAU * 440 * time) + .07 * Math.sin(TAU * 480 * time));
      }

      // V.8/ANSam-style answer carrier: 2100 Hz, 15 Hz AM, phase reversal every ~450 ms.
      if (time >= 2.34 && time < 3.58) {
        const local = time - 2.34;
        const reversal = Math.floor(local / .45) % 2 === 0 ? 1 : -1;
        const am = .72 + .28 * Math.sin(TAU * 15 * local);
        const env = segmentEnvelope(time, 2.34, 3.58, .025);
        sample += env * reversal * am * .29 * Math.sin(TAU * 2100 * local);
      }

      // V.8 CM/JM menu exchange: fast deterministic FSK-like bursts from both sides.
      if (time >= 3.58 && time < 4.62) {
        const local = time - 3.58;
        const symbol = Math.floor(local / .025);
        const a = symbol % 5 < 2 ? 980 : 1180;
        const b = (symbol * 7) % 11 < 5 ? 1650 : 1850;
        const gate = (local % .025) < .020 ? 1 : .18;
        const env = segmentEnvelope(time, 3.58, 4.62, .015);
        sample += env * gate * (.17 * Math.sin(TAU * a * local) + .13 * Math.sin(TAU * b * local));
      }

      // Channel probing chirps sweep repeatedly across the telephone passband.
      if (time >= 4.62 && time < 5.72) {
        const local = time - 4.62;
        const sweepLength = .22;
        const sweepIndex = Math.floor(local / sweepLength);
        const u = local - sweepIndex * sweepLength;
        const rising = sweepIndex % 2 === 0;
        const f0 = rising ? 520 : 3450;
        const f1 = rising ? 3450 : 620;
        const k = (f1 - f0) / sweepLength;
        const phase = TAU * (f0 * u + .5 * k * u * u);
        sample += segmentEnvelope(time, 4.62, 5.72, .012) * .24 * Math.sin(phase);
      }

      noiseState = (1664525 * noiseState + 1013904223) >>> 0;
      const noise = (noiseState / 0xffffffff) * 2 - 1;

      // Equalizer/training noise: broadband hiss plus a moving multicarrier comb.
      if (time >= 5.72 && time < 7.08) {
        const local = time - 5.72;
        const env = segmentEnvelope(time, 5.72, 7.08, .018);
        let comb = 0;
        for (let carrier = 0; carrier < 7; carrier += 1) {
          const frequency = 620 + carrier * 390 + 55 * Math.sin(TAU * (.8 + carrier * .07) * local);
          comb += Math.sin(TAU * frequency * local + carrier * 1.17);
        }
        sample += env * (.11 * noise + .027 * comb);
      }

      // Scrambled multicarrier training with rapid pseudo-symbol phase changes.
      if (time >= 7.08 && time < 8.54) {
        const local = time - 7.08;
        const symbol = Math.floor(local / .018);
        const env = segmentEnvelope(time, 7.08, 8.54, .018);
        let carriers = 0;
        for (let carrier = 0; carrier < 9; carrier += 1) {
          const frequency = 540 + carrier * 345;
          const phaseFlip = ((symbol * (carrier + 3) + carrier * 5) & 3) * (Math.PI / 2);
          carriers += Math.sin(TAU * frequency * local + phaseFlip);
        }
        sample += env * (.025 * carriers + .045 * noise);
      }

      // Rate negotiation warble: abrupt paired carriers and rapid spectral movement.
      if (time >= 8.54 && time < 9.72) {
        const local = time - 8.54;
        const block = Math.floor(local / .055);
        const base = 700 + ((block * 379) % 2450);
        const env = segmentEnvelope(time, 8.54, 9.72, .015);
        sample += env * (.20 * Math.sin(TAU * base * local) + .12 * Math.sin(TAU * Math.min(3500, base + 470) * local) + .035 * noise);
      }

      // V.90-style final training: alternating chirps, hiss and phase-scrambled carrier groups.
      if (time >= 9.72 && time < 10.68) {
        const local = time - 9.72;
        const cycle = local % .16;
        const chirp = 520 + 3000 * (cycle / .16);
        const env = segmentEnvelope(time, 9.72, 10.68, .015);
        sample += env * (.16 * Math.sin(TAU * chirp * local) + .09 * Math.sin(TAU * (3600 - chirp * .72) * local) + .075 * noise);
      }

      // Carrier lock and training tail collapse into silence before service startup.
      if (time >= 10.68 && time < duration) {
        const local = time - 10.68;
        const env = segmentEnvelope(time, 10.68, duration, .035) * Math.max(0, 1 - local / .52);
        sample += env * (.14 * Math.sin(TAU * 1800 * local) + .08 * Math.sin(TAU * 1200 * local) + .035 * noise);
      }

      channel[index] = Math.tanh(sample * 1.5) * .72;
    }

    const source = context.createBufferSource();
    const gain = context.createGain();
    const start = context.currentTime;
    source.buffer = buffer;
    gain.gain.setValueAtTime(Math.max(.0001, Math.min(.95, volume * 1.18)), start);
    source.connect(gain).connect(context.destination);
    source.onended = () => activeNodes.delete(source);
    activeNodes.add(source);
    source.start(start);
    source.stop(start + duration + .02);
  }

  function play(name) {
    if (name === 'modem-56k') {
      if (!enabled || muted || volume <= 0 || !context) return;
      try {
        renderModemHandshake();
        emitted += 1;
        lastCue = name;
        fault = null;
      } catch {
        fault = 'playback';
        stopAll();
      }
      return;
    }

    const recipe = CUES[name];
    if (!recipe) throw new Error(`unknown cue: ${name}`);
    if (!enabled || muted || volume <= 0 || !context) return;
    let offset = 0;
    const keyVariation = name === 'key' ? ((emitted % 3) - 1) * 28 : 0;
    try {
      for (const [frequency, duration, type = 'square', endFrequency = null, gainScale = .09] of recipe) {
        const startFrequency = Math.max(40, frequency + keyVariation);
        const end = endFrequency == null ? null : Math.max(40, endFrequency + keyVariation);
        tone(startFrequency, Math.min(duration, .45), offset, type, end, gainScale);
        offset += duration * .72;
      }
      emitted += 1;
      lastCue = name;
      fault = null;
    } catch {
      fault = 'playback';
      stopAll();
    }
  }

  function stopAll() {
    if (!context) return;
    for (const node of activeNodes) {
      try { node.stop(context.currentTime); } catch {}
    }
    activeNodes.clear();
  }

  function typing(kind) {
    if (kind === 'token') return;
    const time = now();
    if (kind === 'backspace' || kind === 'delete') {
      if (time - lastErase < 12) return;
      lastErase = time;
      return play('key-backspace');
    }
    if (kind === 'enter') return play('key-enter');
    if (kind === 'paste') return play('paste');
    if (time - lastTyping < 45) return;
    lastTyping = time;
    play('key');
  }

  return Object.freeze({
    enable,
    play,
    stopAll,
    typing,
    mute(value) { muted = Boolean(value); },
    setVolume(value) { volume = Math.min(1, Math.max(0, Number(value) || 0)); },
    state,
  });
}
