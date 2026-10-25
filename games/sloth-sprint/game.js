/* SLOTH SPRINT - a very slow sloth swings through a glowing jungle. One button: let go at the right moment. */
(function () {
  'use strict';
  var U = PG.ui, TAU = 6.2832;
  var R = 70, A = 1.25, W = 2.7, G = 330, ARM = 0.94; // rope radius, swing amplitude, swing speed, gravity
  var UPS = [
    { id: 'grip', n: 'Sticky Claws', d: 'Bigger grab radius', max: 8, base: 40, grow: 1.5 },
    { id: 'aim', n: 'Dream Aim', d: 'Longer path preview', max: 6, base: 30, grow: 1.5 },
    { id: 'magnet', n: 'Leaf Magnet', d: 'Pull leaves closer', max: 6, base: 35, grow: 1.5 },
    { id: 'vine', n: 'Safety Vine', d: 'Rescues from a fall', max: 3, base: 120, grow: 2.2 },
    { id: 'value', n: 'Golden Leaves', d: '+25% coins per leaf', max: 8, base: 50, grow: 1.6 }
  ];
  var st = { state: 'menu', hooks: [], cur: 0, phase: 0, body: { x: 0, y: 0 }, vel: { x: 0, y: 0 }, flying: false, spin: 0, rot: 0, stretch: 0, stretchUsed: false,
    coinsRun: 0, rescues: 0, dist: 0, bestHit: false, perfects: 0, streak: 0, leaves: [], bees: [], t: 0, fallT: 0, msg: null, runIdx: 0, deadT: 0, tut: 0, pendingCoins: 0, rescueT: 0, doubled: false };
  var cam = { x: 0, y: 0 }, scale = 1, lag = { hx: 0, hy: 0, lx: 0, ly: 0, ax: 0 }, blink = 0, blinkT = 2, shake = 0, shownUps = false;
  var fireflies = [], motes = [];
  for (var i = 0; i < 26; i++) fireflies.push({ x: Math.random(), y: Math.random(), p: Math.random() * 9, s: 0.5 + Math.random() });
  for (i = 0; i < 24; i++) motes.push({ x: Math.random(), y: Math.random(), p: Math.random() * 9, s: 0.3 + Math.random() });
  var rnd = PG.mulberry(7);

  /* ---------- helpers ---------- */
  function lvl(id) { return PG.upLevel(id); }
  function grabR() { var base = Math.max(24, 44 - st.hooks.length * 0.12); return base + lvl('grip') * 3.2; }
  function hookGrab(h) { return { x: h.x, y: h.y + R * ARM }; }
  function theta() { return A * Math.sin(st.phase); }
  function bodyOnHook(h, th) { return { x: h.x + R * Math.sin(th), y: h.y + R * Math.cos(th) }; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rgb(c, a) { return (a === undefined ? 'rgb(' : 'rgba(') + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + (a === undefined ? ')' : ',' + a + ')'); }
  function rr(seed) { var x = Math.sin(seed * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  /* ---------- world generation (every hook is reachable by construction) ---------- */
  function simulate(x0, y0, vx, vy, T, step) {
    var pts = [], x = x0, y = y0; for (var t = 0; t <= T; t += step) { pts.push({ x: x, y: y, t: t }); vy += G * step; x += vx * step; y += vy * step; } return pts;
  }
  function genHook(prev, idx) {
    var minGap = Math.min(92 + idx * 2.2, 190), maxGap = Math.min(150 + idx * 3, 255);
    for (var tries = 0; tries < 40; tries++) {
      var th = PG.rand(0.15, 1.05), thd = A * W * Math.sqrt(Math.max(0.001, 1 - Math.pow(th / A, 2)));
      var b = bodyOnHook(prev, th), sp = R * thd, vx = sp * Math.cos(th), vy = -sp * Math.sin(th);
      var pts = simulate(b.x, b.y, vx, vy, 2.2, 1 / 60);
      var pick = pts[Math.floor(PG.rand(0.35, 0.8) * (pts.length - 1))];
      var gap = pick.x - prev.x; if (gap < minGap || gap > maxGap) continue;
      if (Math.abs(pick.y - R * ARM - prev.y) > 150) continue;
      return { x: pick.x + PG.rand(-6, 6), y: pick.y - R * ARM, th: th, pts: pts, tg: pick.t, wob: PG.rand(0, 6) };
    }
    return { x: prev.x + 120, y: prev.y, th: 0.5, pts: [], tg: 0, wob: 0 };
  }
  function extendWorld() {
    while (st.hooks[st.hooks.length - 1].x < st.body.x + 1800) {
      var prev = st.hooks[st.hooks.length - 1], idx = st.hooks.length, h = genHook(prev, idx);
      st.hooks.push(h);
      // leaves along the ideal arc to the new hook
      var val = 1 + 0.25 * lvl('value');
      if (h.pts.length > 4) for (var k = 1; k <= 3; k++) { var q = h.pts[Math.floor(h.pts.length * 0.0 + (h.tg / (1 / 60)) * k / 4)]; if (q && Math.random() < 0.85) st.leaves.push({ x: q.x, y: q.y, taken: false, v: val, p: Math.random() * 6 }); }
      if (idx > 6 && Math.random() < Math.min(0.55, 0.15 + idx * 0.012)) { // a bee guarding the gap, away from the ideal arc
        var mx = (prev.x + h.x) / 2, my = Math.min(prev.y, h.y) + (Math.random() < 0.5 ? 20 : R + 85);
        st.bees.push({ x: mx, y: my, bx: mx, by: my, p: Math.random() * 6, a: PG.rand(24, 46), alive: true });
      }
    }
  }
  function startRun() {
    st.state = 'play'; st.hooks = [{ x: 0, y: 0, th: 0, pts: [], tg: 0, wob: 0 }]; st.cur = 0; st.phase = 0.9; st.flying = false; st.leaves = []; st.bees = []; st.coinsRun = 0; st.dist = 0; st.perfects = 0; st.streak = 0;
    st.rescues = lvl('vine'); st.msg = null; st.doubled = false; st.runIdx++; st.deadT = 0; st.t = 0; st.fallT = 0; st.stretch = 0;
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
  function stretchNow() { if (st.flying && !st.stretchUsed) { st.stretchUsed = true; st.stretch = 0.34; PG.sfx('jump', 1.4); } }
  function tapAction() { if (st.state === 'play' && !PG.userPaused) { if (st.flying) stretchNow(); else release(); } }
  function grabHook(i, perfect) {
    var h = st.hooks[i]; st.cur = i; st.flying = false;
    var th = Math.atan2(st.body.x - h.x, st.body.y - h.y); th = PG.clamp(th, -A * 0.98, A * 0.98);
    var ph = Math.asin(th / A); st.phase = st.vel.x >= -5 ? ph : Math.PI - ph;
    st.dist = Math.max(st.dist, Math.floor(h.x / 10)); st.streak = perfect ? st.streak + 1 : 0;
    if (perfect) { st.perfects++; PG.save.coins += 1 * (1 + 0.25 * lvl('value')); st.coinsRun += 1; PG.popText(h.x, h.y + 20, 'PERFECT +1', '#ffd23f', 24); PG.sfx('perfect'); PG.burst(h.x, h.y + R * ARM, 22, { colors: ['#ffd23f', '#fff3b0', '#9be564'], g: 40, life: 1.2 }); }
    else { PG.sfx('land'); PG.burst(h.x, h.y + R * ARM, 8, { colors: ['#6fcf6f', '#b9f6ca'], g: 120 }); }
    PG.track('hook_grabbed', { index: Math.min(i, 200), perfect: perfect });
    PG.save.coins = Math.round(PG.save.coins * 100) / 100;
    if (st.dist > (PG.save.best || 0)) { PG.save.best = st.dist; st.bestHit = true; }
    extendWorld();
  }
  function die() {
    if (st.rescues > 0) { st.rescues--; st.state = 'rescue'; st.rescueT = 0; st.flying = false; PG.sfx('upgrade'); PG.popText(st.body.x, st.body.y - 30, 'Safety Vine!', '#9be564', 24); return; }
    st.state = 'dead'; st.deadT = 0; PG.playing = false; PG.sfx('lose'); PG.vibrate(60);
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

  /* ---------- update ---------- */
  function update(dt) {
    st.t += dt; blinkT -= dt; if (blinkT < 0) { blink = 0.14; blinkT = PG.rand(1.6, 4.2); } if (blink > 0) blink -= dt; shake = Math.max(0, shake - dt * 25);
    PG.updateParts(dt); PG.updatePops(dt);
    if (PG.keyHit(' ') || PG.keyHit('arrowup') || PG.keyHit('w') || PG.keyHit('enter')) { if (st.state === 'play') tapAction(); }
    if (st.state === 'menu' || st.state === 'upgrades') { // idle swing on the first hook
      if (!st.hooks.length) { st.hooks = [{ x: 0, y: 0, th: 0, pts: [], tg: 0, wob: 0 }]; st.cur = 0; }
      st.phase += W * dt * 0.8; st.body = bodyOnHook(st.hooks[0], theta()); st.rot = -theta(); st.flying = false; st.cur = 0;
      cam.x += (st.body.x - cam.x) * 0.1; cam.y += (st.body.y - 40 - cam.y) * 0.1; return;
    }
    if (st.state === 'dead') { st.deadT += dt; return; }
    if (st.state === 'rescue') {
      st.rescueT += dt; var h = st.hooks[st.cur], tgt = bodyOnHook(h, 0), k = PG.ease.io(Math.min(1, st.rescueT / 1.0));
      if (st.rescueT < 0.05) st.rescueFrom = { x: st.body.x, y: st.body.y }; st.body.x = PG.lerp(st.rescueFrom.x, tgt.x, k); st.body.y = PG.lerp(st.rescueFrom.y, tgt.y, k); st.rot += (-0.0 - st.rot) * 0.1;
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
      // collisions
      st.bees.forEach(function (b) { if (b.alive && Math.hypot(b.x - st.body.x, b.y - st.body.y) < 22) { b.alive = false; PG.burst(b.x, b.y, 12, { colors: ['#ffd23f', '#222'] }); shake = 8; PG.sfx('hit'); st.vel.y = 120; st.vel.x *= 0.3; st.fallT = 0.0001; die(); } });
      var ch = st.hooks[st.cur];
      if (st.state === 'play' && st.body.y > ch.y + R + 420) { PG.sfx('drop'); die(); }
    } else { // hanging
      st.phase += W * dt; st.body = bodyOnHook(st.hooks[st.cur], theta()); st.rot = -theta();
    }
    // leaves + magnet
    var mr = 26 + lvl('magnet') * 16;
    st.leaves.forEach(function (l) {
      if (l.taken) return; var dx = st.body.x - l.x, dy = st.body.y - l.y, d = Math.hypot(dx, dy);
      if (lvl('magnet') > 0 && d < mr && d > 1) { l.x += dx / d * 120 * dt; l.y += dy / d * 120 * dt; }
      if (d < 26) { l.taken = true; st.coinsRun += l.v; PG.save.coins += l.v; PG.save.coins = Math.round(PG.save.coins * 100) / 100; PG.sfx('coin', 1 + Math.min(st.streak, 8) * 0.04); PG.burst(l.x, l.y, 8, { colors: ['#ffd23f', '#b9f6ca'], g: 0, life: 0.6, min: 20, max: 90 }); PG.popText(l.x, l.y - 12, '+' + (l.v % 1 === 0 ? l.v : l.v.toFixed(2)), '#ffe066', 18); }
    });
    st.bees.forEach(function (b) { b.p += dt * 2; b.x = b.bx + Math.cos(b.p) * b.a; b.y = b.by + Math.sin(b.p * 1.3) * b.a * 0.6; });
    // cleanup behind
    while (st.leaves.length && st.leaves[0].x < cam.x - 600) st.leaves.shift();
    if (st.bees.length && st.bees[0].bx < cam.x - 600) st.bees.shift();
    camFollow(dt);
    if (st.flying && Math.random() < 0.6) PG.parts.push({ x: st.body.x, y: st.body.y, vx: PG.rand(-15, 15), vy: PG.rand(-15, 15), life: 0.7, t: 0, size: 3, color: 'rgba(255,240,170,.8)', g: -10, shape: 'c' });
  }
  function camFollow(dt) {
    var lead = st.flying ? PG.clamp(st.vel.x * 0.25, -30, 90) : 30;
    var tx = st.body.x + 70 + lead, ty = (st.hooks[st.cur].y + st.body.y) / 2 - 15 + (st.flying ? Math.max(0, st.vel.y) * 0.1 : 0);
    cam.x += (tx - cam.x) * Math.min(1, dt * 3.2); cam.y += (ty - cam.y) * Math.min(1, dt * 2.2);
  }

  /* ---------- sloth rig ---------- */
  function twoBone(sx, sy, tx, ty, l1, l2, bend) {
    var dx = tx - sx, dy = ty - sy, d = Math.hypot(dx, dy), maxd = l1 + l2 - 0.5;
    if (d > maxd) { tx = sx + dx / d * maxd; ty = sy + dy / d * maxd; dx = tx - sx; dy = ty - sy; d = maxd; }
    var a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), hh = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    var ex = sx + dx * a / d + (-dy / d) * hh * bend, ey = sy + dy * a / d + (dx / d) * hh * bend;
    return { ex: ex, ey: ey, tx: tx, ty: ty };
  }
  function fur(c, col, w) { c.strokeStyle = col; c.lineWidth = w; c.lineCap = 'round'; c.lineJoin = 'round'; }
  function drawSloth(c, t, hookLocal, hanging, mood) {
    // everything in local space: -y points to the hook / up
    var br = 1 + Math.sin(t * 2.1) * 0.02, fx = st.flying ? Math.sign(st.vel.x || 1) : 1;
    var body = '#8d6e4f', dark = '#5e4630', belly = '#b99a74', face = '#ecd9b6', claw = '#2d221a';
    // legs (dangling, lagging)
    var lg = Math.sin(t * 2.4) * 3 + lag.lx * 0.6;
    [[-7, 1], [7, -1]].forEach(function (L, i) {
      var ph = i * 1.4; var kx = L[0] + lg * 0.5 * L[1] + Math.sin(t * 2.2 + ph) * 2, ky = 30 + Math.cos(t * 2.0 + ph) * 1.5;
      fur(c, dark, 9); c.beginPath(); c.moveTo(L[0], 14); c.lineTo(kx, ky); c.stroke();
      fur(c, claw, 2.4); for (var k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(kx + k * 2.5, ky + 3); c.lineTo(kx + k * 3.5, ky + 8); c.stroke(); }
    });
    // arms
    var sh = [[-9, -14], [9, -14]];
    sh.forEach(function (S, i) {
      var tx, ty;
      if (hanging) { tx = hookLocal.x + (i ? 5 : -5); ty = hookLocal.y; }
      else { var wv = Math.sin(t * 6 + i * 2) * 8; tx = S[0] + fx * 22 + wv * 0.3 + (st.stretch > 0 ? fx * 18 : 0); ty = S[1] - 34 - (st.stretch > 0 ? 18 : 0) + wv * 0.4 + Math.min(10, st.vel.y * 0.05); }
      var ik = twoBone(S[0], S[1], tx, ty, 29, 29, i ? -1 : 1);
      fur(c, body, 10); c.beginPath(); c.moveTo(S[0], S[1]); c.lineTo(ik.ex, ik.ey); c.lineTo(ik.tx, ik.ty); c.stroke();
      fur(c, dark, 3.5); c.beginPath(); c.moveTo(ik.ex, ik.ey); c.lineTo(ik.tx, ik.ty); c.stroke();
      fur(c, claw, 2.6); var ang = Math.atan2(ik.ty - ik.ey, ik.tx - ik.ex);
      for (var k = -1; k <= 1; k++) { c.beginPath(); c.moveTo(ik.tx, ik.ty); c.quadraticCurveTo(ik.tx + Math.cos(ang + k * 0.6) * 8, ik.ty + Math.sin(ang + k * 0.6) * 8, ik.tx + Math.cos(ang + k * 0.9 + 0.5) * 9, ik.ty + Math.sin(ang + k * 0.9 + 0.5) * 9); c.stroke(); }
    });
    // torso
    c.save(); c.scale(br, 1 / br);
    c.fillStyle = body; c.beginPath(); c.ellipse(0, 0, 17, 24, 0, 0, TAU); c.fill();
    c.fillStyle = belly; c.beginPath(); c.ellipse(1, 4, 10, 16, 0, 0, TAU); c.fill();
    fur(c, 'rgba(60,40,25,.35)', 1.4); for (var f = 0; f < 9; f++) { var fa = f * 0.7 + 0.3, fxx = Math.cos(fa) * 13, fyy = Math.sin(fa) * 19; c.beginPath(); c.moveTo(fxx, fyy); c.lineTo(fxx * 1.12 + 2, fyy * 1.1 + 3); c.stroke(); }
    c.restore();
    // head with lag (secondary motion)
    var hx = fx * 4 + PG.clamp(lag.hx, -6, 6), hy = -22 + PG.clamp(lag.hy, -5, 5);
    c.save(); c.translate(hx, hy); c.rotate(PG.clamp(lag.hx * 0.04, -0.3, 0.3));
    c.fillStyle = body; c.beginPath(); c.arc(0, 0, 14, 0, TAU); c.fill();
    c.fillStyle = face; c.beginPath(); c.ellipse(0, 2, 11.5, 10, 0, 0, TAU); c.fill();
    c.fillStyle = '#4a3624'; // eye masks
    [-1, 1].forEach(function (s) { c.save(); c.translate(s * 5.6, 0); c.rotate(s * 0.55); c.beginPath(); c.ellipse(0, 0, 3.6, 5.8, 0, 0, TAU); c.fill(); c.restore(); });
    var bl = blink > 0 || mood === 'sleepy' ? 0.15 : 1, look = PG.clamp(st.vel.x * 0.012, -1.4, 1.4) * (st.flying ? 1 : 0.3);
    [-1, 1].forEach(function (s) { var ex = s * 5.4 + look + fx * 0.4; c.fillStyle = '#fff'; c.beginPath(); c.ellipse(ex, -0.3, 2.1, 2.4 * bl + 0.3, 0, 0, TAU); c.fill(); c.fillStyle = '#111'; c.beginPath(); c.ellipse(ex + look * 0.4, -0.3, 1.2, 1.5 * bl + 0.2, 0, 0, TAU); c.fill(); });
    c.fillStyle = '#2b1d12'; c.beginPath(); c.ellipse(fx * 0.5, 5, 2.5, 1.9, 0, 0, TAU); c.fill();
    c.strokeStyle = '#6b4a2f'; c.lineWidth = 1.4; c.lineCap = 'round'; c.beginPath(); c.arc(fx * 0.5, 6.2, st.flying ? 3.8 : 3, 0.15, 3.0); c.stroke();
    if (mood === 'scared') { c.fillStyle = '#2b1d12'; c.beginPath(); c.ellipse(fx * 0.5, 9, 2, 2.6, 0, 0, TAU); c.fill(); }
    c.restore();
  }

  /* ---------- world rendering ---------- */
  function palette(t) { // t: 0..1 cycle. day -> sunset -> night -> dawn
    var P = [
      { top: [96, 186, 220], bot: [255, 236, 170], fog: [255, 240, 200], leaf: [58, 128, 76], sun: [255, 240, 190], day: 1 },
      { top: [250, 120, 96], bot: [255, 196, 120], fog: [255, 170, 130], leaf: [96, 90, 80], sun: [255, 150, 90], day: 0.6 },
      { top: [12, 16, 48], bot: [58, 70, 130], fog: [60, 70, 140], leaf: [20, 40, 62], sun: [200, 210, 255], day: 0 },
      { top: [220, 140, 190], bot: [255, 214, 180], fog: [255, 200, 200], leaf: [70, 110, 90], sun: [255, 200, 170], day: 0.5 }
    ];
    var p = t * 4, i = Math.floor(p) % 4, j = (i + 1) % 4, k = p - Math.floor(p); k = k * k * (3 - 2 * k);
    var a = P[i], b = P[j];
    return { top: mix(a.top, b.top, k), bot: mix(a.bot, b.bot, k), fog: mix(a.fog, b.fog, k), leaf: mix(a.leaf, b.leaf, k), sun: mix(a.sun, b.sun, k), day: PG.lerp(a.day, b.day, k) };
  }
  function drawBackdrop(c, w, h, t, pal) {
    var g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, rgb(pal.top)); g.addColorStop(0.75, rgb(pal.bot)); g.addColorStop(1, rgb(mix(pal.bot, pal.leaf, 0.3))); c.fillStyle = g; c.fillRect(0, 0, w, h);
    if (pal.day < 0.35) { var sa = 1 - pal.day / 0.35; c.fillStyle = '#fff'; for (var i = 0; i < 50; i++) { c.globalAlpha = sa * (0.4 + 0.6 * Math.sin(t * 2 + i)); c.beginPath(); c.arc(rr(i) * w, rr(i + 9) * h * 0.5, rr(i + 3) * 1.4 + 0.3, 0, TAU); c.fill(); } c.globalAlpha = 1; }
    // sun
    var sx = w * 0.72, sy = h * (0.26 + (1 - pal.day) * 0.28), sr = Math.min(w, h) * 0.07;
    var gl = c.createRadialGradient(sx, sy, 0, sx, sy, sr * 6); gl.addColorStop(0, rgb(pal.sun, 0.8)); gl.addColorStop(0.2, rgb(pal.sun, 0.35)); gl.addColorStop(1, rgb(pal.sun, 0)); c.fillStyle = gl; c.fillRect(sx - sr * 6, sy - sr * 6, sr * 12, sr * 12);
    c.fillStyle = rgb(pal.sun); c.beginPath(); c.arc(sx, sy, sr, 0, TAU); c.fill();
    // distant mountains
    for (var L = 0; L < 2; L++) {
      var col = mix(pal.leaf, pal.fog, 0.72 - L * 0.12); c.fillStyle = rgb(col); c.beginPath(); c.moveTo(0, h);
      var par = 0.04 + L * 0.05;
      for (var x = 0; x <= w + 12; x += 12) { var wx = x / scale + cam.x * par; c.lineTo(x, h * (0.56 - L * 0.04) - cam.y * scale * par * 0.5 - (Math.sin(wx * 0.011 + L * 4) * 0.5 + Math.sin(wx * 0.027 + L) * 0.3 + 0.6) * h * 0.13); }
      c.lineTo(w, h); c.closePath(); c.fill();
    }
  }
  function treeLayer(c, w, h, par, frac, spacing, hgt, col, fogK, pal, sway) {
    var left = cam.x * par - 80, i0 = Math.floor(left / spacing), i1 = Math.ceil((left + w / scale + 160) / spacing);
    var baseY = h * frac - cam.y * scale * par * 0.55, cc = mix(col, pal.fog, fogK);
    for (var i = i0; i <= i1; i++) {
      var sx = (i * spacing + (rr(i * par + 1) - 0.5) * spacing * 0.7 - cam.x * par) * scale, th = hgt * (0.7 + rr(i + par * 9) * 0.6) * scale, tw = (7 + rr(i + 4) * 8) * scale * (0.6 + par);
      c.fillStyle = rgb(mix(cc, [10, 20, 20], 0.15)); c.beginPath(); c.moveTo(sx - tw, baseY + h * 0.5); c.lineTo(sx - tw * 0.6, baseY - th); c.lineTo(sx + tw * 0.6, baseY - th); c.lineTo(sx + tw, baseY + h * 0.5); c.fill();
      c.fillStyle = rgb(cc);
      var nb = 5; for (var b = 0; b < nb; b++) { var a = rr(i * 13 + b) * TAU, rad = (22 + rr(i + b * 3) * 22) * scale * (0.6 + par), cx0 = sx + Math.cos(a) * rad * 1.1 + Math.sin(t0 * 0.5 + i + b) * sway * scale, cy0 = baseY - th + Math.sin(a) * rad * 0.45 - rad * 0.2; c.beginPath(); c.arc(cx0, cy0, rad, 0, TAU); c.fill(); }
      // hanging vine
      if (rr(i + 99) < 0.6) { c.strokeStyle = rgb(mix(cc, pal.fog, 0.1)); c.lineWidth = 2 * scale; var vx = sx + (rr(i + 5) - 0.5) * 30 * scale, vl = (40 + rr(i + 7) * 90) * scale; c.beginPath(); c.moveTo(vx, baseY - th + 10 * scale); c.quadraticCurveTo(vx + Math.sin(t0 + i) * 6 * scale, baseY - th + vl * 0.5, vx + Math.sin(t0 + i) * 3 * scale, baseY - th + vl); c.stroke(); }
    }
    if (fogK > 0) { var fg = c.createLinearGradient(0, baseY - 200 * scale, 0, baseY + 40 * scale); fg.addColorStop(0, rgb(pal.fog, 0)); fg.addColorStop(1, rgb(pal.fog, 0.3 * fogK)); c.fillStyle = fg; c.fillRect(0, baseY - 200 * scale, w, 300 * scale); }
  }
  var t0 = 0;
  function drawShafts(c, w, h, t, pal) {
    if (pal.day < 0.3) return; c.save(); c.globalCompositeOperation = 'lighter';
    for (var i = 0; i < 5; i++) { var x = ((i * 0.27 + 0.1 + t * 0.003) % 1.2 - 0.1) * w, sw = Math.sin(t * 0.3 + i) * 20; var g = c.createLinearGradient(x, 0, x + h * 0.4, h); g.addColorStop(0, rgb(pal.sun, 0.18 * pal.day)); g.addColorStop(1, rgb(pal.sun, 0)); c.fillStyle = g; c.beginPath(); c.moveTo(x + sw, 0); c.lineTo(x + 50 + sw, 0); c.lineTo(x + h * 0.4 + 120, h); c.lineTo(x + h * 0.4 - 40, h); c.fill(); }
    c.restore();
  }
  var anchor = 0.3;
  function w2s(x, y, w, h) { return { x: (x - cam.x) * scale + w * anchor, y: (y - cam.y) * scale + h * 0.5 }; }
  function drawBranch(c, hk, w, h, t, pal, i) {
    var p = w2s(hk.x, hk.y, w, h); if (p.x < -200 * scale || p.x > w + 200 * scale) return;
    var s = scale, dirL = i % 2 === 0 ? -1 : 1, len = 190 * s; // branch sticks out of a trunk to one side
    var bc = mix([100, 70, 44], pal.fog, 0.1 + (1 - pal.day) * 0.0), dk = mix(bc, [20, 14, 10], 0.35);
    c.save(); c.translate(p.x, p.y);
    c.strokeStyle = rgb(dk); c.lineWidth = 17 * s; c.lineCap = 'round'; c.beginPath(); c.moveTo(dirL * len, 26 * s); c.quadraticCurveTo(dirL * len * 0.5, -6 * s, 0, 0); c.stroke();
    c.strokeStyle = rgb(bc); c.lineWidth = 13 * s; c.beginPath(); c.moveTo(dirL * len, 26 * s); c.quadraticCurveTo(dirL * len * 0.5, -6 * s, 0, 0); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.18)'; c.lineWidth = 3 * s; c.beginPath(); c.moveTo(dirL * len, 22 * s); c.quadraticCurveTo(dirL * len * 0.5, -10 * s, 0, -4 * s); c.stroke();
    // moss + leaves clusters
    var lc = mix(pal.leaf, [120, 200, 120], 0.35 * pal.day);
    for (var k = 0; k < 6; k++) { var kx = dirL * (len * (0.15 + k * 0.14)), ky = 8 * s - Math.sin(k * 0.9) * 6 * s + Math.sin(t * 1.5 + k + hk.wob) * 1.5 * s; c.fillStyle = rgb(lc); c.beginPath(); c.ellipse(kx, ky - 6 * s, 11 * s, 7 * s, Math.sin(t + k) * 0.2, 0, TAU); c.fill(); c.fillStyle = rgb(mix(lc, [255, 255, 255], 0.2)); c.beginPath(); c.ellipse(kx - 3 * s, ky - 9 * s, 5 * s, 3 * s, 0, 0, TAU); c.fill(); }
    // hanging vine loop
    c.strokeStyle = rgb(mix(lc, [20, 60, 30], 0.3)); c.lineWidth = 3 * s; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(Math.sin(t * 1.2 + hk.wob) * 5 * s, 20 * s, 0, 34 * s); c.stroke();
    // glowing hook ring hint
    var cur = (i === st.cur + 1) && st.state === 'play'; var gp = { x: 0, y: R * ARM * s };
    if (cur) { var pr = (st.flying ? 0 : 1); c.strokeStyle = 'rgba(255,255,255,' + (0.25 + 0.2 * Math.sin(t * 5)) + ')'; c.lineWidth = 2 * s; c.setLineDash([5 * s, 6 * s]); c.beginPath(); c.arc(gp.x, gp.y, grabR() * s, 0, TAU); c.stroke(); c.setLineDash([]); }
    if (pal.day < 0.45) { var gg = c.createRadialGradient(0, 30 * s, 0, 0, 30 * s, 36 * s); gg.addColorStop(0, 'rgba(160,255,200,.45)'); gg.addColorStop(1, 'rgba(160,255,200,0)'); c.fillStyle = gg; c.fillRect(-40 * s, -10 * s, 80 * s, 80 * s); }
    c.restore();
  }
  function drawPreview(c, w, h, t) {
    if (st.state !== 'play' || st.flying) return;
    var P = predict(0.8 + lvl('aim') * 0.22 + (st.tut ? 0.6 : 0)); if (!P.pts.length) return;
    var okc = P.hit >= 0;
    for (var i = 1; i < P.pts.length; i += 1) {
      var q = w2s(P.pts[i].x, P.pts[i].y, w, h), fade = 1 - i / P.pts.length * 0.8;
      c.fillStyle = okc ? 'rgba(180,255,150,' + 0.9 * fade + ')' : 'rgba(255,255,255,' + 0.6 * fade + ')'; c.beginPath(); c.arc(q.x, q.y, (okc ? 3.2 : 2.4) * scale, 0, TAU); c.fill();
    }
    if (okc) { var g = hookGrab(st.hooks[P.hit]), gq = w2s(g.x, g.y, w, h); c.strokeStyle = 'rgba(180,255,150,' + (0.7 + 0.3 * Math.sin(t * 10)) + ')'; c.lineWidth = 3 * scale; c.beginPath(); c.arc(gq.x, gq.y, grabR() * scale, 0, TAU); c.stroke(); }
  }
  function drawLeaf(c, x, y, p, t, s) {
    c.save(); c.translate(x, y + Math.sin(t * 2.5 + p) * 3 * s); c.rotate(Math.sin(t * 1.7 + p) * 0.5); var gl = c.createRadialGradient(0, 0, 0, 0, 0, 20 * s); gl.addColorStop(0, 'rgba(255,230,120,.5)'); gl.addColorStop(1, 'rgba(255,230,120,0)'); c.fillStyle = gl; c.fillRect(-20 * s, -20 * s, 40 * s, 40 * s);
    c.fillStyle = '#ffd23f'; c.beginPath(); c.moveTo(0, -11 * s); c.quadraticCurveTo(10 * s, -2 * s, 0, 11 * s); c.quadraticCurveTo(-10 * s, -2 * s, 0, -11 * s); c.fill();
    c.strokeStyle = '#e8a800'; c.lineWidth = 1.5 * s; c.beginPath(); c.moveTo(0, -9 * s); c.lineTo(0, 10 * s); c.stroke(); c.restore();
  }
  function drawBee(c, b, w, h, t) {
    if (!b.alive) return; var p = w2s(b.x, b.y, w, h), s = scale; c.save(); c.translate(p.x, p.y);
    c.fillStyle = 'rgba(255,255,255,.7)'; var fl = Math.sin(t * 40 + b.p) * 0.4; [-1, 1].forEach(function (d) { c.save(); c.rotate(d * (0.7 + fl)); c.beginPath(); c.ellipse(d * 5 * s, -6 * s, 6 * s, 3 * s, 0, 0, TAU); c.fill(); c.restore(); });
    c.fillStyle = '#ffc400'; c.beginPath(); c.ellipse(0, 0, 9 * s, 7 * s, 0, 0, TAU); c.fill(); c.fillStyle = '#222'; c.fillRect(-2 * s, -7 * s, 3 * s, 14 * s); c.fillRect(3 * s, -6 * s, 2.5 * s, 12 * s);
    c.fillStyle = '#fff'; c.beginPath(); c.arc(-5 * s, -1 * s, 1.6 * s, 0, TAU); c.fill(); c.fillStyle = '#c0392b'; c.beginPath(); c.moveTo(-8 * s, 4 * s); c.lineTo(-11 * s, 6 * s); c.lineTo(-7 * s, 6 * s); c.fill(); c.restore();
  }

  /* ---------- UI ---------- */
  function hit(x, y, w, h) { var I = PG.input; if (I.released && PG.inRect(x, y, w, h) && PG.inRect(x, y, w, h, I.px, I.py)) { I.released = false; PG.sfx('tap'); return true; } return false; }
  function drawHUD(c, w, h) {
    var sc = PG.scale();
    U.text(c, st.dist + ' m', 16 * sc, 32 * sc, 40 * sc, '#fff', 'left', { stroke: 'rgba(30,50,30,.5)' });
    U.text(c, 'BEST ' + (PG.save.best || 0) + ' m', 16 * sc, 62 * sc, 14 * sc, '#fffbe0', 'left');
    U.coin(c, 24 * sc, 90 * sc, 10 * sc); U.text(c, PG.fmt(st.coinsRun), 40 * sc, 91 * sc, 20 * sc, '#ffe066', 'left', { stroke: 'rgba(0,0,0,.35)' });
    if (st.rescues > 0) U.text(c, 'Vine x' + st.rescues, 16 * sc, 116 * sc, 14 * sc, '#b9f6ca', 'left');
    if (st.streak > 1) U.text(c, 'Streak x' + st.streak, w / 2, 70 * sc, 22 * sc, '#ffd23f', 'center', { stroke: 'rgba(0,0,0,.4)' });
    if (st.tut && !st.flying) { c.globalAlpha = 0.7 + 0.3 * Math.sin(st.t * 4); U.text(c, 'TAP to let go when the dots hit the ring', w / 2, h * 0.82, 18 * sc, '#fff', 'center', { stroke: 'rgba(0,0,0,.5)' }); c.globalAlpha = 1; }
    else if (!PG.save.runs && st.flying && !st.stretchUsed && st.runIdx === 1 && st.hooks.length < 3) U.text(c, 'TAP again in the air to stretch', w / 2, h * 0.82, 18 * sc, '#fff', 'center', { stroke: 'rgba(0,0,0,.5)' });
  }
  function drawMenu(c, w, h, t) {
    var sc = PG.scale(); c.fillStyle = 'rgba(10,30,20,.25)'; c.fillRect(0, 0, w, h);
    U.text(c, 'SLOTH', w / 2, h * 0.14, Math.min(64 * sc, w * 0.17), '#fff', 'center', { stroke: '#2f6b3a' });
    U.text(c, 'SPRINT', w / 2, h * 0.14 + 54 * sc, Math.min(64 * sc, w * 0.17), '#ffd23f', 'center', { stroke: '#8a5a00' });
    U.text(c, 'Very slow. Very determined.', w / 2, h * 0.14 + 100 * sc, 16 * sc, '#fff', 'center');
    var bw = 220 * sc, bh = 60 * sc, y0 = h * 0.64;
    if (U.button(c, w / 2 - bw / 2, y0, bw, bh, 'Swing!', { color: '#2ec4b6' })) startRun();
    if (U.button(c, w / 2 - bw / 2, y0 + bh + 14 * sc, bw, bh * 0.82, 'Upgrades', { color: '#ff9f1c' })) { st.state = 'upgrades'; PG.track('shop_opened', { source: 'menu' }); }
    U.coin(c, w / 2 - 36 * sc, y0 + bh * 2.5, 11 * sc); U.text(c, PG.fmt(PG.save.coins), w / 2 - 20 * sc, y0 + bh * 2.5 + 1, 20 * sc, '#ffe066', 'left');
    if (PG.save.best) U.text(c, 'Best ' + PG.save.best + ' m', w / 2, y0 + bh * 2.5 + 30 * sc, 15 * sc, '#fff', 'center');
  }
  function drawUpgrades(c, w, h, t) {
    var sc = PG.scale(); c.fillStyle = 'rgba(8,20,16,.7)'; c.fillRect(0, 0, w, h);
    var pw = Math.min(w * 0.94, 440 * sc), px = w / 2 - pw / 2, py = 24 * sc, rowH = 66 * sc, ph = 70 * sc + UPS.length * rowH + 76 * sc;
    U.panel(c, px, py, pw, ph);
    U.text(c, 'Upgrades', w / 2, py + 34 * sc, 30 * sc, '#ffd23f', 'center'); U.coin(c, px + pw - 80 * sc, py + 34 * sc, 11 * sc); U.text(c, PG.fmt(PG.save.coins), px + pw - 64 * sc, py + 35 * sc, 20 * sc, '#ffe066', 'left');
    UPS.forEach(function (u, i) {
      var y = py + 62 * sc + i * rowH, L = PG.upLevel(u.id), cost = PG.upCost(u.base, u.grow, L), maxed = L >= u.max;
      U.text(c, u.n, px + 18 * sc, y + 18 * sc, 18 * sc, '#fff', 'left'); U.text(c, u.d, px + 18 * sc, y + 38 * sc, 13 * sc, '#cbd5e1', 'left', { shadow: false });
      for (var k = 0; k < u.max; k++) { c.fillStyle = k < L ? '#9be564' : 'rgba(255,255,255,.2)'; c.beginPath(); c.arc(px + 22 * sc + k * 11 * sc, y + 54 * sc, 4 * sc, 0, TAU); c.fill(); }
      var bw = 104 * sc, bh = 44 * sc, bx = px + pw - bw - 14 * sc;
      if (maxed) U.text(c, 'MAX', bx + bw / 2, y + 28 * sc, 18 * sc, '#9be564', 'center');
      else if (U.button(c, bx, y + 8 * sc, bw, bh, cost + '', { color: PG.save.coins >= cost ? '#2ec4b6' : '#8a8f98', size: 20 * sc })) { PG.buyUp(u.id, cost, u.max); }
    });
    if (U.button(c, w / 2 - 90 * sc, py + ph - 62 * sc, 180 * sc, 48 * sc, 'Back', { color: '#ff9f1c' })) st.state = 'menu';
  }
  function drawDead(c, w, h, t) {
    var sc = PG.scale(), k = PG.ease.out(Math.min(1, st.deadT * 2)); c.fillStyle = 'rgba(8,20,16,' + 0.55 * k + ')'; c.fillRect(0, 0, w, h);
    var pw = Math.min(w * 0.88, 380 * sc), ph = 360 * sc, px = w / 2 - pw / 2, py = h * 0.5 - ph / 2 + (1 - k) * 60;
    U.panel(c, px, py, pw, ph);
    U.text(c, 'Oh no... slow fall', w / 2, py + 36 * sc, 26 * sc, '#ffd23f', 'center');
    U.text(c, st.dist + ' m', w / 2, py + 90 * sc, 54 * sc, '#fff', 'center');
    U.text(c, st.bestHit && st.dist >= (PG.save.best || 0) ? 'NEW BEST!' : 'Best ' + (PG.save.best || 0) + ' m', w / 2, py + 130 * sc, 18 * sc, st.bestHit ? '#9be564' : '#cbd5e1', 'center');
    U.coin(c, w / 2 - 50 * sc, py + 164 * sc, 12 * sc); U.text(c, '+' + (Math.round(st.coinsRun * 100) / 100) + (st.doubled ? ' (x2)' : ''), w / 2 - 32 * sc, py + 165 * sc, 24 * sc, '#ffe066', 'left');
    var bw = pw * 0.84, bh = 50 * sc, yy = py + 192 * sc;
    if (!st.doubled && st.coinsRun >= 1 && PG.rewardedSupported()) { if (U.button(c, w / 2 - bw / 2, yy, bw, bh, 'Watch ad: double coins', { color: '#8338ec', size: 17 * sc })) { var earned = st.coinsRun; PG.rewarded('bonus').then(function (ok) { if (ok) { PG.save.coins += earned; st.doubled = true; st.coinsRun += earned; PG.commit(true); PG.track('rewarded_double_coins', {}); } }); } yy += bh + 10 * sc; }
    if (U.button(c, w / 2 - bw / 2, yy, bw, bh, 'Swing again', { color: '#2ec4b6' })) { PG.interstitial('game_over').then(function () { st.bestHit = false; startRun(); }); }
    if (U.button(c, w / 2 - bw / 2, yy + bh + 10 * sc, bw / 2 - 5 * sc, bh * 0.85, 'Upgrades', { color: '#ff9f1c', size: 16 * sc })) { st.state = 'upgrades'; PG.playing = false; st.hooks = []; PG.track('shop_opened', { source: 'game_over' }); }
    if (U.button(c, w / 2 + 5 * sc, yy + bh + 10 * sc, bw / 2 - 5 * sc, bh * 0.85, 'Menu', { color: '#5c6bc0', size: 16 * sc })) { st.state = 'menu'; st.hooks = []; }
  }

  /* ---------- render ---------- */
  function render(c, w, h, dt) {
    scale = PG.clamp(Math.min(h / 640, w / 400), 0.6, 2.4); t0 = PG.time; anchor += (((st.state === 'menu' || st.state === 'upgrades') ? 0.5 : 0.3) - anchor) * 0.08;
    var pal = palette(((st.hooks.length ? Math.max(0, st.cur) : 0) / 90 + 0.02) % 1), t = PG.time;
    if (st.state === 'menu' || st.state === 'upgrades') pal = palette(0.02 + (t * 0.004) % 1);
    c.save(); if (shake > 0.1) c.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    drawBackdrop(c, w, h, t, pal);
    treeLayer(c, w, h, 0.12, 0.80, 150, 280, pal.leaf, 0.6, pal, 6); treeLayer(c, w, h, 0.28, 0.9, 120, 300, pal.leaf, 0.42, pal, 8); treeLayer(c, w, h, 0.5, 1.02, 150, 340, pal.leaf, 0.22, pal, 10);
    drawShafts(c, w, h, t, pal);
    // ground mist
    var mg = c.createLinearGradient(0, h * 0.75, 0, h); mg.addColorStop(0, rgb(pal.fog, 0)); mg.addColorStop(1, rgb(mix(pal.fog, pal.leaf, 0.3), 0.7)); c.fillStyle = mg; c.fillRect(0, h * 0.75, w, h * 0.25);
    // fireflies at night
    if (pal.day < 0.55) fireflies.forEach(function (f) { var a = (0.55 - pal.day) * 1.8; var x = ((f.x + t * 0.006 * f.s) % 1) * w, y = (f.y * 0.8 + Math.sin(t * 0.6 * f.s + f.p) * 0.03) * h; var gg = c.createRadialGradient(x, y, 0, x, y, 12 * scale); gg.addColorStop(0, 'rgba(210,255,150,' + a * (0.5 + 0.5 * Math.sin(t * 3 + f.p)) + ')'); gg.addColorStop(1, 'rgba(210,255,150,0)'); c.fillStyle = gg; c.fillRect(x - 12 * scale, y - 12 * scale, 24 * scale, 24 * scale); });
    else motes.forEach(function (f) { var x = ((f.x + t * 0.01 * f.s) % 1) * w, y = ((f.y + Math.sin(t * 0.5 + f.p) * 0.02) % 1) * h; c.fillStyle = 'rgba(255,250,200,' + 0.35 * pal.day * (0.5 + 0.5 * Math.sin(t * 2 + f.p)) + ')'; c.beginPath(); c.arc(x, y, 1.6 * scale, 0, TAU); c.fill(); });
    // hooks (draw the trunk-side branches)
    st.hooks.forEach(function (hk, i) { if (i >= Math.max(0, st.cur - 2) && i <= st.cur + 8) drawBranch(c, hk, w, h, t, pal, i); });
    st.leaves.forEach(function (l) { if (!l.taken) { var p = w2s(l.x, l.y, w, h); if (p.x > -30 && p.x < w + 30) drawLeaf(c, p.x, p.y, l.p, t, scale); } });
    st.bees.forEach(function (b) { drawBee(c, b, w, h, t); });
    drawPreview(c, w, h, t);
    // sloth
    if (st.state !== 'dead' || st.deadT < 1.2 || true) {
      var bp = w2s(st.body.x, st.body.y, w, h), hk = st.hooks[st.cur] || { x: 0, y: 0 }, hp = w2s(hk.x, hk.y, w, h);
      var vx = st.flying ? st.vel.x : Math.cos(st.phase) * A * W * R * Math.cos(theta()); lag.hx += ((-vx * 0.03) - lag.hx) * 0.12; lag.hy += ((st.flying ? -st.vel.y * 0.02 : 0) - lag.hy) * 0.12; lag.lx += ((-vx * 0.05) - lag.lx) * 0.1;
      c.save(); c.translate(bp.x, bp.y); c.scale(scale * 1.2, scale * 1.2); c.rotate(st.flying || st.state === 'rescue' || st.state === 'dead' ? st.rot : -theta());
      var dx = (hk.x - st.body.x), dy = (hk.y - st.body.y), ca = Math.cos(st.rot), sa = Math.sin(st.rot); var th = theta(); var loc = { x: (dx * Math.cos(th) - dy * Math.sin(th)) / 1.2, y: (dx * Math.sin(th) + dy * Math.cos(th)) / 1.2 };
      var mood = st.state === 'dead' ? 'scared' : st.flying ? (st.vel.y > 120 ? 'scared' : 'happy') : (st.state === 'menu' ? 'sleepy' : 'happy');
      drawSloth(c, t, loc, !st.flying && st.state !== 'dead', mood); c.restore();
    }
    PG.drawParts(c); PG.drawPops(c);
    // foreground vines / leaves (blurry depth)
    c.save(); c.globalAlpha = 0.9; var fgc = mix(pal.leaf, [5, 15, 10], 0.55);
    for (var i = 0; i < 4; i++) { var fx = ((i * 0.31 + 0.07) * w - (cam.x * 0.9 * scale) % (w * 1.3)); fx = ((fx % (w * 1.3)) + w * 1.3) % (w * 1.3) - w * 0.15; c.strokeStyle = rgb(fgc); c.lineWidth = 3 * scale; c.beginPath(); c.moveTo(fx, -10); c.quadraticCurveTo(fx + Math.sin(t + i) * 18 * scale, h * 0.12, fx + Math.sin(t * 0.8 + i) * 8 * scale, h * (0.16 + 0.04 * (i % 3))); c.stroke(); c.fillStyle = rgb(fgc); for (var k = 1; k < 4; k++) { c.beginPath(); c.ellipse(fx + Math.sin(t + i) * 6 * scale * k * 0.3, h * 0.045 * k, 9 * scale, 4 * scale, 0.6 + Math.sin(t + k) * 0.2, 0, TAU); c.fill(); } }
    c.restore();
    var vg = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(10,20,10,' + (0.35 + (1 - pal.day) * 0.2) + ')'); c.fillStyle = vg; c.fillRect(0, 0, w, h);
    c.restore();
    if (st.state === 'play' || st.state === 'rescue') drawHUD(c, w, h);
    else if (st.state === 'menu') drawMenu(c, w, h, t);
    else if (st.state === 'upgrades') drawUpgrades(c, w, h, t);
    else if (st.state === 'dead') drawDead(c, w, h, t);
  }

  PG.onDown = function (x, y) { if (x > PG.w - 130 * PG.scale() && y < 70 * PG.scale()) return; tapAction(); };
  PG.setup(document.getElementById('c'), update, render);
  window.__sloth = { st: st, predict: predict, release: release, start: startRun, grabR: grabR, cam: cam };
  PG.init({ id: 'sloth_sprint', version: '1.0.0', defaults: { best: 0, coins: 0, runs: 0, up: {}, muted: false } }).then(function () {
    PG.music({ scale: [0, 3, 5, 7, 10], root: 196, bpm: 72, wave: 'sine', vol: 0.08, bass: 0.1 });
    // first frame already has a hanging sloth
    st.hooks = [{ x: 0, y: 0, th: 0, pts: [], tg: 0, wob: 0 }];
  });
})();
