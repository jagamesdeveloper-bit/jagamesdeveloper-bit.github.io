/* PIN THE TAIL - toss darts into a spinning target. Never hit a dart that is already stuck. Bosses reverse the spin. */
(function () {
  'use strict';
  var U = PG.ui, TAU = 6.2832, D2R = Math.PI / 180;
  var THEMES = [
    { n: 'Log', c1: '#c68b59', c2: '#8d5a2b', ring: '#7a4a22', bg: ['#7ec8e3', '#e8f6ff'], dec: '#ffffff' },
    { n: 'Cheese', c1: '#ffd966', c2: '#e6a817', ring: '#d49a10', bg: ['#ff9a8b', '#ffe1c6'], dec: '#fff3b0' },
    { n: 'Pumpkin', c1: '#ff9f43', c2: '#d9650d', ring: '#bf5a0a', bg: ['#6a4c93', '#f6b26b'], dec: '#ffd9a0' },
    { n: 'Donut', c1: '#f78fb3', c2: '#c44569', ring: '#a63a58', bg: ['#a1e3d8', '#fff0f5'], dec: '#ffffff' },
    { n: 'Cookie', c1: '#d9a066', c2: '#a0642d', ring: '#7b4a1e', bg: ['#2d3561', '#c05c7e'], dec: '#ffd1dc' },
    { n: 'Pizza', c1: '#f4c26b', c2: '#d98324', ring: '#bf2f1f', bg: ['#fbc687', '#fff1e0'], dec: '#ffffff' }
  ];
  var UPS = [
    { id: 'slow', n: 'Steady Spin', d: 'Targets spin 4% slower', max: 8, base: 30, grow: 1.5 },
    { id: 'wide', n: 'Slim Darts', d: 'Smaller dart hitbox', max: 6, base: 40, grow: 1.6 },
    { id: 'apple', n: 'Apple Orchard', d: 'More apples on targets', max: 5, base: 35, grow: 1.6 },
    { id: 'coins', n: 'Coin Magnet', d: '+20% coins per stage', max: 8, base: 45, grow: 1.6 },
    { id: 'life', n: 'Second Chance', d: 'Forgive one bad toss per run', max: 2, base: 150, grow: 2.5 }
  ];
  var st = { state: 'menu', stage: 1, pins: [], apples: [], left: 0, fly: [], rot: 0, vel: 0, pat: 'const', patT: 0, base: 70, dir: 1, clearT: 0, hurt: 0, coinsRun: 0, lives: 0, usedCont: false, deadT: 0, boss: false, spawnT: 0, scaleIn: 1, recoil: 0, runIdx: 0, bestHit: false, total: 0, tut: true, theme: 0 };
  var geo = { cx: 0, cy: 0, r: 100, ky: 0 };
  var bgShapes = []; for (var i = 0; i < 14; i++) bgShapes.push({ x: Math.random(), y: Math.random(), s: 0.3 + Math.random(), p: Math.random() * 9 });

  function minSep() { return (11 - PG.upLevel('wide') * 0.9); }
  function stageSpec(n) {
    var boss = n % 5 === 0;
    return { boss: boss, need: Math.min(5 + Math.floor(n / 2), 13) + (boss ? 2 : 0), stuck: Math.min(1 + Math.floor(n / 3), 7), speed: Math.min(60 + n * 4.5, 170) * (boss ? 0.9 : 1), pat: boss ? 'flip' : ['const', 'const', 'sine', 'pulse', 'flip'][Math.min(4, Math.floor(PG.rand(0, 1 + Math.min(4, n / 3))))] };
  }
  function angDiff(a, b) { var d = ((a - b) % 360 + 540) % 360 - 180; return Math.abs(d); }
  function newStage() {
    var sp = stageSpec(st.stage); st.boss = sp.boss; st.left = sp.need; st.pat = sp.pat; st.base = sp.speed * Math.pow(0.96, PG.upLevel('slow')); st.dir = Math.random() < 0.5 ? 1 : -1; st.pins = []; st.apples = []; st.fly = []; st.rot = Math.random() * 360; st.patT = 0; st.vel = st.base * st.dir;
    st.theme = Math.floor((st.stage - 1) / 1) % THEMES.length; st.scaleIn = 0; st.state = 'play'; st.clearT = 0;
    var tries = 0; while (st.pins.length < sp.stuck && tries++ < 200) { var a = PG.rand(0, 360); if (st.pins.every(function (p) { return angDiff(p.a, a) > minSep() * 2.4; })) st.pins.push({ a: a, w: 0, c: PG.pick(['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93']) }); }
    var na = Math.random() < 0.4 + PG.upLevel('apple') * 0.12 ? (1 + (PG.upLevel('apple') > 2 && Math.random() < 0.4 ? 1 : 0)) : 0; tries = 0;
    while (st.apples.length < na && tries++ < 200) { var b = PG.rand(0, 360); if (st.pins.every(function (p) { return angDiff(p.a, b) > minSep() * 2 + 8; }) && st.apples.every(function (p) { return angDiff(p.a, b) > 30; })) st.apples.push({ a: b }); }
    PG.msg('level_started', { level: String(st.stage) }); PG.track('progression_started', { step_id: 'stage', step_index: Math.min(st.stage, 60) });
  }
  function startRun() { st.stage = 1; st.coinsRun = 0; st.lives = PG.upLevel('life'); st.usedCont = false; st.runIdx++; st.bestHit = false; st.tut = !PG.save.runs; st.deadT = 0; PG.playing = true; PG.parts = []; newStage(); PG.track('progression_started', { step_id: 'run', step_index: Math.min(st.runIdx, 50) }); }
  function throwPin() {
    if (st.state !== 'play' || st.left <= 0 || st.scaleIn < 0.8) return;
    if (st.fly.length >= 3) return;
    st.left--; st.fly.push({ y: geo.ky, c: PG.pick(['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93']) }); st.tut = false; PG.sfx('shoot', 1 + Math.random() * 0.1);
  }
  function stick(f) {
    var a = ((90 - st.rot) % 360 + 360) % 360, fail = false;
    for (var i = 0; i < st.pins.length; i++) if (angDiff(st.pins[i].a, a) < minSep()) { fail = true; break; }
    for (i = 0; i < st.fly.length; i++) { /* flying pins don't collide */ }
    if (fail) {
      if (st.lives > 0) { st.lives--; st.hurt = 0.6; PG.sfx('err'); PG.popText(geo.cx, geo.cy + geo.r + 20, 'Second chance!', '#9be564', 22); st.left++; st.hurtPin = { x: geo.cx, y: geo.cy + geo.r, vy: 600, rot: 0, t: 0, c: f.c }; shake(8); return; }
      st.hurtPin = { x: geo.cx, y: geo.cy + geo.r, vy: 500, rot: 0, t: 0, c: f.c }; shake(14); PG.sfx('hit'); PG.burst(geo.cx, geo.cy + geo.r, 14, { colors: ['#fff', f.c] }); die(); return;
    }
    st.pins.push({ a: a, w: 1, c: f.c }); st.recoil = 1; PG.sfx('hit', 1 + (st.pins.length % 5) * 0.08); PG.vibrate(8);
    PG.burst(geo.cx, geo.cy + geo.r, 6, { colors: [THEMES[st.theme].c1, '#fff'], g: 400 });
    for (i = st.apples.length - 1; i >= 0; i--) if (angDiff(st.apples[i].a, a) < 13) { st.apples.splice(i, 1); var v = 2; st.coinsRun += v; PG.save.coins += v; PG.sfx('coin'); PG.popText(geo.cx, geo.cy + geo.r + 30, '+2 apple!', '#ffd23f', 24); PG.burst(geo.cx, geo.cy + geo.r, 14, { colors: ['#ff4d4d', '#9be564'] }); }
    if (st.left <= 0 && st.fly.length === 0) clearStage();
  }
  function shake(n) { st.shakeV = n; }
  function clearStage() {
    st.state = 'clear'; st.clearT = 0; var bonus = (1 + (st.boss ? 4 : 0)) * (1 + 0.2 * PG.upLevel('coins')); bonus = Math.round(bonus * 10) / 10;
    st.coinsRun += bonus; PG.save.coins = Math.round((PG.save.coins + bonus) * 10) / 10; st.stageBonus = bonus; st.total++;
    PG.sfx('win'); PG.track('progression_completed', { step_id: 'stage', step_index: Math.min(st.stage, 60), boss: st.boss });
    PG.msg('level_completed', { level: String(st.stage) });
    st.pins.forEach(function (p) { var a = (p.a + st.rot) * D2R; PG.burst(geo.cx + Math.cos(a) * geo.r, geo.cy + Math.sin(a) * geo.r, 4, { colors: [p.c], g: 500, min: 100, max: 400 }); });
    PG.burst(geo.cx, geo.cy, 40, { colors: [THEMES[st.theme].c1, THEMES[st.theme].c2, '#fff'], g: 500, min: 100, max: 500, s0: 4, s1: 10, shape: 's' });
    if (st.stage > (PG.save.best || 0)) { PG.save.best = st.stage; st.bestHit = true; } PG.commit();
  }
  function die() {
    st.state = 'dead'; st.deadT = 0; PG.playing = false; PG.sfx('lose'); PG.save.runs = (PG.save.runs || 0) + 1; PG.commit(true);
    PG.track('progression_failed', { step_id: 'stage', step_index: Math.min(st.stage, 60), boss: st.boss }); PG.msg('level_failed', { level: String(st.stage) });
  }
  function layout(w, h) {
    var portrait = h >= w * 0.9; geo.r = Math.min(w * (portrait ? 0.27 : 0.2), h * 0.2); geo.cx = w / 2; geo.cy = h * (portrait ? 0.36 : 0.4); geo.ky = h - Math.max(70, h * 0.09);
  }

  /* ---------- update ---------- */
  function update(dt) {
    PG.updateParts(dt); PG.updatePops(dt); st.shakeV = Math.max(0, (st.shakeV || 0) - dt * 40); st.hurt = Math.max(0, st.hurt - dt);
    if (st.recoil > 0) st.recoil = Math.max(0, st.recoil - dt * 4);
    if (PG.keyHit(' ') || PG.keyHit('enter') || PG.keyHit('arrowup')) throwPin();
    st.pins.forEach(function (p) { if (p.w > 0) p.w = Math.max(0, p.w - dt * 1.8); });
    if (st.hurtPin) { st.hurtPin.y += st.hurtPin.vy * dt; st.hurtPin.vy += 1500 * dt; st.hurtPin.rot += dt * 10; if (st.hurtPin.y > PG.h + 80) st.hurtPin = null; }
    if (st.state === 'menu') { st.rot += 40 * dt; st.scaleIn = Math.min(1, st.scaleIn + dt * 3); return; }
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
      st.clearT += dt; if (st.clearT > 1.1) { st.stage++; newStage(); }
    }
  }

  /* ---------- drawing ---------- */
  function drawBG(c, w, h, t) {
    var th = THEMES[st.theme]; var g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, th.bg[0]); g.addColorStop(1, th.bg[1]); c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = th.dec; c.globalAlpha = 0.18; bgShapes.forEach(function (b) { var x = (b.x + Math.sin(t * 0.2 + b.p) * 0.03) * w, y = ((b.y + t * 0.01 * b.s) % 1) * h; c.beginPath(); c.arc(x, y, 14 + b.s * 26, 0, TAU); c.fill(); }); c.globalAlpha = 1;
    var rg = c.createRadialGradient(geo.cx, geo.cy, geo.r * 0.5, geo.cx, geo.cy, geo.r * 3.2); rg.addColorStop(0, 'rgba(255,255,255,.35)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = rg; c.fillRect(0, 0, w, h);
    // stand
    c.fillStyle = 'rgba(0,0,0,.12)'; c.beginPath(); c.ellipse(geo.cx, geo.cy + geo.r * 1.25, geo.r * 0.9, geo.r * 0.12, 0, 0, TAU); c.fill();
  }
  function drawTarget(c, t) {
    var th = THEMES[st.theme], r = geo.r, sc = PG.ease.back(Math.min(1, st.scaleIn)) * (1 - st.recoil * 0.05); var exp = st.state === 'clear' ? Math.max(0, 1 - st.clearT * 6) : 1;
    if (exp <= 0) return;
    c.save(); c.translate(geo.cx, geo.cy + st.recoil * 6); c.scale(sc * exp, sc * exp);
    // pins behind (stuck pins draw under the target edge so the tip is hidden)
    c.save(); c.rotate(st.rot * D2R);
    st.pins.forEach(function (p) { c.save(); c.rotate(p.a * D2R); c.translate(r * 1.0, 0); c.rotate(Math.sin(t * 40) * p.w * 0.08); drawPinSide(c, p.c, r, 1); c.restore(); });
    c.restore();
    c.save(); c.rotate(st.rot * D2R);
    var gr = c.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r); gr.addColorStop(0, th.c1); gr.addColorStop(1, th.c2); c.fillStyle = gr; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
    c.strokeStyle = th.ring; c.lineWidth = r * 0.04; c.beginPath(); c.arc(0, 0, r * 0.97, 0, TAU); c.stroke();
    var k = st.theme;
    if (k === 0) { c.lineWidth = r * 0.02; c.globalAlpha = 0.5; for (var i = 1; i < 6; i++) { c.beginPath(); c.arc(0, 0, r * i * 0.15, 0, TAU); c.stroke(); } c.beginPath(); c.moveTo(0, 0); c.lineTo(r * 0.8, r * 0.1); c.moveTo(0, 0); c.lineTo(-r * 0.5, -r * 0.6); c.stroke(); c.globalAlpha = 1; }
    else if (k === 1) { c.fillStyle = th.ring; [[0.3, 0.2, 0.14], [-0.4, 0.3, 0.1], [0.1, -0.5, 0.12], [-0.2, -0.2, 0.07], [0.55, -0.3, 0.08]].forEach(function (h) { c.globalAlpha = 0.55; c.beginPath(); c.arc(h[0] * r, h[1] * r, h[2] * r, 0, TAU); c.fill(); }); c.globalAlpha = 1; }
    else if (k === 2) { c.strokeStyle = th.ring; c.lineWidth = r * 0.03; for (i = 0; i < 6; i++) { c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(r * 0.55 * Math.cos(i * 1.047 + 0.4), r * 0.55 * Math.sin(i * 1.047 + 0.4), r * Math.cos(i * 1.047), r * Math.sin(i * 1.047)); c.stroke(); } c.fillStyle = '#4a7c2a'; c.fillRect(-r * 0.05, -r * 0.1, r * 0.1, r * 0.2); }
    else if (k === 3) { c.fillStyle = '#7ec8e3'; c.beginPath(); c.arc(0, 0, r * 0.28, 0, TAU); c.fill(); c.fillStyle = THEMES[3].bg[1]; c.beginPath(); c.arc(0, 0, r * 0.26, 0, TAU); c.fill(); var sp = ['#ffe066', '#8ac926', '#1982c4', '#fff']; for (i = 0; i < 18; i++) { var a = i * 0.7, rr0 = r * (0.45 + (i % 4) * 0.12); c.fillStyle = sp[i % 4]; c.save(); c.translate(Math.cos(a * 3) * rr0, Math.sin(a * 3) * rr0); c.rotate(a); c.fillRect(-r * 0.05, -r * 0.015, r * 0.1, r * 0.03); c.restore(); } }
    else if (k === 4) { c.fillStyle = '#4a2c17'; [[0.3, 0.3], [-0.35, 0.1], [0.05, -0.45], [-0.2, 0.5], [0.5, -0.2], [-0.5, -0.4]].forEach(function (h) { c.beginPath(); c.arc(h[0] * r, h[1] * r, r * 0.09, 0, TAU); c.fill(); }); }
    else { c.fillStyle = '#d63a2b'; for (i = 0; i < 8; i++) { var a2 = i * 0.8; c.beginPath(); c.arc(Math.cos(a2 * 2.3) * r * 0.5, Math.sin(a2 * 2.3) * r * 0.5, r * 0.11, 0, TAU); c.fill(); } c.fillStyle = '#7bc043'; for (i = 0; i < 5; i++) { c.fillRect(Math.cos(i * 1.3) * r * 0.65, Math.sin(i * 1.3) * r * 0.65, r * 0.06, r * 0.04); } }
    if (st.boss) { c.strokeStyle = '#c0392b'; c.lineWidth = r * 0.05; c.setLineDash([r * 0.12, r * 0.08]); c.beginPath(); c.arc(0, 0, r * 0.9, 0, TAU); c.stroke(); c.setLineDash([]); }
    // apples
    st.apples.forEach(function (ap) { c.save(); c.rotate(ap.a * D2R); c.translate(r * 0.78, 0); c.rotate(Math.PI / 2); c.fillStyle = '#e63946'; c.beginPath(); c.arc(0, 0, r * 0.13, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.arc(-r * 0.04, -r * 0.04, r * 0.04, 0, TAU); c.fill(); c.fillStyle = '#4caf50'; c.beginPath(); c.ellipse(r * 0.04, -r * 0.14, r * 0.06, r * 0.03, 0.5, 0, TAU); c.fill(); c.restore(); });
    c.restore(); c.restore();
  }
  function drawPinSide(c, col, r, a) { // pin sticking radially out of the target (x axis = out)
    c.fillStyle = '#d7dde8'; c.fillRect(-r * 0.05, -r * 0.012, r * 0.28, r * 0.024); // metal shaft
    c.fillStyle = col; c.beginPath(); c.moveTo(r * 0.23, 0); c.lineTo(r * 0.42, -r * 0.075); c.lineTo(r * 0.5, -r * 0.075); c.lineTo(r * 0.4, 0); c.lineTo(r * 0.5, r * 0.075); c.lineTo(r * 0.42, r * 0.075); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.4)'; c.fillRect(r * 0.26, -r * 0.01, r * 0.2, r * 0.02);
    c.fillStyle = '#2b2d42'; c.beginPath(); c.arc(r * 0.5, 0, r * 0.035, 0, TAU); c.fill();
  }
  function drawFlyPin(c, x, y, col) { var r = geo.r; c.save(); c.translate(x, y); c.rotate(Math.PI / 2); drawPinSide(c, col, r, 1); c.restore(); }
  function drawStash(c, w, h, t) {
    var sc = PG.scale(), n = st.left, r = geo.r, x0 = w / 2; var showN = Math.min(n, 13);
    c.save(); var bx = w / 2, by = geo.ky;
    // launcher + the next pin
    if (st.state === 'play' && n > 0) { drawFlyPin(c, bx, by + 6 * (1 - Math.min(1, 1)), '#ff595e'); }
    var sw = Math.min(26 * sc, (w - 40) / 13); for (var i = 0; i < showN; i++) { var x = w / 2 - (showN - 1) * sw / 2 + i * sw, yy = h - 30 * sc; c.fillStyle = '#fff'; c.globalAlpha = 0.9; c.beginPath(); c.arc(x, yy, 7 * sc, 0, TAU); c.fill(); c.fillStyle = '#ff595e'; c.beginPath(); c.arc(x, yy, 4.5 * sc, 0, TAU); c.fill(); c.globalAlpha = 1; }
    c.restore();
  }
  function hit(x, y, w, h) { var I = PG.input; if (I.released && PG.inRect(x, y, w, h) && PG.inRect(x, y, w, h, I.px, I.py)) { I.released = false; PG.sfx('tap'); return true; } return false; }
  function drawHUD(c, w, h) {
    var sc = PG.scale();
    U.text(c, 'Stage ' + st.stage, 16 * sc, 30 * sc, 32 * sc, '#fff', 'left', { stroke: 'rgba(0,0,0,.35)' });
    U.text(c, st.boss ? 'BOSS: ' + THEMES[st.theme].n : THEMES[st.theme].n, 16 * sc, 58 * sc, 15 * sc, st.boss ? '#ffd23f' : '#fff', 'left');
    U.coin(c, 24 * sc, 84 * sc, 10 * sc); U.text(c, PG.fmt(st.coinsRun), 40 * sc, 85 * sc, 20 * sc, '#ffe066', 'left', { stroke: 'rgba(0,0,0,.35)' });
    if (st.lives > 0) U.text(c, 'Chance x' + st.lives, 16 * sc, 110 * sc, 14 * sc, '#b9f6ca', 'left');
    if (st.tut && st.state === 'play') { c.globalAlpha = 0.7 + 0.3 * Math.sin(PG.time * 4); U.text(c, 'TAP to throw - avoid other darts!', w / 2, geo.cy + geo.r + 70 * sc, 18 * sc, '#fff', 'center', { stroke: 'rgba(0,0,0,.45)' }); c.globalAlpha = 1; }
    if (st.state === 'clear') { var k = Math.min(1, st.clearT * 3); c.globalAlpha = k; U.text(c, st.boss ? 'BOSS DOWN!' : 'Stage clear!', w / 2, geo.cy - 8, 38 * sc * (0.7 + k * 0.3), '#ffd23f', 'center', { stroke: 'rgba(0,0,0,.5)' }); U.text(c, '+' + st.stageBonus + ' coins', w / 2, geo.cy + 34 * sc, 20 * sc, '#fff', 'center'); c.globalAlpha = 1; }
  }
  function drawMenu(c, w, h, t) {
    var sc = PG.scale(); c.fillStyle = 'rgba(10,20,40,.2)'; c.fillRect(0, 0, w, h);
    U.text(c, 'PIN THE', w / 2, h * 0.09, Math.min(54 * sc, w * 0.14), '#fff', 'center', { stroke: '#1d3557' });
    U.text(c, 'TAIL', w / 2, h * 0.09 + 52 * sc, Math.min(64 * sc, w * 0.17), '#ffd23f', 'center', { stroke: '#8a5a00' });
    var bw = 220 * sc, bh = 60 * sc, y0 = h * 0.72;
    if (U.button(c, w / 2 - bw / 2, y0, bw, bh, 'Throw!', { color: '#e63946' })) startRun();
    if (U.button(c, w / 2 - bw / 2, y0 + bh + 12 * sc, bw, bh * 0.8, 'Upgrades', { color: '#ff9f1c' })) { st.state = 'upgrades'; PG.track('shop_opened', { source: 'menu' }); }
    U.coin(c, w / 2 - 30 * sc, h - 26 * sc, 11 * sc); U.text(c, PG.fmt(PG.save.coins) + (PG.save.best ? '   Best stage ' + PG.save.best : ''), w / 2 - 14 * sc, h - 25 * sc, 17 * sc, '#fff', 'left');
  }
  function drawUpgrades(c, w, h) {
    var sc = PG.scale(); c.fillStyle = 'rgba(8,14,30,.72)'; c.fillRect(0, 0, w, h);
    var pw = Math.min(w * 0.94, 440 * sc), px = w / 2 - pw / 2, py = 24 * sc, rowH = 66 * sc, ph = 70 * sc + UPS.length * rowH + 76 * sc;
    U.panel(c, px, py, pw, ph); U.text(c, 'Upgrades', w / 2, py + 34 * sc, 30 * sc, '#ffd23f', 'center'); U.coin(c, px + pw - 80 * sc, py + 34 * sc, 11 * sc); U.text(c, PG.fmt(PG.save.coins), px + pw - 64 * sc, py + 35 * sc, 20 * sc, '#ffe066', 'left');
    UPS.forEach(function (u, i) {
      var y = py + 62 * sc + i * rowH, L = PG.upLevel(u.id), cost = PG.upCost(u.base, u.grow, L), maxed = L >= u.max;
      U.text(c, u.n, px + 18 * sc, y + 18 * sc, 18 * sc, '#fff', 'left'); U.text(c, u.d, px + 18 * sc, y + 38 * sc, 13 * sc, '#cbd5e1', 'left', { shadow: false });
      for (var k = 0; k < u.max; k++) { c.fillStyle = k < L ? '#9be564' : 'rgba(255,255,255,.2)'; c.beginPath(); c.arc(px + 22 * sc + k * 11 * sc, y + 54 * sc, 4 * sc, 0, TAU); c.fill(); }
      var bw = 104 * sc, bh = 44 * sc, bx = px + pw - bw - 14 * sc;
      if (maxed) U.text(c, 'MAX', bx + bw / 2, y + 28 * sc, 18 * sc, '#9be564', 'center');
      else if (U.button(c, bx, y + 8 * sc, bw, bh, cost + '', { color: PG.save.coins >= cost ? '#2ec4b6' : '#8a8f98', size: 20 * sc })) PG.buyUp(u.id, cost, u.max);
    });
    if (U.button(c, w / 2 - 90 * sc, py + ph - 62 * sc, 180 * sc, 48 * sc, 'Back', { color: '#ff9f1c' })) st.state = 'menu';
  }
  function drawDead(c, w, h) {
    var sc = PG.scale(), k = PG.ease.out(Math.min(1, st.deadT * 2)); st.deadT += 0.016; c.fillStyle = 'rgba(8,14,30,' + 0.55 * k + ')'; c.fillRect(0, 0, w, h);
    var pw = Math.min(w * 0.88, 380 * sc), ph = 370 * sc, px = w / 2 - pw / 2, py = h * 0.5 - ph / 2 + (1 - k) * 60;
    U.panel(c, px, py, pw, ph); U.text(c, 'Ouch! Pin collision', w / 2, py + 36 * sc, 25 * sc, '#ffd23f', 'center');
    U.text(c, 'Stage ' + st.stage, w / 2, py + 88 * sc, 48 * sc, '#fff', 'center'); U.text(c, st.bestHit ? 'NEW BEST!' : 'Best stage ' + (PG.save.best || 0), w / 2, py + 128 * sc, 18 * sc, st.bestHit ? '#9be564' : '#cbd5e1', 'center');
    U.coin(c, w / 2 - 50 * sc, py + 162 * sc, 12 * sc); U.text(c, '+' + (Math.round(st.coinsRun * 10) / 10), w / 2 - 32 * sc, py + 163 * sc, 24 * sc, '#ffe066', 'left');
    var bw = pw * 0.84, bh = 50 * sc, yy = py + 190 * sc;
    if (!st.usedCont && PG.rewardedSupported()) { if (U.button(c, w / 2 - bw / 2, yy, bw, bh, 'Watch ad: retry this stage', { color: '#8338ec', size: 17 * sc })) PG.rewarded('continue').then(function (ok) { if (ok) { st.usedCont = true; st.hurtPin = null; PG.playing = true; newStage(); PG.track('rewarded_continue', { step_id: 'stage' }); } }); yy += bh + 10 * sc; }
    if (U.button(c, w / 2 - bw / 2, yy, bw, bh, 'Play again', { color: '#e63946' })) PG.interstitial('game_over').then(function () { startRun(); });
    if (U.button(c, w / 2 - bw / 2, yy + bh + 10 * sc, bw / 2 - 5 * sc, bh * 0.85, 'Upgrades', { color: '#ff9f1c', size: 16 * sc })) { st.state = 'upgrades'; PG.track('shop_opened', { source: 'game_over' }); }
    if (U.button(c, w / 2 + 5 * sc, yy + bh + 10 * sc, bw / 2 - 5 * sc, bh * 0.85, 'Menu', { color: '#5c6bc0', size: 16 * sc })) { st.state = 'menu'; st.stage = 1; st.theme = 0; st.pins = []; st.apples = []; st.left = 0; st.scaleIn = 0; }
  }

  function render(c, w, h, dt) {
    layout(w, h); var t = PG.time;
    c.save(); if (st.shakeV > 0.2) c.translate((Math.random() - 0.5) * st.shakeV, (Math.random() - 0.5) * st.shakeV);
    drawBG(c, w, h, t);
    drawTarget(c, t);
    if (st.state !== 'menu' && st.state !== 'upgrades') {
      drawStash(c, w, h, t);
      st.fly.forEach(function (f) { drawFlyPin(c, geo.cx, f.y, f.c); });
      if (st.hurtPin) { c.save(); c.translate(st.hurtPin.x, st.hurtPin.y); c.rotate(st.hurtPin.rot); c.rotate(Math.PI / 2); drawPinSide(c, st.hurtPin.c, geo.r, 1); c.restore(); }
    }
    PG.drawParts(c); PG.drawPops(c); c.restore();
    if (st.hurt > 0) { c.fillStyle = 'rgba(255,60,60,' + st.hurt * 0.4 + ')'; c.fillRect(0, 0, w, h); }
    if (st.state === 'play' || st.state === 'clear') drawHUD(c, w, h); else if (st.state === 'menu') drawMenu(c, w, h, t); else if (st.state === 'upgrades') drawUpgrades(c, w, h); else if (st.state === 'dead') { drawHUD(c, w, h); drawDead(c, w, h); }
  }
  PG.onDown = function (x, y) { if (x > PG.w - 130 * PG.scale() && y < 70 * PG.scale()) return; if (st.state === 'play' && !PG.userPaused) throwPin(); };
  PG.setup(document.getElementById('c'), update, render);
  window.__pin = { st: st, throwPin: throwPin, start: startRun, geo: geo };
  PG.init({ id: 'pin_the_tail', version: '1.0.0', defaults: { best: 0, coins: 0, runs: 0, up: {}, muted: false } }).then(function () {
    PG.music({ scale: [0, 2, 4, 7, 9], root: 262, bpm: 112, wave: 'triangle', vol: 0.05, bass: 0.09 });
    layout(PG.w, PG.h); st.scaleIn = 0;
  });
})();
