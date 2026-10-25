/* CAT CANNON GOLF - drag back, let go, and fire your cat into the hole. 30 holes with sand, water, bumpers and windmills.
   Art direction: a tabletop toy diorama. Felt greens, raised hedges with real depth, plastic props, tilt-shift room behind. */
(function () {
  'use strict';
  var U = PG.ui, TAU = 6.2832, CELL = 40, PC = 10, PR = 16, COLS = PC, ROWS = PR, BW = COLS * CELL, BH = ROWS * CELL, BR = 8, HOLES = 30, WH = 10, land = false;
  var GREEN = '#2f7d3b', DARK = '#1d3a2b', CREAM = '#fffaf0';
  var CATS = [
    { n: 'Ginger', body: '#f4a259', patch: '#fff1dc', ear: '#f7b7a3', stripe: '#d9822b', eye: '#2b9348', unlock: 1 },
    { n: 'Smoky', body: '#9aa5b1', patch: '#e9eef2', ear: '#f2b5c0', stripe: '#6c7783', eye: '#ffca3a', unlock: 5 },
    { n: 'Tux', body: '#2d3142', patch: '#ffffff', ear: '#f2b5c0', stripe: null, eye: '#8ac926', unlock: 10 },
    { n: 'Mocha', body: '#e8d3b9', patch: '#fff8ee', ear: '#d99a8c', stripe: null, mask: '#6b4a35', eye: '#4cc9f0', unlock: 15 },
    { n: 'Calico', body: '#ffffff', patch: '#f4a259', ear: '#f2b5c0', stripe: null, patch2: '#3a3a3a', eye: '#2b9348', unlock: 20 }
  ];
  var HAND = [
    ['##########', '#........#', '#........#', '#...H....#', '#........#', '#........#', '#........#', '#........#', '#........#', '#........#', '#........#', '#........#', '#........#', '#...S....#', '#........#', '##########'],
    ['##########', '#........#', '#...H....#', '#........#', '#........#', '#...######', '#........#', '#........#', '#........#', '######...#', '#........#', '#........#', '#........#', '#...S....#', '#........#', '##########'],
    ['##########', '#H.......#', '#........#', '######...#', '#........#', '#........#', '#...######', '#........#', '#........#', '#...######', '#........#', '#........#', '#........#', '#.......S#', '#........#', '##########']
  ];
  var st = { state: 'menu', hole: 1, map: null, ball: { x: 0, y: 0, vx: 0, vy: 0, sq: 0, rot: 0 }, strokes: 0, par: 3, rest: { x: 0, y: 0 }, aim: null, moving: false, sunk: 0, sinkT: 0, done: false, doneT: 0, hintOn: false, hintUsed: false, hintPath: null, splash: [], bumps: {}, windmills: [], t: 0, totalStrokes: 0, path: null, msg: null, runIdx: 0, stuckT: 0, newCat: null };
  var view = { s: 1, ox: 0, oy: 0 };
  var bokeh = []; for (var i = 0; i < 14; i++) bokeh.push({ x: Math.random(), y: Math.random(), r: 20 + Math.random() * 60, c: ['255,236,190', '200,235,255', '255,210,220', '220,255,210'][i % 4], p: Math.random() * 6 });

  /* ---------- hole data ---------- */
  function parseMap(rows) { var g = []; var S, H; for (var r = 0; r < PR; r++) { g.push([]); for (var c = 0; c < PC; c++) { var ch = rows[r][c]; if (ch === 'S') { S = { c: c, r: r }; ch = '.'; } if (ch === 'H') { H = { c: c, r: r }; ch = '.'; } g[r].push(ch); } } return { g: g, S: S, H: H }; }
  function bfs(g, S, H) { var ROWS = g.length, COLS = g[0].length, dist = {}, q = [[S.c, S.r]], k = S.c + ',' + S.r; dist[k] = 0; while (q.length) { var p = q.shift(), d = dist[p[0] + ',' + p[1]]; if (p[0] === H.c && p[1] === H.r) return d; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (o) { var x = p[0] + o[0], y = p[1] + o[1]; if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return; var ch = g[y][x]; if (ch === '#' || ch === '~') return; var kk = x + ',' + y; if (dist[kk] === undefined) { dist[kk] = d + 1; q.push([x, y]); } }); } return -1; }
  function bfsPath(g, S, H) { var ROWS = g.length, COLS = g[0].length, prev = {}, q = [[S.c, S.r]]; prev[S.c + ',' + S.r] = null; while (q.length) { var p = q.shift(); if (p[0] === H.c && p[1] === H.r) break; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (o) { var x = p[0] + o[0], y = p[1] + o[1]; if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return; var ch = g[y][x]; if (ch === '#' || ch === '~') return; var kk = x + ',' + y; if (!(kk in prev)) { prev[kk] = p; q.push([x, y]); } }); } var out = [], cur = [H.c, H.r]; while (cur) { out.unshift({ x: cur[0] * CELL + CELL / 2, y: cur[1] * CELL + CELL / 2 }); cur = prev[cur[0] + ',' + cur[1]]; } return out; }
  function genHole(n) {
    var rnd = PG.mulberry(n * 7919 + 3), tries = 0, best = null, ROWS = PR, COLS = PC;
    while (tries++ < 60) {
      var g = []; for (var r = 0; r < ROWS; r++) { g.push([]); for (var c = 0; c < COLS; c++) g[r].push(r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1 ? '#' : '.'); }
      var S = { c: 1 + Math.floor(rnd() * 8), r: 13 }, H = { c: 1 + Math.floor(rnd() * 8), r: 1 + Math.floor(rnd() * 2) };
      var blocks = Math.min(3 + Math.floor(n / 3), 11), i;
      for (i = 0; i < blocks; i++) { var w = 1 + Math.floor(rnd() * 3), h = 1 + Math.floor(rnd() * 3), bc = 1 + Math.floor(rnd() * (9 - w)), br = 3 + Math.floor(rnd() * 9); if (rnd() < 0.5) { var t = w; w = h; h = t; } for (var y = br; y < br + h && y < 13; y++) for (var x = bc; x < bc + w && x < 9; x++) g[y][x] = '#'; }
      function carve(cx, cy) { for (var yy = cy - 1; yy <= cy + 1; yy++) for (var xx = cx - 1; xx <= cx + 1; xx++) if (xx > 0 && xx < COLS - 1 && yy > 0 && yy < ROWS - 1) g[yy][xx] = '.'; }
      carve(S.c, S.r); carve(H.c, H.r);
      if (n >= 4) { var sp = 1 + Math.floor(n / 6); for (i = 0; i < sp && i < 4; i++) { var sc0 = 1 + Math.floor(rnd() * 7), sr0 = 4 + Math.floor(rnd() * 8); for (y = sr0; y < sr0 + 2; y++) for (x = sc0; x < sc0 + 3; x++) if (g[y][x] === '.') g[y][x] = ':'; } }
      if (bfs(g, S, H) < 0) continue;
      if (n >= 6) { var ponds = 1 + Math.floor(n / 9); for (i = 0; i < ponds && i < 3; i++) { var pc = 1 + Math.floor(rnd() * 7), pr = 4 + Math.floor(rnd() * 7), save = []; for (y = pr; y < pr + 2; y++) for (x = pc; x < pc + 2; x++) { save.push([x, y, g[y][x]]); if (g[y][x] !== '#') g[y][x] = '~'; } if (bfs(g, S, H) < 0) save.forEach(function (s) { g[s[1]][s[0]] = s[2]; }); } }
      if (n >= 8) { var nb = Math.min(1 + Math.floor((n - 8) / 4), 5); for (i = 0; i < nb; i++) { var bx = 1 + Math.floor(rnd() * 8), by = 4 + Math.floor(rnd() * 8); if (g[by][bx] === '.' && !(Math.abs(bx - S.c) < 2 && Math.abs(by - S.r) < 2) && !(Math.abs(bx - H.c) < 2 && Math.abs(by - H.r) < 2)) { g[by][bx] = 'o'; } } }
      if (n >= 12) { var nw = n >= 22 ? 2 : 1; for (i = 0; i < nw; i++) { for (var q = 0; q < 12; q++) { var wx = 2 + Math.floor(rnd() * 6), wy = 5 + Math.floor(rnd() * 6), ok = true; for (y = wy - 1; y <= wy + 1; y++) for (x = wx - 1; x <= wx + 1; x++) if (g[y][x] !== '.') ok = false; if (ok) { g[wy][wx] = 'W'; break; } } } }
      var d = bfs(g, S, H); if (d < 8) continue; best = { g: g, S: S, H: H, d: d }; break;
    }
    if (!best) { var p = parseMap(HAND[0]); return { g: p.g, S: p.S, H: p.H, par: 3 }; }
    best.par = PG.clamp(2 + Math.round((best.d - 10) / 9), 2, 5); return best;
  }
  function loadHole(n) {
    var m; if (n <= HAND.length) { m = parseMap(HAND[n - 1]); m.d = bfs(m.g, m.S, m.H); m.par = n === 1 ? 2 : 3; } else m = genHole(n);
    if (land) { m.g = transGrid(m.g); swapCR(m.S); swapCR(m.H); }
    st.hole = n; st.map = m; st.par = m.par; st.strokes = 0; st.done = false; st.sunk = 0; st.hintOn = false; st.hintUsed = false; st.hintPath = null; st.aim = null; st.moving = false; st.splash = []; st.bumps = {}; st.windmills = []; st.newCat = null;
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) { if (m.g[r][c] === 'W') st.windmills.push({ x: c * CELL + CELL / 2, y: r * CELL + CELL / 2, a: PG.rand(0, 6), dir: (r + c) % 2 ? 1 : -1, len: CELL * 1.25 }); if (m.g[r][c] === 'o') st.bumps[c + ',' + r] = 0; }
    var b = st.ball; b.x = m.S.c * CELL + CELL / 2; b.y = m.S.r * CELL + CELL / 2; b.vx = b.vy = 0; b.sq = 0; st.rest = { x: b.x, y: b.y }; st.state = 'play'; PG.playing = true; st.stuckT = 0;
    st.msg = null; PG.parts = []; PG.pops = []; st.runIdx++; courseCache = {};
    PG.msg('level_started', { level: String(n) }); PG.track('progression_started', { step_id: 'hole', step_index: n, par: m.par });
  }

  function transGrid(g) { var o = []; for (var c = 0; c < g[0].length; c++) { o.push([]); for (var r = 0; r < g.length; r++) o[c].push(g[r][c]); } return o; }
  function swapCR(p) { var q = p.c; p.c = p.r; p.r = q; }
  function sw(o, a, b) { var q = o[a]; o[a] = o[b]; o[b] = q; }
  function setOrientation(l) { // landscape plays the same hole mirrored across the diagonal
    if (l === land) return; land = l; COLS = l ? PR : PC; ROWS = l ? PC : PR; BW = COLS * CELL; BH = ROWS * CELL; st.aim = null; courseCache = {};
    if (!st.map) return;
    st.map.g = transGrid(st.map.g); swapCR(st.map.S); swapCR(st.map.H);
    var nb = {}; for (var k in st.bumps) { var p = k.split(','); nb[p[1] + ',' + p[0]] = st.bumps[k]; } st.bumps = nb;
    st.windmills.forEach(function (w) { sw(w, 'x', 'y'); w.a = Math.PI / 2 - w.a; w.dir = -w.dir; });
    sw(st.ball, 'x', 'y'); sw(st.ball, 'vx', 'vy'); sw(st.rest, 'x', 'y'); if (st.path) st.path.forEach(function (q) { sw(q, 'x', 'y'); });
    PG.parts.forEach(function (q) { sw(q, 'x', 'y'); sw(q, 'vx', 'vy'); }); PG.pops.forEach(function (q) { sw(q, 'x', 'y'); });
  }

  /* ---------- physics ---------- */
  function cellAt(x, y) { var c = Math.floor(x / CELL), r = Math.floor(y / CELL); if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return '#'; return st.map.g[r][c]; }
  function holePos() { return { x: st.map.H.c * CELL + CELL / 2, y: st.map.H.r * CELL + CELL / 2 }; }
  function step(b, dt, real) {
    var ch = cellAt(b.x, b.y), sp = Math.hypot(b.vx, b.vy);
    if (ch === '~' && real) { splash(b.x, b.y); st.strokes++; PG.popText(b.x, b.y - 14, 'Splash! +1', '#bde0fe', 20); PG.sfx('drop'); b.x = st.rest.x; b.y = st.rest.y; b.vx = b.vy = 0; st.moving = false; return; }
    var dec = ch === ':' ? 420 : 105; if (sp > 0) { var ns = Math.max(0, sp - dec * dt); b.vx *= ns / sp; b.vy *= ns / sp; sp = ns; }
    b.x += b.vx * dt; b.y += b.vy * dt;
    var r0 = Math.floor((b.y - BR) / CELL), r1 = Math.floor((b.y + BR) / CELL), c0 = Math.floor((b.x - BR) / CELL), c1 = Math.floor((b.x + BR) / CELL);
    for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) {
      var ch2 = (c < 0 || r < 0 || c >= COLS || r >= ROWS) ? '#' : st.map.g[r][c];
      if (ch2 === '#') bounceRect(b, c * CELL, r * CELL, CELL, CELL, 0.82, real);
      else if (ch2 === 'o') bounceCircle(b, c * CELL + CELL / 2, r * CELL + CELL / 2, 14, 1.12, real, c + ',' + r);
    }
    st.windmills.forEach(function (w) { var ax = w.x + Math.cos(w.a) * w.len, ay = w.y + Math.sin(w.a) * w.len, bx = w.x - Math.cos(w.a) * w.len, by = w.y - Math.sin(w.a) * w.len; bounceSeg(b, ax, ay, bx, by, 4, real, w); });
  }
  function bounceRect(b, x, y, w, h, e, real) {
    var nx = Math.max(x, Math.min(b.x, x + w)), ny = Math.max(y, Math.min(b.y, y + h)), dx = b.x - nx, dy = b.y - ny, d = Math.hypot(dx, dy);
    if (d < BR) {
      var n; if (d < 0.0001) { n = [0, -1]; d = 0; } else n = [dx / d, dy / d]; b.x += n[0] * (BR - d); b.y += n[1] * (BR - d);
      var vn = b.vx * n[0] + b.vy * n[1]; if (vn < 0) { b.vx -= (1 + e) * vn * n[0]; b.vy -= (1 + e) * vn * n[1]; if (real && Math.abs(vn) > 40) { b.sq = Math.min(1, Math.abs(vn) / 400); PG.sfx('hit', 0.8 + Math.min(1, Math.abs(vn) / 500) * 0.5); PG.burst(b.x - n[0] * BR, b.y - n[1] * BR, 4, { colors: ['#6fbf4e', '#a7e07a'], g: 0, min: 20, max: 90, life: 0.4, shape: 's', s0: 1.5, s1: 3 }); } }
    }
  }
  function bounceCircle(b, cx, cy, r, e, real, key) {
    var dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy), md = r + BR; if (d < md && d > 0.001) { var nx = dx / d, ny = dy / d; b.x = cx + nx * md; b.y = cy + ny * md; var vn = b.vx * nx + b.vy * ny; if (vn < 0) { b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; var sp = Math.hypot(b.vx, b.vy); if (sp < 240) { b.vx *= 240 / sp; b.vy *= 240 / sp; } if (real) { st.bumps[key] = 1; PG.sfx('pop', 1.4); PG.burst(cx + nx * r, cy + ny * r, 8, { colors: ['#ff5d6c', '#fff'], g: 0 }); } } }
  }
  function bounceSeg(b, ax, ay, bx, by, th, real, w) {
    var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, t = PG.clamp(((b.x - ax) * dx + (b.y - ay) * dy) / l2, 0, 1), px = ax + dx * t, py = ay + dy * t, ex = b.x - px, ey = b.y - py, d = Math.hypot(ex, ey), md = BR + th;
    if (d < md && d > 0.001) { var nx = ex / d, ny = ey / d; b.x = px + nx * md; b.y = py + ny * md;
      var rx = px - w.x, ry = py - w.y, bvx = -ry * w.dir * 1.2, bvy = rx * w.dir * 1.2, rvn = (b.vx - bvx) * nx + (b.vy - bvy) * ny;
      if (rvn < 0) { b.vx -= (1.9) * rvn * nx; b.vy -= 1.9 * rvn * ny; if (real) { PG.sfx('hit', 1.2); b.sq = 0.6; } } }
  }
  function splash(x, y) { for (var i = 0; i < 14; i++) PG.parts.push({ x: x, y: y, vx: PG.rand(-90, 90), vy: PG.rand(-160, -30), life: 0.7, t: 0, size: PG.rand(2, 4), color: '#bde0fe', g: 420, shape: 'c' }); }
  function shoot(dx, dy, pow) { var b = st.ball, d = Math.hypot(dx, dy); if (d < 1) return; var sp = 70 + pow * 640; b.vx = dx / d * sp; b.vy = dy / d * sp; st.strokes++; st.moving = true; st.hintOn = false; st.rest = { x: b.x, y: b.y }; st.lastShot = pow; st.stuckT = 0; PG.sfx('boom', 1.4); PG.vibrate(15); PG.burst(b.x, b.y, 8, { colors: ['#fff', '#ffd166'], g: 0, min: 30, max: 140 }); }
  function holeOut() {
    st.done = true; st.doneT = 0; st.moving = false; PG.playing = false; var d = st.strokes - st.par, name = st.strokes === 1 ? 'HOLE IN ONE!' : d <= -2 ? 'Eagle!' : d === -1 ? 'Birdie!' : d === 0 ? 'Par' : d === 1 ? 'Bogey' : '+' + d;
    st.resName = name; var stars = st.strokes <= st.par ? 3 : st.strokes <= st.par + 1 ? 2 : 1; st.resStars = stars; PG.sfx(st.strokes === 1 ? 'ace' : 'win', 1.05); PG.vibrate(40); var hp = holePos();
    PG.burst(hp.x, hp.y, 40, { colors: ['#ffd23f', '#ff5d8f', '#4cc9f0', '#9be564'], g: 300, up: 220, life: 1.4, shape: 's', s0: 3, s1: 7 });
    PG.save.stars = PG.save.stars || []; var old = PG.save.stars[st.hole - 1] || 0; if (stars > old) PG.save.stars[st.hole - 1] = stars; PG.save.best = PG.save.best || []; var ob = PG.save.best[st.hole - 1] || 99; if (st.strokes < ob) PG.save.best[st.hole - 1] = st.strokes;
    var prevNext = PG.save.next || 1; PG.save.next = Math.max(prevNext, Math.min(HOLES, st.hole + 1)); PG.save.holes = (PG.save.holes || 0) + 1; PG.commit(true);
    st.newCat = null; CATS.forEach(function (ct, i) { if (ct.unlock > prevNext && ct.unlock <= PG.save.next) st.newCat = i; });
    PG.track('progression_completed', { step_id: 'hole', step_index: st.hole, strokes: Math.min(st.strokes, 20), par: st.par, stars: stars }); PG.msg('level_completed', { level: String(st.hole) });
  }
  function update(dt0) {
    st.t += dt0; PG.updateParts(dt0); PG.updatePops(dt0);
    for (var k in st.bumps) st.bumps[k] = Math.max(0, st.bumps[k] - dt0 * 4);
    if (st.state !== 'play') return;
    st.windmills.forEach(function (w) { w.a += w.dir * 1.2 * dt0; });
    var b = st.ball; b.sq = Math.max(0, b.sq - dt0 * 5);
    if (st.sunk > 0) { st.sunk += dt0; var hp = holePos(); b.x += (hp.x - b.x) * Math.min(1, dt0 * 14); b.y += (hp.y - b.y) * Math.min(1, dt0 * 14); if (st.sunk > 0.45) { st.sunk = 0; holeOut(); } return; }
    if (st.done) { st.doneT += dt0; return; }
    if (st.moving) {
      var n = 3, h = dt0 / n; for (var i = 0; i < n && st.moving; i++) {
        step(b, h, true); var sp = Math.hypot(b.vx, b.vy), hp2 = holePos(), dd = Math.hypot(b.x - hp2.x, b.y - hp2.y);
        if (dd < 24 && sp < 230) { b.vx += (hp2.x - b.x) * 6 * h; b.vy += (hp2.y - b.y) * 6 * h; }
        if (dd < 12 && sp < 330) { st.sunk = 0.001; PG.sfx('drop', 0.7); b.vx = b.vy = 0; break; }
        if (sp < 7) { b.vx = b.vy = 0; st.moving = false; st.rest = { x: b.x, y: b.y }; if (st.strokes >= st.par + 6 && !st.hintUsed) st.msg = 'Stuck? Try a hint'; }
      }
      b.rot += Math.hypot(b.vx, b.vy) * dt0 / BR; st.stuckT += dt0; if (st.stuckT > 25) { st.moving = false; b.vx = b.vy = 0; st.rest = { x: b.x, y: b.y }; }
    }
  }

  /* ---------- diorama rendering (static layers cached per hole) ---------- */
  var courseCache = {};
  function layer(name, paint) {
    var K = view.s * (PG.dpr || 1), key = name + Math.round(K * 16); if (courseCache[name] && courseCache[name].key === key) return courseCache[name].cv;
    var pad = 30, cv = document.createElement('canvas'); cv.width = Math.ceil((BW + pad * 2) * K); cv.height = Math.ceil((BH + pad * 2) * K);
    var c = cv.getContext('2d'); c.scale(K, K); c.translate(pad, pad); paint(c); courseCache[name] = { key: key, cv: cv }; return cv;
  }
  function drawLayer(c, cv) { c.drawImage(cv, -30, -30, BW + 60, BH + 60); }
  function isWall(r, c) { return r < 0 || c < 0 || r >= ROWS || c >= COLS || st.map.g[r][c] === '#'; }
  function isEdge(r, c) { return r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1; }
  function blobs(c, ch, grow) { // merge same-type cells into one rounded shape
    var g = st.map.g; c.beginPath();
    for (var r = 0; r < ROWS; r++) for (var cc = 0; cc < COLS; cc++) if (g[r][cc] === ch) {
      var x = cc * CELL + CELL / 2, y = r * CELL + CELL / 2, R = CELL * 0.5 + grow; c.moveTo(x + R, y); c.arc(x, y, R, 0, TAU);
      if (cc + 1 < COLS && g[r][cc + 1] === ch) c.rect(x, y - R, CELL, R * 2);
      if (r + 1 < ROWS && g[r + 1][cc] === ch) c.rect(x - R, y, R * 2, CELL);
      if (cc + 1 < COLS && r + 1 < ROWS && g[r][cc + 1] === ch && g[r + 1][cc] === ch && g[r + 1][cc + 1] === ch) c.rect(x, y, CELL, CELL);
    }
  }
  function paintFloor(c) {
    var g = st.map.g, rnd = PG.mulberry(st.hole * 31 + 7), r, cc;
    c.fillStyle = '#8a5530'; c.fillRect(-8, BH - 6, BW + 16, 26); c.fillStyle = '#6b3f22'; c.fillRect(-8, BH + 14, BW + 16, 6);
    c.fillStyle = 'rgba(255,220,180,.25)'; c.fillRect(-8, BH - 6, BW + 16, 2);
    for (r = 0; r < ROWS; r++) for (cc = 0; cc < COLS; cc++) { var x = cc * CELL, y = r * CELL; c.fillStyle = (Math.floor(cc / 2) + r) % 2 ? '#78c25a' : '#6db851'; c.fillRect(x, y, CELL + 0.5, CELL + 0.5); }
    for (var i = 0; i < 1400; i++) { c.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,.07)' : 'rgba(0,40,0,.07)'; c.fillRect(rnd() * BW, rnd() * BH, 1.2, 1.2); }
    c.fillStyle = '#d2ad6a'; blobs(c, ':', 3); c.fill(); c.fillStyle = '#efd9a2'; blobs(c, ':', 0); c.fill();
    c.save(); blobs(c, ':', 0); c.clip(); c.strokeStyle = 'rgba(190,150,80,.55)'; c.lineWidth = 1.2; for (var k = -BH; k < BW + BH; k += 7) { c.beginPath(); for (var q = 0; q < BH; q += 8) c.lineTo(k + q * 0.3 + Math.sin(q * 0.08) * 3, q); c.stroke(); } c.restore();
    c.fillStyle = '#2b6f9e'; blobs(c, '~', 4); c.fill(); c.fillStyle = '#4aa3df'; blobs(c, '~', 0); c.fill();
    c.save(); blobs(c, '~', 0); c.clip(); for (r = 0; r < ROWS; r++) for (cc = 0; cc < COLS; cc++) if (g[r][cc] === '~' && rnd() < 0.5) { var lx = cc * CELL + 10 + rnd() * 20, ly = r * CELL + 10 + rnd() * 20; c.fillStyle = '#5fae4a'; c.beginPath(); c.arc(lx, ly, 6, 0.4, TAU - 0.2); c.lineTo(lx, ly); c.fill(); if (rnd() < 0.4) { c.fillStyle = '#ffb3c6'; c.beginPath(); c.arc(lx + 2, ly - 2, 2.2, 0, TAU); c.fill(); } } c.restore();
    // contact shadows cast by the raised hedges
    for (r = 0; r < ROWS; r++) for (cc = 0; cc < COLS; cc++) if (g[r][cc] === '#') { c.fillStyle = 'rgba(10,40,10,.22)'; c.fillRect(cc * CELL + 4, r * CELL + 5, CELL, CELL); }
    // tee mat
    var tp = { x: st.map.S.c * CELL + CELL / 2, y: st.map.S.r * CELL + CELL / 2 }; c.fillStyle = 'rgba(0,0,0,.18)'; U.rr(c, tp.x - 17, tp.y - 13, 36, 30, 6); c.fill(); c.fillStyle = '#3f8f3a'; U.rr(c, tp.x - 18, tp.y - 15, 36, 30, 6); c.fill(); c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 1.5; c.setLineDash([3, 3]); U.rr(c, tp.x - 15, tp.y - 12, 30, 24, 4); c.stroke(); c.setLineDash([]);
    [-1, 1].forEach(function (s) { c.fillStyle = '#fff'; c.beginPath(); c.arc(tp.x + s * 22, tp.y - 12, 3, 0, TAU); c.fill(); c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.arc(tp.x + s * 22 + 1, tp.y - 10, 3, 0, TAU); c.fill(); });
    // cup
    var hp = holePos(); c.fillStyle = '#5ba545'; c.beginPath(); c.arc(hp.x, hp.y, 17, 0, TAU); c.fill(); c.fillStyle = '#f5f5f0'; c.beginPath(); c.ellipse(hp.x, hp.y + 1, 12, 10, 0, 0, TAU); c.fill(); c.fillStyle = '#122a18'; c.beginPath(); c.ellipse(hp.x, hp.y + 1.5, 10, 8, 0, 0, TAU); c.fill(); c.fillStyle = '#081a0e'; c.beginPath(); c.ellipse(hp.x, hp.y + 3, 8, 5.5, 0, 0, TAU); c.fill();
  }
  function paintWalls(c) {
    var g = st.map.g, r, cc;
    for (r = 0; r < ROWS; r++) for (cc = 0; cc < COLS; cc++) if (g[r][cc] === '#') {
      var x = cc * CELL, y = r * CELL, front = !isWall(r + 1, cc), edge = isEdge(r, cc), rnd = PG.mulberry(r * 97 + cc * 13 + 5);
      if (edge) { // painted wooden frame of the diorama
        if (front) { c.fillStyle = '#8a5530'; c.fillRect(x, y + CELL - WH, CELL + 0.5, WH); }
        c.fillStyle = '#c98b52'; c.fillRect(x, y - WH, CELL + 0.5, CELL); c.strokeStyle = 'rgba(120,70,30,.35)'; c.lineWidth = 1; for (var k = 0; k < 3; k++) { c.beginPath(); c.moveTo(x, y - WH + 8 + k * 11 + rnd() * 3); c.lineTo(x + CELL, y - WH + 8 + k * 11 + rnd() * 3); c.stroke(); }
        if (!isWall(r, cc + 1) || !isWall(r, cc - 1) || !isWall(r - 1, cc)) { c.fillStyle = 'rgba(255,230,190,.35)'; if (!isWall(r - 1, cc)) c.fillRect(x, y - WH, CELL, 2); }
        continue;
      }
      if (front) { c.fillStyle = '#2f6b2a'; c.fillRect(x, y + CELL - WH, CELL + 0.5, WH); c.fillStyle = 'rgba(0,0,0,.18)'; for (var f = 0; f < 5; f++) { c.beginPath(); c.arc(x + 4 + f * 8, y + CELL - WH + 2, 4, 0, Math.PI); c.fill(); } }
      c.fillStyle = '#3f8f38'; c.fillRect(x, y - WH, CELL + 0.5, CELL + 0.5);
      for (var b = 0; b < 9; b++) { c.fillStyle = ['#4ea544', '#5bb34f', '#47993f'][b % 3]; c.beginPath(); c.arc(x + 5 + rnd() * 30, y - WH + 5 + rnd() * 30, 5 + rnd() * 4, 0, TAU); c.fill(); }
      if (rnd() < 0.25) { c.fillStyle = rnd() < 0.5 ? '#ff8fab' : '#fff3b0'; c.beginPath(); c.arc(x + 8 + rnd() * 24, y - WH + 8 + rnd() * 24, 2.6, 0, TAU); c.fill(); }
      if (!isWall(r - 1, cc)) { c.fillStyle = 'rgba(255,255,220,.25)'; c.fillRect(x, y - WH, CELL, 3); }
      if (!isWall(r, cc - 1)) { c.fillStyle = 'rgba(0,0,0,.08)'; c.fillRect(x, y - WH, 3, CELL); }
    }
  }
  function drawWater(c, t) { // animated ripples on top of the cached pond
    var g = st.map.g; c.save(); blobs(c, '~', 0); c.clip(); c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 1.4;
    for (var r = 0; r < ROWS; r++) for (var cc = 0; cc < COLS; cc++) if (g[r][cc] === '~') for (var i = 0; i < 2; i++) { var y = r * CELL + 12 + i * 16 + Math.sin(t * 1.5 + cc + i) * 2, x = cc * CELL + 6 + ((t * 8 + i * 13 + cc * 7) % 20); c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + 5, y - 3, x + 10, y); c.stroke(); }
    c.restore();
  }
  function drawBumper(c, x, y, k) { // toy mushroom bumper
    var s = 1 + k * 0.25; c.save(); c.translate(x, y); c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(3, 6, 15, 10, 0, 0, TAU); c.fill();
    c.fillStyle = '#f3ead8'; c.fillRect(-6, -6, 12, 10); c.fillStyle = '#d8cdb5'; c.fillRect(2, -6, 4, 10);
    c.scale(s, s); c.translate(0, -8); c.fillStyle = '#b8233b'; c.beginPath(); c.ellipse(0, 4, 15, 8, 0, 0, Math.PI); c.fill();
    c.fillStyle = '#e8384f'; c.beginPath(); c.ellipse(0, 3, 15, 13, 0, Math.PI, TAU); c.ellipse(0, 3, 15, 4, 0, 0, Math.PI); c.fill();
    c.fillStyle = '#fff'; [[-7, -2, 3], [4, -5, 2.6], [8, 1, 2], [-1, 2, 1.8]].forEach(function (q) { c.beginPath(); c.ellipse(q[0], q[1], q[2], q[2] * 0.8, 0, 0, TAU); c.fill(); });
    c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(-5, -6, 5, 2.5, -0.4, 0, TAU); c.fill(); c.restore();
  }
  function drawWindmill(c, wm) {
    c.save(); c.translate(wm.x, wm.y); c.fillStyle = 'rgba(0,0,0,.22)'; c.save(); c.translate(3, 5); c.rotate(wm.a); c.fillRect(-wm.len, -4, wm.len * 2, 8); c.restore();
    c.rotate(wm.a); for (var s = -1; s <= 1; s += 2) { c.save(); c.scale(s, 1); c.fillStyle = '#f4ecdc'; c.fillRect(6, -5, wm.len - 6, 10); c.strokeStyle = '#a77b4f'; c.lineWidth = 1; for (var k = 10; k < wm.len; k += 7) { c.beginPath(); c.moveTo(k, -5); c.lineTo(k, 5); c.stroke(); } c.strokeRect(6, -5, wm.len - 6, 10); c.fillStyle = '#d64545'; c.fillRect(wm.len - 10, -5, 10, 10); c.restore(); }
    c.rotate(-wm.a); c.fillStyle = '#7a4a2a'; c.beginPath(); c.arc(0, 2, 9, 0, TAU); c.fill(); c.fillStyle = '#b4784a'; c.beginPath(); c.arc(0, 0, 8, 0, TAU); c.fill(); c.fillStyle = '#e8c08a'; c.beginPath(); c.arc(-2, -2, 3, 0, TAU); c.fill(); c.restore();
  }
  function drawFlag(c, t) { var hp = holePos(), wv = Math.sin(t * 4) * 2.5, top = hp.y - 42;
    c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 2; c.beginPath(); c.moveTo(hp.x + 1, hp.y); c.lineTo(hp.x + 16, hp.y - 8); c.stroke();
    c.strokeStyle = '#f5f5f5'; c.lineWidth = 2.4; c.beginPath(); c.moveTo(hp.x, hp.y); c.lineTo(hp.x, top); c.stroke(); c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(hp.x, top, 2.4, 0, TAU); c.fill();
    c.fillStyle = '#ef3e4a'; c.beginPath(); c.moveTo(hp.x, top + 2); c.quadraticCurveTo(hp.x + 12, top + wv, hp.x + 24, top + 7 + wv); c.quadraticCurveTo(hp.x + 12, top + 12 + wv * 0.5, hp.x, top + 15); c.fill();
    U.text(c, '' + st.hole, hp.x + 10, top + 8 + wv * 0.4, 9, '#fff', 'center', { shadow: false }); }
  function drawCat(c, x, y, r, t, cat, o) {
    o = o || {}; var cs = CATS[cat]; c.save(); c.translate(x, y); var sp = o.speed || 0, ang = o.ang || 0, sq = o.sq || 0, str = 1 + Math.min(0.25, sp / 1800); c.rotate(ang); c.scale(str * (1 - sq * 0.25), (1 / str) * (1 + sq * 0.25)); c.rotate(-ang);
    var s = r / 8, line = U.shade(cs.body, -0.45);
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(2 * s, 7 * s, 8.5 * s, 4 * s, 0, 0, TAU); c.fill();
    c.lineJoin = 'round'; c.strokeStyle = line; c.lineWidth = 0.9 * s;
    [-1, 1].forEach(function (d) { c.fillStyle = cs.body; c.beginPath(); c.moveTo(d * 3 * s, -6 * s); c.lineTo(d * 8.5 * s, -12.5 * s); c.lineTo(d * 9 * s, -2 * s); c.closePath(); c.fill(); c.stroke(); c.fillStyle = cs.ear; c.beginPath(); c.moveTo(d * 4.5 * s, -6 * s); c.lineTo(d * 7.6 * s, -10 * s); c.lineTo(d * 7.8 * s, -4 * s); c.closePath(); c.fill(); });
    c.fillStyle = cs.body; c.beginPath(); c.arc(0, 0, 9 * s, 0, TAU); c.fill(); c.stroke();
    c.save(); c.beginPath(); c.arc(0, 0, 9 * s, 0, TAU); c.clip();
    if (cs.patch2) { c.fillStyle = cs.patch2; c.beginPath(); c.arc(-5 * s, -4 * s, 4.5 * s, 0, TAU); c.fill(); c.fillStyle = cs.patch; c.beginPath(); c.arc(5 * s, -3 * s, 4 * s, 0, TAU); c.fill(); }
    else if (cs.n === 'Tux') { c.fillStyle = cs.patch; c.beginPath(); c.ellipse(0, 3 * s, 5.5 * s, 5 * s, 0, 0, TAU); c.fill(); }
    else if (cs.mask) { c.fillStyle = cs.mask; c.beginPath(); c.ellipse(0, 1 * s, 5.5 * s, 5 * s, 0, 0, TAU); c.fill(); }
    c.fillStyle = 'rgba(0,0,0,.12)'; c.beginPath(); c.arc(2.5 * s, 2.5 * s, 9 * s, 0, TAU); c.arc(0, 0, 8 * s, 0, TAU, true); c.fill();
    c.restore();
    if (cs.stripe) { c.strokeStyle = cs.stripe; c.lineWidth = 1.3 * s; c.lineCap = 'round'; [-4, 0, 4].forEach(function (k) { c.beginPath(); c.moveTo(k * s, -8.6 * s); c.lineTo(k * s * 0.9, -5.5 * s); c.stroke(); }); }
    c.fillStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.ellipse(-3.5 * s, -5.5 * s, 3 * s, 1.6 * s, -0.5, 0, TAU); c.fill();
    var dizzy = sp > 260, happy = o.happy;
    [-1, 1].forEach(function (d) { var ex = d * 3.6 * s, ey = -0.8 * s; if (dizzy) { c.strokeStyle = '#222'; c.lineWidth = 1.2 * s; c.beginPath(); c.moveTo(ex - 1.6 * s, ey - 1.6 * s); c.lineTo(ex + 1.6 * s, ey + 1.6 * s); c.moveTo(ex + 1.6 * s, ey - 1.6 * s); c.lineTo(ex - 1.6 * s, ey + 1.6 * s); c.stroke(); } else if (happy) { c.strokeStyle = '#222'; c.lineWidth = 1.3 * s; c.beginPath(); c.arc(ex, ey + 0.8 * s, 1.8 * s, Math.PI, 0); c.stroke(); } else { c.fillStyle = '#fff'; c.beginPath(); c.ellipse(ex, ey, 2.2 * s, 2.5 * s, 0, 0, TAU); c.fill(); c.fillStyle = cs.eye; c.beginPath(); c.ellipse(ex, ey, 1.5 * s, 2 * s, 0, 0, TAU); c.fill(); c.fillStyle = '#111'; c.beginPath(); c.ellipse(ex, ey, 0.7 * s, 1.5 * s, 0, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(ex - 0.5 * s, ey - 0.8 * s, 0.5 * s, 0, TAU); c.fill(); } });
    c.fillStyle = '#f08a9c'; c.beginPath(); c.moveTo(-1.3 * s, 2.2 * s); c.lineTo(1.3 * s, 2.2 * s); c.lineTo(0, 3.6 * s); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = 0.9 * s; c.beginPath(); c.moveTo(0, 3.6 * s); c.lineTo(0, 4.4 * s); c.moveTo(-3 * s, 5 * s); c.quadraticCurveTo(-1.5 * s, 5.8 * s, 0, 4.4 * s); c.quadraticCurveTo(1.5 * s, 5.8 * s, 3 * s, 5 * s); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 0.6 * s; [-1, 1].forEach(function (d) { c.beginPath(); c.moveTo(d * 5 * s, 3 * s); c.lineTo(d * 11 * s, 2 * s); c.moveTo(d * 5 * s, 4 * s); c.lineTo(d * 11 * s, 5 * s); c.stroke(); });
    if (dizzy && sp > 300) { for (var i = 0; i < 3; i++) { var a = t * 9 + i * 2.1; c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(Math.cos(a) * 11 * s, -11 * s + Math.sin(a) * 3 * s, 1.5 * s, 0, TAU); c.fill(); } }
    c.restore();
  }
  function predict() {
    var a = st.aim; if (!a) return null; var b = { x: st.ball.x, y: st.ball.y, vx: a.dx / a.d * (70 + a.pow * 640), vy: a.dy / a.d * (70 + a.pow * 640) }, pts = [];
    for (var i = 0; i < 90; i++) { step(b, 1 / 60, false); if (cellAt(b.x, b.y) === '~') break; pts.push({ x: b.x, y: b.y }); if (Math.hypot(b.vx, b.vy) < 8) break; } return pts;
  }
  function computeView(w, h) { var sc = PG.scale(), top = land ? 12 * sc : 70 * sc, bot = land ? 12 * sc : 74 * sc, side = land ? 136 * sc : 0, availH = h - top - bot; view.s = Math.min((w - side * 2) * 0.96 / (BW + 20), availH / (BH + 34)); view.ox = (w - BW * view.s) / 2; view.oy = top + (availH - (BH + 20) * view.s) / 2 + 12 * view.s; }
  function drawBoardLayer(c, w, h, t) {
    computeView(w, h);
    c.save(); c.translate(view.ox, view.oy); c.scale(view.s, view.s);
    c.fillStyle = 'rgba(30,20,10,.28)'; c.fillRect(-2, 6, BW + 18, BH + 24);
    drawLayer(c, layer('floor', paintFloor)); drawWater(c, t);
    if (st.hintOn && st.path) { c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 4; c.lineCap = 'round'; c.setLineDash([2, 10]); c.lineDashOffset = -t * 20; c.beginPath(); st.path.forEach(function (p, i) { if (i) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); }); c.stroke(); c.setLineDash([]); }
    st.windmills.forEach(function (wm) { drawWindmill(c, wm); });
    var b = st.ball, walls = layer('walls', paintWalls), K = view.s * (PG.dpr || 1), brow = Math.floor((b.y + 2) / CELL);
    drawLayer(c, walls);
    for (var key in st.bumps) { var p = key.split(','); if (+p[1] <= brow) drawBumper(c, +p[0] * CELL + CELL / 2, +p[1] * CELL + CELL / 2, st.bumps[key]); }
    drawFlagMaybe(c, t, brow, true);
    if (st.aim && !st.moving && !st.done) {
      var a = st.aim, pts = predict(); if (pts) { for (var i = 0; i < pts.length; i += 3) { c.globalAlpha = 1 - i / pts.length * 0.85; c.fillStyle = '#fff'; c.beginPath(); c.arc(pts[i].x, pts[i].y, 2.8, 0, TAU); c.fill(); } c.globalAlpha = 1; }
      var pw = a.pow; c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x - a.dx / a.d * Math.min(a.d, 90), b.y - a.dy / a.d * Math.min(a.d, 90)); c.stroke();
      c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 7; c.beginPath(); c.arc(b.x, b.y, 18 + pw * 10, -2.6, -2.6 + pw * 5.2); c.stroke();
      c.strokeStyle = 'hsl(' + (120 - pw * 120) + ',85%,55%)'; c.lineWidth = 5; c.stroke();
    }
    var sunkS = st.sunk > 0 ? Math.max(0.1, 1 - st.sunk / 0.45) : 1, sp = Math.hypot(b.vx, b.vy);
    c.save(); c.translate(b.x, b.y); c.scale(sunkS, sunkS); drawCat(c, 0, 0, BR + 2.5, t, PG.save.cat || 0, { speed: sp, ang: Math.atan2(b.vy, b.vx), sq: b.sq, happy: st.done || st.sunk > 0 }); c.restore();
    // hedges in front of the cat are redrawn over it
    var cy = (brow + 1) * CELL - WH; if (cy < BH + 30) { c.save(); c.beginPath(); c.rect(-30, cy, BW + 60, BH + 60 - cy); c.clip(); drawLayer(c, walls); c.restore(); }
    for (key in st.bumps) { var p2 = key.split(','); if (+p2[1] > brow) drawBumper(c, +p2[0] * CELL + CELL / 2, +p2[1] * CELL + CELL / 2, st.bumps[key]); }
    drawFlagMaybe(c, t, brow, false);
    PG.drawParts(c); PG.drawPops(c); c.restore();
  }
  function drawFlagMaybe(c, t, brow, before) { var hr = st.map.H.r; if ((hr <= brow) === before) drawFlag(c, t); }

  /* ---------- theme: plastic toy buttons and a scorecard ---------- */
  PG.theme.font = 'Fredoka'; PG.theme.body = 'Fredoka'; PG.theme.weight = '600'; PG.theme.bodyWeight = '600'; PG.theme.text = DARK; PG.theme.textShadow = false; PG.theme.pageColor = '#2a3b2c';
  PG.theme.transition = { style: 'wipe', color: GREEN, time: 0.38 };
  PG.theme.popStyle = { stroke: 'rgba(20,50,30,.8)' };
  PG.theme.button = function (c, x, y, w, h, label, o, s) {
    var col = o.disabled ? '#a9b3ad' : o.color || '#2ec4b6', r = Math.min(h / 2, 22), off = s.press ? 4 : 0;
    c.fillStyle = 'rgba(0,0,0,.22)'; U.rr(c, x + 2, y + 8, w, h, r); c.fill();
    c.fillStyle = U.shade(col, -0.32); U.rr(c, x, y + 5, w, h, r); c.fill();
    var g = c.createLinearGradient(0, y + off, 0, y + off + h); g.addColorStop(0, U.shade(col, s.hover ? 0.3 : 0.18)); g.addColorStop(1, col); c.fillStyle = g; U.rr(c, x, y + off, w, h, r); c.fill();
    c.fillStyle = 'rgba(255,255,255,.4)'; U.rr(c, x + r * 0.5, y + off + 3, w - r, h * 0.3, h * 0.15); c.fill();
    if (label) U.text(c, label, x + w / 2, y + off + h / 2 + 1, U.fit(c, label, o.size || Math.min(h * 0.44, 26), w - 18), o.textColor || '#fff', 'center', { shadow: 'rgba(0,0,0,.25)' });
  };
  PG.theme.panel = function (c, x, y, w, h, o) {
    c.fillStyle = 'rgba(0,0,0,.25)'; U.rr(c, x + 3, y + 8, w, h, 18); c.fill(); c.fillStyle = CREAM; U.rr(c, x, y, w, h, 18); c.fill();
    c.save(); U.rr(c, x, y, w, h, 18); c.clip(); c.fillStyle = GREEN; c.fillRect(x, y, w, (o && o.header) || 14); c.restore();
    c.strokeStyle = 'rgba(29,58,43,.25)'; c.lineWidth = 1.5; U.rr(c, x + 6, y + 6, w - 12, h - 12, 14); c.stroke();
  };
  PG.theme.hudButton = function (c, x, y, r, kind) { c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.arc(x + 1, y + 4, r, 0, TAU); c.fill(); c.fillStyle = '#e6efe6'; c.beginPath(); c.arc(x, y + 2, r, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); PG.hudIcon(c, x, y, r * 0.95, kind, GREEN); };
  PG.theme.loading = function (c, w, h, t) { c.fillStyle = GREEN; c.fillRect(0, 0, w, h); var x = w / 2 + Math.sin(t * 2) * 40; c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(x + 3, h / 2 + 14, 13, 5, 0, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(x, h / 2, 14, 0, TAU); c.fill(); c.fillStyle = 'rgba(0,0,0,.12)'; for (var i = 0; i < 6; i++) { c.beginPath(); c.arc(x - 6 + (i % 3) * 6, h / 2 - 4 + Math.floor(i / 3) * 7, 1.6, 0, TAU); c.fill(); } };
  function room(c, w, h, t) { // soft tilt-shift room behind the diorama
    var g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#cfe8f3'); g.addColorStop(0.55, '#e9e2cf'); g.addColorStop(1, '#b98d62'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    bokeh.forEach(function (b) { var x = b.x * w + Math.sin(t * 0.2 + b.p) * 10, y = b.y * h * 0.6, r = b.r * PG.scale(), rg = c.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, 'rgba(' + b.c + ',.35)'); rg.addColorStop(0.7, 'rgba(' + b.c + ',.18)'); rg.addColorStop(1, 'rgba(' + b.c + ',0)'); c.fillStyle = rg; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); });
    c.fillStyle = 'rgba(120,80,40,.25)'; c.fillRect(0, h * 0.82, w, h * 0.18);
  }
  function pill(c, x, y, w, h, label, val, col) { c.fillStyle = 'rgba(0,0,0,.18)'; U.rr(c, x + 1, y + 4, w, h, h / 2); c.fill(); c.fillStyle = '#fff'; U.rr(c, x, y, w, h, h / 2); c.fill(); c.fillStyle = col; U.rr(c, x, y, h * 1.25, h, h / 2); c.fill(); var sc = PG.scale(); U.text(c, label, x + h * 0.62, y + h / 2 + 1, h * 0.36, '#fff', 'center', { shadow: false }); U.text(c, val, x + h * 1.25 + (w - h * 1.25) / 2, y + h / 2 + 1, h * 0.5, DARK, 'center', { shadow: false }); }
  function starShape(c, r) { c.beginPath(); for (var j = 0; j < 10; j++) { var a = j * 0.628 - 1.57, rr = j % 2 ? r * 0.45 : r; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); }
  function drawHUDplay(c, w, h, sc) {
    var ph = 34 * sc; pill(c, 12 * sc, 14 * sc, 96 * sc, ph, 'HOLE', '' + st.hole, GREEN); pill(c, land ? 12 * sc : 116 * sc, land ? 56 * sc : 14 * sc, land ? 96 * sc : 82 * sc, ph, 'PAR', '' + st.par, '#3a86ff');
    pill(c, 12 * sc, land ? 98 * sc : 54 * sc, land ? 112 * sc : 120 * sc, ph * 0.9, 'SHOTS', '' + st.strokes, st.strokes > st.par ? '#ef6c3a' : '#f2a516');
    var bw = Math.min(110 * sc, w * 0.28), bh = 46 * sc, by = h - 60 * sc, rx = w - bw - 12 * sc, b1 = land ? { x: rx, y: h - (bh + 12 * sc) * 3 } : { x: 12 * sc, y: by }, b2 = land ? { x: rx + bw * 0.08, y: h - (bh + 12 * sc) * 2 } : { x: w / 2 - bw * 0.42, y: by }, b3 = land ? { x: rx, y: h - (bh + 12 * sc) } : { x: rx, y: by };
    if (U.button(c, b1.x, b1.y, bw, bh, 'Retry', { color: '#ff9f1c', size: 17 * sc })) PG.go(function () { loadHole(st.hole); });
    if (U.button(c, b2.x, b2.y, bw * 0.84, bh, 'Holes', { color: '#7a8b99', size: 16 * sc })) PG.go(function () { st.state = 'select'; PG.playing = false; });
    if (!st.hintUsed && st.strokes >= 3 && PG.rewardedSupported()) { if (U.button(c, b3.x, b3.y, bw, bh, 'Hint (ad)', { color: '#8a5cf6', size: 16 * sc })) PG.rewarded('bonus').then(function (ok) { if (ok) { st.hintUsed = true; st.hintOn = true; st.path = bfsPath(st.map.g, { c: Math.floor(st.ball.x / CELL), r: Math.floor(st.ball.y / CELL) }, st.map.H); PG.track('rewarded_hint', { hole: st.hole }); } }); }
    else if (st.hintUsed) { if (U.button(c, b3.x, b3.y, bw, bh, st.hintOn ? 'Hide path' : 'Show path', { color: '#5c6bc0', size: 15 * sc })) { st.hintOn = !st.hintOn; st.path = bfsPath(st.map.g, { c: Math.floor(st.ball.x / CELL), r: Math.floor(st.ball.y / CELL) }, st.map.H); } }
    var tip = st.strokes === 0 && st.hole === 1 && !st.aim ? 'Drag back from the cat, then let go' : st.msg && st.strokes >= 3 ? st.msg : null;
    if (tip) { var tw = Math.min(w * 0.9, U.measure(c, tip, 16 * sc) + 30 * sc), tyy = land ? h - 44 * sc : by - 44 * sc; c.fillStyle = 'rgba(255,255,255,.92)'; U.rr(c, w / 2 - tw / 2, tyy, tw, 32 * sc, 16 * sc); c.fill(); U.text(c, tip, w / 2, tyy + 17 * sc, U.fit(c, tip, 16 * sc, tw - 20), DARK, 'center', { shadow: false }); }
  }
  function drawResult(c, w, h, sc) {
    if (st.doneT < 0.5) return; var k = PG.ease.out(Math.min(1, (st.doneT - 0.5) * 2.2));
    c.fillStyle = 'rgba(10,30,20,' + 0.45 * k + ')'; c.fillRect(0, 0, w, h);
    var pw = Math.min(w * 0.88, 360 * sc), ph = (st.newCat !== null ? 372 : 340) * sc, px = w / 2 - pw / 2, py = Math.max(8 * sc, h * 0.46 - ph / 2) + (1 - k) * 60; U.panel(c, px, py, pw, ph, { header: 44 * sc });
    U.text(c, 'SCORECARD', px + 22 * sc, py + 23 * sc, 18 * sc, '#fff', 'left', { shadow: false }); U.text(c, 'Hole ' + st.hole + ' of ' + HOLES, px + pw - 22 * sc, py + 23 * sc, 14 * sc, '#d6f5d6', 'right', { shadow: false });
    var cols = [['PAR', st.par], ['SHOTS', st.strokes], ['BEST', (PG.save.best || [])[st.hole - 1] || st.strokes]], cw = (pw - 44 * sc) / 3, ty = py + 58 * sc;
    cols.forEach(function (q, i) { var cx = px + 22 * sc + i * cw; c.strokeStyle = 'rgba(29,58,43,.3)'; c.lineWidth = 1.2; c.strokeRect(cx, ty, cw, 62 * sc); U.text(c, q[0], cx + cw / 2, ty + 15 * sc, 12 * sc, '#5d7a68', 'center', { shadow: false }); U.text(c, '' + q[1], cx + cw / 2, ty + 42 * sc, 28 * sc, DARK, 'center', { shadow: false }); });
    var stamp = PG.ease.back(Math.min(1, Math.max(0, (st.doneT - 0.8) * 3))); if (stamp > 0) { c.save(); c.translate(w / 2, ty + 98 * sc); c.rotate(-0.08); c.scale(stamp * (1 + (1 - Math.min(1, stamp)) * 0.4), stamp); var good = st.strokes <= st.par, sc2 = Math.min(30 * sc, (pw * 0.8) / Math.max(5, st.resName.length) * 1.6), tw = U.measure(c, st.resName, sc2) + 30 * sc; c.strokeStyle = good ? '#d63b3b' : '#4a6fa5'; c.lineWidth = 3; U.rr(c, -tw / 2, -22 * sc, tw, 44 * sc, 8); c.stroke(); U.text(c, st.resName, 0, 1, sc2, good ? '#d63b3b' : '#4a6fa5', 'center', { shadow: false }); c.restore(); }
    for (var i = 0; i < 3; i++) { c.save(); c.translate(w / 2 + (i - 1) * 44 * sc, ty + 150 * sc); var on = i < st.resStars, pop = PG.ease.back(Math.min(1, Math.max(0, (st.doneT - 1.0 - i * 0.18) * 3))); c.scale(pop * sc, pop * sc); c.fillStyle = 'rgba(0,0,0,.15)'; c.translate(1, 3); starShape(c, 17); c.fill(); c.translate(-1, -3); c.fillStyle = on ? '#ffc93c' : '#dfe5df'; starShape(c, 17); c.fill(); c.strokeStyle = on ? '#d89a12' : '#c5cdc5'; c.lineWidth = 2; c.stroke(); c.restore(); }
    var yy = ty + 180 * sc;
    if (st.newCat !== null) { var nc = CATS[st.newCat]; drawCat(c, w / 2 - 70 * sc, yy + 6 * sc, 10 * sc, PG.time, st.newCat, { happy: true }); U.text(c, 'New cat: ' + nc.n + '!', w / 2 + 10 * sc, yy + 8 * sc, 16 * sc, '#c2410c', 'center', { shadow: false }); yy += 34 * sc; }
    var bw = pw * 0.8, bh = 50 * sc;
    if (U.button(c, w / 2 - bw / 2, yy, bw, bh, st.hole >= HOLES ? 'Course complete!' : 'Next hole', { color: '#2ec4b6' })) { PG.interstitial('level_end').then(function () { PG.go(function () { if (st.hole >= HOLES) { st.state = 'select'; } else loadHole(st.hole + 1); }); }); }
    if (U.button(c, w / 2 - bw / 2, yy + bh + 10 * sc, bw / 2 - 5 * sc, bh * 0.8, 'Replay', { color: '#ff9f1c', size: 16 * sc })) PG.go(function () { loadHole(st.hole); });
    if (U.button(c, w / 2 + 5 * sc, yy + bh + 10 * sc, bw / 2 - 5 * sc, bh * 0.8, 'Holes', { color: '#7a8b99', size: 16 * sc })) PG.go(function () { st.state = 'select'; });
  }
  function toyTitle(c, s, x, y, size, cols, rot) {
    c.save(); c.translate(x, y); c.rotate(rot || 0); c.font = U.fontStr(size); var tw = c.measureText(s).width, cx = -tw / 2;
    for (var i = 0; i < s.length; i++) { var ch = s[i], cw = c.measureText(ch).width; if (ch !== ' ') { var bob = Math.sin(PG.time * 2.4 + i * 0.7) * size * 0.04; c.save(); c.translate(cx + cw / 2, bob); c.rotate(Math.sin(i * 1.9) * 0.06); c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
      c.fillStyle = 'rgba(0,0,0,.25)'; c.fillText(ch, size * 0.04, size * 0.12); c.fillStyle = U.shade(cols[i % cols.length], -0.35); c.fillText(ch, 0, size * 0.07); c.strokeStyle = '#fff'; c.lineWidth = size * 0.12; c.strokeText(ch, 0, 0); c.fillStyle = cols[i % cols.length]; c.fillText(ch, 0, 0); c.fillStyle = 'rgba(255,255,255,.35)'; c.save(); c.beginPath(); c.rect(-cw, -size, cw * 2, size * 0.75); c.clip(); c.fillText(ch, 0, 0); c.restore(); c.restore(); }
      cx += cw; }
    c.restore();
  }
  function drawMenu(c, w, h, t) {
    var sc = PG.scale(), land = w > h, cx = land ? w * 0.3 : w / 2, tsz = Math.min(50 * sc, (land ? w * 0.5 : w) * 0.12);
    toyTitle(c, 'CAT CANNON', cx, land ? h * 0.2 : h * 0.12, tsz, ['#ef476f', '#ffb703', '#06d6a0', '#118ab2'], -0.03); toyTitle(c, 'GOLF', cx, (land ? h * 0.2 : h * 0.12) + tsz * 1.25, tsz * 1.3, ['#3a9a48', '#ff8c42', '#3a86ff', '#ef476f'], 0.02);
    var my = land ? h * 0.66 : h * 0.4, cat = PG.save.cat || 0;
    c.fillStyle = '#6db851'; c.beginPath(); c.ellipse(cx, my + 44 * sc, 90 * sc, 22 * sc, 0, 0, TAU); c.fill(); c.fillStyle = '#5ba545'; c.beginPath(); c.ellipse(cx, my + 48 * sc, 90 * sc, 20 * sc, 0, 0, Math.PI); c.fill();
    c.fillStyle = '#122a18'; c.beginPath(); c.ellipse(cx + 50 * sc, my + 44 * sc, 10 * sc, 5 * sc, 0, 0, TAU); c.fill(); c.strokeStyle = '#f5f5f5'; c.lineWidth = 2 * sc; c.beginPath(); c.moveTo(cx + 50 * sc, my + 44 * sc); c.lineTo(cx + 50 * sc, my - 10 * sc); c.stroke(); c.fillStyle = '#ef3e4a'; c.beginPath(); c.moveTo(cx + 50 * sc, my - 10 * sc); c.lineTo(cx + 72 * sc, my - 3 * sc + Math.sin(t * 4) * 2); c.lineTo(cx + 50 * sc, my + 4 * sc); c.fill();
    c.save(); c.translate(cx - 18 * sc, my + 10 * sc - Math.abs(Math.sin(t * 2.5)) * 14 * sc); c.rotate(Math.sin(t * 1.5) * 0.12); drawCat(c, 0, 0, 30 * sc, t, cat, { happy: Math.sin(t) > 0.6 }); c.restore();
    var bw = Math.min(240 * sc, land ? w * 0.38 : w * 0.7), bh = 60 * sc, bx = land ? w * 0.72 - bw / 2 : w / 2 - bw / 2, y0 = land ? h * 0.3 : h * 0.6, next = Math.min(HOLES, PG.save.next || 1);
    if (U.button(c, bx, y0, bw, bh, (PG.save.holes ? 'Play hole ' + next : 'Tee off!'), { color: '#2ec4b6', size: 24 * sc })) PG.go(function () { loadHole(next); });
    if (U.button(c, bx, y0 + bh + 14 * sc, bw, bh * 0.8, 'Holes & cats', { color: '#ff9f1c', size: 19 * sc })) PG.go(function () { st.state = 'select'; });
    var stars = (PG.save.stars || []).reduce(function (a, b) { return a + (b || 0); }, 0); c.save(); c.translate(bx + bw / 2 - 40 * sc, y0 + bh * 1.8 + 40 * sc); c.scale(sc * 0.6, sc * 0.6); c.fillStyle = '#ffc93c'; starShape(c, 17); c.fill(); c.strokeStyle = '#d89a12'; c.lineWidth = 2; c.stroke(); c.restore();
    U.text(c, stars + ' / ' + HOLES * 3, bx + bw / 2 - 24 * sc, y0 + bh * 1.8 + 41 * sc, 18 * sc, DARK, 'left', { shadow: false });
    U.text(c, 'Music: Igor Gundarev   Sounds: Kenney', w / 2, h - 16 * sc, 12 * sc, 'rgba(60,40,20,.7)', 'center', { shadow: false });
  }
  function drawSelect(c, w, h, t) {
    var sc = PG.scale(); c.fillStyle = 'rgba(30,50,35,.35)'; c.fillRect(0, 0, w, h);
    var pw = Math.min(w * 0.95, 430 * sc), px = w / 2 - pw / 2, py = 14 * sc, ph = h - 28 * sc; U.panel(c, px, py, pw, ph, { header: 40 * sc });
    U.text(c, 'Pick a cat', w / 2, py + 21 * sc, 18 * sc, '#fff', 'center', { shadow: false });
    var next = PG.save.next || 1, cs = Math.min(pw / 5.4, 68 * sc);
    CATS.forEach(function (ct, i) { var x = w / 2 + (i - 2) * cs * 1.06, y = py + 82 * sc, unlocked = ct.unlock <= next, on = (PG.save.cat || 0) === i;
      if (on) { c.fillStyle = 'rgba(255,201,60,.35)'; c.beginPath(); c.arc(x, y, cs * 0.48, 0, TAU); c.fill(); c.strokeStyle = '#ffc93c'; c.lineWidth = 2.5; c.stroke(); }
      c.save(); if (!unlocked) c.globalAlpha = 0.28; drawCat(c, x, y, cs * 0.28, t, i, { happy: on }); c.restore();
      U.text(c, unlocked ? ct.n : 'Hole ' + ct.unlock, x, y + cs * 0.56, 12 * sc, unlocked ? DARK : '#8a9a90', 'center', { shadow: false });
      if (unlocked && U.hit(x - cs * 0.5, y - cs * 0.5, cs, cs)) { PG.save.cat = i; PG.commit(); PG.sfx('merge'); } });
    c.strokeStyle = 'rgba(29,58,43,.2)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(px + 24 * sc, py + 132 * sc); c.lineTo(px + pw - 24 * sc, py + 132 * sc); c.stroke();
    U.text(c, 'Holes', w / 2, py + 150 * sc, 18 * sc, DARK, 'center', { shadow: false });
    var cols = 5, rows = 6, gw = (pw - 40 * sc) / cols, gh = Math.min(gw * 0.95, (ph - 240 * sc) / rows), gx0 = px + 20 * sc, gy0 = py + 168 * sc;
    for (var i = 0; i < HOLES; i++) { var cx = gx0 + (i % cols) * gw, cy = gy0 + Math.floor(i / cols) * gh, unlocked = i + 1 <= next, stars = (PG.save.stars || [])[i] || 0;
      if (U.button(c, cx + 4 * sc, cy + 3 * sc, gw - 8 * sc, gh - 12 * sc, '' + (i + 1), { color: unlocked ? (stars === 3 ? '#2ec4b6' : '#3a86ff') : '#b9c2bc', size: Math.min(20 * sc, gh * 0.34), disabled: !unlocked })) PG.go(function (n) { return function () { loadHole(n); }; }(i + 1));
      if (unlocked) for (var s = 0; s < 3; s++) { c.save(); c.translate(cx + gw / 2 + (s - 1) * 10 * sc, cy + gh - 4 * sc); c.scale(sc * 0.24, sc * 0.24); c.fillStyle = s < stars ? '#ffc93c' : '#dfe5df'; starShape(c, 17); c.fill(); c.restore(); } }
    if (U.button(c, w / 2 - 80 * sc, py + ph - 58 * sc, 160 * sc, 44 * sc, 'Back', { color: '#ff9f1c', size: 17 * sc })) PG.go(function () { st.state = 'menu'; });
  }
  function render(c, w, h) {
    var t = PG.time, sc = PG.scale(); setOrientation(w > h * 1.1); room(c, w, h, t);
    if (st.state === 'menu') drawMenu(c, w, h, t);
    else if (st.state === 'select') drawSelect(c, w, h, t);
    else { drawBoardLayer(c, w, h, t); drawHUDplay(c, w, h, sc); if (st.done) drawResult(c, w, h, sc); }
    PG.vignette(c, w, h, 0.25);
  }
  PG.onDown = function (x, y) {
    if (st.state !== 'play' || st.moving || st.done || st.sunk > 0 || PG.userPaused) return; var sc = PG.scale(); if (!land && y > PG.h - 64 * sc) return;
    var bx = (x - view.ox) / view.s, by = (y - view.oy) / view.s; if (Math.hypot(bx - st.ball.x, by - st.ball.y) < 90) st.aim = { sx: x, sy: y, dx: 0, dy: 0, d: 1, pow: 0 }; // drag from anywhere near the cat
  };
  PG.onMove = function (x, y) { var a = st.aim; if (!a) return; var dx = (a.sx - x) / view.s, dy = (a.sy - y) / view.s, d = Math.hypot(dx, dy); a.dx = dx; a.dy = dy; a.d = Math.max(1, d); a.pow = PG.clamp(d / 140, 0, 1); };
  PG.onUp = function () { var a = st.aim; st.aim = null; if (!a || st.state !== 'play' || st.moving || st.done) return; if (a.pow > 0.07) shoot(a.dx, a.dy, a.pow); };
  PG.setup(document.getElementById('c'), update, render);
  window.__golf = { st: st, load: loadHole, shoot: shoot, bfs: bfs, genHole: genHole, update: update };
  PG.init({ id: 'cat_cannon_golf', version: '1.1.0', defaults: { next: 1, stars: [], best: [], cat: 0, holes: 0, muted: false } }).then(function () {
    PG.music();
  });
})();
