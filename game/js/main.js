import { MATCH } from './data.js';
import { Match } from './sim.js';
import { Bot } from './bot.js';
import { Platform } from './platform.js';
import { Sound } from './audio.js';
import { draw, W, H, BTN, CARD_SLOTS, inRect, inArena, toTile } from './render.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const match = new Match(Date.now() & 0xffff);
let bot = new Bot(match, 1, match.seed + 99);
const view = { screen: 'menu', paused: false, muted: false, selected: -1, drag: null, showEnd: false };
let endTimer = 0;

// ---------- layout / scaling ----------
function resize() {
  const scale = Math.min(window.innerWidth / W, window.innerHeight / H);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.style.width = `${W * scale}px`;
  canvas.style.height = `${H * scale}px`;
  canvas.width = Math.round(W * scale * dpr);
  canvas.height = Math.round(H * scale * dpr);
  ctx.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
}
window.addEventListener('resize', resize);
resize();

// ---------- game flow ----------
function startMatch() {
  match.reset();
  bot = new Bot(match, 1, match.seed + 99);
  view.screen = 'play';
  view.selected = -1;
  view.drag = null;
  view.showEnd = false;
  endTimer = 0;
}

match.events.on('deploy', () => Sound.deploy());
match.events.on('hit', () => Sound.hit());
match.events.on('boom', () => Sound.boom());
match.events.on('tower', () => Sound.boom());
match.events.on('end', (winner) => {
  view.screen = 'ended';
  view.drag = null;
  endTimer = 0.9;
  if (winner === 0) Sound.win(); else if (winner === 1) Sound.lose();
});

function setPaused(p) {
  if (view.screen !== 'play') return;
  view.paused = p;
  if (p) Sound.suspend(); else Sound.resume();
}
Platform.onFocusChange((hidden) => { if (hidden) setPaused(true); });

// ---------- input ----------
function pointerPos(e) {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H, touch: e.pointerType === 'touch' };
}

function tryDeploy(slot, tile) {
  const ok = match.deploy(0, slot, tile.x, tile.y);
  view.selected = -1;
  return ok;
}

function toggleSfx() {
  view.muted = !view.muted;
  Sound.setMuted(view.muted);
  if (view.muted) Sound.suspend(); else Sound.resume();
  Platform.save({ muted: view.muted });
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  Sound.unlock();
  const p = pointerPos(e);
  if (inRect(p, BTN.sfx)) { toggleSfx(); return; }

  if (view.paused) { setPaused(false); return; }
  if (view.screen === 'menu') {
    if (inRect(p, BTN.play)) startMatch();
    return;
  }
  if (view.screen === 'ended') {
    if (view.showEnd && inRect(p, BTN.again)) {
      Platform.showInterstitial().finally(startMatch);
    }
    return;
  }

  // playing
  const slot = CARD_SLOTS.findIndex((r) => inRect(p, r));
  if (slot >= 0) {
    view.selected = slot;
    view.drag = { active: true, slot, tx: 9, ty: 20, touch: p.touch };
    canvas.setPointerCapture(e.pointerId);
    return;
  }
  if (view.selected >= 0 && inArena(p)) tryDeploy(view.selected, toTile(p));
});

canvas.addEventListener('pointermove', (e) => {
  const d = view.drag;
  if (!d || !d.active) return;
  const p = pointerPos(e);
  const tile = toTile(p);
  d.tx = tile.x;
  d.ty = tile.y - (d.touch ? 2.2 : 0); // keep the ghost above the finger
  d.moved = true;
  d.overArena = inArena(p);
});

function endDrag(e, cancel) {
  const d = view.drag;
  if (!d || !d.active) return;
  d.active = false;
  view.drag = null;
  if (cancel) { view.selected = -1; return; }
  if (d.moved && d.overArena) tryDeploy(d.slot, { x: d.tx, y: d.ty });
  else if (d.moved) view.selected = -1; // dropped outside the arena
}
canvas.addEventListener('pointerup', (e) => endDrag(e, false));
canvas.addEventListener('pointercancel', (e) => endDrag(e, true));

// ---------- loop ----------
let last = performance.now();
let acc = 0;
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if ((view.screen === 'play' || view.screen === 'ended') && !view.paused) {
    acc += dt;
    while (acc >= MATCH.tick) {
      if (view.screen === 'play') { bot.update(MATCH.tick); match.step(MATCH.tick); }
      else match.step(MATCH.tick); // keeps end-of-match effects animating
      acc -= MATCH.tick;
    }
    if (view.screen === 'ended') {
      endTimer -= dt;
      if (endTimer <= 0) view.showEnd = true;
    }
  }
  draw(ctx, match, view);
  requestAnimationFrame(frame);
}

// ---------- boot ----------
(async () => {
  await Platform.init();
  view.muted = !!Platform.load().muted;
  Sound.setMuted(view.muted);
  Platform.gameReady();
  requestAnimationFrame(frame);
})();

// Debug / test hook.
window.__game = { match, view, startMatch, get bot() { return bot; } };
