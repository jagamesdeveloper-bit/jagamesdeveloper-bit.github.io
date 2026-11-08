// Placeholder gameplay ("catch the falling dots"). Replace the body of update()/render(), keep the shape:
// the lifecycle, ads, saves, audio and layout all live in main.js / platform.js and keep working.
import { CONFIG } from './config.js';

export class Game {
  constructor() { this.reset(); }

  reset() {
    this.score = 0;
    this.lives = CONFIG.lives;
    this.dots = [];
    this.spawnTimer = 0;
    this.paddle = { x: 0, w: 170 };
    this.events = [];        // 'catch' | 'miss' | 'over' - main.js turns them into sound
  }

  get over() { return this.lives <= 0; }

  update(dt, view, input) {
    const half = view.vw / 2, floor = view.vh / 2 - 90;
    const ax = input.axis().x;
    if (ax) this.paddle.x += ax * CONFIG.paddleSpeed * dt;
    else if (input.pointer.down && !input.stick) this.paddle.x = (input.pointer.x - view.w / 2) / view.scale;
    this.paddle.x = Math.max(-half + this.paddle.w / 2, Math.min(half - this.paddle.w / 2, this.paddle.x));

    const level = 1 + this.score / 15;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = Math.max(0.3, CONFIG.spawnEvery / level);
      this.dots.push({ x: (Math.random() * 2 - 1) * (half - 40), y: -view.vh / 2 - 30, hue: Math.random() * 360 });
    }
    for (const d of this.dots) d.y += CONFIG.fallSpeed * level * dt;

    this.dots = this.dots.filter((d) => {
      const caught = d.y >= floor - CONFIG.dotRadius && Math.abs(d.x - this.paddle.x) < this.paddle.w / 2 + CONFIG.dotRadius;
      if (caught) { this.score++; this.events.push('catch'); return false; }
      if (d.y > view.vh / 2 + 40) { this.lives--; this.events.push(this.over ? 'over' : 'miss'); return false; }
      return true;
    });
  }

  render(ctx, view) {
    const half = view.vw / 2, halfH = view.vh / 2;
    const g = ctx.createLinearGradient(0, -halfH, 0, halfH);
    g.addColorStop(0, '#1b2a55'); g.addColorStop(1, '#0f1424');
    ctx.fillStyle = g;
    ctx.fillRect(-half - 2, -halfH - 2, view.vw + 4, view.vh + 4);       // background extends under the whole window

    ctx.fillStyle = '#ffb347';
    const px = this.paddle.x - this.paddle.w / 2, py = halfH - 90;
    ctx.beginPath(); ctx.roundRect?.(px, py, this.paddle.w, 22, 11); if (!ctx.roundRect) ctx.rect(px, py, this.paddle.w, 22); ctx.fill();

    for (const d of this.dots) {
      ctx.fillStyle = `hsl(${d.hue} 85% 62%)`;
      ctx.beginPath(); ctx.arc(d.x, d.y, CONFIG.dotRadius, 0, Math.PI * 2); ctx.fill();
    }
  }
}
