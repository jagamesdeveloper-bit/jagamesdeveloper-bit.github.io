/* HEX HARVEST - merge crops on a floating hex island. Three or more touching crops of one kind grow into the next kind. */
(function () {
  'use strict';
  var U = PG.ui, S3 = Math.sqrt(3), V = 0.82; // vertical squash for the pseudo-3D look
  var TIERS = [
    { n: 'Seed', v: 1 }, { n: 'Sprout', v: 3 }, { n: 'Tulip', v: 9 }, { n: 'Sunflower', v: 27 },
    { n: 'Berry Bush', v: 81 }, { n: 'Oak', v: 243 }, { n: 'Apple Tree', v: 729 }, { n: 'Golden Tree', v: 2187 }
  ];
  var MAXT = TIERS.length - 1, R = 3;
  var cells = [], cellAt = {};
  for (var q = -R; q <= R; q++) for (var r = -R; r <= R; r++) if (Math.abs(q + r) <= R) { var c0 = { q: q, r: r, i: cells.length, t: -1, pop: 1, vis: 1, ph: Math.random() * 6.28, glow: 0 }; cells.push(c0); cellAt[q + ',' + r] = c0; }
  var DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
  function nb(c) { var o = []; for (var i = 0; i < 6; i++) { var n = cellAt[(c.q + DIRS[i][0]) + ',' + (c.r + DIRS[i][1])]; if (n) o.push(n); } return o; }

  var st = { score: 0, hand: 0, next: 0, hold: -1, state: 'menu', over: false, usedRev: false, chain: 0, maxT: 0, moves: 0, tutorial: true };
  var geo = { s: 40, cx: 0, cy: 0 };
  var hover = null, aiming = false, anims = [], overT = 0, newTier = -1, banner = null, shake = 0, runIdx = 0;
  var bgT = 0, clouds = [], flies = [], stars = [], birds = [], petals = [];
  for (var i = 0; i < 7; i++) clouds.push({ x: Math.random(), y: 0.06 + Math.random() * 0.3, s: 0.6 + Math.random() * 0.9, v: 0.004 + Math.random() * 0.008, p: Math.random() * 9 });
  for (i = 0; i < 70; i++) stars.push({ x: Math.random(), y: Math.random() * 0.6, r: Math.random() * 1.4 + 0.3, p: Math.random() * 9 });
  for (i = 0; i < 5; i++) flies.push({ x: Math.random(), y: 0.3 + Math.random() * 0.4, a: Math.random() * 6.28, c: PG.pick(['#ff9ecb', '#ffd166', '#9be7ff', '#c9a7ff', '#ffffff']), p: Math.random() * 9 });
  for (i = 0; i < 3; i++) birds.push({ x: Math.random(), y: 0.12 + Math.random() * 0.15, v: 0.02 + Math.random() * 0.02, p: Math.random() * 9 });
  for (i = 0; i < 16; i++) petals.push({ x: Math.random(), y: Math.random(), v: 0.03 + Math.random() * 0.04, p: Math.random() * 9, c: PG.pick(['#ffc8dd', '#ffffff', '#bde0fe', '#fff3b0']) });

  /* ------------ logic ------------ */
  function weightedTier() {
    var m = st.maxT, roll = Math.random();
    if (m <= 1) return roll < 0.8 ? 0 : 1;
    if (m <= 3) return roll < 0.6 ? 0 : roll < 0.9 ? 1 : 2;
    return roll < 0.5 ? 0 : roll < 0.8 ? 1 : roll < 0.95 ? 2 : 3;
  }
  function newGame(restore) {
    cells.forEach(function (c) { c.t = -1; c.pop = 1; c.glow = 0; });
    st.score = 0; st.over = false; st.usedRev = false; st.maxT = 0; st.moves = 0; st.hold = -1; st.chain = 0;
    st.hand = 0; st.next = 0; st.state = 'play'; anims = []; banner = null;
    if (restore) {
      var b = PG.save.board; for (var i = 0; i < cells.length; i++) cells[i].t = b.t[i];
      st.score = b.score; st.hand = b.hand; st.next = b.next; st.hold = b.hold; st.maxT = b.maxT; st.moves = b.moves || 0; st.usedRev = !!b.usedRev;
    } else {
      st.hand = 0; st.next = weightedTier();
      // starter seeds so the first move is not empty
      var starter = [[0, 0, 0], [1, 0, 0], [-1, 1, 1]];
      starter.forEach(function (s) { cellAt[s[0] + ',' + s[1]].t = s[2]; });
      st.maxT = 1; runIdx++;
      PG.track('progression_started', { step_id: 'run', step_index: Math.min(runIdx, 50) }); PG.msg('level_started', { level: String(runIdx) });
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
  function previewGroup(c, tier) { // what would merge if placed here
    var saved = c.t; c.t = tier; var g = group(c); c.t = saved; return g;
  }
  function place(c) {
    if (c.t !== -1 || st.over) return;
    st.moves++; c.t = st.hand; c.pop = 0; PG.sfx('drop', 0.9 + Math.random() * 0.2);
    var chain = 0, cur = c;
    for (;;) {
      var g = group(cur);
      if (g.length < 3) break;
      chain++;
      var t = cur.t;
      if (t === MAXT) { // golden tree harvest
        var pts = 2000 * g.length * chain; st.score += pts; PG.save.coins = (PG.save.coins || 0) + 5;
        g.forEach(function (x) { PG.burst(cellXY(x).x, cellXY(x).y - geo.s * 0.6, 22, { colors: ['#ffd23f', '#fff3b0', '#ffb703'], up: 160, g: 200, life: 1.4 }); x.t = -1; });
        banner = { s: 'GOLDEN HARVEST! +' + pts, t: 0 }; PG.sfx('win'); shake = 12;
        break;
      }
      var pts2 = TIERS[t + 1].v * g.length * chain; st.score += pts2;
      g.forEach(function (x) { if (x !== cur) { var p = cellXY(x); anims.push({ k: 'fly', t: 0, from: p, to: cellXY(cur), tier: t }); } x.t = -1; });
      cur.t = t + 1; cur.pop = 0; cur.glow = 1;
      var cp = cellXY(cur);
      PG.burst(cp.x, cp.y - geo.s * 0.5, 14 + chain * 6, { colors: ['#ffd23f', '#9be564', '#ff9ecb', '#fff'], up: 120, life: 0.9 });
      PG.popText(cp.x, cp.y - geo.s * 1.2, '+' + pts2, chain > 1 ? '#ffd23f' : '#fff', 20 + chain * 3);
      if (chain > 1) PG.popText(cp.x, cp.y - geo.s * 1.8, 'x' + chain + ' chain!', '#ff9ecb', 22);
      PG.sfx('merge', 1 + chain * 0.12); PG.vibrate(15);
      if (t + 1 > st.maxT) {
        st.maxT = t + 1;
        if (!PG.save.found || PG.save.found < st.maxT) { PG.save.found = st.maxT; PG.track('crop_unlocked', { tier: st.maxT }); }
        banner = { s: 'New crop: ' + TIERS[t + 1].n + '!', t: 0 }; PG.sfx('win');
        if (t + 1 === MAXT) PG.track('milestone_reached', { milestone: 'golden_tree' });
      }
    }
    st.hand = st.next; st.next = weightedTier();
    if (st.score > (PG.save.best || 0)) PG.save.best = st.score;
    PG.save.coins = PG.save.coins || 0;
    if (!cells.some(function (x) { return x.t === -1; })) endGame(); else persist();
    st.tutorial = false;
  }
  function endGame() {
    st.over = true; overT = 0; PG.playing = false; PG.save.games = (PG.save.games || 0) + 1; PG.save.board = null;
    PG.save.best = Math.max(PG.save.best || 0, st.score); PG.commit(true);
    PG.track('progression_failed', { step_id: 'run', step_index: Math.min(runIdx, 50), score: st.score, max_tier: st.maxT, moves: st.moves });
    PG.msg('level_failed', { level: String(runIdx) }); PG.sfx('lose');
  }
  function swapHold() {
    if (st.over) return; PG.sfx('whoosh');
    if (st.hold === -1) { st.hold = st.hand; st.hand = st.next; st.next = weightedTier(); } else { var t = st.hold; st.hold = st.hand; st.hand = t; }
    persist();
  }
  function reviveClear() { // rewarded: remove the lowest crops and keep playing (once per run)
    var occ = cells.filter(function (c) { return c.t >= 0; }).sort(function (a, b) { return a.t - b.t; });
    for (var i = 0; i < 8 && i < occ.length; i++) { PG.burst(cellXY(occ[i]).x, cellXY(occ[i]).y - 10, 8, { colors: ['#fff', '#bde0fe'] }); occ[i].t = -1; }
    st.over = false; st.usedRev = true; PG.playing = true; persist(); PG.sfx('upgrade');
  }

  /* ------------ geometry ------------ */
  function layout(w, h) {
    var portrait = h > w;
    var s = Math.min(w * 0.96 / (S3 * 7), h * (portrait ? 0.5 : 0.66) / (11 * V));
    geo.s = s; geo.cx = w / 2; geo.cy = h * (portrait ? 0.43 : 0.47);
    if (!portrait) geo.cx = w * 0.5;
  }
  function cellXY(c) { return { x: geo.cx + geo.s * S3 * (c.q + c.r / 2), y: geo.cy + geo.s * 1.5 * c.r * V }; }
  function pickCell(px, py) {
    var y = (py - geo.cy) / (geo.s * V), x = px - geo.cx;
    var qf = (x * S3 / 3 - y / 3) / geo.s, rf = (y * 2 / 3) / geo.s;
    var xf = qf, zf = rf, yf = -xf - zf, rx = Math.round(xf), ry = Math.round(yf), rz = Math.round(zf);
    var dx = Math.abs(rx - xf), dy = Math.abs(ry - yf), dz = Math.abs(rz - zf);
    if (dx > dy && dx > dz) rx = -ry - rz; else if (dy > dz) ry = -rx - rz; else rz = -rx - ry;
    return cellAt[rx + ',' + rz] || null;
  }

  /* ------------ drawing helpers ------------ */
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rgb(c) { return 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')'; }
  function dayness(t) { var p = (t / 140 + 0.12) % 1; return PG.clamp(0.5 + 0.9 * Math.sin(p * 6.2832), 0, 1); }
  function hexPath(c, x, y, s, k) { c.beginPath(); for (var i = 0; i < 6; i++) { var a = Math.PI / 180 * (60 * i - 30); var px = x + Math.cos(a) * s * k, py = y + Math.sin(a) * s * k * V; if (i) c.lineTo(px, py); else c.moveTo(px, py); } c.closePath(); }

  function drawSky(c, w, h, t, d) {
    var night = [[11, 16, 48], [40, 46, 104]], dusk = [[255, 138, 92], [255, 217, 160]], day = [[96, 190, 255], [214, 241, 255]];
    var top, bot;
    if (d < 0.5) { top = mix(night[0], dusk[0], d * 2); bot = mix(night[1], dusk[1], d * 2); } else { top = mix(dusk[0], day[0], (d - 0.5) * 2); bot = mix(dusk[1], day[1], (d - 0.5) * 2); }
    var g = c.createLinearGradient(0, 0, 0, h * 0.8); g.addColorStop(0, rgb(top)); g.addColorStop(1, rgb(bot)); c.fillStyle = g; c.fillRect(0, 0, w, h);
    if (d < 0.55) { var sa = PG.clamp((0.55 - d) * 2, 0, 1); stars.forEach(function (s) { c.globalAlpha = sa * (0.5 + 0.5 * Math.sin(t * 2 + s.p)); c.fillStyle = '#fff'; c.beginPath(); c.arc(s.x * w, s.y * h, s.r, 0, 6.28); c.fill(); }); c.globalAlpha = 1; }
    // sun / moon arc
    var p = (t / 140 + 0.12) % 1, ang = p * 6.2832, sx = w * 0.5 - Math.cos(ang) * w * 0.42, sy = h * 0.5 - Math.sin(ang) * h * 0.4;
    var sun = Math.sin(ang) > -0.15;
    if (sun) { var gr = c.createRadialGradient(sx, sy, 0, sx, sy, h * 0.22); gr.addColorStop(0, 'rgba(255,240,170,.85)'); gr.addColorStop(0.25, 'rgba(255,220,120,.35)'); gr.addColorStop(1, 'rgba(255,220,120,0)'); c.fillStyle = gr; c.fillRect(sx - h * 0.25, sy - h * 0.25, h * 0.5, h * 0.5); c.fillStyle = '#fff6c8'; c.beginPath(); c.arc(sx, sy, h * 0.035, 0, 6.28); c.fill(); }
    var mx = w * 0.5 + Math.cos(ang) * w * 0.42, my = h * 0.5 + Math.sin(ang) * h * 0.4;
    if (Math.sin(ang) < 0.15 && my < h * 0.6) { c.fillStyle = 'rgba(235,240,255,.95)'; c.beginPath(); c.arc(mx, my, h * 0.03, 0, 6.28); c.fill(); c.fillStyle = 'rgba(40,46,104,.35)'; c.beginPath(); c.arc(mx + h * 0.01, my - h * 0.005, h * 0.026, 0, 6.28); c.fill(); }
    // god rays at high sun
    if (d > 0.55 && sun) { c.save(); c.globalAlpha = 0.07 * (d - 0.5); c.fillStyle = '#fff'; for (var i = 0; i < 6; i++) { var a0 = ang * 0 + i * 0.5 + Math.sin(t * 0.2 + i) * 0.05; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + Math.cos(a0 + 1) * h, sy + Math.sin(a0 + 1) * h); c.lineTo(sx + Math.cos(a0 + 1.12) * h, sy + Math.sin(a0 + 1.12) * h); c.fill(); } c.restore(); }
  }
  function cloud(c, x, y, s, a) {
    c.globalAlpha = a; c.fillStyle = '#fff';
    [[0, 0, 1], [0.9, 0.15, 0.75], [-0.9, 0.2, 0.7], [0.4, -0.35, 0.8], [-0.4, -0.25, 0.65]].forEach(function (b) { c.beginPath(); c.arc(x + b[0] * s * 0.9, y + b[1] * s * 0.5, b[2] * s * 0.62, 0, 6.28); c.fill(); });
    c.globalAlpha = 1;
  }
  function drawWorld(c, w, h, t) {
    var d = dayness(t); drawSky(c, w, h, t, d);
    var ca = 0.25 + 0.7 * d;
    clouds.forEach(function (k) { k.x += k.v * 0.016; if (k.x > 1.3) k.x = -0.3; cloud(c, k.x * w, k.y * h + Math.sin(t * 0.3 + k.p) * 4, k.s * Math.min(w, h) * 0.12, ca * 0.9); });
    // layered hills
    var hc = [[[60, 120, 110], [24, 60, 70]], [[88, 170, 120], [32, 82, 80]], [[120, 200, 120], [40, 100, 70]]];
    for (var L = 0; L < 3; L++) {
      var base = h * (0.62 + L * 0.06), amp = h * (0.07 - L * 0.012), col = mix(hc[L][1], hc[L][0], d);
      c.fillStyle = rgb(col); c.beginPath(); c.moveTo(0, h);
      for (var x = 0; x <= w + 8; x += 8) c.lineTo(x, base + Math.sin(x / w * 5 + L * 2 + t * 0.03) * amp + Math.sin(x / w * 11 + L) * amp * 0.35);
      c.lineTo(w, h); c.closePath(); c.fill();
    }
    // birds
    birds.forEach(function (b) { b.x += b.v * 0.016; if (b.x > 1.1) b.x = -0.1; var bx = b.x * w, by = b.y * h + Math.sin(t + b.p) * 6, f = Math.sin(t * 7 + b.p) * 5; c.strokeStyle = 'rgba(30,40,70,' + (0.2 + d * 0.5) + ')'; c.lineWidth = 2; c.beginPath(); c.moveTo(bx - 9, by + f); c.quadraticCurveTo(bx - 4, by - 4, bx, by); c.quadraticCurveTo(bx + 4, by - 4, bx + 9, by + f); c.stroke(); });
    return d;
  }
  function drawIsland(c, t, d) {
    var s = geo.s, bob = Math.sin(t * 0.8) * s * 0.07;
    c.save(); c.translate(0, bob);
    // shadow on ground
    c.fillStyle = 'rgba(0,0,0,.14)'; c.beginPath(); c.ellipse(geo.cx, geo.cy + s * 9.2, s * 4.2, s * 0.8, 0, 0, 6.28); c.fill();
    // rock underside
    var rockT = mix([70, 55, 70], [150, 112, 84], d), rockB = mix([40, 32, 48], [100, 70, 56], d);
    var gr = c.createLinearGradient(0, geo.cy + s * 3, 0, geo.cy + s * 9); gr.addColorStop(0, rgb(rockT)); gr.addColorStop(1, rgb(rockB));
    c.fillStyle = gr; c.beginPath(); var X = geo.cx, Y = geo.cy;
    c.moveTo(X - s * 6.0, Y + s * 0.5); c.quadraticCurveTo(X - s * 6.0, Y + s * 3.9, X - s * 3.0, Y + s * 5.0); c.quadraticCurveTo(X - s * 1.9, Y + s * 6.1, X - s * 0.9, Y + s * 6.6);
    c.lineTo(X - s * 0.3, Y + s * 8.8); c.lineTo(X + s * 0.4, Y + s * 6.9); c.lineTo(X + s * 1.2, Y + s * 7.9); c.lineTo(X + s * 1.5, Y + s * 6.5);
    c.quadraticCurveTo(X + s * 2.4, Y + s * 5.6, X + s * 3.0, Y + s * 5.0); c.quadraticCurveTo(X + s * 6.0, Y + s * 3.9, X + s * 6.0, Y + s * 0.5);
    c.closePath(); c.fill();
    // waterfall
    var wx = geo.cx + s * 2.2; c.fillStyle = 'rgba(190,235,255,.55)'; c.beginPath(); c.moveTo(wx - s * 0.12, geo.cy + s * 5.2); c.lineTo(wx + s * 0.12, geo.cy + s * 5.2); c.lineTo(wx + s * 0.05, geo.cy + s * 8.5); c.lineTo(wx - s * 0.05, geo.cy + s * 8.5); c.fill();
    for (var i = 0; i < 6; i++) { var yy = geo.cy + s * (5.2 + ((t * 2 + i * 0.8) % 3.3) * 1); c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.arc(wx + Math.sin(i + t) * 2, yy, 2, 0, 6.28); c.fill(); }
    // tiles
    var order = cells.slice().sort(function (a, b) { return a.r - b.r; });
    var grassT = mix([38, 78, 62], [126, 214, 104], d), grassB = mix([30, 62, 56], [92, 178, 86], d), side = mix([60, 46, 56], [140, 98, 66], d);
    order.forEach(function (cl) {
      var p = cellXY(cl), th = s * 0.3, empty = cl.t === -1;
      var hv = (hover === cl && !st.over) ? 1 : 0;
      c.fillStyle = rgb(side); hexPath(c, p.x, p.y + th, s * 0.97, 1); c.fill();
      c.fillStyle = rgb(side); c.fillRect(p.x - s * S3 / 2 * 0.97, p.y, s * S3 * 0.97, th);
      c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(p.x - s * S3 / 2 * 0.97, p.y, s * S3 * 0.97, th);
      var tg = c.createLinearGradient(0, p.y - s * V, 0, p.y + s * V); tg.addColorStop(0, rgb(grassT)); tg.addColorStop(1, rgb(grassB));
      c.fillStyle = tg; hexPath(c, p.x, p.y, s * 0.97, 1); c.fill();
      if (hv && empty) { c.fillStyle = 'rgba(255,255,255,.32)'; hexPath(c, p.x, p.y, s * 0.97, 1); c.fill(); }
      c.strokeStyle = 'rgba(255,255,255,' + (0.14 + hv * 0.4) + ')'; c.lineWidth = 2; hexPath(c, p.x, p.y, s * 0.88, 1); c.stroke();
      // grass blades
      c.strokeStyle = rgb(mix(grassB, [255, 255, 255], 0.2)); c.lineWidth = 1.5;
      for (var b = 0; b < 4; b++) { var bx = p.x + Math.cos(cl.ph * 3 + b * 1.7) * s * 0.55, by = p.y + Math.sin(cl.ph * 5 + b * 2.3) * s * 0.3 * V, sw = Math.sin(t * 2 + bx * 0.05) * 2; c.beginPath(); c.moveTo(bx, by); c.lineTo(bx + sw, by - s * 0.18); c.stroke(); }
    });
    // crops (back to front) - second pass so tall plants overlap the tiles behind them
    order.forEach(function (cl) {
      if (cl.pop < 1) cl.pop = Math.min(1, cl.pop + 0.05);
      if (cl.glow > 0) cl.glow = Math.max(0, cl.glow - 0.02);
      if (cl.t < 0) return;
      var p = cellXY(cl), k = PG.ease.back(cl.pop);
      if (cl.glow > 0) { var gg = c.createRadialGradient(p.x, p.y - s * 0.4, 0, p.x, p.y - s * 0.4, s * 1.4); gg.addColorStop(0, 'rgba(255,240,150,' + cl.glow * 0.8 + ')'); gg.addColorStop(1, 'rgba(255,240,150,0)'); c.fillStyle = gg; c.fillRect(p.x - s * 1.5, p.y - s * 1.8, s * 3, s * 3); }
      drawCrop(c, cl.t, p.x, p.y, s, t, cl.ph, k);
    });
    // ghost preview
    if (hover && hover.t === -1 && !st.over && st.state === 'play') {
      var hp = cellXY(hover), g = previewGroup(hover, st.hand);
      c.globalAlpha = 0.6; drawCrop(c, st.hand, hp.x, hp.y, s, t, 0, 1); c.globalAlpha = 1;
      if (g.length >= 3) { U.text(c, 'MERGE x' + g.length, hp.x, hp.y - s * 2.1, 16, '#ffd23f', 'center', { stroke: 'rgba(0,0,0,.5)' }); g.forEach(function (x) { var q = cellXY(x); c.strokeStyle = '#ffd23f'; c.lineWidth = 3; hexPath(c, q.x, q.y, s * 0.9, 1); c.stroke(); }); }
    }
    c.restore();
  }
  /* procedural crops - every plant sways on its own phase */
  function leaf(c, x, y, len, ang, w, col) { c.save(); c.translate(x, y); c.rotate(ang); c.fillStyle = col; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(len * 0.5, -w, len, 0); c.quadraticCurveTo(len * 0.5, w, 0, 0); c.fill(); c.restore(); }
  function blob(c, x, y, r, col, hi) { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 6.28); c.fill(); if (hi) { c.fillStyle = hi; c.beginPath(); c.arc(x - r * 0.3, y - r * 0.35, r * 0.45, 0, 6.28); c.fill(); } }
  function drawCrop(c, tier, x, y, s, t, ph, k) {
    c.save(); c.translate(x, y); var sw = Math.sin(t * 1.6 + ph) * 0.06, sq = 1 + Math.sin(t * 2.2 + ph) * 0.015;
    c.scale(k * (2 - Math.min(k, 1)) * 1, k * sq); // squash & stretch on pop
    c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(0, 0, s * (0.3 + tier * 0.05), s * 0.12, 0, 0, 6.28); c.fill();
    c.rotate(sw * (tier >= 4 ? 0.4 : 1));
    var u = s;
    switch (tier) {
      case 0: // seed
        c.fillStyle = '#7b4f2a'; c.beginPath(); c.ellipse(0, -u * 0.2, u * 0.2, u * 0.28, 0.4, 0, 6.28); c.fill();
        c.fillStyle = '#a8713d'; c.beginPath(); c.ellipse(-u * 0.05, -u * 0.27, u * 0.07, u * 0.12, 0.4, 0, 6.28); c.fill();
        c.strokeStyle = '#5a361a'; c.lineWidth = 2; c.beginPath(); c.moveTo(-u * 0.1, -u * 0.05); c.lineTo(u * 0.08, -u * 0.38); c.stroke(); break;
      case 1: // sprout
        c.strokeStyle = '#4fae52'; c.lineWidth = u * 0.07; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(u * 0.05, -u * 0.3, 0, -u * 0.5); c.stroke();
        leaf(c, 0, -u * 0.48, u * 0.4, -0.5 + Math.sin(t * 2 + ph) * 0.08, u * 0.15, '#6fd16b'); leaf(c, 0, -u * 0.48, u * 0.4, Math.PI + 0.5 - Math.sin(t * 2 + ph) * 0.08, u * 0.15, '#58c05a'); break;
      case 2: // tulip
        c.strokeStyle = '#3f9e4a'; c.lineWidth = u * 0.07; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -u * 0.65); c.stroke();
        leaf(c, 0, -u * 0.12, u * 0.45, -0.7, u * 0.12, '#58c05a'); leaf(c, 0, -u * 0.12, u * 0.45, Math.PI + 0.7, u * 0.12, '#58c05a');
        c.fillStyle = '#ff4d6d'; c.beginPath(); c.moveTo(-u * 0.22, -u * 0.62); c.quadraticCurveTo(-u * 0.24, -u * 0.95, -u * 0.12, -u * 0.98); c.lineTo(0, -u * 0.8); c.lineTo(u * 0.12, -u * 0.98); c.quadraticCurveTo(u * 0.24, -u * 0.95, u * 0.22, -u * 0.62); c.quadraticCurveTo(0, -u * 0.5, -u * 0.22, -u * 0.62); c.fill();
        c.fillStyle = '#ff8fa3'; c.beginPath(); c.ellipse(0, -u * 0.75, u * 0.07, u * 0.16, 0, 0, 6.28); c.fill(); break;
      case 3: // sunflower
        c.strokeStyle = '#3f9e4a'; c.lineWidth = u * 0.08; c.lineCap = 'round'; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -u * 0.8); c.stroke();
        leaf(c, 0, -u * 0.25, u * 0.5, -0.5, u * 0.14, '#58c05a'); leaf(c, 0, -u * 0.38, u * 0.5, Math.PI + 0.45, u * 0.14, '#4fae52');
        c.save(); c.translate(0, -u * 0.88); c.rotate(t * 0.25 + ph);
        for (var i = 0; i < 12; i++) { c.rotate(0.5236); leaf(c, u * 0.1, 0, u * 0.3, 0, u * 0.09, i % 2 ? '#ffd23f' : '#ffc300'); }
        blob(c, 0, 0, u * 0.17, '#6b3f1d', '#8a5a2b'); c.restore(); break;
      case 4: // berry bush
        blob(c, -u * 0.3, -u * 0.3, u * 0.32, '#2f8f4e', '#3fae5f'); blob(c, u * 0.3, -u * 0.3, u * 0.32, '#2f8f4e', '#3fae5f'); blob(c, 0, -u * 0.5, u * 0.4, '#37a057', '#4ac174');
        for (i = 0; i < 7; i++) { var a = i * 1.9 + ph; blob(c, Math.cos(a) * u * 0.38, -u * 0.42 + Math.sin(a) * u * 0.28, u * 0.075 + Math.sin(t * 3 + i) * 0.4, '#e63946', '#ff8a95'); } break;
      case 5: // oak
        c.fillStyle = '#7a4d2b'; c.beginPath(); c.moveTo(-u * 0.1, 0); c.lineTo(-u * 0.06, -u * 0.7); c.lineTo(u * 0.06, -u * 0.7); c.lineTo(u * 0.1, 0); c.fill();
        c.save(); c.rotate(sw * 1.2); blob(c, -u * 0.32, -u * 0.8, u * 0.36, '#2e8b4a'); blob(c, u * 0.32, -u * 0.8, u * 0.36, '#2e8b4a'); blob(c, 0, -u * 1.05, u * 0.45, '#37a057', '#52c477'); blob(c, 0, -u * 0.72, u * 0.34, '#2e8b4a'); c.restore(); break;
      case 6: // apple tree
        c.fillStyle = '#7a4d2b'; c.beginPath(); c.moveTo(-u * 0.11, 0); c.lineTo(-u * 0.07, -u * 0.75); c.lineTo(u * 0.07, -u * 0.75); c.lineTo(u * 0.11, 0); c.fill();
        c.save(); c.rotate(sw * 1.2); blob(c, -u * 0.38, -u * 0.85, u * 0.4, '#3a9e55'); blob(c, u * 0.38, -u * 0.85, u * 0.4, '#3a9e55'); blob(c, 0, -u * 1.15, u * 0.5, '#44b562', '#66d683'); blob(c, 0, -u * 0.8, u * 0.38, '#3a9e55');
        [[-0.4, -0.9], [0.35, -0.75], [0.05, -1.2], [-0.15, -0.65], [0.45, -1.0]].forEach(function (a, j) { blob(c, a[0] * u, a[1] * u + Math.sin(t * 2 + j) * 1.2, u * 0.1, '#e63946', '#ff8a95'); }); c.restore(); break;
      case 7: // golden tree
        var gl = c.createRadialGradient(0, -u * 0.9, 0, 0, -u * 0.9, u * 1.3); gl.addColorStop(0, 'rgba(255,230,120,.7)'); gl.addColorStop(1, 'rgba(255,230,120,0)'); c.fillStyle = gl; c.fillRect(-u * 1.3, -u * 2.2, u * 2.6, u * 2.6);
        c.fillStyle = '#9b6a2f'; c.beginPath(); c.moveTo(-u * 0.12, 0); c.lineTo(-u * 0.07, -u * 0.8); c.lineTo(u * 0.07, -u * 0.8); c.lineTo(u * 0.12, 0); c.fill();
        c.save(); c.rotate(sw); blob(c, -u * 0.4, -u * 0.95, u * 0.42, '#f2b705', '#ffe066'); blob(c, u * 0.4, -u * 0.95, u * 0.42, '#f2b705', '#ffe066'); blob(c, 0, -u * 1.25, u * 0.52, '#ffc300', '#fff1a8'); blob(c, 0, -u * 0.9, u * 0.4, '#f2b705');
        for (i = 0; i < 5; i++) { var sa = (t * 1.3 + i * 1.26 + ph) % 6.28, sa2 = 0.5 + 0.5 * Math.sin(t * 4 + i * 2); c.globalAlpha = sa2; c.fillStyle = '#fff'; c.beginPath(); c.arc(Math.cos(sa) * u * 0.55, -u * 1.05 + Math.sin(sa) * u * 0.45, 2.5, 0, 6.28); c.fill(); } c.globalAlpha = 1; c.restore(); break;
    }
    c.restore();
  }
  function drawCreatures(c, w, h, t, d) {
    flies.forEach(function (f) {
      f.a += 0.012 + Math.sin(t + f.p) * 0.01; f.x += Math.cos(f.a) * 0.0009; f.y += Math.sin(f.a * 1.3) * 0.0006;
      if (f.x < -0.05) f.x = 1.05; if (f.x > 1.05) f.x = -0.05; f.y = PG.clamp(f.y, 0.15, 0.75);
      var x = f.x * w, y = f.y * h, fl = Math.abs(Math.sin(t * 14 + f.p));
      if (d < 0.35) { // fireflies at night
        c.fillStyle = 'rgba(255,240,140,' + (0.5 + 0.5 * Math.sin(t * 3 + f.p)) + ')'; c.beginPath(); c.arc(x, y, 3, 0, 6.28); c.fill();
        var g = c.createRadialGradient(x, y, 0, x, y, 14); g.addColorStop(0, 'rgba(255,240,140,.5)'); g.addColorStop(1, 'rgba(255,240,140,0)'); c.fillStyle = g; c.fillRect(x - 14, y - 14, 28, 28);
      } else { c.fillStyle = f.c; c.save(); c.translate(x, y); [-1, 1].forEach(function (sd) { c.beginPath(); c.ellipse(sd * 5 * (0.3 + fl * 0.7), -2, 5 * fl + 1.5, 4, sd * 0.4, 0, 6.28); c.fill(); }); c.fillStyle = '#333'; c.fillRect(-0.8, -3, 1.6, 7); c.restore(); }
    });
    petals.forEach(function (p) { p.y += p.v * 0.016; p.x += Math.sin(t * 0.8 + p.p) * 0.0004 + 0.0003; if (p.y > 1.05) { p.y = -0.05; p.x = Math.random(); } c.globalAlpha = 0.65 * d + 0.1; c.fillStyle = p.c; c.save(); c.translate(p.x * w, p.y * h); c.rotate(t + p.p); c.beginPath(); c.ellipse(0, 0, 4, 2.2, 0, 0, 6.28); c.fill(); c.restore(); });
    c.globalAlpha = 1;
  }

  /* ------------ UI ------------ */
  function drawHandChip(c, tier, x, y, r, label, sub, active, t) {
    c.save(); c.beginPath(); c.arc(x, y, r, 0, 6.28); c.fillStyle = active ? 'rgba(255,255,255,.88)' : 'rgba(255,255,255,.6)'; c.fill(); c.lineWidth = active ? 4 : 2.5; c.strokeStyle = active ? '#ffd23f' : 'rgba(255,255,255,.8)'; c.stroke();
    c.beginPath(); c.arc(x, y, r - 4, 0, 6.28); c.clip();
    if (tier >= 0) drawCrop(c, tier, x, y + r * 0.45, r * 0.8, t, 1, 1);
    c.restore();
    U.text(c, label, x, y + r + 14, 13, '#fff', 'center', { stroke: 'rgba(0,0,0,.35)' });
    if (sub) U.text(c, sub, x, y - r - 10, 12, '#ffe', 'center');
  }
  function drawUI(c, w, h, t) {
    var sc = PG.scale(), portrait = h > w;
    // score
    U.text(c, PG.fmt(st.score), 16 * sc, 30 * sc, 38 * sc, '#fff', 'left', { stroke: 'rgba(0,0,0,.35)' });
    U.text(c, 'BEST ' + PG.fmt(PG.save.best || 0), 16 * sc, 58 * sc, 14 * sc, '#fff', 'left');
    // discovered crops row
    var rowY = 84 * sc, ico = 17 * sc;
    for (var i = 0; i <= MAXT; i++) {
      var ix = 16 * sc + ico + i * ico * 2.1, found = i <= Math.max(st.maxT, PG.save.found || 0);
      c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.arc(ix, rowY, ico, 0, 6.28); c.fill();
      c.save(); c.beginPath(); c.arc(ix, rowY, ico, 0, 6.28); c.clip();
      if (found) drawCrop(c, i, ix, rowY + ico * 0.9, ico * 0.95, t, i, 1); else { c.fillStyle = 'rgba(255,255,255,.25)'; c.font = '700 ' + ico + 'px ' + PG.font; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', ix, rowY); }
      c.restore();
      if (i === st.maxT) { c.strokeStyle = '#ffd23f'; c.lineWidth = 2; c.beginPath(); c.arc(ix, rowY, ico, 0, 6.28); c.stroke(); }
    }
    // hand + hold + next
    var r = Math.min(46 * sc, w * 0.12), by = h - r - 36 * sc, bx = w / 2;
    drawHandChip(c, st.hand, bx, by, r * 1.15, 'Tap the island to plant', '', true, t);
    var hr = r * 0.7;
    var holdX = bx - r * 2.7, nextX = bx + r * 2.7;
    drawHandChip(c, st.hold, holdX, by + r * 0.15, hr, 'HOLD (swap)', '', false, t);
    drawHandChip(c, st.next, nextX, by + r * 0.15, hr, 'NEXT', '', false, t);
    if (!st.over && U.hit(holdX - hr, by + r * 0.15 - hr, hr * 2, hr * 2)) swapHold();
    if (st.tutorial && st.moves === 0) U.text(c, 'Match 3 touching crops to grow them', w / 2, h * 0.17 + 40 * sc, 17 * sc, '#fff', 'center', { stroke: 'rgba(0,0,0,.4)' });
    // banner
    if (banner) { banner.t += 0.016; var a = Math.min(1, banner.t * 4) * Math.min(1, (2.2 - banner.t) * 3); if (banner.t > 2.2) banner = null; else { c.globalAlpha = Math.max(0, a); U.text(c, banner.s, w / 2, h * 0.2 + 70 * sc, 28 * sc, '#ffd23f', 'center', { stroke: 'rgba(0,0,0,.55)' }); c.globalAlpha = 1; } }
  }
  U.hit = function (x, y, w, h) { var I = PG.input; if (I.released && PG.inRect(x, y, w, h) && PG.inRect(x, y, w, h, I.px, I.py)) { I.released = false; PG.sfx('tap'); return true; } return false; };

  function menu(c, w, h, t) {
    var sc = PG.scale();
    c.fillStyle = 'rgba(10,14,30,.35)'; c.fillRect(0, 0, w, h);
    var bob = Math.sin(t * 2) * 6;
    drawCrop(c, 7, w / 2, h * 0.42 + bob, Math.min(w, h) * 0.2, t, 0, 1);
    U.text(c, 'HEX HARVEST', w / 2, h * 0.17, Math.min(52 * sc, w * 0.13), '#fff', 'center', { stroke: '#2a6f3e' });
    U.text(c, 'Merge crops. Grow a Golden Tree.', w / 2, h * 0.17 + 40 * sc, 17 * sc, '#fffbe0', 'center');
    var bw = 220 * sc, bh = 62 * sc;
    var canResume = PG.save.board && PG.save.board.t;
    if (U.button(c, w / 2 - bw / 2, h * 0.64, bw, bh, canResume ? 'Continue' : 'Play', { color: '#ff9f1c' })) newGame(!!canResume);
    if (canResume && U.button(c, w / 2 - bw / 2, h * 0.64 + bh + 14 * sc, bw, bh * 0.8, 'New game', { color: '#2ec4b6' })) { PG.save.board = null; newGame(false); }
    if (PG.save.best) U.text(c, 'Best ' + PG.fmt(PG.save.best) + '  -  Games ' + (PG.save.games || 0), w / 2, h * 0.64 + bh * 2.4 + 14 * sc, 16 * sc, '#fff', 'center');
  }
  function gameOver(c, w, h, t) {
    var sc = PG.scale(); overT += 0.016; var k = PG.ease.out(Math.min(1, overT * 2));
    c.fillStyle = 'rgba(8,10,24,' + 0.55 * k + ')'; c.fillRect(0, 0, w, h);
    var pw = Math.min(w * 0.88, 380 * sc), ph = 330 * sc, px = w / 2 - pw / 2, py = h * 0.5 - ph / 2 + (1 - k) * 60;
    U.panel(c, px, py, pw, ph);
    U.text(c, 'Island Full!', w / 2, py + 40 * sc, 34 * sc, '#ffd23f', 'center');
    U.text(c, PG.fmt(st.score), w / 2, py + 92 * sc, 50 * sc, '#fff', 'center');
    var nb = st.score >= (PG.save.best || 0) && st.score > 0;
    U.text(c, nb ? 'NEW BEST!' : 'Best ' + PG.fmt(PG.save.best || 0), w / 2, py + 132 * sc, 18 * sc, nb ? '#9be564' : '#cbd5e1', 'center');
    U.text(c, 'Top crop: ' + TIERS[st.maxT].n, w / 2, py + 158 * sc, 16 * sc, '#fff', 'center');
    var bw = pw * 0.82, bh = 54 * sc, yy = py + 182 * sc;
    if (!st.usedRev && PG.rewardedSupported()) { if (U.button(c, w / 2 - bw / 2, yy, bw, bh, 'Watch ad: clear 8 crops', { color: '#8338ec', size: 17 * sc })) { PG.rewarded('continue').then(function (ok) { if (ok) { reviveClear(); PG.track('rewarded_continue', { step_id: 'run' }); } }); } yy += bh + 12 * sc; }
    if (U.button(c, w / 2 - bw / 2, yy, bw, bh, 'Play again', { color: '#ff9f1c' })) { PG.interstitial('game_over').then(function () { newGame(false); }); }
  }

  /* ------------ main ------------ */
  PG.onResize = layout;
  PG.onMove = function (x, y) { if (st.state === 'play') hover = pickCell(x, y); };
  PG.onDown = function (x, y) { if (st.state !== 'play' || st.over || PG.userPaused) return; var cl = pickCell(x, y); hover = cl; aiming = !!cl; };
  PG.onUp = function (x, y) {
    if (st.state !== 'play' || st.over || PG.userPaused) { aiming = false; return; }
    var cl = pickCell(x, y); if (aiming && cl && cl.t === -1 && y < PG.h - 120 * PG.scale()) place(cl); aiming = false; if (PG.touch) hover = null;
  };
  function update(dt) { bgT += dt; PG.updateParts(dt); PG.updatePops(dt); shake = Math.max(0, shake - dt * 30); }
  function render(c, w, h, dt) {
    var t = bgT + 6; layout(w, h);
    c.save(); if (shake > 0.1) c.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    var d = drawWorld(c, w, h, t);
    drawIsland(c, t, d);
    // flying merged crops
    for (var i = anims.length - 1; i >= 0; i--) { var a = anims[i]; a.t += dt * 4; if (a.t >= 1) { anims.splice(i, 1); continue; } var e = PG.ease.io(a.t); drawCrop(c, a.tier, PG.lerp(a.from.x, a.to.x, e), PG.lerp(a.from.y, a.to.y, e) - Math.sin(a.t * 3.14) * geo.s, geo.s, t, 0, 1 - a.t * 0.5); }
    drawCreatures(c, w, h, t, d);
    PG.drawParts(c); PG.drawPops(c);
    c.restore();
    if (st.state === 'menu') menu(c, w, h, t); else { drawUI(c, w, h, t); if (st.over) gameOver(c, w, h, t); }
  }
  PG.setup(document.getElementById('c'), update, render);
  window.__hex = { cells: cells, st: st, newGame: newGame, place: place };
  PG.init({ id: 'hex_harvest', version: '1.0.0', defaults: { best: 0, games: 0, found: 0, board: null, muted: false } }).then(function () {
    PG.music({ scale: [0, 2, 4, 7, 9], root: 220, bpm: 84, wave: 'triangle', vol: 0.06, bass: 0.08 });
    PG.hudHidePause = false; PG._applyAudio();
  });
})();
