/* Tiny WebAudio sound kit for ONE MORE THING (everything is synthesized, nothing is downloaded). */
(function () {
  'use strict';
  let ac = null, master = null, noiseBuf = null, muted = false, suspended = false;
  let snoreAt = 0;

  function init() {
    if (ac) return;
    try {
      const C = window.AudioContext || window.webkitAudioContext;
      if (!C) return;
      ac = new C();
      master = ac.createGain();
      master.gain.value = muted ? 0 : 0.75;
      master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { ac = null; }
  }
  function resume() {
    init();
    if (ac && ac.state === 'suspended' && !suspended) ac.resume();
  }
  function apply() {
    if (master) master.gain.value = muted ? 0 : 0.75;
    if (ac) {
      if (muted && ac.state === 'running') ac.suspend().catch(() => {});
      else if (!muted && !suspended && ac.state === 'suspended') ac.resume().catch(() => {});
    }
  }
  function setMuted(m) { muted = m; apply(); }

  function tone(freq, dur, type, vol, slideTo, delay) {
    if (!ac || muted) return;
    const t = ac.currentTime + (delay || 0);
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, ftype, f1, f2, delay, q) {
    if (!ac || muted) return;
    const t = ac.currentTime + (delay || 0);
    const s = ac.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ac.createBiquadFilter(); f.type = ftype || 'lowpass';
    f.frequency.setValueAtTime(f1, t);
    if (f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur);
    if (q) f.Q.value = q;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  const S = {
    resume, setMuted,
    get muted() { return muted; },
    suspend(v) { suspended = v; if (ac) { if (v && ac.state === 'running') ac.suspend().catch(() => {}); else if (!v && !muted) ac.resume().catch(() => {}); } },

    impact(kind, v) {
      v = Math.min(1, Math.max(0.05, v));
      const pitch = 0.9 + Math.random() * 0.25;
      switch (kind) {
        case 'clang':
          tone(520 * pitch, 0.55, 'sine', 0.22 * v + 0.05);
          tone(780 * pitch, 0.45, 'sine', 0.16 * v + 0.03);
          tone(1310 * pitch, 0.32, 'triangle', 0.1 * v);
          noise(0.06, 0.2 * v, 'highpass', 2500);
          break;
        case 'ceramic':
          noise(0.14, 0.3 * v + 0.05, 'bandpass', 3200, 1800, 0, 2);
          tone(1500 * pitch, 0.12, 'triangle', 0.12 * v);
          break;
        case 'tink':
          tone(2300 * pitch, 0.16, 'sine', 0.1 * v + 0.03);
          tone(3100 * pitch, 0.1, 'sine', 0.05 * v);
          break;
        case 'boing':
          tone(160 * pitch, 0.2, 'sine', 0.22 * v + 0.05, 330 * pitch);
          break;
        default: // thud
          tone(110 * pitch, 0.2, 'sine', 0.38 * v + 0.05, 48);
          noise(0.1, 0.22 * v, 'lowpass', 700, 200);
      }
    },
    grab() { tone(260, 0.07, 'square', 0.05, 150); noise(0.04, 0.08, 'bandpass', 1800, 900, 0, 3); },
    miss() { tone(300, 0.08, 'sine', 0.04, 200); },
    release() { tone(180, 0.06, 'triangle', 0.06, 340); },
    snap() { tone(150, 0.22, 'sine', 0.3, 430); tone(300, 0.14, 'sine', 0.1, 700, 0.04); },
    drop() { tone(420, 0.14, 'triangle', 0.1, 200); },
    tear() { tone(500, 0.12, 'sawtooth', 0.08, 120); },
    coin(i) { tone(880 * (1 + (i || 0) * 0.12), 0.1, 'square', 0.07); tone(1320 * (1 + (i || 0) * 0.12), 0.22, 'square', 0.07, null, 0.07); },
    hop() { tone(220, 0.12, 'sine', 0.08, 420); },
    land(v) { noise(0.06, 0.1 * v, 'lowpass', 500, 150); },
    groan(level) {
      if (!ac || muted) return;
      const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(70 + level * 12, t);
      o.frequency.linearRampToValueAtTime(52 + level * 8, t + 0.9);
      f.type = 'lowpass'; f.frequency.value = 260;
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16, t + 0.25);
      g.gain.linearRampToValueAtTime(0.0001, t + 1.0);
      o.connect(f); f.connect(g); g.connect(master); o.start(t); o.stop(t + 1.05);
    },
    snore(vol, now) {
      if (!ac || muted || now < snoreAt) return;
      snoreAt = now + 3.4;
      noise(1.1, 0.12 * vol, 'lowpass', 220, 520);
      noise(1.3, 0.1 * vol, 'lowpass', 520, 160, 1.2);
    },
    tick() { tone(1200, 0.03, 'square', 0.025); },
    heartbeat() { tone(70, 0.12, 'sine', 0.3, 40); tone(65, 0.12, 'sine', 0.22, 38, 0.18); },
    wake() {
      tone(110, 1.1, 'sawtooth', 0.22, 80); tone(165, 1.1, 'sawtooth', 0.14, 120);
      noise(0.5, 0.2, 'lowpass', 400, 120);
    },
    stomp() { tone(62, 0.35, 'sine', 0.55, 28); noise(0.25, 0.3, 'lowpass', 300, 90); },
    win() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'square', 0.07, null, i * 0.11)); },
    lose() { [392, 330, 262, 196].forEach((f, i) => tone(f, 0.28, 'sawtooth', 0.07, null, i * 0.16)); },
    whirrStart() {
      if (!ac || muted) return null;
      const t = ac.currentTime, o = ac.createOscillator(), o2 = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
      o.type = 'sawtooth'; o2.type = 'square';
      o.frequency.setValueAtTime(60, t); o.frequency.exponentialRampToValueAtTime(190, t + 0.5);
      o2.frequency.setValueAtTime(61, t); o2.frequency.exponentialRampToValueAtTime(191, t + 0.5);
      f.type = 'lowpass'; f.frequency.value = 900;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.1, t + 0.15);
      o.connect(f); o2.connect(f); f.connect(g); g.connect(master); o.start(t); o2.start(t);
      return { o, o2, g };
    },
    whirrStop(h) {
      if (!h || !ac) return;
      const t = ac.currentTime;
      try { h.g.gain.cancelScheduledValues(t); h.g.gain.setValueAtTime(h.g.gain.value, t); h.g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25); h.o.stop(t + 0.3); h.o2.stop(t + 0.3); } catch (e) {}
    }
  };
  window.Snd = S;
})();
