/* HEX HARVEST - merge crops on a floating hex island. Three or more touching crops of one kind grow into the next kind.
   Art direction: painted storybook. Watercolour fills, brown ink outlines, paper grain, parchment UI. */
(function () {
  'use strict';
  var U = PG.ui, S3 = Math.sqrt(3), V = 0.82, TAU = 6.2832;
  var INK = '#3b2f2a', PAPER = '#f4ead5', PAPER2 = '#e9dbbd';
  var TIERS = [
    { n: 'Seed', v: 1 }, { n: 'Sprout', v: 3 }, { n: 'Tulip', v: 9 }, { n: 'Sunflower', v: 27 },
    { n: 'Berry Bush', v: 81 }, { n: 'Oak', v: 243 }, { n: 'Apple Tree', v: 729 }, { n: 'Golden Tree', v: 2187 }
  ];
  var MAXT = TIERS.length - 1, R = 3;
  var cells = [], cellAt = {};
  for (var q = -R; q <= R; q++) for (var r = -R; r <= R; r++) if (Math.abs(q + r) <= R) { var c0 = { q: q, r: r, i: cells.length, t: -1, pop: 1, ph: Math.random() * 6.28, glow: 0 }; cells.push(c0); cellAt[q + ',' + r] = c0; }
  var DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
  function nb(c) { var o = []; for (var i = 0; i < 6; i++) { var n = cellAt[(c.q + DIRS[i][0]) + ',' + (c.r + DIRS[i][1])]; if (n) o.push(n); } return o; }

  var st = { score: 0, hand: 0, next: 0, hold: -1, state: 'menu', over: false, usedRev: false, maxT: 0, moves: 0, overT: 0, runIdx: 0, menuT: 0 };
  var geo = { s: 40, cx: 0, cy: 0, landscape: false };
  var hover = null, aiming = false, anims = [], banner = null, shake = 0, t0 = 0, slots = {};
  var clouds = [], flies = [], petals = [], birds = [];
  for (var i = 0; i < 5; i++) clouds.push({ x: Math.random(), y: 0.07 + Math.random() * 0.22, s: 0.7 + Math.random() * 0.7, v: 0.003 + Math.random() * 0.005, k: i % 3 });
  for (i = 0; i < 4; i++) flies.push({ x: Math.random(), y: 0.3 + Math.random() * 0.4, a: Math.random() * 6.28, c: ['#e88d8d', '#f2c14e', '#8fb8d8', '#c7a0d9'][i], p: Math.random() * 9 });
  for (i = 0; i < 3; i++) birds.push({ x: Math.random(), y: 0.1 + Math.random() * 0.12, v: 0.015 + Math.random() * 0.015, p: Math.random() * 9 });
  for (i = 0; i < 12; i++) petals.push({ x: Math.random(), y: Math.random(), v: 0.025 + Math.random() * 0.03, p: Math.random() * 9, c: ['#f3c6c6', '#fff6e0', '#f2d77e'][i % 3] });

  /* ------------ colour + paint helpers ------------ */
  function hx(h) { var n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function rgba(a, al) { return 'rgba(' + (a[0] | 0) + ',' + (a[1] | 0) + ',' + (a[2] | 0) + ',' + (al === undefined ? 1 : al) + ')'; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function dk(h, t, al) { return rgba(mix(hx(h), [40, 25, 20], t), al); }
  function lt(h, t, al) { return rgba(mix(hx(h), [255, 250, 235], t), al); }
  // watercolour: base wash, light pool top-left, pigment pool bottom-right, darker edge, then ink line
  function paint(c, path, col, b, o) {
    o = o || {};
    c.save(); path(); c.fillStyle = col; c.fill(); c.clip();
    var m = Math.max(b.w, b.h);
    var g = c.createRadialGradient(b.x + b.w * 0.3, b.y + b.h * 0.25, 0, b.x + b.w * 0.3, b.y + b.h * 0.25, m * 0.7); g.addColorStop(0, lt(col, 0.55, 0.55)); g.addColorStop(1, lt(col, 0.55, 0)); c.fillStyle = g; c.fillRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
    var g2 = c.createRadialGradient(b.x + b.w * 0.75, b.y + b.h * 0.9, 0, b.x + b.w * 0.75, b.y + b.h * 0.9, m * 0.8); g2.addColorStop(0, dk(col, 0.35, 0.5)); g2.addColorStop(1, dk(col, 0.35, 0)); c.fillStyle = g2; c.fillRect(b.x - 2, b.y - 2, b.w + 4, b.h + 4);
    path(); c.lineWidth = o.edge || Math.min(12, Math.max(2, m * 0.08)); c.strokeStyle = dk(col, 0.3, 0.35); c.stroke();
    c.restore();
    if (o.ink !== false) { path(); c.lineWidth = o.inkW || Math.max(1.2, m * 0.035); c.strokeStyle = INK; c.globalAlpha = o.inkA || 0.82; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke(); c.globalAlpha = 1; }
  }
  function wobble(seed, n, amp) { var r = PG.mulberry(seed), a = []; for (var i = 0; i < n; i++) a.push((r() - 0.5) * 2 * amp); return a; }
  function blobPath(c, x, y, rx, ry, seed, amp) { // irregular round shape for foliage and clouds
    var n = 9, j = wobble(seed, n, amp || 0.12); c.beginPath();
    for (var i = 0; i <= n; i++) { var k = i % n, a = k / n * TAU, rr = 1 + j[k], px = x + Math.cos(a) * rx * rr, py = y + Math.sin(a) * ry * rr; var a2 = (k + 0.5) / n * TAU, rr2 = 1 + (j[(k + 1) % n] + j[k]) / 2 + 0.06, cx = x + Math.cos(a2) * rx * rr2 * 1.08, cy = y + Math.sin(a2) * ry * rr2 * 1.08; if (i === 0) c.moveTo(px, py); else c.quadraticCurveTo(cpx, cpy, px, py); var cpx = cx, cpy = cy; }
    c.closePath();
  }
  function leafPath(c, x, y, len, ang, w) { c.beginPath(); var ca = Math.cos(ang), sa = Math.sin(ang); function P(px, py) { return [x + px * ca - py * sa, y + px * sa + py * ca]; } var a = P(0, 0), b = P(len * 0.5, -w), d = P(len, 0), e = P(len * 0.5, w); c.moveTo(a[0], a[1]); c.quadraticCurveTo(b[0], b[1], d[0], d[1]); c.quadraticCurveTo(e[0], e[1], a[0], a[1]); c.closePath(); }
  function hexPts(x, y, s, seed, amp) { var j = wobble(seed, 12, amp || 0), p = []; for (var i = 0; i < 6; i++) { var a = Math.PI / 180 * (60 * i - 30); p.push([x + Math.cos(a) * s * (1 + j[i]) + j[i + 6] * s * 0.3, y + Math.sin(a) * s * V * (1 + j[i])]); } return p; }
  function poly(c, p) { c.beginPath(); p.forEach(function (q, i) { if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); }); c.closePath(); }
  function inkLine(c, pts, w, a) { c.beginPath(); pts.forEach(function (q, i) { if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); }); c.strokeStyle = INK; c.globalAlpha = a || 0.8; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke(); c.globalAlpha = 1; }
  function offscreen(w, h, fn) { var dpr = PG.dpr, cv = document.createElement('canvas'); cv.width = Math.max(1, Math.ceil(w * dpr)); cv.height = Math.max(1, Math.ceil(h * dpr)); var c = cv.getContext('2d'); c.scale(dpr, dpr); fn(c); cv.lw = w; cv.lh = h; return cv; }

  /* ------------ crop sprites (painted once per size) ------------ */
  var sprites = {};
  function cropSprite(tier, u) {
    var key = tier + '@' + Math.round(u * 10); if (sprites[key]) return sprites[key];
    var W = u * 2.8, H = u * 2.8, ox = W / 2, oy = H - u * 0.35;
    var cv = offscreen(W, H, function (c) { c.translate(ox, oy); paintCrop(c, tier, u); });
    cv.ox = ox; cv.oy = oy; sprites[key] = cv; return cv;
  }
  function soil(c, u, w) { c.fillStyle = 'rgba(59,47,42,.18)'; c.beginPath(); c.ellipse(u * 0.04, u * 0.02, u * w * 1.05, u * 0.13, 0, 0, TAU); c.fill(); paint(c, function () { c.beginPath(); c.ellipse(0, -u * 0.02, u * w, u * 0.11, 0, Math.PI, TAU); c.closePath(); }, '#9a6b45', { x: -u * w, y: -u * 0.13, w: u * w * 2, h: u * 0.13 }, { inkW: 1.2 }); }
  function stem(c, pts, w, col) { c.beginPath(); pts.forEach(function (q, i) { if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); }); c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = INK; c.globalAlpha = 0.8; c.lineWidth = w + 2.2; c.stroke(); c.globalAlpha = 1; c.strokeStyle = col; c.lineWidth = w; c.stroke(); }
  function leafAt(c, x, y, len, ang, w, col) { paint(c, function () { leafPath(c, x, y, len, ang, w); }, col, { x: x - len, y: y - len, w: len * 2, h: len * 2 }, { inkW: 1.2, edge: 2 }); c.strokeStyle = dk(col, 0.35, 0.6); c.lineWidth = 1; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(ang) * len * 0.8, y + Math.sin(ang) * len * 0.8); c.stroke(); }
  function canopy(c, u, col, blobs, seed) {
    blobs.forEach(function (b, i) { paint(c, function () { blobPath(c, b[0] * u, b[1] * u, b[2] * u, b[2] * u * 0.92, seed + i, 0.1); }, i === blobs.length - 1 ? lt(col, 0.12) : col, { x: (b[0] - b[2]) * u, y: (b[1] - b[2]) * u, w: b[2] * 2 * u, h: b[2] * 2 * u }, { inkW: 1.5 }); });
    // leaf flicks
    var r = PG.mulberry(seed * 3); c.strokeStyle = dk(col, 0.4, 0.55); c.lineWidth = 1.2; c.lineCap = 'round';
    for (var i = 0; i < 9; i++) { var b2 = blobs[i % blobs.length], a = r() * TAU, d = r() * b2[2] * 0.7, x = (b2[0] + Math.cos(a) * d) * u, y = (b2[1] + Math.sin(a) * d) * u; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + u * 0.04, y - u * 0.06, x + u * 0.08, y - u * 0.02); c.stroke(); }
  }
  function trunk(c, u, h, col) { paint(c, function () { c.beginPath(); c.moveTo(-u * 0.13, 0); c.quadraticCurveTo(-u * 0.06, -h * 0.5, -u * 0.07, -h); c.lineTo(u * 0.07, -h); c.quadraticCurveTo(u * 0.06, -h * 0.5, u * 0.14, 0); c.closePath(); }, col, { x: -u * 0.14, y: -h, w: u * 0.28, h: h }, { inkW: 1.5 }); }
  function fruit(c, x, y, rr, col) { paint(c, function () { c.beginPath(); c.arc(x, y, rr, 0, TAU); }, col, { x: x - rr, y: y - rr, w: rr * 2, h: rr * 2 }, { inkW: 1.1, edge: 1.5 }); c.fillStyle = 'rgba(255,250,235,.7)'; c.beginPath(); c.arc(x - rr * 0.35, y - rr * 0.35, rr * 0.28, 0, TAU); c.fill(); }
  function paintCrop(c, tier, u) {
    switch (tier) {
      case 0: soil(c, u, 0.34); paint(c, function () { c.beginPath(); c.ellipse(u * 0.02, -u * 0.12, u * 0.15, u * 0.2, 0.5, 0, TAU); }, '#a8743f', { x: -u * 0.18, y: -u * 0.34, w: u * 0.36, h: u * 0.42 }); c.strokeStyle = dk('#a8743f', 0.4, 0.6); c.lineWidth = 1.3; c.beginPath(); c.moveTo(-u * 0.06, -u * 0.02); c.quadraticCurveTo(u * 0.04, -u * 0.12, u * 0.08, -u * 0.27); c.stroke(); break;
      case 1: soil(c, u, 0.34); stem(c, [[0, -u * 0.02], [u * 0.02, -u * 0.22], [0, -u * 0.42]], u * 0.06, '#6f9d4f'); leafAt(c, 0, -u * 0.4, u * 0.36, -0.55, u * 0.13, '#8cbf5f'); leafAt(c, 0, -u * 0.4, u * 0.34, Math.PI + 0.5, u * 0.12, '#7fb052'); break;
      case 2: soil(c, u, 0.36); stem(c, [[0, 0], [u * 0.03, -u * 0.35], [0, -u * 0.66]], u * 0.06, '#5f8f45'); leafAt(c, 0, -u * 0.06, u * 0.5, -1.0, u * 0.12, '#7aae55'); leafAt(c, 0, -u * 0.1, u * 0.45, Math.PI + 0.9, u * 0.11, '#6c9e4b');
        paint(c, function () { c.beginPath(); c.moveTo(-u * 0.2, -u * 0.62); c.quadraticCurveTo(-u * 0.26, -u * 0.96, -u * 0.12, -u * 1.02); c.lineTo(-u * 0.03, -u * 0.86); c.lineTo(u * 0.05, -u * 1.04); c.lineTo(u * 0.13, -u * 0.86); c.quadraticCurveTo(u * 0.27, -u * 0.98, u * 0.2, -u * 0.62); c.quadraticCurveTo(0, -u * 0.5, -u * 0.2, -u * 0.62); c.closePath(); }, '#e2706a', { x: -u * 0.26, y: -u * 1.05, w: u * 0.52, h: u * 0.5 }); break;
      case 3: soil(c, u, 0.38); stem(c, [[0, 0], [u * 0.04, -u * 0.45], [0, -u * 0.82]], u * 0.07, '#5f8f45'); leafAt(c, u * 0.02, -u * 0.3, u * 0.42, -0.45, u * 0.13, '#7aae55'); leafAt(c, 0, -u * 0.48, u * 0.42, Math.PI + 0.4, u * 0.13, '#6c9e4b');
        c.save(); c.translate(0, -u * 0.9); for (var i = 0; i < 13; i++) { var a = i / 13 * TAU; leafAt(c, Math.cos(a) * u * 0.12, Math.sin(a) * u * 0.12, u * 0.24, a, u * 0.075, i % 2 ? '#f2c14e' : '#ebb43a'); }
        paint(c, function () { c.beginPath(); c.arc(0, 0, u * 0.16, 0, TAU); }, '#7a4b2a', { x: -u * 0.16, y: -u * 0.16, w: u * 0.32, h: u * 0.32 }); c.fillStyle = 'rgba(40,25,15,.45)'; for (i = 0; i < 10; i++) { var a2 = i * 2.4, rr2 = Math.sqrt(i / 10) * u * 0.11; c.beginPath(); c.arc(Math.cos(a2) * rr2, Math.sin(a2) * rr2, 1.3, 0, TAU); c.fill(); } c.restore(); break;
      case 4: soil(c, u, 0.5); canopy(c, u, '#5e9150', [[-0.28, -0.3, 0.3], [0.3, -0.32, 0.3], [0.02, -0.52, 0.36]], 40);
        [[-0.3, -0.35], [0.12, -0.6], [0.34, -0.3], [-0.06, -0.3], [0.22, -0.5], [-0.2, -0.58]].forEach(function (p) { fruit(c, p[0] * u, p[1] * u, u * 0.07, '#c4444a'); }); break;
      case 5: soil(c, u, 0.46); trunk(c, u, u * 0.72, '#8a5c3b'); canopy(c, u, '#4f8a4f', [[-0.36, -0.82, 0.34], [0.36, -0.84, 0.34], [-0.02, -0.72, 0.32], [0.0, -1.1, 0.42]], 51); break;
      case 6: soil(c, u, 0.5); trunk(c, u, u * 0.78, '#8a5c3b'); canopy(c, u, '#6aa253', [[-0.4, -0.88, 0.36], [0.4, -0.9, 0.36], [0, -0.76, 0.34], [0.0, -1.18, 0.45]], 63);
        [[-0.42, -0.92], [0.34, -0.78], [0.06, -1.24], [-0.16, -0.66], [0.46, -1.04], [-0.2, -1.1]].forEach(function (p) { fruit(c, p[0] * u, p[1] * u, u * 0.085, '#d9534f'); }); break;
      case 7: soil(c, u, 0.5); trunk(c, u, u * 0.84, '#9b6a3a'); canopy(c, u, '#e3ad3c', [[-0.42, -0.95, 0.38], [0.42, -0.97, 0.38], [0, -0.82, 0.36], [0.0, -1.27, 0.47]], 77);
        [[-0.3, -1.0], [0.3, -0.9], [0.05, -1.35], [0.4, -1.15], [-0.42, -1.2]].forEach(function (p) { fruit(c, p[0] * u, p[1] * u, u * 0.07, '#fbe7a1'); }); break;
    }
  }
  function drawCrop(c, tier, x, y, u, t, ph, k) {
    var sp = cropSprite(tier, u), sw = Math.sin(t * 1.6 + ph) * (tier >= 4 ? 0.025 : 0.05);
    c.save(); c.translate(x, y); var sq = 1 + Math.sin(t * 2.2 + ph) * 0.012; c.scale(k * (2 - Math.min(k, 1)), k * sq); c.rotate(sw);
    c.drawImage(sp, -sp.ox, -sp.oy, sp.lw, sp.lh); c.restore();
    if (tier === MAXT) { for (var i = 0; i < 5; i++) { var sa = (t * 1.1 + i * 1.26 + ph) % TAU, al = 0.5 + 0.5 * Math.sin(t * 4 + i * 2); c.globalAlpha = al * k; sparkle(c, x + Math.cos(sa) * u * 0.6, y - u * 1.05 + Math.sin(sa) * u * 0.45, u * 0.09); } c.globalAlpha = 1; }
  }
  function sparkle(c, x, y, r) { c.fillStyle = '#fff8dc'; c.beginPath(); c.moveTo(x, y - r); c.quadraticCurveTo(x, y, x + r, y); c.quadraticCurveTo(x, y, x, y + r); c.quadraticCurveTo(x, y, x - r, y); c.quadraticCurveTo(x, y, x, y - r); c.fill(); }

  /* ------------ background + island (painted once per size) ------------ */
  var bgCache = null, islandCache = null, cloudSprites = [];
  function buildBackground(w, h) {
    bgCache = offscreen(w, h, function (c) {
      var g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#f6e7c8'); g.addColorStop(0.55, '#e5ecdc'); g.addColorStop(1, '#cfe1d8'); c.fillStyle = g; c.fillRect(0, 0, w, h);
      // far hills (soft), mid hills, near meadow - painted with ink edges
      var layers = [['#b9cdbd', 0.58, 0.07, 3, 0.5], ['#a6c18f', 0.66, 0.06, 7, 0.8], ['#8fb07a', 0.76, 0.05, 11, 1]];
      layers.forEach(function (L, li) {
        var col = L[0], base = h * L[1], amp = h * L[2], r = PG.mulberry(L[3]);
        var p1 = r() * 6, p2 = r() * 6, f1 = 2 + r() * 2, f2 = 5 + r() * 3;
        var path = function () { c.beginPath(); c.moveTo(-60, h + 60); for (var x = -60; x <= w + 60; x += 6) c.lineTo(x, base - Math.sin(x / w * f1 + p1) * amp - Math.sin(x / w * f2 + p2) * amp * 0.35); c.lineTo(w + 60, h + 60); c.closePath(); };
        paint(c, path, col, { x: 0, y: base - amp * 1.4, w: w, h: h - base + amp * 1.4 }, { inkW: 1.4, inkA: 0.35 + li * 0.15 });
        // painted tree dots on the far ridges
        if (li < 2) for (var k2 = 0; k2 < 9; k2++) { var tx = r() * w, ty = base - Math.sin(tx / w * f1 + p1) * amp - Math.sin(tx / w * f2 + p2) * amp * 0.35, tr = h * (0.012 + r() * 0.01); paint(c, function () { blobPath(c, tx, ty - tr * 0.8, tr, tr * 1.25, k2 + li * 20, 0.08); }, li ? '#6f9468' : '#8eab98', { x: tx - tr, y: ty - tr * 2.2, w: tr * 2, h: tr * 2.6 }, { inkW: 1, inkA: 0.4 }); }
      });
      // meadow flowers in the foreground
      var r2 = PG.mulberry(99); for (var f = 0; f < 60; f++) { var fx = r2() * w, fy = h * (0.8 + r2() * 0.2), fc = ['#e88d8d', '#fff6e0', '#f2c14e', '#c7a0d9'][f % 4]; c.fillStyle = fc; c.beginPath(); c.arc(fx, fy, 1.5 + r2() * 2, 0, TAU); c.fill(); c.strokeStyle = 'rgba(59,47,42,.35)'; c.lineWidth = 0.8; c.stroke(); }
    });
    cloudSprites = [0, 1, 2].map(function (k) {
      var cw = 180, ch = 80; return offscreen(cw, ch, function (c) {
        var r = PG.mulberry(500 + k), blobs = []; for (var i = 0; i < 4; i++) blobs.push([cw * (0.25 + i * 0.17), ch * (0.58 - (i % 2) * 0.12 - (i === 1 || i === 2 ? 0.1 : 0)), ch * (0.24 + r() * 0.12)]);
        c.fillStyle = 'rgba(59,47,42,.08)'; c.fillRect(cw * 0.15, ch * 0.7, cw * 0.7, 3);
        blobs.forEach(function (b, i) { paint(c, function () { blobPath(c, b[0], b[1], b[2] * 1.2, b[2], 600 + k * 10 + i, 0.1); }, '#fffaf0', { x: b[0] - b[2], y: b[1] - b[2], w: b[2] * 2, h: b[2] * 2 }, { inkW: 1.3, inkA: 0.45, edge: 3 }); });
      });
    });
  }
  function buildIsland() {
    var s = geo.s, W = s * S3 * 7 + s * 1.6, H = s * 14.2, ox = W / 2, oy = s * 4.9;
    islandCache = offscreen(W, H, function (c) {
      c.translate(ox, oy);
      // rock underside with painted strata
      var rock = function () { c.beginPath(); c.moveTo(-s * 6.05, s * 0.45); c.quadraticCurveTo(-s * 6.1, s * 3.6, -s * 3.1, s * 5.0); c.quadraticCurveTo(-s * 2.0, s * 6.1, -s * 0.95, s * 6.6); c.lineTo(-s * 0.35, s * 8.6); c.lineTo(s * 0.35, s * 6.95); c.lineTo(s * 1.15, s * 7.8); c.lineTo(s * 1.5, s * 6.45); c.quadraticCurveTo(s * 2.45, s * 5.6, s * 3.05, s * 5.0); c.quadraticCurveTo(s * 6.1, s * 3.6, s * 6.05, s * 0.45); c.closePath(); };
      paint(c, rock, '#b68a62', { x: -s * 6, y: 0, w: s * 12, h: s * 8.6 }, { inkW: 2 });
      c.save(); rock(); c.clip(); var r = PG.mulberry(3);
      for (var L = 0; L < 6; L++) { var yy = s * (1.6 + L * 1.05); c.strokeStyle = 'rgba(59,47,42,' + (0.25 + r() * 0.15) + ')'; c.lineWidth = 1.4; c.beginPath(); for (var x = -s * 6; x <= s * 6; x += s * 0.5) c.lineTo(x, yy + Math.sin(x / s + L * 2) * s * 0.12 + (r() - 0.5) * s * 0.08); c.stroke(); c.fillStyle = L % 2 ? 'rgba(120,80,50,.16)' : 'rgba(255,240,215,.12)'; c.fillRect(-s * 6, yy, s * 12, s * 0.5); }
      for (var p = 0; p < 18; p++) { var px = (r() - 0.5) * s * 9, py = s * (1.5 + r() * 5), pr = s * (0.08 + r() * 0.12); paint(c, function () { c.beginPath(); c.ellipse(px, py, pr * 1.4, pr, 0, 0, TAU); }, '#a07a58', { x: px - pr, y: py - pr, w: pr * 2.8, h: pr * 2 }, { inkW: 1, edge: 1.5 }); }
      // hanging roots
      c.strokeStyle = 'rgba(59,47,42,.55)'; c.lineWidth = 1.3; for (var k3 = 0; k3 < 8; k3++) { var rx = (r() - 0.5) * s * 8, ry = s * (0.8 + r() * 1.5); c.beginPath(); c.moveTo(rx, ry); c.quadraticCurveTo(rx + s * 0.2, ry + s * 0.5, rx - s * 0.1, ry + s * (0.8 + r())); c.stroke(); }
      c.restore();
      // tiles: wobbly painted hexes with soil sides
      var order = cells.slice().sort(function (a, b) { return a.r - b.r; });
      order.forEach(function (cl) {
        var x = s * S3 * (cl.q + cl.r / 2), y = s * 1.5 * cl.r * V, seed = 1000 + cl.i * 7, top = hexPts(x, y, s * 0.96, seed, 0.03), th = s * 0.32;
        var side = [top[0], top[1], top[2], [top[2][0], top[2][1] + th], [top[1][0], top[1][1] + th], [top[0][0], top[0][1] + th]];
        paint(c, function () { poly(c, side); }, '#9a6b45', { x: x - s, y: y, w: s * 2, h: th + s * 0.6 }, { inkW: 1.3 });
        var gcol = (cl.q + cl.r * 2) % 3 === 0 ? '#a5c77d' : (cl.q + cl.r) % 2 ? '#9cc27b' : '#94bb72';
        paint(c, function () { poly(c, top); }, gcol, { x: x - s, y: y - s * V, w: s * 2, h: s * 2 * V }, { inkW: 1.4 });
        // grass tufts + clover dots
        var rr = PG.mulberry(seed + 3); c.strokeStyle = 'rgba(59,47,42,.5)'; c.lineWidth = 1; c.lineCap = 'round';
        for (var tf = 0; tf < 3; tf++) { var gx = x + (rr() - 0.5) * s * 1.1, gy = y + (rr() - 0.5) * s * 0.7 * V; c.beginPath(); c.moveTo(gx - 3, gy); c.lineTo(gx - 1.5, gy - 5); c.moveTo(gx, gy); c.lineTo(gx + 0.5, gy - 6.5); c.moveTo(gx + 3, gy); c.lineTo(gx + 2.5, gy - 4.5); c.stroke(); }
        if (rr() < 0.4) { c.fillStyle = rr() < 0.5 ? '#fff6e0' : '#f3c6c6'; var fx2 = x + (rr() - 0.5) * s, fy2 = y + (rr() - 0.5) * s * 0.6 * V; c.beginPath(); c.arc(fx2, fy2, 1.8, 0, TAU); c.fill(); }
      });
    });
    islandCache.ox = ox; islandCache.oy = oy;
  }

  /* ------------ logic ------------ */
  function weightedTier() {
    var m = st.maxT, roll = Math.random();
    if (m <= 1) return roll < 0.8 ? 0 : 1;
    if (m <= 3) return roll < 0.6 ? 0 : roll < 0.9 ? 1 : 2;
    return roll < 0.5 ? 0 : roll < 0.8 ? 1 : roll < 0.95 ? 2 : 3;
  }
  function newGame(restore) {
    cells.forEach(function (c) { c.t = -1; c.pop = 1; c.glow = 0; });
    st.score = 0; st.over = false; st.usedRev = false; st.maxT = 0; st.moves = 0; st.hold = -1; st.overT = 0;
    st.hand = 0; st.next = 0; st.state = 'play'; anims = []; banner = null; PG.parts = []; PG.pops = [];
    var b = PG.save.board;
    if (restore && b && b.t && b.t.length === cells.length) {
      for (var i = 0; i < cells.length; i++) cells[i].t = b.t[i];
      st.score = b.score || 0; st.hand = b.hand || 0; st.next = b.next || 0; st.hold = b.hold === undefined ? -1 : b.hold; st.maxT = b.maxT || 0; st.moves = b.moves || 0; st.usedRev = !!b.usedRev;
    } else {
      st.next = weightedTier();
      [[0, 0, 0], [1, 0, 0], [-1, 1, 1]].forEach(function (s) { cellAt[s[0] + ',' + s[1]].t = s[2]; });
      st.maxT = 1; st.runIdx++;
      PG.track('progression_started', { step_id: 'run', step_index: Math.min(st.runIdx, 50) }); PG.msg('level_started', { level: String(st.runIdx) });
    }
    PG.playing = true; persist();
  }
  function persist() {
    PG.save.board = st.over ? null : { t: cells.map(function (c) { return c.t; }), score: st.score, hand: st.hand, next: st.next, hold: st.hold, maxT: st.maxT, moves: st.moves, usedRev: st.usedRev };
    PG.commit();
  }
  function group(c) {
    var seen = {}, stack = [c], out = []; seen[c.i] = 1;
    while (stack.length) { var x = stack.pop(); out.push(x); nb(x).forEach(function (n) { if (!seen[n.i] && n.t === c.t) { seen[n.i] = 1; stack.push(n); } }); }
    return out;
  }
  function previewGroup(c, tier) { var saved = c.t; c.t = tier; var g = group(c); c.t = saved; return g; }
  function place(c) {
    if (!c || c.t !== -1 || st.over) return;
    st.moves++; c.t = st.hand; c.pop = 0; PG.sfx('drop', 0.95 + Math.random() * 0.1);
    var chain = 0, cur = c;
    for (;;) {
      var g = group(cur);
      if (g.length < 3) break;
      chain++;
      var t = cur.t;
      if (t === MAXT) { // golden tree harvest clears the whole group
        var pts = 2000 * g.length * chain; st.score += pts;
        g.forEach(function (x) { var p = cellXY(x); PG.burst(p.x, p.y - geo.s * 0.7, 18, { colors: ['#e3ad3c', '#fbe7a1', '#fff8dc'], up: 160, g: 180, life: 1.4, s0: 2, s1: 5, shape: leafShape }); x.t = -1; });
        banner = { s: 'Golden harvest!', sub: '+' + PG.fmt(pts), t: 0 }; PG.sfx('golden'); PG.musicDuck(0.35, 2); shake = 9;
        break;
      }
      var pts2 = TIERS[t + 1].v * g.length * chain; st.score += pts2;
      g.forEach(function (x) { if (x !== cur) anims.push({ t: 0, from: cellXY(x), to: cellXY(cur), tier: t }); x.t = -1; });
      cur.t = t + 1; cur.pop = 0; cur.glow = 1;
      var cp = cellXY(cur);
      PG.burst(cp.x, cp.y - geo.s * 0.5, 10 + chain * 5, { colors: ['#9cc27b', '#f2c14e', '#e88d8d', '#fff6e0'], up: 110, g: 160, life: 1.1, s0: 2, s1: 5, shape: leafShape, drag: 1.2 });
      PG.popText(cp.x, cp.y - geo.s * 1.25, '+' + PG.fmt(pts2), chain > 1 ? '#c2571a' : INK, 19 + chain * 3);
      if (chain > 1) PG.popText(cp.x, cp.y - geo.s * 1.85, 'chain x' + chain, '#8e5aa8', 18);
      PG.sfx('merge', 1 + (chain - 1) * 0.12); PG.vibrate(12);
      if (t + 1 > st.maxT) {
        st.maxT = t + 1;
        if ((PG.save.found || 0) < st.maxT) { PG.save.found = st.maxT; PG.track('crop_unlocked', { tier: st.maxT }); }
        banner = { s: 'New crop', sub: TIERS[t + 1].n, t: 0, tier: t + 1 }; PG.sfx('win'); PG.musicDuck(0.4, 1.6);
        if (t + 1 === MAXT) PG.track('milestone_reached', { milestone: 'golden_tree' });
      }
    }
    st.hand = st.next; st.next = weightedTier();
    if (st.score > (PG.save.best || 0)) PG.save.best = st.score;
    if (!cells.some(function (x) { return x.t === -1; })) endGame(); else persist();
  }
  function endGame() {
    st.over = true; st.overT = 0; PG.playing = false; PG.save.games = (PG.save.games || 0) + 1; PG.save.board = null;
    st.newBest = st.score > 0 && st.score >= (PG.save.best || 0); PG.save.best = Math.max(PG.save.best || 0, st.score); PG.commit(true);
    PG.track('progression_failed', { step_id: 'run', step_index: Math.min(st.runIdx, 50), score: st.score, max_tier: st.maxT, moves: st.moves });
    PG.msg('level_failed', { level: String(st.runIdx) }); PG.sfx('lose');
  }
  function swapHold() {
    if (st.over || st.state !== 'play') return; PG.sfx('whoosh');
    if (st.hold === -1) { st.hold = st.hand; st.hand = st.next; st.next = weightedTier(); } else { var t = st.hold; st.hold = st.hand; st.hand = t; }
    slots.pulse = 1; persist();
  }
  function reviveClear() { // rewarded: clear the eight smallest crops and keep playing (once per run)
    var occ = cells.filter(function (c) { return c.t >= 0; }).sort(function (a, b) { return a.t - b.t; });
    for (var i = 0; i < 8 && i < occ.length; i++) { var p = cellXY(occ[i]); PG.burst(p.x, p.y - 10, 8, { colors: ['#fff6e0', '#9cc27b'], shape: leafShape }); occ[i].t = -1; }
    st.over = false; st.usedRev = true; PG.playing = true; persist(); PG.sfx('upgrade');
  }
  function leafShape(c, p, k) { c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.beginPath(); c.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, TAU); c.fill(); c.strokeStyle = 'rgba(59,47,42,.5)'; c.lineWidth = 0.8; c.stroke(); c.restore(); }

  /* ------------ geometry ------------ */
  function layout(w, h) {
    var landscape = w > h * 1.15, sc = PG.scale(), s, r = Math.min(42 * sc, w * 0.11);
    if (landscape) { s = Math.min((w - 200 * sc) * 0.9 / (S3 * 7), h * 0.92 / 13.4); geo.cx = (w - 150 * sc) / 2 + 20 * sc; geo.cy = h * 0.04 + (4.5 * V + 1.3) * s; }
    else {
      var top = 122 * sc, bottom = h - 2.7 * r - 46 * sc;
      s = Math.min(w * 0.92 / (S3 * 7), (bottom - top) / 13.4);
      geo.cx = w / 2; geo.cy = top + (4.5 * V + 1.3) * s + Math.max(0, (bottom - top - 13.4 * s) * (st.state === 'menu' ? 0.85 : 0.5));
    }
    if (Math.abs(s - geo.s) > 0.5 || !islandCache || geo.w !== w || geo.h !== h) { geo.s = s; geo.w = w; geo.h = h; sprites = {}; buildIsland(); buildBackground(w, h); }
    geo.landscape = landscape;
  }
  function cellXY(c) { return { x: geo.cx + geo.s * S3 * (c.q + c.r / 2), y: geo.cy + geo.s * 1.5 * c.r * V + bob() }; }
  function bob() { return Math.sin(t0 * 0.8) * geo.s * 0.06; }
  function pickCell(px, py) {
    var y = (py - geo.cy - bob()) / (geo.s * V), x = px - geo.cx;
    var qf = (x * S3 / 3 - y / 3) / geo.s, rf = (y * 2 / 3) / geo.s;
    var xf = qf, zf = rf, yf = -xf - zf, rx = Math.round(xf), ry = Math.round(yf), rz = Math.round(zf);
    var dx = Math.abs(rx - xf), dy = Math.abs(ry - yf), dz = Math.abs(rz - zf);
    if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
    return cellAt[rx + ',' + rz] || null;
  }

  /* ------------ drawing ------------ */
  function dayTint(t) { var p = (t / 160) % 1; return { a: Math.max(0, Math.sin(p * TAU - 1.2)) * 0.55, warm: Math.max(0, Math.sin(p * TAU + 0.2)) }; }
  function drawWorld(c, w, h, t) {
    c.drawImage(bgCache, 0, 0, w, h);
    var tint = dayTint(t);
    // sun
    var sx = w * 0.8, sy = h * 0.2; c.fillStyle = 'rgba(242,193,78,.25)'; c.beginPath(); c.arc(sx, sy, h * 0.07, 0, TAU); c.fill();
    paint(c, function () { c.beginPath(); c.arc(sx, sy, h * 0.042, 0, TAU); }, '#f2c14e', { x: sx - h * 0.042, y: sy - h * 0.042, w: h * 0.084, h: h * 0.084 }, { inkW: 1.4, inkA: 0.6 });
    clouds.forEach(function (k) { k.x += k.v * 0.016; if (k.x > 1.25) k.x = -0.25; var sp = cloudSprites[k.k], cw = Math.min(w, h) * 0.3 * k.s; c.drawImage(sp, k.x * w - cw / 2, k.y * h + Math.sin(t * 0.3 + k.k) * 3, cw, cw * sp.lh / sp.lw); });
    birds.forEach(function (b) { b.x += b.v * 0.016; if (b.x > 1.1) b.x = -0.1; var bx = b.x * w, by = b.y * h + Math.sin(t + b.p) * 5, f = Math.sin(t * 6 + b.p) * 4; inkLine(c, [[bx - 8, by + f], [bx - 3, by - 2], [bx, by]], 1.6, 0.7); inkLine(c, [[bx, by], [bx + 3, by - 2], [bx + 8, by + f]], 1.6, 0.7); });
    if (tint.a > 0.01) { c.save(); c.globalCompositeOperation = 'multiply'; c.fillStyle = 'rgba(120,110,170,' + tint.a + ')'; c.fillRect(0, 0, w, h); c.restore(); }
    return tint;
  }
  function drawIsland(c, t) {
    var s = geo.s, by = bob();
    c.fillStyle = 'rgba(59,47,42,.12)'; c.beginPath(); c.ellipse(geo.cx, geo.cy + s * 9.6, s * 3.6, s * 0.55, 0, 0, TAU); c.fill();
    c.drawImage(islandCache, geo.cx - islandCache.ox, geo.cy - islandCache.oy + by, islandCache.lw, islandCache.lh);
    // waterfall
    var wx = geo.cx + s * 2.2, wy = geo.cy + s * 5.2 + by; c.fillStyle = 'rgba(160,205,220,.75)'; c.beginPath(); c.moveTo(wx - s * 0.12, wy); c.quadraticCurveTo(wx - s * 0.1, wy + s * 1.6, wx - s * 0.04, wy + s * 3.2); c.lineTo(wx + s * 0.06, wy + s * 3.2); c.quadraticCurveTo(wx + s * 0.12, wy + s * 1.6, wx + s * 0.12, wy); c.fill();
    c.strokeStyle = 'rgba(59,47,42,.45)'; c.lineWidth = 1; c.stroke();
    for (var i = 0; i < 5; i++) { var yy = wy + ((t * 1.6 + i * 0.7) % 3.2) * s; c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(wx - s * 0.04, yy); c.lineTo(wx - s * 0.03, yy + s * 0.3); c.stroke(); }
    // hover + merge preview
    if (hover && st.state === 'play' && !st.over && hover.t === -1) {
      var p = cellXY(hover), g = previewGroup(hover, st.hand), pts = hexPts(p.x, p.y, s * 0.9, 0, 0);
      c.fillStyle = 'rgba(255,250,235,.35)'; poly(c, pts); c.fill();
      if (g.length >= 3) { g.forEach(function (x) { var q2 = cellXY(x); c.setLineDash([5, 4]); c.lineDashOffset = -t * 20; poly(c, hexPts(q2.x, q2.y, s * 0.86, 0, 0)); c.strokeStyle = '#c2571a'; c.lineWidth = 2.2; c.stroke(); c.setLineDash([]); }); }
    }
    // crops back to front
    var order = cells.slice().sort(function (a, b) { return a.r - b.r || a.q - b.q; });
    order.forEach(function (cl) {
      if (cl.pop < 1) cl.pop = Math.min(1, cl.pop + 0.06); if (cl.glow > 0) cl.glow = Math.max(0, cl.glow - 0.02);
      var p = cellXY(cl);
      if (cl === hover && cl.t === -1 && st.state === 'play' && !st.over) { c.globalAlpha = 0.55; drawCrop(c, st.hand, p.x, p.y + s * 0.08, s * 1.18, t, 0, 1); c.globalAlpha = 1; return; }
      if (cl.t < 0) return;
      if (cl.glow > 0) { c.fillStyle = 'rgba(255,240,190,' + cl.glow * 0.5 + ')'; c.beginPath(); c.ellipse(p.x, p.y - s * 0.4, s * 0.9, s * 0.9, 0, 0, TAU); c.fill(); }
      drawCrop(c, cl.t, p.x, p.y + s * 0.08, s * 1.18, t, cl.ph, PG.ease.back(cl.pop));
    });
  }
  function drawCreatures(c, w, h, t) {
    flies.forEach(function (f) {
      f.a += 0.012 + Math.sin(t + f.p) * 0.01; f.x += Math.cos(f.a) * 0.0008; f.y += Math.sin(f.a * 1.3) * 0.0005;
      if (f.x < -0.05) f.x = 1.05; if (f.x > 1.05) f.x = -0.05; f.y = PG.clamp(f.y, 0.2, 0.7);
      var x = f.x * w, y = f.y * h, fl = 0.3 + Math.abs(Math.sin(t * 12 + f.p)) * 0.7;
      c.save(); c.translate(x, y); [-1, 1].forEach(function (sd) { c.beginPath(); c.ellipse(sd * 4.5 * fl, -2, 4.6 * fl + 1, 3.6, sd * 0.4, 0, TAU); c.fillStyle = f.c; c.fill(); c.strokeStyle = INK; c.lineWidth = 0.9; c.globalAlpha = 0.7; c.stroke(); c.globalAlpha = 1; }); c.fillStyle = INK; c.fillRect(-0.8, -4, 1.6, 7); c.restore();
    });
    petals.forEach(function (p) { p.y += p.v * 0.016; p.x += Math.sin(t * 0.8 + p.p) * 0.0004 + 0.0002; if (p.y > 1.05) { p.y = -0.05; p.x = Math.random(); } c.save(); c.translate(p.x * w, p.y * h); c.rotate(t + p.p); c.fillStyle = p.c; c.beginPath(); c.ellipse(0, 0, 4, 2.2, 0, 0, TAU); c.fill(); c.strokeStyle = 'rgba(59,47,42,.4)'; c.lineWidth = 0.7; c.stroke(); c.restore(); });
  }
  // parchment medallion: deckled circle with ink rim
  function medallion(c, x, y, r, active, seed) {
    c.save(); c.fillStyle = 'rgba(59,47,42,.18)'; c.beginPath(); c.arc(x + 2, y + 3, r, 0, TAU); c.fill();
    paint(c, function () { blobPath(c, x, y, r, r, seed || 7, 0.035); }, active ? '#fbf3df' : PAPER, { x: x - r, y: y - r, w: r * 2, h: r * 2 }, { inkW: active ? 2.4 : 1.6, edge: 5 });
    if (active) { c.setLineDash([3, 4]); c.beginPath(); c.arc(x, y, r * 0.84, 0, TAU); c.strokeStyle = 'rgba(194,87,26,.6)'; c.lineWidth = 1.4; c.stroke(); c.setLineDash([]); }
    c.restore();
  }
  function slotChip(c, key, tier, x, y, r, label, active, t) {
    var pulse = key === 'hand' && slots.pulse ? slots.pulse : 0;
    medallion(c, x, y, r * (1 + pulse * 0.08), active, key.length * 13);
    if (tier >= 0) { c.save(); c.beginPath(); c.arc(x, y, r * 0.9, 0, TAU); c.clip(); drawCrop(c, tier, x, y + r * 0.58, r * 0.72, t, 1, 1); c.restore(); }
    else { U.text(c, '?', x, y + 1, r * 0.6, 'rgba(59,47,42,.35)', 'center', { shadow: false }); }
    U.text(c, label, x, y + r + 12 * PG.scale(), 12 * PG.scale(), INK, 'center', { font: 'body', shadow: false, spacing: 1.5 });
    slots[key] = { x: x - r, y: y - r, w: r * 2, h: r * 2 };
  }
  function ribbon(c, x, y, w, h, col) {
    c.save(); c.fillStyle = 'rgba(59,47,42,.18)'; c.fillRect(x + 3, y + 4, w, h);
    paint(c, function () { c.beginPath(); c.moveTo(x - h * 0.35, y); c.lineTo(x + w + h * 0.35, y); c.lineTo(x + w, y + h / 2); c.lineTo(x + w + h * 0.35, y + h); c.lineTo(x - h * 0.35, y + h); c.lineTo(x, y + h / 2); c.closePath(); }, col, { x: x, y: y, w: w, h: h }, { inkW: 1.6 });
    c.restore();
  }
  function drawUI(c, w, h, t) {
    var sc = PG.scale();
    ribbon(c, 18 * sc, 14 * sc, 150 * sc, 46 * sc, '#c97a4e');
    U.text(c, PG.fmt(PG.count('score', st.score)), 18 * sc + 75 * sc, 37 * sc, 28 * sc, PAPER, 'center', { stroke: INK, strokeWidth: 4 * sc, shadow: false });
    U.text(c, 'BEST ' + PG.fmt(PG.save.best || 0), 18 * sc + 75 * sc, 72 * sc, 12 * sc, INK, 'center', { font: 'body', shadow: false, spacing: 1.5 });
    // collection row
    var ico = 13 * sc, rowY = 98 * sc, x0 = 18 * sc + ico;
    for (var i = 0; i <= MAXT; i++) {
      var ix = x0 + i * ico * 2.25, found = i <= Math.max(st.maxT, PG.save.found || 0);
      medallion(c, ix, rowY, ico, i === st.maxT, 30 + i);
      if (found) { c.save(); c.beginPath(); c.arc(ix, rowY, ico * 0.9, 0, TAU); c.clip(); drawCrop(c, i, ix, rowY + ico * 0.62, ico * 0.6, t, i, 1); c.restore(); }
      else U.text(c, '?', ix, rowY + 1, ico * 0.9, 'rgba(59,47,42,.35)', 'center', { shadow: false });
    }
    // keep / now / next
    var r = Math.min(42 * sc, w * 0.11), rs = r * 0.68;
    if (geo.landscape) { var cx = w - 82 * sc, cy = h * 0.5; slotChip(c, 'hold', st.hold, cx, cy - r * 2.5, rs, 'KEEP', false, t); slotChip(c, 'hand', st.hand, cx, cy, r, 'PLANT', true, t); slotChip(c, 'next', st.next, cx, cy + r * 2.4, rs, 'NEXT', false, t); }
    else { var by = h - r - 34 * sc; slotChip(c, 'hold', st.hold, w / 2 - r * 2.6, by + r * 0.2, rs, 'KEEP', false, t); slotChip(c, 'hand', st.hand, w / 2, by, r, 'PLANT', true, t); slotChip(c, 'next', st.next, w / 2 + r * 2.6, by + r * 0.2, rs, 'NEXT', false, t); }
    if (slots.pulse) slots.pulse = Math.max(0, slots.pulse - 0.06);
    if (!st.over && U.hit(slots.hold.x, slots.hold.y, slots.hold.w, slots.hold.h)) swapHold();
    // first-game hint: a little painted hand pointing at a good tile
    if (st.moves === 0 && !PG.save.games && !st.over) { var tip = cellAt['0,1'], p = cellXY(tip); pointer(c, p.x + geo.s * 0.2, p.y - geo.s * 0.1, t); note(c, w / 2, geo.landscape ? h - 22 * sc : geo.cy - geo.s * (4.5 * V + 1.9), 'Three alike grow into something new', t); }
    if (banner) {
      var a = Math.min(1, banner.t * 4) * Math.min(1, (2.4 - banner.t) * 3);
      if (a > 0) { c.save(); c.globalAlpha = a; var yb = geo.landscape ? h * 0.13 : geo.cy - geo.s * 5.2, sk = PG.ease.back(Math.min(1, banner.t * 3)); c.translate(w / 2, yb); c.scale(sk, sk);
        ribbon(c, -120 * sc, -24 * sc, 240 * sc, 50 * sc, banner.tier === undefined ? '#e3ad3c' : '#8fae6a');
        U.text(c, banner.s + ': ' + banner.sub, 0, 1 * sc, 19 * sc, PAPER, 'center', { stroke: INK, strokeWidth: 3.5 * sc, shadow: false }); c.restore(); }
    }
  }
  function pointer(c, x, y, t) { var k = (Math.sin(t * 4) + 1) / 2; c.save(); c.translate(x + 6, y + 10 + k * 8); c.rotate(-0.5); paint(c, function () { c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-5, 4, -4, 16); c.lineTo(5, 18); c.quadraticCurveTo(10, 8, 6, 2); c.quadraticCurveTo(3, -2, 0, 0); c.closePath(); c.moveTo(-1, 2); c.lineTo(-1, -14); c.quadraticCurveTo(1, -17, 3, -14); c.lineTo(3, 3); }, '#f6d7b8', { x: -5, y: -17, w: 15, h: 35 }, { inkW: 1.4 }); c.restore(); }
  function note(c, x, y, s, t) { var sc = PG.scale(), tw = U.measure(c, s, 14 * sc, { font: 'body' }) + 28 * sc; c.save(); c.translate(x, y + Math.sin(t * 2) * 2); c.rotate(-0.015); paint(c, function () { blobPath(c, 0, 0, tw / 2, 17 * sc, 88, 0.02); }, PAPER, { x: -tw / 2, y: -17 * sc, w: tw, h: 34 * sc }, { inkW: 1.5 }); U.text(c, s, 0, 1, 14 * sc, INK, 'center', { font: 'body', shadow: false }); c.restore(); }
  function card(c, x, y, w, h) { c.fillStyle = 'rgba(59,47,42,.22)'; c.beginPath(); c.rect(x + 5, y + 7, w, h); c.fill(); paint(c, function () { var r = PG.mulberry(4), n = 22; c.beginPath(); c.moveTo(x, y); for (var i = 1; i <= n; i++) c.lineTo(x + w * i / n, y + (r() - 0.5) * 3); for (i = 1; i <= n; i++) c.lineTo(x + w + (r() - 0.5) * 3, y + h * i / n); for (i = n - 1; i >= 0; i--) c.lineTo(x + w * i / n, y + h + (r() - 0.5) * 3); for (i = n - 1; i > 0; i--) c.lineTo(x + (r() - 0.5) * 3, y + h * i / n); c.closePath(); }, PAPER, { x: x, y: y, w: w, h: h }, { inkW: 1.8, edge: 10 }); }

  /* ------------ theme (wooden sign buttons, parchment panels) ------------ */
  PG.theme.font = 'Grandstander'; PG.theme.body = 'Nunito'; PG.theme.weight = '800'; PG.theme.bodyWeight = '800';
  PG.theme.text = INK; PG.theme.textShadow = false; PG.theme.pageColor = '#e5ecdc';
  PG.theme.transition = { style: 'fade', color: PAPER, time: 0.35 };
  PG.theme.popStyle = { stroke: 'rgba(244,234,213,.95)' };
  PG.theme.button = function (c, x, y, w, h, label, o, s) {
    var col = o.disabled ? '#b8ab95' : o.color || '#c97a4e', off = s.press ? 2 : 0, rr = h * 0.28;
    c.fillStyle = 'rgba(59,47,42,.3)'; U.rr(c, x + 2, y + 5, w, h, rr); c.fill();
    paint(c, function () { U.rr(c, x, y + off, w, h, rr); }, s.hover ? lt(col, 0.12) : col, { x: x, y: y + off, w: w, h: h }, { inkW: 2, edge: 6 });
    c.strokeStyle = 'rgba(255,250,235,.35)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(x + rr, y + off + 5); c.lineTo(x + w - rr, y + off + 5); c.stroke();
    var fs = o.size || Math.min(h * 0.44, 26); fs = U.fit(c, label, fs, w - 20);
    U.text(c, label, x + w / 2, y + off + h / 2 + 1, fs, PAPER, 'center', { stroke: INK, strokeWidth: Math.max(3, fs * 0.2), shadow: false });
  };
  PG.theme.panel = function (c, x, y, w, h) { card(c, x, y, w, h); };
  PG.theme.hudButton = function (c, x, y, r, kind) { medallion(c, x, y, r, false, kind.length * 5); PG.hudIcon(c, x, y, r * 0.95, kind, INK); };
  PG.theme.loading = function (c, w, h, t) { c.fillStyle = PAPER; c.fillRect(0, 0, w, h); for (var i = 0; i < 3; i++) { var a = t * 3 + i * 2.1; c.fillStyle = ['#9cc27b', '#f2c14e', '#e88d8d'][i]; c.beginPath(); c.arc(w / 2 + Math.cos(a) * 18, h / 2 + Math.sin(a) * 18, 6, 0, TAU); c.fill(); } };

  function menu(c, w, h, t) {
    var sc = PG.scale(); st.menuT += 0.016;
    var ty = Math.min(h * 0.14, 110 * sc), size = Math.min(58 * sc, w * 0.14);
    c.save(); c.translate(w / 2, ty); c.rotate(-0.03);
    ['Hex', 'Harvest'].forEach(function (word, li) {
      var yy = li * size * 0.95, x0 = -U.measure(c, word, size) / 2, xx = x0;
      for (var k = 0; k < word.length; k++) { var ch = word[k], cw = U.measure(c, ch, size), bounce = Math.sin(t * 2 + k * 0.6 + li) * 2;
        U.text(c, ch, xx + cw / 2, yy + bounce, size, li ? '#f2c14e' : '#9cc27b', 'center', { stroke: INK, strokeWidth: size * 0.14, shadow: true, shadowColor: 'rgba(59,47,42,.3)', sx: 0.03, sy: 0.08 }); xx += cw; }
    });
    c.restore();
    note(c, w / 2, ty + size * 1.75, 'Plant, match three, grow a golden tree', t);
    var bw = Math.min(240 * sc, w * 0.7), bh = 60 * sc, y0 = Math.max(h * 0.66, geo.cy + geo.s * 2.5);
    if (geo.landscape) y0 = h * 0.62;
    var canResume = PG.save.board && PG.save.board.t;
    if (U.button(c, w / 2 - bw / 2, y0, bw, bh, canResume ? 'Continue' : 'Plant', { color: '#c97a4e' })) PG.go(function () { newGame(!!canResume); });
    if (canResume && U.button(c, w / 2 - bw / 2, y0 + bh + 12 * sc, bw, bh * 0.8, 'New island', { color: '#7fa36a' })) PG.go(function () { PG.save.board = null; newGame(false); });
    var info = PG.save.best ? 'Best ' + PG.fmt(PG.save.best) + '   Islands grown ' + (PG.save.games || 0) : 'Music: Zane Little  Sounds: Kenney';
    U.text(c, info, w / 2, h - 18 * sc, 12 * sc, INK, 'center', { font: 'body', shadow: false });
  }
  function gameOver(c, w, h, t) {
    var sc = PG.scale(), k = PG.ease.out(Math.min(1, st.overT * 2));
    c.fillStyle = 'rgba(59,47,42,' + 0.35 * k + ')'; c.fillRect(0, 0, w, h);
    var pw = Math.min(w * 0.88, 360 * sc), ph = (st.usedRev || !PG.rewardedSupported() ? 300 : 360) * sc, px = w / 2 - pw / 2, py = h * 0.5 - ph / 2 + (1 - k) * 50;
    c.save(); c.translate(w / 2, py + ph / 2); c.rotate((1 - k) * 0.05); c.translate(-w / 2, -(py + ph / 2));
    card(c, px, py, pw, ph);
    U.text(c, 'The island is full', w / 2, py + 38 * sc, 24 * sc, INK, 'center', { shadow: false });
    U.text(c, PG.fmt(PG.count('final', st.overT > 0.3 ? st.score : 0)), w / 2, py + 88 * sc, 46 * sc, '#c2571a', 'center', { stroke: INK, strokeWidth: 3 * sc, shadow: false });
    U.text(c, st.newBest ? 'A new best!' : 'Best ' + PG.fmt(PG.save.best || 0), w / 2, py + 126 * sc, 15 * sc, st.newBest ? '#5e8a3a' : INK, 'center', { font: 'body', shadow: false });
    medallion(c, w / 2, py + 170 * sc, 26 * sc, true, 9); c.save(); c.beginPath(); c.arc(w / 2, py + 170 * sc, 23 * sc, 0, TAU); c.clip(); drawCrop(c, st.maxT, w / 2, py + 184 * sc, 16 * sc, t, 0, 1); c.restore();
    U.text(c, TIERS[st.maxT].n, w / 2, py + 207 * sc, 13 * sc, INK, 'center', { font: 'body', shadow: false });
    var bw = pw * 0.8, bh = 46 * sc, yy = py + 226 * sc;
    if (!st.usedRev && PG.rewardedSupported()) { if (U.button(c, w / 2 - bw / 2, yy, bw, bh, 'Ad: clear 8 crops', { color: '#8e6aa8', size: 18 * sc })) { PG.rewarded('continue').then(function (ok) { if (ok) { reviveClear(); PG.track('rewarded_continue', { step_id: 'run' }); } }); } yy += bh + 10 * sc; }
    if (U.button(c, w / 2 - bw / 2, yy, bw, bh, 'Grow again', { color: '#c97a4e' })) { PG.interstitial('game_over').then(function () { PG.go(function () { newGame(false); }); }); }
    c.restore();
  }

  /* ------------ main ------------ */
  PG.onResize = layout;
  PG.onMove = function (x, y) { if (st.state === 'play' && !st.over) hover = pickCell(x, y); };
  function overSlot(x, y) { for (var k in slots) { var s = slots[k]; if (s && s.w && PG.inRect(s.x, s.y, s.w, s.h, x, y)) return true; } return false; }
  PG.onDown = function (x, y) { if (st.state !== 'play' || st.over || overSlot(x, y)) { aiming = false; return; } var cl = pickCell(x, y); hover = cl; aiming = !!cl; };
  PG.onUp = function (x, y) {
    if (st.state !== 'play' || st.over || !aiming) { aiming = false; return; }
    var cl = pickCell(x, y); if (cl && cl.t === -1 && !overSlot(x, y)) place(cl); aiming = false; if (PG.touch) hover = null;
  };
  function update(dt) {
    t0 += dt; PG.updateParts(dt); PG.updatePops(dt); shake = Math.max(0, shake - dt * 30);
    if (banner) { banner.t += dt; if (banner.t > 2.4) banner = null; }
    if (st.over) st.overT += dt;
    for (var i = anims.length - 1; i >= 0; i--) { anims[i].t += dt * 3.5; if (anims[i].t >= 1) anims.splice(i, 1); }
  }
  function render(c, w, h) {
    var t = t0 + 6; layout(w, h);
    c.save(); if (shake > 0.1) c.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    drawWorld(c, w, h, t);
    drawIsland(c, t);
    anims.forEach(function (a) { var e = PG.ease.io(a.t); drawCrop(c, a.tier, PG.lerp(a.from.x, a.to.x, e), PG.lerp(a.from.y, a.to.y, e) - Math.sin(a.t * 3.14) * geo.s, geo.s * 1.18, t, 0, 1 - a.t * 0.5); });
    drawCreatures(c, w, h, t);
    PG.drawParts(c); PG.drawPops(c);
    c.restore();
    if (st.state === 'menu') menu(c, w, h, t); else { drawUI(c, w, h, t); if (st.over) gameOver(c, w, h, t); }
    PG.grain(c, w, h, 0.045, { mode: 'multiply' });
  }
  [[0, 0, 7], [1, 0, 5], [-1, 0, 3], [0, 1, 2], [-1, 1, 1], [1, -1, 4], [0, -1, 6], [2, -1, 0], [-2, 1, 2], [-1, 2, 1], [2, 0, 3], [1, 1, 0], [-2, 2, 4], [0, 2, 1], [-3, 2, 0], [3, -2, 2]].forEach(function (d) { cellAt[d[0] + ',' + d[1]].t = d[2]; });
  PG.setup(document.getElementById('c'), update, render);
  window.__hex = { cells: cells, st: st, newGame: newGame, place: place, cellAt: cellAt };
  PG.init({ id: 'hex_harvest', version: '1.1.0', defaults: { best: 0, games: 0, found: 0, board: null, muted: false } }).then(function () {
    PG.music();
  });
})();
