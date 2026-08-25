const CUES = Object.freeze({
  'boot-power': [[52, .18], [78, .16], [156, .12]],
  'boot-lock': [[180, .07], [360, .08], [720, .11], [1040, .08]],
  'boot-ready': [[330, .07], [494, .08], [740, .10]],
  'access-ok': [[330, .08], [660, .11]],
  'access-denied': [[190, .12], [120, .15]],
  key: [[1900, .025]],
  tab: [[720, .035]],
  scan: [[180, .18], [980, .22]],
  'result-ok': [[330, .07], [494, .08], [660, .12]],
  'result-partial': [[370, .10], [311, .16]],
  'result-error': [[150, .14], [105, .18]],
  contradiction: [[240, .08], [95, .12]],
  copy: [[840, .03]],
  'stix-start': [[220, .09], [880, .16]],
  'stix-ok': [[440, .06], [660, .10]],
  disconnect: [[330, .08], [165, .12], [82, .16]],
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
  let lastTyping = -Infinity;

  const state = () => Object.freeze({ enabled, muted, volume, emitted, supported: Boolean(AudioContextCtor) });

  async function enable() {
    if (!AudioContextCtor) return state();
    context ||= new AudioContextCtor();
    if (context.state === 'suspended') await context.resume();
    enabled = true;
    return state();
  }

  function tone(frequency, duration, offset) {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'square';
    oscillator.frequency.setValueAtTime(frequency, context.currentTime + offset);
    gain.gain.setValueAtTime(.0001, context.currentTime + offset);
    gain.gain.linearRampToValueAtTime(Math.max(.0001, volume * .09), context.currentTime + offset + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + offset + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(context.currentTime + offset);
    oscillator.stop(context.currentTime + offset + duration + .01);
  }

  function play(name) {
    const recipe = CUES[name];
    if (!recipe) throw new Error(`unknown cue: ${name}`);
    if (!enabled || muted || volume <= 0 || !context) return;
    let offset = 0;
    for (const [frequency, duration] of recipe) {
      tone(frequency, Math.min(duration, .45), offset);
      offset += duration * .55;
    }
    emitted += 1;
  }

  function typing(kind) {
    if (kind === 'token') return;
    const time = now();
    if (time - lastTyping < 45) return;
    lastTyping = time;
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