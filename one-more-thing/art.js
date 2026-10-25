/* Hand-inked storybook drawing for ONE MORE THING: the giant's room, the loot and the little burglar.
   Everything is vector + a little deliberate wobble so nothing looks machine-perfect. */
(function () {
  'use strict';
  const W = 2500, H = 1000, FLOOR = 900;
  const TAU = Math.PI * 2;
  const INK = '#2a1a2e';
  const SERIF = 'Georgia, "Palatino Linotype", "Book Antiqua", "Noto Serif", serif';
  const SANS = 'system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

  /* ---------------------------------------------------------------- hand-drawn helpers */
  function hash(a, b) {
    let h = Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;

  // hand-cut rounded rectangle: corners and edges are nudged deterministically
  function rr(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    const s = Math.round(x * 7 + y * 13 + w * 3 + h * 5), k = Math.min(1, Math.min(w, h) / 14);
    const J = (i) => (hash(s, i) - 0.5) * 1.7 * k;
    c.beginPath();
    c.moveTo(x + r, y + J(1));
    c.quadraticCurveTo(x + w / 2, y + J(2) * 1.5, x + w - r, y + J(3));
    c.quadraticCurveTo(x + w + J(4), y + J(5), x + w + J(6), y + r);
    c.quadraticCurveTo(x + w + J(7) * 1.5, y + h / 2, x + w + J(8), y + h - r);
    c.quadraticCurveTo(x + w + J(9), y + h + J(10), x + w - r, y + h + J(11));
    c.quadraticCurveTo(x + w / 2, y + h + J(12) * 1.5, x + r, y + h + J(13));
    c.quadraticCurveTo(x + J(14), y + h + J(15), x + J(16), y + h - r);
    c.quadraticCurveTo(x + J(17) * 1.5, y + h / 2, x + J(18), y + r);
    c.quadraticCurveTo(x + J(19), y + J(20), x + r, y + J(1));
    c.closePath();
  }
  // slightly lumpy ellipse
  function blob(c, cx, cy, rx, ry, seed) {
    const n = 18, p = [];
    for (let i = 0; i < n; i++) { const a = i / n * TAU, k = 1 + (hash(seed | 0, i) - 0.5) * 0.07; p.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]); }
    c.beginPath();
    c.moveTo((p[n - 1][0] + p[0][0]) / 2, (p[n - 1][1] + p[0][1]) / 2);
    for (let i = 0; i < n; i++) { const a = p[i], b = p[(i + 1) % n]; c.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2); }
    c.closePath();
  }
  // ink outline with a faint offset "second pass" like a pen that was re-gone-over
  function inkStroke(c, lw) {
    c.lineWidth = lw || 2.4; c.strokeStyle = INK; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke();
    c.save(); c.translate(0.8, 0.7); c.globalAlpha = 0.26; c.lineWidth = Math.max(0.8, (lw || 2.4) * 0.4); c.stroke(); c.restore();
  }
  function fillStroke(c, fill, lw) { c.fillStyle = fill; c.fill(); inkStroke(c, lw); }
  // cel shade the current path: warm light top-left, cool shadow bottom-right
  function shade(c, x, y, w, h, k) {
    k = k === undefined ? 1 : k;
    c.save(); c.clip();
    const g = c.createLinearGradient(x, y, x + w * 0.8, y + h);
    g.addColorStop(0, 'rgba(255,238,200,' + 0.26 * k + ')'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(25,5,45,' + 0.32 * k + ')');
    c.fillStyle = g; c.fillRect(x - 6, y - 6, w + 12, h + 12); c.restore();
  }
  function hatch(c, x, y, w, h, gap, alpha) {
    c.save(); c.clip(); c.strokeStyle = 'rgba(30,10,40,' + alpha + ')'; c.lineWidth = 1.1; c.beginPath();
    for (let d = -h; d < w; d += gap) { c.moveTo(x + d, y + h); c.lineTo(x + d + h * 0.75, y); }
    c.stroke(); c.restore();
  }
  function shaded(c, fill, x, y, w, h, lw, k) { c.fillStyle = fill; c.fill(); shade(c, x, y, w, h, k); inkStroke(c, lw); }
  function lin(c, x0, y0, x1, y1, stops) { const g = c.createLinearGradient(x0, y0, x1, y1); for (const s of stops) g.addColorStop(s[0], s[1]); return g; }
  function vis(v, x0, y0, x1, y1) { return !(x1 < v.x0 || x0 > v.x1 || y1 < v.y0 || y0 > v.y1); }
  function text(c, str, x, y, size, color, align, font, stroke) {
    c.font = '800 ' + size + 'px ' + (font || SERIF); c.textAlign = align || 'center'; c.textBaseline = 'alphabetic';
    if (stroke) { c.lineJoin = 'round'; c.lineWidth = size * 0.2; c.strokeStyle = stroke; c.strokeText(str, x, y); }
    c.fillStyle = color; c.fillText(str, x, y);
  }
  function rng(seed) { let a = seed >>> 0; return function () { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

  /* ---------------------------------------------------------------- the room */
  function Art_rumble() { return window.Art ? window.Art.rumble : 0; }

  function leaf(c, x, y, side, s) {
    c.save(); c.translate(x, y); c.rotate(side * (0.7 + hash(s, 1) * 0.5));
    c.fillStyle = 'rgba(150,185,120,0.2)'; c.beginPath(); c.ellipse(side * 9, 0, 10, 4, 0, 0, TAU); c.fill();
    c.restore();
    if (hash(s, 2) > 0.55) { c.fillStyle = 'rgba(225,120,105,0.22)'; c.beginPath(); c.arc(x + side * 15, y - 5, 3.4, 0, TAU); c.fill(); }
  }

  function wall(c, v, t, awake) {
    c.fillStyle = lin(c, 0, 0, 0, FLOOR, [[0, '#2d1f3d'], [0.55, '#472a49'], [1, '#5c3450']]);
    c.fillRect(-20, -20, W + 40, FLOOR + 20);
    for (let x = 0; x < W; x += 110) {
      if (x + 110 < v.x0 || x > v.x1) continue;
      c.fillStyle = 'rgba(255,215,235,0.055)'; c.fillRect(x, 30, 55, 620);
      const cx = x + 27;
      c.strokeStyle = 'rgba(130,170,110,0.18)'; c.lineWidth = 1.8; c.beginPath(); c.moveTo(cx, 30);
      for (let y = 30; y < 650; y += 18) c.lineTo(cx + Math.sin(y * 0.045 + x) * 7, y);
      c.stroke();
      for (let y = 70; y < 640; y += 88) leaf(c, cx + Math.sin(y * 0.045 + x) * 7, y, ((x / 110 + y / 88) | 0) & 1 ? 1 : -1, x * 3 + y);
    }
    c.strokeStyle = 'rgba(0,0,0,0.18)'; c.lineWidth = 2;
    for (let x = 530; x < W; x += 520) { if (x < v.x0 || x > v.x1) continue; c.beginPath(); c.moveTo(x, 30); c.lineTo(x + 1, 650); c.stroke(); }
    // damp stains + a faint smoke halo above the lamp
    for (const s of [[190, 120, 190], [2150, 110, 220], [1480, 70, 140], [700, 560, 150]]) {
      if (!vis(v, s[0] - s[2], s[1] - s[2], s[0] + s[2], s[1] + s[2])) continue;
      const g = c.createRadialGradient(s[0], s[1], 0, s[0], s[1], s[2]); g.addColorStop(0, 'rgba(15,0,25,0.16)'); g.addColorStop(1, 'rgba(15,0,25,0)');
      c.fillStyle = g; c.fillRect(s[0] - s[2], s[1] - s[2], s[2] * 2, s[2] * 2);
    }
    // crown moulding with dentils
    c.fillStyle = '#24162d'; c.fillRect(-20, 0, W + 40, 26);
    c.fillStyle = '#4a3057'; c.fillRect(-20, 26, W + 40, 6);
    c.fillStyle = '#3a2547';
    for (let x = 0; x < W; x += 16) { if (x < v.x0 - 16 || x > v.x1) continue; c.fillRect(x + 3, 8, 8, 12); }
    // wainscot panelling
    c.fillStyle = '#42263a'; c.fillRect(-20, 650, W + 40, FLOOR - 650);
    c.fillStyle = '#6d4259'; c.fillRect(-20, 644, W + 40, 13);
    c.fillStyle = 'rgba(0,0,0,0.3)'; c.fillRect(-20, 657, W + 40, 5);
    for (let x = 20; x < W; x += 170) {
      if (x + 150 < v.x0 || x > v.x1) continue;
      rr(c, x, 690, 150, 160, 3); c.fillStyle = '#4a2b40'; c.fill();
      c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,0.4)'; c.beginPath(); c.moveTo(x, 850); c.lineTo(x, 690); c.lineTo(x + 150, 690); c.stroke();
      c.strokeStyle = 'rgba(255,200,230,0.14)'; c.beginPath(); c.moveTo(x + 150, 690); c.lineTo(x + 150, 850); c.lineTo(x, 850); c.stroke();
    }
    c.fillStyle = '#2c1a26'; c.fillRect(-20, 872, W + 40, 28);
    c.fillStyle = '#573646'; c.fillRect(-20, 872, W + 40, 4);
    c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(-20, 897, W + 40, 3);
  }

  function windowArt(c, t) {
    const x = 540, y = 110, w = 260, h = 330;
    // a bar of moonlight is added in the light pass; here the pane
    rr(c, x - 14, y - 14, w + 28, h + 28, 8); fillStroke(c, '#74492f', 3);
    c.beginPath(); c.rect(x, y, w, h);
    c.fillStyle = lin(c, 0, y, 0, y + h, [[0, '#0a1034'], [0.65, '#20306f'], [1, '#3a4d96']]); c.fill();
    c.save(); c.beginPath(); c.rect(x, y, w, h); c.clip();
    const r = rng(7);
    for (let i = 0; i < 30; i++) {
      const sx = x + r() * w, sy = y + r() * h * 0.7, tw = 0.5 + 0.5 * Math.sin(t * 2 + i * 1.7);
      c.fillStyle = 'rgba(255,255,230,' + (0.3 + tw * 0.65) + ')'; c.fillRect(sx, sy, i % 4 === 0 ? 3 : 2, i % 4 === 0 ? 3 : 2);
    }
    const g = c.createRadialGradient(x + 170, y + 100, 8, x + 170, y + 100, 96);
    g.addColorStop(0, 'rgba(255,250,220,0.55)'); g.addColorStop(1, 'rgba(255,250,220,0)'); c.fillStyle = g; c.fillRect(x, y, w, h);
    blob(c, x + 170, y + 100, 34, 34, 3); c.fillStyle = '#fbf0cc'; c.fill();
    c.fillStyle = 'rgba(200,185,140,0.55)'; c.beginPath(); c.arc(x + 158, y + 92, 7, 0, TAU); c.arc(x + 181, y + 113, 5, 0, TAU); c.arc(x + 184, y + 88, 3.5, 0, TAU); c.fill();
    // little clouds drifting
    const cx = ((t * 6) % (w + 120)) - 60;
    c.fillStyle = 'rgba(40,55,120,0.8)'; c.beginPath(); c.ellipse(x + cx, y + 170, 46, 9, 0, 0, TAU); c.ellipse(x + cx + 22, y + 164, 28, 9, 0, 0, TAU); c.fill();
    c.fillStyle = '#0a0f2b'; c.beginPath(); c.moveTo(x, y + h);
    [[0, 292], [26, 252], [58, 252], [58, 272], [108, 272], [140, 232], [170, 272], [222, 262], [262, 302], [262, 330]].forEach(p => c.lineTo(x + p[0], y + p[1]));
    c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,214,120,0.8)'; c.fillRect(x + 66, y + 280, 4, 5); c.fillRect(x + 118, y + 282, 4, 5); c.fillRect(x + 190, y + 276, 4, 5);
    c.restore();
    c.fillStyle = '#74492f'; c.fillRect(x + w / 2 - 5, y, 10, h); c.fillRect(x, y + h * 0.45, w, 10);
    c.strokeStyle = INK; c.lineWidth = 2.4; c.strokeRect(x, y, w, h);
    rr(c, x - 28, y + h + 12, w + 56, 16, 4); fillStroke(c, '#8a5c37', 3);
    const sway = Math.sin(t * 0.7) * 2.2;
    for (const side of [-1, 1]) {
      const cx2 = side < 0 ? x - 30 : x + w + 30;
      c.beginPath(); c.moveTo(cx2 - side * 4, y - 30); c.lineTo(cx2 + side * 62 + sway, y - 30);
      c.quadraticCurveTo(cx2 + side * 40 + sway, y + h * 0.5, cx2 + side * 56 + sway, y + h + 4);
      c.lineTo(cx2 - side * 18, y + h + 4); c.quadraticCurveTo(cx2 - side * 28, y + h * 0.4, cx2 - side * 4, y - 30);
      c.fillStyle = lin(c, cx2 - 20, 0, cx2 + 60, 0, [[0, '#78294f'], [0.5, '#9b3a6c'], [1, '#68203f']]); c.fill();
      c.save(); c.clip(); c.strokeStyle = 'rgba(0,0,0,0.2)'; c.lineWidth = 3;
      for (let i = 1; i < 5; i++) { c.beginPath(); c.moveTo(cx2 + side * i * 12, y - 28); c.quadraticCurveTo(cx2 + side * (i * 11 + 6), y + h * 0.5, cx2 + side * (i * 12 + 3), y + h); c.stroke(); }
      c.restore(); inkStroke(c, 2.6);
    }
    rr(c, x - 60, y - 44, w + 120, 16, 7); fillStroke(c, '#8e6038', 3);
    for (const k of [x - 62, x + w + 46]) { c.beginPath(); c.arc(k + 8, y - 36, 9, 0, TAU); fillStroke(c, '#d2a04a', 2.4); }
  }

  function wantedPoster(c, x, y) {
    c.save(); c.translate(x + 40, y + 60); c.rotate(-0.04); c.translate(-40, -60);
    rr(c, 0, 0, 84, 120, 2); fillStroke(c, '#e8d9b0', 2);
    c.fillStyle = 'rgba(120,80,30,0.12)'; c.beginPath(); c.arc(70, 100, 26, 0, TAU); c.fill();
    text(c, 'WANTED', 42, 22, 17, '#8a1f1f', 'center', SERIF);
    // pencil sketch of the burglar
    c.strokeStyle = '#3a2b33'; c.lineWidth = 1.6; c.fillStyle = '#3a2b33';
    c.beginPath(); c.arc(42, 54, 15, 0, TAU); c.stroke();
    c.beginPath(); c.moveTo(27, 50); c.quadraticCurveTo(42, 28, 57, 50); c.lineTo(57, 46); c.quadraticCurveTo(42, 22, 27, 46); c.closePath(); c.fill();
    c.fillRect(28, 52, 28, 6);
    c.fillStyle = '#e8d9b0'; c.fillRect(33, 54, 5, 3); c.fillRect(46, 54, 5, 3);
    c.beginPath(); c.moveTo(36, 66); c.quadraticCurveTo(42, 70, 49, 65); c.stroke();
    c.beginPath(); c.moveTo(26, 82); c.lineTo(58, 82); c.moveTo(30, 90); c.lineTo(54, 90); c.stroke();
    text(c, 'TINY THIEF', 42, 104, 9.5, '#3a2b33', 'center', SANS);
    text(c, 'REWARD: CHEESE', 42, 115, 8, '#8a1f1f', 'center', SANS);
    c.fillStyle = 'rgba(255,255,255,0.4)'; c.fillRect(30, -5, 24, 10); c.restore();
  }

  function decor(c, v, t, awake) {
    if (vis(v, 1380, 290, 1500, 440)) {
      rr(c, 1388, 296, 104, 134, 5); fillStroke(c, '#c9983a', 4);
      rr(c, 1398, 306, 84, 114, 2); fillStroke(c, '#2c4a63', 2);
      blob(c, 1440, 372, 26, 25, 11); fillStroke(c, '#e0853a', 2.4);
      c.fillStyle = '#e0853a';
      c.beginPath(); c.moveTo(1418, 358); c.lineTo(1414, 331); c.lineTo(1435, 349); c.closePath(); fillStroke(c, '#e0853a', 2.2);
      c.beginPath(); c.moveTo(1462, 358); c.lineTo(1466, 331); c.lineTo(1445, 349); c.closePath(); fillStroke(c, '#e0853a', 2.2);
      c.fillStyle = '#fff'; c.beginPath(); c.ellipse(1431, 368, 5, 6, 0, 0, TAU); c.ellipse(1449, 368, 5, 6, 0, 0, TAU); c.fill();
      c.fillStyle = INK; c.beginPath(); c.ellipse(1431, 369, 1.6, 5, 0, 0, TAU); c.ellipse(1449, 369, 1.6, 5, 0, 0, TAU); c.fill();
      c.strokeStyle = INK; c.lineWidth = 1.5; c.beginPath(); c.moveTo(1432, 382); c.quadraticCurveTo(1440, 388, 1448, 382); c.stroke();
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(1440 + s * 6, 380 + i * 2); c.lineTo(1440 + s * 24, 376 + i * 5); c.stroke(); }
      text(c, 'MR. WHISKERS', 1440, 414, 9.5, '#f3d97a', 'center', SERIF);
    }
    if (vis(v, 320, 500, 430, 650)) wantedPoster(c, 330, 518);
    // wall calendar
    if (vis(v, 450, 520, 550, 650)) {
      c.save(); c.translate(470, 548); c.rotate(0.03);
      rr(c, 0, 0, 70, 92, 2); fillStroke(c, '#f2ead2', 2);
      c.fillStyle = '#b8402f'; c.fillRect(1, 1, 68, 20);
      text(c, 'OCT', 35, 17, 13, '#fff1d8', 'center', SERIF);
      c.strokeStyle = 'rgba(40,20,40,0.45)'; c.lineWidth = 1;
      for (let i = 0; i < 5; i++) for (let j = 0; j < 6; j++) c.strokeRect(4 + j * 10.5, 26 + i * 12, 9, 10);
      c.strokeStyle = '#c4301f'; c.lineWidth = 2; c.beginPath(); c.ellipse(46, 50, 6, 6, 0, 0, TAU); c.stroke();
      c.fillStyle = '#c4301f'; c.beginPath(); c.arc(35, -4, 3, 0, TAU); c.fill();
      c.restore();
    }
    if (vis(v, 1730, 180, 1830, 280)) {
      blob(c, 1780, 230, 44, 44, 5); fillStroke(c, '#7a4a2a', 4);
      blob(c, 1780, 230, 36, 36, 6); fillStroke(c, '#f1e8cf', 2);
      c.fillStyle = INK;
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; c.fillRect(1780 + Math.sin(a) * 30 - 1.5, 230 - Math.cos(a) * 30 - 1.5, 3, 3); }
      const m = t * 0.02, hh = t * 0.0017;
      c.lineCap = 'round'; c.lineWidth = 3.6; c.strokeStyle = INK;
      c.beginPath(); c.moveTo(1780, 230); c.lineTo(1780 + Math.sin(hh) * 18, 230 - Math.cos(hh) * 18); c.stroke();
      c.lineWidth = 2.4; c.beginPath(); c.moveTo(1780, 230); c.lineTo(1780 + Math.sin(m) * 28, 230 - Math.cos(m) * 28); c.stroke();
      c.lineCap = 'butt';
    }
    // light switch
    rr(c, 270, 590, 20, 32, 3); fillStroke(c, '#e6dcc4', 2); c.fillStyle = INK; c.fillRect(278, 598, 4, 9);
    // hanging lamp + moth
    c.save(); c.translate(1250, 26); c.rotate((Art_rumble() || 0) * Math.sin(t * 3.1) * 0.2); c.translate(-1250, -26);
    c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.moveTo(1250, 26); c.lineTo(1250, 108); c.stroke();
    c.beginPath(); c.moveTo(1214, 152); c.quadraticCurveTo(1250, 98, 1286, 152); c.closePath(); fillStroke(c, awake ? '#ffe9a6' : '#e6b050', 3);
    c.strokeStyle = 'rgba(40,10,10,0.35)'; c.lineWidth = 1; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(1250 + i * 6, 108 + Math.abs(i) * 4); c.lineTo(1250 + i * 12, 150); c.stroke(); }
    c.beginPath(); c.arc(1250, 154, 8, 0, TAU); c.fillStyle = awake ? '#fff' : '#ffeaa0'; c.fill();
    const ma = t * 2.2, mx = 1250 + Math.cos(ma) * 46, my = 150 + Math.sin(ma * 1.7) * 22, fl = Math.sin(t * 38) * 4;
    c.fillStyle = 'rgba(235,225,200,0.9)'; c.beginPath(); c.ellipse(mx - 3, my - 1, 4, 2.2 + Math.abs(fl) * 0.4, -0.5, 0, TAU); c.ellipse(mx + 3, my - 1, 4, 2.2 + Math.abs(fl) * 0.4, 0.5, 0, TAU); c.fill();
    c.fillStyle = '#4a3a30'; c.fillRect(mx - 1, my - 2, 2, 5);
    c.restore();
  }

  function floor(c, v, t, state) {
    c.fillStyle = lin(c, 0, FLOOR, 0, H, [[0, '#7a4829'], [1, '#3f2315']]);
    c.fillRect(-20, FLOOR, W + 40, H - FLOOR + 400);
    c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-20, 948); c.lineTo(W + 20, 948); c.stroke();
    for (let x = 0; x < W; x += 150) {
      if (x < v.x0 - 150 || x > v.x1) continue;
      c.beginPath(); c.moveTo(x + 40, FLOOR); c.lineTo(x + 40 + hash(x, 1) * 3, 948); c.stroke();
      c.beginPath(); c.moveTo(x + 115, 948); c.lineTo(x + 115 - hash(x, 2) * 3, H + 60); c.stroke();
      c.strokeStyle = 'rgba(255,200,140,0.07)'; c.lineWidth = 1.4;
      for (let k = 0; k < 4; k++) { const gy = 912 + k * 12 + hash(x, 5 + k) * 6; c.beginPath(); c.moveTo(x + 48, gy); c.quadraticCurveTo(x + 80, gy + hash(x, 9 + k) * 5 - 2.5, x + 108, gy); c.stroke(); }
      c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 2;
    }
    c.fillStyle = 'rgba(255,220,170,0.06)'; c.fillRect(-20, FLOOR, W + 40, 4);
    // rug with fringe
    if (vis(v, 400, 900, 1600, 1000)) {
      for (let x = 470; x < 1540; x += 9) { const e = Math.abs(x - 1000) / 540; if (e > 0.98) continue; const y = 944 + Math.sqrt(1 - e * e) * 38; c.strokeStyle = '#d9c9a0'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, y - 2); c.lineTo(x + hash(x, 3) * 3 - 1.5, y + 7); c.stroke(); }
      blob(c, 1000, 944, 548, 38, 21); fillStroke(c, '#7a2a3f', 3);
      c.save(); c.clip(); shade(c, 450, 906, 1100, 76, 0.7); c.restore();
      blob(c, 1000, 944, 504, 29, 22); c.strokeStyle = '#e1b155'; c.lineWidth = 3; c.setLineDash([14, 10]); c.stroke(); c.setLineDash([]);
      blob(c, 1000, 944, 360, 18, 23); c.strokeStyle = 'rgba(240,200,200,0.35)'; c.lineWidth = 2; c.stroke();
    }
  }

  function clutter(c, v, t) {
    // dust bunnies, a giant sock, a toy brick, crumbs: lived-in floor details
    for (const d of [[352, 928, 0], [1388, 960, 1], [2440, 930, 2], [880, 975, 3]]) {
      if (!vis(v, d[0] - 20, 900, d[0] + 20, 1000)) continue;
      c.fillStyle = 'rgba(190,180,185,0.55)';
      for (let i = 0; i < 7; i++) { c.beginPath(); c.arc(d[0] + (hash(d[2], i) - 0.5) * 18, d[1] + (hash(d[2], i + 9) - 0.5) * 6, 3 + hash(d[2], i + 5) * 4, 0, TAU); c.fill(); }
    }
    if (vis(v, 1360, 910, 1560, 990)) {
      c.save(); c.translate(1460, 946); c.rotate(-0.08);
      c.beginPath(); c.moveTo(-70, -12); c.quadraticCurveTo(-30, -20, 20, -12); c.quadraticCurveTo(52, -10, 62, 6); c.quadraticCurveTo(68, 22, 46, 24); c.quadraticCurveTo(26, 22, 14, 12); c.quadraticCurveTo(-30, 18, -70, 14); c.closePath();
      fillStroke(c, '#c9d8ea', 2.6);
      c.save(); c.clip(); c.fillStyle = '#6a8fc4'; for (let i = -64; i < 20; i += 16) c.fillRect(i, -22, 6, 50); c.fillStyle = '#e8b1b1'; c.fillRect(30, -4, 40, 30); c.restore();
      c.beginPath(); c.arc(-62, 1, 2, 0, TAU); c.fillStyle = 'rgba(0,0,0,0.25)'; c.fill();
      c.restore();
    }
    if (vis(v, 1960, 920, 2040, 990)) {
      c.save(); c.translate(2000, 952); c.rotate(0.12);
      rr(c, -26, -9, 52, 20, 2); fillStroke(c, '#c43a32', 2.2); c.save(); c.clip(); shade(c, -26, -9, 52, 20, 0.8); c.restore();
      for (let i = 0; i < 4; i++) { rr(c, -22 + i * 11, -14, 8, 6, 1.5); fillStroke(c, '#c43a32', 1.8); }
      c.restore();
    }
    c.fillStyle = 'rgba(235,205,140,0.8)'; for (const p of [[760, 960], [772, 966], [748, 969], [1120, 958]]) { c.fillRect(p[0], p[1], 3, 2); }
    // pizza crust
    if (vis(v, 1180, 960, 1260, 990)) { c.save(); c.translate(1220, 975); c.rotate(-0.3); rr(c, -22, -6, 44, 12, 6); fillStroke(c, '#d9a35a', 2); c.fillStyle = '#c4452f'; c.fillRect(-15, -3, 14, 6); c.restore(); }
  }

  function wallShadow(c, x, y, w, h, r) {
    for (let i = 0; i < 3; i++) { c.fillStyle = 'rgba(10,0,22,0.085)'; rr(c, x + 10 + i * 5, y + 4 + i * 4, w + i * 3, h + i * 3, r || 6); c.fill(); }
  }
  function floorShadow(c, x, w) {
    const g = c.createRadialGradient(x, FLOOR + 6, 2, x, FLOOR + 6, w / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.42)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.save(); c.translate(0, FLOOR + 6); c.scale(1, 0.14); c.translate(0, -(FLOOR + 6)); c.fillStyle = g; c.fillRect(x - w / 2, FLOOR - w / 2, w, w); c.restore();
  }
  function woodGrain(c, x, y, w, h, seed, alpha) {
    c.save(); c.clip(); c.strokeStyle = 'rgba(40,15,10,' + (alpha || 0.18) + ')'; c.lineWidth = 1.2;
    for (let i = 0; i < Math.max(2, h / 5); i++) {
      const gy = y + 3 + i * (h / Math.max(2, h / 5)); c.beginPath(); c.moveTo(x, gy);
      c.bezierCurveTo(x + w * 0.3, gy + (hash(seed, i) - 0.5) * 4, x + w * 0.7, gy + (hash(seed, i + 40) - 0.5) * 4, x + w, gy); c.stroke();
    }
    c.restore();
  }

  function furniture(c, v, t, state) {
    // --- stool
    if (vis(v, 370, 830, 490, 905)) {
      floorShadow(c, 430, 120);
      for (const [x0, x1] of [[396, 383], [464, 477], [430, 430]]) {
        c.beginPath(); c.moveTo(x0 - 5, 856); c.lineTo(x1 - 5, FLOOR); c.lineTo(x1 + 5, FLOOR); c.lineTo(x0 + 5, 856); c.closePath(); fillStroke(c, '#76472b', 2.8); woodGrain(c, x1 - 5, 856, 10, 44, x0, 0.25);
      }
      c.fillStyle = '#76472b'; c.beginPath(); c.moveTo(380, 893); c.lineTo(392, 880); c.lineTo(396, 888); c.closePath(); // chewed foot
      c.fillStyle = 'rgba(0,0,0,0.25)'; c.fillRect(388, 872, 9, 3);
      rr(c, 380, 838, 100, 22, 10); shaded(c, '#b3446b', 380, 838, 100, 22, 3);
      c.strokeStyle = 'rgba(40,0,20,0.35)'; c.lineWidth = 1.6; c.setLineDash([3, 3]); c.beginPath(); c.moveTo(388, 856); c.lineTo(472, 856); c.stroke(); c.setLineDash([]);
      for (const bx of [394, 430, 466]) { c.beginPath(); c.arc(bx, 849, 3, 0, TAU); fillStroke(c, '#dcae4a', 1.6); }
    }
    // --- coffee table
    if (vis(v, 550, 760, 890, 905)) {
      floorShadow(c, 720, 360);
      for (const lx of [586, 826]) {
        c.beginPath(); c.moveTo(lx - 12, 806); c.lineTo(lx + 12, 806); c.lineTo(lx + 6, 836); c.lineTo(lx + 13, 852); c.lineTo(lx + 5, FLOOR); c.lineTo(lx - 5, FLOOR); c.lineTo(lx - 13, 852); c.lineTo(lx - 6, 836); c.closePath();
        shaded(c, '#8a5833', lx - 13, 806, 26, 94, 2.8); woodGrain(c, lx - 12, 806, 24, 94, lx, 0.2);
      }
      rr(c, 566, 790, 308, 16, 3); shaded(c, '#764a2b', 566, 790, 308, 16, 2.8);
      rr(c, 650, 792, 140, 12, 3); fillStroke(c, '#6a4026', 1.8); c.beginPath(); c.arc(720, 798, 3, 0, TAU); fillStroke(c, '#dcae4a', 1.4);
      rr(c, 560, 770, 320, 22, 5); shaded(c, '#b87b44', 560, 770, 320, 22, 3); woodGrain(c, 560, 770, 320, 22, 77, 0.2);
      c.fillStyle = 'rgba(255,248,235,0.88)'; blob(c, 700, 772, 64, 5, 31); c.fill();
      c.strokeStyle = 'rgba(60,30,20,0.35)'; c.lineWidth = 2; c.beginPath(); c.ellipse(805, 772, 9, 2.5, 0, 0, TAU); c.stroke();
    }
    // --- sofa
    if (vis(v, 910, 680, 1350, 905)) {
      wallShadow(c, 930, 690, 400, 112, 18); floorShadow(c, 1130, 460);
      rr(c, 930, 690, 400, 112, 20); shaded(c, '#2a7068', 930, 690, 400, 112, 3.2);
      // tufting
      c.save(); c.clip(); c.strokeStyle = 'rgba(0,0,0,0.22)'; c.lineWidth = 2.4;
      for (const bx of [1063, 1197]) { c.beginPath(); c.moveTo(bx, 698); c.lineTo(bx, 800); c.stroke(); }
      for (const bx of [996, 1130, 1264]) for (const by of [722, 764]) { c.beginPath(); c.moveTo(bx - 20, by); c.quadraticCurveTo(bx, by - 8, bx + 20, by); c.stroke(); }
      c.restore();
      c.fillStyle = '#e8b04a'; for (const bx of [1063, 1197]) for (const by of [722, 760]) { c.beginPath(); c.arc(bx, by, 3.6, 0, TAU); fillStroke(c, '#e8b04a', 1.4); }
      rr(c, 996, 792, 270, 70, 12); shaded(c, '#38887f', 996, 792, 270, 70, 3.2);
      c.strokeStyle = 'rgba(0,0,0,0.2)'; c.lineWidth = 2; c.beginPath(); c.moveTo(1131, 802); c.lineTo(1131, 858); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.15)'; c.beginPath(); c.moveTo(1006, 799); c.lineTo(1256, 799); c.stroke();
      rr(c, 918, 744, 84, 142, 22); shaded(c, '#246760', 918, 744, 84, 142, 3.2);
      rr(c, 1256, 744, 84, 142, 22); shaded(c, '#246760', 1256, 744, 84, 142, 3.2);
      // knitted throw over the right arm
      c.save(); c.translate(1298, 746);
      c.beginPath(); c.moveTo(-34, 4); c.quadraticCurveTo(0, -8, 34, 8); c.lineTo(40, 72); c.lineTo(-30, 70); c.closePath(); fillStroke(c, '#c85a3a', 2.6);
      c.save(); c.clip(); c.fillStyle = '#e8c76a'; for (let i = 0; i < 6; i++) c.fillRect(-40, 12 + i * 12, 90, 5); c.restore();
      c.strokeStyle = '#c85a3a'; c.lineWidth = 2; for (let i = -28; i <= 38; i += 7) { c.beginPath(); c.moveTo(i, 70); c.lineTo(i + hash(i, 4) * 3 - 1.5, 80); c.stroke(); }
      c.restore();
      rr(c, 926, 866, 408, 20, 5); shaded(c, '#36202f', 926, 866, 408, 20, 2.6);
      for (const lx of [940, 1300]) { rr(c, lx, 884, 22, 16, 3); fillStroke(c, '#76472b', 2.4); }
      c.save(); c.translate(1226, 783); c.rotate(-0.25);
      rr(c, -28, -18, 56, 36, 12); shaded(c, '#dc6c52', -28, -18, 56, 36, 2.8);
      c.strokeStyle = 'rgba(60,10,10,0.35)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-20, 0); c.quadraticCurveTo(0, -6, 20, 0); c.stroke(); c.restore();
    }
    // --- wall shelf
    if (vis(v, 1000, 460, 1300, 540)) {
      wallShadow(c, 1010, 470, 280, 16, 4);
      for (const bx of [1040, 1252]) { c.beginPath(); c.moveTo(bx - 8, 486); c.lineTo(bx + 14, 486); c.lineTo(bx - 8, 524); c.closePath(); fillStroke(c, '#573520', 2.4); c.beginPath(); c.arc(bx, 490, 1.6, 0, TAU); c.fillStyle = INK; c.fill(); }
      rr(c, 1010, 470, 280, 16, 3); shaded(c, '#955d34', 1010, 470, 280, 16, 2.8); woodGrain(c, 1010, 470, 280, 16, 5, 0.2);
    }
    // --- TV cabinet + lamp + photo
    if (vis(v, 1470, 600, 1810, 905)) {
      wallShadow(c, 1486, 700, 308, 190, 6); floorShadow(c, 1640, 360);
      rr(c, 1486, 724, 308, 166, 5); shaded(c, '#6c4027', 1486, 724, 308, 166, 3); woodGrain(c, 1486, 724, 308, 166, 9, 0.16);
      for (const dx of [1498, 1646]) {
        rr(c, dx, 738, 140, 138, 4); shaded(c, '#83502e', dx, 738, 140, 138, 2.4);
        rr(c, dx + 12, 750, 116, 114, 3); c.strokeStyle = 'rgba(0,0,0,0.3)'; c.lineWidth = 2; c.stroke();
        c.beginPath(); c.arc(dx + (dx < 1600 ? 120 : 20), 806, 5.5, 0, TAU); fillStroke(c, '#dcae4a', 2);
      }
      for (const lx of [1500, 1772]) { rr(c, lx, 888, 22, 14, 3); fillStroke(c, '#36202f', 2.2); }
      rr(c, 1480, 700, 320, 24, 5); shaded(c, '#a56a3a', 1480, 700, 320, 24, 3); woodGrain(c, 1480, 700, 320, 24, 14, 0.18);
      // doily + lamp
      c.fillStyle = 'rgba(255,248,235,0.85)'; blob(c, 1522, 701, 30, 3.4, 8); c.fill();
      blob(c, 1520, 698, 17, 5, 41); fillStroke(c, '#c28a52', 2.4);
      rr(c, 1514, 652, 12, 46, 4); fillStroke(c, '#c28a52', 2.4);
      const flick = state === 'stir' ? (Math.sin(t * 40) > 0.6 ? 0.55 : 1) : 1;
      c.beginPath(); c.moveTo(1492, 660); c.lineTo(1548, 660); c.lineTo(1537, 620); c.lineTo(1503, 620); c.closePath();
      fillStroke(c, state === 'awake' ? '#fff0c0' : 'rgba(245,196,102,' + flick + ')', 3);
      c.strokeStyle = 'rgba(120,60,0,0.3)'; c.lineWidth = 1.2; for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(1503 + i * 7.4, 622); c.lineTo(1494 + i * 10.2, 658); c.stroke(); }
      // framed photo of the giant & friend
      c.save(); c.translate(1580, 676); c.rotate(-0.05);
      rr(c, -20, -24, 40, 48, 2); fillStroke(c, '#b88a3c', 2.6);
      rr(c, -15, -19, 30, 38, 1); fillStroke(c, '#d8c9a8', 1.4);
      c.fillStyle = '#4a3648'; c.beginPath(); c.arc(-5, -6, 6, 0, TAU); c.arc(7, -4, 5, 0, TAU); c.fill(); c.fillRect(-11, 0, 12, 18); c.fillRect(2, 1, 11, 17);
      c.restore();
    }
    // --- bookshelf
    if (vis(v, 1940, 190, 2400, 905)) {
      wallShadow(c, 1960, 200, 420, 700, 6); floorShadow(c, 2170, 470);
      c.fillStyle = '#24141d'; c.fillRect(1984, 215, 372, 685);
      rr(c, 1992, 780, 176, 112, 3); shaded(c, '#5a361f', 1992, 780, 176, 112, 2.6); rr(c, 2172, 780, 176, 112, 3); shaded(c, '#5a361f', 2172, 780, 176, 112, 2.6);
      c.beginPath(); c.arc(2156, 836, 5, 0, TAU); fillStroke(c, '#dcae4a', 2); c.beginPath(); c.arc(2184, 836, 5, 0, TAU); fillStroke(c, '#dcae4a', 2);
      const palette = ['#bf3f2e', '#e2ac38', '#37759c', '#5a8754', '#86469a', '#d56f38', '#2b5666', '#b23860', '#e6d8bc'];
      [760, 610, 460, 310].forEach((sy, si) => {
        const r = rng(100 + si);
        let x = 1992;
        const gapFrom = si === 2 ? 2150 : si === 1 ? 2020 : 99999, gapTo = si === 2 ? 2270 : si === 1 ? 2080 : 99999;
        while (x < 2348) {
          if (x >= gapFrom && x < gapTo) { x = gapTo; continue; }
          const bw = 12 + Math.floor(r() * 14), bh = 66 + Math.floor(r() * 56), col = palette[Math.floor(r() * palette.length)];
          if (x + bw > 2350) break;
          const lean = r() < 0.07;
          c.save(); if (lean) { c.translate(x + bw, sy); c.rotate(-0.22); c.translate(-(x + bw), -sy); }
          rr(c, x, sy - bh, bw, bh, 1.6); shaded(c, col, x, sy - bh, bw, bh, 1.8, 0.9);
          c.fillStyle = 'rgba(255,240,200,0.45)'; c.fillRect(x + 2, sy - bh + 7, bw - 4, 2.4); c.fillRect(x + 2, sy - 18, bw - 4, 2.4);
          c.restore();
          x += bw + (lean ? 18 : 0.5);
        }
      });
      // trinkets: a globe on shelf 2, a stack of flat books, a plant on top
      c.save(); c.translate(2050, 610);
      c.beginPath(); c.moveTo(-14, 0); c.lineTo(14, 0); c.lineTo(8, -8); c.lineTo(-8, -8); c.closePath(); fillStroke(c, '#76472b', 2.2);
      blob(c, 0, -30, 22, 22, 3); fillStroke(c, '#3f78b0', 2.4);
      c.fillStyle = '#6aa36a'; c.beginPath(); c.ellipse(-6, -36, 8, 6, 0.4, 0, TAU); c.ellipse(9, -24, 6, 8, -0.3, 0, TAU); c.fill();
      c.restore();
      for (let i = 0; i < 3; i++) { rr(c, 2290 + i * 2, 460 - 10 - i * 11, 52 - i * 6, 10, 1.6); fillStroke(c, ['#b23860', '#37759c', '#e2ac38'][i], 1.8); }
      c.save(); c.translate(2340, 200);
      c.beginPath(); c.moveTo(-14, 0); c.lineTo(14, 0); c.lineTo(11, -20); c.lineTo(-11, -20); c.closePath(); fillStroke(c, '#c4673a', 2.4);
      c.fillStyle = '#4f8f50'; for (let i = 0; i < 6; i++) { c.save(); c.translate(0, -20); c.rotate(-1.2 + i * 0.5 + Math.sin(t * 1.4 + i) * 0.03); c.beginPath(); c.ellipse(0, -16, 5, 17, 0, 0, TAU); fillStroke(c, '#4f8f50', 1.8); c.restore(); }
      c.restore();
      rr(c, 1960, 215, 24, 685, 3); shaded(c, '#684127', 1960, 215, 24, 685, 3); woodGrain(c, 1960, 215, 24, 685, 21, 0.2);
      rr(c, 2356, 215, 24, 685, 3); shaded(c, '#684127', 2356, 215, 24, 685, 3); woodGrain(c, 2356, 215, 24, 685, 22, 0.2);
      [760, 610, 460, 310].forEach((sy, i) => { rr(c, 1984, sy, 372, 14, 2); shaded(c, '#7a4d2c', 1984, sy, 372, 14, 2.6); woodGrain(c, 1984, sy, 372, 14, 30 + i, 0.2); });
      rr(c, 1950, 200, 440, 16, 4); shaded(c, '#8f5c31', 1950, 200, 440, 16, 3.2); woodGrain(c, 1950, 200, 440, 16, 55, 0.2);
    }
  }

  function mouseHole(c, t, haul, state) {
    c.save();
    c.beginPath(); c.moveTo(-4, FLOOR); c.lineTo(-4, 836); c.quadraticCurveTo(26, 790, 60, 836); c.lineTo(66, FLOOR); c.closePath();
    c.fillStyle = '#0b0610'; c.fill(); c.clip();
    const g = c.createRadialGradient(10, 880, 4, 10, 880, 74);
    g.addColorStop(0, 'rgba(255,190,90,' + (0.78 + Math.sin(t * 3) * 0.08) + ')'); g.addColorStop(1, 'rgba(255,150,60,0)');
    c.fillStyle = g; c.fillRect(-10, 800, 90, 100);
    // tiny bed, wheel of cheese, a lantern
    c.fillStyle = '#f2c23a'; c.beginPath(); c.moveTo(8, 899); c.lineTo(36, 899); c.lineTo(36, 884); c.closePath(); c.fill();
    c.fillStyle = '#c4412f'; c.fillRect(-4, 891, 22, 9); c.fillStyle = '#efe6d2'; c.fillRect(-4, 888, 8, 5);
    c.fillStyle = 'rgba(255,230,160,0.95)'; c.beginPath(); c.arc(44, 850, 3, 0, TAU); c.fill();
    c.restore();
    c.beginPath(); c.moveTo(-4, FLOOR); c.lineTo(-4, 836); c.quadraticCurveTo(26, 790, 60, 836); c.lineTo(66, FLOOR);
    c.lineWidth = 8; c.strokeStyle = '#b97e4a'; c.stroke(); c.lineWidth = 2.6; c.strokeStyle = INK; c.stroke();
    // fairy lights over the arch
    c.strokeStyle = INK; c.lineWidth = 1.6; c.beginPath(); c.moveTo(-6, 822); c.quadraticCurveTo(30, 770, 70, 826); c.stroke();
    const cols = ['#ff6b6b', '#ffd25a', '#7be37b', '#6bb8ff'];
    for (let i = 0; i < 6; i++) {
      const k = (i + 0.5) / 6, x = -6 + 76 * k, y = 822 - Math.sin(k * Math.PI) * 38 + (1 - Math.sin(k * Math.PI)) * 4;
      const on = 0.65 + 0.35 * Math.sin(t * 3 + i * 2);
      c.fillStyle = cols[i % 4]; c.globalAlpha = on; c.beginPath(); c.arc(x, y + 4, 3.2, 0, TAU); c.fill(); c.globalAlpha = 1;
      c.strokeStyle = INK; c.lineWidth = 1; c.stroke();
    }
    c.save(); c.translate(36, 782); c.rotate(Math.sin(t * 1.3) * 0.04);
    c.strokeStyle = INK; c.lineWidth = 1.4; c.beginPath(); c.moveTo(-18, -10); c.lineTo(-18, 0); c.moveTo(18, -10); c.lineTo(18, 0); c.stroke();
    rr(c, -26, -2, 52, 17, 2); fillStroke(c, '#efd48a', 2);
    text(c, 'HOME', -2, 11, 10.5, INK, 'center', SERIF);
    c.fillStyle = '#c4302a'; c.beginPath(); c.moveTo(16, 6); c.bezierCurveTo(10, 0, 14, -3, 16, 1); c.bezierCurveTo(18, -3, 22, 0, 16, 6); c.fill();
    c.restore();
  }

  function pad(c, t, haul, state, G) {
    const x = 70, w = 270;
    const a = 0.1 + 0.04 * Math.sin(t * 2.4) + (haul > 0 ? 0.06 : 0);
    c.fillStyle = lin(c, 0, 790, 0, FLOOR, [[0, 'rgba(255,230,140,0)'], [1, 'rgba(255,230,140,' + a + ')']]);
    c.fillRect(x, 790, w, 110);
    // woven doormat in perspective
    c.beginPath(); c.moveTo(x + 6, FLOOR + 1); c.lineTo(x + w - 6, FLOOR + 1); c.lineTo(x + w + 10, FLOOR + 32); c.lineTo(x - 4, FLOOR + 32); c.closePath();
    fillStroke(c, '#d8b87a', 3);
    c.save(); c.clip(); c.strokeStyle = 'rgba(120,70,30,0.35)'; c.lineWidth = 1.4;
    for (let i = 0; i < 34; i++) { c.beginPath(); c.moveTo(x + i * 8, FLOOR); c.lineTo(x - 8 + i * 8.6, FLOOR + 34); c.stroke(); }
    c.fillStyle = '#b9433a'; c.fillRect(x - 6, FLOOR + 1, w + 24, 4); c.fillRect(x - 8, FLOOR + 27, w + 24, 4);
    c.restore();
    text(c, 'DROP LOOT HERE', x + w / 2, FLOOR + 22, 14, '#5c2b1c', 'center', SERIF);
    // painted wooden sign on a post
    const bob = Math.sin(t * 3) * 2.5;
    c.save(); c.translate(x + w / 2, 800 + bob);
    c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.moveTo(-28, 8); c.lineTo(-28, 24); c.moveTo(28, 8); c.lineTo(28, 24); c.stroke();
    rr(c, -54, -24, 108, 32, 4); shaded(c, haul > 0 ? '#e8c35a' : '#b9a47a', -54, -24, 108, 32, 2.8);
    woodGrain(c, -54, -24, 108, 32, 61, 0.2);
    for (const nx of [-46, 46]) { c.beginPath(); c.arc(nx, -16, 1.8, 0, TAU); c.fillStyle = INK; c.fill(); }
    text(c, haul > 0 ? 'BANK IT!' : 'SAFE ZONE', 0, -3, 16, INK, 'center', SERIF);
    c.restore();
  }

  // moonbeam + drifting dust, drawn additively over the room
  function shaft(c, t, v) {
    if (!vis(v, 500, 100, 1200, 900)) return;
    c.save(); c.globalCompositeOperation = 'lighter';
    const g = c.createLinearGradient(560, 150, 960, 900);
    g.addColorStop(0, 'rgba(150,175,255,0.17)'); g.addColorStop(1, 'rgba(150,175,255,0.02)');
    c.fillStyle = g; c.beginPath(); c.moveTo(552, 120); c.lineTo(790, 120); c.lineTo(1190, 900); c.lineTo(850, 900); c.closePath(); c.fill();
    for (let i = 0; i < 38; i++) {
      const k = (i * 0.0813 + t * (0.01 + (i % 5) * 0.003)) % 1, yy = 130 + k * 760;
      const xx = 560 + (yy - 130) * 0.44 + (hash(i, 3) * 190) * (0.4 + k * 0.6) + Math.sin(t * 0.8 + i) * 12;
      c.fillStyle = 'rgba(210,225,255,' + (0.18 + 0.4 * hash(i, 7)) + ')'; c.fillRect(xx, yy, 2, 2);
    }
    c.restore();
  }

  // the hallway the giant comes through: a huge dark doorway with warm light spilling in
  function doorway(c, t, state, v) {
    if (!vis(v, 2380, 0, 2520, 920)) return;
    const awake = state === 'awake';
    c.fillStyle = lin(c, 0, 0, 0, FLOOR, [[0, '#0b060e'], [0.65, '#24121f'], [1, '#6f4226']]);
    c.fillRect(2392, 28, 150, 872);
    const g = c.createLinearGradient(2392, 0, 2500, 0); g.addColorStop(0, 'rgba(255,190,110,0)'); g.addColorStop(1, 'rgba(255,196,120,' + (awake ? 0.5 : 0.2) + ')');
    c.fillStyle = g; c.fillRect(2392, 28, 150, 872);
    rr(c, 2384, 24, 12, 880, 2); shaded(c, '#5a361f', 2384, 24, 12, 880, 2.6);
    c.fillStyle = '#2c1a26'; c.fillRect(2392, 24, 150, 8);
  }
  function hallLightOnFloor(c, t, state) {
    c.save(); c.globalCompositeOperation = 'lighter';
    const k = state === 'awake' ? 0.34 : 0.12;
    const g = c.createLinearGradient(2500, 0, 2050, 0); g.addColorStop(0, 'rgba(255,190,100,' + k + ')'); g.addColorStop(1, 'rgba(255,190,100,0)');
    c.fillStyle = g; c.beginPath(); c.moveTo(2500, FLOOR); c.lineTo(2500, FLOOR + 90); c.lineTo(2000, FLOOR + 70); c.lineTo(2050, FLOOR); c.closePath(); c.fill();
    c.restore();
  }

  /* ---------------------------------------------------------------- the giant's legs */
  const GY = 915, ANK = 853;
  function legEdge(f, hipX, y, side, ay) {
    const topX = hipX + (f.x - hipX) * 0.55, s = clamp((y + 900) / (ay + 900), 0, 1);
    const cx = topX + (f.x - topX) * s, hw = 84 + (40 - 84) * s, bulge = 13 * Math.sin(Math.PI * clamp((ay - y) / 320, 0, 1));
    return cx + side * (hw + bulge * (side < 0 ? 1.1 : 0.5));
  }
  function legPath(c, f, hipX, y0, y1, ay, zig) {
    c.beginPath(); c.moveTo(legEdge(f, hipX, y0, -1, ay), y0);
    for (let y = y0; y <= y1; y += 22) c.lineTo(legEdge(f, hipX, y, -1, ay), y);
    c.lineTo(legEdge(f, hipX, y1, -1, ay), y1);
    if (zig) { const xl = legEdge(f, hipX, y1, -1, ay), xr = legEdge(f, hipX, y1, 1, ay); for (let i = 1; i <= 10; i++) c.lineTo(xl + (xr - xl) * i / 10, y1 + (i % 2 ? 9 : 0)); }
    else c.lineTo(legEdge(f, hipX, y1, 1, ay), y1);
    for (let y = y1; y >= y0; y -= 22) c.lineTo(legEdge(f, hipX, y, 1, ay), y);
    c.lineTo(legEdge(f, hipX, y0, 1, ay), y0); c.closePath();
  }
  function drawLeg(c, f, hipX, seed, t) {
    const ay = ANK - f.lift, top = -900, hem = ay - 300;
    // pyjama trousers (with a frayed hem)
    legPath(c, f, hipX, top, hem, ay, true);
    const x0 = Math.min(legEdge(f, hipX, top, -1, ay), legEdge(f, hipX, hem, -1, ay)) - 4, x1 = Math.max(legEdge(f, hipX, top, 1, ay), legEdge(f, hipX, hem, 1, ay)) + 4;
    const gx = c.createLinearGradient(x0, 0, x1, 0); gx.addColorStop(0, '#1c2652'); gx.addColorStop(0.4, '#3a4f98'); gx.addColorStop(0.75, '#31458a'); gx.addColorStop(1, '#6a78b8');
    c.fillStyle = gx; c.fill();
    c.save(); c.clip();
    c.strokeStyle = 'rgba(225,232,255,0.34)'; c.lineWidth = 3.2;
    for (let k = -8; k <= 8; k++) {
      c.beginPath();
      for (let y = top; y <= hem + 10; y += 60) { const s = clamp((y + 900) / (ay + 900), 0, 1), cx = (hipX + (f.x - hipX) * 0.55) + (f.x - (hipX + (f.x - hipX) * 0.55)) * s; c.lineTo(cx + k * (14 - s * 4), y); }
      c.stroke();
    }
    c.strokeStyle = 'rgba(10,10,40,0.28)'; c.lineWidth = 6;
    for (let i = 0; i < 4; i++) { const y = hem - 40 - i * 90 - hash(seed, i) * 30; c.beginPath(); c.moveTo(x0, y); c.quadraticCurveTo((x0 + x1) / 2, y + 26, x1, y + 8); c.stroke(); }
    c.restore();
    inkStroke(c, 4);
    // bare, hairy shin
    legPath(c, f, hipX, hem + 2, ay, ay, false);
    const sx0 = legEdge(f, hipX, hem, -1, ay) - 4, sx1 = legEdge(f, hipX, ay, 1, ay) + 14;
    const gs = c.createLinearGradient(sx0, 0, sx1, 0); gs.addColorStop(0, '#6e4234'); gs.addColorStop(0.35, '#b9805e'); gs.addColorStop(0.7, '#a86f52'); gs.addColorStop(1, '#e3a679');
    c.fillStyle = gs; c.fill();
    c.save(); c.clip();
    c.strokeStyle = 'rgba(55,28,22,0.6)'; c.lineWidth = 1.6; c.lineCap = 'round';
    for (let i = 0; i < 130; i++) {
      const y = hem + 10 + hash(seed, i * 3) * (ay - hem - 10), xl = legEdge(f, hipX, y, -1, ay), xr = legEdge(f, hipX, y, 1, ay), x = xl + (xr - xl) * hash(seed, i * 3 + 1);
      c.beginPath(); c.moveTo(x, y); c.lineTo(x - 5 - hash(seed, i * 3 + 2) * 6, y + 6 + hash(seed, i) * 5); c.stroke();
    }
    c.strokeStyle = 'rgba(70,90,160,0.35)'; c.lineWidth = 3;
    for (let i = 0; i < 3; i++) { const y = hem + 60 + i * 70; c.beginPath(); c.moveTo(f.x - 20 + i * 8, y); c.bezierCurveTo(f.x - 5, y + 20, f.x - 30, y + 40, f.x - 10 + i * 6, y + 70); c.stroke(); }
    c.fillStyle = 'rgba(255,230,200,0.18)'; c.beginPath(); c.ellipse(f.x - 4, ay - 26, 9, 14, 0, 0, TAU); c.fill();
    c.restore(); c.lineCap = 'butt';
    inkStroke(c, 4);
    // he looms out of the dark: fade the upper leg into shadow
    legPath(c, f, hipX, top, ay, ay, false);
    const gd = c.createLinearGradient(0, top, 0, ay); gd.addColorStop(0, 'rgba(8,2,16,0.92)'); gd.addColorStop(0.55, 'rgba(8,2,16,0.55)'); gd.addColorStop(1, 'rgba(8,2,16,0.12)');
    c.fillStyle = gd; c.fill();
    // the foot (facing left)
    c.save(); c.translate(f.x, ay); c.rotate(f.tilt || 0);
    c.beginPath(); c.moveTo(32, -60); c.lineTo(38, -8); c.quadraticCurveTo(58, 22, 52, 50); c.quadraticCurveTo(48, 66, 28, 66); c.quadraticCurveTo(-30, 50, -90, 66); c.lineTo(-118, 66);
    c.quadraticCurveTo(-166, 66, -170, 44); c.quadraticCurveTo(-170, 26, -140, 22); c.quadraticCurveTo(-90, 18, -50, 2); c.quadraticCurveTo(-34, -10, -34, -60); c.closePath();
    const gf = c.createLinearGradient(-170, 0, 55, 0); gf.addColorStop(0, '#a56c4e'); gf.addColorStop(0.5, '#c58b68'); gf.addColorStop(1, '#e3a679');
    c.fillStyle = gf; c.fill();
    c.save(); c.clip(); const gb = c.createLinearGradient(0, 20, 0, 68); gb.addColorStop(0, 'rgba(0,0,0,0)'); gb.addColorStop(1, 'rgba(60,20,20,0.5)'); c.fillStyle = gb; c.fillRect(-175, 20, 235, 50); c.restore();
    inkStroke(c, 4);
    for (const [tx, ty, rx, ry, na] of [[-98, 24, 14, 11, 4], [-120, 28, 15, 12, 5], [-142, 34, 16, 13, 6]]) {
      blob(c, tx, ty, rx, ry, na + seed); fillStroke(c, '#b9805e', 3);
      c.beginPath(); c.ellipse(tx - 6, ty - 1, 5, 7, 0.2, 0, TAU); fillStroke(c, '#d9c98a', 1.8);
    }
    blob(c, -156, 51, 25, 20, 9 + seed); fillStroke(c, '#c58b68', 3.4);
    c.beginPath(); c.ellipse(-173, 46, 8.5, 12, 0.15, 0, TAU); fillStroke(c, '#dccb8c', 2);
    c.strokeStyle = 'rgba(60,30,22,0.5)'; c.lineWidth = 1.4; for (let i = 0; i < 8; i++) { c.beginPath(); c.moveTo(-30 - i * 9, 10 + hash(seed, i) * 4); c.lineTo(-34 - i * 9, 16 + hash(seed, i + 8) * 5); c.stroke(); }
    c.restore();
  }

  function giant(c, g, t) {
    if (!g) return;
    // where each landing will be, so the player can read it
    for (const f of g.feet) {
      const lifted = clamp(f.lift / 340, 0, 1);
      c.fillStyle = 'rgba(0,0,0,' + 0.42 * (1 - lifted * 0.7) + ')'; c.beginPath(); c.ellipse(f.x - 50, GY - 1, 140 + lifted * 30, 17, 0, 0, TAU); c.fill();
    }
    if (g.mover >= 0 && g.target !== undefined) {
      const f = g.feet[g.mover], k = clamp(f.t, 0, 1), pulse = 0.5 + 0.5 * Math.sin(t * 22);
      c.save(); c.translate(g.target - 47, GY - 1);
      c.beginPath(); c.ellipse(0, 0, 126, 22, 0, 0, TAU); c.fillStyle = 'rgba(150,10,20,' + (0.14 + 0.34 * k + 0.06 * pulse * k) + ')'; c.fill();
      c.setLineDash([10, 8]); c.lineWidth = 3; c.strokeStyle = 'rgba(255,90,80,' + (0.35 + 0.5 * k) + ')'; c.stroke(); c.setLineDash([]);
      c.restore();
    }
    const order = g.feet.slice().sort((p, q) => q.x - p.x);
    order.forEach((f, i) => drawLeg(c, f, g.hip, 11 + (g.feet.indexOf(f)) * 17, t));
  }

  function room(c, v, t, stateName, haul, G) {
    wall(c, v, t, stateName === 'awake');
    windowArt(c, t);
    doorway(c, t, stateName, v);
    decor(c, v, t, stateName === 'awake');
    floor(c, v, t, stateName);
    clutter(c, v, t);
    furniture(c, v, t, stateName);
    mouseHole(c, t, haul, stateName);
    pad(c, t, haul, stateName, G);
    shaft(c, t, v);
    hallLightOnFloor(c, t, stateName);
  }

  /* ---------------------------------------------------------------- screen-space finish */
  let grainCv = null;
  function postfx(c, w, h, t, dpr) {
    if (!grainCv) {
      grainCv = document.createElement('canvas'); grainCv.width = grainCv.height = 160;
      const g = grainCv.getContext('2d'), id = g.createImageData(160, 160);
      for (let i = 0; i < 160 * 160; i++) { const v = (Math.random() * 255) | 0; id.data[i * 4] = id.data[i * 4 + 1] = id.data[i * 4 + 2] = v; id.data[i * 4 + 3] = 255; }
      g.putImageData(id, 0, 0);
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.save(); c.globalCompositeOperation = 'soft-light'; c.globalAlpha = 0.17;
    const ox = (Math.random() * 160) | 0, oy = (Math.random() * 160) | 0;
    c.translate(-ox, -oy); c.fillStyle = c.createPattern(grainCv, 'repeat'); c.fillRect(ox, oy, w + 160, h + 160);
    c.restore();
    // warm paper tone + vignette
    c.save(); c.globalCompositeOperation = 'multiply'; c.globalAlpha = 0.07; c.fillStyle = '#ffd9a0'; c.fillRect(0, 0, w, h); c.restore();
    const g2 = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.max(w, h) * 0.78);
    g2.addColorStop(0, 'rgba(10,0,20,0)'); g2.addColorStop(1, 'rgba(10,0,20,0.3)');
    c.fillStyle = g2; c.fillRect(0, 0, w, h);
  }

  /* ---------------------------------------------------------------- loot */
  function chainLoop(c, rx, ry, cy) {
    c.save(); c.strokeStyle = '#e2b13a'; c.lineWidth = 2.6; c.setLineDash([3.2, 2.2]);
    c.beginPath(); c.ellipse(0, cy, rx, ry, 0, 0, TAU); c.stroke(); c.setLineDash([]); c.restore();
  }
  function sparkle(c, x, y, s, a) {
    c.save(); c.translate(x, y); c.globalAlpha = a; c.fillStyle = '#fffbe0';
    c.beginPath(); c.moveTo(0, -s); c.quadraticCurveTo(s * 0.12, -s * 0.12, s, 0); c.quadraticCurveTo(s * 0.12, s * 0.12, 0, s); c.quadraticCurveTo(-s * 0.12, s * 0.12, -s, 0); c.quadraticCurveTo(-s * 0.12, -s * 0.12, 0, -s); c.fill();
    c.restore();
  }

  const LOOT = {
    necklace(c, it, t) {
      chainLoop(c, 14, 17, -15);
      c.beginPath(); c.moveTo(0, -7); c.lineTo(9, 0); c.lineTo(0, 9); c.lineTo(-9, 0); c.closePath(); fillStroke(c, '#d0234c', 2.4);
      c.fillStyle = 'rgba(255,255,255,0.7)'; c.beginPath(); c.moveTo(-2, -4); c.lineTo(3, -1); c.lineTo(-2, 0); c.closePath(); c.fill();
      sparkle(c, 6, -6, 5 + Math.sin(t * 5 + it.seed) * 2, 0.6 + 0.4 * Math.sin(t * 4 + it.seed));
    },
    watch(c, it, t) {
      chainLoop(c, 8, 14, -16);
      blob(c, 0, 0, 10.5, 10.5, 2); fillStroke(c, '#e2b13a', 2.4);
      c.beginPath(); c.arc(0, 0, 7.4, 0, TAU); c.fillStyle = '#fbf3dd'; c.fill();
      c.lineWidth = 1.5; c.strokeStyle = INK; c.lineCap = 'round';
      const a = t * 0.9 + it.seed;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.sin(a) * 6, -Math.cos(a) * 6); c.stroke();
      c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.sin(a / 12) * 4, -Math.cos(a / 12) * 4); c.stroke();
      c.fillStyle = '#e2b13a'; c.fillRect(-2, -14, 4, 4);
    },
    ball(c, it, t) {
      c.save(); c.beginPath(); c.arc(0, 0, 19, 0, TAU); c.clip();
      const cols = ['#d94444', '#f6efe0', '#3b82cc', '#f6efe0', '#eec140', '#f6efe0'];
      for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 24, i * TAU / 6, (i + 1) * TAU / 6); c.closePath(); c.fillStyle = cols[i]; c.fill(); }
      const g = c.createRadialGradient(-7, -8, 2, 0, 0, 22); g.addColorStop(0, 'rgba(255,255,255,0.4)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(30,0,40,0.4)');
      c.fillStyle = g; c.fillRect(-20, -20, 40, 40);
      c.restore();
      blob(c, 0, 0, 19, 19, 9); inkStroke(c, 2.6);
      c.beginPath(); c.arc(0, 0, 2.6, 0, TAU); c.fillStyle = INK; c.fill();
    },
    teapot(c, it, t) {
      c.lineWidth = 6; c.strokeStyle = INK; c.beginPath(); c.arc(-23, 0, 11, -1.9, 1.9, true); c.stroke();
      c.lineWidth = 3; c.strokeStyle = '#eee0c6'; c.beginPath(); c.arc(-23, 0, 11, -1.9, 1.9, true); c.stroke();
      c.beginPath(); c.moveTo(18, 2); c.quadraticCurveTo(34, 6, 36, -14); c.lineTo(31, -16); c.quadraticCurveTo(28, -2, 14, -6); c.closePath(); fillStroke(c, '#eee0c6', 2.4);
      blob(c, 0, 1, 24, 17, 4); shaded(c, '#eee0c6', -24, -16, 48, 34, 2.8);
      c.save(); blob(c, 0, 1, 24, 17, 4); c.clip();
      c.fillStyle = '#3f74b8'; c.fillRect(-26, -2, 52, 6);
      c.fillStyle = '#d4527a'; for (let i = -2; i <= 2; i++) { c.beginPath(); c.arc(i * 9, 1, 2.4, 0, TAU); c.fill(); }
      c.restore();
      blob(c, 0, -15, 12, 5, 8); fillStroke(c, '#eee0c6', 2.4);
      c.beginPath(); c.arc(0, -21, 4, 0, TAU); fillStroke(c, '#d4527a', 2);
    },
    candle(c, it, t) {
      blob(c, 0, 25, 14, 5, 3); fillStroke(c, '#cf9830', 2.4);
      c.beginPath(); c.moveTo(-3, 22); c.lineTo(3, 22); c.lineTo(4, 0); c.lineTo(-4, 0); c.closePath(); fillStroke(c, '#dfa940', 2.4);
      blob(c, 0, 10, 7, 3, 4); fillStroke(c, '#dfa940', 2);
      c.beginPath(); c.moveTo(-9, -8); c.lineTo(9, -8); c.lineTo(5, 3); c.lineTo(-5, 3); c.closePath(); fillStroke(c, '#dfa940', 2.4);
      rr(c, -4.5, -26, 9, 18, 2); fillStroke(c, '#f2e9d0', 2);
      c.fillStyle = 'rgba(220,190,140,0.7)'; c.fillRect(-2, -24, 2, 12);
      const f = 1 + Math.sin(t * 13 + it.seed) * 0.14;
      c.save(); c.translate(0, -29); c.scale(f * 0.9, f);
      c.beginPath(); c.moveTo(0, -9); c.quadraticCurveTo(6, -1, 0, 3); c.quadraticCurveTo(-6, -1, 0, -9); c.fillStyle = '#ffae2a'; c.fill();
      c.beginPath(); c.moveTo(0, -4); c.quadraticCurveTo(3, 0, 0, 2); c.quadraticCurveTo(-3, 0, 0, -4); c.fillStyle = '#fff2a8'; c.fill();
      c.restore();
    },
    pan(c, it, t) {
      rr(c, 20, -4.5, 44, 9, 4); fillStroke(c, '#5a3822', 2.4);
      c.beginPath(); c.arc(58, 0, 2.4, 0, TAU); c.fillStyle = INK; c.fill();
      blob(c, 0, 0, 25, 25, 12); shaded(c, '#33333d', -25, -25, 50, 50, 3);
      c.beginPath(); c.arc(0, 0, 20, 0, TAU); c.fillStyle = '#22222a'; c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.25)'; c.lineWidth = 2.5; c.beginPath(); c.arc(0, 0, 22.5, 3.6, 4.7); c.stroke();
      c.beginPath(); c.moveTo(-12, -4); c.quadraticCurveTo(-14, -14, -2, -13); c.quadraticCurveTo(10, -16, 13, -5); c.quadraticCurveTo(18, 6, 6, 11); c.quadraticCurveTo(-8, 15, -13, 5); c.closePath(); c.fillStyle = '#fffaf0'; c.fill();
      c.beginPath(); c.arc(0, -1, 6, 0, TAU); c.fillStyle = '#ffb81f'; c.fill();
      c.fillStyle = 'rgba(255,255,255,0.6)'; c.beginPath(); c.arc(-2, -3, 1.8, 0, TAU); c.fill();
    },
    tv(c, it, t) {
      c.strokeStyle = '#9a9aa6'; c.lineWidth = 2.5; c.lineCap = 'round';
      const wob = Math.sin(t * 6 + it.seed) * (it.hauled ? 4 : 0.5);
      c.beginPath(); c.moveTo(-6, -40); c.lineTo(-28 + wob, -74); c.moveTo(6, -40); c.lineTo(26 + wob, -70); c.stroke();
      c.fillStyle = '#ddd'; c.beginPath(); c.arc(-28 + wob, -74, 3, 0, TAU); c.arc(26 + wob, -70, 3, 0, TAU); c.fill(); c.lineCap = 'butt';
      rr(c, -59, -40, 118, 80, 10); shaded(c, '#7a4c37', -59, -40, 118, 80, 3);
      woodGrain(c, -59, -40, 118, 80, 33, 0.2);
      rr(c, -50, -31, 74, 62, 10); fillStroke(c, '#10151c', 2.5);
      c.save(); rr(c, -47, -28, 68, 56, 8); c.clip();
      const k = Math.floor(t * 12 + it.seed), r = rng(k);
      c.fillStyle = '#74d2c8'; c.fillRect(-50, -31, 74, 62);
      for (let i = 0; i < 14; i++) { c.fillStyle = 'rgba(' + (r() < 0.5 ? '255,255,255' : '20,60,70') + ',' + (0.25 + r() * 0.45) + ')'; c.fillRect(-50 + r() * 70, -31 + r() * 58, 8 + r() * 36, 3 + r() * 6); }
      c.fillStyle = 'rgba(255,255,255,0.22)'; c.beginPath(); c.moveTo(-44, -26); c.lineTo(-10, -26); c.lineTo(-44, 0); c.closePath(); c.fill();
      c.restore();
      for (const dy of [-14, 8]) { blob(c, 41, dy, 8, 8, dy + 50); fillStroke(c, '#d6c79c', 2.2); c.fillStyle = INK; c.fillRect(40, dy - 7, 2, 7); }
      c.fillStyle = '#10151c'; for (let i = 0; i < 4; i++) c.fillRect(35, 22 + i * 3, 12, 1.4);
    },
    vacuum(c, it, t) {
      const on = it.vac && it.vac.on;
      const sh = on ? Math.sin(t * 60) * 1.6 : 0;
      c.save(); c.translate(0, sh);
      c.lineWidth = 9; c.strokeStyle = INK; c.lineCap = 'round';
      c.beginPath(); c.moveTo(42, -8); c.bezierCurveTo(88, -34, 86, 14, 70, 22); c.stroke();
      c.lineWidth = 5.5; c.strokeStyle = '#85879a'; c.beginPath(); c.moveTo(42, -8); c.bezierCurveTo(88, -34, 86, 14, 70, 22); c.stroke();
      rr(c, 60, 20, 34, 9, 3); fillStroke(c, '#555764', 2.4);
      c.lineCap = 'butt';
      rr(c, -46, -24, 92, 48, 20); shaded(c, '#c43e2d', -46, -24, 92, 48, 3);
      c.fillStyle = 'rgba(255,255,255,0.22)'; rr(c, -38, -19, 76, 6, 3); c.fill();
      c.fillStyle = '#d3d5df'; c.fillRect(-46, 4, 92, 5);
      for (const wx of [-28, 28]) { c.beginPath(); c.arc(wx, 23, 9, 0, TAU); fillStroke(c, '#2b2b36', 2.4); c.beginPath(); c.arc(wx, 23, 3, 0, TAU); c.fillStyle = '#85879a'; c.fill(); }
      rr(c, -14, -33, 28, 10, 5); fillStroke(c, '#7a7c8a', 2.4);
      for (const ex of [-17, 3]) {
        c.beginPath(); c.arc(ex, -7, 8, 0, TAU); fillStroke(c, '#fff', 2);
        const px = on ? Math.sin(t * 20) * 2.5 : Math.sin(t * 1.3 + it.seed) * 1.6;
        c.beginPath(); c.arc(ex + px, -6, 3.6, 0, TAU); c.fillStyle = INK; c.fill();
        if (on) { c.strokeStyle = INK; c.lineWidth = 3; c.beginPath(); c.moveTo(ex - 8, -17); c.lineTo(ex + 8, -12); c.stroke(); }
      }
      c.restore();
    },
    trophy(c, it, t) {
      c.save();
      c.lineWidth = 4; c.strokeStyle = INK;
      for (const s of [-1, 1]) { c.beginPath(); c.arc(s * 19, -14, 8, s < 0 ? 1.5 : -1.6, s < 0 ? 4.7 : 1.6, s < 0); c.stroke(); }
      c.lineWidth = 2; c.strokeStyle = '#f0c040';
      for (const s of [-1, 1]) { c.beginPath(); c.arc(s * 19, -14, 8, s < 0 ? 1.5 : -1.6, s < 0 ? 4.7 : 1.6, s < 0); c.stroke(); }
      c.beginPath(); c.moveTo(-19, -23); c.lineTo(19, -23); c.quadraticCurveTo(18, 6, 4, 8); c.lineTo(-4, 8); c.quadraticCurveTo(-18, 6, -19, -23); c.closePath();
      fillStroke(c, lin(c, -19, 0, 19, 0, [[0, '#f2d05c'], [0.5, '#fff0a0'], [1, '#d09f26']]), 3);
      rr(c, -3.5, 6, 7, 8, 2); fillStroke(c, '#dfb038', 2);
      rr(c, -15, 12, 30, 12, 2); fillStroke(c, '#5a3822', 2.4);
      c.fillStyle = '#f0c040'; c.fillRect(-9, 16, 18, 4);
      c.fillStyle = '#c43e2d'; c.beginPath();
      for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 3.4 : 7.5; c.lineTo(Math.cos(a) * r, -9 + Math.sin(a) * r); }
      c.closePath(); c.fill();
      c.restore();
      sparkle(c, -10, -18, 5 + Math.sin(t * 3 + it.seed) * 2, 0.5 + 0.5 * Math.sin(t * 3 + it.seed));
    },
    ring(c, it, t) {
      c.beginPath(); c.arc(0, 3, 8.2, 0, TAU); c.lineWidth = 5; c.strokeStyle = INK; c.stroke();
      c.lineWidth = 3; c.strokeStyle = '#f0c040'; c.stroke();
      c.beginPath(); c.moveTo(0, -12); c.lineTo(6.5, -6); c.lineTo(0, 0); c.lineTo(-6.5, -6); c.closePath(); fillStroke(c, '#bff0ff', 2);
      c.fillStyle = 'rgba(255,255,255,0.8)'; c.beginPath(); c.moveTo(-3, -8); c.lineTo(0, -10); c.lineTo(1, -6); c.closePath(); c.fill();
      const tw = 0.5 + 0.5 * Math.sin(t * 4 + it.seed);
      sparkle(c, 5, -11, 9 + tw * 5, 0.5 + tw * 0.5);
      sparkle(c, -9, -3, 5 + (1 - tw) * 3, 0.3 + (1 - tw) * 0.6);
    }
  };

  /* ---------------------------------------------------------------- the burglar */
  // The collider is a circle (radius r) centred on the hips; the figure stands on the bottom of it (drawn a little larger than the collider).
  const FIG = 1.2;
  function figureXform(p, lx, ly) {
    // map a figure-local point to world (applies lean around the feet, then squash)
    const R = p.r, S = FIG, qx = lx, qy = ly - R, ca = Math.cos(p.lean || 0), sa = Math.sin(p.lean || 0);
    const rx = qx * ca - qy * sa, ry = qx * sa + qy * ca;
    return { x: p.x + rx * (1 + p.sq) * S, y: p.y + R + ry * (1 - p.sq * 0.85) * S };
  }
  function shoulder(p, side) { return figureXform(p, side * 9.5, -16.5 + (p.bob || 0) * 0.5); }
  function hip(p) { return figureXform(p, 0, 6); }

  function legIK(hx, hy, fx, fy, L, bend) {
    const dx = fx - hx, dy = fy - hy, dist = Math.hypot(dx, dy) || 1, D = Math.min(dist, 2 * L - 0.5);
    const h = Math.sqrt(Math.max(0, L * L - (D / 2) * (D / 2))), ux = dx / dist, uy = dy / dist;
    return { x: hx + ux * D / 2 + uy * h * bend, y: hy + uy * D / 2 - ux * h * bend };
  }

  function thief(c, p) {
    const R = p.r, SK = '#efc39a', SKD = '#d79e78';
    const bob = p.moving ? Math.abs(Math.sin(p.walk)) * -1.6 : Math.sin(p.t * 2.2) * 0.5;
    c.save(); c.translate(p.x, p.y + R); c.rotate(p.lean || 0); c.scale((1 + p.sq) * FIG, (1 - p.sq * 0.85) * FIG); c.translate(0, -R);
    const face = p.face >= 0 ? 1 : -1;
    // ---- legs
    for (const s of [-1, 1]) {
      const ph = p.walk + (s > 0 ? Math.PI : 0);
      let fx, fy;
      if (!p.grounded) { fx = s * 5 + s * 2.5; fy = R - 7 + (p.vy > 0.5 ? 2.5 : -1); }
      else if (p.moving) { fx = s * 5 + Math.sin(ph) * 7.5; fy = R - 1.5 - Math.max(0, Math.cos(ph)) * 5; }
      else { fx = s * 6; fy = R - 1.5; }
      const hx = s * 4.5, hy = 4 + bob * 0.4, k = legIK(hx, hy, fx, fy, 9.6, face);
      c.lineCap = 'round'; c.lineJoin = 'round';
      c.strokeStyle = INK; c.lineWidth = 10.5; c.beginPath(); c.moveTo(hx, hy); c.lineTo(k.x, k.y); c.lineTo(fx, fy - 2); c.stroke();
      c.strokeStyle = '#3a4260'; c.lineWidth = 7.4; c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.12)'; c.lineWidth = 2; c.beginPath(); c.moveTo(hx - 1.5, hy); c.lineTo(k.x - 1.5, k.y); c.lineTo(fx - 1.5, fy - 2); c.stroke();
      // boot
      c.beginPath(); c.moveTo(fx - 5.5, fy - 4.5); c.lineTo(fx + 4.5, fy - 4.5); c.lineTo(fx + 4.5 + face * 3.8, fy + 1.5); c.lineTo(fx - 5.5 + face * 0.5, fy + 2.2); c.closePath();
      fillStroke(c, '#5a3a24', 2.2); c.fillStyle = '#2b1a14'; c.fillRect(fx - 5.5 + face * 0.3, fy + 0.6, 10.6 + face * 2, 2);
    }
    // ---- torso (prison-stripe shirt, belt, hip pouch)
    c.save(); c.translate(0, bob * 0.6);
    c.beginPath(); c.moveTo(-10.5, -18); c.quadraticCurveTo(0, -21.5, 10.5, -18); c.lineTo(9.2, 4.2); c.quadraticCurveTo(0, 7, -9.2, 4.2); c.closePath();
    c.fillStyle = '#efe6d2'; c.fill();
    c.save(); c.clip();
    c.fillStyle = '#1e1a28'; for (let y = -21; y < 8; y += 5.4) c.fillRect(-12, y, 24, 2.7);
    shade(c, -11, -20, 22, 28, 1);
    c.restore();
    inkStroke(c, 2.4);
    c.beginPath(); c.moveTo(-4.2, -19.4); c.lineTo(0, -15); c.lineTo(4.2, -19.4); c.closePath(); fillStroke(c, SKD, 1.6);
    rr(c, -9.6, 0.8, 19.2, 3.6, 1); fillStroke(c, '#5a3a24', 1.8);
    rr(c, -2.4, 0.4, 4.8, 4.4, 1); fillStroke(c, '#e0b44a', 1.4);
    rr(c, -13.5, -0.8, 7.5, 7.5, 2); fillStroke(c, '#7a5232', 1.8); c.beginPath(); c.moveTo(-13, 1.8); c.lineTo(-6.4, 1.8); c.strokeStyle = INK; c.lineWidth = 1.2; c.stroke();
    c.restore();
    // ---- head
    const tilt = clamp(p.lookX, -1, 1) * 0.09 + (p.strain > 0.5 ? Math.sin(p.t * 40) * 0.03 : 0), hy = -29.5 + bob;
    c.save(); c.translate(0, hy); c.rotate(tilt);
    rr(c, -3.4, 7, 6.8, 5, 2); fillStroke(c, SKD, 1.4);                         // neck
    for (const s of [-1, 1]) { blob(c, s * 10.2, 1.5, 3, 3.6, s + 5); fillStroke(c, SKD, 1.6); }  // ears
    blob(c, 0, 0, 10.6, 11.2, 77); shaded(c, SK, -11, -11, 22, 22, 2.6, 0.9);
    // sideburns / stubble
    c.fillStyle = '#4a2f22'; c.fillRect(-10.2, -2, 2.4, 6); c.fillRect(7.8, -2, 2.4, 6);
    c.fillStyle = 'rgba(70,45,35,0.28)'; for (let i = 0; i < 12; i++) { c.fillRect(-6 + hash(i, 1) * 12, 5.5 + hash(i, 2) * 4, 1, 1); }
    // nose
    const nx = p.lookX * 1.6;
    blob(c, nx, 2.4, 2.6, 2.2, 5); fillStroke(c, '#e5a984', 1.4);
    // mask + eyes
    c.beginPath(); c.moveTo(-11.8, -5.6); c.quadraticCurveTo(-5, -9.5, 0, -7.6); c.quadraticCurveTo(5, -9.5, 11.8, -5.6);
    c.lineTo(10.4, 1.4); c.quadraticCurveTo(5.5, 3.6, 2, 0.5); c.lineTo(-2, 0.5); c.quadraticCurveTo(-5.5, 3.6, -10.4, 1.4); c.closePath();
    fillStroke(c, '#19131f', 1.8);
    const open = p.blink > 0 ? 0.12 : 1, tiltE = p.scared || p.strain > 0.35 ? 0.3 : p.greedy ? -0.18 : 0;
    for (const s of [-1, 1]) {
      c.save(); c.translate(s * 4.5 + p.lookX * 0.9, -3 + p.lookY * 0.7); c.rotate(s * tiltE);
      c.beginPath(); c.ellipse(0, 0, 3.3, 3.5 * open + 0.4, 0, 0, TAU); c.fillStyle = '#fffdf3'; c.fill();
      if (open > 0.5) {
        const px = p.lookX * 1.5, py = p.lookY * 1.6;
        c.fillStyle = p.greedy ? '#e8b02a' : '#2a1a14'; c.beginPath(); c.arc(px, py, p.scared ? 1.5 : 1.9, 0, TAU); c.fill();
        c.fillStyle = '#fff'; c.beginPath(); c.arc(px - 0.6, py - 0.7, 0.6, 0, TAU); c.fill();
      }
      if (p.greedy) { c.fillStyle = '#19131f'; c.fillRect(-3.6, -4, 7.2, 2.2); }   // sly half-lid
      c.restore();
    }
    // mouth
    c.save(); c.translate(p.lookX * 1.2, 7.4 + p.lookY * 0.4);
    c.strokeStyle = INK; c.lineWidth = 1.6; c.lineCap = 'round';
    if (p.mouth === 'o') { c.beginPath(); c.ellipse(0, 0.5, 2.2, 2.8, 0, 0, TAU); c.fillStyle = '#3a1020'; c.fill(); c.stroke(); }
    else if (p.mouth === 'grin') { c.beginPath(); c.moveTo(-4.6, -1); c.quadraticCurveTo(0, 5, 4.6, -1.4); c.closePath(); c.fillStyle = '#3a1020'; c.fill(); c.stroke(); c.fillStyle = '#fff'; c.fillRect(-3, -0.9, 6, 1.7); }
    else if (p.mouth === 'strain') { c.beginPath(); c.moveTo(-4, 0.5); for (let i = 1; i <= 4; i++) c.lineTo(-4 + i * 2, 0.5 + (i % 2 ? 1.4 : -1.4)); c.stroke(); }
    else if (p.mouth === 'gulp') { c.beginPath(); c.moveTo(-3, 0.6); c.quadraticCurveTo(0, -1.2, 3, 0.6); c.stroke(); }
    else { c.beginPath(); c.moveTo(-3.8, 0); c.quadraticCurveTo(0, 3, 4.4, -1.6); c.stroke(); }
    c.restore();
    // beanie
    c.beginPath(); c.moveTo(-11.4, -6.2); c.quadraticCurveTo(-12, -17, 0, -17.6); c.quadraticCurveTo(12, -17, 11.4, -6.2); c.closePath();
    shaded(c, '#2d2a45', -12, -18, 24, 12, 2.4, 1);
    rr(c, -12.2, -9.6, 24.4, 5.6, 2.2); fillStroke(c, '#3f3a60', 2.2);
    c.save(); c.clip(); c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 1; for (let x = -11; x < 12; x += 2.6) { c.beginPath(); c.moveTo(x, -10); c.lineTo(x, -3.6); c.stroke(); } c.restore();
    c.beginPath(); c.arc(0, -18.4, 2.6, 0, TAU); fillStroke(c, '#c83c58', 1.8);
    // sweat
    if (p.strain > 0.4 || p.scared) {
      const k = (p.t * 1.6) % 1;
      c.fillStyle = 'rgba(165,222,255,0.95)'; c.strokeStyle = INK; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(11.8, -8 + k * 9); c.quadraticCurveTo(15, -3 + k * 9, 11.8, -0.4 + k * 9); c.quadraticCurveTo(8.6, -3 + k * 9, 11.8, -8 + k * 9); c.fill(); c.stroke();
    }
    c.restore();
    c.restore();
  }

  // stretchy striped arm in a cuffed glove. The stripes stretch with the limb.
  function arm(c, sx, sy, hx, hy, len, strain, t, grip) {
    const d = Math.hypot(hx - sx, hy - sy) || 1, slack = Math.max(0, len - d);
    const nx = -(hy - sy) / d, ny = (hx - sx) / d;
    const shake = strain > 0.45 ? Math.sin(t * 55) * 2.2 * strain : 0;
    const cx = (sx + hx) / 2 + nx * shake, cy = (sy + hy) / 2 + ny * shake + slack * 0.5 + (strain < 0.2 ? 5 : 0);
    const w = clamp(7.4 - strain * 3.6 - Math.max(0, d - 90) * 0.011, 3.2, 7.4);
    const sk = Math.max(1, d / Math.max(36, len * 0.55));
    c.lineCap = 'round';
    c.strokeStyle = INK; c.lineWidth = w + 3.2; c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(cx, cy, hx, hy); c.stroke();
    c.strokeStyle = '#efe6d2'; c.lineWidth = w; c.stroke();
    c.save(); c.setLineDash([2.7 * sk, 2.7 * sk]); c.lineCap = 'butt'; c.strokeStyle = '#1e1a28'; c.lineWidth = w; c.stroke(); c.restore();
    c.lineCap = 'butt';
    // glove
    const ang = Math.atan2(hy - cy, hx - cx);
    c.save(); c.translate(hx, hy); c.rotate(ang);
    rr(c, -5.5, -3.8, 5, 7.6, 2); fillStroke(c, '#4b3a52', 2);
    if (grip) { blob(c, 2.6, 0, 5.4, 5.2, 3); fillStroke(c, '#3a2e44', 2.2); c.strokeStyle = 'rgba(255,255,255,0.18)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(0, -2); c.lineTo(5, -2); c.moveTo(0, 1); c.lineTo(5, 1); c.stroke(); }
    else { blob(c, 2.8, 0, 4.8, 4.6, 4); fillStroke(c, '#3a2e44', 2.2); for (const a of [-0.7, 0, 0.7]) { c.beginPath(); c.arc(7 * Math.cos(a) + 1, 6 * Math.sin(a), 1.8, 0, TAU); fillStroke(c, '#3a2e44', 1.4); } }
    c.restore();
  }

  // twine from the belt to a hauled item, finished with a knot
  function rope(c, sx, sy, ax, ay, rest, hook) {
    const d = Math.hypot(ax - sx, ay - sy), slack = Math.max(0, rest - d), stretch = Math.max(0, d - rest) / rest;
    const mx = (sx + ax) / 2, my = (sy + ay) / 2 + slack * 0.55, w = clamp(3.4 - stretch * 1.6, 1.6, 3.4);
    c.lineCap = 'round';
    c.strokeStyle = INK; c.lineWidth = w + 2.4; c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(mx, my, ax, ay); c.stroke();
    c.strokeStyle = hook ? '#e2b13a' : '#cfa56a'; c.lineWidth = w; c.stroke();
    if (!hook) { c.setLineDash([2, 3]); c.strokeStyle = 'rgba(90,50,20,0.55)'; c.lineWidth = w; c.stroke(); c.setLineDash([]); }
    c.lineCap = 'butt';
    c.beginPath(); c.arc(ax, ay, 3.2, 0, TAU); fillStroke(c, hook ? '#e2b13a' : '#cfa56a', 1.8);
    c.beginPath(); c.arc(sx, sy, 2.6, 0, TAU); fillStroke(c, '#8a8c9c', 1.6);
  }

  window.Art = { rumble: 0, giant, rr, blob, fillStroke, inkStroke, shade, lin, vis, text, room, postfx, LOOT, thief, arm, rope, shoulder, hip, INK, SERIF, SANS, hash };
})();
