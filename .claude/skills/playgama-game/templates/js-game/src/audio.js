// Audio from real files only (req 3.3.2: no code-synthesized sound). One master gain driven by `gate`.
import { CONFIG } from './config.js';
import { gate } from './platform.js';

export class AudioBus {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.buffers = new Map();
    this.music = null;
    this.musicName = '';
    this.failed = 0;
    this.unlocked = false;
    gate.onChange(() => this.apply());
  }

  /** Call from the first pointerdown/keydown: browsers block audio before a gesture. Also resumes after iOS suspends it. */
  unlock() {
    this.unlocked = true;
    this.ensureCtx();
    this.apply();
  }

  ensureCtx() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.connect(this.ctx.destination);
  }

  /** Silence = gain 0 + suspended context, so nothing plays in the background, during ads or when the platform mutes. */
  apply() {
    if (!this.ctx) return;
    const silent = gate.isSilent;
    this.master.gain.value = silent ? 0 : 1;
    if (silent) this.ctx.suspend();
    else if (this.unlocked) this.ctx.resume();
  }

  /** names: { click: 'assets/audio/click', ... } (no extension; CONFIG.audioExt is appended). Failures are counted, never thrown. */
  async load(names) {
    await Promise.all(Object.entries(names).map(async ([name, base]) => {
      try {
        const res = await fetch(`${base}.${CONFIG.audioExt}`);
        if (!res.ok) throw new Error(String(res.status));
        const data = await res.arrayBuffer();
        this.ensureCtx();
        this.buffers.set(name, await this.ctx.decodeAudioData(data));
      } catch (e) {
        this.failed++;                      // a missing sound must never break the game
      }
    }));
  }

  sfx(name, { volume = 1, rate = 1 } = {}) {
    const buf = this.buffers.get(name);
    if (!buf || !this.ctx || gate.isSilent) return;
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    src.buffer = buf;
    src.playbackRate.value = rate;
    g.gain.value = volume;
    src.connect(g).connect(this.master);
    src.start();
  }

  play(name, volume = 0.5) {
    if (this.musicName === name) return;
    this.stopMusic();
    const buf = this.buffers.get(name);
    this.musicName = name;
    if (!buf || !this.ctx) return;
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    src.buffer = buf;
    src.loop = true;
    g.gain.value = volume;
    src.connect(g).connect(this.master);
    src.start();
    this.music = src;
  }

  stopMusic() {
    try { this.music?.stop(); } catch (e) { /* already stopped */ }
    this.music = null;
    this.musicName = '';
  }
}
