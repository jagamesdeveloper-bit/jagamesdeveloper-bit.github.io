// Tiny WebAudio synth. The context is only created on the first user gesture
// (browser autoplay policy), and suspended while the tab is hidden.
let ctx = null;
let muted = false;
let lastHit = 0;

export const Sound = {
  get muted() { return muted; },
  setMuted(v) { muted = v; },
  unlock() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
  },
  suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
  resume() { if (ctx && ctx.state === 'suspended' && !muted) ctx.resume(); },
  tone(freq, dur, type = 'square', vol = 0.06, slide = 0, delay = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slide) osc.frequency.linearRampToValueAtTime(freq + slide, t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g).connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  },
  deploy() { this.tone(330, 0.12, 'triangle', 0.09, 330); },
  hit() {
    const now = performance.now();
    if (now - lastHit < 70) return;
    lastHit = now;
    this.tone(140, 0.07, 'square', 0.04, -60);
  },
  boom() { this.tone(90, 0.35, 'sawtooth', 0.12, -50); },
  win() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.1, 0, i * 0.14)); },
  lose() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.28, 'triangle', 0.1, 0, i * 0.16)); },
};
