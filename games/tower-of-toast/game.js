/* TOWER OF TOAST - defend your breakfast from crumb monsters with toasters, jam launchers and butter slicks. */
(function () {
  'use strict';
  var U = PG.ui, TAU = 6.2832, BW = 400, BH = 640;
  var MAPS = [
    { n: 'Kitchen Counter', pts: [[-30, 90], [310, 90], [310, 230], [90, 230], [90, 370], [310, 370], [310, 510], [200, 510], [200, 590]], waves: 20 },
    { n: 'Breakfast Bar', pts: [[-30, 60], [120, 60], [120, 180], [300, 180], [300, 60], [370, 60], [370, 330], [100, 330], [100, 450], [300, 450], [300, 590], [200, 590]], waves: 20 },
    { n: 'Sunday Brunch', pts: [[200, -30], [200, 120], [60, 120], [60, 260], [340, 260], [340, 120], [270, 120], [270, 420], [60, 420], [60, 540], [200, 540], [200, 590]], waves: 25 }
  ];
  var TOWERS = {
    toaster: { n: 'Toaster', cost: 50, range: 112, rate: 1.9, dmg: 9, c: '#cfd8dc', desc: 'Fast toast shots' },
    jam: { n: 'Jam Launcher', cost: 95, range: 150, rate: 0.62, dmg: 16, c: '#b5179e', desc: 'Splash + sticky slow' },
    butter: { n: 'Butter Slick', cost: 35, range: 46, rate: 0, dmg: 0, c: '#ffe066', desc: 'Place on path: slows' }
  };
  var ENEMIES = {
    crumb: { hp: 24, sp: 44, r: 11, rew: 2, col: '#c9954d', n: 'Crumb' },
    ant: { hp: 14, sp: 80, r: 8, rew: 2, col: '#2b2d42', n: 'Ant' },
    beetle: { hp: 80, sp: 32, r: 13, rew: 4, col: '#2a9d8f', n: 'Beetle' },
    boss: { hp: 1400, sp: 26, r: 26, rew: 40, col: '#8d5524', n: 'Mega Crumb' }
  };
  var st = { state: 'menu', map: 0, wave: 0, lives: 15, money: 150, towers: [], enemies: [], shots: [], blobs: [], queue: [], spawnT: 0, waveOn: false, sel: null, place: null, speed: 1, won: false, bonusUsed: 0, deadT: 0, over: false, runIdx: 0, fx: [], flash: 0, endless: false, usedRev: false };
  var path = [], plen = 0, view = { s: 1, ox: 0, oy: 0 };
  var bgDots = []; for (var i = 0; i < 40; i++) bgDots.push({ x: Math.random() * BW, y: Math.random() * BH, r: 1 + Math.random() * 2 });

  /* ---------- path ---------- */
  function buildPath(m) { path = []; plen = 0; var p = MAPS[m].pts; for (var i = 0; i < p.length - 1; i++) { var l = Math.hypot(p[i + 1][0] - p[i][0], p[i + 1][1] - p[i][1]); path.push({ x0: p[i][0], y0: p[i][1], x1: p[i + 1][0], y1: p[i + 1][1], l: l, s: plen }); plen += l; } }
  function pathAt(d) { for (var i = 0; i < path.length; i++) { var s = path[i]; if (d <= s.s + s.l || i === path.length - 1) { var k = PG.clamp((d - s.s) / s.l, 0, 1); return { x: s.x0 + (s.x1 - s.x0) * k, y: s.y0 + (s.y1 - s.y0) * k, a: Math.atan2(s.y1 - s.y0, s.x1 - s.x0) }; } } return { x: 0, y: 0, a: 0 }; }
  function distToPath(x, y) { var best = 1e9; path.forEach(function (s) { var dx = s.x1 - s.x0, dy = s.y1 - s.y0, t = PG.clamp(((x - s.x0) * dx + (y - s.y0) * dy) / (s.l * s.l), 0, 1); best = Math.min(best, Math.hypot(x - (s.x0 + dx * t), y - (s.y0 + dy * t))); }); return best; }

  /* ---------- game ---------- */
  function startMap(m) {
    st.map = m; buildPath(m); st.wave = 0; st.lives = 15; st.money = 160; st.towers = []; st.enemies = []; st.shots = []; st.blobs = []; st.queue = []; st.waveOn = false; st.sel = null; st.place = null; st.speed = 1; st.won = false; st.over = false; st.bonusUsed = 0; st.endless = false; st.state = 'play'; st.usedRev = false;
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
    st.waveBanner = 2.2;
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
    if (type === 'butter') { var best = 1e9, bp = null; for (var d = 0; d < plen; d += 4) { var p = pathAt(d), dd = Math.hypot(p.x - x, p.y - y); if (dd < best) { best = dd; bp = p; } } x = bp.x; y = bp.y; }
    if (!canPlace(type, x, y)) { PG.sfx('err'); return; }
    st.money -= b.cost; var t = { type: type, x: x, y: y, lv: 1, cd: 0, pop: 0, aim: 0, kick: 0 }; st.towers.push(t); st.sel = t; PG.sfx('upgrade'); PG.burst(0, 0, 0); fxPuff(x, y, '#fff'); PG.track('tower_built', { tower: type, wave: Math.min(st.wave, 40) });
  }
  function fxPuff(x, y, col) { for (var i = 0; i < 8; i++) st.fx.push({ x: x, y: y, vx: PG.rand(-60, 60), vy: PG.rand(-80, 20), t: 0, life: 0.5, col: col, r: PG.rand(2, 5) }); }
  function dmg(e, n, slow) {
    e.hp -= n; e.hit = 0.12; if (slow) { e.slow = Math.max(e.slow, slow); e.slowT = 2.2; }
    if (e.hp <= 0 && !e.dead) { e.dead = true; var d = ENEMIES[e.t], rew = Math.round(d.rew * (1 + st.wave * 0.02)); st.money += rew; PG.popText(e.x, e.y - 10, '+' + rew, '#ffe066', 14); PG.sfx('pop', 0.9 + Math.random() * 0.4); for (var i = 0; i < 6; i++) st.fx.push({ x: e.x, y: e.y, vx: PG.rand(-70, 70), vy: PG.rand(-90, 10), t: 0, life: 0.6, col: d.col, r: PG.rand(2, 4) }); if (e.t === 'boss') { PG.sfx('boom'); st.flash = 0.4; } }
  }
  function update(dt0) {
    PG.updateParts(dt0); PG.updatePops(dt0); st.flash = Math.max(0, st.flash - dt0); if (st.waveBanner > 0) st.waveBanner -= dt0;
    for (var f = st.fx.length - 1; f >= 0; f--) { var p = st.fx[f]; p.t += dt0; p.vy += 260 * dt0; p.x += p.vx * dt0; p.y += p.vy * dt0; if (p.t > p.life) st.fx.splice(f, 1); }
    if (st.state !== 'play' || st.over) return;
    var dt = dt0 * st.speed;
    if (st.waveOn) { st.spawnT -= dt; if (st.queue.length && st.spawnT <= 0) { spawn(st.queue.shift()); st.spawnT = Math.max(0.45, 1.0 - st.wave * 0.025); } }
    st.enemies.forEach(function (e) {
      var d = ENEMIES[e.t], sp = d.sp * (e.slow ? 1 - e.slow : 1); if (e.slowT > 0) { e.slowT -= dt; if (e.slowT <= 0) e.slow = 0; }
      // butter slick slow
      var bs = 0; st.towers.forEach(function (t) { if (t.type === 'butter' && Math.hypot(t.x - e.x, t.y - e.y) < tdef(t).range * 0.5) bs = Math.max(bs, 0.4 + 0.1 * t.lv); }); sp *= (1 - bs); e.onButter = bs > 0;
      e.d += sp * dt; e.hit = Math.max(0, e.hit - dt); var pp = pathAt(e.d); e.x = pp.x; e.y = pp.y; e.a = pp.a; e.ph += dt * sp * 0.12;
      if (e.d >= plen && !e.dead) { e.dead = true; e.reached = true; st.lives -= e.t === 'boss' ? 8 : 1; st.flash = 0.35; PG.sfx('hit'); PG.vibrate(30); PG.popText(e.x, e.y - 20, 'Munch!', '#ff6b6b', 20); }
    });
    st.towers.forEach(function (t) {
      t.pop = Math.min(1, t.pop + dt * 4); t.kick = Math.max(0, t.kick - dt * 6); if (t.type === 'butter') return; var td = tdef(t); t.cd -= dt;
      var tgt = null, bd = -1; st.enemies.forEach(function (e) { if (e.dead) return; var dd = Math.hypot(e.x - t.x, e.y - t.y); if (dd <= td.range + e.r * 0.4 && e.d > bd) { bd = e.d; tgt = e; } });
      if (tgt) { t.aim = Math.atan2(tgt.y - t.y, tgt.x - t.x); if (t.cd <= 0) { t.cd = 1 / td.rate; t.kick = 1; st.shots.push({ type: t.type, x: t.x, y: t.y, tgt: tgt, dmg: td.dmg, sp: t.type === 'jam' ? 190 : 380, rot: 0, tx: tgt.x, ty: tgt.y, lv: t.lv, life: 0 }); PG.sfx(t.type === 'jam' ? 'drop' : 'shoot', 1 + Math.random() * 0.1); } }
    });
    for (var i = st.shots.length - 1; i >= 0; i--) {
      var s = st.shots[i]; s.rot += dt * 14; s.life += dt; if (s.tgt && !s.tgt.dead) { s.tx = s.tgt.x; s.ty = s.tgt.y; }
      var dx = s.tx - s.x, dy = s.ty - s.y, dd = Math.hypot(dx, dy), step = s.sp * dt;
      if (dd <= step + 4) {
        if (s.type === 'jam') { st.blobs.push({ x: s.tx, y: s.ty, t: 0 }); st.enemies.forEach(function (e) { if (!e.dead && Math.hypot(e.x - s.tx, e.y - s.ty) < 42) dmg(e, s.dmg, 0.45); }); PG.sfx('pop', 0.6); for (var k = 0; k < 7; k++) st.fx.push({ x: s.tx, y: s.ty, vx: PG.rand(-70, 70), vy: PG.rand(-90, 0), t: 0, life: 0.5, col: '#b5179e', r: PG.rand(2, 4) }); }
        else if (s.tgt && !s.tgt.dead) { dmg(s.tgt, s.dmg); fxPuff(s.tx, s.ty, '#f4b183'); }
        st.shots.splice(i, 1);
      } else { s.x += dx / dd * step; s.y += dy / dd * step; }
    }
    st.blobs.forEach(function (b) { b.t += dt; }); st.blobs = st.blobs.filter(function (b) { return b.t < 2.2; });
    st.enemies = st.enemies.filter(function (e) { return !e.dead; });
    if (st.lives <= 0) return lose();
    if (st.waveOn && !st.queue.length && !st.enemies.length) {
      st.waveOn = false; var bonus = 12 + st.wave * 3; st.money += bonus; PG.popText(BW / 2, 300, 'Wave clear +' + bonus, '#ffd23f', 22); PG.sfx('win');
      PG.track('progression_completed', { step_id: 'wave', step_index: Math.min(st.wave, 40), map: st.map + 1, lives: st.lives }); PG.msg('level_completed', { level: 'wave' + st.wave });
      PG.save.bestWave = Math.max(PG.save.bestWave || 0, st.wave); PG.save['m' + st.map] = Math.max(PG.save['m' + st.map] || 0, st.wave); PG.commit();
      if (!st.endless && st.wave >= MAPS[st.map].waves) victory();
    }
  }
  function lose() { st.over = true; st.won = false; st.deadT = 0; PG.playing = false; PG.sfx('lose'); PG.save.runs = (PG.save.runs || 0) + 1; PG.commit(true); PG.track('progression_failed', { step_id: 'wave', step_index: Math.min(st.wave, 40), map: st.map + 1 }); PG.msg('level_failed', { level: 'wave' + st.wave }); }
  function victory() { st.over = true; st.won = true; st.deadT = 0; PG.playing = false; PG.sfx('win'); PG.save.cleared = Math.max(PG.save.cleared || 0, st.map + 1); PG.commit(true); PG.track('milestone_reached', { milestone: 'map_cleared', map: st.map + 1 }); }

  /* ---------- drawing ---------- */
  function drawBoard(c, t) {
    // gingham tablecloth
    c.fillStyle = '#fff5f5'; c.fillRect(0, 0, BW, BH); c.fillStyle = 'rgba(214,40,40,.18)'; for (var x = 0; x < BW; x += 40) c.fillRect(x, 0, 20, BH); for (var y = 0; y < BH; y += 40) c.fillRect(0, y, BW, 20);
    c.fillStyle = 'rgba(120,60,20,.12)'; bgDots.forEach(function (d) { c.beginPath(); c.arc(d.x, d.y, d.r, 0, TAU); c.fill(); });
    // path: wooden cutting board strip
    c.lineCap = 'round'; c.lineJoin = 'round'; var P = MAPS[st.map].pts;
    function strokePath(w, col) { c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(P[0][0], P[0][1]); for (var i = 1; i < P.length; i++) c.lineTo(P[i][0], P[i][1]); c.stroke(); }
    strokePath(52, 'rgba(0,0,0,.18)'); c.save(); c.translate(0, -2); strokePath(50, '#8d5a2b'); strokePath(44, '#c68b59'); strokePath(36, '#d79b66'); c.restore();
    c.strokeStyle = 'rgba(120,70,30,.35)'; c.lineWidth = 1.5; c.setLineDash([14, 22]); c.beginPath(); c.moveTo(P[0][0], P[0][1]); for (i = 1; i < P.length; i++) c.lineTo(P[i][0], P[i][1]); c.stroke(); c.setLineDash([]);
    // plate + toast stack (lives)
    var e = P[P.length - 1]; c.fillStyle = 'rgba(0,0,0,.15)'; c.beginPath(); c.ellipse(e[0] + 2, e[1] + 6, 44, 20, 0, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.ellipse(e[0], e[1], 42, 19, 0, 0, TAU); c.fill(); c.strokeStyle = '#dfe6ee'; c.lineWidth = 3; c.stroke();
    var toasts = Math.max(1, Math.ceil(st.lives / 4)); for (i = 0; i < toasts; i++) { var ty = e[1] - 2 - i * 7, wob = Math.sin(t * 2 + i) * 0.6; c.fillStyle = '#e9b872'; c.beginPath(); c.roundRect ? c.roundRect(e[0] - 17 + wob, ty - 14, 34, 22, 8) : c.rect(e[0] - 17, ty - 14, 34, 22); c.fill(); c.fillStyle = '#f7dcae'; c.beginPath(); c.roundRect ? c.roundRect(e[0] - 13 + wob, ty - 11, 26, 16, 6) : c.rect(e[0] - 13, ty - 11, 26, 16); c.fill(); }
    // spawn arrow
    var s0 = P[0]; c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); var sa = Math.atan2(P[1][1] - P[0][1], P[1][0] - P[0][0]); c.save(); c.translate(Math.max(14, Math.min(BW - 14, s0[0] + Math.cos(sa) * 30)), Math.max(14, Math.min(BH - 14, s0[1] + Math.sin(sa) * 30))); c.rotate(sa + Math.sin(t * 4) * 0.1); c.moveTo(-8, -8); c.lineTo(8, 0); c.lineTo(-8, 8); c.closePath(); c.fill(); c.restore();
  }
  function drawTower(c, tw, t, ghost) {
    c.save(); c.translate(tw.x, tw.y); var pop = PG.ease.back(Math.min(1, tw.pop)); c.scale(pop, pop);
    if (tw.type === 'butter') {
      c.rotate(0.3); c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(1, 3, 25, 12, 0, 0, TAU); c.fill(); var g = c.createLinearGradient(-22, -10, 22, 10); g.addColorStop(0, '#fff3b0'); g.addColorStop(1, '#ffd23f'); c.fillStyle = g; c.beginPath(); c.ellipse(0, 0, 24, 11, 0, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.ellipse(-8 + Math.sin(t * 2) * 2, -3, 8, 3, 0, 0, TAU); c.fill(); if (tw.lv > 1) { c.strokeStyle = '#e8a800'; c.lineWidth = 2; c.beginPath(); c.ellipse(0, 0, 24, 11, 0, 0, TAU); c.stroke(); } c.restore(); return;
    }
    c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(0, 12, 17, 7, 0, 0, TAU); c.fill();
    if (tw.type === 'toaster') {
      var bounce = tw.kick * 3; c.translate(0, bounce * 0.5);
      var tg = c.createLinearGradient(-16, -14, 16, 14); tg.addColorStop(0, '#f1f5f8'); tg.addColorStop(1, tw.lv > 2 ? '#ffd54f' : tw.lv > 1 ? '#90caf9' : '#9fb0bd'); c.fillStyle = tg; c.beginPath(); c.roundRect ? c.roundRect(-17, -13, 34, 26, 8) : c.rect(-17, -13, 34, 26); c.fill(); c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = 1.5; c.stroke();
      c.fillStyle = '#37474f'; c.fillRect(-11, -14, 9, 4); c.fillRect(2, -14, 9, 4);
      c.save(); c.rotate(tw.aim * 0.0); var pu = tw.kick * 6; c.fillStyle = '#e9b872'; c.fillRect(-10, -18 - pu, 7, 7); c.fillRect(3, -18 - (pu * 0.6), 7, 7); c.restore();
      c.fillStyle = '#e53935'; c.beginPath(); c.arc(11, 6, 2.5, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(-14, -9, 6, 3);
      for (var i = 1; i < tw.lv; i++) { c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(-10 + i * 8, 10, 2, 0, TAU); c.fill(); }
    } else {
      c.rotate(tw.aim + Math.PI / 2 * 0); var bk = tw.kick * 4; // spoon catapult aimed at target
      c.fillStyle = '#7b2cbf'; c.beginPath(); c.arc(0, 0, 15, 0, TAU); c.fill(); c.fillStyle = '#9d4edd'; c.beginPath(); c.arc(-2, -2, 12, 0, TAU); c.fill(); c.fillStyle = '#e0aaff'; c.beginPath(); c.ellipse(-5, -6, 5, 3, 0.5, 0, TAU); c.fill();
      c.fillStyle = '#cfd8dc'; c.fillRect(2 - bk, -3, 22, 6); c.beginPath(); c.arc(24 - bk, 0, 7, 0, TAU); c.fillStyle = '#b5179e'; c.fill(); c.fillStyle = '#b0bec5'; c.beginPath(); c.arc(24 - bk, 0, 7, 0, TAU); c.globalAlpha = 0.3; c.fill(); c.globalAlpha = 1;
      for (i = 1; i < tw.lv; i++) { c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(-10 + i * 8, 11, 2, 0, TAU); c.fill(); }
    }
    c.restore();
  }
  function drawEnemy(c, e, t) {
    var d = ENEMIES[e.t]; c.save(); c.translate(e.x, e.y);
    c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(1, d.r * 0.6, d.r, d.r * 0.5, 0, 0, TAU); c.fill();
    var wig = Math.sin(e.ph * 2) * 0.12, sq = 1 + Math.sin(e.ph * 2) * 0.06; c.rotate(e.a); c.scale(sq, 2 - sq);
    if (e.t === 'ant') { c.fillStyle = e.hit > 0 ? '#fff' : d.col; [-1, 0, 1].forEach(function (k) { c.strokeStyle = d.col; c.lineWidth = 1.5; c.beginPath(); c.moveTo(k * 3, 0); c.lineTo(k * 3 + Math.sin(e.ph * 3 + k) * 3, -9); c.moveTo(k * 3, 0); c.lineTo(k * 3 + Math.sin(e.ph * 3 + k + 3) * 3, 9); c.stroke(); }); c.beginPath(); c.ellipse(-4, 0, 5, 4, 0, 0, TAU); c.ellipse(3, 0, 4, 3.5, 0, 0, TAU); c.ellipse(9, 0, 3.4, 3, 0, 0, TAU); c.fill(); }
    else if (e.t === 'beetle') { c.fillStyle = e.hit > 0 ? '#fff' : d.col; c.beginPath(); c.ellipse(0, 0, d.r * 1.1, d.r, 0, 0, TAU); c.fill(); c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(-d.r, 0); c.lineTo(d.r * 0.8, 0); c.stroke(); c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(-3, -4, 5, 2.5, 0, 0, TAU); c.fill(); c.fillStyle = '#1b4332'; c.beginPath(); c.arc(d.r, 0, 5, 0, TAU); c.fill(); }
    else { c.fillStyle = e.hit > 0 ? '#fff' : d.col; var rr = d.r; c.beginPath(); for (var i = 0; i < 9; i++) { var a = i / 9 * TAU, r2 = rr * (1 + Math.sin(i * 2.3 + e.ph) * 0.12); c.lineTo(Math.cos(a) * r2, Math.sin(a) * r2); } c.closePath(); c.fill(); c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.arc(-rr * 0.3, -rr * 0.35, rr * 0.35, 0, TAU); c.fill(); if (e.t === 'boss') { c.fillStyle = '#ffd23f'; c.beginPath(); c.moveTo(-10, -rr + 2); c.lineTo(-6, -rr - 10); c.lineTo(0, -rr); c.lineTo(6, -rr - 10); c.lineTo(10, -rr + 2); c.closePath(); c.fill(); } }
    // eyes
    c.rotate(0); var ex = d.r * 0.4; c.fillStyle = '#fff'; c.beginPath(); c.arc(ex, -d.r * 0.3, d.r * 0.26, 0, TAU); c.arc(ex, d.r * 0.3, d.r * 0.26, 0, TAU); c.fill(); c.fillStyle = '#111'; c.beginPath(); c.arc(ex + d.r * 0.08, -d.r * 0.3, d.r * 0.12, 0, TAU); c.arc(ex + d.r * 0.08, d.r * 0.3, d.r * 0.12, 0, TAU); c.fill();
    c.restore();
    if (e.slow > 0) { c.fillStyle = 'rgba(181,23,158,.45)'; c.beginPath(); c.arc(e.x, e.y + 2, d.r * 1.1, 0, TAU); c.fill(); }
    if (e.hp < e.mhp) { var w = Math.max(18, d.r * 2); c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(e.x - w / 2, e.y - d.r - 9, w, 4); c.fillStyle = e.hp / e.mhp > 0.5 ? '#7bc043' : '#ff6b6b'; c.fillRect(e.x - w / 2, e.y - d.r - 9, w * Math.max(0, e.hp / e.mhp), 4); }
  }
  function drawShot(c, s) {
    c.save(); c.translate(s.x, s.y);
    if (s.type === 'jam') { var k = Math.min(1, s.life * 2); c.translate(0, -Math.sin(Math.min(1, s.life * 2.2) * 3.14) * 22); c.fillStyle = '#b5179e'; c.beginPath(); c.arc(0, 0, 7, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.arc(-2, -2, 2.4, 0, TAU); c.fill(); }
    else { c.rotate(s.rot); c.fillStyle = '#e9b872'; c.fillRect(-6, -6, 12, 12); c.fillStyle = '#7b4a1e'; c.fillRect(-6, -6, 12, 3); c.fillStyle = '#f7dcae'; c.fillRect(-4, -3, 8, 8); }
    c.restore();
  }
  function drawGame(c, w, h, t) {
    var sc = PG.scale(), bar = 104 * sc, topH = 0; var avail = h - bar; view.s = Math.min(w / BW, avail / BH); view.ox = (w - BW * view.s) / 2; view.oy = Math.max(0, (avail - BH * view.s) / 2);
    // surround
    var bg = c.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#3d2b1f'); bg.addColorStop(1, '#241811'); c.fillStyle = bg; c.fillRect(0, 0, w, h);
    c.save(); c.translate(view.ox, view.oy); c.scale(view.s, view.s); c.beginPath(); c.rect(0, 0, BW, BH); c.clip();
    drawBoard(c, t);
    st.blobs.forEach(function (b) { c.globalAlpha = Math.max(0, 1 - b.t / 2.2) * 0.6; c.fillStyle = '#b5179e'; c.beginPath(); c.ellipse(b.x, b.y, 28, 16, 0, 0, TAU); c.fill(); c.globalAlpha = 1; });
    var sorted = st.towers.slice().sort(function (a, b) { return a.y - b.y; });
    st.towers.forEach(function (tw) { if (tw.type === 'butter') drawTower(c, tw, t); });
    // range ring
    var selT = st.sel; if (selT && st.towers.indexOf(selT) >= 0 && selT.type !== 'butter') { var td = tdef(selT); c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.arc(selT.x, selT.y, td.range, 0, TAU); c.fill(); c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1.5; c.stroke(); }
    sorted.forEach(function (tw) { if (tw.type !== 'butter') drawTower(c, tw, t); });
    st.enemies.slice().sort(function (a, b) { return a.y - b.y; }).forEach(function (e) { drawEnemy(c, e, t); });
    st.shots.forEach(function (s) { drawShot(c, s); });
    st.fx.forEach(function (p) { c.globalAlpha = Math.max(0, 1 - p.t / p.life); c.fillStyle = p.col; c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill(); }); c.globalAlpha = 1;
    // placement ghost
    if (st.place) { var gx = st.gx, gy = st.gy, ok = canPlace(st.place, gx, gy); if (st.place === 'butter') { var best = 1e9, bp = null; for (var d = 0; d < plen; d += 4) { var p = pathAt(d), dd = Math.hypot(p.x - gx, p.y - gy); if (dd < best) { best = dd; bp = p; } } if (bp && best < 60) { gx = bp.x; gy = bp.y; ok = canPlace('butter', gx, gy); } }
      var rg = TOWERS[st.place].range; c.fillStyle = ok ? 'rgba(120,255,120,.18)' : 'rgba(255,80,80,.2)'; c.beginPath(); c.arc(gx, gy, st.place === 'butter' ? 24 : rg, 0, TAU); c.fill(); c.globalAlpha = 0.7; drawTower(c, { type: st.place, x: gx, y: gy, lv: 1, pop: 1, aim: 0, kick: 0 }, t); c.globalAlpha = 1; }
    PG.drawParts(c); PG.drawPops(c);
    c.restore();
    if (st.flash > 0) { c.fillStyle = 'rgba(255,60,60,' + st.flash * 0.5 + ')'; c.fillRect(0, 0, w, h); }
    // HUD top-left
    U.text(c, 'Wave ' + st.wave + '/' + (st.endless ? '∞' : MAPS[st.map].waves), 14 * sc, 22 * sc, 20 * sc, '#fff', 'left', { stroke: 'rgba(0,0,0,.4)' });
    U.coin(c, 22 * sc, 48 * sc, 9 * sc); U.text(c, '' + st.money, 36 * sc, 49 * sc, 19 * sc, '#ffe066', 'left', { stroke: 'rgba(0,0,0,.4)' });
    U.text(c, '♥ ' + st.lives, 14 * sc, 74 * sc, 17 * sc, '#ff8a8a', 'left', { stroke: 'rgba(0,0,0,.4)' });
    if (st.waveBanner > 0) { c.globalAlpha = Math.min(1, st.waveBanner * 2); U.text(c, (st.wave % 10 === 0 ? 'BOSS WAVE ' : 'Wave ') + st.wave, w / 2, h * 0.3, 40 * sc, st.wave % 10 === 0 ? '#ff6b6b' : '#ffd23f', 'center', { stroke: 'rgba(0,0,0,.5)' }); c.globalAlpha = 1; }
    drawBar(c, w, h, sc);
    if (st.over) drawEnd(c, w, h, sc);
  }
  function b2s(x, y) { return { x: view.ox + x * view.s, y: view.oy + y * view.s }; }
  function drawBar(c, w, h, sc) {
    var bar = 104 * sc, y0 = h - bar; var g = c.createLinearGradient(0, y0, 0, h); g.addColorStop(0, '#5b3a24'); g.addColorStop(1, '#3a2416'); c.fillStyle = g; c.fillRect(0, y0, w, bar); c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(0, y0, w, 2);
    if (st.sel && st.towers.indexOf(st.sel) >= 0) { // selected tower panel
      var tw = st.sel, B = TOWERS[tw.type], cost = upCost(tw), maxed = tw.lv >= 3, sell = Math.round(B.cost * 0.6 + (tw.lv - 1) * B.cost * 0.4);
      U.text(c, B.n + ' Lv ' + tw.lv, 16 * sc, y0 + 24 * sc, 20 * sc, '#fff', 'left'); U.text(c, tw.type === 'butter' ? 'Slows crumbs on the path' : 'Dmg ' + tdef(tw).dmg.toFixed(0) + '  Range ' + tdef(tw).range.toFixed(0), 16 * sc, y0 + 48 * sc, 14 * sc, '#e6d3c3', 'left', { shadow: false });
      var bw = Math.min(120 * sc, w * 0.26), bh = 50 * sc;
      if (!maxed) { if (U.button(c, w - bw * 2 - 24 * sc, y0 + 26 * sc, bw, bh, 'Upgrade', { color: st.money >= cost ? '#2ec4b6' : '#8a8f98', sub: cost + '', size: 17 * sc })) { if (st.money >= cost) { st.money -= cost; tw.lv++; tw.pop = 0.4; PG.sfx('upgrade'); PG.track('tower_upgraded', { tower: tw.type, level: tw.lv }); } else PG.sfx('err'); } } else U.text(c, 'MAX', w - bw * 1.6 - 24 * sc, y0 + 50 * sc, 20 * sc, '#9be564', 'center');
      if (U.button(c, w - bw - 12 * sc, y0 + 26 * sc, bw, bh, 'Sell', { color: '#e63946', sub: '+' + sell, size: 17 * sc })) { st.money += sell; st.towers.splice(st.towers.indexOf(tw), 1); st.sel = null; PG.sfx('coin'); }
      return;
    }
    var keys = ['toaster', 'jam', 'butter'], bw2 = Math.min(98 * sc, (w - 190 * sc) / 3 - 6 * sc), bx0 = 10 * sc;
    keys.forEach(function (k, i) {
      var B = TOWERS[k], x = bx0 + i * (bw2 + 6 * sc), y = y0 + 10 * sc, can = st.money >= B.cost; var on = st.place === k;
      if (U.button(c, x, y, bw2, 60 * sc, '', { color: on ? '#ffd23f' : can ? '#2ec4b6' : '#7a7f88' })) { st.place = on ? null : k; st.sel = null; }
      c.save(); c.translate(x + bw2 / 2, y + 22 * sc); c.scale(sc * 0.95, sc * 0.95); drawTower(c, { type: k, x: 0, y: 0, lv: 1, pop: 1, aim: 0, kick: 0 }, 0); c.restore();
      U.text(c, B.n.split(' ')[0] + ' ' + B.cost, x + bw2 / 2, y + 49 * sc, 13 * sc, on ? '#5a3a00' : '#fff', 'center', { shadow: false });
    });
    var rx = bx0 + 3 * (bw2 + 6 * sc) + 6 * sc, rw = w - rx - 10 * sc;
    if (!st.waveOn) { if (U.button(c, rx, y0 + 10 * sc, rw, 56 * sc, st.wave === 0 ? 'Start' : 'Next wave', { color: '#e63946', size: 17 * sc })) startWave(); }
    else { if (U.button(c, rx, y0 + 10 * sc, rw, 56 * sc, st.speed === 1 ? 'x2 speed' : 'x1 speed', { color: '#5c6bc0', size: 16 * sc })) st.speed = st.speed === 1 ? 2 : 1; }
    if (st.place) U.text(c, 'Tap the table to place ' + TOWERS[st.place].n, w / 2, y0 + 82 * sc, 15 * sc, '#ffe', 'center', { shadow: false });
    else if (!st.waveOn && st.bonusUsed < 2 && PG.rewardedSupported()) { if (U.button(c, w / 2 - 110 * sc, y0 + 72 * sc, 220 * sc, 28 * sc, 'Watch ad: +120 crumbs', { color: '#8338ec', size: 13 * sc })) PG.rewarded('bonus').then(function (ok) { if (ok) { st.money += 120; st.bonusUsed++; PG.popText(BW / 2, 320, '+120', '#ffd23f', 24); PG.track('rewarded_bonus_crumbs', { wave: st.wave }); } }); }
    else U.text(c, st.waveOn ? 'Defend the toast!' : 'Pick a tower, then tap the table', w / 2, y0 + 86 * sc, 14 * sc, '#cdb9a8', 'center', { shadow: false });
  }
  function drawEnd(c, w, h, sc) {
    st.deadT += 0.016; var k = PG.ease.out(Math.min(1, st.deadT * 2)); c.fillStyle = 'rgba(20,10,5,' + 0.6 * k + ')'; c.fillRect(0, 0, w, h);
    var pw = Math.min(w * 0.88, 380 * sc), ph = 330 * sc, px = w / 2 - pw / 2, py = h * 0.45 - ph / 2 + (1 - k) * 60; U.panel(c, px, py, pw, ph);
    U.text(c, st.won ? 'Breakfast saved!' : 'The toast is gone!', w / 2, py + 40 * sc, 28 * sc, st.won ? '#9be564' : '#ff8a8a', 'center');
    U.text(c, 'Wave ' + st.wave, w / 2, py + 92 * sc, 46 * sc, '#fff', 'center'); U.text(c, MAPS[st.map].n + '  -  Best wave ' + (PG.save['m' + st.map] || 0), w / 2, py + 130 * sc, 15 * sc, '#cbd5e1', 'center');
    var bw = pw * 0.84, bh = 50 * sc, yy = py + 156 * sc;
    if (st.won && !st.endless) { if (U.button(c, w / 2 - bw / 2, yy, bw, bh, 'Endless mode', { color: '#8338ec' })) { st.over = false; st.endless = true; st.state = 'play'; PG.playing = true; } yy += bh + 10 * sc; }
    else if (!st.won && !st.usedRev && PG.rewardedSupported()) { if (U.button(c, w / 2 - bw / 2, yy, bw, bh, 'Watch ad: +5 lives', { color: '#8338ec', size: 17 * sc })) PG.rewarded('continue').then(function (ok) { if (ok) { st.usedRev = true; st.over = false; st.lives = 5; PG.playing = true; PG.track('rewarded_continue', { wave: st.wave }); } }); yy += bh + 10 * sc; }
    if (U.button(c, w / 2 - bw / 2, yy, bw, bh, st.won && MAPS[st.map + 1] ? 'Next map' : 'Play again', { color: '#e63946' })) { var nm = st.won && MAPS[st.map + 1] ? st.map + 1 : st.map; PG.interstitial('game_over').then(function () { startMap(nm); }); }
    if (U.button(c, w / 2 - bw / 2, yy + bh + 10 * sc, bw, bh * 0.8, 'Menu', { color: '#5c6bc0', size: 17 * sc })) { st.state = 'menu'; st.over = false; }
  }
  function drawMenu(c, w, h, t) {
    var sc = PG.scale(); var bg = c.createLinearGradient(0, 0, 0, h); bg.addColorStop(0, '#ffd8a8'); bg.addColorStop(1, '#f4a261'); c.fillStyle = bg; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(214,40,40,.12)'; for (var x = 0; x < w; x += 60) c.fillRect(x, 0, 30, h); for (var y = 0; y < h; y += 60) c.fillRect(0, y, w, 30);
    U.text(c, 'TOWER', w / 2, h * 0.1, Math.min(58 * sc, w * 0.15), '#fff', 'center', { stroke: '#7b3f00' }); U.text(c, 'OF TOAST', w / 2, h * 0.1 + 54 * sc, Math.min(58 * sc, w * 0.15), '#ffd23f', 'center', { stroke: '#7b3f00' });
    c.save(); c.translate(w / 2 - 60 * sc, h * 0.3); c.scale(sc * 2.4, sc * 2.4); drawTower(c, { type: 'toaster', x: 0, y: 0, lv: 3, pop: 1, aim: 0, kick: (Math.sin(t * 5) + 1) / 2 }, t); c.restore(); c.save(); c.translate(w / 2 + 60 * sc, h * 0.3); c.scale(sc * 2.4, sc * 2.4); drawTower(c, { type: 'jam', x: 0, y: 0, lv: 2, pop: 1, aim: Math.sin(t) * 0.5, kick: 0 }, t); c.restore();
    var bw = Math.min(300 * sc, w * 0.86), bh = 56 * sc, y0 = h * 0.43; var unl = (PG.save.cleared || 0);
    MAPS.forEach(function (m, i) { var lock = i > unl; if (U.button(c, w / 2 - bw / 2, y0 + i * (bh + 12 * sc), bw, bh, (lock ? 'Locked  ' : '') + m.n, { color: lock ? '#8a8f98' : ['#e63946', '#2ec4b6', '#8338ec'][i], sub: lock ? 'Clear the previous map' : 'Best wave ' + (PG.save['m' + i] || 0) + '/' + m.waves, size: 19 * sc, disabled: lock })) startMap(i); });
    U.text(c, 'Place toasters and jam launchers, slow the crumbs with butter.', w / 2, h - 28 * sc, 13 * sc, '#6b3a12', 'center', { shadow: false });
  }
  function render(c, w, h) {
    var t = PG.time; if (st.state === 'menu') drawMenu(c, w, h, t); else drawGame(c, w, h, t);
  }
  PG.onMove = function (x, y) { if (st.state !== 'play' || !st.place) return; var b = { x: (x - view.ox) / view.s, y: (y - view.oy) / view.s }; st.gx = b.x; st.gy = b.y; };
  PG.onDown = function (x, y) { if (st.state === 'play' && st.place) PG.onMove(x, y); };
  PG.onUp = function (x, y) {
    if (st.state !== 'play' || st.over || PG.userPaused) return; var sc = PG.scale(); if (y > PG.h - 104 * sc || (x > PG.w - 130 * sc && y < 70 * sc)) return;
    var bx = (x - view.ox) / view.s, by = (y - view.oy) / view.s; if (bx < 0 || bx > BW || by < 0 || by > BH) return;
    if (st.place) { build(st.place, bx, by); if (st.money < TOWERS[st.place].cost) st.place = null; return; }
    var best = null, bd = 28; st.towers.forEach(function (t) { var d = Math.hypot(t.x - bx, t.y - by); if (d < bd) { bd = d; best = t; } }); st.sel = best;
  };
  PG.setup(document.getElementById('c'), update, render);
  window.__tot = { update: update, st: st, start: startMap, startWave: startWave, build: build, canPlace: canPlace, path: function () { return path; }, pathAt: pathAt, plen: function () { return plen; } };
  PG.init({ id: 'tower_of_toast', version: '1.0.0', defaults: { bestWave: 0, cleared: 0, runs: 0, m0: 0, m1: 0, m2: 0, muted: false } }).then(function () {
    PG.music({ scale: [0, 2, 4, 5, 7, 9, 11], root: 262, bpm: 104, wave: 'triangle', vol: 0.05, bass: 0.09 });
  });
})();
