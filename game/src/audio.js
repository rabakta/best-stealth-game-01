// Synthesized WebAudio SFX — no audio files, no network. Created lazily on first
// user gesture; every call is safe before that (a no-op).
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let stepAlt = false;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.16;
      master.connect(ctx.destination);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, when = 0, slideTo = 0) {
    if (!ctx || muted) return;
    try {
      const t0 = ctx.currentTime + when;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch {
      // Audio must never break the game.
    }
  }

  return {
    ensure,
    setMuted(m) { muted = m; },
    isMuted() { return muted; },
    step() {
      if (!ctx || muted) return;
      stepAlt = !stepAlt;
      tone(stepAlt ? 95 : 82, 0.06, 'triangle', 0.5);
    },
    pickup() { tone(880, 0.09, 'sine', 0.7); tone(1318, 0.14, 'sine', 0.6, 0.07); },
    heart() { [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.16, 'sine', 0.7, i * 0.08)); },
    alarm() { tone(180, 0.22, 'sawtooth', 0.5, 0, 520); tone(180, 0.22, 'sawtooth', 0.5, 0.24, 520); },
    calm() { tone(660, 0.12, 'sine', 0.4, 0, 440); },
    caught() { tone(160, 0.55, 'square', 0.5, 0, 55); },
    win() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.2, 'sine', 0.65, i * 0.09)); },
    click() { tone(440, 0.06, 'sine', 0.5); },
    locked() { tone(220, 0.1, 'square', 0.35); tone(185, 0.12, 'square', 0.35, 0.1); },
  };
}
