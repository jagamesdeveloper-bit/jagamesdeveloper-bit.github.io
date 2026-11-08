// performance_sample adapter (Playgama telemetry guide v1.1.x). One sample per ~30 s of ACTIVE visible gameplay.
// Never per frame; loading, pause, menus and hidden-tab time are excluded by the caller passing active=false.
// Until Bridge exposes system events this sends through bridge.analytics.send; only `send` changes later.
import { CONFIG } from './config.js';

const WINDOW_ACTIVE_MS = 30000;

const pct = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] : 0);
const r1 = (n) => Math.round(n * 10) / 10;

export class PerfSampler {
  /** @param send (name, flatData) => void */
  constructor(send) {
    this.send = send;
    this.errors = 0;
    this.rejections = 0;
    this.reset();
    addEventListener('error', () => { this.errors++; });
    addEventListener('unhandledrejection', () => { this.rejections++; });
  }

  reset() {
    this.frames = [];
    this.activeMs = 0;
    this.winStart = 0;
    this.errors = 0;
    this.rejections = 0;
  }

  /** dtMs = real frame time. Pass active=false for loading / pause / menu / hidden: nothing is recorded. */
  frame(dtMs, active) {
    if (!active || dtMs <= 0) return;
    if (!this.winStart) this.winStart = performance.now();
    this.frames.push(dtMs);
    this.activeMs += dtMs;
    if (this.activeMs >= WINDOW_ACTIVE_MS) this.flush();
  }

  flush() {
    if (this.frames.length < 30) return;
    const ft = [...this.frames].sort((a, b) => a - b);
    const n = ft.length;
    const sum = ft.reduce((a, b) => a + b, 0);
    const over = (ms) => ft.filter((v) => v > ms).length;
    const data = {
      target_fps: CONFIG.targetFps,
      window_ms: Math.round(performance.now() - this.winStart),
      active_ms: Math.round(this.activeMs),
      frame_count: n,
      fps_avg: r1((n / sum) * 1000),
      fps_p10: r1(1000 / pct(ft, 0.9)),            // 10th percentile of FPS = slow end of frame times
      frame_time_p50_ms: r1(pct(ft, 0.5)),
      frame_time_p95_ms: r1(pct(ft, 0.95)),
      frame_time_p99_ms: r1(pct(ft, 0.99)),
      frame_time_max_ms: r1(ft[n - 1]),
      frames_over_50ms: over(50),
      frames_over_100ms: over(100),
      frames_over_250ms: over(250),
      frames_over_500ms: over(500),
      frames_over_1000ms: over(1000),
      game_version: CONFIG.version,
      js_error_count: this.errors,                 // counts for THIS window only
      unhandled_rejection_count: this.rejections,
    };
    this.send('performance_sample', data);
    this.reset();
  }
}
