const CUES = Object.freeze({
  'boot-power': [[52, .16, 'sine', 38, .12], [78, .12, 'square', 104, .08], [156, .08, 'square', 620, .07]],
  'modem-56k': [
    [350, .34, 'sine', 350, .13], [440, .34, 'sine', 440, .13],
    [697, .09, 'sine', 697, .12], [1209, .09, 'sine', 1209, .12],
    [770, .09, 'sine', 770, .12], [1336, .09, 'sine', 1336, .12],
    [852, .09, 'sine', 852, .12], [1477, .09, 'sine', 1477, .12],
    [941, .09, 'sine', 941, .12], [1209, .09, 'sine', 1209, .12],
    [1180, .28, 'sawtooth', 2480, .15], [2480, .24, 'square', 920, .14],
    [920, .20, 'sawtooth', 3180, .16], [3180, .22, 'square', 1580, .15],
    [1580, .20, 'triangle', 2650, .14], [2650, .18, 'square', 720, .14],
    [720, .17, 'sawtooth', 3450, .16], [3450, .18, 'square', 1360, .14],
    [1360, .15, 'triangle', 2940, .13], [2940, .16, 'square', 1010, .13],
    [1010, .15, 'sawtooth', 3540, .14], [3540, .16, 'square', 1770, .13],
    [1770, .14, 'triangle', 2730, .12], [2730, .14, 'square', 1220, .12],
    [1220, .13, 'sawtooth', 3260, .13], [3260, .14, 'square', 1490, .12],
    [1490, .13, 'triangle', 2410, .11], [2410, .14, 'square', 820, .11],
    [820, .15, 'sawtooth', 2860, .12], [2860, .18, 'square', 1160, .11],
  ],
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
  'result-ok': [[330, .06, 'triangle', 330, .07], [494, .07, 'triangle', 494, .07], [660, .10, 'triangle', 660, .07]],
  'result-partial': [[370, .09, 'triangle', 330, .08], [311, .14, 'triangle', 260, .08]],
  'result-error': [[150, .12, 'square', 110, .11], [105, .16, 'square', 75, .11]],
  contradiction: [[240, .07, 'square', 95, .10], [95, .11, 'square', 210, .10]],
  copy: [[840, .03, 'square', 1040, .06]],
  'stix-start': [[220, .08, 'square', 880, .07], [880, .13, 'square', 1760, .07]],
  'stix-ok': [[440, .055, 'triangle', 440, .07], [660, .09, 'triangle', 660, .07]],
  disconnect: [[330, .07, 'square', 165, .08], [165, .10, 'square', 82, .09], [82, .14, 'square', 52, .10]],
});

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

  function noiseBurst(duration, offset, gainScale = .07, seed = 1) {
    if (typeof context.createBuffer !== 'function' || typeof context.createBufferSource !== 'function') return;
    const sampleRate = Number(context.sampleRate) || 44100;
    const frameCount = Math.max(1, Math.floor(sampleRate * duration));
    const buffer = context.createBuffer(1, frameCount, sampleRate);
    const channel = buffer.getChannelData(0);
    let stateSeed = (seed >>> 0) || 1;
    for (let index = 0; index < channel.length; index += 1) {
      stateSeed = (1664525 * stateSeed + 1013904223) >>> 0;
      channel[index] = ((stateSeed / 0xffffffff) * 2 - 1) * .72;
    }
    const source = context.createBufferSource();
    const gain = context.createGain();
    const start = context.currentTime + offset;
    source.buffer = buffer;
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.linearRampToValueAtTime(Math.max(.0001, volume * Math.min(.18, gainScale)), start + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    source.connect(gain).connect(context.destination);
    source.onended = () => activeNodes.delete(source);
    activeNodes.add(source);
    source.start(start);
    source.stop(start + duration + .01);
  }

  function modemNoise() {
    noiseBurst(.28, .58, .07, 0x11a0);
    noiseBurst(.36, 1.06, .09, 0x56c0);
    noiseBurst(.46, 1.58, .11, 0x90aa);
    noiseBurst(.52, 2.18, .10, 0x11aa);
    noiseBurst(.62, 2.78, .08, 0x5600);
  }

  function play(name) {
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
      if (name === 'modem-56k') modemNoise();
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
