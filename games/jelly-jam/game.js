/* JELLY JAM - drag wobbly jelly pieces onto the board. Fill rows and columns to clear them; single-colour lines are Pure Jam. */
(function () {
  'use strict';
  var U = PG.ui, TAU = 6.2832, N = 8;
  var COLS = ['#ff5d73', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#b197fc', '#f783ac'];
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
  var st = { state: 'menu', g: [], hand: [], score: 0, combo: 0, over: false, overT: 0, undoLeft: 0, spinLeft: 0, prev: null, drag: null, coinsRun: 0, lines: 0, pure: 0, revUsed: false, doubled: false, runIdx: 0, moves: 0, newBest: false, tick: 0, shake: 0, hint: 0 };
  var geo = { cell: 40, gx: 0, gy: 0, slots: [], trayCell: 20 };
  var sprinkles = []; for (var i = 0; i < 30; i++) sprinkles.push({ x: Math.random(), y: Math.random(), r: Math.random() * 6, c: COLS[i % COLS.length], s: 0.3 + Math.random() });

  function emptyGrid() { var g = []; for (var y = 0; y < N; y++) { g.push([]); for (var x = 0; x < N; x++) g[y].push(null); } return g; }
  function cloneG(g) { return g.map(function (r) { return r.map(function (c) { return c ? { c: c.c, pid: c.pid, wob: 0, sc: 1 } : null; }); }); }
  function rotShape(cells) { var h = Math.max.apply(null, cells.map(function (c) { return c[1]; })); return cells.map(function (c) { return [h - c[1], c[0]]; }); }
  function bounds(cells) { return { w: Math.max.apply(null, cells.map(function (c) { return c[0]; })) + 1, h: Math.max.apply(null, cells.map(function (c) { return c[1]; })) + 1 }; }
  function canPlace(cells, ox, oy) { for (var i = 0; i < cells.length; i++) { var x = ox + cells[i][0], y = oy + cells[i][1]; if (x < 0 || y < 0 || x >= N || y >= N || st.g[y][x]) return false; } return true; }
  function fitsAnywhere(cells) { for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (canPlace(cells, x, y)) return true; return false; }
  function newPiece() {
    var easy = PG.upLevel('easy'), w = SHAPES.map(function (s, i) { var b = BIG[i]; var k = b ? Math.max(0.12, b * (1 - easy * 0.17)) : 1; if (s.length === 1) k *= 0.6 + easy * 0.12; return k; }), tot = w.reduce(function (a, b) { return a + b; }, 0), r = Math.random() * tot, idx = 0;
    for (var i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) { idx = i; break; } } return { cells: SHAPES[idx], c: Math.floor(Math.random() * COLS.length), id: Math.random(), used: false, pop: 0 };
  }
  function newHand() {
    for (var t = 0; t < 30; t++) { var h = [newPiece(), newPiece(), newPiece()]; if (h.some(function (p) { return fitsAnywhere(p.cells); })) { st.hand = h; return; } } st.hand = [newPiece(), newPiece(), newPiece()];
  }
  function startRun(resume) {
    st.g = emptyGrid(); st.score = 0; st.combo = 0; st.over = false; st.prev = null; st.drag = null; st.coinsRun = 0; st.lines = 0; st.pure = 0; st.revUsed = false; st.doubled = false; st.moves = 0; st.newBest = false; st.state = 'play';
    st.undoLeft = 1 + PG.upLevel('undo'); st.spinLeft = 2 * PG.upLevel('spin'); PG.parts = []; PG.pops = []; PG.playing = true;
    if (resume && PG.save.board) { var b = PG.save.board; for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) st.g[y][x] = b.g[y][x] ? { c: b.g[y][x], pid: 0, wob: 0, sc: 1 } : null; st.score = b.score; st.hand = b.hand.map(function (h) { return h ? { cells: h.cells, c: h.c, id: Math.random(), used: false, pop: 0 } : { used: true, cells: [[0, 0]], c: 0, id: Math.random(), pop: 0 }; }); st.moves = b.moves || 0; st.undoLeft = b.undo; st.spinLeft = b.spin; st.coinsRun = b.coins || 0; st.lines = b.lines || 0; st.pure = b.pure || 0; }
    else { newHand(); st.runIdx++; PG.track('progression_started', { step_id: 'run', step_index: Math.min(st.runIdx, 50) }); PG.msg('level_started', { level: String(st.runIdx) }); }
    for (var i = 0; i < 3; i++) if (st.hand[i]) st.hand[i].pop = 0;
  }
  function persist() {
    PG.save.board = st.over ? null : { g: st.g.map(function (r) { return r.map(function (c) { return c ? c.c : null; }); }), score: st.score, hand: st.hand.map(function (h) { return h.used ? null : { cells: h.cells, c: h.c }; }), moves: st.moves, undo: st.undoLeft, spin: st.spinLeft, coins: st.coinsRun, lines: st.lines, pure: st.pure }; PG.commit();
  }
  function place(slot, ox, oy) {
    var p = st.hand[slot]; st.prev = { g: cloneG(st.g), hand: st.hand.map(function (h) { return { cells: h.cells, c: h.c, id: h.id, used: h.used, pop: 0 }; }), score: st.score, combo: st.combo, coins: st.coinsRun, lines: st.lines, pure: st.pure };
    var pid = Math.random(); p.cells.forEach(function (cl) { st.g[oy + cl[1]][ox + cl[0]] = { c: p.c, pid: pid, wob: 1, sc: 0.6 }; }); p.used = true; st.score += p.cells.length * 10; st.moves++; PG.sfx('drop', 1 + Math.random() * 0.2); PG.vibrate(8);
    // ripple wobble to neighbours
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (st.g[y][x] && st.g[y][x].wob < 0.4) { var near = false; p.cells.forEach(function (cl) { if (Math.abs(ox + cl[0] - x) + Math.abs(oy + cl[1] - y) <= 2) near = true; }); if (near) st.g[y][x].wob = 0.45; }
    // line clears
    var rows = [], cols = [], pureLines = 0; for (y = 0; y < N; y++) if (st.g[y].every(function (c) { return c; })) rows.push(y); for (x = 0; x < N; x++) { var full = true; for (y = 0; y < N; y++) if (!st.g[y][x]) { full = false; break; } if (full) cols.push(x); }
    var kill = {}, nLines = rows.length + cols.length;
    rows.forEach(function (r) { var c0 = st.g[r][0].c, pu = st.g[r].every(function (c) { return c.c === c0; }); if (pu) pureLines++; for (var x2 = 0; x2 < N; x2++) kill[r + ',' + x2] = 1; });
    cols.forEach(function (cx) { var c0 = st.g[0][cx].c, pu = true; for (var y2 = 0; y2 < N; y2++) { if (st.g[y2][cx].c !== c0) pu = false; kill[y2 + ',' + cx] = 1; } if (pu) pureLines++; });
    if (nLines > 0) {
      st.combo++; var base = 100 * nLines * nLines, pureB = pureLines * 200 * (1 + 0.25 * PG.upLevel('pure')), gain = Math.round((base + pureB) * (1 + (st.combo - 1) * 0.5)); st.score += gain; st.lines += nLines; st.pure += pureLines;
      var coin = (nLines + pureLines * 3) * (1 + 0.15 * PG.upLevel('coin')) * (1 + (st.combo - 1) * 0.25); coin = Math.max(1, Math.round(coin)); st.coinsRun += coin;
      Object.keys(kill).forEach(function (k) { var yx = k.split(','), yy = +yx[0], xx = +yx[1], c = st.g[yy][xx], q = cellPos(xx, yy); if (c) { PG.burst(q.x, q.y, 6, { colors: [COLS[c.c], '#fff'], g: 700, min: 60, max: 300, life: 0.9, s0: 3, s1: 8 }); st.g[yy][xx] = null; } });
      var cx0 = geo.gx + geo.cell * N / 2, cy0 = geo.gy + geo.cell * N / 2; PG.popText(cx0, cy0 - 20, '+' + gain, '#fff', 34); if (pureLines) PG.popText(cx0, cy0 + 20, 'PURE JAM x' + pureLines + '!', '#ffe066', 26); if (st.combo > 1) PG.popText(cx0, cy0 - 56, 'Combo x' + st.combo, '#ff9ecb', 24);
      PG.sfx(pureLines ? 'win' : 'merge', 1 + nLines * 0.1); st.shake = 6 + nLines * 2; if (st.score > (PG.save.best || 0)) { if (!st.newBest && PG.save.best) PG.sfx('perfect'); st.newBest = true; }
    } else { st.combo = 0; }
    if (st.hand.every(function (h) { return h.used; })) newHand();
    if (st.score > (PG.save.best || 0)) { PG.save.best = st.score; }
    if (!st.hand.some(function (h) { return !h.used && fitsAnywhere(h.cells); })) { if (st.spinLeft > 0 && st.hand.some(function (h) { return !h.used && fitsAnywhere(rotShape(h.cells)); })) { st.hint = 3; } else gameOver(); } persist();
  }
  function gameOver() {
    st.over = true; st.overT = 0; PG.playing = false; st.coinsRun += Math.floor(st.score / 200); PG.save.coins = (PG.save.coins || 0) + st.coinsRun; PG.save.runs = (PG.save.runs || 0) + 1; PG.save.board = null; PG.commit(true); PG.sfx('lose');
    PG.track('progression_failed', { step_id: 'run', step_index: Math.min(st.runIdx, 50), score: st.score, lines: st.lines, pure: st.pure, moves: st.moves }); PG.msg('level_failed', { level: String(st.runIdx) });
  }
  function undo() { if (!st.prev || st.undoLeft <= 0 || st.over) return; st.g = st.prev.g; st.hand = st.prev.hand; st.score = st.prev.score; st.combo = st.prev.combo; st.coinsRun = st.prev.coins; st.lines = st.prev.lines; st.pure = st.prev.pure; st.prev = null; st.undoLeft--; PG.sfx('whoosh'); persist(); }
  function rotate(slot) { var p = st.hand[slot]; if (p.used || st.spinLeft <= 0) return; p.cells = rotShape(p.cells); st.spinLeft--; p.pop = 0; PG.sfx('pop', 1.2); persist(); }
  function revive() { var cells = []; for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) if (st.g[y][x]) cells.push([x, y]); for (var i = 0; i < 14 && cells.length; i++) { var k = Math.floor(Math.random() * cells.length), c = cells.splice(k, 1)[0], q = cellPos(c[0], c[1]); PG.burst(q.x, q.y, 5, { colors: [COLS[st.g[c[1]][c[0]].c]], g: 500 }); st.g[c[1]][c[0]] = null; } st.over = false; st.revUsed = true; PG.playing = true; PG.sfx('upgrade'); persist(); }

  /* ---------- layout / drawing ---------- */
  function layout(w, h) {
    var sc = PG.scale(), landscape = w > h * 1.15;
    if (!landscape) { geo.cell = Math.min(w * 0.94 / N, (h - 340 * sc) / N, 62 * sc); geo.gx = (w - geo.cell * N) / 2; geo.gy = 124 * sc; geo.trayY = geo.gy + geo.cell * N + 24 * sc; geo.trayH = h - geo.trayY - 14 * sc; geo.trayCell = Math.min(geo.cell * 0.62, geo.trayH / 3.6, w / 12);
      var cw = w / 3; for (var i = 0; i < 3; i++) geo.slots[i] = { x: cw * i + cw / 2, y: geo.trayY + geo.trayH / 2, w: cw, h: geo.trayH }; }
    else { geo.cell = Math.min((h - 90 * sc) / N, w * 0.5 / N, 70 * sc); geo.gx = w * 0.5 - geo.cell * N * 0.62; geo.gy = (h - geo.cell * N) / 2 + 30 * sc; geo.trayCell = Math.min(geo.cell * 0.62, h / 12); var tx = geo.gx + geo.cell * N + 50 * sc, th = h / 3; for (i = 0; i < 3; i++) geo.slots[i] = { x: tx + 100 * sc, y: th * i + th / 2 + 20 * sc, w: 220 * sc, h: th }; }
  }
  function cellPos(x, y) { return { x: geo.gx + (x + 0.5) * geo.cell, y: geo.gy + (y + 0.5) * geo.cell }; }
  function jellyCell(c, x, y, s, col, wob, t, neigh, alpha) {
    var r = s * 0.5, k = 1 + Math.sin(t * 14 + x * 0.05) * wob * 0.08 * (1); var sq = wob * Math.sin(t * 18 + y * 0.03) * 0.07; c.save(); c.translate(x, y); c.scale((k + sq), (k - sq)); c.globalAlpha = alpha === undefined ? 1 : alpha;
    var g = c.createLinearGradient(0, -r, 0, r); g.addColorStop(0, U.shade(col, 0.18)); g.addColorStop(1, U.shade(col, -0.12));
    c.fillStyle = g; var pad = s * 0.06; U.rr(c, -r + pad, -r + pad, s - pad * 2, s - pad * 2, s * 0.28); c.fill();
    if (neigh) { if (neigh.r) c.fillRect(r - pad - 2, -r + pad + s * 0.12, pad * 2 + 4, s - pad * 2 - s * 0.24); if (neigh.d) c.fillRect(-r + pad + s * 0.12, r - pad - 2, s - pad * 2 - s * 0.24, pad * 2 + 4); }
    c.fillStyle = 'rgba(255,255,255,.5)'; U.rr(c, -r + s * 0.18, -r + s * 0.14, s * 0.4, s * 0.14, s * 0.07); c.fill(); c.fillStyle = 'rgba(255,255,255,.22)'; c.beginPath(); c.arc(r * 0.45, r * 0.4, s * 0.07, 0, TAU); c.fill();
    c.globalAlpha = 1; c.restore();
  }
  function drawBG(c, w, h, t) {
    var g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#ffd6e8'); g.addColorStop(0.55, '#e6d4ff'); g.addColorStop(1, '#c5e4ff'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    sprinkles.forEach(function (s) { c.save(); c.translate(((s.x + t * 0.004 * s.s) % 1) * w, ((s.y + t * 0.01 * s.s) % 1) * h); c.rotate(t * s.s + s.r); c.fillStyle = s.c; c.globalAlpha = 0.45; c.fillRect(-7, -2.5, 14, 5); c.restore(); }); c.globalAlpha = 1;
  }
  function pieceBounds(p) { return bounds(p.cells); }
  function drawPiece(c, p, cx, cy, cs, t, alpha, wobble) {
    var b = pieceBounds(p), ox = cx - b.w * cs / 2, oy = cy - b.h * cs / 2, set = {}; p.cells.forEach(function (q) { set[q[0] + ',' + q[1]] = 1; });
    p.cells.forEach(function (q) { var neigh = { r: set[(q[0] + 1) + ',' + q[1]], d: set[q[0] + ',' + (q[1] + 1)] }; jellyCell(c, ox + (q[0] + 0.5) * cs, oy + (q[1] + 0.5) * cs, cs, COLS[p.c], wobble === undefined ? 0.25 : wobble, t + q[0] * 0.3 + q[1] * 0.2, neigh, alpha); });
  }
  function drawBoard(c, w, h, t) {
    var cs = geo.cell; U.panel(c, geo.gx - 8, geo.gy - 8, cs * N + 16, cs * N + 16, { fill: 'rgba(90,60,140,.82)', stroke: 'rgba(255,255,255,.35)' });
    for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) { var q = cellPos(x, y); c.fillStyle = (x + y) % 2 ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.07)'; U.rr(c, q.x - cs * 0.46, q.y - cs * 0.46, cs * 0.92, cs * 0.92, cs * 0.2); c.fill(); }
    // preview of lines about to clear
    var d = st.drag, pv = null; if (d && d.valid) { pv = previewLines(d); }
    for (y = 0; y < N; y++) for (x = 0; x < N; x++) { var cell = st.g[y][x]; if (!cell) continue; cell.sc += (1 - cell.sc) * 0.25; cell.wob *= 0.93; var q2 = cellPos(x, y), neigh = { r: x + 1 < N && st.g[y][x + 1] && st.g[y][x + 1].pid === cell.pid, d: y + 1 < N && st.g[y + 1][x] && st.g[y + 1][x].pid === cell.pid }; var glow = pv && (pv.rows[y] || pv.cols[x]); c.save(); c.translate(q2.x, q2.y); c.scale(cell.sc, cell.sc); jellyCell(c, 0, 0, cs, COLS[cell.c], cell.wob + 0.08, t + x * 0.4 + y * 0.3, neigh, glow ? 0.65 : 1); if (glow) { c.fillStyle = 'rgba(255,255,255,.5)'; U.rr(c, -cs * 0.45, -cs * 0.45, cs * 0.9, cs * 0.9, cs * 0.25); c.fill(); } c.restore(); }
    if (d && d.pos) { var p = st.hand[d.slot], b = pieceBounds(p); if (d.valid) { p.cells.forEach(function (cl) { var q3 = cellPos(d.ox + cl[0], d.oy + cl[1]); c.fillStyle = COLS[p.c]; c.globalAlpha = 0.45; U.rr(c, q3.x - cs * 0.44, q3.y - cs * 0.44, cs * 0.88, cs * 0.88, cs * 0.24); c.fill(); c.globalAlpha = 1; c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 2; c.stroke(); }); } }
  }
  function previewLines(d) { var p = st.hand[d.slot], rows = {}, cols = {}, tmp = {}; p.cells.forEach(function (cl) { tmp[(d.oy + cl[1]) + ',' + (d.ox + cl[0])] = 1; }); for (var y = 0; y < N; y++) { var f = true; for (var x = 0; x < N; x++) if (!st.g[y][x] && !tmp[y + ',' + x]) f = false; if (f) rows[y] = 1; } for (x = 0; x < N; x++) { f = true; for (y = 0; y < N; y++) if (!st.g[y][x] && !tmp[y + ',' + x]) f = false; if (f) cols[x] = 1; } return { rows: rows, cols: cols }; }
  function drawTray(c, w, h, t) {
    var sc = PG.scale(); st.hand.forEach(function (p, i) { var s = geo.slots[i]; if (p.used) return; if (st.drag && st.drag.slot === i && st.drag.pos) { return; } p.pop = Math.min(1, p.pop + 0.08); var k = PG.ease.back(p.pop); var fits = fitsAnywhere(p.cells); c.save(); c.translate(s.x, s.y); c.scale(k, k); drawPiece(c, p, 0, 0, geo.trayCell, t + i, fits ? 1 : 0.45, fits ? 0.3 : 0.05); c.restore(); });
    if (st.hint > 0) { st.hint -= 0.016; U.text(c, 'Tap a piece to rotate it!', w / 2, geo.trayY - 14 * sc, 18 * sc, '#6d28d9', 'center', { shadow: false }); }
  }
  function drawHUD(c, w, h) {
    var sc = PG.scale(); U.text(c, PG.fmt(st.score), 16 * sc, 32 * sc, 40 * sc, '#6d28d9', 'left', { shadow: false, stroke: 'rgba(255,255,255,.8)' }); U.text(c, 'BEST ' + PG.fmt(PG.save.best || 0), 16 * sc, 62 * sc, 14 * sc, '#7c3aed', 'left', { shadow: false });
    U.coin(c, 24 * sc, 84 * sc, 9 * sc); U.text(c, '' + st.coinsRun, 38 * sc, 85 * sc, 17 * sc, '#b45309', 'left', { shadow: false });
    var bw = 92 * sc, bh = 34 * sc, bx = w - bw - 14 * sc, by = 66 * sc; if (st.undoLeft > 0 && st.prev) { if (U.button(c, bx, by, bw, bh, 'Undo ' + st.undoLeft, { color: '#4dabf7', size: 15 * sc })) undo(); } else { U.button(c, bx, by, bw, bh, 'Undo ' + st.undoLeft, { color: '#9aa5b1', size: 15 * sc, disabled: true }); }
    if (st.spinLeft > 0) U.text(c, 'Spins ' + st.spinLeft, bx - 52 * sc, by + bh / 2, 13 * sc, '#6d28d9', 'center', { shadow: false });
    if (st.combo > 1) U.text(c, 'Combo x' + st.combo, w / 2, 24 * sc, 20 * sc, '#ec4899', 'center', { shadow: false });
  }
  function drawOver(c, w, h) {
    var sc = PG.scale(); st.overT += 0.016; var k = PG.ease.out(Math.min(1, st.overT * 2)); c.fillStyle = 'rgba(40,10,70,' + 0.55 * k + ')'; c.fillRect(0, 0, w, h);
    var pw = Math.min(w * 0.88, 380 * sc), ph = 390 * sc, px = w / 2 - pw / 2, py = h * 0.5 - ph / 2 + (1 - k) * 60; U.panel(c, px, py, pw, ph);
    U.text(c, 'Jam packed!', w / 2, py + 38 * sc, 30 * sc, '#ffd23f', 'center'); U.text(c, PG.fmt(st.score), w / 2, py + 92 * sc, 56 * sc, '#fff', 'center'); U.text(c, st.score >= (PG.save.best || 0) && st.score > 0 ? 'NEW BEST!' : 'Best ' + PG.fmt(PG.save.best || 0), w / 2, py + 132 * sc, 18 * sc, st.score >= (PG.save.best || 0) ? '#9be564' : '#cbd5e1', 'center');
    U.text(c, st.lines + ' lines  -  ' + st.pure + ' pure', w / 2, py + 158 * sc, 15 * sc, '#cbd5e1', 'center', { shadow: false }); U.coin(c, w / 2 - 50 * sc, py + 190 * sc, 12 * sc); U.text(c, '+' + st.coinsRun + (st.doubled ? ' (x2)' : ''), w / 2 - 32 * sc, py + 191 * sc, 26 * sc, '#ffe066', 'left');
    var bw = pw * 0.84, bh = 48 * sc, yy = py + 218 * sc;
    if (!st.revUsed && PG.rewardedSupported()) { if (U.button(c, w / 2 - bw / 2, yy, bw, bh, 'Watch ad: clear 14 jellies', { color: '#8338ec', size: 17 * sc })) PG.rewarded('continue').then(function (ok) { if (ok) revive(); }); yy += bh + 8 * sc; }
    else if (!st.doubled && st.coinsRun >= 3 && PG.rewardedSupported()) { if (U.button(c, w / 2 - bw / 2, yy, bw, bh, 'Watch ad: double coins', { color: '#8338ec', size: 17 * sc })) { var e = st.coinsRun; PG.rewarded('bonus').then(function (ok) { if (ok) { PG.save.coins += e; st.coinsRun += e; st.doubled = true; PG.commit(true); } }); } yy += bh + 8 * sc; }
    if (U.button(c, w / 2 - bw / 2, yy, bw, bh, 'Play again', { color: '#ec4899' })) PG.interstitial('game_over').then(function () { startRun(false); });
    if (U.button(c, w / 2 - bw / 2, yy + bh + 8 * sc, bw / 2 - 5 * sc, bh * 0.8, 'Upgrades', { color: '#ff9f1c', size: 15 * sc })) { st.state = 'shop'; PG.track('shop_opened', { source: 'game_over' }); }
    if (U.button(c, w / 2 + 5 * sc, yy + bh + 8 * sc, bw / 2 - 5 * sc, bh * 0.8, 'Menu', { color: '#5c6bc0', size: 15 * sc })) st.state = 'menu';
  }
  function drawShop(c, w, h) {
    var sc = PG.scale(); c.fillStyle = 'rgba(40,10,70,.7)'; c.fillRect(0, 0, w, h); var pw = Math.min(w * 0.94, 440 * sc), px = w / 2 - pw / 2, py = 24 * sc, rowH = 66 * sc, ph = 70 * sc + UPS.length * rowH + 76 * sc; U.panel(c, px, py, pw, ph);
    U.text(c, 'Upgrades', w / 2, py + 34 * sc, 30 * sc, '#ffd23f', 'center'); U.coin(c, px + pw - 84 * sc, py + 34 * sc, 11 * sc); U.text(c, PG.fmt(PG.save.coins || 0), px + pw - 68 * sc, py + 35 * sc, 20 * sc, '#ffe066', 'left');
    UPS.forEach(function (u, i) { var y = py + 62 * sc + i * rowH, L = PG.upLevel(u.id), cost = PG.upCost(u.base, u.grow, L), maxed = L >= u.max; U.text(c, u.n, px + 18 * sc, y + 18 * sc, 18 * sc, '#fff', 'left'); U.text(c, u.d, px + 18 * sc, y + 38 * sc, 13 * sc, '#cbd5e1', 'left', { shadow: false }); for (var k = 0; k < u.max; k++) { c.fillStyle = k < L ? '#9be564' : 'rgba(255,255,255,.2)'; c.beginPath(); c.arc(px + 22 * sc + k * 11 * sc, y + 54 * sc, 4 * sc, 0, TAU); c.fill(); }
      var bw = 104 * sc, bh = 44 * sc, bx = px + pw - bw - 14 * sc; if (maxed) U.text(c, 'MAX', bx + bw / 2, y + 28 * sc, 18 * sc, '#9be564', 'center'); else if (U.button(c, bx, y + 8 * sc, bw, bh, cost + '', { color: PG.save.coins >= cost ? '#2ec4b6' : '#8a8f98', size: 20 * sc })) PG.buyUp(u.id, cost, u.max); });
    if (U.button(c, w / 2 - 90 * sc, py + ph - 62 * sc, 180 * sc, 48 * sc, 'Back', { color: '#ff9f1c' })) st.state = st.over ? 'play' : 'menu';
  }
  function drawMenu(c, w, h, t) {
    var sc = PG.scale(); U.text(c, 'JELLY', w / 2, h * 0.12, Math.min(66 * sc, w * 0.18), '#ec4899', 'center', { stroke: '#fff' }); U.text(c, 'JAM', w / 2, h * 0.12 + 62 * sc, Math.min(72 * sc, w * 0.2), '#7c3aed', 'center', { stroke: '#fff' });
    for (var i = 0; i < 5; i++) { var p = { cells: [[0, 0]], c: i }; var x = w / 2 + (i - 2) * 56 * sc, y = h * 0.4 + Math.sin(t * 2 + i) * 8; drawPiece(c, p, x, y, 48 * sc, t + i, 1, 0.4); }
    var bw = 230 * sc, bh = 62 * sc, y0 = h * 0.55, resume = PG.save.board != null; if (U.button(c, w / 2 - bw / 2, y0, bw, bh, resume ? 'Continue' : 'Play', { color: '#ec4899', size: 26 * sc })) startRun(resume);
    var y1 = y0 + bh + 12 * sc; if (resume && U.button(c, w / 2 - bw / 2, y1, bw, bh * 0.75, 'New game', { color: '#4dabf7', size: 18 * sc })) { PG.save.board = null; startRun(false); } if (resume) y1 += bh * 0.75 + 12 * sc;
    if (U.button(c, w / 2 - bw / 2, y1, bw, bh * 0.8, 'Upgrades', { color: '#ff9f1c', size: 20 * sc })) { st.state = 'shop'; PG.track('shop_opened', { source: 'menu' }); }
    U.coin(c, w / 2 - 34 * sc, h - 54 * sc, 11 * sc); U.text(c, PG.fmt(PG.save.coins || 0), w / 2 - 18 * sc, h - 53 * sc, 20 * sc, '#b45309', 'left', { shadow: false }); U.text(c, 'Best ' + PG.fmt(PG.save.best || 0), w / 2, h - 24 * sc, 16 * sc, '#6d28d9', 'center', { shadow: false });
  }
  function render(c, w, h) {
    var t = PG.time; layout(w, h); drawBG(c, w, h, t);
    if (st.state === 'menu') { drawMenu(c, w, h, t); return; } if (st.state === 'shop') { drawShop(c, w, h); return; }
    c.save(); if (st.shake > 0.3) { c.translate((Math.random() - 0.5) * st.shake, (Math.random() - 0.5) * st.shake); st.shake *= 0.85; }
    drawBoard(c, w, h, t); PG.drawParts(c); PG.drawPops(c); c.restore(); drawTray(c, w, h, t); drawHUD(c, w, h);
    if (st.drag && st.drag.pos) { var p = st.hand[st.drag.slot]; drawPiece(c, p, st.drag.pos.x, st.drag.pos.y, geo.cell, t, 1, 0.4); }
    if (st.over) drawOver(c, w, h);
  }
  function update(dt) { PG.updateParts(dt); PG.updatePops(dt); }
  function pieceAnchor(d, x, y) { var p = st.hand[d.slot], b = bounds(p.cells), sc = PG.scale(); var cy = y - (PG.touch ? 70 * sc : 30 * sc); d.pos = { x: x, y: cy }; var ox = Math.round((x - geo.gx) / geo.cell - b.w / 2), oy = Math.round((cy - geo.gy) / geo.cell - b.h / 2); d.ox = ox; d.oy = oy; d.valid = canPlace(p.cells, ox, oy); }
  PG.onDown = function (x, y) {
    if (st.state !== 'play' || st.over || PG.userPaused) return; for (var i = 0; i < 3; i++) { var s = geo.slots[i], p = st.hand[i]; if (p.used) continue; if (Math.abs(x - s.x) < s.w / 2 && Math.abs(y - s.y) < s.h / 2 + 10) { st.drag = { slot: i, sx: x, sy: y, moved: false, pos: null }; PG.sfx('pop', 1.4); return; } }
  };
  PG.onMove = function (x, y) { var d = st.drag; if (!d) return; if (!d.moved && Math.hypot(x - d.sx, y - d.sy) > 8) d.moved = true; if (d.moved) pieceAnchor(d, x, y); };
  PG.onUp = function (x, y) { var d = st.drag; st.drag = null; if (!d) return; if (!d.moved) { rotate(d.slot); return; } pieceAnchor(d, x, y); if (d.valid) place(d.slot, d.ox, d.oy); else PG.sfx('err'); };
  PG.setup(document.getElementById('c'), update, render);
  window.__jelly = { st: st, start: startRun, place: place, canPlace: canPlace, fits: fitsAnywhere, N: N };
  PG.init({ id: 'jelly_jam', version: '1.0.0', defaults: { best: 0, coins: 0, runs: 0, up: {}, board: null, muted: false } }).then(function () {
    PG.music({ scale: [0, 2, 4, 7, 9], root: 330, bpm: 100, wave: 'sine', vol: 0.07, bass: 0.08 });
  });
})();
