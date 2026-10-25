/* TOWER OF TOAST - defend your breakfast from crumb monsters with toasters, jam launchers and butter slicks.
   Art direction: Saturday-morning comic stickers. Bold ink outlines, white die-cut borders, halftone print, faces on everything. */
(function () {
  'use strict';
  var U = PG.ui, TAU = 6.2832, BW = 400, BH = 640, land = false, BAR = 104, HUDW = 120;
  var INK = '#1b1b1b', CREAM = '#fff8e7', YEL = '#ffd23f', RED = '#ef476f', TEAL = '#06d6a0', BLUE = '#118ab2', ORANGE = '#f78c40', PURPLE = '#8e44ad';
  var MAPS = [
    { n: 'Kitchen Counter', pts: [[-30, 90], [310, 90], [310, 230], [90, 230], [90, 370], [310, 370], [310, 510], [200, 510], [200, 590]], waves: 20 },
    { n: 'Breakfast Bar', pts: [[-30, 60], [120, 60], [120, 180], [300, 180], [300, 60], [370, 60], [370, 330], [100, 330], [100, 450], [300, 450], [300, 590], [200, 590]], waves: 20 },
    { n: 'Sunday Brunch', pts: [[200, -30], [200, 120], [60, 120], [60, 260], [340, 260], [340, 120], [270, 120], [270, 420], [60, 420], [60, 540], [200, 540], [200, 590]], waves: 25 }
  ];
  var TOWERS = {
    toaster: { n: 'Toaster', cost: 50, range: 112, rate: 1.9, dmg: 9, desc: 'Fast toast shots' },
    jam: { n: 'Jam Launcher', cost: 95, range: 150, rate: 0.62, dmg: 16, desc: 'Splash + sticky slow' },
    butter: { n: 'Butter Slick', cost: 35, range: 46, rate: 0, dmg: 0, desc: 'Place on path: slows' }
  };
  var ENEMIES = {
    crumb: { hp: 24, sp: 44, r: 11, rew: 2, col: '#d9a35b', n: 'Crumb' },
    ant: { hp: 14, sp: 80, r: 8, rew: 2, col: '#3a3a4a', n: 'Ant' },
    beetle: { hp: 80, sp: 32, r: 13, rew: 4, col: '#06a77d', n: 'Beetle' },
    boss: { hp: 1400, sp: 26, r: 26, rew: 40, col: '#c9813a', n: 'Mega Crumb' }
  };
  var JAMC = ['#e63946', '#7b2cbf', '#ff8c1a'];
  var st = { state: 'menu', map: 0, wave: 0, lives: 15, money: 150, towers: [], enemies: [], shots: [], blobs: [], queue: [], spawnT: 0, waveOn: false, sel: null, place: null, speed: 1, won: false, bonusUsed: 0, deadT: 0, over: false, runIdx: 0, fx: [], flash: 0, endless: false, usedRev: false, bursts: [], waveBanner: 0 };
  var path = [], plen = 0, view = { s: 1, ox: 0, oy: 0 };

  /* ---------- path (maps are authored portrait; landscape mirrors them across the diagonal) ---------- */
  function mapPts(m) { return MAPS[m].pts.map(function (p) { return land ? [p[1], p[0]] : [p[0], p[1]]; }); }
  function buildPath(m) { path = []; plen = 0; var p = mapPts(m); for (var i = 0; i < p.length - 1; i++) { var l = Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]); path.push({ x0: p[i][0], y0: p[i][1], x1: p[i + 1][0], y1: p[i + 1][1], l: l, s: plen }); plen += l; } }
  function pathAt(d) { for (var i = 0; i < path.length; i++) { var s = path[i]; if (d <= s.s + s.l || i === path.length - 1) { var k = PG.clamp((d - s.s) / s.l, 0, 1); return { x: s.x0 + (s.x1 - s.x0) * k, y: s.y0 + (s.y1 - s.y0) * k, a: Math.atan2(s.y1 - s.y0, s.x1 - s.x0) }; } } return { x: 0, y: 0, a: 0 }; }
  function distToPath(x, y) { var best = 1e9; path.forEach(function (s) { var dx = s.x1 - s.x0, dy = s.y1 - s.y0, t = PG.clamp(((x - s.x0) * dx + (y - s.y0) * dy) / (s.l * s.l), 0, 1); best = Math.min(best, Math.hypot(x - (s.x0 + dx * t), y - (s.y0 + dy * t))); }); return best; }
  function nearestOnPath(x, y) { var best = 1e9, bp = null; for (var d = 0; d < plen; d += 4) { var p = pathAt(d), dd = Math.hypot(p.x - x, p.y - y); if (dd < best) { best = dd; bp = p; } } return { p: bp, d: best }; }
  function setOrientation(l) { // swap the board axes and every board-space position
    if (l === land) return; land = l; var t = BW; BW = BH; BH = t;
    function sw(o, a, b) { var q = o[a]; o[a] = o[b]; o[b] = q; }
    st.towers.forEach(function (o) { sw(o, 'x', 'y'); });
    st.shots.forEach(function (o) { sw(o, 'x', 'y'); sw(o, 'tx', 'ty'); });
    st.blobs.forEach(function (o) { sw(o, 'x', 'y'); }); st.bursts.forEach(function (o) { sw(o, 'x', 'y'); });
    st.fx.forEach(function (o) { sw(o, 'x', 'y'); sw(o, 'vx', 'vy'); });
    PG.parts.forEach(function (o) { sw(o, 'x', 'y'); }); PG.pops.forEach(function (o) { sw(o, 'x', 'y'); });
    if (st.gx !== undefined) { var q = st.gx; st.gx = st.gy; st.gy = q; }
    if (st.state === 'play') { buildPath(st.map); st.enemies.forEach(function (e) { var p = pathAt(e.d); e.x = p.x; e.y = p.y; e.a = p.a; }); }
  }

  /* ---------- game ---------- */
  function startMap(m) {
    st.map = m; buildPath(m); st.wave = 0; st.lives = 15; st.money = 160; st.towers = []; st.enemies = []; st.shots = []; st.blobs = []; st.queue = []; st.bursts = []; st.fx = []; st.waveOn = false; st.sel = null; st.place = null; st.speed = 1; st.won = false; st.over = false; st.bonusUsed = 0; st.endless = false; st.state = 'play'; st.usedRev = false; st.deadT = 0;
    st.runIdx++; PG.playing = true; PG.parts = []; PG.pops = []; PG.track('progression_started', { step_id: 'map', step_index: m + 1 }); PG.msg('level_started', { level: 'map' + (m + 1) });
  }
  function waveList(n) {
    var q = [], hpm = 1 + (n - 1) * 0.42 + Math.max(0, n - 8) * 0.22, cnt = 8 + Math.floor(n * 2.5);
    for (var i = 0; i < cnt; i++) { var r = Math.random(), t = 'crumb'; if (n >= 3 && r < 0.3) t = 'ant'; if (n >= 6 && r > 0.72) t = 'beetle'; if (n >= 12 && r > 0.55 && r < 0.65) t = 'beetle'; q.push({ t: t, hpm: hpm }); }
    if (n % 10 === 0) q.push({ t: 'boss', hpm: hpm * (n / 10) * 0.9 });
    if (n % 5 === 0 && n % 10 !== 0) for (i = 0; i < 4; i++) q.push({ t: 'beetle', hpm: hpm });
    return q;
  }
  function startWave() {
    if (st.waveOn || st.over) return; st.wave++; st.waveOn = true; st.queue = waveList(st.wave); st.spawnT = 0.4; st.sel = null; st.place = null;
    PG.sfx('bell'); PG.msg('level_started', { level: 'wave' + st.wave }); PG.track('progression_started', { step_id: 'wave', step_index: Math.min(st.wave, 40), map: st.map + 1 });
    st.waveBanner = 1.8;
  }
  function spawn(q) { var d = ENEMIES[q.t]; st.enemies.push({ t: q.t, hp: d.hp * q.hpm, mhp: d.hp * q.hpm, d: 0, x: 0, y: 0, a: 0, slow: 0, slowT: 0, ph: Math.random() * 6, hit: 0, r: d.r }); }
  function tdef(t) { var b = TOWERS[t.type]; var m = 1 + (t.lv - 1) * 0.45; return { range: b.range * (1 + (t.lv - 1) * 0.1), rate: b.rate * (1 + (t.lv - 1) * 0.15), dmg: b.dmg * m }; }
  function upCost(t) { return Math.round(TOWERS[t.type].cost * (0.9 + t.lv * 0.7)); }
  function canPlace(type, x, y) {
    if (x < 14 || x > BW - 14 || y < 14 || y > BH - 14) return false;
    var dp = distToPath(x, y);
    if (type === 'butter') { if (dp > 12) return false; return st.towers.every(function (t) { return t.type !== 'butter' || Math.hypot(t.x - x, t.y - y) > 44; }); }
    if (dp < 34) return false; if (Math.hypot(x - path[path.length - 1].x1, y - path[path.length - 1].y1) < 50) return false;
    return st.towers.every(function (t) { return t.type === 'butter' || Math.hypot(t.x - x, t.y - y) > 36; });
  }
  function build(type, x, y) {
    var b = TOWERS[type]; if (st.money < b.cost) { PG.sfx('err'); return; }
    if (type === 'butter') { var np = nearestOnPath(x, y); x = np.p.x; y = np.p.y; }
    if (!canPlace(type, x, y)) { PG.sfx('err'); return; }
    st.money -= b.cost; var t = { type: type, x: x, y: y, lv: 1, cd: 0, pop: 0, aim: -Math.PI / 2, kick: 0 }; st.towers.push(t); st.sel = t; PG.sfx('upgrade'); fxPuff(x, y, '#fff'); PG.track('tower_built', { tower: type, wave: Math.min(st.wave, 40) });
  }
  function fxPuff(x, y, col) { for (var i = 0; i < 8; i++) st.fx.push({ x: x, y: y, vx: PG.rand(-60, 60), vy: PG.rand(-80, 20), t: 0, life: 0.5, col: col, r: PG.rand(2, 5) }); }
  function burst(x, y, s, col, size) { st.bursts.push({ x: x, y: y, s: s, col: col, t: 0, size: size || 16 }); }
  function dmg(e, n, slow) {
    e.hp -= n; e.hit = 0.12; if (slow) { e.slow = Math.max(e.slow, slow); e.slowT = 2.2; }
    if (e.hp <= 0 && !e.dead) { e.dead = true; var d = ENEMIES[e.t], rew = Math.round(d.rew * (1 + st.wave * 0.02)); st.money += rew; PG.popText(e.x, e.y - 10, '+' + rew, YEL, 15); PG.sfx('pop', 0.9 + Math.random() * 0.4); for (var i = 0; i < 6; i++) st.fx.push({ x: e.x, y: e.y, vx: PG.rand(-70, 70), vy: PG.rand(-90, 10), t: 0, life: 0.6, col: d.col, r: PG.rand(2, 4) }); if (e.t === 'boss') { PG.sfx('boom'); st.flash = 0.4; burst(e.x, e.y - 20, 'KA-POW!', YEL, 26); } }
  }
  function update(dt0) {
    PG.updateParts(dt0); PG.updatePops(dt0); st.flash = Math.max(0, st.flash - dt0); if (st.waveBanner > 0) st.waveBanner -= dt0; if (st.over) st.deadT += dt0;
    for (var f = st.fx.length - 1; f >= 0; f--) { var p = st.fx[f]; p.t += dt0; p.vy += 260 * dt0; p.x += p.vx * dt0; p.y += p.vy * dt0; if (p.t > p.life) st.fx.splice(f, 1); }
    for (f = st.bursts.length - 1; f >= 0; f--) { st.bursts[f].t += dt0; if (st.bursts[f].t > 0.9) st.bursts.splice(f, 1); }
    if (st.state !== 'play' || st.over) return;
    var dt = dt0 * st.speed;
    if (st.waveOn) { st.spawnT -= dt; if (st.queue.length && st.spawnT <= 0) { spawn(st.queue.shift()); st.spawnT = Math.max(0.45, 1.0 - st.wave * 0.025); } }
    st.enemies.forEach(function (e) {
      var d = ENEMIES[e.t], sp = d.sp * (e.slow ? 1 - e.slow : 1); if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slow = 0; }
      var bs = 0; st.towers.forEach(function (t) { if (t.type === 'butter' && Math.hypot(t.x - e.x, t.y - e.y) < tdef(t).range * 0.5) bs = Math.max(bs, 0.4 + 0.1 * t.lv); }); sp *= (1 - bs); e.onButter = bs > 0;
      e.d += sp * dt; e.hit = Math.max(0, e.hit - dt); var pp = pathAt(e.d); e.x = pp.x; e.y = pp.y; e.a = pp.a; e.ph += dt * sp * 0.12;
      if (e.d >= plen && !e.dead) { e.dead = true; e.reached = true; st.lives -= e.t === 'boss' ? 8 : 1; st.flash = 0.35; PG.sfx('hit'); PG.vibrate(30); burst(e.x, e.y - 26, 'MUNCH!', RED, 18); }
    });
    st.towers.forEach(function (t) {
      t.pop = Math.min(1, t.pop + dt * 4); t.kick = Math.max(0, t.kick - dt * 6); if (t.type === 'butter') return; var td = tdef(t); t.cd -= dt;
      var tgt = null, bd = -1; st.enemies.forEach(function (e) { if (e.dead) return; var dd = Math.hypot(e.x - t.x, e.y - t.y); if (dd <= td.range + e.r * 0.4 && e.d > bd) { bd = e.d; tgt = e; } });
      if (tgt) { t.aim = Math.atan2(tgt.y - t.y, tgt.x - t.x); if (t.cd <= 0) { t.cd = 1 / td.rate; t.kick = 1; st.shots.push({ type: t.type, x: t.x, y: t.y - (t.type === 'toaster' ? 14 : 0), tgt: tgt, dmg: td.dmg, sp: t.type === 'jam' ? 190 : 380, rot: 0, tx: tgt.x, ty: tgt.y, lv: t.lv, life: 0 }); PG.sfx(t.type === 'jam' ? 'drop' : 'shoot', 1 + Math.random() * 0.1); } }
    });
    for (var i = st.shots.length - 1; i >= 0; i--) {
      var s = st.shots[i]; s.rot += dt * 14; s.life += dt; if (s.tgt && !s.tgt.dead) { s.tx = s.tgt.x; s.ty = s.tgt.y; }
      var dx = s.tx - s.x, dy = s.ty - s.y, dd = Math.hypot(dx, dy), step = s.sp * dt;
      if (dd <= step + 4) {
        if (s.type === 'jam') { st.blobs.push({ x: s.tx, y: s.ty, t: 0, c: JAMC[s.lv - 1], r: PG.rand(0, 6) }); st.enemies.forEach(function (e) { if (!e.dead && Math.hypot(e.x - s.tx, e.y - s.ty) < 42) dmg(e, s.dmg, 0.45); }); PG.sfx('pop', 0.6); for (var k = 0; k < 7; k++) st.fx.push({ x: s.tx, y: s.ty, vx: PG.rand(-70, 70), vy: PG.rand(-90, 0), t: 0, life: 0.5, col: JAMC[s.lv - 1], r: PG.rand(2, 4) }); }
        else if (s.tgt && !s.tgt.dead) { dmg(s.tgt, s.dmg); fxPuff(s.tx, s.ty, '#f4c58a'); }
        st.shots.splice(i, 1);
      } else { s.x += dx / dd * step; s.y += dy / dd * step; }
    }
    st.blobs.forEach(function (b) { b.t += dt; }); st.blobs = st.blobs.filter(function (b) { return b.t < 2.2; });
    st.enemies = st.enemies.filter(function (e) { return !e.dead; });
    if (st.lives <= 0) return lose();
    if (st.waveOn && !st.queue.length && !st.enemies.length) {
      st.waveOn = false; var bonus = 12 + st.wave * 3; st.money += bonus; burst(BW / 2, BH * 0.45, 'WAVE CLEAR +' + bonus, TEAL, 18); PG.sfx('win');
      PG.track('progression_completed', { step_id: 'wave', step_index: Math.min(st.wave, 40), map: st.map + 1, lives: st.lives }); PG.msg('level_completed', { level: 'wave' + st.wave });
      PG.save.bestWave = Math.max(PG.save.bestWave || 0, st.wave); PG.save['m' + st.map] = Math.max(PG.save['m' + st.map] || 0, st.wave); PG.commit();
      if (!st.endless && st.wave >= MAPS[st.map].waves) victory();
    }
  }
  function lose() { st.over = true; st.won = false; st.deadT = 0; PG.playing = false; PG.sfx('lose'); PG.save.runs = (PG.save.runs || 0) + 1; PG.commit(true); PG.track('progression_failed', { step_id: 'wave', step_index: Math.min(st.wave, 40), map: st.map + 1 }); PG.msg('level_failed', { level: 'wave' + st.wave }); }
  function victory() { st.over = true; st.won = true; st.deadT = 0; PG.playing = false; PG.sfx('win'); PG.save.cleared = Math.max(PG.save.cleared || 0, st.map + 1); PG.commit(true); PG.track('milestone_reached', { milestone: 'map_cleared', map: st.map + 1 }); }

  /* ---------- sticker sprites (painted once per scale) ---------- */
  var sprCache = {}, bgCache = {};
  function stick(c, pathFn, fill, lw) {
    lw = lw || 2.2; c.lineJoin = 'round'; c.lineCap = 'round';
    c.save(); c.translate(1.4, 2.4); pathFn(c); c.fillStyle = 'rgba(0,0,0,.24)'; c.fill(); c.lineWidth = lw + 4.5; c.strokeStyle = 'rgba(0,0,0,.24)'; c.stroke(); c.restore();
    pathFn(c); c.lineWidth = lw + 4.5; c.strokeStyle = '#fff'; c.stroke(); c.fillStyle = fill; c.fill(); c.lineWidth = lw; c.strokeStyle = INK; c.stroke();
  }
  function eye(c, x, y, r, look, brow) {
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(x, y, r * 0.85, r, 0, 0, TAU); c.fill(); c.strokeStyle = INK; c.lineWidth = r * 0.35; c.stroke();
    c.fillStyle = INK; c.beginPath(); c.arc(x + (look || 0) * r * 0.3, y + r * 0.15, r * 0.48, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(x + (look || 0) * r * 0.3 - r * 0.15, y - r * 0.05, r * 0.16, 0, TAU); c.fill();
    if (brow) { c.lineWidth = r * 0.45; c.beginPath(); c.moveTo(x - r * 0.9, y - r * 1.2 - brow * r * 0.4); c.lineTo(x + r * 0.9, y - r * 1.2 + brow * r * 0.4); c.stroke(); }
  }
  function blobPath(rnd, R, n, j) { var pts = []; for (var i = 0; i < n; i++) pts.push(R * (1 - j + rnd() * j * 2)); return function (c) { c.beginPath(); for (var i = 0; i <= n; i++) { var a = (i % n) / n * TAU, r = pts[i % n], a2 = ((i + 0.5) % n) / n * TAU, r2 = (r + pts[(i + 1) % n]) / 2 * 1.04; if (!i) c.moveTo(Math.cos(a) * r, Math.sin(a) * r); else c.quadraticCurveTo(Math.cos(a2 - TAU / n * 0.5) * r2 * 1.02, Math.sin(a2 - TAU / n * 0.5) * r2 * 1.02, Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); }; }
  function star(c, x, y, r) { c.beginPath(); for (var i = 0; i < 10; i++) { var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } c.closePath(); c.fillStyle = YEL; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.2; c.stroke(); }
  var SPR = {
    toaster: function (lv) { return { R: 26, paint: function (c) {
      var col = ['#8fd3e8', '#ff9fb8', '#ffd23f'][lv - 1];
      stick(c, function (c) { U.rr(c, -17, -12, 34, 25, 8); }, col);
      c.fillStyle = INK; U.rr(c, -11, -15, 9, 5, 2); c.fill(); U.rr(c, 2, -15, 9, 5, 2); c.fill();
      c.fillStyle = 'rgba(255,255,255,.6)'; U.rr(c, -14, -8, 4, 13, 2); c.fill();
      eye(c, -4.5, -1, 3.4, 0.4); eye(c, 5, -1, 3.4, 0.4);
      c.strokeStyle = INK; c.lineWidth = 1.6; c.beginPath(); c.arc(0.5, 4.5, 3.6, 0.25, Math.PI - 0.25); c.stroke();
      c.fillStyle = 'rgba(239,71,111,.45)'; c.beginPath(); c.arc(-10, 5, 2.2, 0, TAU); c.arc(11, 5, 2.2, 0, TAU); c.fill();
      c.fillStyle = INK; c.fillRect(17, -5, 4, 2.4); c.fillStyle = RED; c.beginPath(); c.arc(21.5, -3.8, 2.6, 0, TAU); c.fill(); c.strokeStyle = INK; c.lineWidth = 1.2; c.stroke();
      for (var i = 1; i < lv; i++) star(c, -5 + (i - 1) * 10, 17, 4);
    } }; },
    jam: function (lv) { return { R: 26, paint: function (c) {
      var jc = JAMC[lv - 1], jar = function (c) { U.rr(c, -14, -8, 28, 23, 7); };
      stick(c, jar, '#e8f6f8');
      c.save(); jar(c); c.clip(); c.fillStyle = jc; c.fillRect(-14, -3, 28, 20); c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(-14, -3, 28, 3); c.restore();
      c.lineWidth = 2.2; c.strokeStyle = INK; jar(c); c.stroke();
      c.fillStyle = 'rgba(255,255,255,.7)'; U.rr(c, -11, -5, 3, 14, 1.5); c.fill();
      var lid = function (c) { c.beginPath(); c.moveTo(-17, -9); c.quadraticCurveTo(-14, -17, 0, -17); c.quadraticCurveTo(14, -17, 17, -9); c.quadraticCurveTo(0, -6, -17, -9); c.closePath(); };
      c.fillStyle = '#fff'; lid(c); c.fill(); c.save(); lid(c); c.clip(); c.fillStyle = RED; for (var x = -18; x < 18; x += 6) c.fillRect(x, -18, 3, 12); for (var y = -18; y < -6; y += 6) { c.globalAlpha = 0.6; c.fillRect(-18, y, 36, 3); c.globalAlpha = 1; } c.restore(); c.lineWidth = 2; c.strokeStyle = INK; lid(c); c.stroke();
      eye(c, -4.5, 4, 3, 0.3); eye(c, 4.5, 4, 3, 0.3); c.strokeStyle = INK; c.lineWidth = 1.5; c.beginPath(); c.arc(0, 8.5, 3, 0.2, Math.PI - 0.2); c.stroke();
      for (var i = 1; i < lv; i++) star(c, -5 + (i - 1) * 10, 19, 4);
    } }; },
    butter: function (lv) { return { R: 28, paint: function (c) {
      stick(c, function (c) { c.beginPath(); c.ellipse(0, 3, 24, 12, 0, 0, TAU); }, '#e9f1f5', 2);
      stick(c, function (c) { U.rr(c, -15, -9, 30, 17, 5); }, '#ffe066');
      c.fillStyle = '#fff6c2'; U.rr(c, -13, -8, 26, 6, 3); c.fill();
      c.strokeStyle = INK; c.lineWidth = 1.5; c.beginPath(); c.arc(-4, 1, 2.2, Math.PI + 0.3, -0.3); c.moveTo(6.2, 1); c.arc(4, 1, 2.2, -0.3, Math.PI + 0.3, true); c.stroke();
      c.beginPath(); c.arc(0, 3.5, 2, 0.3, Math.PI - 0.3); c.stroke();
      for (var i = 1; i < lv; i++) star(c, -5 + (i - 1) * 10, 13, 3.6);
    } }; },
    slice: function () { return { R: 10, paint: function (c) { c.lineJoin = 'round'; U.rr(c, -7, -7, 14, 14, 4); c.fillStyle = '#c8843d'; c.fill(); c.strokeStyle = INK; c.lineWidth = 1.6; c.stroke(); c.fillStyle = '#f6d29a'; U.rr(c, -5, -4.5, 10, 9.5, 3); c.fill(); } }; },
    toastS: function () { return { R: 22, paint: function (c) { stick(c, function (c) { U.rr(c, -17, -11, 34, 22, 8); }, '#c8843d', 2); c.fillStyle = '#f6d29a'; U.rr(c, -13, -8, 26, 15, 6); c.fill(); c.fillStyle = 'rgba(200,132,61,.5)'; [[-6, -2], [4, 1], [-1, 3]].forEach(function (p) { c.beginPath(); c.arc(p[0], p[1], 1.2, 0, TAU); c.fill(); }); } }; },
    crumb: function () { return { R: 20, paint: function (c) {
      var p = blobPath(PG.mulberry(5), 12, 9, 0.16); stick(c, p, '#d9a35b');
      c.save(); c.scale(0.68, 0.68); c.translate(-2, -2); p(c); c.fillStyle = '#f2c88a'; c.fill(); c.restore();
      c.fillStyle = 'rgba(140,80,30,.45)'; [[-5, 4], [-7, -2], [0, 7], [-2, -7]].forEach(function (q) { c.beginPath(); c.ellipse(q[0], q[1], 1.6, 1.1, 0.5, 0, TAU); c.fill(); });
      eye(c, 1.5, -2.5, 2.8, 0.5, 1); eye(c, 7.5, -2.5, 2.6, 0.5, -1);
      c.strokeStyle = INK; c.lineWidth = 1.5; c.beginPath(); c.moveTo(2, 5); c.quadraticCurveTo(5, 3, 8, 5); c.stroke();
    } }; },
    boss: function () { return { R: 42, paint: function (c) {
      var p = blobPath(PG.mulberry(11), 26, 11, 0.14); stick(c, p, '#c9813a', 3);
      c.save(); c.scale(0.7, 0.7); c.translate(-4, -2); p(c); c.fillStyle = '#e8ad68'; c.fill(); c.restore();
      c.fillStyle = 'rgba(120,64,20,.45)'; [[-12, 8], [-15, -4], [-4, 14], [-6, -14], [10, 15]].forEach(function (q) { c.beginPath(); c.ellipse(q[0], q[1], 2.6, 1.8, 0.4, 0, TAU); c.fill(); });
      var crown = function (c) { c.beginPath(); c.moveTo(-14, -20); c.lineTo(-16, -34); c.lineTo(-7, -26); c.lineTo(0, -37); c.lineTo(7, -26); c.lineTo(16, -34); c.lineTo(14, -20); c.closePath(); };
      stick(c, crown, YEL, 2); c.fillStyle = RED; c.beginPath(); c.arc(0, -25, 2.4, 0, TAU); c.fill();
      eye(c, 3, -5, 5, 0.5, 1.2); eye(c, 14, -5, 4.6, 0.5, -1.2);
      c.fillStyle = INK; c.beginPath(); c.moveTo(1, 8); c.quadraticCurveTo(9, 3, 17, 8); c.quadraticCurveTo(9, 15, 1, 8); c.fill(); c.fillStyle = '#fff'; c.fillRect(6, 6.5, 3, 3); c.fillRect(10, 6.5, 3, 3);
    } }; },
    ant: function () { return { R: 18, paint: function (c) {
      var body = function (c) { c.beginPath(); c.ellipse(-6, 0, 6, 4.6, 0, 0, TAU); c.moveTo(4.6, 0); c.ellipse(1, 0, 3.6, 3, 0, 0, TAU); c.moveTo(11, 0); c.ellipse(7, 0, 4, 3.6, 0, 0, TAU); };
      c.strokeStyle = INK; c.lineWidth = 1.3; c.beginPath(); c.moveTo(9, -2); c.quadraticCurveTo(12, -7, 15, -6); c.moveTo(9, 2); c.quadraticCurveTo(12, 7, 15, 6); c.stroke();
      stick(c, body, '#3a3a4a', 1.8); c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(-7, -1.8, 2.6, 1.2, 0, 0, TAU); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(8.5, -1.6, 1.4, 0, TAU); c.arc(8.5, 1.6, 1.4, 0, TAU); c.fill(); c.fillStyle = INK; c.beginPath(); c.arc(9, -1.6, 0.7, 0, TAU); c.arc(9, 1.6, 0.7, 0, TAU); c.fill();
    } }; },
    beetle: function () { return { R: 22, paint: function (c) {
      stick(c, function (c) { c.beginPath(); c.arc(11, 0, 5.2, 0, TAU); }, '#1b4332', 1.8);
      var shell = function (c) { c.beginPath(); c.ellipse(-1, 0, 13, 11, 0, 0, TAU); }; stick(c, shell, '#06a77d');
      c.strokeStyle = INK; c.lineWidth = 1.8; c.beginPath(); c.moveTo(-14, 0); c.lineTo(11, 0); c.stroke();
      c.fillStyle = '#04785a'; [[-6, -5], [-6, 5], [2, -6], [2, 6], [-10, 0]].forEach(function (q) { c.beginPath(); c.arc(q[0], q[1], 2.2, 0, TAU); c.fill(); });
      c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.ellipse(-3, -6, 5, 2, -0.2, 0, TAU); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(13, -2.4, 1.8, 0, TAU); c.arc(13, 2.4, 1.8, 0, TAU); c.fill(); c.fillStyle = INK; c.beginPath(); c.arc(13.6, -2.4, 0.9, 0, TAU); c.arc(13.6, 2.4, 0.9, 0, TAU); c.fill();
    } }; }
  };
  function getSpr(key, K) {
    var kq = Math.max(0.25, Math.round(K * 8) / 8), ck = key + '@' + kq; if (sprCache[ck]) return sprCache[ck];
    var white = key[key.length - 1] === '!', base = white ? key.slice(0, -1) : key, m = base.match(/^([a-zA-Z]+)(\d?)$/), def = SPR[m[1]](+m[2] || 1), R = def.R;
    var cv = document.createElement('canvas'); cv.width = cv.height = Math.ceil(R * 2 * kq); var c = cv.getContext('2d');
    if (white) { c.drawImage(getSpr(base, K), 0, 0); c.globalCompositeOperation = 'source-in'; c.fillStyle = '#fff'; c.fillRect(0, 0, cv.width, cv.height); }
    else { c.scale(kq, kq); c.translate(R, R); def.paint(c); }
    cv.R = R; sprCache[ck] = cv; return cv;
  }
  function drawSpr(c, key, x, y, unit, K) { var s = getSpr(key, K), R = s.R; c.drawImage(s, x - R * unit, y - R * unit, R * 2 * unit, R * 2 * unit); }
  function bK() { return view.s * (PG.dpr || 1); }

  /* ---------- board ---------- */
  function halftone(c, x0, y0, w, h, sp, rFn, col) { c.fillStyle = col; for (var y = y0; y < y0 + h; y += sp) for (var x = x0 + ((Math.round((y - y0) / sp)) % 2 ? sp / 2 : 0); x < x0 + w; x += sp) { var r = rFn(x, y); if (r > 0.2) { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); } } }
  function boardBG() {
    var K = bK(), key = st.map + (land ? 'L' : 'P') + Math.round(K * 8); if (bgCache.key === key) return bgCache.cv;
    var cv = document.createElement('canvas'); cv.width = Math.ceil(BW * K); cv.height = Math.ceil(BH * K); var c = cv.getContext('2d'); c.scale(K, K);
    c.fillStyle = CREAM; c.fillRect(0, 0, BW, BH);
    for (var gx = 0; gx < BW; gx += 40) for (var gy = 0; gy < BH; gy += 40) { var a = (gx / 40) % 2 === 0, b = (gy / 40) % 2 === 0; if (!a && !b) continue; halftone(c, gx, gy, 40, 40, 6, function () { return a && b ? 2.3 : 1.5; }, 'rgba(232,90,90,.42)'); }
    var P = mapPts(st.map); c.lineCap = 'round'; c.lineJoin = 'round';
    function stroke(w, col, dx, dy) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(P[0][0] + (dx || 0), P[0][1] + (dy || 0)); for (var i = 1; i < P.length; i++) c.lineTo(P[i][0] + (dx || 0), P[i][1] + (dy || 0)); c.stroke(); }
    stroke(64, 'rgba(0,0,0,.22)', 3, 5); stroke(64, '#fff'); stroke(56, INK); stroke(50, '#e8a865'); stroke(36, '#f2c28a');
    c.setLineDash([2, 16]); stroke(3, 'rgba(160,96,40,.6)'); c.setLineDash([10, 30]); stroke(2, 'rgba(160,96,40,.4)', 0, 12); c.setLineDash([]);
    // mouse hole at the spawn and the breakfast plate at the end
    var s0 = P[0], s1 = P[1], sx = PG.clamp(s0[0], 18, BW - 18), sy = PG.clamp(s0[1], 18, BH - 18), ang = Math.atan2(s1[1] - s0[1], s1[0] - s0[0]);
    c.save(); c.translate(sx, sy); c.rotate(ang + Math.PI / 2); c.fillStyle = INK; c.beginPath(); c.ellipse(0, 4, 24, 14, 0, Math.PI, 0); c.lineTo(24, 10); c.lineTo(-24, 10); c.closePath(); c.fill(); c.restore();
    var e = P[P.length - 1]; c.fillStyle = 'rgba(0,0,0,.22)'; c.beginPath(); c.ellipse(e[0] + 3, e[1] + 6, 48, 24, 0, 0, TAU); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.ellipse(e[0], e[1], 47, 23, 0, 0, TAU); c.fill(); c.strokeStyle = INK; c.lineWidth = 2.6; c.stroke();
    c.strokeStyle = BLUE; c.lineWidth = 2.5; c.beginPath(); c.ellipse(e[0], e[1], 39, 17, 0, 0, TAU); c.stroke();
    bgCache = { key: key, cv: cv }; return cv;
  }
  function drawToastStack(c, t) {
    var P = mapPts(st.map), e = P[P.length - 1], n = Math.max(st.lives > 0 ? 1 : 0, Math.ceil(st.lives / 3)), K = bK();
    for (var i = 0; i < n; i++) { var wob = Math.sin(t * 2 + i * 1.3) * 0.8; drawSpr(c, 'toastS', e[0] + wob, e[1] - 4 - i * 6, 1, K); }
    if (n) { c.fillStyle = YEL; c.strokeStyle = INK; c.lineWidth = 1.5; U.rr(c, e[0] - 6, e[1] - 12 - (n - 1) * 6, 12, 7, 2); c.fill(); c.stroke(); }
  }
  function drawSpawnArrow(c, t) { var P = mapPts(st.map), s0 = P[0], sa = Math.atan2(P[1][1] - P[0][1], P[1][0] - P[0][0]); c.save(); c.translate(PG.clamp(s0[0] + Math.cos(sa) * 40, 14, BW - 14), PG.clamp(s0[1] + Math.sin(sa) * 40, 14, BH - 14)); c.rotate(sa); c.translate(Math.sin(t * 5) * 3, 0); c.beginPath(); c.moveTo(-9, -9); c.lineTo(9, 0); c.lineTo(-9, 9); c.closePath(); c.fillStyle = '#fff'; c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke(); c.restore(); }
  function drawTower(c, tw, t, unit, K) {
    unit = unit || 1; K = K || bK();
    c.save(); c.translate(tw.x, tw.y); var pop = PG.ease.back(Math.min(1, tw.pop)); c.scale(pop * unit, pop * unit); var k1 = K;
    if (tw.type === 'butter') { c.rotate(0.15); drawSpr(c, 'butter' + tw.lv, 0, 0, 1, k1); c.restore(); return; }
    if (tw.type === 'toaster') {
      var pu = tw.kick * 7; drawSpr(c, 'slice', -6.5, -16 - pu, 0.8, k1); drawSpr(c, 'slice', 6.5, -16 - pu * 0.6, 0.8, k1);
      c.translate(0, tw.kick * 1.5); c.scale(1 + tw.kick * 0.06, 1 - tw.kick * 0.06); drawSpr(c, 'toaster' + tw.lv, 0, 0, 1, k1);
    } else {
      drawSpr(c, 'jam' + tw.lv, 0, 0, 1, k1);
      c.save(); c.translate(0, -14); c.rotate(tw.aim); var bk = tw.kick * 5; c.lineCap = 'round';
      c.strokeStyle = INK; c.lineWidth = 6; c.beginPath(); c.moveTo(0, 0); c.lineTo(20 - bk, 0); c.stroke(); c.strokeStyle = '#cfd8dc'; c.lineWidth = 3; c.stroke();
      c.fillStyle = '#cfd8dc'; c.beginPath(); c.ellipse(23 - bk, 0, 6, 4.5, 0, 0, TAU); c.fill(); c.strokeStyle = INK; c.lineWidth = 1.8; c.stroke();
      if (tw.cd > 0.4 || !tw.kick) { c.fillStyle = JAMC[tw.lv - 1]; c.beginPath(); c.arc(23 - bk, 0, 3.4, 0, TAU); c.fill(); }
      c.fillStyle = INK; c.beginPath(); c.arc(0, 0, 3, 0, TAU); c.fill(); c.restore();
    }
    c.restore();
  }
  function drawEnemy(c, e, t, K) {
    var d = ENEMIES[e.t], dirX = Math.cos(e.a) < -0.1 ? -1 : 1, bob = Math.abs(Math.sin(e.ph * 2)) * 2;
    c.save(); c.translate(e.x, e.y);
    if (e.slow > 0) { c.fillStyle = 'rgba(123,44,191,.35)'; c.beginPath(); c.ellipse(0, d.r * 0.5, d.r * 1.3, d.r * 0.6, 0, 0, TAU); c.fill(); }
    if (e.t === 'ant' || e.t === 'beetle') { // top-down bugs turn with the path
      c.rotate(e.a); c.strokeStyle = INK; c.lineWidth = e.t === 'ant' ? 1.4 : 1.8; var L = e.t === 'ant' ? 8 : 12;
      for (var k = -1; k <= 1; k++) { var sw = Math.sin(e.ph * 3 + k * 2) * 3; c.beginPath(); c.moveTo(k * (L * 0.4), 0); c.lineTo(k * L * 0.4 + sw, -L); c.moveTo(k * L * 0.4, 0); c.lineTo(k * L * 0.4 - sw, L); c.stroke(); }
      drawSpr(c, e.t, 0, 0, 1, K); if (e.hit > 0) { c.globalAlpha = e.hit / 0.12; drawSpr(c, e.t + '!', 0, 0, 1, K); c.globalAlpha = 1; }
    } else { // crumbs waddle upright and face their direction
      var R = e.t === 'boss' ? 26 : 12; c.fillStyle = INK; [-1, 1].forEach(function (s) { c.beginPath(); c.ellipse(s * R * 0.35 + Math.sin(e.ph * 2 + (s > 0 ? 3 : 0)) * 2, R * 0.92, R * 0.22, R * 0.14, 0, 0, TAU); c.fill(); });
      c.translate(0, -bob); c.scale(dirX, 1); var sq = 1 + Math.sin(e.ph * 4) * 0.04; c.scale(sq, 2 - sq);
      drawSpr(c, e.t, 0, 0, 1, K); if (e.hit > 0) { c.globalAlpha = e.hit / 0.12; drawSpr(c, e.t + '!', 0, 0, 1, K); c.globalAlpha = 1; }
    }
    c.restore();
    if (e.hp < e.mhp) { var w = Math.max(20, d.r * 2.2), y = e.y - d.r - (e.t === 'boss' ? 30 : 14); c.fillStyle = INK; c.fillRect(e.x - w / 2 - 1.5, y - 1.5, w + 3, 7); c.fillStyle = '#fff'; c.fillRect(e.x - w / 2, y, w, 4); c.fillStyle = e.hp / e.mhp > 0.5 ? TEAL : RED; c.fillRect(e.x - w / 2, y, w * Math.max(0, e.hp / e.mhp), 4); }
  }
  function drawShot(c, s, K) {
    if (s.type === 'jam') { var arc = Math.sin(Math.min(1, s.life * 2.2) * 3.14) * 22, col = JAMC[s.lv - 1]; c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(s.x, s.y + 4, 5, 2.5, 0, 0, TAU); c.fill(); c.fillStyle = col; c.beginPath(); c.arc(s.x, s.y - arc, 6.5, 0, TAU); c.fill(); c.strokeStyle = INK; c.lineWidth = 2; c.stroke(); c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.arc(s.x - 2, s.y - arc - 2, 2, 0, TAU); c.fill(); }
    else { c.save(); c.translate(s.x, s.y); c.rotate(s.rot); drawSpr(c, 'slice', 0, 0, 0.9, K); c.restore(); }
  }
  function splat(c, b) { var k = Math.max(0, 1 - b.t / 2.2), r = 24 * (0.6 + 0.4 * Math.min(1, b.t * 8)); c.globalAlpha = 0.75 * k; c.fillStyle = b.c; c.beginPath(); for (var i = 0; i < 12; i++) { var a = i / 12 * TAU, rr = r * (0.75 + 0.35 * PG.hash(i + b.r * 13)); c.lineTo(b.x + Math.cos(a) * rr, b.y + Math.sin(a) * rr * 0.6); } c.closePath(); c.fill(); c.strokeStyle = INK; c.lineWidth = 1.5; c.stroke(); c.globalAlpha = 1; }
  function drawBurst(c, x, y, s, col, size, k) { // comic starburst caption
    c.save(); c.translate(x, y); var sc = PG.ease.back(Math.min(1, k * 4)) * (1 + Math.max(0, k - 0.7) * 0.4); c.scale(sc, sc); c.rotate(-0.06); c.globalAlpha = k > 0.75 ? Math.max(0, 1 - (k - 0.75) * 4) : 1;
    c.font = U.fontStr(size); var tw = c.measureText(s).width, rx = tw * 0.62 + size * 0.5, ry = size * 1.15;
    c.beginPath(); for (var i = 0; i < 28; i++) { var a = i / 28 * TAU, r = i % 2 ? 0.8 : 1.08; c.lineTo(Math.cos(a) * rx * r, Math.sin(a) * ry * r); } c.closePath();
    c.fillStyle = INK; c.save(); c.translate(3, 4); c.fill(); c.restore(); c.fillStyle = col; c.fill(); c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke();
    U.text(c, s, 0, 1, size, '#fff', 'center', { stroke: INK, strokeWidth: size * 0.22, shadow: false }); c.restore();
  }

  /* ---------- theme: comic buttons and panels ---------- */
  var dots = null;
  function dotPattern(c) { if (!dots) { dots = document.createElement('canvas'); dots.width = dots.height = 10; var q = dots.getContext('2d'); q.fillStyle = 'rgba(0,0,0,.12)'; q.beginPath(); q.arc(2.5, 2.5, 1.7, 0, TAU); q.arc(7.5, 7.5, 1.7, 0, TAU); q.fill(); } return c.createPattern(dots, 'repeat'); }
  PG.theme.font = 'Titan One'; PG.theme.body = 'Nunito'; PG.theme.weight = '400'; PG.theme.bodyWeight = '800'; PG.theme.text = '#fff'; PG.theme.textShadow = false; PG.theme.pageColor = '#151515';
  PG.theme.transition = { style: 'iris', color: '#151515', time: 0.4 };
  PG.theme.popStyle = { stroke: INK };
  PG.theme.button = function (c, x, y, w, h, label, o, s) {
    var col = o.disabled ? '#b8b8b8' : o.color || RED, off = s.press ? 4 : s.hover ? -1 : 0, r = Math.min(14, h * 0.3);
    c.fillStyle = INK; U.rr(c, x, y + 5, w, h, r); c.fill();
    c.fillStyle = col; U.rr(c, x, y + off, w, h, r); c.fill();
    c.save(); U.rr(c, x, y + off, w, h, r); c.clip(); c.fillStyle = dotPattern(c); c.fillRect(x, y + off + h * 0.55, w, h); c.fillStyle = 'rgba(255,255,255,.3)'; U.rr(c, x + 5, y + off + 4, w - 10, h * 0.28, r * 0.5); c.fill(); c.restore();
    c.lineWidth = 3; c.strokeStyle = INK; U.rr(c, x, y + off, w, h, r); c.stroke();
    if (!label) return;
    var txt = o.textColor || '#fff', fs = U.fit(c, label, o.size || Math.min(h * 0.42, 26), w - 16);
    if (o.sub) { U.text(c, label, x + w / 2, y + off + h * 0.38, fs * 0.92, txt, 'center', { stroke: INK, strokeWidth: fs * 0.2, shadow: false }); U.text(c, o.sub, x + w / 2, y + off + h * 0.74, Math.min(fs * 0.62, U.fit(c, o.sub, fs * 0.62, w - 14, { font: 'body' })), txt, 'center', { font: 'body', stroke: INK, strokeWidth: 3, shadow: false }); }
    else U.text(c, label, x + w / 2, y + off + h / 2 + 1, fs, txt, 'center', { stroke: INK, strokeWidth: fs * 0.2, shadow: false });
  };
  PG.theme.panel = function (c, x, y, w, h) {
    c.fillStyle = INK; U.rr(c, x + 7, y + 8, w, h, 16); c.fill(); c.fillStyle = '#fff'; U.rr(c, x, y, w, h, 16); c.fill();
    c.save(); U.rr(c, x, y, w, h, 16); c.clip(); halftone(c, x + w * 0.55, y, w * 0.45, h * 0.35, 9, function (px, py) { return Math.max(0, 3.4 - Math.hypot(px - (x + w), py - y) / (w * 0.13)); }, YEL); c.restore();
    c.lineWidth = 3.5; c.strokeStyle = INK; U.rr(c, x, y, w, h, 16); c.stroke();
  };
  PG.theme.hudButton = function (c, x, y, r, kind) { c.fillStyle = INK; c.beginPath(); c.arc(x + 1, y + 4, r, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.lineWidth = 2.5; c.strokeStyle = INK; c.stroke(); PG.hudIcon(c, x, y, r * 0.95, kind, INK); };
  PG.theme.loading = function (c, w, h, t) { c.fillStyle = '#151515'; c.fillRect(0, 0, w, h); c.save(); c.translate(w / 2, h / 2 - Math.abs(Math.sin(t * 5)) * 24); c.rotate(Math.sin(t * 5) * 0.2); c.fillStyle = '#c8843d'; U.rr(c, -18, -18, 36, 36, 10); c.fill(); c.fillStyle = '#f6d29a'; U.rr(c, -13, -12, 26, 26, 7); c.fill(); c.restore(); };
  function caption(c, x, y, w, h, col) { c.fillStyle = INK; c.fillRect(x + 3, y + 4, w, h); c.fillStyle = col; c.fillRect(x, y, w, h); c.lineWidth = 2.5; c.strokeStyle = INK; c.strokeRect(x, y, w, h); }
  function coinIcon(c, x, y, r) { c.fillStyle = YEL; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.lineWidth = 2; c.strokeStyle = INK; c.stroke(); c.fillStyle = '#c8843d'; c.beginPath(); c.arc(x, y, r * 0.45, 0, TAU); c.fill(); }
  function heart(c, x, y, r) { c.beginPath(); c.moveTo(x, y + r * 0.9); c.bezierCurveTo(x - r * 1.5, y - r * 0.1, x - r * 0.6, y - r * 1.2, x, y - r * 0.35); c.bezierCurveTo(x + r * 0.6, y - r * 1.2, x + r * 1.5, y - r * 0.1, x, y + r * 0.9); c.fillStyle = RED; c.fill(); c.lineWidth = 2; c.strokeStyle = INK; c.stroke(); }
  function stickerText(c, s, x, y, size, col, rot) {
    c.save(); c.translate(x, y); c.rotate(rot || 0); c.font = U.fontStr(size); c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = size * 0.34; c.strokeText(s, size * 0.05, size * 0.09);
    c.strokeStyle = '#fff'; c.lineWidth = size * 0.34; c.strokeText(s, 0, 0); c.strokeStyle = INK; c.lineWidth = size * 0.17; c.strokeText(s, 0, 0); c.fillStyle = col; c.fillText(s, 0, 0); c.restore();
  }

  /* ---------- screens ---------- */
  function computeView(w, h) {
    var sc = PG.scale(), bar = BAR * sc;
    if (land) { var side = Math.min(HUDW * sc, w * 0.18); view.s = Math.min((w - side * 2) / BW, (h - bar) / BH); view.ox = (w - BW * view.s) / 2; view.oy = Math.max(0, (h - bar - BH * view.s) / 2); }
    else { var top = 50 * sc; view.s = Math.min(w / BW, (h - bar - top) / BH); view.ox = (w - BW * view.s) / 2; view.oy = top + Math.max(0, (h - bar - top - BH * view.s) / 2); }
  }
  function drawGame(c, w, h, t) {
    var sc = PG.scale(); computeView(w, h); var K = bK();
    c.fillStyle = '#ffb347'; c.fillRect(0, 0, w, h); c.fillStyle = dotPattern(c); c.fillRect(0, 0, w, h);
    c.fillStyle = INK; c.fillRect(view.ox - 3, view.oy - 3, BW * view.s + 6, BH * view.s + 6);
    c.save(); c.translate(view.ox, view.oy); c.scale(view.s, view.s); c.beginPath(); c.rect(0, 0, BW, BH); c.clip();
    c.drawImage(boardBG(), 0, 0, BW, BH);
    drawSpawnArrow(c, t);
    st.blobs.forEach(function (b) { splat(c, b); });
    st.towers.forEach(function (tw) { if (tw.type === 'butter') drawTower(c, tw, t); });
    var selT = st.sel; if (selT && st.towers.indexOf(selT) >= 0 && selT.type !== 'butter') { var td = tdef(selT); c.fillStyle = 'rgba(255,255,255,.28)'; c.beginPath(); c.arc(selT.x, selT.y, td.range, 0, TAU); c.fill(); c.setLineDash([8, 6]); c.strokeStyle = INK; c.lineWidth = 2; c.stroke(); c.setLineDash([]); }
    drawToastStack(c, t);
    var ents = st.towers.filter(function (tw) { return tw.type !== 'butter'; }).map(function (tw) { return { y: tw.y, f: function () { drawTower(c, tw, t, 1, K); } }; }).concat(st.enemies.map(function (e) { return { y: e.y, f: function () { drawEnemy(c, e, t, K); } }; }));
    ents.sort(function (a, b) { return a.y - b.y; }).forEach(function (o) { o.f(); });
    st.shots.forEach(function (s) { drawShot(c, s, K); });
    st.fx.forEach(function (p) { c.globalAlpha = Math.max(0, 1 - p.t / p.life); c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill(); }); c.globalAlpha = 1;
    if (st.place && st.gx !== undefined) { var gx = st.gx, gy = st.gy, ok = canPlace(st.place, gx, gy); if (st.place === 'butter') { var np = nearestOnPath(gx, gy); if (np.p && np.d < 60) { gx = np.p.x; gy = np.p.y; ok = canPlace('butter', gx, gy); } }
      var rg = TOWERS[st.place].range; c.fillStyle = ok ? 'rgba(6,214,160,.25)' : 'rgba(239,71,111,.28)'; c.beginPath(); c.arc(gx, gy, st.place === 'butter' ? 24 : rg, 0, TAU); c.fill(); c.strokeStyle = ok ? TEAL : RED; c.lineWidth = 2; c.setLineDash([6, 5]); c.stroke(); c.setLineDash([]); c.globalAlpha = 0.75; drawTower(c, { type: st.place, x: gx, y: gy, lv: 1, pop: 1, aim: -Math.PI / 2, kick: 0 }, t); c.globalAlpha = 1; }
    PG.drawParts(c); PG.drawPops(c);
    st.bursts.forEach(function (b) { drawBurst(c, b.x, b.y, b.s, b.col, b.size, b.t / 0.9); });
    c.restore();
    if (st.flash > 0) { c.fillStyle = 'rgba(239,71,111,' + st.flash * 0.45 + ')'; c.fillRect(0, 0, w, h); }
    drawHUD(c, w, h, sc);
    if (st.waveBanner > 0) { var k = 1 - st.waveBanner / 1.8, boss = st.wave % 10 === 0; drawBurst(c, w / 2, view.oy + BH * view.s * 0.3, boss ? 'BOSS WAVE!' : 'WAVE ' + st.wave, boss ? RED : YEL, 30 * sc, k); }
    drawBar(c, w, h, sc);
    if (st.over) drawEnd(c, w, h, sc);
  }
  function drawHUD(c, w, h, sc) {
    var items = [['WAVE ' + st.wave + '/' + (st.endless ? '∞' : MAPS[st.map].waves), YEL, 108], ['' + st.money, '#fff', 78], ['' + st.lives, '#fff', 62]], bh = 34 * sc;
    items.forEach(function (it, i) {
      var x = land ? 12 * sc : 12 * sc + [0, 116, 202][i] * sc, y = land ? 12 * sc + i * 46 * sc : 10 * sc, bw = it[2] * sc;
      caption(c, x, y, bw, bh, it[1]);
      if (i === 0) U.text(c, it[0], x + bw / 2, y + bh / 2 + 1, U.fit(c, it[0], 16 * sc, bw - 10), '#fff', 'center', { stroke: INK, strokeWidth: 4, shadow: false });
      else { if (i === 1) coinIcon(c, x + 15 * sc, y + bh / 2, 8 * sc); else heart(c, x + 15 * sc, y + bh / 2 + 1, 8 * sc); U.text(c, it[0], x + 29 * sc, y + bh / 2 + 1, 17 * sc, INK, 'left', { shadow: false }); }
    });
  }
  function drawBar(c, w, h, sc) {
    var bar = BAR * sc, y0 = h - bar; c.fillStyle = BLUE; c.fillRect(0, y0, w, bar); c.fillStyle = dotPattern(c); c.fillRect(0, y0, w, bar); c.fillStyle = INK; c.fillRect(0, y0, w, 3.5);
    if (st.sel && st.towers.indexOf(st.sel) >= 0) {
      var tw = st.sel, B = TOWERS[tw.type], cost = upCost(tw), maxed = tw.lv >= 3, sell = Math.round(B.cost * 0.6 + (tw.lv - 1) * B.cost * 0.4), bw = Math.min(118 * sc, w * 0.26), bh = 56 * sc;
      U.text(c, B.n, 16 * sc, y0 + 26 * sc, 20 * sc, '#fff', 'left', { stroke: INK, strokeWidth: 4, shadow: false });
      for (var i = 0; i < 3; i++) { c.save(); c.globalAlpha = i < tw.lv ? 1 : 0.3; star(c, 24 * sc + i * 20 * sc, y0 + 50 * sc, 8 * sc); c.restore(); }
      U.text(c, tw.type === 'butter' ? 'Slows crumbs on the path' : 'Dmg ' + tdef(tw).dmg.toFixed(0) + '  Range ' + tdef(tw).range.toFixed(0), 16 * sc, y0 + 78 * sc, 13 * sc, '#e8f6ff', 'left', { font: 'body', shadow: false });
      if (!maxed) { if (U.button(c, w - bw * 2 - 24 * sc, y0 + 18 * sc, bw, bh, 'Upgrade', { color: st.money >= cost ? TEAL : '#b8b8b8', sub: cost + ' crumbs', size: 17 * sc })) { if (st.money >= cost) { st.money -= cost; tw.lv++; tw.pop = 0.4; PG.sfx('upgrade'); PG.track('tower_upgraded', { tower: tw.type, level: tw.lv }); } else PG.sfx('err'); } }
      else U.text(c, 'MAX!', w - bw * 1.5 - 24 * sc, y0 + 46 * sc, 24 * sc, YEL, 'center', { stroke: INK, strokeWidth: 5, shadow: false });
      if (U.button(c, w - bw - 12 * sc, y0 + 18 * sc, bw, bh, 'Sell', { color: RED, sub: '+' + sell, size: 17 * sc })) { st.money += sell; st.towers.splice(st.towers.indexOf(tw), 1); st.sel = null; PG.sfx('coin'); }
      return;
    }
    var keys = ['toaster', 'jam', 'butter'], bw2 = Math.min(92 * sc, (w - 190 * sc) / 3 - 6 * sc), bx0 = 10 * sc, ik = sc * 0.82 * (PG.dpr || 1);
    keys.forEach(function (k, i) {
      var B = TOWERS[k], x = bx0 + i * (bw2 + 8 * sc), y = y0 + 12 * sc, can = st.money >= B.cost, on = st.place === k, bh2 = 62 * sc;
      if (U.button(c, x, y, bw2, bh2, '', { color: on ? YEL : can ? '#fff' : '#c9c9c9' })) { st.place = on ? null : k; st.sel = null; }
      c.save(); if (!can && !on) c.globalAlpha = 0.55; drawTower(c, { type: k, x: x + bw2 / 2, y: y + 26 * sc, lv: 1, pop: 1, aim: -Math.PI / 2, kick: 0 }, 0, sc * 0.82, ik); c.restore();
      coinIcon(c, x + bw2 / 2 - 14 * sc, y + bh2 - 12 * sc, 6 * sc); U.text(c, '' + B.cost, x + bw2 / 2 - 5 * sc, y + bh2 - 11 * sc, 14 * sc, INK, 'left', { shadow: false });
    });
    var rx = bx0 + 3 * (bw2 + 8 * sc) + 4 * sc, rw = Math.min(w - rx - 10 * sc, 230 * sc);
    if (!st.waveOn) { if (U.button(c, rx, y0 + 12 * sc, rw, 58 * sc, st.wave === 0 ? 'START!' : 'NEXT WAVE', { color: RED, size: 19 * sc })) startWave(); }
    else { if (U.button(c, rx, y0 + 12 * sc, rw, 58 * sc, st.speed === 1 ? 'FAST >>' : 'NORMAL >', { color: PURPLE, size: 17 * sc })) st.speed = st.speed === 1 ? 2 : 1; }
    var ty = y0 + 87 * sc;
    if (st.place) U.text(c, 'Tap the table to place a ' + TOWERS[st.place].n, w / 2, ty, 14 * sc, '#fff', 'center', { font: 'body', stroke: INK, strokeWidth: 3, shadow: false });
    else if (!st.waveOn && st.bonusUsed < 2 && PG.rewardedSupported()) { if (U.button(c, w / 2 - 110 * sc, y0 + 76 * sc, 220 * sc, 24 * sc, 'Ad: +120 crumbs', { color: PURPLE, size: 13 * sc })) PG.rewarded('bonus').then(function (ok) { if (ok) { st.money += 120; st.bonusUsed++; burst(BW / 2, BH * 0.5, '+120!', YEL, 20); PG.track('rewarded_bonus_crumbs', { wave: st.wave }); } }); }
    else U.text(c, st.waveOn ? 'Defend the toast!' : 'Pick a tower, then tap the table', w / 2, ty, 14 * sc, '#fff', 'center', { font: 'body', stroke: INK, strokeWidth: 3, shadow: false });
  }
  function drawEnd(c, w, h, sc) {
    var k = PG.ease.out(Math.min(1, Math.max(0, st.deadT - 0.3) * 2)); if (k <= 0) return; c.fillStyle = 'rgba(20,10,5,' + 0.6 * k + ')'; c.fillRect(0, 0, w, h);
    var canRev = !st.won && !st.usedRev && PG.rewardedSupported(), extra = (st.won && !st.endless) || canRev, pw = Math.min(w * 0.88, 370 * sc), ph = (extra ? 330 : 270) * sc, px = w / 2 - pw / 2, py = Math.max(10 * sc, h * 0.45 - ph / 2) + (1 - k) * 60;
    U.panel(c, px, py, pw, ph);
    stickerText(c, st.won ? 'BREAKFAST SAVED!' : 'TOAST IS TOAST!', w / 2, py + 40 * sc, Math.min(28 * sc, pw * 0.085), st.won ? TEAL : RED, -0.03);
    U.text(c, 'WAVE ' + st.wave, w / 2, py + 92 * sc, 44 * sc, INK, 'center', { shadow: false }); U.text(c, MAPS[st.map].n + '  ·  best wave ' + (PG.save['m' + st.map] || 0), w / 2, py + 128 * sc, 14 * sc, '#555', 'center', { font: 'body', shadow: false });
    var bw = pw * 0.84, bh = 50 * sc, yy = py + 150 * sc;
    if (st.won && !st.endless) { if (U.button(c, w / 2 - bw / 2, yy, bw, bh, 'Endless mode', { color: PURPLE })) { st.over = false; st.endless = true; st.state = 'play'; PG.playing = true; } yy += bh + 10 * sc; }
    else if (canRev) { if (U.button(c, w / 2 - bw / 2, yy, bw, bh, 'Ad: +5 lives', { color: PURPLE, size: 18 * sc })) PG.rewarded('continue').then(function (ok) { if (ok) { st.usedRev = true; st.over = false; st.lives = 5; PG.playing = true; PG.track('rewarded_continue', { wave: st.wave }); } }); yy += bh + 10 * sc; }
    var next = st.won && MAPS[st.map + 1];
    if (U.button(c, w / 2 - bw / 2, yy, bw, bh, next ? 'Next map' : 'Play again', { color: RED })) { var nm = next ? st.map + 1 : st.map; PG.interstitial('game_over').then(function () { PG.go(function () { startMap(nm); }); }); }
    if (U.button(c, w / 2 - bw / 2, yy + bh + 10 * sc, bw, bh * 0.8, 'Menu', { color: BLUE, size: 17 * sc })) PG.go(function () { st.state = 'menu'; st.over = false; });
  }
  function drawMenu(c, w, h, t) {
    var sc = PG.scale(), cx = land ? w * 0.3 : w / 2, cy = land ? h * 0.5 : h * 0.24, R = Math.hypot(w, h);
    c.fillStyle = '#ffb703'; c.fillRect(0, 0, w, h); c.save(); c.translate(cx, cy); c.rotate(t * 0.05); c.fillStyle = YEL; for (var i = 0; i < 24; i += 2) { c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R, i * TAU / 24, (i + 1) * TAU / 24); c.closePath(); c.fill(); } c.restore();
    c.fillStyle = dotPattern(c); c.fillRect(0, 0, w, h);
    var tsz = Math.min(58 * sc, (land ? w * 0.4 : w) * 0.15), ty = land ? h * 0.2 : h * 0.09;
    stickerText(c, 'TOWER', cx, ty, tsz, '#fff', -0.05); stickerText(c, 'OF TOAST', cx, ty + tsz * 1.05, tsz, YEL, -0.03);
    var my = land ? h * 0.62 : h * 0.3, u = sc * 2.3, mk = u * (PG.dpr || 1);
    c.save(); drawTower(c, { type: 'toaster', x: cx - 62 * sc, y: my, lv: 3, pop: 1, aim: 0, kick: (Math.sin(t * 5) + 1) / 2 }, t, u, mk); c.restore();
    c.save(); drawTower(c, { type: 'jam', x: cx + 62 * sc, y: my, lv: 1, pop: 1, aim: -1.2 + Math.sin(t * 1.5) * 0.4, kick: 0 }, t, u, mk); c.restore();
    c.save(); c.translate(cx, my + 44 * sc); c.scale(dirFlip(t), 1); drawSpr(c, 'crumb', 0, 0, u * 0.7, mk * 0.7); c.restore();
    var bw = Math.min(300 * sc, land ? w * 0.4 : w * 0.86), bh = 60 * sc, bx = land ? w * 0.72 - bw / 2 : w / 2 - bw / 2, y0 = land ? h * 0.16 : h * 0.44, unl = (PG.save.cleared || 0);
    MAPS.forEach(function (m, i) { var lock = i > unl; if (U.button(c, bx, y0 + i * (bh + 14 * sc), bw, bh, (lock ? 'Locked: ' : '') + m.n, { color: lock ? '#b8b8b8' : [RED, TEAL, PURPLE][i], sub: lock ? 'Clear the previous map' : 'Best wave ' + (PG.save['m' + i] || 0) + '/' + m.waves, size: 20 * sc, disabled: lock })) PG.go(function () { startMap(i); }); });
    U.text(c, 'Music: SkyleTheFrench   Sounds: Kenney', w / 2, h - 18 * sc, 12 * sc, INK, 'center', { font: 'body', shadow: false });
  }
  function dirFlip(t) { return Math.sin(t * 0.7) > 0 ? 1 : -1; }
  function render(c, w, h) {
    var t = PG.time; setOrientation(w > h * 1.1);
    if (st.state === 'menu') drawMenu(c, w, h, t); else drawGame(c, w, h, t);
    PG.grain(c, w, h, 0.04, { mode: 'multiply' });
  }
  function toBoard(x, y) { return { x: (x - view.ox) / view.s, y: (y - view.oy) / view.s }; }
  PG.onMove = function (x, y) { if (st.state !== 'play' || !st.place) return; var b = toBoard(x, y); st.gx = b.x; st.gy = b.y; };
  PG.onDown = function (x, y) { if (st.state === 'play' && st.place) PG.onMove(x, y); };
  PG.onUp = function (x, y) {
    if (st.state !== 'play' || st.over || PG.userPaused) return; var sc = PG.scale(); if (y > PG.h - BAR * sc) return;
    var b = toBoard(x, y), bx = b.x, by = b.y; if (bx < 0 || bx > BW || by < 0 || by > BH) return;
    if (st.place) { build(st.place, bx, by); if (st.money < TOWERS[st.place].cost) st.place = null; return; }
    var best = null, bd = 28; st.towers.forEach(function (t) { var d = Math.hypot(t.x - bx, t.y - by); if (d < bd) { bd = d; best = t; } }); st.sel = best;
  };
  PG.setup(document.getElementById('c'), update, render);
  window.__tot = { update: update, st: st, start: startMap, startWave: startWave, build: build, canPlace: canPlace, path: function () { return path; }, pathAt: pathAt, plen: function () { return plen; }, board: function () { return { w: BW, h: BH, land: land }; } };
  PG.init({ id: 'tower_of_toast', version: '1.1.0', defaults: { bestWave: 0, cleared: 0, runs: 0, m0: 0, m1: 0, m2: 0, muted: false } }).then(function () {
    PG.music();
  });
})();
