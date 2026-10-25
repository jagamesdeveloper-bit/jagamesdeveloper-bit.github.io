/* SKYLINE SNAP - drop swinging floors onto your tower. Trim the overhang, land perfectly, reach the stars. */
(function () {
  'use strict';
  var U = PG.ui, TAU = 6.2832, VW = 400, FH = 30, BASE_W = 150;
  var UPS = [
    { id: 'mortar', n: 'Sticky Mortar', d: 'Bigger perfect zone', max: 8, base: 20, grow: 1.5 },
    { id: 'found', n: 'Wide Foundation', d: '+6% starting width', max: 8, base: 30, grow: 1.5 },
    { id: 'slow', n: 'Slow Crane', d: 'Crane swings 5% slower', max: 8, base: 25, grow: 1.5 },
    { id: 'net', n: 'Safety Net', d: 'Forgive a miss once per run', max: 3, base: 90, grow: 2.4 },
    { id: 'shield', n: 'Wind Shield', d: 'Wind pushes 12% less', max: 6, base: 40, grow: 1.6 },
    { id: 'coin', n: 'Gold Bricks', d: '+15% coins', max: 8, base: 30, grow: 1.5 }
  ];
  var THEMES = [ // floor palettes
    ['#e76f51', '#c4553b'], ['#2a9d8f', '#1f7a6f'], ['#e9c46a', '#c9a24a'], ['#8d99ae', '#6b7689'], ['#f4a261', '#d4813f'], ['#9b5de5', '#7a40c0'], ['#00bbf9', '#0093c4'], ['#f15bb5', '#cc3f96']
  ];
  var st = { state: 'menu', floors: [], cur: null, x: 0, dir: 1, t: 0, falling: null, cut: [], combo: 0, perfects: 0, coinsRun: 0, camY: 0, over: false, overT: 0, netLeft: 0, revUsed: false, doubled: false, runIdx: 0, sway: 0, wind: 0, windT: 0, squash: 0, shake: 0, newBest: false, perfectFx: [], banner: null, tut: true };
  var scale = 1, clouds = [], stars = [], birds = []; for (var i = 0; i < 8; i++) clouds.push({ x: Math.random() * 500 - 50, y: Math.random() * 1400, s: 0.6 + Math.random(), v: 4 + Math.random() * 6 });
  for (i = 0; i < 90; i++) stars.push({ x: Math.random(), y: Math.random(), r: Math.random() * 1.6 + 0.3, p: Math.random() * 9 });
  for (i = 0; i < 4; i++) birds.push({ x: Math.random() * 400, y: 60 + Math.random() * 300, v: 12 + Math.random() * 14, p: Math.random() * 9 });

  function up(id) { return PG.upLevel(id); }
  function tol() { return 5 + 1.6 * up('mortar'); }
  function swingSpeed() { return Math.min(330, 120 + st.floors.length * 3.6) * (1 - 0.05 * up('slow')); }
  function startRun() {
    st.state = 'play'; var w0 = Math.min(BASE_W * (1 + 0.06 * up('found')), 230); st.floors = [{ x: 0, w: w0, i: 0 }]; st.combo = 0; st.perfects = 0; st.coinsRun = 0; st.over = false; st.cut = []; st.falling = null; st.netLeft = up('net'); st.revUsed = false; st.doubled = false; st.runIdx++; st.t = 0; st.camY = 0; st.newBest = false; st.banner = null; st.wind = 0; st.squash = 0;
    st.tut = !PG.save.runs; PG.parts = []; PG.pops = []; PG.playing = true; nextBlock();
    PG.track('progression_started', { step_id: 'run', step_index: Math.min(st.runIdx, 50) }); PG.msg('level_started', { level: String(st.runIdx) });
  }
  function nextBlock() { var top = st.floors[st.floors.length - 1]; st.cur = { w: top.w, i: st.floors.length }; st.x = (st.runIdx + st.floors.length) % 2 ? -190 : 190; st.dir = st.x < 0 ? 1 : -1; st.ph = st.x < 0 ? -Math.PI / 2 : Math.PI / 2; }
  function drop() {
    if (st.state !== 'play' || st.over || st.falling || !st.cur || PG.userPaused) return; st.tut = false; st.falling = { x: st.x, y: -160 - 0, vy: 0, w: st.cur.w, i: st.cur.i }; st.falling.y = craneY(); PG.sfx('whoosh');
  }
  function craneY() { return -(st.floors.length * FH) - 140; }  // world y (up is negative); tower base at y=0
  function land(f) {
    var top = st.floors[st.floors.length - 1], dx = f.x - top.x, aL = Math.max(f.x - f.w / 2, top.x - top.w / 2), aR = Math.min(f.x + f.w / 2, top.x + top.w / 2), ov = aR - aL;
    if (ov <= 1) { // total miss
      st.falling = null; PG.sfx('lose'); st.cut.push({ x: f.x, y: f.y, w: f.w, vx: dx > 0 ? 60 : -60, vy: 0, r: 0, vr: dx > 0 ? 3 : -3, i: f.i, t: 0 });
      if (st.netLeft > 0) { st.netLeft--; st.combo = 0; PG.popText(f.x, f.y - 40, 'Safety net!', '#9be564', 24); PG.sfx('upgrade'); nextBlock(); return; } gameOver(); return;
    }
    var perfect = Math.abs(dx) <= tol(), nw = ov, nx = (aL + aR) / 2;
    if (perfect) { nw = top.w; nx = top.x; st.combo++; st.perfects++; if (st.combo >= 3 && top.w < BASE_W * (1 + 0.06 * up('found')) * 1.0) nw = Math.min(top.w + 7, BASE_W * (1 + 0.06 * up('found'))); var cn = (1 + 0.15 * up('coin')) * (st.combo >= 3 ? 2 : 1); st.coinsRun += cn; PG.sfx('perfect', 1 + Math.min(st.combo, 8) * 0.06); st.perfectFx.push({ x: nx, y: -(st.floors.length * FH) - FH / 2, w: nw, t: 0 }); PG.popText(nx, -(st.floors.length * FH) - 50, st.combo > 1 ? 'PERFECT x' + st.combo : 'PERFECT', '#ffd23f', 26); PG.burst(nx, -(st.floors.length * FH), 14, { colors: ['#ffd23f', '#fff', '#ff9ecb'], g: 200, up: 120, life: 0.9 }); }
    else { st.combo = 0; // cut piece
      var cutL = f.x - f.w / 2 < top.x - top.w / 2, cw = f.w - ov, cx = cutL ? aL - cw / 2 : aR + cw / 2; st.cut.push({ x: cx, y: f.y, w: cw, vx: cutL ? -40 : 40, vy: 0, r: 0, vr: cutL ? -2 : 2, i: f.i, t: 0 }); PG.sfx('drop', 0.8 + (ov / f.w) * 0.4); PG.burst(nx, -(st.floors.length * FH), 6, { colors: ['#cfd8dc', '#fff'], g: 300, min: 30, max: 140, life: 0.5 }); }
    st.floors.push({ x: nx, w: nw, i: f.i }); st.falling = null; st.squash = 1; st.shake = perfect ? 3 : 6; PG.vibrate(perfect ? 6 : 14);
    var n = st.floors.length - 1; st.coinsRun += (n % 5 === 0 ? 1 : 0) * (1 + 0.15 * up('coin')); if (n % 10 === 0) { st.banner = { s: n + ' floors!', t: 0 }; PG.sfx('win'); PG.track('floors_milestone', { floors: Math.min(n, 200) }); }
    if (n > (PG.save.best || 0)) { PG.save.best = n; st.newBest = true; }
    nextBlock();
  }
  function gameOver() {
    st.over = true; st.overT = 0; PG.playing = false; var n = st.floors.length - 1; st.coinsRun = Math.round(st.coinsRun * 10) / 10 + Math.floor(n / 4) * 0; PG.save.coins = Math.round(((PG.save.coins || 0) + st.coinsRun) * 10) / 10; PG.save.runs = (PG.save.runs || 0) + 1; PG.commit(true);
    PG.track('progression_failed', { step_id: 'run', step_index: Math.min(st.runIdx, 50), floors: Math.min(n, 200), perfects: st.perfects }); PG.msg('level_failed', { level: String(st.runIdx) });
  }
  function revive() { st.over = false; st.revUsed = true; PG.playing = true; st.combo = 0; PG.sfx('upgrade'); nextBlock(); }

  function update(dt) {
    PG.updateParts(dt); PG.updatePops(dt); st.t += dt; st.shake = Math.max(0, st.shake - dt * 30); st.squash = Math.max(0, st.squash - dt * 4); if (st.banner) { st.banner.t += dt; if (st.banner.t > 2) st.banner = null; }
    clouds.forEach(function (c) { c.x += c.v * dt; if (c.x > 480) c.x = -80; }); birds.forEach(function (b) { b.x += b.v * dt; if (b.x > 460) b.x = -40; });
    for (var i = st.perfectFx.length - 1; i >= 0; i--) { st.perfectFx[i].t += dt * 2.5; if (st.perfectFx[i].t > 1) st.perfectFx.splice(i, 1); }
    st.cut.forEach(function (c) { c.t += dt; c.vy += 900 * dt; c.y += c.vy * dt; c.x += c.vx * dt; c.r += c.vr * dt; }); st.cut = st.cut.filter(function (c) { return c.t < 2.2; });
    if (st.state !== 'play') return;
    var n = st.floors.length; var wk = Math.max(0, Math.min(1, (n - 10) / 28)) * (1 - 0.12 * up('shield')); st.windT += dt; var target = wk * Math.sin(st.windT * 0.45 + 1) * (0.6 + 0.4 * Math.sin(st.windT * 1.3)); st.wind += (target - st.wind) * Math.min(1, dt * 1.5);
    st.sway = st.wind * 9 + Math.sin(st.t * 1.4) * Math.min(4, n * 0.1);
    if (PG.keyHit(' ') || PG.keyHit('enter') || PG.keyHit('arrowdown')) drop();
    if (!st.over) {
      if (st.cur && !st.falling) { st.ph += dt * swingSpeed() / 170; var amp = 170 + st.wind * 25; st.x = Math.sin(st.ph) * amp + st.wind * 14; }
      if (st.falling) { var f = st.falling; f.vy += 1900 * dt; f.y += f.vy * dt; f.x += st.wind * 160 * dt; var tgt = -(st.floors.length * FH) - FH / 2; if (f.y >= tgt) { f.y = tgt; land(f); } }
    }
    // camera follows tower top
    var topY = -(st.floors.length * FH); var want = Math.min(0, topY + 0.12 * (PG.h || 800) / scale); st.camY += (want - st.camY) * Math.min(1, dt * 3.2);
  }

  /* ---------- drawing ---------- */
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rgb(c) { return 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')'; }
  function skyAt(n) { // n = floors -> palette
    var stops = [[0, [120, 200, 255], [220, 245, 255]], [14, [255, 150, 110], [255, 220, 160]], [30, [40, 40, 110], [150, 90, 140]], [48, [8, 10, 40], [30, 30, 90]], [80, [2, 2, 14], [12, 10, 40]]];
    for (var i = 0; i < stops.length - 1; i++) if (n <= stops[i + 1][0]) { var k = (n - stops[i][0]) / (stops[i + 1][0] - stops[i][0]); k = k * k * (3 - 2 * k); return { top: mix(stops[i][1], stops[i + 1][1], k), bot: mix(stops[i][2], stops[i + 1][2], k), night: i >= 2 ? (i === 2 ? k : 1) : (i === 1 ? k * 0.25 : 0) }; }
    return { top: stops[4][1], bot: stops[4][2], night: 1 };
  }
  function w2s(x, y, w, h) { return { x: w / 2 + x * scale, y: h * 0.62 + (y - st.camY) * scale * 1 }; }
  function drawSky(c, w, h, t) {
    var n = st.floors.length + (st.camY === 0 ? 0 : 0), sk = skyAt(n + st.camY / -FH * 0); var g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, rgb(sk.top)); g.addColorStop(1, rgb(sk.bot)); c.fillStyle = g; c.fillRect(0, 0, w, h);
    if (sk.night > 0.05) { stars.forEach(function (s) { c.globalAlpha = sk.night * (0.4 + 0.6 * Math.sin(t * 2 + s.p)); c.fillStyle = '#fff'; c.beginPath(); c.arc(s.x * w, s.y * h * 0.9, s.r, 0, TAU); c.fill(); }); c.globalAlpha = 1; var mx = w * 0.78, my = h * 0.18; var mg = c.createRadialGradient(mx, my, 0, mx, my, 70 * scale); mg.addColorStop(0, 'rgba(230,235,255,' + 0.5 * sk.night + ')'); mg.addColorStop(1, 'rgba(230,235,255,0)'); c.fillStyle = mg; c.fillRect(mx - 80 * scale, my - 80 * scale, 160 * scale, 160 * scale); c.fillStyle = 'rgba(240,244,255,' + sk.night + ')'; c.beginPath(); c.arc(mx, my, 22 * scale, 0, TAU); c.fill(); c.fillStyle = 'rgba(160,170,210,' + 0.4 * sk.night + ')'; c.beginPath(); c.arc(mx - 6 * scale, my - 3 * scale, 5 * scale, 0, TAU); c.arc(mx + 7 * scale, my + 8 * scale, 4 * scale, 0, TAU); c.fill(); }
    else { var sx = w * 0.2, sy = h * (0.2 + n * 0.004); var sg = c.createRadialGradient(sx, sy, 0, sx, sy, 90 * scale); sg.addColorStop(0, 'rgba(255,240,180,.8)'); sg.addColorStop(1, 'rgba(255,240,180,0)'); c.fillStyle = sg; c.fillRect(sx - 100 * scale, sy - 100 * scale, 200 * scale, 200 * scale); c.fillStyle = '#fff6c8'; c.beginPath(); c.arc(sx, sy, 20 * scale, 0, TAU); c.fill(); }
    // clouds with parallax (scroll with camera slowly)
    clouds.forEach(function (cl) { var y = ((cl.y + st.camY * 0.25) % 1200 + 1200) % 1200 * (h / 900) - 80, x = cl.x * scale * (w / (VW * scale)); c.globalAlpha = 0.85 * (1 - sk.night * 0.8); c.fillStyle = '#fff'; var s = 26 * cl.s * scale; c.beginPath(); c.arc(x, y, s, 0, TAU); c.arc(x + s * 0.9, y + 4, s * 0.75, 0, TAU); c.arc(x - s * 0.9, y + 6, s * 0.7, 0, TAU); c.fill(); }); c.globalAlpha = 1;
    if (sk.night < 0.5) birds.forEach(function (b) { var y = ((b.y + st.camY * 0.4) % 700 + 700) % 700 * (h / 700), x = b.x * (w / 400), fl = Math.sin(t * 8 + b.p) * 4; c.strokeStyle = 'rgba(40,50,80,.5)'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x - 8, y + fl); c.quadraticCurveTo(x - 3, y - 4, x, y); c.quadraticCurveTo(x + 3, y - 4, x + 8, y + fl); c.stroke(); });
    return sk;
  }
  function drawCity(c, w, h, sk, t) {
    var base = h * 0.62 - st.camY * scale; if (base > h + 400) return; var layers = [[0.3, 140, [90, 120, 160], 26], [0.55, 100, [60, 90, 130], 34], [0.8, 70, [40, 60, 100], 42]];
    layers.forEach(function (L, li) { var col = mix(L[2], sk.bot, 0.35 + li * 0.05); var dark = mix(col, [4, 6, 24], sk.night * 0.7); c.fillStyle = rgb(dark); var x0 = -((st.t * 0) % 1); for (var i = -1; i < 14; i++) { var bw = L[3] * scale * (0.9 + ((i * 7 + li * 3) % 5) * 0.15), bh = L[1] * scale * (0.5 + (((i * 13 + li * 5) % 9) / 9) * 0.9); var bx = i * (w / 12) + ((li * 17) % 20) * scale - 20; c.fillRect(bx, base - bh, bw, bh + 600); if (sk.night > 0.3) { c.fillStyle = 'rgba(255,230,140,' + 0.55 * sk.night + ')'; for (var wy = 0; wy < bh - 10; wy += 11 * scale) for (var wx = 4; wx < bw - 6; wx += 8 * scale) if ((wy * 7 + wx * 3 + i) % 3 < 1) c.fillRect(bx + wx, base - bh + wy + 6, 3 * scale, 4 * scale); c.fillStyle = rgb(dark); } } });
    c.fillStyle = rgb(mix([80, 140, 80], [10, 20, 20], sk.night * 0.8)); c.fillRect(0, base, w, h); c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(0, base, w, 10 * scale);
  }
  function drawFloor(c, f, y, sk, windowsLit, alpha, rot) {
    var p = w2s(f.x, y, c.canvas.width / PG.dpr, c.canvas.height / PG.dpr), th = THEMES[Math.floor(f.i / 6) % THEMES.length], wpx = f.w * scale, hpx = FH * scale;
    c.save(); c.translate(p.x + (rot ? 0 : 0), p.y); if (rot) c.rotate(rot); c.globalAlpha = alpha === undefined ? 1 : alpha;
    var g = c.createLinearGradient(0, -hpx / 2, 0, hpx / 2); g.addColorStop(0, th[0]); g.addColorStop(1, th[1]); c.fillStyle = g; c.fillRect(-wpx / 2, -hpx / 2, wpx, hpx); c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(-wpx / 2, -hpx / 2, wpx, 3 * scale); c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(-wpx / 2, hpx / 2 - 3 * scale, wpx, 3 * scale); c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(wpx / 2 - 5 * scale, -hpx / 2, 5 * scale, hpx);
    var cols = Math.max(1, Math.floor(wpx / (20 * scale))), ww = 9 * scale, gap = (wpx - 8 * scale - cols * ww) / (cols + 1); for (var i = 0; i < cols; i++) { var wx = -wpx / 2 + 4 * scale + gap * (i + 1) + ww * i; var lit = windowsLit && ((f.i * 5 + i * 3) % 4 !== 0); c.fillStyle = lit ? '#ffe68a' : 'rgba(30,45,70,.65)'; c.fillRect(wx, -hpx / 2 + 7 * scale, ww, hpx - 14 * scale); if (lit) { c.fillStyle = 'rgba(255,255,255,.4)'; c.fillRect(wx, -hpx / 2 + 7 * scale, ww, 3 * scale); } }
    c.restore();
  }
  function drawTower(c, w, h, sk, t) {
    var lit = sk.night > 0.3, n = st.floors.length; var sq = Math.sin(st.squash * 6) * st.squash * 0.04;
    for (var i = 0; i < n; i++) { var f = st.floors[i], y = -(i * FH) - FH / 2; var k = (i / Math.max(8, n)); var sw = st.sway * k * k * 1.4; var off = sw; var topK = n - 1 - i; var sqz = topK < 3 ? sq * (3 - topK) / 3 : 0; var p2 = { x: f.x + off, w: f.w, i: f.i }; drawFloor(c, p2, y + (sqz) * FH * (n - i) * 0, sk, lit, 1, 0); }
    // roof flag
    var top = st.floors[n - 1], tp = w2s(top.x + st.sway * Math.pow((n - 1) / Math.max(8, n), 2) * 1.4, -(n * FH), w, h); c.strokeStyle = '#eee'; c.lineWidth = 2 * scale; c.beginPath(); c.moveTo(tp.x, tp.y); c.lineTo(tp.x, tp.y - 22 * scale); c.stroke(); c.fillStyle = '#ff4d6d'; var fw = Math.sin(t * 7 + st.wind * 3) * 3 * scale; c.beginPath(); c.moveTo(tp.x, tp.y - 22 * scale); c.quadraticCurveTo(tp.x + (12 + st.wind * 14) * scale, tp.y - 22 * scale + fw, tp.x + (20 + st.wind * 22) * scale, tp.y - 17 * scale + fw); c.quadraticCurveTo(tp.x + 10 * scale, tp.y - 14 * scale, tp.x, tp.y - 12 * scale); c.fill();
    st.perfectFx.forEach(function (fx) { var p = w2s(fx.x, fx.y, w, h); c.strokeStyle = 'rgba(255,230,120,' + (1 - fx.t) + ')'; c.lineWidth = 4 * scale * (1 - fx.t); c.strokeRect(p.x - fx.w * scale / 2 - fx.t * 14 * scale, p.y - FH * scale / 2 - fx.t * 8 * scale, fx.w * scale + fx.t * 28 * scale, FH * scale + fx.t * 16 * scale); });
  }
  function drawCrane(c, w, h, sk, t) {
    var n = st.floors.length, armY = h * 0.62 + (-(n * FH) - 190 - 30 - st.camY) * scale; armY = Math.max(armY, 44 * PG.scale()); var top = 0;
    // fixed crane arm near the top of the screen
    var ay = h * 0.62 + (craneYDraw() - st.camY) * scale;
    c.fillStyle = '#ffb703'; c.fillRect(-10, ay - 8 * scale, w + 20, 8 * scale); c.fillStyle = '#f08c00'; c.fillRect(-10, ay, w + 20, 3 * scale);
    for (var x = 0; x < w; x += 22 * scale) { c.strokeStyle = '#d98500'; c.lineWidth = 2; c.beginPath(); c.moveTo(x, ay - 8 * scale); c.lineTo(x + 11 * scale, ay + 3 * scale); c.lineTo(x + 22 * scale, ay - 8 * scale); c.stroke(); }
    var tx = w / 2 + (st.falling ? st.falling.x : st.x) * scale + (st.falling ? 0 : 0);
    c.fillStyle = '#444'; c.fillRect(tx - 12 * scale, ay - 12 * scale, 24 * scale, 14 * scale); c.fillStyle = '#e63946'; c.fillRect(tx - 12 * scale, ay - 12 * scale, 24 * scale, 4 * scale);
    if (!st.falling && st.cur && !st.over) { var by = h * 0.62 + (craneY() - st.camY) * scale, swing = Math.cos(st.ph) * 0.04 * (st.wind + 1); c.strokeStyle = '#333'; c.lineWidth = 2 * scale; c.beginPath(); c.moveTo(tx - st.cur.w * scale * 0.4, ay + 2 * scale); c.lineTo(tx - st.cur.w * scale * 0.5 + swing * 20, by - FH * scale / 2); c.moveTo(tx + st.cur.w * scale * 0.4, ay + 2 * scale); c.lineTo(tx + st.cur.w * scale * 0.5 + swing * 20, by - FH * scale / 2); c.stroke(); var pp = { x: st.x, w: st.cur.w, i: st.cur.i }; var sp = w2s(st.x, craneYDraw() + 30 + 0 - 0, w, h); c.save(); c.translate(0, 0); drawFloor(c, pp, craneY(), sk, sk.night > 0.3, 1, swing); c.restore(); }
    if (st.falling) drawFloor(c, { x: st.falling.x, w: st.falling.w, i: st.falling.i }, st.falling.y, sk, sk.night > 0.3, 1, 0);
  }
  function craneYDraw() { return -(st.floors.length * FH) - 210; }
  function drawHUD(c, w, h) {
    var sc = PG.scale(); U.text(c, '' + (st.floors.length - 1), w / 2, 70 * sc, 64 * sc, '#fff', 'center', { stroke: 'rgba(20,20,60,.55)' }); U.text(c, 'BEST ' + (PG.save.best || 0), w / 2, 112 * sc, 14 * sc, '#fff', 'center', { stroke: 'rgba(20,20,60,.4)', shadow: false });
    U.coin(c, 22 * sc, 26 * sc, 10 * sc); U.text(c, '' + Math.round(st.coinsRun * 10) / 10, 38 * sc, 27 * sc, 20 * sc, '#ffe066', 'left', { stroke: 'rgba(0,0,0,.45)' }); if (st.netLeft > 0) U.text(c, 'Net x' + st.netLeft, 16 * sc, 54 * sc, 14 * sc, '#b9f6ca', 'left', { stroke: 'rgba(0,0,0,.4)' });
    if (Math.abs(st.wind) > 0.12) { var dir = st.wind > 0 ? 1 : -1; c.save(); c.translate(w / 2, 142 * sc); c.fillStyle = 'rgba(255,255,255,' + (0.5 + 0.3 * Math.sin(st.t * 6)) + ')'; for (var i = 0; i < 3; i++) { var ax = dir * (i * 16 + (st.t * 40 % 16)) * sc; c.beginPath(); c.moveTo(ax - 6 * dir * sc, -6 * sc); c.lineTo(ax + 6 * dir * sc, 0); c.lineTo(ax - 6 * dir * sc, 6 * sc); c.fill(); } c.restore(); U.text(c, 'WIND', w / 2, 160 * sc, 12 * sc, '#fff', 'center', { shadow: false }); }
    if (st.banner) { var k = Math.min(1, st.banner.t * 4) * Math.min(1, (2 - st.banner.t) * 3); c.globalAlpha = k; U.text(c, st.banner.s, w / 2, h * 0.32, 42 * sc, '#ffd23f', 'center', { stroke: 'rgba(0,0,0,.55)' }); c.globalAlpha = 1; }
    if (st.tut && st.floors.length < 3) { c.globalAlpha = 0.7 + 0.3 * Math.sin(st.t * 4); U.text(c, 'TAP to drop the floor', w / 2, h * 0.86, 22 * sc, '#fff', 'center', { stroke: 'rgba(0,0,0,.55)' }); c.globalAlpha = 1; }
  }
  function drawOver(c, w, h) {
    var sc = PG.scale(); st.overT += 0.016; var k = PG.ease.out(Math.min(1, st.overT * 2)); c.fillStyle = 'rgba(10,10,40,' + 0.55 * k + ')'; c.fillRect(0, 0, w, h);
    var pw = Math.min(w * 0.88, 380 * sc), ph = 380 * sc, px = w / 2 - pw / 2, py = h * 0.5 - ph / 2 + (1 - k) * 60; U.panel(c, px, py, pw, ph);
    U.text(c, 'Topped out!', w / 2, py + 38 * sc, 30 * sc, '#ffd23f', 'center'); U.text(c, (st.floors.length - 1) + ' floors', w / 2, py + 92 * sc, 48 * sc, '#fff', 'center'); U.text(c, st.newBest ? 'NEW BEST!' : 'Best ' + (PG.save.best || 0), w / 2, py + 130 * sc, 18 * sc, st.newBest ? '#9be564' : '#cbd5e1', 'center');
    U.coin(c, w / 2 - 50 * sc, py + 166 * sc, 12 * sc); U.text(c, '+' + (Math.round(st.coinsRun * 10) / 10) + (st.doubled ? ' (x2)' : ''), w / 2 - 32 * sc, py + 167 * sc, 26 * sc, '#ffe066', 'left');
    var bw = pw * 0.84, bh = 48 * sc, yy = py + 196 * sc;
    if (!st.revUsed && PG.rewardedSupported() && st.floors.length > 6) { if (U.button(c, w / 2 - bw / 2, yy, bw, bh, 'Watch ad: keep building', { color: '#8338ec', size: 17 * sc })) { PG.rewarded('continue').then(function (ok) { if (ok) { PG.save.coins = Math.max(0, PG.save.coins - st.coinsRun); st.revUsed = true; st.over = false; PG.playing = true; st.combo = 0; nextBlock(); PG.track('rewarded_continue', { floors: st.floors.length - 1 }); } }); } yy += bh + 8 * sc; }
    else if (!st.doubled && st.coinsRun >= 3 && PG.rewardedSupported()) { if (U.button(c, w / 2 - bw / 2, yy, bw, bh, 'Watch ad: double coins', { color: '#8338ec', size: 17 * sc })) { var e = st.coinsRun; PG.rewarded('bonus').then(function (ok) { if (ok) { PG.save.coins += e; st.coinsRun += e; st.doubled = true; PG.commit(true); } }); } yy += bh + 8 * sc; }
    if (U.button(c, w / 2 - bw / 2, yy, bw, bh, 'Build again', { color: '#e76f51' })) PG.interstitial('game_over').then(function () { startRun(); });
    if (U.button(c, w / 2 - bw / 2, yy + bh + 8 * sc, bw / 2 - 5 * sc, bh * 0.8, 'Upgrades', { color: '#ff9f1c', size: 15 * sc })) { st.state = 'shop'; PG.track('shop_opened', { source: 'game_over' }); }
    if (U.button(c, w / 2 + 5 * sc, yy + bh + 8 * sc, bw / 2 - 5 * sc, bh * 0.8, 'Menu', { color: '#5c6bc0', size: 15 * sc })) { st.state = 'menu'; st.floors = [{ x: 0, w: BASE_W, i: 0 }]; st.cur = null; st.camY = 0; }
  }
  function drawShop(c, w, h) {
    var sc = PG.scale(); c.fillStyle = 'rgba(10,10,40,.75)'; c.fillRect(0, 0, w, h); var pw = Math.min(w * 0.94, 440 * sc), px = w / 2 - pw / 2, py = 20 * sc, rowH = 62 * sc, ph = 68 * sc + UPS.length * rowH + 74 * sc; U.panel(c, px, py, pw, ph);
    U.text(c, 'Upgrades', w / 2, py + 34 * sc, 30 * sc, '#ffd23f', 'center'); U.coin(c, px + pw - 84 * sc, py + 34 * sc, 11 * sc); U.text(c, PG.fmt(PG.save.coins || 0), px + pw - 68 * sc, py + 35 * sc, 20 * sc, '#ffe066', 'left');
    UPS.forEach(function (u, i) { var y = py + 60 * sc + i * rowH, L = PG.upLevel(u.id), cost = PG.upCost(u.base, u.grow, L), maxed = L >= u.max; U.text(c, u.n, px + 18 * sc, y + 17 * sc, 18 * sc, '#fff', 'left'); U.text(c, u.d, px + 18 * sc, y + 36 * sc, 13 * sc, '#cbd5e1', 'left', { shadow: false }); for (var k = 0; k < u.max; k++) { c.fillStyle = k < L ? '#9be564' : 'rgba(255,255,255,.2)'; c.beginPath(); c.arc(px + 22 * sc + k * 11 * sc, y + 51 * sc, 4 * sc, 0, TAU); c.fill(); }
      var bw = 104 * sc, bh = 42 * sc, bx = px + pw - bw - 14 * sc; if (maxed) U.text(c, 'MAX', bx + bw / 2, y + 27 * sc, 18 * sc, '#9be564', 'center'); else if (U.button(c, bx, y + 7 * sc, bw, bh, cost + '', { color: PG.save.coins >= cost ? '#2ec4b6' : '#8a8f98', size: 20 * sc })) PG.buyUp(u.id, cost, u.max); });
    if (U.button(c, w / 2 - 90 * sc, py + ph - 60 * sc, 180 * sc, 46 * sc, 'Back', { color: '#ff9f1c' })) st.state = 'menu';
  }
  function drawMenu(c, w, h, t) {
    var sc = PG.scale(); c.fillStyle = 'rgba(10,20,60,.2)'; c.fillRect(0, 0, w, h); U.text(c, 'SKYLINE', w / 2, h * 0.12, Math.min(64 * sc, w * 0.17), '#fff', 'center', { stroke: '#1d3557' }); U.text(c, 'SNAP', w / 2, h * 0.12 + 58 * sc, Math.min(72 * sc, w * 0.2), '#ffd23f', 'center', { stroke: '#8a5a00' });
    var bw = 230 * sc, bh = 62 * sc, y0 = h * 0.28; if (U.button(c, w / 2 - bw / 2, h * 0.7, bw, bh, 'Build!', { color: '#e76f51', size: 26 * sc })) startRun(); if (U.button(c, w / 2 - bw / 2, h * 0.7 + bh + 12 * sc, bw, bh * 0.8, 'Upgrades', { color: '#ff9f1c', size: 20 * sc })) { st.state = 'shop'; PG.track('shop_opened', { source: 'menu' }); }
    U.coin(c, w / 2 - 34 * sc, h - 54 * sc, 11 * sc); U.text(c, PG.fmt(PG.save.coins || 0), w / 2 - 18 * sc, h - 53 * sc, 20 * sc, '#ffe066', 'left', { stroke: 'rgba(0,0,0,.4)' }); U.text(c, 'Best ' + (PG.save.best || 0) + ' floors', w / 2, h - 24 * sc, 15 * sc, '#fff', 'center', { shadow: false });
  }
  function render(c, w, h) {
    scale = PG.clamp(Math.min(w / VW, h / 700) * 1.05, 0.7, 2.2); var t = PG.time; var sk = drawSky(c, w, h, t); drawCity(c, w, h, sk, t);
    c.save(); if (st.shake > 0.2) c.translate((Math.random() - 0.5) * st.shake, (Math.random() - 0.5) * st.shake);
    // ground base for the tower
    var gp = w2s(0, 0, w, h); c.fillStyle = '#3a3a4a'; c.fillRect(gp.x - 120 * scale, gp.y, 240 * scale, 14 * scale); c.fillStyle = 'rgba(0,0,0,.3)'; c.fillRect(gp.x - 120 * scale, gp.y, 240 * scale, 3 * scale);
    drawTower(c, w, h, sk, t); if (st.state === 'play') drawCrane(c, w, h, sk, t);
    st.cut.forEach(function (cp) { c.globalAlpha = Math.max(0, 1 - cp.t / 2.2); drawFloor(c, { x: cp.x, w: cp.w, i: cp.i }, cp.y, sk, sk.night > 0.3, 1, cp.r); c.globalAlpha = 1; });
    var ps = c.getTransform ? null : null; c.save(); c.translate(w / 2, h * 0.62 - st.camY * scale); c.scale(scale, scale); PG.drawParts(c); PG.drawPops(c); c.restore(); c.restore();
    if (st.state === 'menu') drawMenu(c, w, h, t); else if (st.state === 'shop') drawShop(c, w, h); else { drawHUD(c, w, h); if (st.over) drawOver(c, w, h); }
  }
  PG.onDown = function (x, y) { if (st.state === 'play' && !(x > PG.w - 130 * PG.scale() && y < 70 * PG.scale())) drop(); };
  PG.setup(document.getElementById('c'), update, render);
  window.__sky = { st: st, start: startRun, drop: drop, update: update };
  PG.init({ id: 'skyline_snap', version: '1.0.0', defaults: { best: 0, coins: 0, runs: 0, up: {}, muted: false } }).then(function () {
    st.floors = [{ x: 0, w: BASE_W, i: 0 }]; PG.music({ scale: [0, 2, 4, 7, 9], root: 247, bpm: 100, wave: 'triangle', vol: 0.06, bass: 0.09 });
  });
})();
