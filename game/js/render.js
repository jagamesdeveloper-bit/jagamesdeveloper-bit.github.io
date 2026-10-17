import { CARDS, TILE as T, COLS, ROWS, RIVER, BRIDGES, MATCH } from './data.js';
import { t } from './platform.js';

export const W = 360, H = 720, ARENA_Y = 36;
export const ELIXIR_BAR = { x: 6, y: 562, w: 348, h: 22 };
export const CARD_SLOTS = [52, 128, 204, 280].map((x) => ({ x, y: 594, w: 70, h: 116 }));
export const NEXT_SLOT = { x: 6, y: 630, w: 40, h: 56 };
export const BTN = {
  sfx: { x: 4, y: 4, w: 64, h: 28 },
  play: { x: 100, y: 430, w: 160, h: 52 },
  again: { x: 100, y: 440, w: 160, h: 52 },
};
export const inRect = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
export const toTile = (p) => ({ x: p.x / T, y: (p.y - ARENA_Y) / T });
export const inArena = (p) => p.y >= ARENA_Y && p.y <= ARENA_Y + ROWS * T;

const SIDE = ['#3b82f6', '#ef4444'];
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

function rr(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
function text(c, s, x, y, size, color = '#fff', align = 'center', weight = '700') {
  c.font = `${weight} ${size}px ${FONT}`;
  c.textAlign = align;
  c.textBaseline = 'middle';
  c.fillStyle = color;
  c.fillText(s, x, y);
}
function button(c, r, label, fill = '#7c3aed') {
  rr(c, r.x, r.y, r.w, r.h, 10);
  c.fillStyle = fill; c.fill();
  c.lineWidth = 2; c.strokeStyle = '#ffffff55'; c.stroke();
  text(c, label, r.x + r.w / 2, r.y + r.h / 2 + 1, r.h > 40 ? 20 : 12);
}
const sx = (x) => x * T;
const sy = (y) => ARENA_Y + y * T;

function drawArena(c) {
  for (let r = 0; r < ROWS; r++) {
    for (let col = 0; col < COLS; col++) {
      c.fillStyle = (r + col) % 2 ? '#5b9d4b' : '#64a853';
      c.fillRect(col * T, sy(r), T, T);
    }
  }
  c.fillStyle = '#3a86c8';
  c.fillRect(0, sy(RIVER.top), W, (RIVER.bottom - RIVER.top) * T);
  c.fillStyle = '#ffffff22';
  for (let i = 0; i < 6; i++) c.fillRect(i * 66 + 10, sy(RIVER.top) + 12 + (i % 2) * 14, 28, 3);
  for (const b of BRIDGES) {
    c.fillStyle = '#a47c48';
    c.fillRect(sx(b.x - b.half), sy(RIVER.top) - 4, b.half * 2 * T, (RIVER.bottom - RIVER.top) * T + 8);
    c.fillStyle = '#7d5b2e';
    for (let i = 0; i < 6; i++) c.fillRect(sx(b.x - b.half), sy(RIVER.top) + i * 8, b.half * 2 * T, 2);
  }
}

function bar(c, x, y, w, frac, side) {
  c.fillStyle = '#000a';
  c.fillRect(x - w / 2, y, w, 4);
  c.fillStyle = side === 0 ? '#4ade80' : '#f87171';
  c.fillRect(x - w / 2, y, w * Math.max(0, frac), 4);
}

function drawTower(c, tw) {
  const x = sx(tw.x), y = sy(tw.y), s = tw.radius * T;
  if (!tw.alive) {
    c.fillStyle = '#4b4b4b88';
    c.beginPath(); c.arc(x, y, s * 0.8, 0, 7); c.fill();
    return;
  }
  rr(c, x - s, y - s, s * 2, s * 2, 6);
  c.fillStyle = tw.flash > 0 ? '#fff' : SIDE[tw.side];
  c.fill();
  c.lineWidth = 2; c.strokeStyle = '#0006'; c.stroke();
  text(c, tw.type === 'king' ? (tw.awake ? 'K' : 'z') : 'P', x, y + 1, tw.type === 'king' ? 18 : 14);
  bar(c, x, y + s + 3, s * 2, tw.hp / tw.maxHp, tw.side);
}

function drawUnit(c, u) {
  const x = sx(u.x), y = sy(u.y), r = u.radius * T;
  const lift = u.air ? 8 : 0;
  c.globalAlpha = u.deployT > 0 ? 0.5 : 1;
  if (u.air) {
    c.fillStyle = '#0004';
    c.beginPath(); c.ellipse(x, y + 3, r, r * 0.5, 0, 0, 7); c.fill();
  }
  if (u.building) {
    rr(c, x - r, y - r - lift, r * 2, r * 2, 4);
  } else {
    c.beginPath(); c.arc(x, y - lift, r, 0, 7);
  }
  c.fillStyle = u.flash > 0 ? '#fff' : u.color;
  c.fill();
  c.lineWidth = 2.5; c.strokeStyle = SIDE[u.side]; c.stroke();
  text(c, u.icon, x, y - lift + 1, Math.max(9, r * 1.1), '#111');
  c.globalAlpha = 1;
  if (u.deployT > 0) {
    c.strokeStyle = '#fff'; c.lineWidth = 2;
    c.beginPath(); c.arc(x, y - lift, r + 4, -Math.PI / 2, -Math.PI / 2 + (1 - u.deployT / u.deployMax) * Math.PI * 2); c.stroke();
  } else if (u.hp < u.maxHp) {
    bar(c, x, y - lift - r - 7, Math.max(16, r * 2), u.hp / u.maxHp, u.side);
  }
}

function drawFx(c, m) {
  for (const s of m.spells) {
    const k = 1 - s.t / s.max;
    c.strokeStyle = '#ff7a1a'; c.lineWidth = 2;
    c.beginPath(); c.arc(sx(s.x), sy(s.y), s.radius * T, 0, 7); c.stroke();
    c.fillStyle = '#ff7a1a55';
    c.beginPath(); c.arc(sx(s.x), sy(s.y), s.radius * T * k, 0, 7); c.fill();
  }
  for (const f of m.fx) {
    const k = 1 - f.life / f.max;
    if (f.t === 'blast') {
      c.fillStyle = `rgba(255,140,40,${0.7 * (1 - k)})`;
      c.beginPath(); c.arc(sx(f.x), sy(f.y), f.r * T * (0.6 + 0.4 * k), 0, 7); c.fill();
    } else if (f.t === 'puff') {
      c.strokeStyle = `rgba(255,255,255,${1 - k})`; c.lineWidth = 3;
      c.beginPath(); c.arc(sx(f.x), sy(f.y), f.r * T * (0.5 + k), 0, 7); c.stroke();
    } else if (f.t === 'num') {
      c.globalAlpha = 1 - k * k;
      text(c, String(f.text), sx(f.x), sy(f.y) - k * 22, 12, '#fff');
      c.globalAlpha = 1;
    }
  }
  c.fillStyle = '#ffe9a8';
  for (const p of m.projectiles) {
    c.beginPath(); c.arc(sx(p.x), sy(p.y) - 6, p.splash ? 4 : 2.5, 0, 7); c.fill();
  }
}

function drawGhost(c, m, view) {
  const d = view.drag;
  if (!d || !d.active) return;
  const card = CARDS[m.decks[0].hand[d.slot]];
  const ok = m.canDeploy(0, card, d.tx, d.ty) && m.elixir[0] >= card.cost;
  if (card.type === 'spell') {
    c.fillStyle = ok ? '#ff7a1a44' : '#ff000033';
    c.strokeStyle = '#ff7a1a';
    c.beginPath(); c.arc(sx(d.tx), sy(d.ty), card.spell.radius * T, 0, 7); c.fill(); c.stroke();
    return;
  }
  c.fillStyle = ok ? '#4ade8033' : '#ef444433';
  c.fillRect(0, sy(RIVER.bottom + 0.5), W, (ROWS - RIVER.bottom - 0.5) * T);
  const n = card.count;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2, off = n === 1 ? 0 : 0.7;
    c.fillStyle = ok ? 'rgba(255,255,255,0.55)' : 'rgba(239,68,68,0.6)';
    c.beginPath();
    c.arc(sx(d.tx + Math.cos(a) * off), sy(d.ty + Math.sin(a) * off), card.unit.radius * T, 0, 7);
    c.fill();
  }
  if (card.unit.range > 1) {
    c.strokeStyle = '#ffffff66'; c.setLineDash([4, 4]);
    c.beginPath(); c.arc(sx(d.tx), sy(d.ty), (card.unit.range + card.unit.radius) * T, 0, 7); c.stroke();
    c.setLineDash([]);
  }
}

function drawHud(c, m, view) {
  c.fillStyle = '#1f1537';
  c.fillRect(0, 0, W, ARENA_Y);
  button(c, BTN.sfx, view.muted ? t('sfxOff') : t('sfxOn'), '#3b2a63');
  const s = Math.max(0, Math.ceil(m.time));
  const label = m.state === 'overtime' ? t('overtime') : m.state === 'sudden' ? t('sudden') : '';
  text(c, `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`, 180, label ? 11 : 18, 18, label ? '#fbbf24' : '#fff');
  if (label) text(c, label, 180, 27, 9, '#fbbf24');
  text(c, `YOU ${m.crowns[0]}`, 250, 18, 14, SIDE[0]);
  text(c, `${m.crowns[1]} FOE`, 320, 18, 14, '#f87171');

  // Elixir bar
  const e = ELIXIR_BAR;
  c.fillStyle = '#2a1a4a';
  rr(c, e.x, e.y, e.w, e.h, 8); c.fill();
  c.save();
  rr(c, e.x, e.y, e.w, e.h, 8); c.clip();
  c.fillStyle = m.fastElixir() ? '#e879f9' : '#c026d3';
  c.fillRect(e.x, e.y, e.w * (m.elixir[0] / MATCH.elixirMax), e.h);
  c.fillStyle = '#ffffff33';
  for (let i = 1; i < 10; i++) c.fillRect(e.x + (e.w / 10) * i, e.y, 1, e.h);
  c.restore();
  text(c, String(Math.floor(m.elixir[0])), e.x + 14, e.y + e.h / 2 + 1, 14);

  // Hand
  const deck = m.decks[0];
  deck.hand.forEach((id, i) => drawCard(c, CARDS[id], CARD_SLOTS[i], m.elixir[0], view.selected === i || (view.drag && view.drag.active && view.drag.slot === i)));
  drawCard(c, CARDS[deck.queue[0]], NEXT_SLOT, 99, false, true);
  text(c, t('next'), NEXT_SLOT.x + NEXT_SLOT.w / 2, NEXT_SLOT.y - 8, 9, '#c4b5fd');
}

function drawCard(c, card, r, elixir, selected, small = false) {
  const afford = elixir >= card.cost;
  const lift = selected ? -8 : 0;
  rr(c, r.x, r.y + lift, r.w, r.h, 8);
  c.fillStyle = afford ? '#3b2a63' : '#2a2142';
  c.fill();
  c.lineWidth = selected ? 3 : 2;
  c.strokeStyle = selected ? '#fbbf24' : '#7c6ab0';
  c.stroke();
  const color = card.type === 'spell' ? card.color : card.unit.color;
  const icon = card.type === 'spell' ? card.icon : card.unit.icon;
  c.globalAlpha = afford ? 1 : 0.45;
  c.fillStyle = color;
  c.beginPath(); c.arc(r.x + r.w / 2, r.y + lift + r.h * (small ? 0.5 : 0.42), r.w * (small ? 0.3 : 0.3), 0, 7); c.fill();
  text(c, icon, r.x + r.w / 2, r.y + lift + r.h * (small ? 0.5 : 0.42) + 1, small ? 14 : 24, '#111');
  c.globalAlpha = 1;
  if (!small) {
    text(c, card.name, r.x + r.w / 2, r.y + lift + r.h - 12, card.name.length > 8 ? 10 : 12);
    c.fillStyle = '#c026d3';
    c.beginPath(); c.arc(r.x + 13, r.y + lift + 13, 11, 0, 7); c.fill();
    text(c, String(card.cost), r.x + 13, r.y + lift + 14, 13);
  }
}

function drawOverlay(c, m, view) {
  const dim = () => { c.fillStyle = 'rgba(10,5,25,0.72)'; c.fillRect(0, 0, W, H); };
  if (view.screen === 'menu') {
    dim();
    text(c, t('title'), W / 2, 250, 44, '#fbbf24');
    text(c, 'Real-time lane battler', W / 2, 296, 14, '#c4b5fd', 'center', '500');
    text(c, t('hint'), W / 2, 330, 12, '#c4b5fd', 'center', '500');
    button(c, BTN.play, t('play'));
  } else if (view.screen === 'ended' && view.showEnd) {
    dim();
    const w = m.winner;
    text(c, w === 0 ? t('victory') : w === 1 ? t('defeat') : t('draw'), W / 2, 280, 40, w === 0 ? '#fbbf24' : w === 1 ? '#f87171' : '#e5e7eb');
    text(c, `${m.crowns[0]}  -  ${m.crowns[1]}`, W / 2, 340, 34);
    button(c, BTN.again, t('again'));
  }
  if (view.paused && view.screen === 'play') {
    dim();
    text(c, t('paused'), W / 2, 340, 36);
    text(c, t('resume'), W / 2, 384, 15, '#c4b5fd', 'center', '500');
  }
}

export function draw(c, m, view) {
  c.fillStyle = '#120a22';
  c.fillRect(0, 0, W, H);
  drawArena(c);
  if (view.drag && view.drag.active) {
    const card = CARDS[m.decks[0].hand[view.drag.slot]];
    if (card.type !== 'spell') {
      c.fillStyle = '#ef444422';
      c.fillRect(0, ARENA_Y, W, (RIVER.bottom + 0.5) * T);
    }
  }
  for (const tw of m.towers) drawTower(c, tw);
  const ground = m.units.filter((u) => !u.air).sort((a, b) => a.y - b.y);
  for (const u of ground) drawUnit(c, u);
  drawFx(c, m);
  for (const u of m.units) if (u.air) drawUnit(c, u);
  drawGhost(c, m, view);
  drawHud(c, m, view);
  drawOverlay(c, m, view);
}
