const CUES = Object.freeze({
  'boot-power': [[52, .16, 'sine', 38, .12], [78, .12, 'square', 104, .08], [156, .08, 'square', 620, .07]],
  'modem-56k': [
    [350, .24, 'sine', 350, .11], [440, .24, 'sine', 440, .11],
    [697, .08, 'sine', 697, .10], [1209, .08, 'sine', 1209, .10],
    [770, .08, 'sine', 770, .10], [1336, .08, 'sine', 1336, .10],
    [852, .08, 'sine', 852, .10], [1477, .08, 'sine', 1477, .10],
    [941, .08, 'sine', 941, .10], [1209, .08, 'sine', 1209, .10],
    [1180, .24, 'sawtooth', 2250, .12], [2250, .22, 'square', 980, .12],
    [980, .18, 'sawtooth', 2920, .13], [2920, .20, 'square', 1650, .12],
    [1650, .18, 'triangle', 2450, .12], [2450, .16, 'square', 760, .12],
    [760, .15, 'sawtooth', 3250, .13], [3250, .16, 'square', 1420, .12],
    [1420, .13, 'triangle', 2780, .11], [2780, .14, 'square', 1040, .11],
    [1040, .13, 'sawtooth', 3380, .12], [3380, .14, 'square', 1810, .11],
    [1810, .12, 'triangle', 2510, .10], [2510, .12, 'square', 1260, .10],
    [1260, .11, 'sawtooth', 3060, .11], [3060, .12, 'square', 1530, .10],
    [1530, .11, 'triangle', 2290, .09], [2290, .12, 'square', 880, .09],
    [880, .13, 'sawtooth', 2710, .10], [2710, .15, 'square', 1200, .09],
  ],
  'boot-lock': [[180, .06, 'square', 180, .08], [360, .07, 'square', 520, .08], [720, .09, 'square', 1040, .07]],
  'boot-ready': [[110, .045, 'square', 88, .09], [494, .07, 'triangle', 494, .08], [740, .10, 'triangle', 740, .08]],
  'access-ok': [[120, .05, 'square', 90, .08], [330, .07, 'triangle', 330, .08], [660, .10, 'triangle', 660, .08]],
  'access-denied': [[190, .12, 'square', 140, .10], [120, .15, 'square', 82, .11]],
  key: [[1880, .022, 'square', 1460, .065]],
  'key-backspace': [[720, .026, 'square', 410, .08]],
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
  let volume = .35;
  let emitted = 0;
  let lastCue = null;
  let lastTyping = -Infinity;

  const state = () => Object.freeze({ enabled, muted, volume, emitted, lastCue, supported: Boolean(AudioContextCtor) });

  async function enable() {
    if (!AudioContextCtor) return state();
    context ||= new AudioContextCtor();
    if (context.state === 'suspended') await context.resume();
    enabled = true;
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
    gain.gain.setValueAtTime(.0001, start);
    gain.gain.linearRampToValueAtTime(Math.max(.0001, volume * gainScale), start + Math.min(.008, duration / 3));
    gain.gain.exponentialRampToValueAtTime(.0001, start + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + .01);
  }

  function play(name) {
    const recipe = CUES[name];
    if (!recipe) throw new Error(`unknown cue: ${name}`);
    if (!enabled || muted || volume <= 0 || !context) return;
    let offset = 0;
    const keyVariation = name === 'key' ? ((emitted % 3) - 1) * 28 : 0;
    for (const [frequency, duration, type = 'square', endFrequency = null, gainScale = .09] of recipe) {
      const startFrequency = Math.max(40, frequency + keyVariation);
      const end = endFrequency == null ? null : Math.max(40, endFrequency + keyVariation);
      tone(startFrequency, Math.min(duration, .45), offset, type, end, gainScale);
      offset += duration * .72;
    }
    emitted += 1;
    lastCue = name;
  }

  function typing(kind) {
    if (kind === 'token') return;
    const time = now();
    if (time - lastTyping < 45) return;
    lastTyping = time;
    if (kind === 'backspace' || kind === 'delete') return play('key-backspace');
    if (kind === 'enter') return play('key-enter');
    if (kind === 'paste') return play('paste');
    play('key');
  }

  return Object.freeze({
    enable,
    play,
    typing,
    mute(value) { muted = Boolean(value); },
    setVolume(value) { volume = Math.min(1, Math.max(0, Number(value) || 0)); },
    state,
  });
}