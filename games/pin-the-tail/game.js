/* PIN THE TAIL - toss darts into a spinning carnival wheel. Never hit a dart that is already stuck. Boss wheels reverse the spin.
   Art direction: vintage carnival poster. Flat inks, navy keylines, hard offset shadows, halftone shading, marquee bulbs. */
(function () {
  'use strict';
  var U = PG.ui, TAU = 6.2832, D2R = Math.PI / 180;
  var NAVY = '#1d2a3a', CREAM = '#f5e6c8', RED = '#d64933', MUST = '#f2b134', TEAL = '#2a9d8f', PINK = '#e98a8a', ORANGE = '#e76f2b';
  var WHEELS = [
    { n: 'Lucky Wheel', bg: ['#f6d58e', '#efc56c'], ink: NAVY },
    { n: 'Bullseye', bg: ['#a5d8cc', '#8ccabd'], ink: NAVY },
    { n: 'Starlight', bg: ['#f0a58f', '#e88f78'], ink: NAVY },
    { n: 'Sunburst', bg: ['#2f4a6d', '#28405f'], ink: CREAM },
    { n: 'Checkerboard', bg: ['#f3b6c1', '#eaa2b0'], ink: NAVY },
    { n: 'Hypno Spiral', bg: ['#b9a6d9', '#a893cf'], ink: NAVY }
  ];
  var DART_COLS = [RED, TEAL, MUST, PINK, '#5b6fb5'], BALLOON_COLS = [RED, TEAL, MUST, PINK];
  var UPS = [
    { id: 'slow', n: 'Steady Spin', d: 'Wheels spin 4% slower', max: 8, base: 30, grow: 1.5 },
    { id: 'wide', n: 'Slim Darts', d: 'Darts can sit closer', max: 6, base: 40, grow: 1.6 },
    { id: 'apple', n: 'Balloon Seller', d: 'More balloons on wheels', max: 5, base: 35, grow: 1.6 },
    { id: 'coins', n: 'Lucky Tokens', d: '+20% tokens per stage', max: 8, base: 45, grow: 1.6 },
    { id: 'life', n: 'Second Chance', d: 'Forgive one bad toss per run', max: 2, base: 150, grow: 2.5 }
  ];
  var st = { state: 'menu', stage: 1, pins: [], apples: [], left: 0, fly: [], rot: 0, vel: 0, pat: 'const', patT: 0, base: 70, dir: 1, clearT: 0, hurt: 0, coinsRun: 0, lives: 0, usedCont: false, deadT: 0, boss: false, scaleIn: 1, recoil: 0, runIdx: 0, bestHit: false, total: 0, tut: true, theme: 0, introT: 9 };
  var geo = { cx: 0, cy: 0, r: 100, ky: 0, floor: 0, land: false };

  function minSep() { return (11 - PG.upLevel('wide') * 0.9); }
  function stageSpec(n) {
    var boss = n % 5 === 0;
    return { boss: boss, need: Math.min(5 + Math.floor(n / 2), 13) + (boss ? 2 : 0), stuck: Math.min(1 + Math.floor(n / 3), 7), speed: Math.min(60 + n * 4.5, 170) * (boss ? 0.9 : 1), pat: boss ? 'flip' : ['const', 'const', 'sine', 'pulse', 'flip'][Math.min(4, Math.floor(PG.rand(0, 1 + Math.min(4, n / 3))))] };
  }
  function angDiff(a, b) { var d = ((a - b) % 360 + 540) % 360 - 180; return Math.abs(d); }
  function newStage() {
    var sp = stageSpec(st.stage); st.boss = sp.boss; st.left = sp.need; st.pat = sp.pat; st.base = sp.speed * Math.pow(0.96, PG.upLevel('slow')); st.dir = Math.random() < 0.5 ? 1 : -1; st.dir0 = 0; st.pins = []; st.apples = []; st.fly = []; st.rot = Math.random() * 360; st.patT = 0; st.vel = st.base * st.dir;
    st.theme = (st.stage - 1) % WHEELS.length; st.scaleIn = 0; st.state = 'play'; st.clearT = 0; st.introT = 0;
    var tries = 0; while (st.pins.length < sp.stuck && tries++ < 200) { var a = PG.rand(0, 360); if (st.pins.every(function (p) { return angDiff(p.a, a) > minSep() * 2.4; })) st.pins.push({ a: a, w: 0, c: PG.pick(DART_COLS) }); }
    var na = Math.random() < 0.4 + PG.upLevel('apple') * 0.12 ? (1 + (PG.upLevel('apple') > 2 && Math.random() < 0.4 ? 1 : 0)) : 0; tries = 0;
    while (st.apples.length < na && tries++ < 200) { var b = PG.rand(0, 360); if (st.pins.every(function (p) { return angDiff(p.a, b) > minSep() * 2 + 8; }) && st.apples.every(function (p) { return angDiff(p.a, b) > 30; })) st.apples.push({ a: b, c: PG.pick(BALLOON_COLS) }); }
    if (st.boss) PG.sfx('boss');
    PG.msg('level_started', { level: String(st.stage) }); PG.track('progression_started', { step_id: 'stage', step_index: Math.min(st.stage, 60) });
  }
  function startRun() { st.stage = 1; st.coinsRun = 0; st.lives = PG.upLevel('life'); st.usedCont = false; st.runIdx++; st.bestHit = false; st.tut = !PG.save.runs; st.deadT = 0; st.hurtPin = null; PG.playing = true; PG.parts = []; PG.pops = []; newStage(); PG.track('progression_started', { step_id: 'run', step_index: Math.min(st.runIdx, 50) }); }
  function throwPin() {
    if (st.state !== 'play' || st.left <= 0 || st.scaleIn < 0.8) return;
    if (st.fly.length >= 3) return;
    st.left--; st.fly.push({ y: geo.ky, c: st.nextC || RED }); st.nextC = PG.pick(DART_COLS); st.kick = 1; st.tut = false; PG.sfx('shoot', 1 + Math.random() * 0.1);
  }
  function rimPoint() { return { x: geo.cx, y: geo.cy + geo.r }; }
  function stick(f) {
    var a = ((90 - st.rot) % 360 + 360) % 360, fail = false, rp = rimPoint(), i;
    for (i = 0; i < st.pins.length; i++) if (angDiff(st.pins[i].a, a) < minSep()) { fail = true; break; }
    if (fail) {
      st.hurtPin = { x: rp.x, y: rp.y, vy: 520, vx: PG.rand(-120, 120), rot: 0, c: f.c };
      if (st.lives > 0) { st.lives--; st.hurt = 0.6; st.left++; PG.sfx('err'); PG.popText(rp.x, rp.y + 34, 'Second chance!', '#bff0d2', 24); shake(8); return; }
      shake(14); PG.sfx('err'); PG.burst(rp.x, rp.y, 14, { colors: [CREAM, f.c, NAVY], shape: 's', s0: 3, s1: 6 }); die(); return;
    }
    st.pins.push({ a: a, w: 1, c: f.c }); st.recoil = 1; PG.sfx('hit', 1 + (st.pins.length % 5) * 0.06); PG.vibrate(8);
    PG.burst(rp.x, rp.y + 4, 7, { colors: ['#c8935f', '#e8c9a0', CREAM], g: 500, angle: Math.PI / 2, spread: 2.2, min: 60, max: 220, shape: 's', s0: 1.5, s1: 3 });
    for (i = st.apples.length - 1; i >= 0; i--) if (angDiff(st.apples[i].a, a) < 13) {
      var ap = st.apples.splice(i, 1)[0], v = 2; st.coinsRun += v; PG.save.coins += v; PG.sfx('pop', 1.5); PG.sfx('coin');
      PG.popText(rp.x, rp.y - geo.r * 0.3, '+2 tokens', MUST, 24);
      PG.burst(rp.x, rp.y - geo.r * 0.28, 18, { colors: [ap.c, CREAM, MUST], g: 260, min: 80, max: 300, shape: 's', s0: 2, s1: 5 });
    }
    if (st.left <= 0 && st.fly.length === 0) clearStage();
  }
  function shake(n) { st.shakeV = n; }
  function clearStage() {
    st.state = 'clear'; st.clearT = 0; var bonus = (1 + (st.boss ? 4 : 0)) * (1 + 0.2 * PG.upLevel('coins')); bonus = Math.round(bonus * 10) / 10;
    st.coinsRun += bonus; PG.save.coins = Math.round((PG.save.coins + bonus) * 10) / 10; st.stageBonus = bonus; st.total++;
    PG.sfx('win'); PG.track('progression_completed', { step_id: 'stage', step_index: Math.min(st.stage, 60), boss: st.boss });
    PG.msg('level_completed', { level: String(st.stage) });
    st.pins.forEach(function (p) { var a = (p.a + st.rot) * D2R; PG.burst(geo.cx + Math.cos(a) * geo.r, geo.cy + Math.sin(a) * geo.r, 3, { colors: [p.c, CREAM], g: 600, min: 100, max: 400, shape: 's' }); });
    PG.burst(geo.cx, geo.cy, 46, { colors: [RED, MUST, TEAL, CREAM, PINK], g: 420, min: 120, max: 520, s0: 3, s1: 7, shape: 's', drag: 0.6 });
    if (st.stage > (PG.save.best || 0)) { PG.save.best = st.stage; st.bestHit = true; } PG.commit();
  }
  function die() {
    st.state = 'dead'; st.deadT = 0; PG.playing = false; PG.sfx('lose'); PG.save.runs = (PG.save.runs || 0) + 1; PG.commit(true);
    PG.track('progression_failed', { step_id: 'stage', step_index: Math.min(st.stage, 60), boss: st.boss }); PG.msg('level_failed', { level: String(st.stage) });
  }
  function layout(w, h) {
    var sc = PG.scale(), land = w > h * 1.15, side = land && (st.state === 'menu' || st.state === 'upgrades');
    geo.land = land; geo.ky = h - Math.max(64 * sc, h * 0.09); geo.floor = geo.ky - 26 * sc;
    if (side) { geo.r = Math.min(h * 0.27, w * 0.17); geo.cx += (w * 0.7 - geo.cx) * 0.15; geo.cy = h * 0.46; }
    else { geo.r = Math.min(w * (land ? 0.2 : 0.27), h * 0.2); geo.cx += (w / 2 - geo.cx) * (st.state === 'menu' ? 0.15 : 1); geo.cy = h * (land ? 0.4 : 0.36); }
    if (!geo.init) { geo.init = true; geo.cx = side ? w * 0.7 : w / 2; }
  }

  /* ---------- update ---------- */
  function update(dt) {
    PG.updateParts(dt); PG.updatePops(dt); st.shakeV = Math.max(0, (st.shakeV || 0) - dt * 40); st.hurt = Math.max(0, st.hurt - dt); st.introT += dt; st.kick = Math.max(0, (st.kick || 0) - dt * 6);
    if (st.recoil > 0) st.recoil = Math.max(0, st.recoil - dt * 4);
    if (PG.keyHit(' ') || PG.keyHit('enter') || PG.keyHit('arrowup')) throwPin();
    st.pins.forEach(function (p) { if (p.w > 0) p.w = Math.max(0, p.w - dt * 1.8); });
    if (st.hurtPin) { var hp = st.hurtPin; hp.y += hp.vy * dt; hp.x += hp.vx * dt; hp.vy += 1500 * dt; hp.rot += dt * 10; if (hp.y > PG.h + 80) st.hurtPin = null; }
    if (st.state === 'menu' || st.state === 'upgrades') { st.rot += 34 * dt; st.scaleIn = Math.min(1, st.scaleIn + dt * 3); return; }
    if (st.state === 'dead') st.deadT += dt;
    st.scaleIn = Math.min(1, st.scaleIn + dt * 2.4);
    if (st.state === 'play' || st.state === 'dead') {
      st.patT += dt; var m = 1;
      if (st.pat === 'sine') m = 0.35 + 1.15 * (0.5 + 0.5 * Math.sin(st.patT * 1.8));
      else if (st.pat === 'pulse') m = (Math.floor(st.patT / 1.1) % 2) ? 1.8 : 0.55;
      else if (st.pat === 'flip') { var ph = Math.floor(st.patT / 2.4); st.dir = (ph % 2 ? -1 : 1) * (st.dir0 || (st.dir0 = st.dir || 1)); m = 0.75 + 0.5 * Math.abs(Math.sin(st.patT * 1.3)); st.vel += ((st.base * m * st.dir) - st.vel) * Math.min(1, dt * 3); }
      if (st.pat !== 'flip') st.vel = st.base * m * st.dir;
      if (st.state === 'play') st.rot += st.vel * dt;
      for (var i = st.fly.length - 1; i >= 0; i--) { var f = st.fly[i]; f.y -= 2000 * dt; if (f.y <= geo.cy + geo.r) { st.fly.splice(i, 1); stick(f); if (st.state !== 'play') break; } }
    } else if (st.state === 'clear') {
      st.clearT += dt; if (st.clearT > 1.25) { st.stage++; newStage(); }
    }
  }

  /* ---------- cached art ---------- */
  var cache = {};
  function off(key, w, h, paint) {
    if (cache[key]) return cache[key];
    var d = PG.dpr || 1, cv = document.createElement('canvas'); cv.width = Math.ceil(w * d); cv.height = Math.ceil(h * d);
    var c = cv.getContext('2d'); c.scale(d, d); paint(c, w, h); cv.lw = w; cv.lh = h; cache[key] = cv; return cv;
  }
  function star(c, x, y, r, n, inner, rot) { c.beginPath(); for (var i = 0; i < n * 2; i++) { var a = (rot || -Math.PI / 2) + i * Math.PI / n, rr = i % 2 ? r * (inner || 0.45) : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); }
  function wedge(c, r0, r1, a0, a1) { c.beginPath(); c.arc(0, 0, r1, a0, a1); c.arc(0, 0, r0, a1, a0, true); c.closePath(); }
  function wheelFace(k, boss, r) { // the rotating painted face, centered in a square canvas
    var S = r * 2.1;
    return off('face' + k + (boss ? 'b' : '') + Math.round(r), S, S, function (c) {
      c.translate(S / 2, S / 2); var R = r * 0.86;
      c.fillStyle = boss ? '#8f1d14' : NAVY; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
      c.save(); c.beginPath(); c.arc(0, 0, R, 0, TAU); c.clip();
      var i;
      if (k === 0) {
        for (i = 0; i < 12; i++) { c.fillStyle = i % 2 ? CREAM : RED; wedge(c, 0, R, i * TAU / 12, (i + 1) * TAU / 12); c.fill(); }
        c.strokeStyle = NAVY; c.lineWidth = Math.max(1.5, r * 0.018); for (i = 0; i < 12; i++) { c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(i * TAU / 12) * R, Math.sin(i * TAU / 12) * R); c.stroke(); }
        var nums = ['5', '10', '25', '50', '5', '100', '10', '25', '5', '50', '10', '25'];
        for (i = 0; i < 12; i++) { c.save(); c.rotate((i + 0.5) * TAU / 12); c.translate(R * 0.74, 0); c.rotate(Math.PI / 2); U.text(c, nums[i], 0, 0, r * 0.13, i % 2 ? RED : CREAM, 'center', { shadow: false }); c.restore(); }
        c.fillStyle = TEAL; c.beginPath(); c.arc(0, 0, R * 0.36, 0, TAU); c.fill(); c.strokeStyle = NAVY; c.lineWidth = r * 0.025; c.stroke();
      } else if (k === 1) {
        [[1, RED], [0.82, CREAM], [0.64, RED], [0.46, CREAM], [0.3, NAVY], [0.16, MUST]].forEach(function (q) { c.fillStyle = q[1]; c.beginPath(); c.arc(0, 0, R * q[0], 0, TAU); c.fill(); c.strokeStyle = NAVY; c.lineWidth = Math.max(1.2, r * 0.012); c.stroke(); });
        for (i = 0; i < 8; i++) { c.fillStyle = NAVY; c.save(); c.rotate(i * TAU / 8); c.fillRect(R * 0.86, -r * 0.012, R * 0.1, r * 0.024); c.restore(); }
      } else if (k === 2) {
        c.fillStyle = NAVY; c.fillRect(-R, -R, R * 2, R * 2); c.fillStyle = '#2b3d55'; c.beginPath(); c.arc(0, 0, R * 0.82, 0, TAU); c.fill();
        var rnd = PG.mulberry(9); c.fillStyle = CREAM; for (i = 0; i < 16; i++) { var a = rnd() * TAU, d = R * (0.62 + rnd() * 0.3); star(c, Math.cos(a) * d, Math.sin(a) * d, r * (0.025 + rnd() * 0.035), 4, 0.4, rnd()); c.fill(); }
        c.fillStyle = MUST; star(c, 0, 0, R * 0.62, 5, 0.46); c.fill(); c.strokeStyle = CREAM; c.lineWidth = r * 0.02; c.stroke(); c.fillStyle = RED; star(c, 0, 0, R * 0.28, 5, 0.46); c.fill();
      } else if (k === 3) {
        for (i = 0; i < 16; i++) { c.fillStyle = i % 2 ? ORANGE : MUST; wedge(c, 0, R, i * TAU / 16, (i + 1) * TAU / 16); c.fill(); }
        c.fillStyle = CREAM; c.beginPath(); c.arc(0, 0, R * 0.4, 0, TAU); c.fill(); c.strokeStyle = NAVY; c.lineWidth = r * 0.025; c.stroke();
        c.fillStyle = NAVY; c.beginPath(); c.arc(-R * 0.13, -R * 0.06, R * 0.04, 0, TAU); c.arc(R * 0.13, -R * 0.06, R * 0.04, 0, TAU); c.fill(); c.lineWidth = r * 0.022; c.lineCap = 'round'; c.beginPath(); c.arc(0, R * 0.04, R * 0.16, 0.4, Math.PI - 0.4); c.stroke();
        c.fillStyle = 'rgba(214,73,51,.5)'; c.beginPath(); c.arc(-R * 0.24, R * 0.08, R * 0.05, 0, TAU); c.arc(R * 0.24, R * 0.08, R * 0.05, 0, TAU); c.fill();
      } else if (k === 4) {
        c.fillStyle = CREAM; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill();
        [[0.34, 0.56, 0], [0.56, 0.78, 1], [0.78, 1.0, 0]].forEach(function (q) { for (var j = 0; j < 16; j++) if ((j + q[2]) % 2) { c.fillStyle = TEAL; wedge(c, R * q[0], R * q[1], j * TAU / 16, (j + 1) * TAU / 16); c.fill(); } c.strokeStyle = NAVY; c.lineWidth = Math.max(1.2, r * 0.012); c.beginPath(); c.arc(0, 0, R * q[0], 0, TAU); c.stroke(); });
        c.fillStyle = RED; c.beginPath(); c.arc(0, 0, R * 0.34, 0, TAU); c.fill(); c.fillStyle = CREAM; star(c, 0, 0, R * 0.2, 5, 0.45); c.fill();
      } else {
        c.fillStyle = CREAM; c.beginPath(); c.arc(0, 0, R, 0, TAU); c.fill(); c.fillStyle = RED;
        for (i = 0; i < 8; i++) { c.beginPath(); var b0 = i * TAU / 8; c.moveTo(0, 0); for (var p = 0; p <= 1.001; p += 0.05) c.lineTo(Math.cos(b0 + p * 2.2) * R * p * 1.05, Math.sin(b0 + p * 2.2) * R * p * 1.05); for (p = 1; p >= 0; p -= 0.05) c.lineTo(Math.cos(b0 + TAU / 16 + p * 2.2) * R * p * 1.05, Math.sin(b0 + TAU / 16 + p * 2.2) * R * p * 1.05); c.fill(); }
        c.fillStyle = NAVY; c.beginPath(); c.arc(0, 0, R * 0.12, 0, TAU); c.fill();
      }
      c.restore();
      c.strokeStyle = MUST; c.lineWidth = Math.max(1.5, r * 0.02); c.beginPath(); c.arc(0, 0, R + r * 0.01, 0, TAU); c.stroke();
      c.strokeStyle = boss ? '#5c120c' : '#0f1824'; c.lineWidth = Math.max(1.5, r * 0.018); c.beginPath(); c.arc(0, 0, r - r * 0.01, 0, TAU); c.stroke();
    });
  }
  function wheelShade(r) { // fixed light from the upper left: halftone dots + a printed highlight
    var S = r * 2.1;
    return off('shade' + Math.round(r), S, S, function (c) {
      c.translate(S / 2, S / 2); c.save(); c.beginPath(); c.arc(0, 0, r, 0, TAU); c.clip();
      var d = Math.max(4, r * 0.065); c.fillStyle = 'rgba(29,42,58,.32)';
      for (var y = -r; y <= r; y += d) for (var x = -r + ((y / d) & 1 ? d / 2 : 0); x <= r; x += d) { var k = PG.clamp(((x + y) / (r * 1.5)) + 0.05, 0, 1); if (k > 0.04) { c.beginPath(); c.arc(x, y, d * 0.5 * k, 0, TAU); c.fill(); } }
      c.restore();
      c.strokeStyle = 'rgba(255,248,230,.55)'; c.lineWidth = r * 0.035; c.lineCap = 'round'; c.beginPath(); c.arc(0, 0, r * 0.74, Math.PI * 1.1, Math.PI * 1.36); c.stroke();
      c.beginPath(); c.arc(0, 0, r * 0.74, Math.PI * 1.42, Math.PI * 1.47); c.stroke();
    });
  }
  function bulbSprite() { return off('bulb', 40, 40, function (c) { var g = c.createRadialGradient(20, 20, 0, 20, 20, 20); g.addColorStop(0, 'rgba(255,236,170,.9)'); g.addColorStop(0.3, 'rgba(255,214,110,.45)'); g.addColorStop(1, 'rgba(255,200,90,0)'); c.fillStyle = g; c.fillRect(0, 0, 40, 40); }); }
  function bulb(c, x, y, r, on) {
    if (on) { var b = bulbSprite(); c.drawImage(b, x - r * 3.2, y - r * 3.2, r * 6.4, r * 6.4); }
    c.fillStyle = on ? '#fff3c4' : '#7d6a4a'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    if (on) { c.fillStyle = '#fff'; c.beginPath(); c.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, TAU); c.fill(); }
  }
  function halftoneBG(w, h) {
    return off('ht' + w + 'x' + h, w, h, function (c) {
      var d = 10, cx = w / 2, cy = h * 0.4, R = Math.hypot(w, h) * 0.55; c.fillStyle = 'rgba(29,42,58,.13)';
      for (var y = 0; y <= h + d; y += d) for (var x = ((y / d) & 1 ? d / 2 : 0); x <= w + d; x += d) { var k = PG.clamp((Math.hypot(x - cx, y - cy) / R - 0.45) * 2.2, 0, 1); if (k > 0.05) { c.beginPath(); c.arc(x, y, d * 0.52 * k, 0, TAU); c.fill(); } }
    });
  }

  /* ---------- drawing ---------- */
  function drawBG(c, w, h, t) {
    var th = WHEELS[st.theme], sc = PG.scale();
    c.fillStyle = th.bg[0]; c.fillRect(0, 0, w, h);
    c.save(); c.translate(geo.cx, geo.cy); c.rotate(t * 0.04); c.fillStyle = th.bg[1]; var R = Math.hypot(w, h);
    for (var i = 0; i < 28; i += 2) { c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R, i * TAU / 28, (i + 1) * TAU / 28); c.closePath(); c.fill(); }
    c.restore();
    var ht = halftoneBG(w, h); c.drawImage(ht, 0, 0, w, h);
    // easel legs
    var r = geo.r, fl = geo.floor; c.lineCap = 'round';
    [-1, 1].forEach(function (s) { c.strokeStyle = NAVY; c.lineWidth = r * 0.13 + 4; c.beginPath(); c.moveTo(geo.cx + s * r * 0.3, geo.cy); c.lineTo(geo.cx + s * r * 1.05, fl + 4); c.stroke(); c.strokeStyle = '#a8703f'; c.lineWidth = r * 0.13; c.beginPath(); c.moveTo(geo.cx + s * r * 0.3, geo.cy); c.lineTo(geo.cx + s * r * 1.05, fl + 4); c.stroke(); c.strokeStyle = 'rgba(255,230,190,.35)'; c.lineWidth = r * 0.03; c.beginPath(); c.moveTo(geo.cx + s * r * 0.3 - r * 0.03, geo.cy); c.lineTo(geo.cx + s * r * 1.05 - r * 0.03, fl + 4); c.stroke(); });
    // stage floor
    c.fillStyle = NAVY; c.fillRect(0, fl - 3, w, h - fl + 3);
    c.fillStyle = '#9a6337'; c.fillRect(0, fl, w, h - fl);
    c.fillStyle = '#b27a47'; c.fillRect(0, fl, w, 5 * sc);
    var ph = Math.max(14, (h - fl) / 3); c.strokeStyle = 'rgba(29,42,58,.45)'; c.lineWidth = 1.5;
    for (var y = fl + ph, row = 0; y < h; y += ph, row++) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); for (var x = (row % 2) * 60 + 30; x < w; x += 120) { c.beginPath(); c.moveTo(x, y - ph); c.lineTo(x, y); c.stroke(); } }
    c.fillStyle = 'rgba(29,42,58,.25)'; c.beginPath(); c.ellipse(geo.cx, fl + 6 * sc, r * 0.8, 6 * sc, 0, 0, TAU); c.fill();
  }
  function drawMarquee(c, w, h, t) { // bulb frame around the whole stage
    var sc = PG.scale(), b = 9 * sc, sp = 24 * sc, n = 0;
    c.fillStyle = RED; c.fillRect(0, 0, w, b); c.fillRect(0, h - b, w, b); c.fillRect(0, 0, b, h); c.fillRect(w - b, 0, b, h);
    c.fillStyle = NAVY; c.fillRect(b, b, w - b * 2, 2); c.fillRect(b, h - b - 2, w - b * 2, 2); c.fillRect(b, b, 2, h - b * 2); c.fillRect(w - b - 2, b, 2, h - b * 2);
    var step = Math.floor(t * 5), pts = [];
    for (var x = b / 2; x < w; x += sp) { pts.push([x, b / 2]); }
    for (var y = b / 2 + sp; y < h - sp / 2; y += sp) { pts.push([w - b / 2, y]); }
    for (x = w - b / 2; x > 0; x -= sp) { pts.push([x, h - b / 2]); }
    for (y = h - b / 2 - sp; y > sp / 2; y -= sp) { pts.push([b / 2, y]); }
    pts.forEach(function (p, i) { bulb(c, p[0], p[1], 2.8 * sc, (i + step) % 3 !== 0); n++; });
  }
  function drawDart(c, col, L, back) { // dart along +x: tip at 0, flights toward +L
    var hw = L * 0.06;
    c.lineJoin = 'round'; c.strokeStyle = NAVY; c.lineWidth = Math.max(1.2, L * 0.03);
    c.fillStyle = col; [-1, 1].forEach(function (s) { c.beginPath(); c.moveTo(L * 0.6, 0); c.lineTo(L * 0.76, s * L * 0.2); c.lineTo(L * 1.02, s * L * 0.23); c.lineTo(L * 0.98, 0); c.closePath(); c.fill(); c.stroke(); });
    c.fillStyle = CREAM; [-1, 1].forEach(function (s) { c.beginPath(); c.moveTo(L * 0.78, s * L * 0.05); c.lineTo(L * 0.84, s * L * 0.19); c.lineTo(L * 0.9, s * L * 0.2); c.lineTo(L * 0.86, s * L * 0.04); c.closePath(); c.fill(); });
    c.fillStyle = CREAM; c.fillRect(L * 0.4, -hw * 0.45, L * 0.32, hw * 0.9); c.strokeRect(L * 0.4, -hw * 0.45, L * 0.32, hw * 0.9);
    c.fillStyle = NAVY; c.beginPath(); c.moveTo(L * 0.12, -hw * 0.6); c.lineTo(L * 0.18, -hw); c.lineTo(L * 0.42, -hw); c.lineTo(L * 0.44, -hw * 0.5); c.lineTo(L * 0.44, hw * 0.5); c.lineTo(L * 0.42, hw); c.lineTo(L * 0.18, hw); c.lineTo(L * 0.12, hw * 0.6); c.closePath(); c.fill();
    c.fillStyle = MUST; for (var k = 0; k < 3; k++) c.fillRect(L * (0.22 + k * 0.06), -hw, L * 0.025, hw * 2);
    c.fillStyle = '#cfd5dd'; c.beginPath(); c.moveTo(-L * 0.06, 0); c.lineTo(L * 0.12, -hw * 0.45); c.lineTo(L * 0.12, hw * 0.45); c.closePath(); c.fill(); c.stroke();
  }
  function balloon(c, col, s, t) {
    c.strokeStyle = NAVY; c.lineWidth = Math.max(1, s * 0.06); c.beginPath(); c.moveTo(-s * 1.7, 0); c.quadraticCurveTo(-s * 1.3, s * 0.25 * Math.sin(t * 3), -s * 1.0, 0); c.stroke();
    c.fillStyle = col; c.beginPath(); c.moveTo(-s * 1.0, 0); c.lineTo(-s * 0.82, -s * 0.16); c.lineTo(-s * 0.82, s * 0.16); c.closePath(); c.fill();
    c.beginPath(); c.ellipse(0, 0, s * 0.85, s * 0.7, 0, 0, TAU); c.fill(); c.lineWidth = Math.max(1.2, s * 0.08); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.ellipse(s * 0.25, -s * 0.28, s * 0.22, s * 0.12, -0.5, 0, TAU); c.fill();
  }
  function drawTarget(c, t) {
    var r = geo.r, sc = PG.ease.back(Math.min(1, st.scaleIn)) * (1 - st.recoil * 0.05), exp = st.state === 'clear' ? Math.max(0, 1 - st.clearT * 6) : 1, L = r * 0.55;
    if (exp <= 0) return;
    c.save(); c.translate(geo.cx, geo.cy + st.recoil * 6); c.scale(sc * exp, sc * exp);
    c.fillStyle = 'rgba(29,42,58,.28)'; c.beginPath(); c.arc(r * 0.07, r * 0.09, r * 1.0, 0, TAU); c.fill();
    c.save(); c.rotate(st.rot * D2R);
    st.pins.forEach(function (p) { c.save(); c.rotate(p.a * D2R); c.translate(r * 0.95, 0); c.rotate(Math.sin(t * 40) * p.w * 0.08); drawDart(c, p.c, L); c.restore(); });
    var face = wheelFace(st.theme, st.boss, r); c.drawImage(face, -face.lw / 2, -face.lh / 2, face.lw, face.lh);
    st.apples.forEach(function (ap) { c.save(); c.rotate(ap.a * D2R); c.translate(r * 0.62, 0); balloon(c, ap.c, r * 0.14, t + ap.a); c.restore(); });
    var nb = 16, chase = Math.floor(t * 4);
    for (var i = 0; i < nb; i++) { var a = i * TAU / nb; bulb(c, Math.cos(a) * r * 0.93, Math.sin(a) * r * 0.93, Math.max(2, r * 0.035), st.boss ? (i + chase) % 2 === 0 : (i + chase) % 4 !== 0); }
    c.restore();
    var sh = wheelShade(r); c.drawImage(sh, -sh.lw / 2, -sh.lh / 2, sh.lw, sh.lh);
    c.fillStyle = NAVY; c.beginPath(); c.arc(0, 0, r * 0.1, 0, TAU); c.fill(); c.fillStyle = MUST; star(c, 0, 0, r * 0.07, 5, 0.45, st.rot * D2R); c.fill();
    if (st.boss) { c.save(); c.rotate(-st.rot * D2R * 0.5); c.strokeStyle = RED; c.lineWidth = r * 0.03; c.setLineDash([r * 0.1, r * 0.08]); c.beginPath(); c.arc(0, 0, r * 1.1, 0, TAU); c.stroke(); c.setLineDash([]); c.restore(); }
    c.restore();
  }
  function drawFlyDart(c, x, y, col, L) { c.save(); c.translate(x, y); c.rotate(-Math.PI / 2); drawDart(c, col, L); c.restore(); }
  function drawStash(c, w, h) {
    var sc = PG.scale(), n = Math.min(st.left, 15), L = geo.r * 0.55;
    if (st.state === 'play' && st.left > 0) drawFlyDart(c, geo.cx, geo.ky + st.kick * 16 * sc, st.nextC || RED, L);
    var sL = Math.min(26 * sc, L * 0.55), sw = Math.min(16 * sc, (w * 0.8) / 15), y0 = h - 10 * sc - 4 * sc;
    for (var i = 0; i < n; i++) { var x = w / 2 - (n - 1) * sw / 2 + i * sw; c.save(); c.translate(x, y0); c.rotate(-Math.PI / 2 + 0.06 * Math.sin(i * 2.1)); drawDart(c, i === n - 1 ? (st.nextC || RED) : CREAM, sL); c.restore(); }
  }

  /* ---------- theme: ticket buttons, poster cards, curtain transition ---------- */
  function lum(hex) { if (hex[0] !== '#') return 0.5; var n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; }
  function ticket(c, x, y, w, h, nr) {
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + w, y); c.lineTo(x + w, y + h / 2 - nr); c.arc(x + w, y + h / 2, nr, -Math.PI / 2, Math.PI / 2, true); c.lineTo(x + w, y + h); c.lineTo(x, y + h); c.lineTo(x, y + h / 2 + nr); c.arc(x, y + h / 2, nr, Math.PI / 2, -Math.PI / 2, true); c.closePath();
  }
  function ticketCard(c, x, y, w, h, col, o) {
    o = o || {}; var nr = Math.min(h * 0.18, 9), lift = o.lift || 0;
    c.fillStyle = NAVY; ticket(c, x + 3, y + 4, w, h, nr); c.fill();
    c.fillStyle = col; ticket(c, x - lift * 0.5, y - lift, w, h, nr); c.fill(); c.strokeStyle = NAVY; c.lineWidth = 2; c.stroke();
    var ink = lum(col) > 0.55 ? 'rgba(29,42,58,.4)' : 'rgba(245,230,200,.55)'; c.strokeStyle = ink; c.lineWidth = 1.2; c.setLineDash([3, 3]);
    c.beginPath(); c.rect(x + 5 - lift * 0.5, y + 5 - lift, w - 10, h - 10); c.stroke(); c.setLineDash([]);
  }
  PG.theme.font = 'Bungee'; PG.theme.body = 'Bungee'; PG.theme.weight = '400'; PG.theme.bodyWeight = '400'; PG.theme.text = NAVY; PG.theme.textShadow = false; PG.theme.pageColor = NAVY;
  PG.theme.popStyle = { stroke: NAVY };
  PG.theme.button = function (c, x, y, w, h, label, o, s) {
    var col = o.disabled ? '#b8ad98' : o.color || RED, lift = s.press ? -2 : s.hover ? 2 : 0;
    ticketCard(c, x, y, w, h, col, { lift: lift });
    var txt = o.textColor || (lum(col) > 0.55 ? NAVY : CREAM), fs = U.fit(c, label.toUpperCase(), o.size || Math.min(h * 0.4, 24), w - 30);
    U.text(c, label.toUpperCase(), x + w / 2 - lift * 0.5, y + h / 2 + 1 - lift, fs, txt, 'center', { shadow: false });
  };
  PG.theme.panel = function (c, x, y, w, h) {
    c.fillStyle = NAVY; c.fillRect(x + 6, y + 7, w, h); c.fillStyle = CREAM; c.fillRect(x, y, w, h); c.strokeStyle = NAVY; c.lineWidth = 3; c.strokeRect(x, y, w, h);
    c.strokeStyle = RED; c.lineWidth = 1.5; c.strokeRect(x + 7, y + 7, w - 14, h - 14);
    c.fillStyle = RED; [[x + 7, y + 7], [x + w - 7, y + 7], [x + 7, y + h - 7], [x + w - 7, y + h - 7]].forEach(function (p) { star(c, p[0], p[1], 7, 4, 0.4, 0); c.fill(); });
  };
  PG.theme.hudButton = function (c, x, y, r, kind) { c.fillStyle = NAVY; c.beginPath(); c.arc(x + 2, y + 3, r, 0, TAU); c.fill(); c.fillStyle = CREAM; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.strokeStyle = NAVY; c.lineWidth = 2; c.stroke(); PG.hudIcon(c, x, y, r * 0.95, kind, NAVY); };
  var fabric = null;
  PG.theme.transition = { time: 0.42, draw: function (c, w, h, k) {
    if (!fabric) fabric = off('fabric', 48, 8, function (q) { var g = q.createLinearGradient(0, 0, 48, 0); g.addColorStop(0, '#6e0f12'); g.addColorStop(0.35, '#b3241f'); g.addColorStop(0.55, '#c9362b'); g.addColorStop(1, '#6e0f12'); q.fillStyle = g; q.fillRect(0, 0, 48, 8); });
    var cw = (w / 2 + 24) * k, pat = c.createPattern(fabric, 'repeat'), d = PG.dpr || 1; if (pat.setTransform) pat.setTransform(new DOMMatrix([1 / d, 0, 0, 1 / d, 0, 0]));
    [[0, cw], [w - cw, cw]].forEach(function (sd, i) {
      c.save(); c.translate(sd[0], 0); c.fillStyle = pat; c.fillRect(0, 0, sd[1], h);
      var e = i ? 0 : sd[1]; var g = c.createLinearGradient(e - 20, 0, e + 20, 0); g.addColorStop(i ? 1 : 0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(40,0,0,.35)'); c.fillStyle = g; c.fillRect(i ? 0 : e - 20, 0, 20, h);
      c.fillStyle = MUST; c.fillRect(0, h - 10, sd[1], 4); c.restore();
    });
    var vh = 46 * PG.scale(), vy = -vh * (1 - k); c.fillStyle = '#8f1b18'; c.fillRect(0, vy, w, vh * 0.7);
    c.fillStyle = '#8f1b18'; for (var x = 0; x < w + 30; x += 30) { c.beginPath(); c.arc(x + 15, vy + vh * 0.7, 15, 0, Math.PI); c.fill(); }
    c.strokeStyle = MUST; c.lineWidth = 3; c.beginPath(); for (x = 0; x < w + 30; x += 30) c.arc(x + 15, vy + vh * 0.7 - 2, 13, Math.PI, 0, true); c.stroke();
  } };
  PG.theme.loading = function (c, w, h, t) {
    c.fillStyle = NAVY; c.fillRect(0, 0, w, h); c.save(); c.translate(w / 2, h / 2); c.rotate(t * 2.2);
    for (var i = 0; i < 12; i++) { c.fillStyle = i % 2 ? CREAM : RED; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, 30, i * TAU / 12, (i + 1) * TAU / 12); c.closePath(); c.fill(); }
    c.restore(); c.strokeStyle = MUST; c.lineWidth = 4; c.beginPath(); c.arc(w / 2, h / 2, 32, 0, TAU); c.stroke();
  };
  function token(c, x, y, r) { c.fillStyle = NAVY; c.beginPath(); c.arc(x + 1.5, y + 2, r, 0, TAU); c.fill(); c.fillStyle = MUST; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.strokeStyle = NAVY; c.lineWidth = 1.5; c.stroke(); c.fillStyle = '#fff1c2'; star(c, x, y, r * 0.55, 5, 0.45); c.fill(); }
  function ribbon(c, x, y, w, h, col) {
    var n = h * 0.45; c.fillStyle = U.shade(col, -0.35);
    [-1, 1].forEach(function (s) { var ex = x + s * (w / 2 + n * 0.8); c.beginPath(); c.moveTo(x + s * w * 0.42, y - h * 0.3); c.lineTo(ex + s * n, y - h * 0.3); c.lineTo(ex + s * n * 0.4, y + h * 0.1); c.lineTo(ex + s * n, y + h * 0.5); c.lineTo(x + s * w * 0.42, y + h * 0.5); c.closePath(); c.fill(); c.strokeStyle = NAVY; c.lineWidth = 2; c.stroke(); });
    c.fillStyle = NAVY; c.fillRect(x - w / 2 + 3, y - h / 2 + 4, w, h); c.fillStyle = col; c.fillRect(x - w / 2, y - h / 2, w, h); c.strokeStyle = NAVY; c.lineWidth = 2; c.strokeRect(x - w / 2, y - h / 2, w, h);
  }
  function inked(c, s, x, y, size, col, o) { o = o || {}; U.text(c, s, x + size * 0.06, y + size * 0.08, size, NAVY, o.align || 'center', { shadow: false, font: o.font }); U.text(c, s, x, y, size, col, o.align || 'center', { shadow: false, font: o.font }); }

  /* ---------- screens ---------- */
  function drawHUD(c, w, h) {
    var sc = PG.scale(), th = WHEELS[st.theme], x = 18 * sc, y = 18 * sc;
    ticketCard(c, x, y, 136 * sc, 50 * sc, CREAM);
    U.text(c, 'STAGE ' + st.stage, x + 68 * sc, y + 20 * sc, 18 * sc, NAVY, 'center', { shadow: false });
    U.text(c, (st.boss ? 'BOSS ' : '') + th.n.toUpperCase(), x + 68 * sc, y + 37 * sc, U.fit(c, th.n.toUpperCase(), 9.5 * sc, 110 * sc), st.boss ? RED : TEAL, 'center', { shadow: false });
    token(c, x + 12 * sc, y + 72 * sc, 10 * sc); inked(c, PG.fmt(st.coinsRun), x + 28 * sc, y + 73 * sc, 18 * sc, CREAM, { align: 'left' });
    if (st.lives > 0) { ticketCard(c, x, y + 92 * sc, 100 * sc, 24 * sc, TEAL); U.text(c, 'CHANCE x' + st.lives, x + 50 * sc, y + 104 * sc, 10 * sc, CREAM, 'center', { shadow: false }); }
    if (st.tut && st.state === 'play') { var tw = Math.min(w * 0.8, 280 * sc), ty = geo.floor - 54 * sc; ribbon(c, w / 2, ty, tw, 34 * sc, MUST); U.text(c, 'TAP TO THROW', w / 2, ty + 1, 17 * sc, NAVY, 'center', { shadow: false }); inked(c, "don't hit other darts", w / 2, ty + 34 * sc, 11 * sc, CREAM); }
    if (st.boss && st.state === 'play' && st.introT < 1.6) { var k = PG.ease.back(Math.min(1, st.introT * 3)), a = Math.min(1, (1.6 - st.introT) * 3); c.save(); c.globalAlpha = a; c.translate(w / 2, geo.cy - geo.r - 34 * sc); c.scale(k, k); ribbon(c, 0, 0, 220 * sc, 40 * sc, RED); U.text(c, 'BOSS WHEEL!', 0, 1, 22 * sc, CREAM, 'center', { shadow: false }); c.restore(); }
    if (st.state === 'clear') {
      var kk = PG.ease.back(Math.min(1, st.clearT * 3)); c.save(); c.translate(w / 2, geo.cy - 10 * sc); c.scale(kk, kk); c.rotate(-0.04);
      ribbon(c, 0, 0, Math.min(w * 0.7, 270 * sc), 50 * sc, st.boss ? RED : TEAL); U.text(c, st.boss ? 'BOSS DOWN!' : 'STAGE CLEAR!', 0, 1, U.fit(c, 'STAGE CLEAR!', 26 * sc, Math.min(w * 0.66, 250 * sc)), CREAM, 'center', { shadow: false });
      token(c, -34 * sc, 50 * sc, 11 * sc); inked(c, '+' + st.stageBonus, -18 * sc, 51 * sc, 22 * sc, MUST, { align: 'left' }); c.restore();
    }
  }
  function drawMenu(c, w, h, t) {
    var sc = PG.scale(), land = geo.land, col = land ? w * 0.3 : w / 2;
    drawSignTitle(c, col, land ? 24 * sc : Math.max(26 * sc, h * 0.04), Math.min(land ? w * 0.42 : w * 0.82, 340 * sc), t);
    var bw = Math.min(220 * sc, w * 0.6), bh = 56 * sc, y0 = land ? h * 0.5 : h * 0.71;
    if (U.button(c, col - bw / 2, y0, bw, bh, 'Throw!', { color: RED })) PG.go(startRun);
    if (U.button(c, col - bw / 2, y0 + bh + 14 * sc, bw, bh * 0.8, 'Upgrades', { color: MUST })) { st.state = 'upgrades'; PG.track('shop_opened', { source: 'menu' }); }
    var ly = y0 + bh * 1.8 + 40 * sc; token(c, col - 40 * sc, ly, 11 * sc); inked(c, PG.fmt(PG.save.coins), col - 22 * sc, ly + 1, 19 * sc, CREAM, { align: 'left' });
    if (PG.save.best) inked(c, 'BEST STAGE ' + PG.save.best, col, ly + 26 * sc, 11 * sc, CREAM);
    U.text(c, 'MUSIC: PRO SENSORY  SOUNDS: KENNEY', w / 2, h - 22 * sc, 8.5 * sc, 'rgba(245,230,200,.75)', 'center', { shadow: false });
  }
  function drawSignTitle(c, cx, top, w, t) { // marquee sign with the title in Bungee Shade
    var sc = PG.scale(), h = w * 0.5, x = cx - w / 2;
    c.fillStyle = 'rgba(29,42,58,.3)'; c.fillRect(x + 7, top + 8, w, h); c.fillStyle = NAVY; c.fillRect(x, top, w, h);
    c.strokeStyle = MUST; c.lineWidth = 2.5; c.strokeRect(x + 7, top + 7, w - 14, h - 14);
    var n = Math.max(6, Math.round(w / (22 * sc))), step = Math.floor(t * 4);
    for (var i = 0; i <= n; i++) { bulb(c, x + i * w / n, top, 3.2 * sc, (i + step) % 2 === 0); bulb(c, x + w - i * w / n, top + h, 3.2 * sc, (i + step) % 2 === 0); }
    var m = Math.max(3, Math.round(h / (22 * sc))); for (i = 1; i < m; i++) { bulb(c, x, top + i * h / m, 3.2 * sc, (i + step) % 2 === 1); bulb(c, x + w, top + i * h / m, 3.2 * sc, (i + step) % 2 === 1); }
    var tsz = w * 0.085, bsz = w * 0.27;
    U.text(c, 'PIN  THE', cx, top + h * 0.25, tsz, CREAM, 'center', { shadow: false });
    c.save(); c.translate(cx, top + h * 0.64); c.rotate(-0.03);
    c.font = '400 ' + bsz + 'px "Bungee Shade","Bungee",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = RED; c.fillText('TAIL', 3 * sc, 4 * sc); c.fillStyle = MUST; c.fillText('TAIL', 0, 0);
    c.restore();
  }
  function drawUpgrades(c, w, h) {
    var sc = PG.scale(); c.fillStyle = 'rgba(29,42,58,.6)'; c.fillRect(0, 0, w, h);
    var pw = Math.min(w * 0.92, 440 * sc), rowH = 64 * sc, ph = 74 * sc + UPS.length * rowH + 70 * sc, px = w / 2 - pw / 2, py = Math.max(14 * sc, (h - ph) / 2);
    U.panel(c, px, py, pw, ph); U.text(c, 'UPGRADES', px + 24 * sc, py + 36 * sc, 24 * sc, NAVY, 'left', { shadow: false });
    token(c, px + pw - 88 * sc, py + 36 * sc, 10 * sc); U.text(c, PG.fmt(PG.save.coins), px + pw - 72 * sc, py + 37 * sc, 17 * sc, NAVY, 'left', { shadow: false });
    UPS.forEach(function (u, i) {
      var y = py + 62 * sc + i * rowH, L = PG.upLevel(u.id), cost = PG.upCost(u.base, u.grow, L), maxed = L >= u.max;
      c.strokeStyle = 'rgba(29,42,58,.15)'; c.lineWidth = 1; if (i) { c.beginPath(); c.moveTo(px + 18 * sc, y); c.lineTo(px + pw - 18 * sc, y); c.stroke(); }
      U.text(c, u.n.toUpperCase(), px + 22 * sc, y + 18 * sc, 13.5 * sc, NAVY, 'left', { shadow: false }); U.text(c, u.d.toUpperCase(), px + 22 * sc, y + 35 * sc, U.fit(c, u.d.toUpperCase(), 8.5 * sc, pw - 170 * sc), '#6b5a48', 'left', { shadow: false });
      for (var k = 0; k < u.max; k++) { c.fillStyle = k < L ? RED : 'rgba(29,42,58,.18)'; star(c, px + 26 * sc + k * 13 * sc, y + 50 * sc, 5 * sc, 4, 0.45, 0); c.fill(); }
      var bw = 100 * sc, bh = 40 * sc, bx = px + pw - bw - 22 * sc;
      if (maxed) U.text(c, 'MAX', bx + bw / 2, y + 28 * sc, 17 * sc, TEAL, 'center', { shadow: false });
      else if (U.button(c, bx, y + 10 * sc, bw, bh, '' + cost, { color: PG.save.coins >= cost ? MUST : '#d8ccb4', size: 17 * sc })) PG.buyUp(u.id, cost, u.max);
    });
    if (U.button(c, w / 2 - 85 * sc, py + ph - 58 * sc, 170 * sc, 44 * sc, 'Back', { color: TEAL })) st.state = 'menu';
  }
  function drawDead(c, w, h) {
    var sc = PG.scale(), k = PG.ease.out(Math.min(1, Math.max(0, st.deadT - 0.35) * 2.2)); if (k <= 0) return; c.fillStyle = 'rgba(29,42,58,' + 0.55 * k + ')'; c.fillRect(0, 0, w, h);
    var canAd = !st.usedCont && PG.rewardedSupported(), pw = Math.min(w * 0.88, 370 * sc), ph = (canAd ? 360 : 300) * sc, px = w / 2 - pw / 2, py = h * 0.5 - ph / 2 + (1 - k) * 70;
    U.panel(c, px, py, pw, ph);
    U.text(c, 'OUCH!', w / 2, py + 40 * sc, 30 * sc, RED, 'center', { shadow: false }); U.text(c, 'DART ON DART', w / 2, py + 66 * sc, 11 * sc, '#6b5a48', 'center', { shadow: false });
    c.save(); c.font = '400 ' + 42 * sc + 'px "Bungee Shade","Bungee",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = NAVY; c.fillText('STAGE ' + st.stage, w / 2, py + 108 * sc); c.restore();
    U.text(c, st.bestHit ? 'NEW BEST!' : 'BEST STAGE ' + (PG.save.best || 0), w / 2, py + 142 * sc, 12 * sc, st.bestHit ? TEAL : '#6b5a48', 'center', { shadow: false });
    token(c, w / 2 - 40 * sc, py + 170 * sc, 11 * sc); U.text(c, '+' + (Math.round(st.coinsRun * 10) / 10), w / 2 - 22 * sc, py + 171 * sc, 20 * sc, NAVY, 'left', { shadow: false });
    var bw = pw * 0.8, bh = 46 * sc, yy = py + 196 * sc;
    if (canAd) { if (U.button(c, w / 2 - bw / 2, yy, bw, bh, 'Ad: retry stage', { color: TEAL, size: 15 * sc })) PG.rewarded('continue').then(function (ok) { if (ok) { st.usedCont = true; st.hurtPin = null; PG.playing = true; newStage(); PG.track('rewarded_continue', { step_id: 'stage' }); } }); yy += bh + 10 * sc; }
    if (U.button(c, w / 2 - bw / 2, yy, bw, bh, 'Play again', { color: RED })) PG.interstitial('game_over').then(function () { PG.go(startRun); });
    if (U.button(c, w / 2 - bw / 2, yy + bh + 10 * sc, bw / 2 - 5 * sc, bh * 0.85, 'Upgrades', { color: MUST, size: 13 * sc })) PG.go(function () { toMenu(); st.state = 'upgrades'; PG.track('shop_opened', { source: 'game_over' }); });
    if (U.button(c, w / 2 + 5 * sc, yy + bh + 10 * sc, bw / 2 - 5 * sc, bh * 0.85, 'Menu', { color: CREAM, size: 13 * sc })) PG.go(toMenu);
  }
  function toMenu() { st.state = 'menu'; st.stage = 1; st.theme = 0; st.boss = false; st.left = 0; st.fly = []; st.hurtPin = null; st.scaleIn = 0; decorate(); }
  function decorate() { st.pins = [{ a: 20, w: 0, c: RED }, { a: 140, w: 0, c: TEAL }, { a: 255, w: 0, c: MUST }]; st.apples = [{ a: 80, c: TEAL }, { a: 200, c: RED }]; }

  function render(c, w, h) {
    layout(w, h); var t = PG.time, inGame = st.state !== 'menu' && st.state !== 'upgrades';
    c.save(); if (st.shakeV > 0.2) c.translate((Math.random() - 0.5) * st.shakeV, (Math.random() - 0.5) * st.shakeV);
    drawBG(c, w, h, t);
    drawTarget(c, t);
    if (inGame) {
      drawStash(c, w, h);
      st.fly.forEach(function (f) { drawFlyDart(c, geo.cx, f.y, f.c, geo.r * 0.55); });
      if (st.hurtPin) { c.save(); c.translate(st.hurtPin.x, st.hurtPin.y); c.rotate(st.hurtPin.rot - Math.PI / 2); drawDart(c, st.hurtPin.c, geo.r * 0.55); c.restore(); }
    }
    PG.drawParts(c); PG.drawPops(c); c.restore();
    if (st.hurt > 0) { c.fillStyle = 'rgba(214,73,51,' + st.hurt * 0.35 + ')'; c.fillRect(0, 0, w, h); }
    drawMarquee(c, w, h, t);
    PG.grain(c, w, h, 0.06, { mode: 'multiply' });
    if (st.state === 'play' || st.state === 'clear') drawHUD(c, w, h); else if (st.state === 'menu') drawMenu(c, w, h, t); else if (st.state === 'upgrades') drawUpgrades(c, w, h); else if (st.state === 'dead') { drawHUD(c, w, h); drawDead(c, w, h); }
  }
  PG.onDown = function () { if (st.state === 'play' && !PG.userPaused) throwPin(); };
  PG.setup(document.getElementById('c'), update, render);
  window.__pin = { st: st, throwPin: throwPin, start: startRun, geo: geo, update: update, stick: stick };
  decorate();
  PG.init({ id: 'pin_the_tail', version: '1.1.0', defaults: { best: 0, coins: 0, runs: 0, up: {}, muted: false } }).then(function () {
    PG.music(); layout(PG.w, PG.h); st.scaleIn = 0; st.nextC = RED;
  });
})();
