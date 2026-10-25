/* JELLY JAM - drag wobbly jelly pieces onto the board. Fill rows and columns to clear them; single-colour lines are Pure Jam.
   Art direction: kawaii candy shop. Glossy jellies with faces, a candy box board, frosting and sprinkles. */
(function () {
  'use strict';
  var U = PG.ui, TAU = 6.2832, N = 8;
  var COLS = ['#ff6f91', '#ffa45b', '#ffd84d', '#7ed957', '#5ab8ff', '#b78bff', '#ff8fd6'];
  var PLUM = '#7a2e5c', PINK = '#ff7eb6', CREAM = '#fff7fb';
  var SHAPES = [ // [cells], weight, big
    [[0, 0]], [[0, 0], [1, 0]], [[0, 0], [0, 1]], [[0, 0], [1, 0], [2, 0]], [[0, 0], [0, 1], [0, 2]], [[0, 0], [1, 0], [2, 0], [3, 0]], [[0, 0], [0, 1], [0, 2], [0, 3]],
    [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]], [[0, 0], [1, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]],
    [[0, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [0, 1]], [[1, 0], [0, 1], [1, 1]], [[0, 0], [1, 0], [1, 1]],
    [[0, 0], [0, 1], [0, 2], [1, 2]], [[1, 0], [1, 1], [1, 2], [0, 2]], [[0, 0], [1, 0], [2, 0], [0, 1]], [[0, 0], [1, 0], [2, 0], [2, 1]],
    [[0, 0], [1, 0], [2, 0], [1, 1]], [[1, 0], [0, 1], [1, 1], [2, 1]], [[0, 0], [1, 0], [1, 1], [2, 1]], [[1, 0], [2, 0], [0, 1], [1, 1]],
    [[0, 0], [0, 1], [0, 2], [1, 0], [2, 0]], [[0, 0], [1, 0], [2, 0], [2, 1], [2, 2]], [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]]
  ];
  var BIG = { 7: 1, 8: 1, 10: 1, 23: 1, 24: 1, 25: 1, 5: 0.5, 6: 0.5 };
  var UPS = [
    { id: 'easy', n: 'Easy Shapes', d: 'Fewer huge pieces', max: 6, base: 25, grow: 1.5 },
    { id: 'undo', n: 'Undo Jar', d: '+1 undo each run', max: 4, base: 35, grow: 1.6 },
    { id: 'spin', n: 'Spin Charges', d: '+2 piece rotations per run', max: 5, base: 40, grow: 1.5 },
    { id: 'pure', n: 'Pure Power', d: '+25% Pure Jam bonus', max: 6, base: 45, grow: 1.55 },
    { id: 'coin', n: 'Coin Jar', d: '+15% coins', max: 8, base: 30, grow: 1.5 }
  ];
  var st = { state: 'menu', g: [], hand: [], score: 0, combo: 0, over: false, overT: 0, undoLeft: 0, spinLeft: 0, prev: null, drag: null, coinsRun: 0, paid: 0, coinsShown: 0, lines: 0, pure: 0, revUsed: false, doubled: false, runIdx: 0, moves: 0, newBest: false, shake: 0, hint: 0 };
  var geo = { cell: 40, gx: 0, gy: 0, slots: [], trayCell: 20 };
  var sprinkles = []; for (var i = 0; i < 34; i++) sprinkles.push({ x: Math.random(), y: Math.random(), r: Math.random() * 6, c: COLS[i % COLS.length], s: 0.3 + Math.random() });

  function emptyGrid() { var g = []; for (var y = 0; y < N; y++) { g.push([]); for (var x = 0; x < N; x++) g[y].push(null); } return g; }
  function cloneG(g) { return g.map(function (r) { return r.map(function (c) { return c ? { c: c.c, pid: c.pid, f: c.f, wob: 0, sc: 1 } : null; }); }); }
  function rotShape(cells) { var h = Math.max.apply(null, cells.map(function (c) { return c[1]; })); return cells.map(function (c) { return [h - c[1], c[0]]; }); }
  function bounds(cells) { return { w: Math.max.apply(null, cells.map(function (c) { return c[0]; })) + 1, h: Math.max.apply(null, cells.map(function (c) { return c[1]; })) + 1 }; }
  function canPlace(cells, ox, oy) { for (var i = 0; i < cells.length; i++) { var x = ox + cells[i][0], y = oy + cells[i][1]; if (x < 0 || y < 0 || x >= N || y >= N || st.g[y][x]) return false; } return true; }
  function fitsAnywhere(cells) { for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (canPlace(cells, x, y)) return true; return false; }
  function fitsWithSpins(cells, spins) { var c = cells; for (var r = 1; r <= Math.min(3, spins); r++) { c = rotShape(c); if (fitsAnywhere(c)) return true; } return false; }
  function newPiece() {
    var easy = PG.upLevel('easy'), w = SHAPES.map(function (s, i) { var b = BIG[i]; var k = b ? Math.max(0.12, b * (1 - easy * 0.17)) : 1; if (s.length === 1) k *= 0.6 + easy * 0.12; return k; }), tot = w.reduce(function (a, b) { return a + b; }, 0), r = Math.random() * tot, idx = 0;
    for (var i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) { idx = i; break; } } return { cells: SHAPES[idx], c: Math.floor(Math.random() * COLS.length), id: Math.random(), used: false, pop: 0 };
  }
  function newHand() {
    for (var t = 0; t < 30; t++) { var h = [newPiece(), newPiece(), newPiece()]; if (h.some(function (p) { return fitsAnywhere(p.cells); })) { st.hand = h; return; } } st.hand = [newPiece(), newPiece(), newPiece()];
  }
  function startRun(resume) {
    st.g = emptyGrid(); st.score = 0; st.combo = 0; st.over = false; st.prev = null; st.drag = null; st.coinsRun = 0; st.paid = 0; st.coinsShown = 0; st.lines = 0; st.pure = 0; st.revUsed = false; st.doubled = false; st.moves = 0; st.newBest = false; st.state = 'play'; st.hint = 0;
    st.undoLeft = 1 + PG.upLevel('undo'); st.spinLeft = 2 * PG.upLevel('spin'); PG.parts = []; PG.pops = []; PG.playing = true;
    if (resume && PG.save.board) { var b = PG.save.board; for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var v = b.g[y][x]; st.g[y][x] = v !== null && v !== undefined ? { c: v % 10, f: v >= 10, pid: v >= 10 ? Math.random() : 0, wob: 0, sc: 1 } : null; } st.score = b.score; st.hand = b.hand.map(function (h) { return h ? { cells: h.cells, c: h.c, id: Math.random(), used: false, pop: 0 } : { used: true, cells: [[0, 0]], c: 0, id: Math.random(), pop: 0 }; }); st.moves = b.moves || 0; st.undoLeft = b.undo; st.spinLeft = b.spin; st.coinsRun = b.coins || 0; st.lines = b.lines || 0; st.pure = b.pure || 0; }
    else { newHand(); st.runIdx++; PG.track('progression_started', { step_id: 'run', step_index: Math.min(st.runIdx, 50) }); PG.msg('level_started', { level: String(st.runIdx) }); }
    for (var i = 0; i < 3; i++) if (st.hand[i]) st.hand[i].pop = 0;
  }
  function persist() {
    PG.save.board = st.over ? null : { g: st.g.map(function (r) { return r.map(function (c) { return c ? c.c + (c.f ? 10 : 0) : null; }); }), score: st.score, hand: st.hand.map(function (h) { return h.used ? null : { cells: h.cells, c: h.c }; }), moves: st.moves, undo: st.undoLeft, spin: st.spinLeft, coins: st.coinsRun, lines: st.lines, pure: st.pure }; PG.commit();
  }
  function faceCell(cells) { return Math.floor((cells.length - 1) / 2); }
  function checkStuck() { // out of moves unless a spin can still rescue a piece
    if (st.hand.some(function (h) { return !h.used && fitsAnywhere(h.cells); })) return;
    if (st.spinLeft > 0 && st.hand.some(function (h) { return !h.used && fitsWithSpins(h.cells, st.spinLeft); })) { st.hint = 3; return; }
    gameOver();
  }
  function place(slot, ox, oy) {
    var p = st.hand[slot]; st.prev = { g: cloneG(st.g), hand: st.hand.map(function (h) { return { cells: h.cells, c: h.c, id: h.id, used: h.used, pop: 0 }; }), score: st.score, combo: st.combo, coins: st.coinsRun, lines: st.lines, pure: st.pure };
    var pid = Math.random(), fi = faceCell(p.cells); p.cells.forEach(function (cl, k) { st.g[oy + cl[1]][ox + cl[0]] = { c: p.c, pid: pid, f: k === fi, wob: 1, sc: 0.6 }; }); p.used = true; st.score += p.cells.length * 10; st.moves++; PG.sfx('drop', 1 + Math.random() * 0.2); PG.vibrate(8);
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (st.g[y][x] && st.g[y][x].wob < 0.4) { var near = false; p.cells.forEach(function (cl) { if (Math.abs(ox + cl[0] - x) + Math.abs(oy + cl[1] - y) <= 2) near = true; }); if (near) st.g[y][x].wob = 0.45; }
    var rows = [], cols = [], pureLines = 0; for (y = 0; y < N; y++) if (st.g[y].every(function (c) { return c; })) rows.push(y); for (x = 0; x < N; x++) { var full = true; for (y = 0; y < N; y++) if (!st.g[y][x]) { full = false; break; } if (full) cols.push(x); }
    var kill = {}, nLines = rows.length + cols.length;
    rows.forEach(function (r) { var c0 = st.g[r][0].c, pu = st.g[r].every(function (c) { return c.c === c0; }); if (pu) pureLines++; for (var x2 = 0; x2 < N; x2++) kill[r + ',' + x2] = 1; });
    cols.forEach(function (cx) { var c0 = st.g[0][cx].c, pu = true; for (var y2 = 0; y2 < N; y2++) { if (st.g[y2][cx].c !== c0) pu = false; kill[y2 + ',' + cx] = 1; } if (pu) pureLines++; });
    if (nLines > 0) {
      st.combo++; var base = 100 * nLines * nLines, pureB = pureLines * 200 * (1 + 0.25 * PG.upLevel('pure')), gain = Math.round((base + pureB) * (1 + (st.combo - 1) * 0.5)); st.score += gain; st.lines += nLines; st.pure += pureLines;
      var coin = (nLines + pureLines * 3) * (1 + 0.15 * PG.upLevel('coin')) * (1 + (st.combo - 1) * 0.25); coin = Math.max(1, Math.round(coin)); st.coinsRun += coin;
      Object.keys(kill).forEach(function (k) { var yx = k.split(','), yy = +yx[0], xx = +yx[1], c = st.g[yy][xx], q = cellPos(xx, yy); if (c) { PG.burst(q.x, q.y, 5, { colors: [COLS[c.c], '#fff', COLS[c.c]], g: 600, min: 60, max: 280, life: 0.9, s0: 3, s1: 6, shape: Math.random() < 0.5 ? heartP : starP }); st.g[yy][xx] = null; } });
      var cx0 = geo.gx + geo.cell * N / 2, cy0 = geo.gy + geo.cell * N / 2; PG.popText(cx0, cy0 - 20, '+' + gain, '#fff', 34); if (pureLines) PG.popText(cx0, cy0 + 20, 'PURE JAM x' + pureLines + '!', '#ffe066', 26); if (st.combo > 1) PG.popText(cx0, cy0 - 56, 'Combo x' + st.combo, '#ffb3e0', 24);
      PG.sfx(pureLines ? 'win' : 'merge', 1 + nLines * 0.1); st.shake = 6 + nLines * 2; if (st.score > (PG.save.best || 0)) { if (!st.newBest && PG.save.best) PG.sfx('perfect'); st.newBest = true; }
    } else st.combo = 0;
    if (st.hand.every(function (h) { return h.used; })) newHand();
    if (st.score > (PG.save.best || 0)) PG.save.best = st.score;
    checkStuck(); persist();
  }
  function gameOver() {
    st.over = true; st.overT = 0; PG.playing = false;
    var earned = st.coinsRun + Math.floor(st.score / 200), owed = earned - st.paid; if (owed > 0) { PG.save.coins = (PG.save.coins || 0) + owed; st.paid = earned; } st.coinsShown = earned; // a revive never pays the same coins twice
    PG.save.runs = (PG.save.runs || 0) + 1; PG.save.board = null; PG.commit(true); PG.sfx('lose');
    PG.track('progression_failed', { step_id: 'run', step_index: Math.min(st.runIdx, 50), score: st.score, lines: st.lines, pure: st.pure, moves: st.moves }); PG.msg('level_failed', { level: String(st.runIdx) });
  }
  function undo() { if (!st.prev || st.undoLeft <= 0 || st.over) return; st.g = st.prev.g; st.hand = st.prev.hand; st.score = st.prev.score; st.combo = st.prev.combo; st.coinsRun = st.prev.coins; st.lines = st.prev.lines; st.pure = st.prev.pure; st.prev = null; st.undoLeft--; PG.sfx('whoosh'); persist(); }
  function rotate(slot) { var p = st.hand[slot]; if (p.used) return; if (st.spinLeft <= 0) { PG.sfx('err'); return; } p.cells = rotShape(p.cells); st.spinLeft--; p.pop = 0.4; PG.sfx('rotate'); checkStuck(); persist(); }
  function revive() { var cells = []; for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (st.g[y][x]) cells.push([x, y]); for (var i = 0; i < 14 && cells.length; i++) { var k = Math.floor(Math.random() * cells.length), c = cells.splice(k, 1)[0], q = cellPos(c[0], c[1]); PG.burst(q.x, q.y, 5, { colors: [COLS[st.g[c[1]][c[0]].c]], g: 500, shape: heartP }); st.g[c[1]][c[0]] = null; } st.over = false; st.revUsed = true; PG.playing = true; PG.sfx('upgrade'); checkStuck(); persist(); }
  function heartP(c, p, k) { var s = p.size * (0.5 + 0.5 * k); c.save(); c.translate(p.x, p.y); c.rotate(p.rot * 0.3); c.beginPath(); c.moveTo(0, s * 0.8); c.bezierCurveTo(-s * 1.4, -s * 0.2, -s * 0.5, -s * 1.2, 0, -s * 0.35); c.bezierCurveTo(s * 0.5, -s * 1.2, s * 1.4, -s * 0.2, 0, s * 0.8); c.fill(); c.restore(); }
  function starP(c, p, k) { var s = p.size * (0.5 + 0.5 * k); c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.beginPath(); for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5, r = i % 2 ? s * 0.45 : s; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.fill(); c.restore(); }

  /* ---------- layout ---------- */
  function layout(w, h) {
    var sc = PG.scale(), landscape = w > h * 1.15;
    if (!landscape) { geo.cell = Math.min(w * 0.92 / N, (h - 340 * sc) / N, 62 * sc); geo.gx = (w - geo.cell * N) / 2; geo.gy = 124 * sc; geo.trayY = geo.gy + geo.cell * N + 26 * sc; geo.trayH = h - geo.trayY - 14 * sc; geo.trayCell = Math.min(geo.cell * 0.62, geo.trayH / 3.6, w / 12);
      var cw = w / 3; for (var i = 0; i < 3; i++) geo.slots[i] = { x: cw * i + cw / 2, y: geo.trayY + geo.trayH / 2, w: cw, h: geo.trayH }; }
    else { geo.cell = Math.min((h - 90 * sc) / N, w * 0.5 / N, 70 * sc); geo.gx = w * 0.5 - geo.cell * N * 0.62; geo.gy = (h - geo.cell * N) / 2 + 30 * sc; geo.trayCell = Math.min(geo.cell * 0.62, h / 12); var tx = geo.gx + geo.cell * N + 50 * sc, th = h / 3; for (i = 0; i < 3; i++) geo.slots[i] = { x: tx + 100 * sc, y: th * i + th / 2 + 20 * sc, w: 220 * sc, h: th }; }
  }
  function cellPos(x, y) { return { x: geo.gx + (x + 0.5) * geo.cell, y: geo.gy + (y + 0.5) * geo.cell }; }

  /* ---------- jellies (glossy sprites cached per colour and size) ---------- */
  var jCache = {};
  function jellySprite(ci, s) {
    var d = PG.dpr || 1, key = ci + ':' + Math.round(s * d); if (jCache[key]) return jCache[key];
    var S = Math.ceil(s * 1.2), cv = document.createElement('canvas'); cv.width = cv.height = Math.ceil(S * d); var c = cv.getContext('2d'); c.scale(d, d); c.translate(S / 2, S / 2);
    var col = COLS[ci], r = s * 0.5, pad = s * 0.05, rr = s * 0.3;
    c.fillStyle = U.shade(col, -0.3); U.rr(c, -r + pad, -r + pad + s * 0.04, s - pad * 2, s - pad * 2, rr); c.fill();
    var g = c.createLinearGradient(0, -r, 0, r); g.addColorStop(0, U.shade(col, 0.28)); g.addColorStop(0.55, col); g.addColorStop(1, U.shade(col, -0.08)); c.fillStyle = g; U.rr(c, -r + pad, -r + pad, s - pad * 2, s - pad * 2.6, rr); c.fill();
    var ig = c.createRadialGradient(0, r * 0.2, 0, 0, r * 0.2, r); ig.addColorStop(0, 'rgba(255,255,255,.22)'); ig.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = ig; U.rr(c, -r + pad, -r + pad, s - pad * 2, s - pad * 2.6, rr); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = Math.max(1, s * 0.035); U.rr(c, -r + pad * 1.8, -r + pad * 1.8, s - pad * 3.6, s - pad * 4.2, rr * 0.8); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.ellipse(-r * 0.32, -r * 0.5, r * 0.28, r * 0.11, -0.2, 0, TAU); c.fill(); c.beginPath(); c.arc(-r * 0.66, -r * 0.24, r * 0.06, 0, TAU); c.fill();
    c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(r * 0.5, r * 0.42, r * 0.07, 0, TAU); c.fill();
    cv.S = S; return (jCache[key] = cv);
  }
  function face(c, s, mood, blink) { // mood: happy | wow | o
    var r = s * 0.5, ex = r * 0.3, ey = r * 0.05; c.fillStyle = '#4a1d3a'; c.strokeStyle = '#4a1d3a'; c.lineCap = 'round'; c.lineWidth = Math.max(1.2, s * 0.05);
    if (mood === 'wow') { [-1, 1].forEach(function (d) { c.beginPath(); c.moveTo(d * ex - d * r * 0.1, ey - r * 0.1); c.lineTo(d * ex + d * r * 0.06, ey); c.lineTo(d * ex - d * r * 0.1, ey + r * 0.1); c.stroke(); }); }
    else if (blink) { [-1, 1].forEach(function (d) { c.beginPath(); c.moveTo(d * ex - r * 0.09, ey); c.lineTo(d * ex + r * 0.09, ey); c.stroke(); }); }
    else { [-1, 1].forEach(function (d) { c.beginPath(); c.arc(d * ex, ey, r * 0.1, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(d * ex - r * 0.03, ey - r * 0.04, r * 0.035, 0, TAU); c.fill(); c.fillStyle = '#4a1d3a'; }); }
    if (mood === 'o') { c.beginPath(); c.ellipse(0, ey + r * 0.24, r * 0.07, r * 0.09, 0, 0, TAU); c.fill(); }
    else { c.beginPath(); c.arc(-r * 0.06, ey + r * 0.18, r * 0.06, 0.1, Math.PI - 0.1); c.arc(r * 0.06, ey + r * 0.18, r * 0.06, 0.1, Math.PI - 0.1); c.stroke(); }
    c.fillStyle = 'rgba(255,90,140,.4)'; c.beginPath(); c.ellipse(-r * 0.52, ey + r * 0.16, r * 0.12, r * 0.07, 0, 0, TAU); c.ellipse(r * 0.52, ey + r * 0.16, r * 0.12, r * 0.07, 0, 0, TAU); c.fill();
  }
  function jelly(c, ci, x, y, s, wob, t, o) {
    o = o || {}; var k = 1 + Math.sin(t * 14) * wob * 0.08, sq = wob * Math.sin(t * 18 + 1) * 0.07; c.save(); c.translate(x, y); c.scale((o.sc || 1) * (k + sq), (o.sc || 1) * (k - sq)); if (o.alpha !== undefined) c.globalAlpha = o.alpha;
    var spr = jellySprite(ci, s); c.drawImage(spr, -spr.S / 2, -spr.S / 2, spr.S, spr.S);
    if (o.face) face(c, s, o.mood, o.blink);
    c.restore();
  }
  function bridge(c, ci, x, y, s, dir) { var col = COLS[ci], r = s * 0.5; c.fillStyle = col; if (dir === 'r') c.fillRect(x + r - s * 0.12, y - r + s * 0.22, s * 0.24, s * 0.5); else c.fillRect(x - r + s * 0.22, y + r - s * 0.14, s * 0.56, s * 0.24); }
  function blinkFor(seed, t) { return ((t + seed * 7.3) % 4.2) < 0.13; }
  function drawPiece(c, p, cx, cy, cs, t, alpha, wobble, mood) {
    var b = bounds(p.cells), ox = cx - b.w * cs / 2, oy = cy - b.h * cs / 2, set = {}, fi = faceCell(p.cells); p.cells.forEach(function (q) { set[q[0] + ',' + q[1]] = 1; });
    c.save(); if (alpha !== undefined) c.globalAlpha = alpha;
    p.cells.forEach(function (q) { var x = ox + (q[0] + 0.5) * cs, y = oy + (q[1] + 0.5) * cs; if (set[(q[0] + 1) + ',' + q[1]]) bridge(c, p.c, x, y, cs, 'r'); if (set[q[0] + ',' + (q[1] + 1)]) bridge(c, p.c, x, y, cs, 'd'); });
    p.cells.forEach(function (q, k) { jelly(c, p.c, ox + (q[0] + 0.5) * cs, oy + (q[1] + 0.5) * cs, cs, wobble === undefined ? 0.25 : wobble, t + q[0] * 0.3 + q[1] * 0.2, { face: k === fi, mood: mood, blink: blinkFor(p.id || 0, t) }); });
    c.restore();
  }

  /* ---------- scene ---------- */
  var bgCache = null;
  function drawBG(c, w, h, t) {
    if (!bgCache || bgCache.w !== w || bgCache.h !== h) {
      var d = PG.dpr || 1, cv = document.createElement('canvas'); cv.width = Math.ceil(w * d); cv.height = Math.ceil(h * d); var q = cv.getContext('2d'); q.scale(d, d);
      q.fillStyle = '#ffe3ef'; q.fillRect(0, 0, w, h); q.save(); q.rotate(-0.5); q.fillStyle = '#ffd3e6'; for (var x = -h; x < w + h; x += 56) q.fillRect(x, -h, 26, h * 3); q.restore();
      q.fillStyle = 'rgba(255,255,255,.55)'; for (var y = 0; y < h; y += 34) for (var xx = ((y / 34) % 2) * 17; xx < w; xx += 34) { q.beginPath(); q.arc(xx, y, 3, 0, TAU); q.fill(); }
      var fh = 26 * PG.scale(); q.fillStyle = '#fff'; q.fillRect(0, 0, w, fh * 0.6); for (var i = 0; i < w; i += fh * 0.9) { var dl = fh * (0.5 + PG.hash(i) * 0.9); q.beginPath(); q.arc(i + fh * 0.45, fh * 0.6, fh * 0.45, 0, Math.PI); q.fill(); q.beginPath(); q.moveTo(i + fh * 0.3, fh * 0.6); q.lineTo(i + fh * 0.3, fh * 0.6 + dl); q.arc(i + fh * 0.45, fh * 0.6 + dl, fh * 0.15, Math.PI, 0, true); q.lineTo(i + fh * 0.6, fh * 0.6); q.fill(); }
      q.fillStyle = 'rgba(255,170,205,.35)'; q.fillRect(0, fh * 0.55, w, 2);
      bgCache = { w: w, h: h, cv: cv };
    }
    c.drawImage(bgCache.cv, 0, 0, w, h);
    sprinkles.forEach(function (s) { c.save(); c.translate(((s.x + t * 0.004 * s.s) % 1) * w, ((s.y + t * 0.01 * s.s) % 1) * h); c.rotate(t * s.s * 0.5 + s.r); c.fillStyle = s.c; c.globalAlpha = 0.6; U.rr(c, -6, -2, 12, 4, 2); c.fill(); c.restore(); }); c.globalAlpha = 1;
  }
  function scallop(c, x, y, w, h, r, col) { // frosting-edged rounded box
    c.fillStyle = col; U.rr(c, x, y, w, h, r); c.fill(); var step = r * 0.9;
    for (var i = x + r; i < x + w - r * 0.5; i += step) { c.beginPath(); c.arc(i, y, step * 0.5, 0, TAU); c.arc(i, y + h, step * 0.5, 0, TAU); c.fill(); }
    for (var j = y + r; j < y + h - r * 0.5; j += step) { c.beginPath(); c.arc(x, j, step * 0.5, 0, TAU); c.arc(x + w, j, step * 0.5, 0, TAU); c.fill(); }
  }
  function drawBoard(c, w, h, t) {
    var cs = geo.cell, bx = geo.gx - 12, by = geo.gy - 12, bw = cs * N + 24;
    c.fillStyle = 'rgba(160,60,120,.2)'; U.rr(c, bx + 2, by + 10, bw, bw, 22); c.fill();
    scallop(c, bx, by, bw, bw, 20, '#fff');
    c.fillStyle = '#ff9cc8'; U.rr(c, bx + 6, by + 6, bw - 12, bw - 12, 16); c.fill(); c.fillStyle = '#ffb8d8'; U.rr(c, bx + 6, by + 6, bw - 12, (bw - 12) * 0.5, 16); c.fill();
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var q = cellPos(x, y); c.fillStyle = 'rgba(160,40,100,.22)'; U.rr(c, q.x - cs * 0.44, q.y - cs * 0.42, cs * 0.88, cs * 0.88, cs * 0.26); c.fill(); c.fillStyle = (x + y) % 2 ? '#ffe9f3' : '#fff3f9'; U.rr(c, q.x - cs * 0.44, q.y - cs * 0.44, cs * 0.88, cs * 0.86, cs * 0.26); c.fill(); }
    var d = st.drag, pv = d && d.valid ? previewLines(d) : null;
    for (y = 0; y < N; y++) for (x = 0; x < N; x++) { var cell = st.g[y][x]; if (!cell) continue; var q2 = cellPos(x, y); if (x + 1 < N && st.g[y][x + 1] && st.g[y][x + 1].pid === cell.pid) bridge(c, cell.c, q2.x, q2.y, cs * cell.sc, 'r'); if (y + 1 < N && st.g[y + 1][x] && st.g[y + 1][x].pid === cell.pid) bridge(c, cell.c, q2.x, q2.y, cs * cell.sc, 'd'); }
    for (y = 0; y < N; y++) for (x = 0; x < N; x++) { var cl = st.g[y][x]; if (!cl) continue; var q3 = cellPos(x, y), glow = pv && (pv.rows[y] || pv.cols[x]);
      jelly(c, cl.c, q3.x, q3.y, cs, cl.wob + 0.06, t + x * 0.4 + y * 0.3, { sc: cl.sc, face: cl.f, mood: glow ? 'wow' : st.over ? 'o' : 'happy', blink: blinkFor(cl.pid, t) });
      if (glow) { c.fillStyle = 'rgba(255,255,255,' + (0.35 + 0.2 * Math.sin(t * 10)) + ')'; U.rr(c, q3.x - cs * 0.44, q3.y - cs * 0.44, cs * 0.88, cs * 0.86, cs * 0.28); c.fill(); } }
    if (d && d.pos && d.valid) { var p = st.hand[d.slot]; p.cells.forEach(function (cl2) { var q4 = cellPos(d.ox + cl2[0], d.oy + cl2[1]); c.fillStyle = COLS[p.c]; c.globalAlpha = 0.4; U.rr(c, q4.x - cs * 0.42, q4.y - cs * 0.42, cs * 0.84, cs * 0.84, cs * 0.26); c.fill(); c.globalAlpha = 1; c.setLineDash([4, 4]); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); c.setLineDash([]); }); }
  }
  function previewLines(d) { var p = st.hand[d.slot], rows = {}, cols = {}, tmp = {}; p.cells.forEach(function (cl) { tmp[(d.oy + cl[1]) + ',' + (d.ox + cl[0])] = 1; }); for (var y = 0; y < N; y++) { var f = true; for (var x = 0; x < N; x++) if (!st.g[y][x] && !tmp[y + ',' + x]) f = false; if (f) rows[y] = 1; } for (x = 0; x < N; x++) { f = true; for (y = 0; y < N; y++) if (!st.g[y][x] && !tmp[y + ',' + x]) f = false; if (f) cols[x] = 1; } return { rows: rows, cols: cols }; }
  function drawTray(c, w, h, t) {
    var sc = PG.scale();
    if (!geo.land) { c.fillStyle = 'rgba(255,255,255,.6)'; U.rr(c, 10 * sc, geo.trayY - 8 * sc, w - 20 * sc, geo.trayH + 2 * sc, 24 * sc); c.fill(); }
    st.hand.forEach(function (p, i) { var s = geo.slots[i]; if (p.used) return; if (st.drag && st.drag.slot === i && st.drag.pos) return; var k = PG.ease.back(Math.min(1, p.pop)), fits = fitsAnywhere(p.cells);
      c.save(); c.translate(s.x, s.y); c.scale(k, k); drawPiece(c, p, 0, 0, geo.trayCell, t + i, fits ? 1 : 0.45, fits ? 0.3 : 0.05, fits ? 'happy' : 'o'); c.restore(); });
    if (st.hint > 0) { var msg = 'Tap a piece to spin it!'; c.fillStyle = PLUM; var tw = U.measure(c, msg, 17 * sc) + 28 * sc; U.rr(c, w / 2 - tw / 2, geo.trayY - 34 * sc, tw, 28 * sc, 14 * sc); c.fill(); U.text(c, msg, w / 2, geo.trayY - 20 * sc, 17 * sc, '#fff', 'center', { shadow: false }); }
  }
  function candyText(c, s, x, y, size, col, o) { o = o || {}; U.text(c, s, x, y + size * 0.06, size, U.shade(col, -0.35), o.align || 'center', { shadow: false, stroke: '#fff', strokeWidth: size * 0.22 }); U.text(c, s, x, y, size, col, o.align || 'center', { shadow: false }); }
  function coinJar(c, x, y, r) { c.fillStyle = '#ffd84d'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.strokeStyle = '#e6a400'; c.lineWidth = Math.max(1.5, r * 0.18); c.stroke(); c.fillStyle = '#fff3b0'; c.beginPath(); c.arc(x - r * 0.3, y - r * 0.3, r * 0.25, 0, TAU); c.fill(); }
  function drawHUD(c, w, h) {
    var sc = PG.scale(); candyText(c, PG.fmt(st.score), 18 * sc, 46 * sc, 40 * sc, '#c2185b', { align: 'left' }); U.text(c, 'BEST ' + PG.fmt(PG.save.best || 0), 18 * sc, 76 * sc, 15 * sc, PLUM, 'left', { shadow: false });
    coinJar(c, 26 * sc, 100 * sc, 9 * sc); U.text(c, '' + st.coinsRun, 41 * sc, 101 * sc, 17 * sc, '#b45309', 'left', { shadow: false });
    var bw = 96 * sc, bh = 36 * sc, bx = w - bw - 14 * sc, by = 70 * sc, can = st.undoLeft > 0 && st.prev; if (U.button(c, bx, by, bw, bh, 'Undo ' + st.undoLeft, { color: can ? '#5ab8ff' : '#c9b8c4', size: 15 * sc, disabled: !can })) undo();
    if (st.spinLeft > 0) U.text(c, 'Spins ' + st.spinLeft, bx - 50 * sc, by + bh / 2, 14 * sc, PLUM, 'center', { shadow: false });
    if (st.combo > 1) candyText(c, 'Combo x' + st.combo, w / 2, 30 * sc, 20 * sc, '#ff4f9a');
  }
  function drawOver(c, w, h) {
    var sc = PG.scale(), k = PG.ease.out(Math.min(1, Math.max(0, st.overT - 0.3) * 2)); if (k <= 0) return; c.fillStyle = 'rgba(90,20,70,' + 0.45 * k + ')'; c.fillRect(0, 0, w, h);
    var canRev = !st.revUsed && PG.rewardedSupported(), canDbl = !canRev && !st.doubled && st.coinsShown >= 3 && PG.rewardedSupported(), pw = Math.min(w * 0.88, 370 * sc), ph = ((canRev || canDbl) ? 380 : 324) * sc, px = w / 2 - pw / 2, py = Math.max(10 * sc, h * 0.5 - ph / 2) + (1 - k) * 60; U.panel(c, px, py, pw, ph);
    candyText(c, 'Jam packed!', w / 2, py + 44 * sc, 30 * sc, '#ff4f9a'); candyText(c, PG.fmt(st.score), w / 2, py + 98 * sc, 52 * sc, '#7b3fe4');
    var best = st.score >= (PG.save.best || 0) && st.score > 0; U.text(c, best ? 'NEW BEST!' : 'Best ' + PG.fmt(PG.save.best || 0), w / 2, py + 138 * sc, 18 * sc, best ? '#2e9e5a' : PLUM, 'center', { shadow: false });
    U.text(c, st.lines + ' lines  ·  ' + st.pure + ' pure', w / 2, py + 162 * sc, 15 * sc, '#9a5a86', 'center', { shadow: false });
    coinJar(c, w / 2 - 46 * sc, py + 192 * sc, 11 * sc); U.text(c, '+' + st.coinsShown + (st.doubled ? ' (x2)' : ''), w / 2 - 30 * sc, py + 193 * sc, 24 * sc, '#b45309', 'left', { shadow: false });
    var bw = pw * 0.82, bh = 48 * sc, yy = py + 220 * sc;
    if (canRev) { if (U.button(c, w / 2 - bw / 2, yy, bw, bh, 'Ad: clear 14 jellies', { color: '#b78bff', size: 17 * sc })) PG.rewarded('continue').then(function (ok) { if (ok) revive(); }); yy += bh + 8 * sc; }
    else if (canDbl) { if (U.button(c, w / 2 - bw / 2, yy, bw, bh, 'Ad: double coins', { color: '#b78bff', size: 17 * sc })) { var e = st.coinsShown; PG.rewarded('bonus').then(function (ok) { if (ok) { PG.save.coins += e; st.coinsShown += e; st.doubled = true; PG.commit(true); } }); } yy += bh + 8 * sc; }
    if (U.button(c, w / 2 - bw / 2, yy, bw, bh, 'Play again', { color: PINK })) PG.interstitial('game_over').then(function () { PG.go(function () { startRun(false); }); });
    if (U.button(c, w / 2 - bw / 2, yy + bh + 8 * sc, bw / 2 - 5 * sc, bh * 0.8, 'Upgrades', { color: '#ffa45b', size: 15 * sc })) PG.go(function () { st.state = 'shop'; PG.track('shop_opened', { source: 'game_over' }); });
    if (U.button(c, w / 2 + 5 * sc, yy + bh + 8 * sc, bw / 2 - 5 * sc, bh * 0.8, 'Menu', { color: '#5ab8ff', size: 15 * sc })) PG.go(function () { st.state = 'menu'; });
  }

  /* ---------- theme: candy buttons and frosted cards ---------- */
  PG.theme.font = 'Baloo 2'; PG.theme.body = 'Baloo 2'; PG.theme.weight = '800'; PG.theme.bodyWeight = '800'; PG.theme.text = PLUM; PG.theme.textShadow = false; PG.theme.pageColor = '#ffd3e6';
  PG.theme.popStyle = { stroke: 'rgba(194,24,91,.8)' };
  PG.theme.button = function (c, x, y, w, h, label, o, s) {
    var col = o.disabled ? '#c9b8c4' : o.color || PINK, r = h / 2, off = s.press ? 3 : 0;
    c.fillStyle = U.shade(col, -0.3); U.rr(c, x, y + 5, w, h, r); c.fill();
    c.fillStyle = s.hover ? U.shade(col, 0.1) : col; U.rr(c, x, y + off, w, h, r); c.fill();
    c.save(); U.rr(c, x, y + off, w, h, r); c.clip(); c.fillStyle = 'rgba(255,255,255,.16)'; for (var i = -h; i < w + h; i += h * 0.7) { c.beginPath(); c.moveTo(x + i, y + off + h); c.lineTo(x + i + h * 0.35, y + off + h); c.lineTo(x + i + h * 0.95, y + off); c.lineTo(x + i + h * 0.6, y + off); c.fill(); }
    c.fillStyle = 'rgba(255,255,255,.45)'; U.rr(c, x + r * 0.5, y + off + h * 0.12, w - r, h * 0.26, h * 0.13); c.fill(); c.restore();
    c.strokeStyle = '#fff'; c.lineWidth = 3; U.rr(c, x, y + off, w, h, r); c.stroke();
    if (label) U.text(c, label, x + w / 2, y + off + h / 2 + 2, U.fit(c, label, o.size || Math.min(h * 0.46, 26), w - 20), '#fff', 'center', { shadow: false, stroke: U.shade(col, -0.35), strokeWidth: 4 });
  };
  PG.theme.panel = function (c, x, y, w, h) { c.fillStyle = 'rgba(160,60,120,.22)'; U.rr(c, x + 3, y + 10, w, h, 26); c.fill(); scallop(c, x, y, w, h, 24, '#ffb8d8'); c.fillStyle = CREAM; U.rr(c, x + 7, y + 7, w - 14, h - 14, 20); c.fill(); c.strokeStyle = 'rgba(255,126,182,.4)'; c.setLineDash([5, 6]); c.lineWidth = 2; U.rr(c, x + 14, y + 14, w - 28, h - 28, 16); c.stroke(); c.setLineDash([]); };
  PG.theme.hudButton = function (c, x, y, r, kind) { c.fillStyle = U.shade(PINK, -0.3); c.beginPath(); c.arc(x, y + 3, r, 0, TAU); c.fill(); c.fillStyle = PINK; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2.5; c.stroke(); PG.hudIcon(c, x, y, r * 0.9, kind, '#fff'); };
  PG.theme.transition = { time: 0.42, draw: function (c, w, h, k) { // a shower of jelly dots
    var R = Math.hypot(w, h) * 0.22; for (var i = 0; i < 16; i++) { var hx = PG.hash(i * 5.1), hy = PG.hash(i * 9.7), rr = R * (0.8 + PG.hash(i) * 0.6) * PG.clamp(k * 1.6 - PG.hash(i * 3) * 0.5, 0, 1.5); c.fillStyle = COLS[i % COLS.length]; c.beginPath(); c.arc(hx * w, hy * h, rr, 0, TAU); c.fill(); }
    if (k > 0.85) { c.globalAlpha = (k - 0.85) / 0.15; c.fillStyle = '#ffb8d8'; c.fillRect(0, 0, w, h); c.globalAlpha = 1; }
  } };
  PG.theme.loading = function (c, w, h, t) { c.fillStyle = '#ffe3ef'; c.fillRect(0, 0, w, h); var b = Math.abs(Math.sin(t * 4)); c.save(); c.translate(w / 2, h / 2 - b * 26); c.scale(1 + (1 - b) * 0.15, 1 - (1 - b) * 0.15); c.fillStyle = PINK; U.rr(c, -22, -22, 44, 44, 13); c.fill(); c.fillStyle = 'rgba(255,255,255,.6)'; U.rr(c, -14, -16, 16, 6, 3); c.fill(); c.restore(); };

  /* ---------- menus ---------- */
  function drawShop(c, w, h) {
    var sc = PG.scale(); c.fillStyle = 'rgba(120,30,90,.35)'; c.fillRect(0, 0, w, h); var pw = Math.min(w * 0.94, 440 * sc), rowH = 66 * sc, ph = 74 * sc + UPS.length * rowH + 76 * sc, px = w / 2 - pw / 2, py = Math.max(14 * sc, (h - ph) / 2); U.panel(c, px, py, pw, ph);
    candyText(c, 'Upgrades', px + 26 * sc, py + 42 * sc, 28 * sc, '#ff4f9a', { align: 'left' }); coinJar(c, px + pw - 90 * sc, py + 40 * sc, 10 * sc); U.text(c, PG.fmt(PG.save.coins || 0), px + pw - 74 * sc, py + 42 * sc, 20 * sc, '#b45309', 'left', { shadow: false });
    UPS.forEach(function (u, i) { var y = py + 66 * sc + i * rowH, L = PG.upLevel(u.id), cost = PG.upCost(u.base, u.grow, L), maxed = L >= u.max;
      U.text(c, u.n, px + 26 * sc, y + 18 * sc, 18 * sc, PLUM, 'left', { shadow: false }); U.text(c, u.d, px + 26 * sc, y + 38 * sc, 13 * sc, '#9a5a86', 'left', { shadow: false });
      for (var k = 0; k < u.max; k++) { c.fillStyle = k < L ? COLS[k % COLS.length] : 'rgba(122,46,92,.15)'; U.rr(c, px + 26 * sc + k * 13 * sc, y + 50 * sc, 10 * sc, 8 * sc, 3 * sc); c.fill(); }
      var bw = 100 * sc, bh = 42 * sc, bx = px + pw - bw - 24 * sc; if (maxed) candyText(c, 'MAX', bx + bw / 2, y + 30 * sc, 18 * sc, '#2e9e5a'); else if (U.button(c, bx, y + 8 * sc, bw, bh, cost + '', { color: (PG.save.coins || 0) >= cost ? '#7ed957' : '#c9b8c4', size: 19 * sc })) PG.buyUp(u.id, cost, u.max); });
    if (U.button(c, w / 2 - 85 * sc, py + ph - 62 * sc, 170 * sc, 46 * sc, 'Back', { color: '#ffa45b' })) PG.go(function () { st.state = st.over ? 'play' : 'menu'; });
  }
  function drawMenu(c, w, h, t) {
    var sc = PG.scale(), land = w > h, sz = Math.min(76 * sc, (land ? w * 0.5 : w) * 0.2), ty = land ? h * 0.2 : h * 0.13, word = 'JELLY', x = 0, tw = U.measure(c, word, sz);
    for (var i = 0; i < word.length; i++) { var cw = U.measure(c, word[i], sz), wob = Math.sin(t * 3 + i) * 0.06; c.save(); c.translate((land ? w * 0.3 : w / 2) - tw / 2 + x + cw / 2, ty + Math.sin(t * 2.4 + i) * 4); c.scale(1 + wob, 1 - wob); candyText(c, word[i], 0, 0, sz, COLS[i]); c.restore(); x += cw; }
    candyText(c, 'JAM', land ? w * 0.3 : w / 2, ty + sz * 0.95, sz * 1.1, '#7b3fe4');
    var my = land ? h * 0.66 : h * 0.41, mx = land ? w * 0.3 : w / 2, ms = 48 * sc;
    for (i = 0; i < 5; i++) { var bounce = Math.abs(Math.sin(t * 2.2 + i * 0.8)) * 12 * sc; jelly(c, i + (i > 2 ? 1 : 0), mx + (i - 2) * ms * 1.12, my - bounce, ms, 0.35, t + i, { face: true, mood: i === 2 ? 'wow' : 'happy', blink: blinkFor(i, t) }); }
    var bw = Math.min(240 * sc, w * 0.66), bh = 60 * sc, bx = land ? w * 0.72 - bw / 2 : w / 2 - bw / 2, y0 = land ? h * 0.24 : h * 0.55, resume = PG.save.board != null;
    if (U.button(c, bx, y0, bw, bh, resume ? 'Continue' : 'Play', { color: PINK, size: 26 * sc })) PG.go(function () { startRun(resume); });
    var y1 = y0 + bh + 12 * sc; if (resume) { if (U.button(c, bx, y1, bw, bh * 0.75, 'New game', { color: '#5ab8ff', size: 18 * sc })) PG.go(function () { PG.save.board = null; startRun(false); }); y1 += bh * 0.75 + 12 * sc; }
    if (U.button(c, bx, y1, bw, bh * 0.8, 'Upgrades', { color: '#ffa45b', size: 20 * sc })) PG.go(function () { st.state = 'shop'; PG.track('shop_opened', { source: 'menu' }); });
    var ly = y1 + bh * 0.8 + 34 * sc; coinJar(c, bx + bw / 2 - 40 * sc, ly, 11 * sc); U.text(c, PG.fmt(PG.save.coins || 0), bx + bw / 2 - 24 * sc, ly + 1, 20 * sc, '#b45309', 'left', { shadow: false }); U.text(c, 'Best ' + PG.fmt(PG.save.best || 0), bx + bw / 2, ly + 28 * sc, 16 * sc, PLUM, 'center', { shadow: false });
    U.text(c, 'Music: haruta   Sounds: Kenney', w / 2, h - 16 * sc, 12 * sc, '#b07aa0', 'center', { shadow: false });
  }
  function render(c, w, h) {
    var t = PG.time; layout(w, h); geo.land = w > h * 1.15; drawBG(c, w, h, t);
    if (st.state === 'menu') { drawMenu(c, w, h, t); return; } if (st.state === 'shop') { drawShop(c, w, h); return; }
    c.save(); if (st.shake > 0.3) c.translate((Math.random() - 0.5) * st.shake, (Math.random() - 0.5) * st.shake);
    drawBoard(c, w, h, t); PG.drawParts(c); PG.drawPops(c); c.restore(); drawTray(c, w, h, t); drawHUD(c, w, h);
    if (st.drag && st.drag.pos) { var p = st.hand[st.drag.slot]; drawPiece(c, p, st.drag.pos.x, st.drag.pos.y, geo.cell, t, 1, 0.45, st.drag.valid ? 'wow' : 'o'); }
    if (st.over) drawOver(c, w, h);
  }
  function update(dt) {
    PG.updateParts(dt); PG.updatePops(dt); st.shake *= Math.pow(0.0001, dt); if (st.hint > 0) st.hint -= dt; if (st.over) st.overT += dt;
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var c = st.g[y] && st.g[y][x]; if (c) { c.sc += (1 - c.sc) * Math.min(1, dt * 15); c.wob *= Math.pow(0.012, dt); } }
    st.hand.forEach(function (p) { p.pop = Math.min(1, (p.pop || 0) + dt * 4.8); });
  }
  function pieceAnchor(d, x, y) { var p = st.hand[d.slot], b = bounds(p.cells), sc = PG.scale(), cy = y - (PG.touch ? 70 * sc : 30 * sc); d.pos = { x: x, y: cy }; var ox = Math.round((x - geo.gx) / geo.cell - b.w / 2), oy = Math.round((cy - geo.gy) / geo.cell - b.h / 2); d.ox = ox; d.oy = oy; d.valid = canPlace(p.cells, ox, oy); }
  PG.onDown = function (x, y) {
    if (st.state !== 'play' || st.over || PG.userPaused) return; for (var i = 0; i < 3; i++) { var s = geo.slots[i], p = st.hand[i]; if (p.used) continue; if (Math.abs(x - s.x) < s.w / 2 && Math.abs(y - s.y) < s.h / 2 + 10) { st.drag = { slot: i, sx: x, sy: y, moved: false, pos: null }; PG.sfx('pop', 1.4); return; } }
  };
  PG.onMove = function (x, y) { var d = st.drag; if (!d) return; if (!d.moved && Math.hypot(x - d.sx, y - d.sy) > 8) d.moved = true; if (d.moved) pieceAnchor(d, x, y); };
  PG.onUp = function (x, y) { var d = st.drag; st.drag = null; if (!d || st.over) return; if (!d.moved) { rotate(d.slot); return; } pieceAnchor(d, x, y); if (d.valid) place(d.slot, d.ox, d.oy); else PG.sfx('err'); };
  PG.setup(document.getElementById('c'), update, render);
  window.__jelly = { st: st, start: startRun, place: place, canPlace: canPlace, fits: fitsAnywhere, N: N, rotate: rotate, update: update, gameOver: gameOver, revive: revive };
  PG.init({ id: 'jelly_jam', version: '1.1.0', defaults: { best: 0, coins: 0, runs: 0, up: {}, board: null, muted: false } }).then(function () {
    PG.music();
  });
})();
