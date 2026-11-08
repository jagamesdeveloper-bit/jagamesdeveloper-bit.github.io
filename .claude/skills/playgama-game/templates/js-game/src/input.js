// Keyboard + mouse + touch in one place. Desktop and mobile both work (1.4.4, 1.5.1, 1.5.3).
// Esc is never used (1.5.2): pause is P or the on-screen button.
const KEYS = {
  left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'],
  up: ['ArrowUp', 'KeyW'], down: ['ArrowDown', 'KeyS'],
};
const BLOCK = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space']);

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set();
    this.pointer = { x: 0, y: 0, down: false, id: null, touch: false };
    this.stick = null;          // virtual joystick { ox, oy, x, y } while a touch drags
    this.anyGesture = () => {};
    this.canvas = canvas;

    addEventListener('keydown', (e) => {
      if (BLOCK.has(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      this.anyGesture();
    });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('blur', () => { this.keys.clear(); this.stick = null; this.pointer.down = false; });

    canvas.addEventListener('pointerdown', (e) => {
      this.pointer = { x: e.offsetX, y: e.offsetY, down: true, id: e.pointerId, touch: e.pointerType === 'touch' };
      if (this.pointer.touch) this.stick = { ox: e.offsetX, oy: e.offsetY, x: 0, y: 0 };
      canvas.setPointerCapture?.(e.pointerId);
      this.anyGesture();
    });
    canvas.addEventListener('pointermove', (e) => {
      this.pointer.x = e.offsetX; this.pointer.y = e.offsetY;
      if (this.stick && e.pointerId === this.pointer.id) {
        const dx = e.offsetX - this.stick.ox, dy = e.offsetY - this.stick.oy;
        const len = Math.hypot(dx, dy), max = 60;
        const k = len > max ? max / len : 1;
        this.stick.x = (dx * k) / max; this.stick.y = (dy * k) / max;
      }
    });
    const up = () => { this.pointer.down = false; this.stick = null; };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
    addEventListener('contextmenu', (e) => e.preventDefault());   // 1.4.5
  }

  held(name) { return KEYS[name].some((c) => this.keys.has(c)); }
  /** Returns true once per key press (edge). */
  tap(code) { const had = this.pressed.has(code); this.pressed.delete(code); return had; }

  /** Movement vector from keys or the virtual joystick, -1..1. */
  axis() {
    let x = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    let y = (this.held('down') ? 1 : 0) - (this.held('up') ? 1 : 0);
    if (this.stick) { x = this.stick.x; y = this.stick.y; }
    return { x, y };
  }

  drawStick(ctx) {
    if (!this.stick) return;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = '#fff';
    const dpr = this.dpr || 1;
    ctx.beginPath(); ctx.arc(this.stick.ox * dpr, this.stick.oy * dpr, 60 * dpr, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.arc((this.stick.ox + this.stick.x * 60) * dpr, (this.stick.oy + this.stick.y * 60) * dpr, 26 * dpr, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}
