/* CAT CANNON GOLF - drag back, let go, and fire your cat into the hole. 30 holes with sand, water, bumpers and windmills. */
(function () {
  'use strict';
  var U = PG.ui, TAU = 6.2832, CELL = 40, COLS = 10, ROWS = 16, BW = COLS * CELL, BH = ROWS * CELL, BR = 8, HOLES = 30;
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
  var st = { state: 'menu', hole: 1, map: null, ball: { x: 0, y: 0, vx: 0, vy: 0, sq: 0, rot: 0 }, strokes: 0, par: 3, rest: { x: 0, y: 0 }, aim: null, moving: false, sunk: 0, sinkT: 0, done: false, doneT: 0, hintOn: false, hintUsed: false, hintPath: null, splash: [], bumps: {}, windmills: [], t: 0, totalStrokes: 0, path: null, msg: null, runIdx: 0, stuckT: 0 };
  var view = { s: 1, ox: 0, oy: 0 }, sel = { page: 0 };
  var clouds = []; for (var i = 0; i < 6; i++) clouds.push({ x: Math.random(), y: Math.random(), s: 0.5 + Math.random(), v: 0.004 + Math.random() * 0.006 });

  /* ---------- hole data ---------- */
  function parseMap(rows) { var g = []; var S, H; for (var r = 0; r < ROWS; r++) { g.push([]); for (var c = 0; c < COLS; c++) { var ch = rows[r][c]; if (ch === 'S') { S = { c: c, r: r }; ch = '.'; } if (ch === 'H') { H = { c: c, r: r }; ch = '.'; } g[r].push(ch); } } return { g: g, S: S, H: H }; }
  function bfs(g, S, H) { var dist = {}, q = [[S.c, S.r]], k = S.c + ',' + S.r; dist[k] = 0; while (q.length) { var p = q.shift(), d = dist[p[0] + ',' + p[1]]; if (p[0] === H.c && p[1] === H.r) return d; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (o) { var x = p[0] + o[0], y = p[1] + o[1]; if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return; var ch = g[y][x]; if (ch === '#' || ch === '~') return; var kk = x + ',' + y; if (dist[kk] === undefined) { dist[kk] = d + 1; q.push([x, y]); } }); } return -1; }
  function bfsPath(g, S, H) { var prev = {}, q = [[S.c, S.r]]; prev[S.c + ',' + S.r] = null; while (q.length) { var p = q.shift(); if (p[0] === H.c && p[1] === H.r) break; [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (o) { var x = p[0] + o[0], y = p[1] + o[1]; if (x < 0 || y < 0 || x >= COLS || y >= ROWS) return; var ch = g[y][x]; if (ch === '#' || ch === '~') return; var kk = x + ',' + y; if (!(kk in prev)) { prev[kk] = p; q.push([x, y]); } }); } var out = [], cur = [H.c, H.r]; while (cur) { out.unshift({ x: cur[0] * CELL + CELL / 2, y: cur[1] * CELL + CELL / 2 }); cur = prev[cur[0] + ',' + cur[1]]; } return out; }
  function genHole(n) {
    var rnd = PG.mulberry(n * 7919 + 3), tries = 0, best = null;
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
      var bumps = []; if (n >= 8) { var nb = Math.min(1 + Math.floor((n - 8) / 4), 5); for (i = 0; i < nb; i++) { var bx = 1 + Math.floor(rnd() * 8), by = 4 + Math.floor(rnd() * 8); if (g[by][bx] === '.' && !(Math.abs(bx - S.c) < 2 && Math.abs(by - S.r) < 2) && !(Math.abs(bx - H.c) < 2 && Math.abs(by - H.r) < 2)) { g[by][bx] = 'o'; } } }
      var wm = []; if (n >= 12) { var nw = n >= 22 ? 2 : 1; for (i = 0; i < nw; i++) { for (var q = 0; q < 12; q++) { var wx = 2 + Math.floor(rnd() * 6), wy = 5 + Math.floor(rnd() * 6), ok = true; for (y = wy - 1; y <= wy + 1; y++) for (x = wx - 1; x <= wx + 1; x++) if (g[y][x] !== '.') ok = false; if (ok) { g[wy][wx] = 'W'; break; } } } }
      var d = bfs(g, S, H); if (d < 8) continue; best = { g: g, S: S, H: H, d: d }; break;
    }
    if (!best) { var p = parseMap(HAND[0]); return { g: p.g, S: p.S, H: p.H, par: 3 }; }
    best.par = PG.clamp(2 + Math.round((best.d - 10) / 9), 2, 5); return best;
  }
  function loadHole(n) {
    var m; if (n <= HAND.length) { m = parseMap(HAND[n - 1]); m.d = bfs(m.g, m.S, m.H); m.par = n === 1 ? 2 : 3; } else m = genHole(n);
    // sand + water + bumpers decor for hand holes
    st.hole = n; st.map = m; st.par = m.par; st.strokes = 0; st.done = false; st.sunk = 0; st.hintOn = false; st.hintUsed = false; st.hintPath = null; st.aim = null; st.moving = false; st.splash = []; st.bumps = {}; st.windmills = [];
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) { if (m.g[r][c] === 'W') st.windmills.push({ x: c * CELL + CELL / 2, y: r * CELL + CELL / 2, a: PG.rand(0, 6), dir: (r + c) % 2 ? 1 : -1, len: CELL * 1.25 }); if (m.g[r][c] === 'o') st.bumps[c + ',' + r] = 0; }
    var b = st.ball; b.x = m.S.c * CELL + CELL / 2; b.y = m.S.r * CELL + CELL / 2; b.vx = b.vy = 0; b.sq = 0; st.rest = { x: b.x, y: b.y }; st.state = 'play'; PG.playing = true; st.stuckT = 0;
    st.msg = null; PG.parts = []; PG.pops = []; st.runIdx++;
    PG.msg('level_started', { level: String(n) }); PG.track('progression_started', { step_id: 'hole', step_index: n, par: m.par });
  }

  /* ---------- physics ---------- */
  function cellAt(x, y) { var c = Math.floor(x / CELL), r = Math.floor(y / CELL); if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return '#'; return st.map.g[r][c]; }
  function holePos() { return { x: st.map.H.c * CELL + CELL / 2, y: st.map.H.r * CELL + CELL / 2 }; }
  function step(b, dt, real) {
    var ch = cellAt(b.x, b.y), sp = Math.hypot(b.vx, b.vy);
    if (ch === '~' && real) { splash(b.x, b.y); st.strokes++; PG.popText(b.x, b.y - 14, 'Splash! +1', '#8ecae6', 20); PG.sfx('drop'); b.x = st.rest.x; b.y = st.rest.y; b.vx = b.vy = 0; st.moving = false; return; }
    var dec = ch === ':' ? 420 : 105; if (sp > 0) { var ns = Math.max(0, sp - dec * dt); b.vx *= ns / sp; b.vy *= ns / sp; sp = ns; }
    b.x += b.vx * dt; b.y += b.vy * dt;
    // grid wall collisions
    var r0 = Math.floor((b.y - BR) / CELL), r1 = Math.floor((b.y + BR) / CELL), c0 = Math.floor((b.x - BR) / CELL), c1 = Math.floor((b.x + BR) / CELL);
    for (var r = r0; r <= r1; r++) for (var c = c0; c <= c1; c++) {
      var ch2 = (c < 0 || r < 0 || c >= COLS || r >= ROWS) ? '#' : st.map.g[r][c];
      if (ch2 === '#') bounceRect(b, c * CELL, r * CELL, CELL, CELL, 0.82, real);
      else if (ch2 === 'o') bounceCircle(b, c * CELL + CELL / 2, r * CELL + CELL / 2, 14, 1.12, real, c + ',' + r);
    }
    st.windmills.forEach(function (w) { var ax = w.x + Math.cos(w.a) * w.len, ay = w.y + Math.sin(w.a) * w.len, bx = w.x - Math.cos(w.a) * w.len, by = w.y - Math.sin(w.a) * w.len; bounceSeg(b, ax, ay, bx, by, 4, real, w); });
    return;
  }
  function bounceRect(b, x, y, w, h, e, real) {
    var nx = Math.max(x, Math.min(b.x, x + w)), ny = Math.max(y, Math.min(b.y, y + h)), dx = b.x - nx, dy = b.y - ny, d = Math.hypot(dx, dy);
    if (d < BR) {
      var n; if (d < 0.0001) { n = [0, -1]; d = 0; } else n = [dx / d, dy / d]; b.x += n[0] * (BR - d); b.y += n[1] * (BR - d);
      var vn = b.vx * n[0] + b.vy * n[1]; if (vn < 0) { b.vx -= (1 + e) * vn * n[0]; b.vy -= (1 + e) * vn * n[1]; if (real && Math.abs(vn) > 40) { b.sq = Math.min(1, Math.abs(vn) / 400); PG.sfx('hit', 0.8 + Math.min(1, Math.abs(vn) / 500) * 0.5); PG.burst(b.x - n[0] * BR, b.y - n[1] * BR, 3, { colors: ['#fff'], g: 0, min: 20, max: 90, life: 0.4 }); } }
    }
  }
  function bounceCircle(b, cx, cy, r, e, real, key) {
    var dx = b.x - cx, dy = b.y - cy, d = Math.hypot(dx, dy), md = r + BR; if (d < md && d > 0.001) { var nx = dx / d, ny = dy / d; b.x = cx + nx * md; b.y = cy + ny * md; var vn = b.vx * nx + b.vy * ny; if (vn < 0) { b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; var sp = Math.hypot(b.vx, b.vy); if (sp < 240) { b.vx *= 240 / sp; b.vy *= 240 / sp; } if (real) { st.bumps[key] = 1; PG.sfx('pop', 1.4); PG.burst(cx + nx * r, cy + ny * r, 8, { colors: ['#ff5d8f', '#fff'], g: 0 }); } } }
  }
  function bounceSeg(b, ax, ay, bx, by, th, real, w) {
    var dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy, t = PG.clamp(((b.x - ax) * dx + (b.y - ay) * dy) / l2, 0, 1), px = ax + dx * t, py = ay + dy * t, ex = b.x - px, ey = b.y - py, d = Math.hypot(ex, ey), md = BR + th;
    if (d < md && d > 0.001) { var nx = ex / d, ny = ey / d; b.x = px + nx * md; b.y = py + ny * md; var vn = b.vx * nx + b.vy * ny; // blade velocity at the contact point
      var rx = px - w.x, ry = py - w.y, bvx = -ry * w.dir * 1.2, bvy = rx * w.dir * 1.2, rvn = (b.vx - bvx) * nx + (b.vy - bvy) * ny;
      if (rvn < 0) { b.vx -= (1.9) * rvn * nx; b.vy -= 1.9 * rvn * ny; if (real) { PG.sfx('hit', 1.2); b.sq = 0.6; } } }
  }
  function splash(x, y) { for (var i = 0; i < 14; i++) PG.parts.push({ x: x, y: y, vx: PG.rand(-90, 90), vy: PG.rand(-160, -30), life: 0.7, t: 0, size: PG.rand(2, 4), color: '#bde0fe', g: 420, shape: 'c' }); }
  function shoot(dx, dy, pow) { var b = st.ball, d = Math.hypot(dx, dy); if (d < 1) return; var sp = 70 + pow * 640; b.vx = dx / d * sp; b.vy = dy / d * sp; st.strokes++; st.moving = true; st.hintOn = false; st.rest = { x: b.x, y: b.y }; st.lastShot = pow; st.stuckT = 0; PG.sfx('boom', 1.4); PG.vibrate(15); PG.burst(b.x, b.y, 8, { colors: ['#fff', '#ffd166'], g: 0, min: 30, max: 140 }); }
  function holeOut() {
    st.done = true; st.doneT = 0; st.moving = false; PG.playing = false; var d = st.strokes - st.par, name = st.strokes === 1 ? 'HOLE IN ONE!' : d <= -2 ? 'Eagle!' : d === -1 ? 'Birdie!' : d === 0 ? 'Par' : d === 1 ? 'Bogey' : st.strokes + ' strokes';
    st.resName = name; var stars = st.strokes <= st.par ? 3 : st.strokes <= st.par + 1 ? 2 : 1; st.resStars = stars; PG.sfx('win', 1.1); PG.vibrate(40); var hp = holePos();
    PG.burst(hp.x, hp.y, 40, { colors: ['#ffd23f', '#ff5d8f', '#4cc9f0', '#9be564'], g: 300, up: 220, life: 1.4, shape: 's', s0: 3, s1: 7 });
    PG.save.stars = PG.save.stars || []; var old = PG.save.stars[st.hole - 1] || 0; if (stars > old) PG.save.stars[st.hole - 1] = stars; PG.save.best = PG.save.best || []; var ob = PG.save.best[st.hole - 1] || 99; if (st.strokes < ob) PG.save.best[st.hole - 1] = st.strokes;
    PG.save.next = Math.max(PG.save.next || 1, Math.min(HOLES, st.hole + 1)); PG.save.holes = (PG.save.holes || 0) + 1; PG.commit(true);
    PG.track('progression_completed', { step_id: 'hole', step_index: st.hole, strokes: Math.min(st.strokes, 20), par: st.par, stars: stars }); PG.msg('level_completed', { level: String(st.hole) });
    if (st.hole === 1 || [5, 10, 15, 20].indexOf(st.hole) >= 0) st.unlockMsg = true; else st.unlockMsg = false;
  }
  function update(dt0) {
    st.t += dt0; PG.updateParts(dt0); PG.updatePops(dt0); clouds.forEach(function (c) { c.x += c.v * dt0; if (c.x > 1.2) c.x = -0.2; });
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
        if (sp < 7) { b.vx = b.vy = 0; st.moving = false; st.rest = { x: b.x, y: b.y }; if (st.strokes >= st.par + 6 && !st.hintUsed) st.msg = 'Stuck? Tap Hint'; }
      }
      b.rot += Math.hypot(b.vx, b.vy) * dt0 / BR; st.stuckT += dt0; if (st.stuckT > 25) { st.moving = false; b.vx = b.vy = 0; st.rest = { x: b.x, y: b.y }; }
    }
  }

  /* ---------- drawing ---------- */
  function drawScenery(c, w, h, t) {
    var g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#9bdcff'); g.addColorStop(1, '#d9f5c6'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    clouds.forEach(function (k) { c.globalAlpha = 0.75; c.fillStyle = '#fff'; var x = k.x * w, y = k.y * h * 0.5, s = 30 * k.s; c.beginPath(); c.arc(x, y, s, 0, TAU); c.arc(x + s * 0.9, y + 6, s * 0.75, 0, TAU); c.arc(x - s * 0.9, y + 8, s * 0.7, 0, TAU); c.fill(); }); c.globalAlpha = 1;
  }
  function drawCourse(c, t) {
    var g = st.map.g, i, r, cc;
    // hedge / void backdrop around the board
    c.fillStyle = '#2f7d3b'; c.fillRect(-60, -60, BW + 120, BH + 120);
    // grass with mowing stripes
    for (r = 0; r < ROWS; r++) for (cc = 0; cc < COLS; cc++) {
      var ch = g[r][cc], x = cc * CELL, y = r * CELL;
      if (ch === '#') continue;
      if (ch === '~') { c.fillStyle = '#4aa3df'; c.fillRect(x, y, CELL, CELL); c.fillStyle = 'rgba(255,255,255,.35)'; for (i = 0; i < 3; i++) { c.beginPath(); c.moveTo(x + 4, y + 8 + i * 13 + Math.sin(t * 2 + cc + i) * 2); c.quadraticCurveTo(x + 14, y + 2 + i * 13, x + 22, y + 8 + i * 13); c.quadraticCurveTo(x + 30, y + 14 + i * 13, x + 36, y + 8 + i * 13); c.lineWidth = 1.5; c.strokeStyle = 'rgba(255,255,255,.45)'; c.stroke(); } continue; }
      var stripe = (cc + r) % 2; c.fillStyle = ch === ':' ? '#ecd9a0' : stripe ? '#7fd36a' : '#74c95f'; c.fillRect(x, y, CELL, CELL);
      if (ch === ':') { c.fillStyle = 'rgba(190,150,70,.5)'; for (i = 0; i < 6; i++) { c.fillRect(x + ((i * 17 + r * 5) % 36) + 2, y + ((i * 11 + cc * 7) % 34) + 2, 2, 2); } }
    }
    // walls as raised hedge blocks with depth
    for (r = 0; r < ROWS; r++) for (cc = 0; cc < COLS; cc++) if (g[r][cc] === '#') {
      var x2 = cc * CELL, y2 = r * CELL; c.fillStyle = '#1f5f2c'; c.fillRect(x2, y2 + 4, CELL, CELL); c.fillStyle = '#3a9a48'; c.fillRect(x2, y2, CELL, CELL - 4);
      c.fillStyle = '#4cb85a'; c.beginPath(); c.arc(x2 + 10, y2 + 10, 8, 0, TAU); c.arc(x2 + 28, y2 + 14, 9, 0, TAU); c.arc(x2 + 18, y2 + 26, 8, 0, TAU); c.fill();
      if ((cc * 7 + r * 13) % 5 === 0) { c.fillStyle = '#ff8fab'; c.beginPath(); c.arc(x2 + 12, y2 + 12, 3, 0, TAU); c.fill(); } if ((cc * 5 + r * 3) % 7 === 0) { c.fillStyle = '#fff3b0'; c.beginPath(); c.arc(x2 + 28, y2 + 22, 3, 0, TAU); c.fill(); }
    }
    // inner edges: light rim where floor meets hedge
    // bumpers
    for (var key in st.bumps) { var p = key.split(','), bx = +p[0] * CELL + CELL / 2, by = +p[1] * CELL + CELL / 2, k = st.bumps[key], s = 1 + k * 0.25; c.save(); c.translate(bx, by); c.scale(s, s); c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(1, 4, 15, 12, 0, 0, TAU); c.fill(); c.fillStyle = '#e63971'; c.beginPath(); c.arc(0, 0, 14, 0, TAU); c.fill(); c.fillStyle = '#ff7aa8'; c.beginPath(); c.arc(0, -2, 10, 0, TAU); c.fill(); c.fillStyle = '#fff'; [[-4, -5], [4, -3], [0, 3]].forEach(function (q) { c.beginPath(); c.arc(q[0], q[1], 2.2, 0, TAU); c.fill(); }); c.restore(); }
    // hole + flag
    var hp = holePos(); c.fillStyle = '#1b3a24'; c.beginPath(); c.ellipse(hp.x, hp.y + 1, 11, 9, 0, 0, TAU); c.fill(); c.fillStyle = '#0d1f14'; c.beginPath(); c.ellipse(hp.x, hp.y + 2, 9, 7, 0, 0, TAU); c.fill();
    c.strokeStyle = '#f1f1f1'; c.lineWidth = 2; c.beginPath(); c.moveTo(hp.x, hp.y); c.lineTo(hp.x, hp.y - 34); c.stroke(); c.fillStyle = '#ff4d6d'; c.beginPath(); var wv = Math.sin(t * 5) * 3; c.moveTo(hp.x, hp.y - 34); c.quadraticCurveTo(hp.x + 10, hp.y - 36 + wv, hp.x + 20, hp.y - 30 + wv); c.quadraticCurveTo(hp.x + 10, hp.y - 26 + wv * 0.5, hp.x, hp.y - 24); c.fill();
    // tee marker
    var tp = { x: st.map.S.c * CELL + CELL / 2, y: st.map.S.r * CELL + CELL / 2 }; c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2; c.setLineDash([4, 4]); c.beginPath(); c.arc(tp.x, tp.y, 15, 0, TAU); c.stroke(); c.setLineDash([]);
    // windmills
    st.windmills.forEach(function (wm) { c.save(); c.translate(wm.x, wm.y); c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(2, 6, 12, 8, 0, 0, TAU); c.fill(); c.rotate(wm.a); c.fillStyle = '#d9d2c3'; c.fillRect(-wm.len, -4, wm.len * 2, 8); c.fillStyle = '#e63946'; c.fillRect(-wm.len, -4, wm.len * 0.35, 8); c.fillRect(wm.len * 0.65, -4, wm.len * 0.35, 8); c.rotate(-wm.a); c.fillStyle = '#8d5a2b'; c.beginPath(); c.arc(0, 0, 8, 0, TAU); c.fill(); c.fillStyle = '#c68b59'; c.beginPath(); c.arc(0, -1, 5.5, 0, TAU); c.fill(); c.restore(); });
    // hint path
    if (st.hintOn && st.path) { c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 4; c.setLineDash([10, 10]); c.lineDashOffset = -t * 20; c.beginPath(); st.path.forEach(function (p, i) { if (i) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); }); c.stroke(); c.setLineDash([]); }
  }
  function drawCat(c, x, y, r, t, cat, o) {
    o = o || {}; var cs = CATS[cat]; c.save(); c.translate(x, y); var sp = o.speed || 0, ang = o.ang || 0, sq = o.sq || 0; var str = 1 + Math.min(0.25, sp / 1800); c.rotate(ang); c.scale(str * (1 - sq * 0.25), (1 / str) * (1 + sq * 0.25)); c.rotate(-ang);
    var s = r / 8;
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(1 * s, 6 * s, 8.5 * s, 4 * s, 0, 0, TAU); c.fill();
    // ears
    [-1, 1].forEach(function (d) { c.fillStyle = cs.body; c.beginPath(); c.moveTo(d * 3 * s, -6 * s); c.lineTo(d * 8.5 * s, -12.5 * s); c.lineTo(d * 9 * s, -2 * s); c.closePath(); c.fill(); c.fillStyle = cs.ear; c.beginPath(); c.moveTo(d * 4.5 * s, -6 * s); c.lineTo(d * 7.6 * s, -10 * s); c.lineTo(d * 7.8 * s, -4 * s); c.closePath(); c.fill(); });
    c.fillStyle = cs.body; c.beginPath(); c.arc(0, 0, 9 * s, 0, TAU); c.fill();
    if (cs.patch2) { c.fillStyle = cs.patch2; c.beginPath(); c.arc(-5 * s, -4 * s, 4.5 * s, 0, TAU); c.fill(); c.fillStyle = cs.patch; c.beginPath(); c.arc(5 * s, -3 * s, 4 * s, 0, TAU); c.fill(); }
    else if (cs.n === 'Tux') { c.fillStyle = cs.patch; c.beginPath(); c.ellipse(0, 3 * s, 5.5 * s, 5 * s, 0, 0, TAU); c.fill(); }
    else if (cs.mask) { c.fillStyle = cs.mask; c.beginPath(); c.ellipse(0, 1 * s, 5.5 * s, 5 * s, 0, 0, TAU); c.fill(); }
    if (cs.stripe) { c.strokeStyle = cs.stripe; c.lineWidth = 1.3 * s; c.lineCap = 'round'; [-4, 0, 4].forEach(function (k) { c.beginPath(); c.moveTo(k * s, -9 * s); c.lineTo(k * s * 0.9, -5.5 * s); c.stroke(); }); }
    // eyes: dizzy while flying
    var dizzy = sp > 260, happy = o.happy;
    [-1, 1].forEach(function (d) { var ex = d * 3.6 * s, ey = -0.8 * s; if (dizzy) { c.strokeStyle = '#222'; c.lineWidth = 1.2 * s; c.beginPath(); c.moveTo(ex - 1.6 * s, ey - 1.6 * s); c.lineTo(ex + 1.6 * s, ey + 1.6 * s); c.moveTo(ex + 1.6 * s, ey - 1.6 * s); c.lineTo(ex - 1.6 * s, ey + 1.6 * s); c.stroke(); } else if (happy) { c.strokeStyle = '#222'; c.lineWidth = 1.3 * s; c.beginPath(); c.arc(ex, ey + 0.8 * s, 1.8 * s, Math.PI, 0); c.stroke(); } else { c.fillStyle = '#fff'; c.beginPath(); c.ellipse(ex, ey, 2.2 * s, 2.5 * s, 0, 0, TAU); c.fill(); c.fillStyle = cs.eye; c.beginPath(); c.ellipse(ex, ey, 1.5 * s, 2 * s, 0, 0, TAU); c.fill(); c.fillStyle = '#111'; c.beginPath(); c.ellipse(ex, ey, 0.7 * s, 1.5 * s, 0, 0, TAU); c.fill(); } });
    c.fillStyle = '#f08a9c'; c.beginPath(); c.moveTo(-1.3 * s, 2.2 * s); c.lineTo(1.3 * s, 2.2 * s); c.lineTo(0, 3.6 * s); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = 0.9 * s; c.beginPath(); c.moveTo(0, 3.6 * s); c.lineTo(0, 4.4 * s); c.moveTo(-3 * s, 5 * s); c.quadraticCurveTo(-1.5 * s, 5.8 * s, 0, 4.4 * s); c.quadraticCurveTo(1.5 * s, 5.8 * s, 3 * s, 5 * s); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 0.6 * s; [-1, 1].forEach(function (d) { c.beginPath(); c.moveTo(d * 5 * s, 3 * s); c.lineTo(d * 11 * s, 2 * s); c.moveTo(d * 5 * s, 4 * s); c.lineTo(d * 11 * s, 5 * s); c.stroke(); });
    if (dizzy && sp > 300) { for (var i = 0; i < 3; i++) { var a = t * 9 + i * 2.1; c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(Math.cos(a) * 11 * s, -11 * s + Math.sin(a) * 3 * s, 1.5 * s, 0, TAU); c.fill(); } }
    c.restore();
  }
  function hit(x, y, w, h) { var I = PG.input; if (I.released && PG.inRect(x, y, w, h) && PG.inRect(x, y, w, h, I.px, I.py)) { I.released = false; PG.sfx('tap'); return true; } return false; }
  function predict() {
    var a = st.aim; if (!a) return null; var b = { x: st.ball.x, y: st.ball.y, vx: a.dx / a.d * (70 + a.pow * 640), vy: a.dy / a.d * (70 + a.pow * 640) }; var pts = [], n = 0;
    for (var i = 0; i < 90; i++) { var sv = { x: b.x, y: b.y }; step(b, 1 / 60, false); if (cellAt(b.x, b.y) === '~') break; pts.push({ x: b.x, y: b.y }); if (Math.hypot(b.vx, b.vy) < 8) break; } return pts;
  }
  function drawBoardLayer(c, w, h, t) {
    var sc = PG.scale(), top = 66 * sc, bot = 70 * sc, availH = h - top - bot; view.s = Math.min(w / BW, availH / BH); view.ox = (w - BW * view.s) / 2; view.oy = top + (availH - BH * view.s) / 2;
    c.save(); c.translate(view.ox, view.oy); c.scale(view.s, view.s); c.beginPath(); c.rect(-12, -12, BW + 24, BH + 24); c.clip();
    drawCourse(c, t);
    var b = st.ball; var sunkS = st.sunk > 0 ? Math.max(0.1, 1 - st.sunk / 0.45) : 1;
    // aim indicator
    if (st.aim && !st.moving && !st.done) {
      var a = st.aim, pts = predict(); if (pts) { for (var i = 0; i < pts.length; i += 3) { c.globalAlpha = 1 - i / pts.length * 0.85; c.fillStyle = '#fff'; c.beginPath(); c.arc(pts[i].x, pts[i].y, 2.8, 0, TAU); c.fill(); } c.globalAlpha = 1; }
      var pw = a.pow; c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 3; c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x - a.dx / a.d * Math.min(a.d, 90), b.y - a.dy / a.d * Math.min(a.d, 90)); c.stroke();
      c.strokeStyle = 'hsl(' + (120 - pw * 120) + ',90%,55%)'; c.lineWidth = 5; c.beginPath(); c.arc(b.x, b.y, 18 + pw * 10, -2.6, -2.6 + pw * 5.2); c.stroke();
    }
    var sp = Math.hypot(b.vx, b.vy); c.save(); c.translate(b.x, b.y); c.scale(sunkS, sunkS); drawCat(c, 0, 0, BR + 2.5, t, PG.save.cat || 0, { speed: sp, ang: Math.atan2(b.vy, b.vx), sq: b.sq, happy: st.done || st.sunk > 0 }); c.restore();
    PG.drawParts(c); PG.drawPops(c); c.restore();
  }
  function drawHUDplay(c, w, h, sc) {
    U.text(c, 'Hole ' + st.hole, 14 * sc, 24 * sc, 28 * sc, '#1d3a2b', 'left', { shadow: false, stroke: 'rgba(255,255,255,.7)' });
    U.text(c, 'Par ' + st.par + '   Strokes ' + st.strokes, 14 * sc, 50 * sc, 17 * sc, '#1d3a2b', 'left', { shadow: false });
    var by = h - 56 * sc, bw = 120 * sc, bh = 44 * sc;
    if (U.button(c, 12 * sc, by, bw, bh, 'Retry', { color: '#ff9f1c', size: 17 * sc })) { loadHole(st.hole); }
    if (!st.hintUsed && st.strokes >= 3 && PG.rewardedSupported()) { if (U.button(c, w - bw * 1.35 - 12 * sc, by, bw * 1.35, bh, 'Hint (ad)', { color: '#8338ec', size: 17 * sc })) PG.rewarded('bonus').then(function (ok) { if (ok) { st.hintUsed = true; st.hintOn = true; st.path = bfsPath(st.map.g, { c: Math.floor(st.ball.x / CELL), r: Math.floor(st.ball.y / CELL) }, st.map.H); PG.track('rewarded_hint', { hole: st.hole }); } }); }
    else if (st.hintUsed) { if (U.button(c, w - bw * 1.35 - 12 * sc, by, bw * 1.35, bh, st.hintOn ? 'Hide path' : 'Show path', { color: '#5c6bc0', size: 16 * sc })) { st.hintOn = !st.hintOn; st.path = bfsPath(st.map.g, { c: Math.floor(st.ball.x / CELL), r: Math.floor(st.ball.y / CELL) }, st.map.H); } }
    if (st.strokes === 0 && st.hole === 1 && !st.aim) U.text(c, 'Drag back from the cat, then let go', w / 2, h - 80 * sc, 18 * sc, '#1d3a2b', 'center', { shadow: false, stroke: 'rgba(255,255,255,.8)' });
    if (st.msg && st.strokes >= 3) U.text(c, st.msg, w / 2, h - 80 * sc, 16 * sc, '#1d3a2b', 'center', { shadow: false });
  }
  function drawResult(c, w, h, sc) {
    var k = PG.ease.out(Math.min(1, st.doneT * 2.2)); if (st.doneT < 0.5) return; k = PG.ease.out(Math.min(1, (st.doneT - 0.5) * 2.2));
    c.fillStyle = 'rgba(10,30,20,' + 0.45 * k + ')'; c.fillRect(0, 0, w, h); var pw = Math.min(w * 0.86, 360 * sc), ph = 330 * sc, px = w / 2 - pw / 2, py = h * 0.45 - ph / 2 + (1 - k) * 60; U.panel(c, px, py, pw, ph, { fill: 'rgba(14,40,28,.92)' });
    U.text(c, st.resName, w / 2, py + 44 * sc, 34 * sc, '#ffd23f', 'center'); U.text(c, st.strokes + ' stroke' + (st.strokes > 1 ? 's' : '') + '  -  Par ' + st.par, w / 2, py + 86 * sc, 18 * sc, '#fff', 'center');
    for (var i = 0; i < 3; i++) { c.save(); c.translate(w / 2 + (i - 1) * 56 * sc, py + 134 * sc); var on = i < st.resStars; var pop = PG.ease.back(Math.min(1, Math.max(0, (st.doneT - 0.7 - i * 0.2) * 3))); c.scale(pop * sc * 1.4, pop * sc * 1.4); c.fillStyle = on ? '#ffd23f' : 'rgba(255,255,255,.2)'; c.beginPath(); for (var j = 0; j < 10; j++) { var a = j * 0.628 - 1.57, rr = j % 2 ? 9 : 20; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.fill(); c.restore(); }
    var unl = st.unlockMsg && PG.save.next ? CATS.filter(function (ct) { return ct.unlock === st.hole + (st.hole === 1 ? 0 : 1) || false; }) : []; var bw = pw * 0.8, bh = 52 * sc;
    if (st.hole >= HOLES) { U.text(c, 'Course complete!', w / 2, py + 190 * sc, 22 * sc, '#9be564', 'center'); }
    if (U.button(c, w / 2 - bw / 2, py + 196 * sc, bw, bh, st.hole >= HOLES ? 'Hole select' : 'Next hole', { color: '#2ec4b6' })) { PG.interstitial('level_end').then(function () { if (st.hole >= HOLES) st.state = 'select'; else loadHole(st.hole + 1); }); }
    if (U.button(c, w / 2 - bw / 2, py + 196 * sc + bh + 10 * sc, bw / 2 - 5 * sc, bh * 0.8, 'Replay', { color: '#ff9f1c', size: 16 * sc })) loadHole(st.hole);
    if (U.button(c, w / 2 + 5 * sc, py + 196 * sc + bh + 10 * sc, bw / 2 - 5 * sc, bh * 0.8, 'Holes', { color: '#5c6bc0', size: 16 * sc })) st.state = 'select';
  }
  function drawMenu(c, w, h, t) {
    var sc = PG.scale(); c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(0, 0, w, h);
    U.text(c, 'CAT CANNON', w / 2, h * 0.12, Math.min(52 * sc, w * 0.13), '#fff', 'center', { stroke: '#2f7d3b' }); U.text(c, 'GOLF', w / 2, h * 0.12 + 52 * sc, Math.min(66 * sc, w * 0.17), '#ffd23f', 'center', { stroke: '#8a5a00' });
    var cat = PG.save.cat || 0; c.save(); c.translate(w / 2, h * 0.42 + Math.sin(t * 3) * 6); c.rotate(Math.sin(t * 1.5) * 0.12); drawCat(c, 0, 0, 38 * sc, t, cat, {}); c.restore();
    var bw = 230 * sc, bh = 62 * sc, y0 = h * 0.62, next = Math.min(HOLES, PG.save.next || 1);
    if (U.button(c, w / 2 - bw / 2, y0, bw, bh, (PG.save.holes ? 'Play hole ' + next : 'Play'), { color: '#2ec4b6', size: 24 * sc })) loadHole(next);
    if (U.button(c, w / 2 - bw / 2, y0 + bh + 12 * sc, bw, bh * 0.8, 'Holes & cats', { color: '#ff9f1c', size: 19 * sc })) st.state = 'select';
    U.text(c, 'Stars: ' + ((PG.save.stars || []).reduce(function (a, b) { return a + (b || 0); }, 0)) + ' / ' + HOLES * 3, w / 2, h - 26 * sc, 16 * sc, '#1d3a2b', 'center', { shadow: false });
  }
  function drawSelect(c, w, h, t) {
    var sc = PG.scale(); c.fillStyle = 'rgba(10,40,25,.55)'; c.fillRect(0, 0, w, h);
    var pw = Math.min(w * 0.95, 430 * sc), px = w / 2 - pw / 2, py = 16 * sc, ph = h - 32 * sc; U.panel(c, px, py, pw, ph, { fill: 'rgba(14,40,28,.9)' });
    U.text(c, 'Choose your cat', w / 2, py + 30 * sc, 22 * sc, '#ffd23f', 'center');
    var next = PG.save.next || 1; var cs = Math.min(pw / 5.4, 70 * sc);
    CATS.forEach(function (ct, i) { var x = w / 2 + (i - 2) * cs * 1.06, y = py + 82 * sc, unlocked = ct.unlock <= next; var on = (PG.save.cat || 0) === i; if (on) { c.fillStyle = 'rgba(255,210,63,.3)'; c.beginPath(); c.arc(x, y, cs * 0.5, 0, TAU); c.fill(); } c.save(); if (!unlocked) c.globalAlpha = 0.3; drawCat(c, x, y, cs * 0.3, t, i, {}); c.restore(); if (!unlocked) U.text(c, 'Hole ' + ct.unlock, x, y + cs * 0.5, 12 * sc, '#cbd5e1', 'center', { shadow: false }); else U.text(c, ct.n, x, y + cs * 0.5, 12 * sc, '#fff', 'center', { shadow: false }); if (unlocked && hit(x - cs * 0.5, y - cs * 0.5, cs, cs)) { PG.save.cat = i; PG.commit(); PG.sfx('merge'); } });
    U.text(c, 'Holes', w / 2, py + 140 * sc, 20 * sc, '#fff', 'center');
    var cols = 5, rows = 6, gw = (pw - 40 * sc) / cols, gh = Math.min(gw * 1.0, (ph - 230 * sc) / rows), gx0 = px + 20 * sc, gy0 = py + 160 * sc;
    for (var i = 0; i < HOLES; i++) { var cx = gx0 + (i % cols) * gw, cy = gy0 + Math.floor(i / cols) * gh, unlocked = i + 1 <= next, stars = (PG.save.stars || [])[i] || 0;
      if (U.button(c, cx + 3 * sc, cy + 3 * sc, gw - 6 * sc, gh - 8 * sc, '' + (i + 1), { color: unlocked ? (stars === 3 ? '#2ec4b6' : '#3a86ff') : '#59606b', size: Math.min(20 * sc, gh * 0.34), disabled: !unlocked })) loadHole(i + 1);
      if (unlocked) for (var s = 0; s < 3; s++) { c.fillStyle = s < stars ? '#ffd23f' : 'rgba(255,255,255,.3)'; c.beginPath(); c.arc(cx + gw / 2 + (s - 1) * 9 * sc, cy + gh - 14 * sc, 3.2 * sc, 0, TAU); c.fill(); } }
    if (U.button(c, w / 2 - 80 * sc, py + ph - 56 * sc, 160 * sc, 42 * sc, 'Back', { color: '#ff9f1c', size: 17 * sc })) st.state = 'menu';
  }
  function render(c, w, h) {
    var t = PG.time, sc = PG.scale(); drawScenery(c, w, h, t);
    if (st.state === 'menu') { drawMenu(c, w, h, t); return; }
    if (st.state === 'select') { drawScenery(c, w, h, t); drawSelect(c, w, h, t); return; }
    drawBoardLayer(c, w, h, t); drawHUDplay(c, w, h, sc); if (st.done) drawResult(c, w, h, sc);
  }
  PG.onDown = function (x, y) {
    if (st.state !== 'play' || st.moving || st.done || st.sunk > 0 || PG.userPaused) return; var sc = PG.scale(); if (y > PG.h - 60 * sc || y < 70 * sc && x > PG.w - 130 * sc) return;
    var bx = (x - view.ox) / view.s, by = (y - view.oy) / view.s; if (Math.hypot(bx - st.ball.x, by - st.ball.y) < 90) st.aim = { sx: x, sy: y, dx: 0, dy: 0, d: 1, pow: 0 }; // drag from anywhere near the cat
  };
  PG.onMove = function (x, y) { var a = st.aim; if (!a) return; var dx = (a.sx - x) / view.s, dy = (a.sy - y) / view.s, d = Math.hypot(dx, dy); a.dx = dx; a.dy = dy; a.d = Math.max(1, d); a.pow = PG.clamp(d / 140, 0, 1); };
  PG.onUp = function (x, y) { var a = st.aim; st.aim = null; if (!a || st.state !== 'play' || st.moving || st.done) return; if (a.pow > 0.07) shoot(a.dx, a.dy, a.pow); };
  PG.setup(document.getElementById('c'), update, render);
  window.__golf = { st: st, load: loadHole, shoot: shoot, bfs: bfs, genHole: genHole };
  PG.init({ id: 'cat_cannon_golf', version: '1.0.0', defaults: { next: 1, stars: [], best: [], cat: 0, holes: 0, muted: false } }).then(function () {
    PG.music({ scale: [0, 2, 4, 7, 9], root: 294, bpm: 96, wave: 'triangle', vol: 0.05, bass: 0.08 });
  });
})();
