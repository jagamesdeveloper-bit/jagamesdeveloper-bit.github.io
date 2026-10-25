/* SLOTH SPRINT - a very slow sloth swings through a paper-cut jungle. One button: let go at the right moment.
   Art direction: layered cut paper. Flat colour silhouettes with soft drop shadows, banded paper sky, day to night. */
(function () {
  'use strict';
  var U = PG.ui, TAU = 6.2832;
  var R = 70, A = 1.25, W = 2.7, G = 330, ARM = 0.94; // rope radius, swing amplitude, swing speed, gravity
  var DARK = '#1f3d2f', CREAM = '#f6ecd0';
  var UPS = [
    { id: 'grip', n: 'Sticky Claws', d: 'Bigger grab radius', max: 8, base: 40, grow: 1.5 },
    { id: 'aim', n: 'Dream Aim', d: 'Longer path preview', max: 6, base: 30, grow: 1.5 },
    { id: 'magnet', n: 'Leaf Magnet', d: 'Pulls golden leaves in', max: 6, base: 35, grow: 1.5 },
    { id: 'vine', n: 'Safety Vine', d: 'Catches you once per level', max: 3, base: 120, grow: 2.2 },
    { id: 'value', n: 'Golden Touch', d: '+25% coins per leaf', max: 8, base: 50, grow: 1.6 }
  ];
  var st = { state: 'menu', hooks: [], cur: 0, phase: 0, body: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, flying: false, spin: 0, rot: 0, stretch: 0, stretchUsed: false,
    coinsRun: 0, rescues: 0, dist: 0, bestHit: false, perfects: 0, streak: 0, leaves: [], bees: [], t: 0, runIdx: 0, deadT: 0, tut: 0, rescueT: 0, rescueFrom: null, doubled: false };
  var cam = { x: 0, y: 0 }, scale = 1, anchor = 0.5, lag = { hx: 0, hy: 0, lx: 0 }, blink = 0, blinkT = 2, shake = 0, t0 = 0;
  var fireflies = [], motes = [], stars = [];
  for (var i = 0; i < 22; i++) fireflies.push({ x: Math.random(), y: Math.random(), p: Math.random() * 9, s: 0.5 + Math.random() });
  for (i = 0; i < 18; i++) motes.push({ x: Math.random(), y: Math.random(), p: Math.random() * 9, s: 0.3 + Math.random() });
  for (i = 0; i < 40; i++) stars.push({ x: Math.random(), y: Math.random() * 0.55, p: Math.random() * 9, r: 1 + Math.random() * 1.6 });

  /* ---------- helpers ---------- */
  function lvl(id) { return PG.upLevel(id); }
  function grabR() { var base = Math.max(24, 44 - st.hooks.length * 0.12); return base + lvl('grip') * 3.2; }
  function hookGrab(h) { return { x: h.x, y: h.y + R * ARM }; }
  function theta() { return A * Math.sin(st.phase); }
  function bodyOnHook(h, th) { return { x: h.x + R * Math.sin(th), y: h.y + R * Math.cos(th) }; }
  function hx(h) { var n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rgb(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (a === undefined ? 1 : a) + ')'; }

  /* ---------- world generation (every hook is reachable by construction) ---------- */
  function simulate(x0, y0, vx, vy, T, step) { var pts = [], x = x0, y = y0; for (var t = 0; t <= T; t += step) { pts.push({ x: x, y: y, t: t }); vy += G * step; x += vx * step; y += vy * step; } return pts; }
  function genHook(prev, idx) {
    var minGap = Math.min(92 + idx * 2.2, 190), maxGap = Math.min(150 + idx * 3, 255);
    for (var tries = 0; tries < 40; tries++) {
      var th = PG.rand(0.15, 1.05), thd = A * W * Math.sqrt(Math.max(0.001, 1 - Math.pow(th / A, 2)));
      var b = bodyOnHook(prev, th), sp = R * thd, vx = sp * Math.cos(th), vy = -sp * Math.sin(th);
      var pts = simulate(b.x, b.y, vx, vy, 2.2, 1 / 60);
      var pick = pts[Math.floor(PG.rand(0.35, 0.8) * (pts.length - 1))];
      var gap = pick.x - prev.x; if (gap < minGap || gap > maxGap) continue;
      if (Math.abs(pick.y - R * ARM - prev.y) > 150) continue;
      return { x: pick.x + PG.rand(-6, 6), y: pick.y - R * ARM, pts: pts, tg: pick.t, wob: PG.rand(0, 6), side: Math.random() < 0.5 ? -1 : 1, flower: PG.pick(['#f25f5c', '#ffb347', '#f7d6e0', '#ffe066']) };
    }
    return { x: prev.x + 120, y: prev.y, pts: [], tg: 0, wob: 0, side: 1, flower: '#f25f5c' };
  }
  function extendWorld() {
    while (st.hooks[st.hooks.length - 1].x < st.body.x + 1800) {
      var prev = st.hooks[st.hooks.length - 1], idx = st.hooks.length, h = genHook(prev, idx);
      st.hooks.push(h);
      var val = 1 + 0.25 * lvl('value'); // golden leaves along the ideal arc to the new hook
      if (h.pts.length > 4) for (var k = 1; k <= 3; k++) { var q = h.pts[Math.floor((h.tg / (1 / 60)) * k / 4)]; if (q && Math.random() < 0.85) st.leaves.push({ x: q.x, y: q.y, taken: false, v: val, p: Math.random() * 6 }); }
      if (idx > 6 && Math.random() < Math.min(0.55, 0.15 + idx * 0.012)) { // a bee guarding the gap, away from the ideal arc
        var mx = (prev.x + h.x) / 2, my = Math.min(prev.y, h.y) + (Math.random() < 0.5 ? 20 : R + 85);
        st.bees.push({ x: mx, y: my, bx: mx, by: my, p: Math.random() * 6, a: PG.rand(24, 46), alive: true });
      }
    }
  }
  function firstHook() { return { x: 0, y: 0, pts: [], tg: 0, wob: 0, side: -1, flower: '#f25f5c' }; }
  function startRun() {
    st.state = 'play'; st.hooks = [firstHook()]; st.cur = 0; st.phase = 0.9; st.flying = false; st.leaves = []; st.bees = []; st.coinsRun = 0; st.dist = 0; st.perfects = 0; st.streak = 0;
    st.rescues = lvl('vine'); st.doubled = false; st.bestHit = false; st.runIdx++; st.deadT = 0; st.t = 0; st.stretch = 0;
    st.body = bodyOnHook(st.hooks[0], theta()); st.rot = -theta(); extendWorld(); PG.playing = true; PG.parts = []; PG.pops = [];
    cam.x = st.body.x + 60; cam.y = st.body.y - 40; st.tut = PG.save.runs ? 0 : 1;
    PG.track('progression_started', { step_id: 'run', step_index: Math.min(st.runIdx, 50) }); PG.msg('level_started', { level: String(st.runIdx) });
  }
  function release() {
    if (st.state !== 'play' || st.flying) return;
    var th = theta(), thd = A * W * Math.cos(st.phase), sp = R * thd;
    st.vel.x = sp * Math.cos(th); st.vel.y = -sp * Math.sin(th); st.flying = true; st.stretch = 0; st.stretchUsed = false; st.spin = (st.vel.x >= 0 ? 1 : -1) * 2.2; st.tut = 0;
    PG.sfx('whoosh'); PG.vibrate(10);
  }
  function stretchNow() { if (st.flying && !st.stretchUsed) { st.stretchUsed = true; st.stretch = 0.34; PG.sfx('jump', 1.2); } }
  function tapAction() { if (st.state === 'play' && !PG.userPaused) { if (st.flying) stretchNow(); else release(); } }
  function grabHook(i, perfect) {
    var h = st.hooks[i]; st.cur = i; st.flying = false;
    var th = Math.atan2(st.body.x - h.x, st.body.y - h.y); th = PG.clamp(th, -A * 0.98, A * 0.98);
    var ph = Math.asin(th / A); st.phase = st.vel.x >= -5 ? ph : Math.PI - ph;
    st.dist = Math.max(st.dist, Math.floor(h.x / 10)); st.streak = perfect ? st.streak + 1 : 0; h.bounce = 1;
    var g = hookGrab(h);
    if (perfect) { var bonus = 1 + 0.25 * lvl('value'); st.perfects++; PG.save.coins = Math.round(((PG.save.coins || 0) + bonus) * 100) / 100; st.coinsRun += bonus; PG.popText(g.x, g.y - 40, 'Perfect', '#ffe28a', 24); PG.sfx('perfect', 1 + Math.min(st.streak, 6) * 0.05); PG.burst(g.x, g.y, 16, { colors: ['#ffd23f', '#fff3b0', h.flower], g: 60, life: 1.1, shape: paperBit, s0: 3, s1: 6 }); }
    else { PG.sfx('land'); PG.burst(g.x, g.y - 20, 6, { colors: ['#7fbf6a', '#b6dd8f'], g: 160, shape: paperBit }); }
    PG.track('hook_grabbed', { index: Math.min(i, 200), perfect: perfect });
    if (st.dist > (PG.save.best || 0)) { PG.save.best = st.dist; st.bestHit = true; }
    PG.commit(); extendWorld();
  }
  function die() {
    if (st.state !== 'play') return;
    if (st.rescues > 0) { st.rescues--; st.state = 'rescue'; st.rescueT = 0; st.rescueFrom = { x: st.body.x, y: st.body.y }; st.flying = false; PG.sfx('upgrade'); PG.popText(st.body.x, st.body.y - 40, 'Safety vine!', '#c8f2a8', 24); return; }
    st.state = 'dead'; st.deadT = 0; PG.playing = false; PG.sfx('lose'); PG.vibrate(60); st.vel.x *= 0.3; st.vel.y = Math.min(st.vel.y, -60); st.spin = 3;
    PG.save.runs = (PG.save.runs || 0) + 1; PG.save.best = Math.max(PG.save.best || 0, st.dist); PG.commit(true);
    PG.track('progression_failed', { step_id: 'run', step_index: Math.min(st.runIdx, 50), distance: st.dist, coins: Math.round(st.coinsRun), perfects: st.perfects }); PG.msg('level_failed', { level: String(st.runIdx) });
  }
  function predict(maxT) {
    var th = theta(), thd = A * W * Math.cos(st.phase), sp = R * thd, b = st.body, pts = [], x = b.x, y = b.y, vx = sp * Math.cos(th), vy = -sp * Math.sin(th), hit = -1, gr = grabR();
    for (var t = 0; t < maxT; t += 1 / 30) {
      vy += G / 30; x += vx / 30; y += vy / 30; pts.push({ x: x, y: y });
      for (var i = st.cur + 1; i < st.hooks.length && i < st.cur + 4; i++) { var g = hookGrab(st.hooks[i]); if (Math.hypot(x - g.x, y - g.y) < gr) { hit = i; break; } }
      if (hit >= 0) break;
    }
    return { pts: pts, hit: hit };
  }
  function paperBit(c, p, k) { c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillStyle = p.color; c.beginPath(); c.moveTo(-p.size, 0); c.quadraticCurveTo(0, -p.size * 0.8, p.size, 0); c.quadraticCurveTo(0, p.size * 0.8, -p.size, 0); c.fill(); c.restore(); }

  /* ---------- update ---------- */
  function update(dt) {
    st.t += dt; t0 += dt; blinkT -= dt; if (blinkT < 0) { blink = 0.14; blinkT = PG.rand(1.6, 4.2); } if (blink > 0) blink -= dt; shake = Math.max(0, shake - dt * 25);
    PG.updateParts(dt); PG.updatePops(dt);
    st.hooks.forEach(function (h) { if (h.bounce) h.bounce = Math.max(0, h.bounce - dt * 2.5); });
    if (PG.keyHit(' ') || PG.keyHit('arrowup') || PG.keyHit('w') || PG.keyHit('enter')) { if (st.state === 'play') tapAction(); }
    if (st.state === 'menu' || st.state === 'upgrades') { // idle swing on the first hook
      if (!st.hooks.length) { st.hooks = [firstHook()]; st.cur = 0; }
      st.phase += W * dt * 0.8; st.body = bodyOnHook(st.hooks[0], theta()); st.rot = -theta(); st.flying = false; st.cur = 0;
      cam.x += (st.body.x + 10 - cam.x) * 0.1; cam.y += (st.body.y - 30 - cam.y) * 0.1; return;
    }
    if (st.state === 'dead') { st.deadT += dt; st.vel.y += G * dt; st.body.x += st.vel.x * dt; st.body.y += st.vel.y * dt; st.rot += st.spin * dt; return; }
    if (st.state === 'rescue') {
      st.rescueT += dt; var h = st.hooks[st.cur], tgt = bodyOnHook(h, 0), k = PG.ease.io(Math.min(1, st.rescueT / 1.0));
      st.body.x = PG.lerp(st.rescueFrom.x, tgt.x, k); st.body.y = PG.lerp(st.rescueFrom.y, tgt.y, k); st.rot += (0 - st.rot) * 0.1;
      if (st.rescueT >= 1.0) { st.state = 'play'; st.flying = false; st.phase = 0; st.vel.x = 20; }
      camFollow(dt); return;
    }
    if (st.flying) {
      st.vel.y += G * dt; st.body.x += st.vel.x * dt; st.body.y += st.vel.y * dt; st.rot += st.spin * dt; st.spin *= (1 - dt * 0.6);
      if (st.stretch > 0) st.stretch -= dt;
      var gr = grabR() * (st.stretch > 0 ? 1.7 : 1);
      for (var i = st.cur + 1; i < st.hooks.length && i < st.cur + 4; i++) {
        var g = hookGrab(st.hooks[i]), d = Math.hypot(st.body.x - g.x, st.body.y - g.y);
        if (d < gr) { grabHook(i, d < gr * 0.34); break; }
      }
      for (var b = 0; b < st.bees.length && st.state === 'play'; b++) { var bee = st.bees[b]; if (bee.alive && Math.hypot(bee.x - st.body.x, bee.y - st.body.y) < 22) { bee.alive = false; PG.burst(bee.x, bee.y, 10, { colors: ['#ffd23f', '#2b2b2b', '#fff'], shape: paperBit }); shake = 8; PG.sfx('hit'); st.vel.y = 120; st.vel.x *= 0.3; die(); } }
      var ch = st.hooks[st.cur];
      if (st.state === 'play' && st.body.y > ch.y + R + 420) { PG.sfx('drop'); die(); }
    } else { st.phase += W * dt; st.body = bodyOnHook(st.hooks[st.cur], theta()); st.rot = -theta(); }
    // golden leaves + magnet
    var mr = 26 + lvl('magnet') * 16;
    st.leaves.forEach(function (l) {
      if (l.taken) return; var dx = st.body.x - l.x, dy = st.body.y - l.y, d = Math.hypot(dx, dy);
      if (lvl('magnet') > 0 && d < mr && d > 1) { l.x += dx / d * 120 * dt; l.y += dy / d * 120 * dt; }
      if (d < 26) { l.taken = true; st.coinsRun += l.v; PG.save.coins = Math.round(((PG.save.coins || 0) + l.v) * 100) / 100; PG.sfx('coin', 1 + Math.min(st.streak, 8) * 0.04); PG.burst(l.x, l.y, 6, { colors: ['#ffd23f', '#fff3b0'], g: 0, life: 0.6, min: 20, max: 90, shape: paperBit }); PG.popText(l.x, l.y - 12, '+' + (l.v % 1 === 0 ? l.v : l.v.toFixed(2)), '#ffe28a', 18); }
    });
    st.bees.forEach(function (b) { b.p += dt * 2; b.x = b.bx + Math.cos(b.p) * b.a; b.y = b.by + Math.sin(b.p * 1.3) * b.a * 0.6; });
    while (st.leaves.length && st.leaves[0].x < cam.x - 600) st.leaves.shift();
    if (st.bees.length && st.bees[0].bx < cam.x - 600) st.bees.shift();
    camFollow(dt);
  }
  function camFollow(dt) {
    var lead = st.flying ? PG.clamp(st.vel.x * 0.25, -30, 90) : 30;
    var tx = st.body.x + 70 + lead, ty = (st.hooks[st.cur].y + st.body.y) / 2 - 15 + (st.flying ? Math.max(0, st.vel.y) * 0.1 : 0);
    cam.x += (tx - cam.x) * Math.min(1, dt * 3.2); cam.y += (ty - cam.y) * Math.min(1, dt * 2.2);
  }

  /* ---------- palettes (paper colours for day, sunset, night, dawn) ---------- */
  var PAL = [
    { top: '#8fd0d8', bot: '#f3e9c6', sun: '#fff2b3', l0: '#a7cfc2', l1: '#6fae8f', l2: '#3f8a68', near: '#1f5b44', branch: '#8a5a3c', fog: '#eef3d8', day: 1 },
    { top: '#f08a6a', bot: '#fbd38d', sun: '#fff1c1', l0: '#d99592', l1: '#a45d73', l2: '#6b3d5e', near: '#3a2340', branch: '#6b3a2e', fog: '#f7c59f', day: 0.6 },
    { top: '#13234a', bot: '#3c4f86', sun: '#e9efff', l0: '#2f4371', l1: '#22385a', l2: '#172a45', near: '#0b1628', branch: '#3d3047', fog: '#4a5d94', day: 0 },
    { top: '#c6a3d8', bot: '#ffd9c2', sun: '#ffe7c7', l0: '#b6a7c9', l1: '#8f8fb0', l2: '#5f6f8c', near: '#2f3d55', branch: '#6d5361', fog: '#f2d6d8', day: 0.5 }
  ].map(function (p) { var o = { day: p.day }; for (var k in p) if (k !== 'day') o[k] = hx(p[k]); return o; });
  function palette(t) { var p = ((t % 1) + 1) % 1 * 4, i = Math.floor(p) % 4, j = (i + 1) % 4, k = p - Math.floor(p); k = k * k * (3 - 2 * k); var a = PAL[i], b = PAL[j], o = { day: PG.lerp(a.day, b.day, k) }; for (var key in a) if (key !== 'day') o[key] = mix(a[key], b[key], k); return o; }
  function cycle() { if (st.cyc != null) return st.cyc; if (st.state === 'menu' || st.state === 'upgrades') return 0.02; return ((st.hooks.length ? st.cur : 0) / 90 + 0.02) % 1; }

  /* ---------- paper layers: silhouettes painted once into tileable strips, tinted per palette step ---------- */
  var LAYERS = [{ par: 0.08, kind: 'ridge', col: 'l0' }, { par: 0.22, kind: 'far', col: 'l1' }, { par: 0.45, kind: 'mid', col: 'l2' }];
  var strips = { w: 0, h: 0 };
  function cv(w, h) { var c = document.createElement('canvas'); c.width = Math.ceil(w); c.height = Math.ceil(h); return c; }
  function buildStrips(w, h) {
    var SW = Math.ceil(Math.max(900, w * 1.6)), SH = Math.ceil(h * 1.3);
    strips = { w: w, h: h, SW: SW, SH: SH, key: -1, pending: [] };
    LAYERS.forEach(function (L, li) { var m = cv(SW, SH), c = m.getContext('2d'); c.fillStyle = '#fff'; c.strokeStyle = '#fff'; paintLayer(c, L.kind, SW, SH, 11 + li * 7); L.mask = m; L.tint = null; });
  }
  function wrapX(fn, x, SW) { fn(x); fn(x - SW); fn(x + SW); }
  function frond(c, x, y, len, ang, w) { // palm frond: curved spine with saw-tooth leaflets
    var n = 9; c.beginPath(); c.moveTo(x, y);
    for (var i = 1; i <= n; i++) { var k = i / n, a = ang + k * 0.9 * (ang > -1.57 ? 1 : -1) * 0.5, px = x + Math.cos(a) * len * k, py = y + Math.sin(a) * len * k + k * k * len * 0.35, wid = w * Math.sin(k * 3.1); c.lineTo(px + Math.cos(a - 1.57) * wid, py + Math.sin(a - 1.57) * wid); c.lineTo(px, py); }
    for (i = n; i >= 1; i--) { var k2 = i / n, a2 = ang + k2 * 0.9 * (ang > -1.57 ? 1 : -1) * 0.5, px2 = x + Math.cos(a2) * len * k2, py2 = y + Math.sin(a2) * len * k2 + k2 * k2 * len * 0.35, wid2 = w * Math.sin(k2 * 3.1); c.lineTo(px2 + Math.cos(a2 + 1.57) * wid2, py2 + Math.sin(a2 + 1.57) * wid2); }
    c.closePath(); c.fill();
  }
  function monstera(c, x, y, r, ang) { c.save(); c.translate(x, y); c.rotate(ang); c.beginPath(); c.moveTo(0, r * 0.9); c.bezierCurveTo(-r * 1.2, r * 0.5, -r * 1.1, -r * 0.9, 0, -r * 0.55); c.bezierCurveTo(r * 1.1, -r * 0.9, r * 1.2, r * 0.5, 0, r * 0.9); c.fill(); c.globalCompositeOperation = 'destination-out'; c.lineWidth = r * 0.09; c.lineCap = 'round'; for (var i = -2; i <= 2; i++) { if (!i) continue; c.beginPath(); c.moveTo(i * r * 0.18, r * 0.05); c.lineTo(i * r * 0.95, -r * 0.05 + Math.abs(i) * r * 0.12); c.stroke(); } c.restore(); }
  function crown(c, x, y, r, rnd) { for (var i = 0; i < 14; i++) { var a = rnd() * TAU, d = rnd() * r * 0.6; c.save(); c.translate(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7); c.rotate(rnd() * TAU); c.beginPath(); c.ellipse(0, 0, r * 0.45, r * 0.22, 0, 0, TAU); c.fill(); c.restore(); } c.beginPath(); c.ellipse(x, y, r * 0.75, r * 0.55, 0, 0, TAU); c.fill(); }
  function paintLayer(c, kind, SW, SH, seed) {
    var rnd = PG.mulberry(seed), i;
    if (kind === 'ridge') {
      var base = SH * 0.62, f = [2, 3, 7], p = [rnd() * 6, rnd() * 6, rnd() * 6];
      c.beginPath(); c.moveTo(0, SH); for (var x = 0; x <= SW; x += 4) { var y = base - (Math.sin(x / SW * TAU * f[0] + p[0]) * 0.5 + 0.5) * SH * 0.12 - Math.sin(x / SW * TAU * f[1] + p[1]) * SH * 0.04 - Math.abs(Math.sin(x / SW * TAU * f[2] + p[2])) * SH * 0.05; c.lineTo(x, y); } c.lineTo(SW, SH); c.closePath(); c.fill();
      return;
    }
    var far = kind === 'far', ground = SH * (far ? 0.8 : 0.97), n = Math.round(SW / (far ? 70 : 120));
    c.fillRect(0, ground, SW, SH - ground);
    // undulating ground line
    c.beginPath(); c.moveTo(0, SH); for (var gx = 0; gx <= SW; gx += 8) c.lineTo(gx, ground - (Math.sin(gx / SW * TAU * 4) * 0.5 + 0.5) * SH * 0.025); c.lineTo(SW, SH); c.fill();
    for (i = 0; i < n; i++) {
      var tx = i * SW / n + (rnd() - 0.5) * SW / n * 0.6, th = SH * (far ? 0.22 + rnd() * 0.18 : 0.42 + rnd() * 0.3), palm = rnd() < (far ? 0.45 : 0.35), lean = (rnd() - 0.5) * 0.25, tw = SH * (far ? 0.008 : 0.016) * (0.8 + rnd() * 0.5), cr = SH * (far ? 0.07 : 0.12) * (0.8 + rnd() * 0.5), rs = rnd() * 1000;
      wrapX(function (X) {
        var r2 = PG.mulberry(rs), topX = X + lean * th, topY = ground - th;
        c.lineWidth = tw; c.lineCap = 'round'; c.beginPath(); c.moveTo(X, ground + 4); c.quadraticCurveTo(X + lean * th * 0.2, ground - th * 0.5, topX, topY); c.stroke();
        c.beginPath(); c.moveTo(X - tw * 1.6, ground + 4); c.lineTo(X, ground - th * 0.12); c.lineTo(X + tw * 1.6, ground + 4); c.fill();
        if (palm) { for (var k = 0; k < 7; k++) { var a = -Math.PI + k / 6 * Math.PI + (r2() - 0.5) * 0.3; frond(c, topX, topY, cr * (1.1 + r2() * 0.4), a, cr * 0.16); } }
        else { crown(c, topX, topY, cr * 1.2, r2); crown(c, topX - cr * 0.8, topY + cr * 0.35, cr * 0.85, r2); crown(c, topX + cr * 0.85, topY + cr * 0.3, cr * 0.85, r2);
          if (!far && r2() < 0.7) { var vx = topX + (r2() - 0.5) * cr, vl = th * (0.25 + r2() * 0.35); c.lineWidth = 2; c.beginPath(); c.moveTo(vx, topY + cr * 0.3); c.quadraticCurveTo(vx + cr * 0.15, topY + vl * 0.5, vx - cr * 0.05, topY + vl); c.stroke(); for (var lv = 0.2; lv < 1; lv += 0.16) { c.beginPath(); c.ellipse(vx + Math.sin(lv * 7) * 4, topY + cr * 0.3 + vl * lv, 4, 2.5, lv * 3, 0, TAU); c.fill(); } } }
      }, tx, SW);
    }
    // ferns and monstera at the base of the mid layer
    if (!far) for (i = 0; i < n * 2; i++) { var fx = rnd() * SW, fr = SH * (0.03 + rnd() * 0.03), fa = (rnd() - 0.5) * 1.2; wrapX(function (X) { monstera(c, X, ground - fr * 0.6, fr, fa); }, fx, SW); }
  }
  function tintLayer(L, pal) {
    var col = pal[L.col], t = L.tintBuf || (L.tintBuf = cv(strips.SW, strips.SH)), out = L.tint && L.tint !== L.tintA && L.tint !== L.tintB ? L.tint : (L.tint === L.tintA ? (L.tintB || (L.tintB = cv(strips.SW, strips.SH + 12))) : (L.tintA || (L.tintA = cv(strips.SW, strips.SH + 12))));
    var c = t.getContext('2d'); c.clearRect(0, 0, t.width, t.height); c.globalCompositeOperation = 'source-over'; c.drawImage(L.mask, 0, 0); c.globalCompositeOperation = 'source-in'; c.fillStyle = rgb(col); c.fillRect(0, 0, t.width, t.height); c.globalCompositeOperation = 'source-over';
    var o = out.getContext('2d'); o.clearRect(0, 0, out.width, out.height); o.shadowColor = 'rgba(10,20,15,.35)'; o.shadowBlur = 10; o.shadowOffsetY = 6; o.drawImage(t, 0, 0); o.shadowColor = 'transparent';
    L.tint = out;
  }
  function drawLayers(c, w, h, pal, key) {
    if (strips.key !== key) { strips.key = key; strips.pending = LAYERS.slice(); if (!LAYERS[0].tint) LAYERS.forEach(function (L) { tintLayer(L, pal); }); strips.pending = LAYERS[0].tint && strips.pending.length === 3 && !strips.first ? (strips.first = true, []) : strips.pending; }
    if (strips.pending.length) tintLayer(strips.pending.shift(), pal); // spread re-tinting over frames
    LAYERS.forEach(function (L, li) {
      var img = L.tint; if (!img) return;
      var off = -((cam.x * L.par * scale) % strips.SW + strips.SW) % strips.SW, y = h * 0.5 - strips.SH * 0.5 - PG.clamp(cam.y * scale * L.par * 0.5, -h * 0.12, h * 0.12) + (li === 0 ? -h * 0.02 : 0);
      c.drawImage(img, off, y); c.drawImage(img, off + strips.SW, y); if (off + strips.SW * 2 < w) c.drawImage(img, off + strips.SW * 2, y);
      // atmospheric fog band after each layer
      var fg = c.createLinearGradient(0, y + strips.SH * 0.45, 0, y + strips.SH); fg.addColorStop(0, rgb(pal.fog, 0)); fg.addColorStop(1, rgb(pal.fog, 0.22 - li * 0.06)); c.fillStyle = fg; c.fillRect(0, y + strips.SH * 0.45, w, strips.SH * 0.55);
    });
  }
  function drawSky(c, w, h, pal, t) {
    var bands = 7; for (var b = 0; b < bands; b++) { var k = b / (bands - 1), col = mix(pal.top, pal.bot, k), y0 = h * 0.62 * b / bands; c.fillStyle = rgb(col); c.beginPath(); c.moveTo(0, b ? y0 + Math.sin(b * 2.1) * 6 : 0); for (var x = 0; x <= w + 40; x += 40) c.lineTo(x, (b ? y0 : 0) + Math.sin(x * 0.01 + b * 1.7) * (b ? 5 : 0)); c.lineTo(w, h); c.lineTo(0, h); c.closePath(); c.fill(); }
    if (pal.day < 0.4) { var sa = 1 - pal.day / 0.4; stars.forEach(function (s) { c.globalAlpha = sa * (0.5 + 0.5 * Math.sin(t * 2 + s.p)); c.fillStyle = rgb(pal.sun); c.save(); c.translate(s.x * w, s.y * h); c.rotate(s.p); c.beginPath(); for (var i = 0; i < 8; i++) { var r = i % 2 ? s.r * 0.4 : s.r * 1.6; c.lineTo(Math.cos(i * 0.785) * r, Math.sin(i * 0.785) * r); } c.fill(); c.restore(); }); c.globalAlpha = 1; }
    var sx = w * 0.74, sy = h * (0.2 + (1 - pal.day) * 0.08), sr = Math.min(w, h) * 0.075;
    c.save(); c.shadowColor = 'rgba(0,0,0,.18)'; c.shadowBlur = 10; c.shadowOffsetY = 4;
    [2.1, 1.55, 1].forEach(function (k, i) { c.fillStyle = rgb(mix(pal.sun, pal.bot, (2 - i) * 0.3), i === 2 ? 1 : 0.55); c.beginPath(); c.arc(sx, sy, sr * k, 0, TAU); c.fill(); });
    c.restore();
    if (pal.day < 0.3) { c.fillStyle = rgb(mix(pal.top, pal.bot, 0.4)); c.beginPath(); c.arc(sx + sr * 0.35, sy - sr * 0.2, sr * 0.85, 0, TAU); c.fill(); }
  }
  function drawNear(c, w, h, pal, t) { // foreground paper leaves framing top and bottom
    var col = pal.near; c.save(); c.shadowColor = 'rgba(0,0,0,.3)'; c.shadowBlur = 12; c.shadowOffsetY = 6; c.fillStyle = rgb(col);
    var span = w * 1.4, off = -((cam.x * 1.25 * scale) % span + span) % span;
    for (var k = 0; k < 2; k++) { var ox = off + k * span; [[0.05, 0.6, 1.0], [0.3, 0.45, -0.3], [0.55, 0.7, 0.4], [0.8, 0.5, -0.9]].forEach(function (L, i) { var x = ox + L[0] * span, r = h * 0.09 * L[1] * 1.8; monstera(c, x, h + r * 0.15, r, L[2] + Math.sin(t * 0.8 + i) * 0.05); }); }
    var off2 = -((cam.x * 1.15 * scale) % span + span) % span;
    for (k = 0; k < 2; k++) { var ox2 = off2 + k * span; [0.12, 0.47, 0.83].forEach(function (L, i) { var x = ox2 + L * span; for (var j = 0; j < 3; j++) frond(c, x + j * 14, -10, h * (0.12 + j * 0.03), 1.1 + j * 0.25 + Math.sin(t * 0.7 + i + j) * 0.04, h * 0.018); }); }
    c.restore();
  }

  /* ---------- objects ---------- */
  function w2s(x, y, w, h) { return { x: (x - cam.x) * scale + w * anchor, y: (y - cam.y) * scale + h * 0.5 }; }
  function shadowOn(c, a) { c.shadowColor = 'rgba(10,20,15,' + (a || 0.3) + ')'; c.shadowBlur = 6 * scale; c.shadowOffsetY = 3 * scale; }
  function drawBranch(c, hk, w, h, t, pal, i) {
    var p = w2s(hk.x, hk.y, w, h); if (p.x < -260 * scale || p.x > w + 260 * scale) return;
    var s = scale, side = hk.side || 1, len = 210 * s, bc = pal.branch, bob = Math.sin(t * 1.2 + hk.wob) * 1.5 * s + (hk.bounce || 0) * 5 * s;
    c.save(); c.translate(p.x, p.y + bob); shadowOn(c, 0.32);
    c.fillStyle = rgb(bc); c.beginPath(); c.moveTo(side * len, 30 * s); c.quadraticCurveTo(side * len * 0.5, -2 * s, side * 8 * s, -6 * s); c.quadraticCurveTo(-side * 6 * s, -2 * s, side * 4 * s, 6 * s); c.quadraticCurveTo(side * len * 0.55, 12 * s, side * len, 48 * s); c.closePath(); c.fill();
    c.shadowColor = 'transparent'; c.fillStyle = rgb(mix(bc, [255, 255, 255], 0.18)); c.beginPath(); c.moveTo(side * len, 32 * s); c.quadraticCurveTo(side * len * 0.5, 0, side * 8 * s, -4 * s); c.quadraticCurveTo(side * len * 0.5, 6 * s, side * len, 40 * s); c.closePath(); c.fill();
    // paper leaves along the branch
    shadowOn(c, 0.25); var lc = mix(pal.l2, [140, 210, 120], 0.25 * pal.day);
    for (var k = 0; k < 5; k++) { var kx = side * len * (0.18 + k * 0.17), ky = 6 * s + k * 3 * s; c.fillStyle = rgb(k % 2 ? lc : mix(lc, [255, 255, 255], 0.12)); c.save(); c.translate(kx, ky); c.rotate(-side * 0.8 + Math.sin(t * 1.4 + k + hk.wob) * 0.12 + (k % 2 ? 0.5 : -0.4)); c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(10 * s, -9 * s, 24 * s, 0); c.quadraticCurveTo(10 * s, 9 * s, 0, 0); c.fill(); c.restore(); }
    // hanging vine with a flower at the grab point
    var sway = Math.sin(t * 1.3 + hk.wob) * 4 * s, gy = R * ARM * s; c.strokeStyle = rgb(mix(lc, [20, 50, 30], 0.35)); c.lineWidth = 3 * s; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(sway, gy * 0.35, sway * 0.5, gy * 0.55); c.stroke();
    c.fillStyle = rgb(lc); for (var v = 0.15; v < 0.55; v += 0.13) { c.beginPath(); c.ellipse(sway * v * 1.6 + 4 * s, gy * v, 5 * s, 2.6 * s, 0.6, 0, TAU); c.fill(); }
    c.save(); c.translate(sway * 0.5, gy * 0.55); c.rotate(t * 0.3 + hk.wob); c.fillStyle = hk.flower; for (var pf = 0; pf < 5; pf++) { c.rotate(TAU / 5); c.beginPath(); c.ellipse(0, -6 * s, 4 * s, 6.5 * s, 0, 0, TAU); c.fill(); } c.shadowColor = 'transparent'; c.fillStyle = '#fff3b0'; c.beginPath(); c.arc(0, 0, 3 * s, 0, TAU); c.fill(); c.restore();
    c.shadowColor = 'transparent';
    var isNext = i === st.cur + 1 && st.state === 'play';
    if (isNext) { c.strokeStyle = rgb([255, 255, 255], 0.35 + 0.25 * Math.sin(t * 5)); c.lineWidth = 2.2 * s; c.setLineDash([6 * s, 7 * s]); c.lineDashOffset = -t * 18; c.beginPath(); c.arc(0, gy, grabR() * s, 0, TAU); c.stroke(); c.setLineDash([]); }
    if (pal.day < 0.45) { var gg = c.createRadialGradient(sway * 0.5, gy * 0.55, 0, sway * 0.5, gy * 0.55, 30 * s); gg.addColorStop(0, 'rgba(255,240,180,' + (0.45 - pal.day) + ')'); gg.addColorStop(1, 'rgba(255,240,180,0)'); c.fillStyle = gg; c.fillRect(-40 * s, 0, 80 * s, 80 * s); }
    c.restore();
  }
  function drawPreview(c, w, h, t) {
    if (st.state !== 'play' || st.flying) return;
    var P = predict(0.8 + lvl('aim') * 0.22 + (st.tut ? 0.6 : 0)); if (!P.pts.length) return;
    var okc = P.hit >= 0; c.save(); shadowOn(c, 0.25);
    for (var i = 2; i < P.pts.length; i += 2) { var q = w2s(P.pts[i].x, P.pts[i].y, w, h), fade = 1 - i / P.pts.length * 0.75; c.fillStyle = okc ? 'rgba(214,247,180,' + fade + ')' : 'rgba(255,255,255,' + 0.75 * fade + ')'; c.beginPath(); c.arc(q.x, q.y, (okc ? 3.6 : 2.8) * scale, 0, TAU); c.fill(); }
    c.restore();
    if (okc) { var g = hookGrab(st.hooks[P.hit]), gq = w2s(g.x, g.y, w, h); c.strokeStyle = 'rgba(214,247,180,' + (0.7 + 0.3 * Math.sin(t * 10)) + ')'; c.lineWidth = 3 * scale; c.beginPath(); c.arc(gq.x, gq.y, grabR() * scale, 0, TAU); c.stroke(); }
  }
  function drawLeaf(c, x, y, p, t, s) {
    c.save(); c.translate(x, y + Math.sin(t * 2.5 + p) * 3 * s); c.rotate(Math.sin(t * 1.7 + p) * 0.5 - 0.3); shadowOn(c, 0.3);
    c.fillStyle = '#f2b928'; c.beginPath(); c.moveTo(0, -12 * s); c.quadraticCurveTo(11 * s, -2 * s, 0, 12 * s); c.quadraticCurveTo(-11 * s, -2 * s, 0, -12 * s); c.fill();
    c.shadowColor = 'transparent'; c.fillStyle = '#ffe07a'; c.beginPath(); c.moveTo(0, -12 * s); c.quadraticCurveTo(-11 * s, -2 * s, 0, 12 * s); c.closePath(); c.fill();
    c.strokeStyle = '#c98f12'; c.lineWidth = 1.4 * s; c.beginPath(); c.moveTo(0, -10 * s); c.lineTo(0, 11 * s); c.stroke(); c.restore();
  }
  function drawBee(c, b, w, h, t) {
    if (!b.alive) return; var p = w2s(b.x, b.y, w, h), s = scale; c.save(); c.translate(p.x, p.y); c.scale(Math.cos(b.p) > 0 ? -1 : 1, 1); shadowOn(c, 0.3);
    var fl = Math.sin(t * 40 + b.p) * 0.35; c.fillStyle = 'rgba(255,255,255,.85)'; [-1, 1].forEach(function (d) { c.save(); c.rotate(d * (0.6 + fl)); c.beginPath(); c.ellipse(d * 4 * s, -8 * s, 5 * s, 8 * s, 0, 0, TAU); c.fill(); c.restore(); });
    c.fillStyle = '#ffc93c'; c.beginPath(); c.ellipse(0, 0, 11 * s, 8 * s, 0, 0, TAU); c.fill(); c.shadowColor = 'transparent';
    c.fillStyle = '#2b2b2b'; c.save(); c.beginPath(); c.ellipse(0, 0, 11 * s, 8 * s, 0, 0, TAU); c.clip(); c.fillRect(-3 * s, -9 * s, 3.5 * s, 18 * s); c.fillRect(3 * s, -9 * s, 3 * s, 18 * s); c.restore();
    c.beginPath(); c.moveTo(10 * s, 0); c.lineTo(15 * s, 1.5 * s); c.lineTo(10 * s, 3 * s); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(-6 * s, -2 * s, 2.2 * s, 0, TAU); c.fill(); c.fillStyle = '#2b2b2b'; c.beginPath(); c.arc(-6.6 * s, -2 * s, 1.1 * s, 0, TAU); c.fill(); c.restore();
  }

  /* ---------- sloth rig (paper puppet) ---------- */
  function twoBone(sx, sy, tx, ty, l1, l2, bend) {
    var dx = tx - sx, dy = ty - sy, d = Math.hypot(dx, dy), maxd = l1 + l2 - 0.5;
    if (d > maxd) { tx = sx + dx / d * maxd; ty = sy + dy / d * maxd; dx = tx - sx; dy = ty - sy; d = maxd; }
    var a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    return { ex: sx + dx * a / d + (-dy / d) * hh * bend, ey: sy + dy * a / d + (dx / d) * hh * bend, tx: tx, ty: ty };
  }
  function limb(c, pts, w, col) { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); pts.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.stroke(); }
  function drawSloth(c, t, hookLocal, hanging, mood) {
    var br = 1 + Math.sin(t * 2.1) * 0.02, fx = st.flying ? Math.sign(st.vel.x || 1) : 1;
    var body = '#9a7656', dark = '#6a4e36', belly = '#d9c09a', face = '#f2e2c4', claw = '#2b2018';
    c.shadowColor = 'rgba(10,20,15,.3)'; c.shadowBlur = 5; c.shadowOffsetY = 2.5;
    var lg = Math.sin(t * 2.4) * 3 + lag.lx * 0.6;
    [[-7, 1], [7, -1]].forEach(function (L, i) { var ph = i * 1.4, kx = L[0] + lg * 0.5 * L[1] + Math.sin(t * 2.2 + ph) * 2, ky = 30 + Math.cos(t * 2.0 + ph) * 1.5; limb(c, [[L[0], 12], [kx, ky]], 9.5, dark); limb(c, [[kx - 2, ky + 3], [kx - 3, ky + 8]], 2.4, claw); limb(c, [[kx + 1.5, ky + 3], [kx + 2, ky + 8.5]], 2.4, claw); });
    [[-9, -14], [9, -14]].forEach(function (S, i) {
      var tx, ty;
      if (hanging) { tx = hookLocal.x + (i ? 5 : -5); ty = hookLocal.y; }
      else { var wv = Math.sin(t * 6 + i * 2) * 8; tx = S[0] + fx * 22 + wv * 0.3 + (st.stretch > 0 ? fx * 18 : 0); ty = S[1] - 34 - (st.stretch > 0 ? 18 : 0) + wv * 0.4 + Math.min(10, st.vel.y * 0.05); }
      var ik = twoBone(S[0], S[1], tx, ty, 29, 29, i ? -1 : 1);
      limb(c, [[S[0], S[1]], [ik.ex, ik.ey], [ik.tx, ik.ty]], 10.5, i ? dark : body);
      var ang = Math.atan2(ik.ty - ik.ey, ik.tx - ik.ex); for (var k = -1; k <= 1; k++) limb(c, [[ik.tx, ik.ty], [ik.tx + Math.cos(ang + k * 0.6) * 7, ik.ty + Math.sin(ang + k * 0.6) * 7], [ik.tx + Math.cos(ang + k * 0.9 + 0.6) * 9, ik.ty + Math.sin(ang + k * 0.9 + 0.6) * 9]], 2.5, claw);
    });
    c.save(); c.scale(br, 1 / br);
    c.fillStyle = body; c.beginPath(); c.ellipse(0, 0, 17, 24, 0, 0, TAU); c.fill(); c.shadowColor = 'transparent';
    c.fillStyle = belly; c.beginPath(); c.ellipse(1.5, 5, 10, 15.5, 0, 0, TAU); c.fill();
    c.fillStyle = dark; for (var f = 0; f < 7; f++) { var fa = f * 0.9 + 0.3; c.beginPath(); c.ellipse(Math.cos(fa) * 14, Math.sin(fa) * 20, 2.6, 1.2, fa, 0, TAU); c.fill(); }
    c.restore();
    var hx2 = fx * 4 + PG.clamp(lag.hx, -6, 6), hy = -22 + PG.clamp(lag.hy, -5, 5);
    c.save(); c.translate(hx2, hy); c.rotate(PG.clamp(lag.hx * 0.04, -0.3, 0.3)); c.shadowColor = 'rgba(10,20,15,.3)'; c.shadowBlur = 5; c.shadowOffsetY = 2.5;
    c.fillStyle = body; c.beginPath(); c.arc(0, 0, 14.5, 0, TAU); c.fill(); c.shadowColor = 'transparent';
    c.fillStyle = face; c.beginPath(); c.ellipse(0, 2, 11.5, 10, 0, 0, TAU); c.fill();
    c.fillStyle = '#4a3624'; [-1, 1].forEach(function (s) { c.save(); c.translate(s * 5.6, 0); c.rotate(s * 0.55); c.beginPath(); c.ellipse(0, 0, 3.8, 6, 0, 0, TAU); c.fill(); c.restore(); });
    var bl = blink > 0 || mood === 'sleepy' ? 0.15 : 1, look = PG.clamp(st.vel.x * 0.012, -1.4, 1.4) * (st.flying ? 1 : 0.3);
    [-1, 1].forEach(function (s) { var ex = s * 5.4 + look + fx * 0.4; c.fillStyle = '#fff'; c.beginPath(); c.ellipse(ex, -0.3, 2.2, 2.5 * bl + 0.3, 0, 0, TAU); c.fill(); c.fillStyle = '#111'; c.beginPath(); c.ellipse(ex + look * 0.4, -0.3, 1.25, 1.6 * bl + 0.2, 0, 0, TAU); c.fill(); });
    c.fillStyle = '#2b1d12'; c.beginPath(); c.ellipse(fx * 0.5, 5, 2.6, 1.9, 0, 0, TAU); c.fill();
    c.strokeStyle = '#6b4a2f'; c.lineWidth = 1.5; c.lineCap = 'round'; c.beginPath(); c.arc(fx * 0.5, 6.2, st.flying ? 3.8 : 3, 0.15, 3.0); c.stroke();
    if (mood === 'scared') { c.fillStyle = '#2b1d12'; c.beginPath(); c.ellipse(fx * 0.5, 9, 2, 2.6, 0, 0, TAU); c.fill(); }
    c.fillStyle = 'rgba(240,140,130,.45)'; [-1, 1].forEach(function (s) { c.beginPath(); c.ellipse(s * 8.5, 6, 2.6, 1.6, 0, 0, TAU); c.fill(); });
    c.restore(); c.shadowColor = 'transparent';
  }

  /* ---------- theme: layered cut-paper UI ---------- */
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }
  function paperCard(c, x, y, w, h, col, back, tilt) {
    c.save(); c.translate(x + w / 2, y + h / 2); c.rotate(tilt || 0); c.translate(-w / 2, -h / 2);
    c.shadowColor = 'rgba(10,20,15,.35)'; c.shadowBlur = 8; c.shadowOffsetY = 4;
    c.fillStyle = back || DARK; U.rr(c, 4, 6, w, h, Math.min(14, h * 0.3)); c.fill(); c.shadowColor = 'transparent';
    c.fillStyle = col || CREAM; U.rr(c, 0, 0, w, h, Math.min(14, h * 0.3)); c.fill();
    c.restore();
  }
  PG.theme.font = 'Lilita One'; PG.theme.body = 'Varela Round'; PG.theme.weight = '400'; PG.theme.bodyWeight = '400';
  PG.theme.text = DARK; PG.theme.textShadow = false; PG.theme.pageColor = '#1f3d2f';
  PG.theme.transition = { style: 'iris', color: '#173b2c', time: 0.4 };
  PG.theme.popStyle = { stroke: 'rgba(31,61,47,.85)' };
  PG.theme.button = function (c, x, y, w, h, label, o, s) {
    var col = o.disabled ? '#b9b4a2' : o.color || '#ffd166', tilt = ((hash(label) % 7) / 7 - 0.5) * 0.035, off = s.press ? 3 : 0;
    paperCard(c, x, y + off, w, h, s.hover ? U.shade(col, 0.15) : col, o.back || DARK, tilt);
    var fs = U.fit(c, label, o.size || Math.min(h * 0.46, 28), w - 18);
    c.save(); c.translate(x + w / 2, y + h / 2 + off); c.rotate(tilt); U.text(c, label, 0, 1, fs, o.textColor || DARK, 'center', { shadow: false }); c.restore();
  };
  PG.theme.panel = function (c, x, y, w, h, o) { paperCard(c, x, y, w, h, CREAM, DARK, 0); c.strokeStyle = 'rgba(31,61,47,.18)'; c.setLineDash([6, 5]); c.lineWidth = 2; U.rr(c, x + 9, y + 9, w - 18, h - 18, 10); c.stroke(); c.setLineDash([]); };
  PG.theme.hudButton = function (c, x, y, r, kind) { c.save(); c.shadowColor = 'rgba(10,20,15,.35)'; c.shadowBlur = 6; c.shadowOffsetY = 3; c.fillStyle = DARK; c.beginPath(); c.arc(x + 2, y + 3, r, 0, TAU); c.fill(); c.shadowColor = 'transparent'; c.fillStyle = CREAM; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); PG.hudIcon(c, x, y, r * 0.95, kind, DARK); c.restore(); };
  PG.theme.loading = function (c, w, h, t) { c.fillStyle = '#1f3d2f'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffd166'; for (var i = 0; i < 3; i++) { c.save(); c.translate(w / 2 + (i - 1) * 26, h / 2 + Math.sin(t * 5 + i) * 6); c.rotate(t * 2 + i); c.beginPath(); c.moveTo(0, -9); c.quadraticCurveTo(8, 0, 0, 9); c.quadraticCurveTo(-8, 0, 0, -9); c.fill(); c.restore(); } };
  function leafIcon(c, x, y, r) { c.save(); c.translate(x, y); c.rotate(-0.4); c.fillStyle = '#f2b928'; c.beginPath(); c.moveTo(0, -r); c.quadraticCurveTo(r, 0, 0, r); c.quadraticCurveTo(-r, 0, 0, -r); c.fill(); c.fillStyle = '#ffe07a'; c.beginPath(); c.moveTo(0, -r); c.quadraticCurveTo(-r, 0, 0, r); c.closePath(); c.fill(); c.restore(); }
  function paperText(c, s, x, y, size, col, back, tilt) { c.save(); c.translate(x, y); c.rotate(tilt || 0); U.text(c, s, 2, 3, size, back || DARK, 'center', { shadow: false }); U.text(c, s, 0, 0, size, col, 'center', { shadow: false }); c.restore(); }

  /* ---------- screens ---------- */
  function drawHUD(c, w, h) {
    var sc = PG.scale();
    paperCard(c, 12 * sc, 12 * sc, 118 * sc, 44 * sc, CREAM, DARK, -0.02);
    U.text(c, PG.count('dist', st.dist) + ' m', 12 * sc + 59 * sc, 34 * sc, 26 * sc, DARK, 'center', { shadow: false });
    U.text(c, 'BEST ' + (PG.save.best || 0), 18 * sc, 70 * sc, 12 * sc, CREAM, 'left', { font: 'body', shadow: false, stroke: DARK, strokeWidth: 3 });
    leafIcon(c, 24 * sc, 92 * sc, 9 * sc); U.text(c, PG.fmt(st.coinsRun), 38 * sc, 93 * sc, 19 * sc, '#ffe07a', 'left', { stroke: DARK, strokeWidth: 4 * sc, shadow: false });
    if (st.rescues > 0) U.text(c, 'Vine x' + st.rescues, 16 * sc, 116 * sc, 13 * sc, '#c8f2a8', 'left', { font: 'body', stroke: DARK, strokeWidth: 3, shadow: false });
    if (st.streak > 1) paperText(c, 'Perfect x' + st.streak, w / 2, 72 * sc, 22 * sc, '#ffe07a', DARK, Math.sin(st.t * 3) * 0.04);
    if (st.tut && !st.flying) { var tw = Math.min(w * 0.86, 330 * sc); paperCard(c, w / 2 - tw / 2, h * 0.84, tw, 40 * sc, CREAM, DARK, 0.01); U.text(c, 'Tap to let go when the dots turn green', w / 2, h * 0.84 + 21 * sc, U.fit(c, 'Tap to let go when the dots turn green', 15 * sc, tw - 20, { font: 'body' }), DARK, 'center', { font: 'body', shadow: false }); }
    else if (!PG.save.runs && st.flying && !st.stretchUsed && st.runIdx === 1 && st.hooks.length < 4) { var tw2 = Math.min(w * 0.8, 290 * sc); paperCard(c, w / 2 - tw2 / 2, h * 0.84, tw2, 40 * sc, CREAM, DARK, -0.01); U.text(c, 'Tap again in the air to stretch', w / 2, h * 0.84 + 21 * sc, 15 * sc, DARK, 'center', { font: 'body', shadow: false }); }
  }
  function drawMenu(c, w, h, t) {
    var sc = PG.scale(), ty = Math.min(h * 0.13, 100 * sc), sz = Math.min(66 * sc, w * 0.17);
    var word = 'SLOTH', xx = -U.measure(c, word, sz) / 2;
    for (var i = 0; i < word.length; i++) { var cw = U.measure(c, word[i], sz); paperText(c, word[i], w / 2 + xx + cw / 2, ty + Math.sin(t * 1.5 + i) * 3, sz, CREAM, DARK, Math.sin(i * 1.7) * 0.08); xx += cw; }
    word = 'SPRINT'; xx = -U.measure(c, word, sz) / 2;
    for (i = 0; i < word.length; i++) { var cw2 = U.measure(c, word[i], sz); paperText(c, word[i], w / 2 + xx + cw2 / 2, ty + sz * 0.95 + Math.sin(t * 1.5 + i + 2) * 3, sz, '#ffd166', DARK, Math.cos(i * 1.3) * 0.08); xx += cw2; }
    var sw = Math.min(w * 0.8, 270 * sc); paperCard(c, w / 2 - sw / 2, ty + sz * 1.6, sw, 32 * sc, '#cfe8b5', DARK, -0.015); U.text(c, 'Very slow. Very determined.', w / 2, ty + sz * 1.6 + 17 * sc, 15 * sc, DARK, 'center', { font: 'body', shadow: false });
    var bw = Math.min(230 * sc, w * 0.7), bh = 58 * sc, y0 = h * 0.68;
    if (U.button(c, w / 2 - bw / 2, y0, bw, bh, 'Swing!', { color: '#ffd166' })) PG.go(startRun);
    if (U.button(c, w / 2 - bw / 2, y0 + bh + 14 * sc, bw, bh * 0.8, 'Upgrades', { color: '#9ad08a' })) { st.state = 'upgrades'; PG.track('shop_opened', { source: 'menu' }); }
    leafIcon(c, w / 2 - 34 * sc, y0 + bh * 2.42 + 6 * sc, 10 * sc); U.text(c, PG.fmt(PG.save.coins || 0), w / 2 - 18 * sc, y0 + bh * 2.42 + 7 * sc, 21 * sc, '#ffe07a', 'left', { stroke: DARK, strokeWidth: 4 * sc, shadow: false });
    U.text(c, PG.save.best ? 'Best ' + PG.save.best + ' m' : 'Music: emmntt   Sounds: Kenney', w / 2, h - 16 * sc, 12 * sc, CREAM, 'center', { font: 'body', shadow: false, stroke: DARK, strokeWidth: 3 });
  }
  function drawUpgrades(c, w, h) {
    var sc = PG.scale(); c.fillStyle = 'rgba(15,35,25,.55)'; c.fillRect(0, 0, w, h);
    var pw = Math.min(w * 0.94, 440 * sc), px = w / 2 - pw / 2, rowH = 66 * sc, ph = 74 * sc + UPS.length * rowH + 72 * sc, py = Math.max(16 * sc, (h - ph) / 2);
    U.panel(c, px, py, pw, ph);
    U.text(c, 'Upgrades', px + 22 * sc, py + 36 * sc, 30 * sc, DARK, 'left', { shadow: false }); leafIcon(c, px + pw - 92 * sc, py + 36 * sc, 10 * sc); U.text(c, PG.fmt(PG.save.coins || 0), px + pw - 76 * sc, py + 37 * sc, 20 * sc, '#b07d0e', 'left', { shadow: false });
    UPS.forEach(function (u, i) {
      var y = py + 64 * sc + i * rowH, L = PG.upLevel(u.id), cost = PG.upCost(u.base, u.grow, L), maxed = L >= u.max;
      U.text(c, u.n, px + 22 * sc, y + 17 * sc, 19 * sc, DARK, 'left', { shadow: false }); U.text(c, u.d, px + 22 * sc, y + 38 * sc, 12.5 * sc, '#4d6a58', 'left', { font: 'body', shadow: false });
      for (var k = 0; k < u.max; k++) { c.fillStyle = k < L ? '#6fae4f' : 'rgba(31,61,47,.18)'; c.save(); c.translate(px + 26 * sc + k * 12 * sc, y + 53 * sc); c.rotate(-0.5); c.beginPath(); c.moveTo(0, -5 * sc); c.quadraticCurveTo(4 * sc, 0, 0, 5 * sc); c.quadraticCurveTo(-4 * sc, 0, 0, -5 * sc); c.fill(); c.restore(); }
      var bw = 100 * sc, bh = 42 * sc, bx = px + pw - bw - 18 * sc;
      if (maxed) U.text(c, 'MAX', bx + bw / 2, y + 28 * sc, 20 * sc, '#5e8a3a', 'center', { shadow: false });
      else if (U.button(c, bx, y + 8 * sc, bw, bh, '' + cost, { color: (PG.save.coins || 0) >= cost ? '#ffd166' : '#cbc5b0', size: 20 * sc })) PG.buyUp(u.id, cost, u.max);
    });
    if (U.button(c, w / 2 - 85 * sc, py + ph - 60 * sc, 170 * sc, 46 * sc, 'Back', { color: '#9ad08a' })) st.state = 'menu';
  }
  function drawDead(c, w, h) {
    var sc = PG.scale(), k = PG.ease.out(Math.min(1, Math.max(0, st.deadT - 0.5) * 2)); if (k <= 0) return; c.fillStyle = 'rgba(15,35,25,' + 0.5 * k + ')'; c.fillRect(0, 0, w, h);
    var canAd = !st.doubled && st.coinsRun >= 1 && PG.rewardedSupported();
    var pw = Math.min(w * 0.88, 370 * sc), ph = (canAd ? 360 : 300) * sc, px = w / 2 - pw / 2, py = h * 0.5 - ph / 2 + (1 - k) * 80;
    U.panel(c, px, py, pw, ph);
    U.text(c, 'Oops, a slow fall', w / 2, py + 40 * sc, 25 * sc, DARK, 'center', { shadow: false });
    paperText(c, PG.count('ddist', st.deadT > 0.8 ? st.dist : 0) + ' m', w / 2, py + 92 * sc, 52 * sc, '#ffd166', DARK, -0.02);
    U.text(c, st.bestHit ? 'New best!' : 'Best ' + (PG.save.best || 0) + ' m', w / 2, py + 134 * sc, 16 * sc, st.bestHit ? '#5e8a3a' : '#4d6a58', 'center', { font: 'body', shadow: false });
    leafIcon(c, w / 2 - 50 * sc, py + 166 * sc, 11 * sc); U.text(c, '+' + (Math.round(st.coinsRun * 100) / 100) + (st.doubled ? ' (x2)' : ''), w / 2 - 34 * sc, py + 167 * sc, 23 * sc, '#b07d0e', 'left', { shadow: false });
    var bw = pw * 0.82, bh = 48 * sc, yy = py + 194 * sc;
    if (canAd) { if (U.button(c, w / 2 - bw / 2, yy, bw, bh, 'Ad: double leaves', { color: '#c7a6e6', size: 18 * sc })) { var earned = st.coinsRun; PG.rewarded('bonus').then(function (ok) { if (ok) { PG.save.coins = (PG.save.coins || 0) + earned; st.doubled = true; st.coinsRun += earned; PG.commit(true); PG.track('rewarded_double_coins', {}); } }); } yy += bh + 10 * sc; }
    if (U.button(c, w / 2 - bw / 2, yy, bw, bh, 'Swing again', { color: '#ffd166' })) { PG.interstitial('game_over').then(function () { PG.go(startRun); }); }
    if (U.button(c, w / 2 - bw / 2, yy + bh + 10 * sc, bw / 2 - 5 * sc, bh * 0.82, 'Upgrades', { color: '#9ad08a', size: 16 * sc })) PG.go(function () { st.state = 'upgrades'; st.hooks = []; PG.track('shop_opened', { source: 'game_over' }); });
    if (U.button(c, w / 2 + 5 * sc, yy + bh + 10 * sc, bw / 2 - 5 * sc, bh * 0.82, 'Menu', { color: CREAM, size: 16 * sc })) PG.go(function () { st.state = 'menu'; st.hooks = []; });
  }

  /* ---------- render ---------- */
  function render(c, w, h) {
    scale = PG.clamp(Math.min(h / 640, w / 400), 0.6, 2.4); anchor += (((st.state === 'menu' || st.state === 'upgrades') ? 0.5 : 0.3) - anchor) * 0.08;
    if (strips.w !== w || strips.h !== h) buildStrips(w, h);
    var cyc = cycle(), pal = palette(cyc), key = Math.round(cyc * 48) % 48, t = t0;
    c.save(); if (shake > 0.1) c.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    drawSky(c, w, h, pal, t);
    if (pal.day > 0.3) { c.save(); c.globalCompositeOperation = 'lighter'; for (var i = 0; i < 4; i++) { var x = ((i * 0.31 + 0.1 + t * 0.003) % 1.2 - 0.1) * w; c.fillStyle = rgb(pal.sun, 0.06 * pal.day); c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 50, 0); c.lineTo(x + h * 0.4 + 110, h); c.lineTo(x + h * 0.4 - 30, h); c.fill(); } c.restore(); }
    drawLayers(c, w, h, palette(key / 48), key);
    if (pal.day < 0.55) fireflies.forEach(function (f) { var a = (0.55 - pal.day) * 1.8, x = ((f.x + t * 0.006 * f.s) % 1) * w, y = (f.y * 0.8 + Math.sin(t * 0.6 * f.s + f.p) * 0.03) * h; c.fillStyle = 'rgba(230,255,160,' + a * (0.5 + 0.5 * Math.sin(t * 3 + f.p)) + ')'; c.beginPath(); c.arc(x, y, 2.4 * scale, 0, TAU); c.fill(); });
    else motes.forEach(function (f) { var x = ((f.x + t * 0.01 * f.s) % 1) * w, y = ((f.y + Math.sin(t * 0.5 + f.p) * 0.02) % 1) * h; c.fillStyle = 'rgba(255,250,210,' + 0.4 * pal.day * (0.5 + 0.5 * Math.sin(t * 2 + f.p)) + ')'; c.beginPath(); c.arc(x, y, 1.6 * scale, 0, TAU); c.fill(); });
    st.hooks.forEach(function (hk, i) { if (i >= Math.max(0, st.cur - 2) && i <= st.cur + 8) drawBranch(c, hk, w, h, t, pal, i); });
    st.leaves.forEach(function (l) { if (!l.taken) { var p = w2s(l.x, l.y, w, h); if (p.x > -30 && p.x < w + 30) drawLeaf(c, p.x, p.y, l.p, t, scale); } });
    st.bees.forEach(function (b) { drawBee(c, b, w, h, t); });
    drawPreview(c, w, h, t);
    var bp = w2s(st.body.x, st.body.y, w, h), hk = st.hooks[st.cur] || firstHook();
    var vx = st.flying ? st.vel.x : Math.cos(st.phase) * A * W * R * Math.cos(theta()); lag.hx += ((-vx * 0.03) - lag.hx) * 0.12; lag.hy += ((st.flying ? -st.vel.y * 0.02 : 0) - lag.hy) * 0.12; lag.lx += ((-vx * 0.05) - lag.lx) * 0.1;
    c.save(); c.translate(bp.x, bp.y); c.scale(scale * 1.2, scale * 1.2);
    var hanging = !st.flying && st.state !== 'dead' && st.state !== 'rescue', th = theta();
    c.rotate(hanging ? -th : st.rot);
    var dx = hk.x - st.body.x, dy = hk.y - st.body.y, loc = { x: (dx * Math.cos(th) - dy * Math.sin(th)) / 1.2, y: (dx * Math.sin(th) + dy * Math.cos(th)) / 1.2 };
    drawSloth(c, t, loc, hanging, st.state === 'dead' ? 'scared' : st.flying ? (st.vel.y > 120 ? 'scared' : 'happy') : (st.state === 'menu' ? 'sleepy' : 'happy'));
    c.restore();
    PG.drawParts(c); PG.drawPops(c);
    drawNear(c, w, h, pal, t);
    c.restore();
    PG.grain(c, w, h, 0.05, { mode: 'multiply' });
    if (st.state === 'play' || st.state === 'rescue') drawHUD(c, w, h);
    else if (st.state === 'menu') drawMenu(c, w, h, t);
    else if (st.state === 'upgrades') drawUpgrades(c, w, h);
    else if (st.state === 'dead') { drawHUD(c, w, h); drawDead(c, w, h); }
  }
  // parts/pops live in world space -> convert at draw time
  var _drawParts = PG.drawParts, _drawPops = PG.drawPops;
  PG.drawParts = function (c) { var w = PG.w, h = PG.h; c.save(); c.translate(w * anchor - cam.x * scale, h * 0.5 - cam.y * scale); c.scale(scale, scale); _drawParts(c); c.restore(); };
  PG.drawPops = function (c) { var w = PG.w, h = PG.h; c.save(); c.translate(w * anchor - cam.x * scale, h * 0.5 - cam.y * scale); c.scale(scale, scale); _drawPops(c); c.restore(); };

  PG.onDown = function () { tapAction(); };
  PG.setup(document.getElementById('c'), update, render);
  window.__sloth = { update: update, st: st, predict: predict, release: release, start: startRun, grabR: grabR, cam: cam };
  PG.init({ id: 'sloth_sprint', version: '1.1.0', defaults: { best: 0, coins: 0, runs: 0, up: {}, muted: false } }).then(function () {
    st.hooks = [firstHook()]; PG.music();
  });
})();
