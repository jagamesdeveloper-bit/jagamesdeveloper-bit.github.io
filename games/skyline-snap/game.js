/* SKYLINE SNAP - drop swinging floors onto your tower. Trim the overhang, land perfectly, reach the stars.
   Art direction: mid-century travel poster. Flat banded skies, geometric sun, atomic starbursts, modernist facades. */
(function () {
  'use strict';
  var U = PG.ui, TAU = 6.2832, VW = 400, FH = 30, BASE_W = 150;
  var NAVY = '#1d2d44', CREAM = '#f4e9d0', TEAL = '#2a9d8f', MUST = '#e9b44c', CORAL = '#e76f51', SKY = '#8ecae6';
  var UPS = [
    { id: 'mortar', tab: 0, n: 'Sticky Mortar', d: 'Bigger perfect zone', max: 8, base: 20, grow: 1.5 },
    { id: 'found', tab: 0, n: 'Wide Foundation', d: '+6% starting width', max: 8, base: 30, grow: 1.5 },
    { id: 'magnet', tab: 0, n: 'Magnet Crane', d: 'Near misses snap to perfect', max: 3, base: 120, grow: 2.2 },
    { id: 'slow', tab: 1, n: 'Slow Crane', d: 'Crane swings 5% slower', max: 8, base: 25, grow: 1.5 },
    { id: 'shield', tab: 1, n: 'Wind Shield', d: 'Wind pushes 12% less', max: 6, base: 40, grow: 1.6 },
    { id: 'pilot', tab: 1, n: 'Pilot Training', d: 'Power-ups sooner and longer', max: 5, base: 60, grow: 1.7 },
    { id: 'net', tab: 2, n: 'Safety Net', d: 'Forgive a miss once per run', max: 3, base: 90, grow: 2.4 },
    { id: 'lucky', tab: 2, n: 'Lucky Brick', d: '4% free perfect per level', max: 5, base: 70, grow: 1.8 },
    { id: 'keeper', tab: 2, n: 'Combo Keeper', d: 'A miss keeps part of your combo', max: 4, base: 80, grow: 1.9 },
    { id: 'coin', tab: 3, n: 'Gold Bricks', d: '+15% coins', max: 8, base: 30, grow: 1.5 },
    { id: 'hunter', tab: 3, n: 'Bonus Hunter', d: 'Crates and girders pay +25%', max: 4, base: 50, grow: 1.7 },
    { id: 'start', tab: 3, n: 'Head Start', d: 'Begin each run with a combo', max: 3, base: 100, grow: 2.3 }
  ];
  var TABS = ['Precision', 'Crane', 'Luck', 'Economy'];
  var MODS = [
    { id: 'normal', n: 'NORMAL DAY', w: 3 }, { id: 'gusty', n: 'GUSTY DAY', w: 2 }, { id: 'rush', n: 'RUSH HOUR', w: 2 }, { id: 'heavy', n: 'HEAVY FLOORS', w: 2 },
    { id: 'calm', n: 'CALM MORNING', w: 2 }, { id: 'double', n: 'DOUBLE OR NOTHING', w: 1.5 }, { id: 'lucky', n: 'LUCKY STREAK', w: 1.5 }
  ];
  var MODINFO = { normal: 'Standard rules', gusty: 'Strong wind from floor 1', rush: 'Fast crane, perfects pay 2x', heavy: 'Wide floors, fast crane', calm: 'No wind, narrow start', double: 'Coins x2, no safety nets', lucky: 'Every 4th floor is free' };
  var THEMES = [ // facade, window band, accent
    [CREAM, TEAL, CORAL], [CORAL, NAVY, CREAM], ['#f2d492', '#3d5a80', CORAL], [TEAL, '#14404a', MUST], ['#e8c9a8', '#2f4858', TEAL], [MUST, NAVY, CREAM], ['#b5c99a', '#33415c', CORAL], ['#f4a261', '#264653', CREAM]
  ];
  var st = { state: 'menu', floors: [], cur: null, x: 0, dir: 1, t: 0, falling: null, cut: [], combo: 0, perfects: 0, coinsRun: 0, paid: 0, camY: 0, over: false, overT: 0, netLeft: 0, revUsed: false, doubled: false, runIdx: 0, sway: 0, wind: 0, windT: 0, squash: 0, shake: 0, newBest: false, perfectFx: [], banner: null, tut: true };
  var scale = 1, clouds = []; st.tab = 0; st.pattern = 'pend'; st.mod = 'normal'; st.modName = ''; st.lastMod = ''; for (var i = 0; i < 7; i++) clouds.push({ x: Math.random() * 500 - 50, y: Math.random() * 1400, s: 0.6 + Math.random(), v: 4 + Math.random() * 6 });

  function up(id) { return PG.upLevel(id); }
  function tol() { return 5 + 1.6 * up('mortar'); }
  function tolFor(ty) { return tol() * (ty === 'glass' ? 1.4 : 1); }
  function modIs(id) { return st.mod === id; }
  function rollMod(excl) { var pool = MODS.filter(function (m) { return m.id !== excl; }), tot = 0; pool.forEach(function (m) { tot += m.w; }); var r = Math.random() * tot; for (var i = 0; i < pool.length; i++) { r -= pool[i].w; if (r <= 0) return pool[i]; } return pool[0]; }
  function pickType(n) { if (n > 0 && n % 10 === 0) return 'penthouse'; var r = Math.random(), k = Math.min(0.36, 0.05 + n * 0.012); if (r < k * 0.34) return 'glass'; if (r < k * 0.66) return 'girder'; if (r < k) return 'balcony'; return 'std'; }
  function windFactor(wk) { if (modIs('calm')) return 0; if (modIs('gusty')) wk = Math.max(wk, 0.45) * 1.6; if (st.evt && st.evt.type === 'storm') wk = Math.max(wk, 1.3); return wk; }
  function dayNo() { return Math.floor(Date.now() / 864e5); }
  function dailyDef() { var d = dayNo(), k = d % 3, md = MODS[1 + (d % 6)]; return { day: d, kind: ['floors', 'perfects', 'coins'][k], target: [20, 6, 25][k], mod: md, text: ['Reach 20 floors', 'Land 6 perfects', 'Earn 25 coins'][k] }; }
  function missionDefs() { var d = dayNo(); return [{ kind: 'floors', target: 10 + (d % 4) * 3, text: 'Build ' }, { kind: 'perfects', target: 3 + (d % 3) * 2, text: 'Perfects ' }, { kind: 'coins', target: 10 + (d % 5) * 4, text: 'Coins ' }]; }
  function metric(kind, n) { return kind === 'floors' ? n : kind === 'perfects' ? st.perfects : st.coinsRun; }
  function banner(s) { st.banner = { s: s, t: 0 }; }
  function checkPU() {
    var thr = Math.max(3, 5 - up('pilot')); if (st.combo <= 0 || st.combo % thr !== 0) return;
    var k = ['slow', 'wide', 'magnet'][(st.puN++) % 3], ext = 1 + 0.15 * up('pilot');
    if (k === 'slow') { st.slowT = 3 * ext; banner('SLOW-MO'); } else if (k === 'wide') { st.wideNext = true; banner('EXTRA WIDE'); } else { st.magnet = 1; banner('MAGNET'); }
    PG.sfx('upgrade'); PG.track('powerup_used', { kind: k });
  }
  function initRun() {
    var m = st.forceMod || st.nextMod || (PG.save.runs ? rollMod(st.lastMod) : MODS[0]); st.forceMod = null; st.nextMod = null; st.mod = m.id; st.modName = m.n; st.lastMod = m.id;
    st.challenge = st.nextChallenge || null; st.nextChallenge = null; st.rerolled = false; st.note = ''; st.pattern = 'pend'; st.evt = null; st.crate = null; st.bird = null; st.slowT = 0; st.wideNext = false; st.magnet = 0; st.goldNext = false; st.puN = 0;
    st.combo = Math.min(3, up('start')); st.nextEvt = 8 + Math.floor(Math.random() * 6); st.coinMul = (modIs('rush') || modIs('double')) ? 2 : 1;
    if (modIs('heavy')) st.floors[0].w = Math.min(st.floors[0].w * 1.15, 260); if (modIs('calm')) st.floors[0].w *= 0.9; if (modIs('double')) st.netLeft = 0;
    if (st.mod !== 'normal') banner(st.modName);
  }
  function afterLand(f, ty, nx, nw, n) {
    var hunt = 1 + 0.25 * up('hunter');
    if (ty === 'girder') { st.coinsRun += 3 * hunt; PG.popText(f.x, f.y - 30, '+' + Math.round(3 * hunt) + ' girder', '#e9b44c', 20); }
    if (ty === 'penthouse') { st.coinsRun += 6 * hunt; banner('PENTHOUSE'); PG.sfx('win'); }
    if (st.crate && st.crate.x >= nx - nw / 2 - 6 && st.crate.x <= nx + nw / 2 + 6) { var cv = Math.round(5 * hunt); st.coinsRun += cv; PG.popText(st.crate.x, f.y - 40, '+' + cv + ' crate', '#e9b44c', 24); PG.sfx('coin'); }
    st.crate = null;
    if (st.evt) { st.evt.left--; if (st.evt.left <= 0) { if (st.evt.type === 'swap') st.pattern = 'pend'; st.evt = null; } }
    if (n >= st.nextEvt && !st.evt && !st.bird) {
      var kinds = ['crate', 'stutter', 'bird', 'storm', 'swap'], k = kinds[Math.floor(Math.random() * kinds.length)];
      if (k === 'crate') { st.crate = { x: PG.rand(-90, 90) }; banner('BONUS CRATE'); }
      else if (k === 'stutter') { st.evt = { type: 'stutter', left: 5 }; banner('CRANE STUTTER'); }
      else if (k === 'bird') { st.bird = { t: 0 }; banner('TAP THE BIRD'); }
      else if (k === 'storm') { st.evt = { type: 'storm', left: 5 }; banner('STORM FRONT'); }
      else { st.pattern = ['sweep', 'double', 'drift'][Math.floor(Math.random() * 3)]; st.evt = { type: 'swap', left: 6 }; banner('CRANE SWAP'); }
      st.nextEvt = n + 8 + Math.floor(Math.random() * 7); PG.track('event_triggered', { kind: k, floors: Math.min(n, 200) });
    }
  }
  function swingSpeed() {
    var s = Math.min(330, 120 + st.floors.length * 3.6) * (1 - 0.05 * up('slow'));
    if (modIs('rush')) s *= 1.25; if (modIs('heavy')) s *= 1.15; if (st.slowT > 0) s *= 0.5;
    if (st.evt && st.evt.type === 'stutter') s *= Math.sin(st.t * 7) > 0.2 ? 1.6 : 0.2;
    return s;
  }
  function swingX() {
    var amp = 170 + st.wind * 25, p = st.ph, v;
    if (st.pattern === 'sweep') v = 2 / Math.PI * Math.asin(Math.sin(p)); else if (st.pattern === 'double') v = Math.sin(p + 0.9 * Math.sin(p * 0.5)); else if (st.pattern === 'drift') v = Math.sin(p + 0.7 * Math.sin(p * 2.3)); else v = Math.sin(p);
    return v * amp + st.wind * 14;
  }
  function swayOff(i, n) { var k = i / Math.max(8, n); return st.sway * k * k * 1.4; } // drawn offset of floor i in an n-floor tower
  function startRun() {
    st.state = 'play'; var w0 = Math.min(BASE_W * (1 + 0.06 * up('found')), 230); st.floors = [{ x: 0, w: w0, i: 0 }]; st.combo = 0; st.perfects = 0; st.coinsRun = 0; st.paid = 0; st.over = false; st.cut = []; st.falling = null; st.netLeft = up('net') + (st.boost ? 2 : 0); st.boost = 0; st.revUsed = false; st.doubled = false; st.runIdx++; initRun(); st.t = 0; st.camY = 0; st.newBest = false; st.banner = null; st.wind = 0; st.squash = 0;
    st.tut = !PG.save.runs; PG.parts = []; PG.pops = []; PG.playing = true; nextBlock();
    PG.track('progression_started', { step_id: 'run', step_index: Math.min(st.runIdx, 50), mod: st.mod, daily: st.challenge ? 1 : 0 }); PG.msg('level_started', { level: String(st.runIdx) });
  }
  function nextBlock() { var top = st.floors[st.floors.length - 1], ty = pickType(st.floors.length), bw = top.w * (ty === 'girder' ? 0.7 : ty === 'balcony' ? 1.12 : 1); if (st.wideNext) { bw *= 1.15; st.wideNext = false; } st.cur = { w: bw, i: st.floors.length, type: ty }; st.x = (st.runIdx + st.floors.length) % 2 ? -190 : 190; st.dir = st.x < 0 ? 1 : -1; st.ph = st.x < 0 ? -Math.PI / 2 : Math.PI / 2; }
  function drop() { if (st.state !== 'play' || st.over || st.falling || !st.cur || PG.userPaused) return; st.tut = false; st.falling = { x: st.x, y: craneY(), vy: 0, w: st.cur.w, i: st.cur.i, type: st.cur.type }; PG.sfx('whoosh'); }
  function craneY() { return -(st.floors.length * FH) - 140; }
  function land(f) { // everything is compared where the player sees it: the swaying top floor
    var n = st.floors.length, top = st.floors[n - 1], so = swayOff(n - 1, n), tx = top.x + so, dx = f.x - tx, aL = Math.max(f.x - f.w / 2, tx - top.w / 2), aR = Math.min(f.x + f.w / 2, tx + top.w / 2), ov = aR - aL;
    if (ov <= 1) {
      st.falling = null; PG.sfx('lose'); st.cut.push({ x: f.x, y: f.y, w: f.w, vx: dx > 0 ? 60 : -60, vy: 0, r: 0, vr: dx > 0 ? 3 : -3, i: f.i, t: 0 });
      if (st.netLeft > 0) { st.netLeft--; st.combo = 0; PG.popText(f.x, f.y - 40, 'Safety net!', '#b5e48c', 24); PG.sfx('upgrade'); nextBlock(); return; } gameOver(); return;
    }
    var ty = f.type || 'std', tl = tolFor(ty), perfect = Math.abs(dx) <= tl, nw = ov, nx = (aL + aR) / 2, maxW = BASE_W * (1 + 0.06 * up('found'));
    if (!perfect) {
      var forced = false, adx = Math.abs(dx);
      if (st.goldNext) { st.goldNext = false; forced = true; } else if (st.magnet > 0 && adx <= tl * 2) { st.magnet--; forced = true; PG.popText(f.x, f.y - 40, 'Magnet!', '#b5e48c', 22); }
      else if (up('magnet') > 0 && n % Math.max(3, 8 - 2 * up('magnet')) === 0 && adx <= tl * 1.5) { forced = true; PG.popText(f.x, f.y - 40, 'Snap!', '#b5e48c', 22); }
      else if (Math.random() < 0.04 * up('lucky') || (modIs('lucky') && n % 4 === 0)) { forced = true; PG.popText(f.x, f.y - 40, 'Lucky!', '#e9b44c', 24); }
      if (forced) perfect = true;
    }
    if (perfect) { st.flash = Math.min(1, 0.55 + st.combo * 0.08); nw = top.w; nx = tx; st.combo++; st.perfects++; checkPU(); if (st.combo >= 3 && top.w < maxW) nw = Math.min(top.w + 7, maxW); var cn = (1 + 0.15 * up('coin')) * (st.combo >= 3 ? 2 : 1) * st.coinMul * (ty === 'glass' ? 0.5 : 1); st.coinsRun += cn; PG.sfx('perfect', 1 + Math.min(st.combo, 8) * 0.06); st.perfectFx.push({ x: nx, y: -(n * FH) - FH / 2, w: nw, t: 0 }); PG.popText(nx, -(n * FH) - 50, st.combo > 1 ? 'PERFECT x' + st.combo : 'PERFECT', MUST, 28); PG.burst(nx, -(n * FH), 14, { colors: [MUST, CREAM, CORAL], g: 200, up: 120, life: 0.9, shape: spark }); }
    else { st.combo = Math.floor(st.combo * 0.125 * up('keeper')); var cutL = f.x - f.w / 2 < tx - top.w / 2, cw = f.w - ov, cx = cutL ? aL - cw / 2 : aR + cw / 2; st.cut.push({ x: cx, y: f.y, w: cw, vx: cutL ? -40 : 40, vy: 0, r: 0, vr: cutL ? -2 : 2, i: f.i, t: 0 }); PG.sfx('drop', 0.8 + (ov / f.w) * 0.4); PG.burst(nx, -(n * FH), 6, { colors: [CREAM, '#d6cbb3'], g: 300, min: 30, max: 140, life: 0.5, shape: 's' }); }
    if (!perfect && ty === 'balcony') nw = Math.max(24, nw - (f.w - ov)); st.floors.push({ x: nx - swayOff(n, n + 1), w: nw, i: f.i, type: ty }); afterLand(f, ty, nx, nw, n); st.falling = null; st.squash = 1; st.shake = perfect ? 3 : 6; PG.vibrate(perfect ? 6 : 14);
    st.coinsRun += (n % 5 === 0 ? 1 : 0) * (1 + 0.15 * up('coin')); if (n % 10 === 0) { st.banner = { s: n + ' FLOORS', t: 0 }; PG.sfx('win'); PG.track('floors_milestone', { floors: Math.min(n, 200) }); }
    if (n > (PG.save.best || 0)) { PG.save.best = n; st.newBest = true; }
    nextBlock();
  }
  function gameOver() {
    st.over = true; st.overT = 0; PG.playing = false; var n = st.floors.length - 1; st.coinsRun = Math.round(st.coinsRun * 10) / 10;
    var owed = Math.round((st.coinsRun - st.paid) * 10) / 10; if (owed > 0) { PG.save.coins = Math.round(((PG.save.coins || 0) + owed) * 10) / 10; st.paid = st.coinsRun; } // continuing never pays twice
    var notes = [];
    if (st.challenge && PG.save.dcDone !== st.challenge.day && metric(st.challenge.kind, n) >= st.challenge.target) { PG.save.dcDone = st.challenge.day; PG.save.coins = (PG.save.coins || 0) + 50; notes.push('DAILY DONE +50'); PG.track('challenge_completed', { kind: st.challenge.kind }); }
    var ms = PG.save.ms; if (!ms || ms.day !== dayNo()) ms = PG.save.ms = { day: dayNo(), done: [0, 0, 0] };
    missionDefs().forEach(function (m, i) { if (!ms.done[i] && metric(m.kind, n) >= m.target) { ms.done[i] = 1; PG.save.coins = (PG.save.coins || 0) + 12; notes.push('MISSION +12'); } });
    st.note = notes.join('  ');
    PG.save.runs = (PG.save.runs || 0) + 1; PG.commit(true);
    PG.track('progression_failed', { step_id: 'run', step_index: Math.min(st.runIdx, 50), floors: Math.min(n, 200), perfects: st.perfects }); PG.msg('level_failed', { level: String(st.runIdx) });
  }
  function revive() { st.revUsed = true; st.over = false; PG.playing = true; st.combo = 0; nextBlock(); PG.sfx('upgrade'); PG.track('rewarded_continue', { floors: st.floors.length - 1 }); }
  function spark(c, p, k) { var s = p.size * (0.5 + 0.5 * k); c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.fillRect(-s * 1.6, -s * 0.18, s * 3.2, s * 0.36); c.fillRect(-s * 0.18, -s * 1.6, s * 0.36, s * 3.2); c.restore(); }

  function update(dt) {
    PG.updateParts(dt); PG.updatePops(dt); st.t += dt; st.shake = Math.max(0, st.shake - dt * 30); st.flash = Math.max(0, (st.flash || 0) - dt * 2.6); st.squash = Math.max(0, st.squash - dt * 4); if (st.banner) { st.banner.t += dt; if (st.banner.t > 2) st.banner = null; } if (st.over) st.overT += dt;
    clouds.forEach(function (c) { c.x += c.v * dt; if (c.x > 480) c.x = -80; });
    for (var i = st.perfectFx.length - 1; i >= 0; i--) { st.perfectFx[i].t += dt * 2.5; if (st.perfectFx[i].t > 1) st.perfectFx.splice(i, 1); }
    st.cut.forEach(function (c) { c.t += dt; c.vy += 900 * dt; c.y += c.vy * dt; c.x += c.vx * dt; c.r += c.vr * dt; }); st.cut = st.cut.filter(function (c) { return c.t < 2.2; });
    if (st.state !== 'play') return;
    var n = st.floors.length, wk = Math.max(0, Math.min(1, (n - 10) / 28)) * (1 - 0.12 * up('shield')); wk = windFactor(wk); if (st.slowT > 0) st.slowT -= dt; if (st.bird) { st.bird.t += dt; if (st.bird.t > 4.5) st.bird = null; } st.windT += dt; var target = wk * Math.sin(st.windT * 0.45 + 1) * (0.6 + 0.4 * Math.sin(st.windT * 1.3)); st.wind += (target - st.wind) * Math.min(1, dt * 1.5);
    st.sway = st.wind * 9 + Math.sin(st.t * 1.4) * Math.min(4, n * 0.1);
    if (PG.keyHit(' ') || PG.keyHit('enter') || PG.keyHit('arrowdown')) drop();
    if (!st.over) {
      if (st.cur && !st.falling) { st.ph += dt * swingSpeed() / 170; var amp = 0; st.x = swingX(); }
      if (st.falling) { var f = st.falling; f.vy += 1900 * dt; f.y += f.vy * dt; f.x += st.wind * 160 * dt; var tgt = -(st.floors.length * FH) - FH / 2; if (f.y >= tgt) { f.y = tgt; land(f); } }
    }
    var topY = -(st.floors.length * FH), want = Math.min(0, topY + 0.12 * (PG.h || 800) / scale); st.camY += (want - st.camY) * Math.min(1, dt * 3.2);
  }

  /* ---------- poster scene ---------- */
  function hx(h) { var n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function rgb(c, a) { return 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (a === undefined ? 1 : a) + ')'; }
  var SKIES = [[0, ['#5fa8d3', '#9fd3e6', '#e3f1ec']], [14, ['#3d5a80', '#ee6c4d', '#f6bd60']], [30, ['#1d2d44', '#5e548e', '#e07a5f']], [48, ['#0d1b2a', '#1b263b', '#415a77']], [90, ['#070d17', '#0d1b2a', '#1b263b']]].map(function (s) { return [s[0], s[1].map(hx)]; });
  function skyAt(n) {
    for (var i = 0; i < SKIES.length - 1; i++) if (n <= SKIES[i + 1][0]) { var k = (n - SKIES[i][0]) / (SKIES[i + 1][0] - SKIES[i][0]); k = k * k * (3 - 2 * k); var a = SKIES[i][1], b = SKIES[i + 1][1]; return { c: [mix(a[0], b[0], k), mix(a[1], b[1], k), mix(a[2], b[2], k)], night: i >= 2 ? (i === 2 ? k : 1) : (i === 1 ? k * 0.25 : 0) }; }
    return { c: SKIES[4][1], night: 1 };
  }
  function band(sk, y) { return y < 0.5 ? mix(sk.c[0], sk.c[1], y * 2) : mix(sk.c[1], sk.c[2], (y - 0.5) * 2); }
  function w2s(x, y, w, h) { return { x: w / 2 + x * scale, y: h * 0.62 + (y - st.camY) * scale }; }
  function starburst(c, x, y, r, a) { c.save(); c.translate(x, y); c.strokeStyle = rgb([255, 244, 214], a); c.lineWidth = Math.max(1, r * 0.08); c.beginPath(); for (var i = 0; i < 8; i++) { var an = i * Math.PI / 4, rr = i % 2 ? r * 0.55 : r; c.moveTo(Math.cos(an) * r * 0.18, Math.sin(an) * r * 0.18); c.lineTo(Math.cos(an) * rr, Math.sin(an) * rr); } c.stroke(); c.fillStyle = rgb([255, 244, 214], a); c.beginPath(); c.arc(0, 0, r * 0.14, 0, TAU); c.fill(); c.restore(); }
  function drawSky(c, w, h, t) {
    var sk = skyAt(st.floors.length), nb = 9;
    for (var b = 0; b < nb; b++) { c.fillStyle = rgb(band(sk, b / (nb - 1))); c.fillRect(0, h * 0.75 * b / nb, w, h * 0.75 / nb + 1); }
    c.fillStyle = rgb(sk.c[2]); c.fillRect(0, h * 0.75, w, h * 0.25);
    if (sk.night > 0.05) { for (var i = 0; i < 26; i++) { var sx = PG.hash(i * 3.7) * w, sy = PG.hash(i * 9.1) * h * 0.55, r = (4 + PG.hash(i) * 7) * scale * (0.8 + 0.2 * Math.sin(t * 2 + i)); if (i % 3) { c.fillStyle = rgb([255, 244, 214], sk.night * 0.8); c.fillRect(sx, sy, 2, 2); } else starburst(c, sx, sy, r, sk.night); }
      var mx = w * 0.22, my = h * 0.17, mr = 26 * scale; c.fillStyle = rgb([244, 233, 208], sk.night); c.beginPath(); c.arc(mx, my, mr, 0, TAU); c.fill(); c.fillStyle = rgb(band(sk, 0.17 / 0.75)); c.beginPath(); c.arc(mx + mr * 0.45, my - mr * 0.15, mr * 0.9, 0, TAU); c.fill(); }
    if (sk.night < 0.9) { var sx2 = w * 0.76, sy2 = h * (0.24 + st.floors.length * 0.004), sr = 30 * scale, a = 1 - sk.night; c.save(); c.translate(sx2, sy2); c.rotate(t * 0.05);
      c.fillStyle = rgb([246, 189, 96], 0.55 * a); for (var r2 = 0; r2 < 12; r2++) { c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, sr * 2.3, r2 * TAU / 12, r2 * TAU / 12 + TAU / 30); c.closePath(); c.fill(); }
      c.restore(); c.strokeStyle = rgb([255, 244, 214], 0.6 * a); c.lineWidth = 2 * scale; c.beginPath(); c.arc(sx2, sy2, sr * 1.35, 0, TAU); c.stroke(); c.fillStyle = rgb([244, 162, 97], a); c.beginPath(); c.arc(sx2, sy2, sr, 0, TAU); c.fill(); c.fillStyle = rgb([233, 196, 106], a); c.beginPath(); c.arc(sx2, sy2, sr * 0.7, 0, TAU); c.fill(); }
    clouds.forEach(function (cl) { var y = ((cl.y + st.camY * 0.25) % 1200 + 1200) % 1200 * (h / 900) - 80, x = cl.x * (w / VW), s = 22 * cl.s * scale; var ca = 0.92 * (1 - sk.night * 0.85); c.fillStyle = rgb(mix([244, 233, 208], [120, 110, 140], 0.35), ca * 0.55); U.rr(c, x - s * 1.8, y - s * 0.1, s * 3.6, s * 0.7, s * 0.35); c.fill();
      c.fillStyle = rgb([244, 233, 208], ca); U.rr(c, x - s * 1.8, y - s * 0.45, s * 3.6, s * 0.75, s * 0.37); c.fill(); c.beginPath(); c.arc(x - s * 0.7, y - s * 0.5, s * 0.62, 0, TAU); c.arc(x + s * 0.35, y - s * 0.68, s * 0.8, 0, TAU); c.arc(x + s * 1.1, y - s * 0.42, s * 0.5, 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,255,255,' + 0.35 * ca + ')'; c.beginPath(); c.arc(x + s * 0.2, y - s * 0.85, s * 0.35, 0, TAU); c.fill(); });
    if (sk.night < 0.6) { c.strokeStyle = rgb([29, 45, 68], 0.55 * (1 - sk.night)); c.lineWidth = 1.6 * scale; c.lineCap = 'round'; for (var bi = 0; bi < 5; bi++) { var bt = t * (0.035 + bi * 0.004) + bi * 0.21, bx = ((bt % 1.2) - 0.1) * w, by = h * (0.28 + bi * 0.035) + Math.sin(t * 1.3 + bi) * 5 * scale, fl = Math.sin(t * 9 + bi * 2) * 4 * scale, bs = (6 + (bi % 3) * 1.5) * scale; c.beginPath(); c.moveTo(bx - bs, by + fl * 0.3); c.quadraticCurveTo(bx - bs * 0.4, by - fl, bx, by); c.quadraticCurveTo(bx + bs * 0.4, by - fl, bx + bs, by + fl * 0.3); c.stroke(); } }
    return sk;
  }
  function drawCity(c, w, h, sk) {
    var base = h * 0.62 - st.camY * scale; if (base > h + 400) return;
    var layers = [[0.3, 150, [61, 90, 128], 30], [0.55, 110, [41, 63, 92], 38], [0.8, 74, [29, 45, 68], 46]];
    layers.forEach(function (L, li) {
      var col = mix(mix(L[2], sk.c[2], 0.45 - li * 0.12), [8, 12, 24], sk.night * 0.55), win = sk.night > 0.3 ? rgb([233, 180, 76], 0.75 * sk.night) : rgb(mix(col, [244, 233, 208], 0.18));
      for (var i = -1; i < 14; i++) {
        var bw = L[3] * scale * (0.9 + ((i * 7 + li * 3) % 5) * 0.15), bh = L[1] * scale * (0.5 + (((i * 13 + li * 5) % 9) / 9) * 0.9), bx = i * (w / 12) + ((li * 17) % 20) * scale - 20, kind = (i * 5 + li) % 4;
        c.fillStyle = rgb(col); c.fillRect(bx, base - bh, bw, bh + 600);
        if (kind === 0) { c.beginPath(); c.arc(bx + bw / 2, base - bh, bw / 2, Math.PI, 0); c.fill(); }
        else if (kind === 1) { c.fillRect(bx + bw * 0.2, base - bh - bh * 0.15, bw * 0.6, bh * 0.15); c.fillRect(bx + bw * 0.47, base - bh - bh * 0.3, 2 * scale, bh * 0.15); }
        else if (kind === 2) { c.beginPath(); c.moveTo(bx, base - bh); c.lineTo(bx + bw, base - bh - bw * 0.4); c.lineTo(bx + bw, base - bh); c.fill(); }
        c.fillStyle = win; for (var wy = 8 * scale; wy < bh - 6; wy += 12 * scale) for (var wx = 5 * scale; wx < bw - 6 * scale; wx += 8 * scale) if (sk.night > 0.3 ? (wy * 7 + wx * 3 + i) % 3 < 1 : (wx + wy) % 2 < 1) c.fillRect(bx + wx, base - bh + wy, 3 * scale, 5 * scale);
      }
    });
    var hz = c.createLinearGradient(0, base - 90 * scale, 0, base); hz.addColorStop(0, rgb(sk.c[2], 0)); hz.addColorStop(1, rgb(sk.c[2], 0.5)); c.fillStyle = hz; c.fillRect(0, base - 90 * scale, w, 90 * scale);
    c.fillStyle = rgb(mix([86, 130, 89], [14, 26, 28], sk.night * 0.8)); c.fillRect(0, base, w, h); c.fillStyle = rgb(mix([52, 58, 64], [8, 10, 14], sk.night * 0.6)); c.fillRect(0, base + 16 * scale, w, 14 * scale);
    c.fillStyle = rgb([244, 233, 208], 0.6 * (1 - sk.night * 0.6)); for (var d = 0; d < w; d += 26 * scale) c.fillRect(d, base + 22 * scale, 12 * scale, 2 * scale);
    // street lamps along the verge (glow at night) and cars on the road
    var tt = st.t || 0, night = sk.night;
    for (var lx = 30 * scale; lx < w; lx += 120 * scale) { c.fillStyle = rgb(mix([40, 48, 60], [6, 8, 14], night * 0.5)); c.fillRect(lx - scale, base - 28 * scale, 2 * scale, 30 * scale); c.fillRect(lx - scale, base - 28 * scale, 9 * scale, 2 * scale);
      if (night > 0.25) { var gr = c.createRadialGradient(lx + 8 * scale, base - 24 * scale, 0, lx + 8 * scale, base - 24 * scale, 38 * scale); gr.addColorStop(0, 'rgba(255,214,120,' + 0.55 * night + ')'); gr.addColorStop(1, 'rgba(255,214,120,0)'); c.fillStyle = gr; c.fillRect(lx - 40 * scale, base - 66 * scale, 96 * scale, 90 * scale); }
      c.fillStyle = night > 0.25 ? '#ffe9a8' : '#cfc9b8'; c.beginPath(); c.arc(lx + 8 * scale, base - 25 * scale, 2.4 * scale, 0, TAU); c.fill(); }
    [[0.0, 0.07, '#e76f51', 1], [0.37, 0.05, '#f6bd60', -1], [0.7, 0.09, '#2a9d8f', 1]].forEach(function (cr, ci) {
      var dir = cr[3], u = ((tt * cr[1] * dir + cr[0]) % 1.3 + 1.3) % 1.3, cx = (u - 0.15) * w, cy = base + 18 * scale + (dir > 0 ? 0 : 5 * scale), cwid = 22 * scale, chh = 7 * scale;
      c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(cx - cwid / 2, cy + chh * 0.95, cwid, 2 * scale); c.fillStyle = cr[2]; U.rr(c, cx - cwid / 2, cy, cwid, chh, 2 * scale); c.fill();
      c.fillStyle = cr[2]; U.rr(c, cx - cwid * 0.28, cy - 4 * scale, cwid * 0.56, 5 * scale, 2 * scale); c.fill(); c.fillStyle = 'rgba(190,225,240,.85)'; c.fillRect(cx - cwid * 0.22, cy - 3 * scale, cwid * 0.18, 3 * scale); c.fillRect(cx + cwid * 0.04, cy - 3 * scale, cwid * 0.18, 3 * scale);
      c.fillStyle = '#12151c'; c.beginPath(); c.arc(cx - cwid * 0.28, cy + chh, 2.1 * scale, 0, TAU); c.arc(cx + cwid * 0.28, cy + chh, 2.1 * scale, 0, TAU); c.fill();
      if (night > 0.2) { var hx2 = cx + dir * cwid / 2; c.fillStyle = 'rgba(255,240,170,' + 0.9 * night + ')'; c.fillRect(hx2 - (dir > 0 ? 0 : 2 * scale), cy + 1.5 * scale, 2 * scale, 2 * scale); c.fillStyle = 'rgba(255,240,170,' + 0.18 * night + ')'; c.beginPath(); c.moveTo(hx2, cy + 2 * scale); c.lineTo(hx2 + dir * 26 * scale, cy - 2 * scale); c.lineTo(hx2 + dir * 26 * scale, cy + 7 * scale); c.closePath(); c.fill(); }
    });
  }
  function drawFloor(c, f, y, sk, w, h, alpha, rot) {
    var p = w2s(f.x, y, w, h), th = THEMES[Math.floor(f.i / 6) % THEMES.length], wpx = f.w * scale, hpx = FH * scale, lit = sk.night > 0.3;
    if (p.y < -hpx * 2 || p.y > h + hpx * 2) return;
    c.save(); c.translate(p.x, p.y); if (rot) c.rotate(rot); if (alpha !== undefined) c.globalAlpha = alpha;
    var face = mix(hx(th[0]), [10, 16, 30], sk.night * 0.45); c.fillStyle = rgb(face); c.fillRect(-wpx / 2, -hpx / 2, wpx, hpx);
    c.fillStyle = th[2]; c.fillRect(-wpx / 2, -hpx / 2, wpx, 3 * scale);
    var bandY = -hpx / 2 + 7 * scale, bandH = hpx - 13 * scale; c.fillStyle = lit ? 'rgba(233,180,76,.95)' : th[1]; c.fillRect(-wpx / 2 + 4 * scale, bandY, wpx - 8 * scale, bandH);
    var cols = Math.max(2, Math.floor(wpx / (14 * scale))), step = (wpx - 8 * scale) / cols; c.fillStyle = rgb(face);
    for (var i = 1; i < cols; i++) c.fillRect(-wpx / 2 + 4 * scale + step * i - scale, bandY, 2 * scale, bandH);
    if (lit) { c.fillStyle = 'rgba(29,45,68,.7)'; for (i = 0; i < cols; i++) if ((f.i * 5 + i * 3) % 4 === 0) c.fillRect(-wpx / 2 + 4 * scale + step * i + scale, bandY, step - 2 * scale, bandH); }
    // hand-finished details, deterministic per floor: sky glints, half-drawn blinds, cornice teeth, balconies, rooftop units
    var x0 = -wpx / 2 + 4 * scale, hs = PG.hash(f.i * 12.9 + 1.7);
    for (i = 0; i < cols; i++) {
      var px0 = x0 + step * i;
      if (!lit) { c.fillStyle = 'rgba(255,255,255,.24)'; c.beginPath(); c.moveTo(px0 + 2 * scale, bandY + bandH); c.lineTo(px0 + step * 0.5, bandY); c.lineTo(px0 + step * 0.74, bandY); c.lineTo(px0 + step * 0.26, bandY + bandH); c.closePath(); c.fill(); }
      if ((f.i * 7 + i * 5) % 6 === 0) { c.fillStyle = th[2]; c.globalAlpha = (alpha === undefined ? 1 : alpha) * 0.6; c.fillRect(px0 + scale, bandY, step - 2 * scale, bandH * (0.35 + 0.1 * ((f.i + i) % 3))); c.globalAlpha = alpha === undefined ? 1 : alpha; }
    }
    c.fillStyle = 'rgba(255,255,255,.3)'; for (var tx = -wpx / 2 + 4 * scale; tx < wpx / 2 - 6 * scale; tx += 7 * scale) c.fillRect(tx, -hpx / 2 + 3 * scale, 3.5 * scale, 2 * scale);
    if (f.i % 4 === 2) { c.strokeStyle = 'rgba(29,45,68,.75)'; c.lineWidth = 1.2 * scale; var ry = hpx / 2 - 6 * scale; c.beginPath(); c.moveTo(-wpx / 2 + 2 * scale, ry); c.lineTo(wpx / 2 - 2 * scale, ry); for (var bx = -wpx / 2 + 6 * scale; bx < wpx / 2 - 4 * scale; bx += 6 * scale) { c.moveTo(bx, ry); c.lineTo(bx, ry + 4 * scale); } c.stroke(); }
    if (hs > 0.72 && wpx > 60 * scale) { var ux = -wpx / 2 + (0.12 + hs * 0.6) * wpx; c.fillStyle = '#cfc9b8'; c.fillRect(ux, hpx / 2 - 11 * scale, 11 * scale, 8 * scale); c.fillStyle = '#8f8a7c'; c.beginPath(); c.arc(ux + 5.5 * scale, hpx / 2 - 7 * scale, 2.6 * scale, 0, TAU); c.fill(); c.fillRect(ux, hpx / 2 - 3 * scale, 11 * scale, 1.5 * scale); }
    else if (hs < 0.22 && wpx > 60 * scale) { var px1 = wpx / 2 - (0.2 + hs * 1.6) * 30 * scale; c.fillStyle = '#6b4a35'; c.fillRect(px1, hpx / 2 - 7 * scale, 12 * scale, 4 * scale); c.fillStyle = '#4f8a54'; for (var lf = 0; lf < 4; lf++) { c.beginPath(); c.arc(px1 + (1.5 + lf * 3) * scale, hpx / 2 - (8 + (lf % 2)) * scale, 2.4 * scale, 0, TAU); c.fill(); } }
    var sh = c.createLinearGradient(-wpx / 2, 0, wpx / 2, 0); sh.addColorStop(0, 'rgba(255,240,200,.16)'); sh.addColorStop(0.5, 'rgba(255,255,255,0)'); sh.addColorStop(1, 'rgba(0,0,0,.2)'); c.fillStyle = sh; c.fillRect(-wpx / 2, -hpx / 2, wpx, hpx);
    if (f.i % 6 === 5) { c.fillStyle = th[2]; c.fillRect(-wpx / 2, -hpx / 2, 5 * scale, hpx); c.fillRect(wpx / 2 - 5 * scale, -hpx / 2, 5 * scale, hpx); c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(-wpx / 2, -hpx / 2, 1.5 * scale, hpx); }
    c.fillStyle = 'rgba(0,0,0,.22)'; c.fillRect(-wpx / 2, hpx / 2 - 3 * scale, wpx, 3 * scale);
    c.restore();
  }
  function drawTower(c, w, h, sk, t) {
    var n = st.floors.length;
    for (var i = 0; i < n; i++) { var f = st.floors[i]; drawFloor(c, { x: f.x + swayOff(i, n), w: f.w, i: f.i }, -(i * FH) - FH / 2, sk, w, h); }
    var top = st.floors[n - 1], tp = w2s(top.x + swayOff(n - 1, n), -(n * FH), w, h); c.strokeStyle = CREAM; c.lineWidth = 2 * scale; c.beginPath(); c.moveTo(tp.x, tp.y); c.lineTo(tp.x, tp.y - 24 * scale); c.stroke();
    c.fillStyle = CORAL; c.beginPath(); c.moveTo(tp.x, tp.y - 24 * scale); c.lineTo(tp.x + (22 + st.wind * 18) * scale, tp.y - 19 * scale + Math.sin(t * 7) * 2 * scale); c.lineTo(tp.x, tp.y - 13 * scale); c.closePath(); c.fill();
    var tw = top.w * scale, tkx = tp.x - tw * 0.28, tky = tp.y; c.fillStyle = sk.night > 0.5 ? '#2c3e57' : '#8b5e3c'; c.fillRect(tkx - 9 * scale, tky - 16 * scale, 18 * scale, 14 * scale); c.fillStyle = sk.night > 0.5 ? '#1f2d44' : '#6b4429'; c.beginPath(); c.moveTo(tkx - 11 * scale, tky - 16 * scale); c.lineTo(tkx, tky - 24 * scale); c.lineTo(tkx + 11 * scale, tky - 16 * scale); c.closePath(); c.fill(); c.fillStyle = NAVY; c.fillRect(tkx - 8 * scale, tky - 8 * scale, 16 * scale, 1.6 * scale); c.fillRect(tkx - 7 * scale, tky - 2 * scale, 2 * scale, 4 * scale); c.fillRect(tkx + 5 * scale, tky - 2 * scale, 2 * scale, 4 * scale);
    if (sk.night > 0.25) { c.fillStyle = 'rgba(238,108,77,' + (0.35 + 0.65 * (Math.sin(t * 4) > 0 ? 1 : 0.15)) + ')'; c.beginPath(); c.arc(tp.x, tp.y - 25 * scale, 2.6 * scale, 0, TAU); c.fill(); }
    if (st.crate) { var cp2 = w2s(st.crate.x, -(n * FH) - 16 + Math.sin(t * 3) * 3, w, h), cs = 13 * scale; c.fillStyle = 'rgba(255,226,150,.35)'; c.beginPath(); c.arc(cp2.x, cp2.y, cs * 1.7, 0, TAU); c.fill(); c.fillStyle = '#9c6b34'; c.fillRect(cp2.x - cs, cp2.y - cs * 0.8, cs * 2, cs * 1.6); c.fillStyle = MUST; c.fillRect(cp2.x - cs, cp2.y - cs * 0.15, cs * 2, cs * 0.3); c.fillRect(cp2.x - cs * 0.15, cp2.y - cs * 0.8, cs * 0.3, cs * 1.6); c.strokeStyle = NAVY; c.lineWidth = 1.5 * scale; c.strokeRect(cp2.x - cs, cp2.y - cs * 0.8, cs * 2, cs * 1.6); }
    st.perfectFx.forEach(function (fx) { var p = w2s(fx.x, fx.y, w, h); c.strokeStyle = rgb([233, 180, 76], 1 - fx.t); c.lineWidth = 3 * scale * (1 - fx.t); c.strokeRect(p.x - fx.w * scale / 2 - fx.t * 14 * scale, p.y - FH * scale / 2 - fx.t * 8 * scale, fx.w * scale + fx.t * 28 * scale, FH * scale + fx.t * 16 * scale); });
  }
  function craneYDraw() { return -(st.floors.length * FH) - 210; }
  var TYPETAG = { glass: ['GLASS: WIDE ZONE', '#bfe6f0'], girder: ['GIRDER: +COINS', '#e9b44c'], balcony: ['BALCONY: RISKY', '#f4a261'], penthouse: ['PENTHOUSE', '#e76f51'] };
  function drawBird(c, w, h, t) {
    if (!st.bird) { st.birdS = null; return; }
    var k = st.bird.t / 4.5, bx = -40 + k * (w + 80), by = h * 0.26 + Math.sin(t * 3 + k * 6) * 14 * scale, fl = Math.sin(t * 14) * 7 * scale, bs = 17 * scale; st.birdS = { x: bx, y: by };
    c.save(); c.translate(bx, by); c.fillStyle = 'rgba(255,226,150,' + (0.25 + 0.15 * Math.sin(t * 8)) + ')'; c.beginPath(); c.arc(0, 0, bs * 2.1, 0, TAU); c.fill(); c.fillStyle = '#e9b44c'; c.beginPath(); c.ellipse(0, 0, bs, bs * 0.6, 0, 0, TAU); c.fill(); c.strokeStyle = NAVY; c.lineWidth = 2 * scale; c.stroke(); c.fillStyle = '#f4d58d'; c.beginPath(); c.moveTo(-bs * 0.2, -bs * 0.1); c.quadraticCurveTo(-bs * 0.5, -bs * 1.3 - fl, bs * 0.7, -bs * 0.2); c.closePath(); c.fill(); c.stroke(); c.fillStyle = NAVY; c.beginPath(); c.arc(bs * 0.55, -bs * 0.12, bs * 0.12, 0, TAU); c.fill(); c.fillStyle = CORAL; c.beginPath(); c.moveTo(bs * 0.95, -bs * 0.05); c.lineTo(bs * 1.5, bs * 0.08); c.lineTo(bs * 0.95, bs * 0.2); c.closePath(); c.fill(); c.restore();
  }
  function drawCrane(c, w, h, sk) {
    var ay = h * 0.62 + (craneYDraw() - st.camY) * scale, steel = sk.night > 0.5 ? '#8da9c4' : NAVY;
    c.fillStyle = steel; c.fillRect(-10, ay - 10 * scale, w + 20, 3 * scale); c.fillRect(-10, ay, w + 20, 3 * scale);
    c.strokeStyle = steel; c.lineWidth = 2 * scale; c.beginPath(); for (var x = -10; x < w + 20; x += 18 * scale) { c.moveTo(x, ay); c.lineTo(x + 9 * scale, ay - 9 * scale); c.lineTo(x + 18 * scale, ay); } c.stroke();
    var tx = w / 2 + (st.falling ? st.falling.x : st.x) * scale; c.fillStyle = MUST; c.fillRect(tx - 14 * scale, ay - 4 * scale, 28 * scale, 12 * scale); c.fillStyle = NAVY; c.fillRect(tx - 14 * scale, ay + 6 * scale, 28 * scale, 3 * scale);
    if (!st.falling && st.cur && !st.over) { var by = h * 0.62 + (craneY() - st.camY) * scale, sw = Math.cos(st.ph) * 0.04 * (st.wind + 1); c.strokeStyle = steel; c.lineWidth = 1.5 * scale; c.beginPath(); c.moveTo(tx, ay + 9 * scale); c.lineTo(tx - st.cur.w * scale * 0.45 + sw * 20, by - FH * scale / 2); c.moveTo(tx, ay + 9 * scale); c.lineTo(tx + st.cur.w * scale * 0.45 + sw * 20, by - FH * scale / 2); c.stroke(); drawFloor(c, { x: st.x, w: st.cur.w, i: st.cur.i }, craneY(), sk, w, h, 1, sw); var tg = TYPETAG[st.cur.type]; if (tg) { c.save(); c.font = '700 ' + 13 * scale + 'px "DM Sans", sans-serif'; c.textAlign = 'center'; var tw2 = c.measureText(tg[0]).width + 14 * scale; tx = Math.max(tw2 / 2 + 6, Math.min(w - tw2 / 2 - 6, tx)); c.fillStyle = NAVY; c.fillRect(tx - tw2 / 2 + 2, by - FH * scale - 11 * scale + 2, tw2, 17 * scale); c.fillStyle = tg[1]; c.fillRect(tx - tw2 / 2, by - FH * scale - 11 * scale, tw2, 17 * scale); c.fillStyle = NAVY; c.fillText(tg[0], tx, by - FH * scale + 1.5 * scale); c.restore(); } }
    if (st.falling) drawFloor(c, { x: st.falling.x, w: st.falling.w, i: st.falling.i }, st.falling.y, sk, w, h);
  }

  /* ---------- theme: poster cards and flat print buttons ---------- */
  PG.theme.font = 'Bebas Neue'; PG.theme.body = 'DM Sans'; PG.theme.weight = '400'; PG.theme.bodyWeight = '700'; PG.theme.text = NAVY; PG.theme.textShadow = false; PG.theme.pageColor = NAVY;
  PG.theme.reverb = 0.12; PG.theme.reverbTime = 0.8;
  PG.theme.transition = { style: 'bands', color: NAVY, time: 0.4 };
  PG.theme.popStyle = { stroke: NAVY };
  PG.theme.button = function (c, x, y, w, h, label, o, s) {
    var col = o.disabled ? '#b8b0a0' : o.color || CORAL, off = s.press ? 3 : 0; c.fillStyle = NAVY; U.rr(c, x + 4, y + 4, w, h, 6); c.fill();
    c.fillStyle = s.hover ? U.shade(col, 0.1) : col; U.rr(c, x + off, y + off, w, h, 6); c.fill(); c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(x + off + 6, y + off + 5, w - 12, 2);
    if (label) { var txt = o.textColor || ((col === CREAM || col === MUST || col === '#b8b0a0') ? NAVY : CREAM); U.text(c, label.toUpperCase(), x + w / 2 + off, y + h / 2 + off + 1, U.fit(c, label.toUpperCase(), o.size || Math.min(h * 0.55, 30), w - 16, { spacing: 1.5 }), txt, 'center', { shadow: false, spacing: 1.5 }); }
  };
  PG.theme.panel = function (c, x, y, w, h, o) { c.fillStyle = NAVY; c.fillRect(x + 7, y + 7, w, h); c.fillStyle = CREAM; c.fillRect(x, y, w, h); c.fillStyle = (o && o.band) || TEAL; c.fillRect(x, y, w, Math.min(52 * PG.scale(), h * 0.18)); c.strokeStyle = NAVY; c.lineWidth = 3; c.strokeRect(x, y, w, h); c.lineWidth = 1; c.strokeRect(x + 6, y + 6, w - 12, h - 12); };
  PG.theme.hudButton = function (c, x, y, r, kind) { c.fillStyle = NAVY; c.beginPath(); c.arc(x + 2, y + 2, r, 0, TAU); c.fill(); c.fillStyle = CREAM; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); PG.hudIcon(c, x, y, r * 0.95, kind, NAVY); };
  PG.theme.loading = function (c, w, h, t) { c.fillStyle = NAVY; c.fillRect(0, 0, w, h); for (var i = 0; i < 4; i++) { var k = Math.min(1, Math.max(0, (t * 1.6 - i * 0.25) % 2.2)); c.fillStyle = [CORAL, MUST, TEAL, CREAM][i]; c.fillRect(w / 2 - 30, h / 2 + 30 - i * 14 - (1 - k) * 0, 60 * k, 12); } };
  function poster(c, s, x, y, size, col, sh, align) { U.text(c, s, x + size * 0.05, y + size * 0.06, size, sh || NAVY, align || 'center', { shadow: false, spacing: size * 0.04 }); U.text(c, s, x, y, size, col, align || 'center', { shadow: false, spacing: size * 0.04 }); }
  function coinIcon(c, x, y, r) { c.fillStyle = NAVY; c.beginPath(); c.arc(x + 1.5, y + 1.5, r, 0, TAU); c.fill(); c.fillStyle = MUST; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.fillStyle = CREAM; c.fillRect(x - r * 0.12, y - r * 0.55, r * 0.24, r * 1.1); }

  /* ---------- screens ---------- */
  function drawTags(c, w, h, sc) {
    var y = 82 * sc, put = function (s, col) { U.text(c, s, 16 * sc, y, U.fit(c, s, 12 * sc, 150 * sc, { font: 'body' }), col, 'left', { font: 'body', shadow: false, stroke: 'rgba(29,45,68,.65)', strokeWidth: 3 }); y += 17 * sc; };
    if (st.mod !== 'normal') put(st.modName, MUST);
    if (st.challenge) { var nn = st.floors.length - 1; put('DAILY: ' + st.challenge.text + ' (' + Math.floor(metric(st.challenge.kind, nn)) + '/' + st.challenge.target + ')', '#bfe6f0'); }
    if (st.slowT > 0) put('SLOW-MO ' + st.slowT.toFixed(1) + 's', '#b5e48c'); if (st.wideNext) put('NEXT FLOOR WIDER', '#b5e48c'); if (st.magnet > 0) put('MAGNET READY', '#b5e48c');
    if (st.evt) put(({ stutter: 'CRANE STUTTER', storm: 'STORM', swap: 'CRANE SWAP' })[st.evt.type] + ' ' + st.evt.left, '#f4a261');
  }
  function drawHUD(c, w, h) {
    var sc = PG.scale(); drawTags(c, w, h, sc); poster(c, '' + (st.floors.length - 1), w / 2, 66 * sc, 76 * sc, CREAM); U.text(c, 'BEST ' + (PG.save.best || 0), w / 2, 108 * sc, 13 * sc, CREAM, 'center', { font: 'body', shadow: false, stroke: 'rgba(29,45,68,.6)', strokeWidth: 3 });
    coinIcon(c, 24 * sc, 26 * sc, 10 * sc); poster(c, '' + Math.round(st.coinsRun * 10) / 10, 40 * sc, 28 * sc, 24 * sc, CREAM, NAVY, 'left'); if (st.netLeft > 0) U.text(c, 'NET x' + st.netLeft, 16 * sc, 54 * sc, 12 * sc, '#b5e48c', 'left', { font: 'body', shadow: false, stroke: 'rgba(29,45,68,.6)', strokeWidth: 3 });
    if (Math.abs(st.wind) > 0.12) { var dir = st.wind > 0 ? 1 : -1; c.save(); c.translate(w / 2, 136 * sc); c.fillStyle = CREAM; for (var i = 0; i < 3; i++) { var ax = dir * (i * 16 + (st.t * 40 % 16)) * sc; c.beginPath(); c.moveTo(ax - 6 * dir * sc, -6 * sc); c.lineTo(ax + 6 * dir * sc, 0); c.lineTo(ax - 6 * dir * sc, 6 * sc); c.fill(); } c.restore(); U.text(c, 'WIND', w / 2, 154 * sc, 12 * sc, CREAM, 'center', { font: 'body', shadow: false }); }
    if (st.banner) { var k = Math.min(1, st.banner.t * 4) * Math.min(1, (2 - st.banner.t) * 3), bw = 250 * sc; c.globalAlpha = Math.max(0, k); c.fillStyle = NAVY; c.fillRect(w / 2 - bw / 2 + 5, h * 0.3 - 26 * sc + 5, bw, 52 * sc); c.fillStyle = MUST; c.fillRect(w / 2 - bw / 2, h * 0.3 - 26 * sc, bw, 52 * sc); U.text(c, st.banner.s, w / 2, h * 0.3 + 2, U.fit(c, st.banner.s, 38 * sc, bw - 20 * sc, { spacing: 3 }), NAVY, 'center', { shadow: false, spacing: 3 }); c.globalAlpha = 1; }
    if (st.tut && st.floors.length < 3) { var tw = Math.min(w * 0.8, 260 * sc); c.fillStyle = NAVY; c.fillRect(w / 2 - tw / 2, h * 0.86 - 20 * sc, tw, 40 * sc); U.text(c, 'TAP TO DROP THE FLOOR', w / 2, h * 0.86 + 1, 24 * sc, CREAM, 'center', { shadow: false, spacing: 2 }); }
  }
  function drawOver(c, w, h) {
    var sc = PG.scale(), k = PG.ease.out(Math.min(1, Math.max(0, st.overT - 0.4) * 2)); if (k <= 0) return; c.fillStyle = 'rgba(13,27,42,' + 0.5 * k + ')'; c.fillRect(0, 0, w, h);
    var canRev = !st.revUsed && PG.rewardedSupported() && st.floors.length > 6, canDbl = !st.doubled && st.coinsRun >= 3 && PG.rewardedSupported(), pw = Math.min(w * 0.88, 370 * sc), ph = (324 + (canRev ? 56 : 0) + (canDbl ? 56 : 0)) * sc, px = w / 2 - pw / 2, py = Math.max(10 * sc, h * 0.5 - ph / 2) + (1 - k) * 60;
    U.panel(c, px, py, pw, ph, { band: CORAL }); U.text(c, 'TOPPED OUT', w / 2, py + 27 * sc, 34 * sc, CREAM, 'center', { shadow: false, spacing: 3 });
    poster(c, (st.floors.length - 1) + ' FLOORS', w / 2, py + 96 * sc, 54 * sc, TEAL); U.text(c, st.newBest ? 'NEW BEST!' : 'Best ' + (PG.save.best || 0), w / 2, py + 136 * sc, 15 * sc, st.newBest ? CORAL : '#5c677d', 'center', { font: 'body', shadow: false });
    U.text(c, st.note || (st.perfects + ' perfect drops  ·  ' + st.modName), w / 2, py + 158 * sc, U.fit(c, st.note || (st.perfects + ' perfect drops  ·  ' + st.modName), 13 * sc, pw - 30 * sc, { font: 'body' }), st.note ? CORAL : '#5c677d', 'center', { font: 'body', shadow: false });
    coinIcon(c, w / 2 - 44 * sc, py + 188 * sc, 11 * sc); poster(c, '+' + (Math.round(st.coinsRun * 10) / 10) + (st.doubled ? ' (x2)' : ''), w / 2 - 26 * sc, py + 190 * sc, 30 * sc, MUST, NAVY, 'left');
    var bw = pw * 0.82, bh = 48 * sc, yy = py + 216 * sc;
    if (canRev) { if (U.button(c, w / 2 - bw / 2, yy, bw, bh, 'Ad: keep building', { color: TEAL, size: 24 * sc })) PG.rewarded('continue').then(function (ok) { if (ok) revive(); }); yy += bh + 10 * sc; }
    if (canDbl) { if (U.button(c, w / 2 - bw / 2, yy, bw, bh, 'Ad: double coins', { color: TEAL, size: 24 * sc })) { var e = st.coinsRun; PG.rewarded('bonus').then(function (ok) { if (ok) { PG.save.coins += e; st.coinsRun += e; st.paid = st.coinsRun; st.doubled = true; PG.commit(true); } }); } yy += bh + 10 * sc; }
    if (U.button(c, w / 2 - bw / 2, yy, bw, bh, 'Build again', { color: CORAL, size: 26 * sc })) PG.adBreak('game_over').then(function () { PG.go(startRun); });
    if (U.button(c, w / 2 - bw / 2, yy + bh + 10 * sc, bw / 2 - 5 * sc, bh * 0.8, 'Upgrades', { color: MUST, size: 20 * sc })) PG.go(function () { st.state = 'shop'; PG.track('shop_opened', { source: 'game_over' }); });
    if (U.button(c, w / 2 + 5 * sc, yy + bh + 10 * sc, bw / 2 - 5 * sc, bh * 0.8, 'Menu', { color: CREAM, size: 20 * sc })) PG.go(toMenu);
  }
  function toMenu() { st.state = 'menu'; st.over = false; st.floors = [{ x: 0, w: BASE_W, i: 0 }]; st.cur = null; st.camY = 0; st.cut = []; }
  function drawShop(c, w, h) {
    var sc = PG.scale(); c.fillStyle = 'rgba(13,27,42,.6)'; c.fillRect(0, 0, w, h);
    var rows = UPS.filter(function (u) { return u.tab === st.tab; }), pw = Math.min(w * 0.94, 440 * sc), rowH = 60 * sc, ph = 70 * sc + 44 * sc + rows.length * rowH + 70 * sc, px = w / 2 - pw / 2, py = Math.max(12 * sc, (h - ph) / 2);
    U.panel(c, px, py, pw, ph);
    U.text(c, 'UPGRADES', px + 22 * sc, py + 27 * sc, 32 * sc, CREAM, 'left', { shadow: false, spacing: 3 }); coinIcon(c, px + pw - 84 * sc, py + 26 * sc, 10 * sc); U.text(c, PG.fmt(PG.save.coins || 0), px + pw - 68 * sc, py + 28 * sc, 26 * sc, CREAM, 'left', { shadow: false });
    var tw = (pw - 28 * sc - 3 * 6 * sc) / 4;
    TABS.forEach(function (tn, ti) {
      var aff = UPS.some(function (u) { return u.tab === ti && PG.upLevel(u.id) < u.max && (PG.save.coins || 0) >= PG.upCost(u.base, u.grow, PG.upLevel(u.id)); });
      if (U.button(c, px + 14 * sc + ti * (tw + 6 * sc), py + 60 * sc, tw, 32 * sc, tn + (aff ? ' •' : ''), { color: ti === st.tab ? CORAL : CREAM, size: 15 * sc })) st.tab = ti;
    });
    rows.forEach(function (u, i) { var y = py + 104 * sc + i * rowH, L = PG.upLevel(u.id), cost = PG.upCost(u.base, u.grow, L), maxed = L >= u.max;
      U.text(c, u.n.toUpperCase(), px + 22 * sc, y + 17 * sc, 22 * sc, NAVY, 'left', { shadow: false, spacing: 1 }); U.text(c, u.d, px + 22 * sc, y + 37 * sc, U.fit(c, u.d, 12 * sc, pw - 150 * sc, { font: 'body' }), '#5c677d', 'left', { font: 'body', shadow: false });
      for (var k = 0; k < u.max; k++) { c.fillStyle = k < L ? CORAL : 'rgba(29,45,68,.15)'; c.fillRect(px + 22 * sc + k * 12 * sc, y + 48 * sc, 9 * sc, 4 * sc); }
      var bw = 96 * sc, bh = 40 * sc, bx = px + pw - bw - 20 * sc; if (maxed) poster(c, 'MAX', bx + bw / 2, y + 26 * sc, 26 * sc, TEAL); else if (U.button(c, bx, y + 8 * sc, bw, bh, '' + cost, { color: (PG.save.coins || 0) >= cost ? MUST : '#b8b0a0', size: 24 * sc })) PG.buyUp(u.id, cost, u.max); });
    var minCost = 1e9; UPS.forEach(function (u) { if (PG.upLevel(u.id) < u.max) minCost = Math.min(minCost, PG.upCost(u.base, u.grow, PG.upLevel(u.id))); });
    var gift = Math.max(10, Math.round(minCost * 0.6)), canGift = minCost < 1e9 && PG.canOffer('shop', 60000);
    if (canGift) {
      if (U.button(c, px + 18 * sc, py + ph - 56 * sc, pw / 2 - 24 * sc, 42 * sc, 'Back', { color: TEAL, size: 22 * sc })) PG.go(function () { st.state = 'menu'; });
      if (U.button(c, px + pw / 2 + 6 * sc, py + ph - 56 * sc, pw / 2 - 24 * sc, 42 * sc, 'Ad: +' + gift, { color: CORAL, size: 22 * sc })) { PG.markOffer('shop'); PG.freeCoins(gift, 'shop_coins').then(function (ok) { if (ok) PG.popText(w / 2, py + 30 * sc, '+' + gift + ' coins', NAVY, 26); }); }
    } else if (U.button(c, w / 2 - 80 * sc, py + ph - 56 * sc, 160 * sc, 42 * sc, 'Back', { color: TEAL, size: 24 * sc })) PG.go(function () { st.state = 'menu'; });
  }
  function drawMenu(c, w, h, t) {
    var sc = PG.scale(), land = w > h, cx = land ? w * 0.28 : w / 2, ty = land ? h * 0.18 : h * 0.11, bw = Math.min(land ? w * 0.4 : w * 0.82, 330 * sc), big = Math.min(92 * sc, bw * 0.3);
    c.fillStyle = NAVY; c.fillRect(cx - bw / 2 + 6, ty - big * 0.5 + 6, bw, big * 1.02); c.fillStyle = CREAM; c.fillRect(cx - bw / 2, ty - big * 0.5, bw, big * 1.02); U.text(c, 'SKYLINE', cx, ty + big * 0.03, big, NAVY, 'center', { shadow: false, spacing: big * 0.06 });
    poster(c, 'SNAP', cx, ty + big * 1.05, big * 1.15, CORAL); U.text(c, 'BUILD  TO  THE  STARS', cx, ty + big * 1.75, 13 * sc, CREAM, 'center', { font: 'body', shadow: false, spacing: 3, stroke: 'rgba(29,45,68,.5)', strokeWidth: 3 });
    var bh = 58 * sc, b2 = Math.min(240 * sc, w * 0.66), bx = land ? w * 0.72 - b2 / 2 : w / 2 - b2 / 2, y0 = land ? h * 0.32 : h * 0.68;
    if (!st.nextMod) st.nextMod = PG.save.runs ? rollMod(st.lastMod) : MODS[0];
    if (U.button(c, bx, y0, b2, bh, 'Build!', { color: CORAL, size: 34 * sc })) PG.go(startRun);
    U.text(c, 'TODAY: ' + st.nextMod.n + (st.nextMod.id === 'normal' ? '' : ' - ' + MODINFO[st.nextMod.id]), bx + b2 / 2, y0 - 12 * sc, U.fit(c, 'TODAY: ' + st.nextMod.n + ' - ' + MODINFO[st.nextMod.id], 12 * sc, Math.min(w * 0.94, 340 * sc), { font: 'body' }), CREAM, 'center', { font: 'body', shadow: false, stroke: 'rgba(29,45,68,.65)', strokeWidth: 3 });
    if (PG.save.runs && !st.rerolled && PG.canOffer('boost', 0)) { if (PG.adChip(c, bx - 34 * sc, y0 + bh / 2 - 8 * sc, 22 * sc, 'REROLL', CORAL, t)) PG.rewarded('boost').then(function (ok) { if (ok) { st.nextMod = rollMod(st.nextMod.id); st.rerolled = true; PG.sfx('upgrade'); PG.track('rewarded_boost', { game: 'skyline_reroll' }); } }); }
    if (!st.boost && PG.canOffer('boost', 0)) { if (PG.adChip(c, bx + b2 + 34 * sc, y0 + bh / 2 - 8 * sc, 22 * sc, 'SAFETY NETS', TEAL, t)) PG.rewarded('boost').then(function (ok) { if (ok) { st.boost = 1; PG.sfx('upgrade'); PG.track('rewarded_boost', { game: 'skyline' }); } }); }
    else if (st.boost) U.text(c, 'NETS READY', bx + b2 + 34 * sc, y0 + bh / 2, 13 * sc, '#b5e48c', 'center', { font: 'body', shadow: false, stroke: 'rgba(29,45,68,.6)', strokeWidth: 3 });
    var dd = dailyDef(), ddDone = PG.save.dcDone === dd.day, hw = (b2 - 8 * sc) / 2;
    if (U.button(c, bx, y0 + bh + 12 * sc, hw, bh * 0.8, 'Upgrades', { color: MUST, size: 20 * sc })) PG.go(function () { st.state = 'shop'; PG.track('shop_opened', { source: 'menu' }); });
    if (U.button(c, bx + hw + 8 * sc, y0 + bh + 12 * sc, hw, bh * 0.8, ddDone ? 'Done today' : 'Challenge', { color: ddDone ? '#b8b0a0' : TEAL, size: 20 * sc, disabled: ddDone })) { st.forceMod = dd.mod; st.nextChallenge = dd; PG.go(startRun); }
    if (!ddDone) U.text(c, dd.text, bx + hw + 8 * sc + hw / 2, y0 + bh + 12 * sc + bh * 0.8 + 11 * sc, 11 * sc, '#bfe6f0', 'center', { font: 'body', shadow: false, stroke: 'rgba(29,45,68,.65)', strokeWidth: 3 });
    var ly = y0 + bh * 1.8 + 36 * sc; coinIcon(c, bx + b2 / 2 - 40 * sc, ly, 10 * sc); poster(c, PG.fmt(PG.save.coins || 0), bx + b2 / 2 - 24 * sc, ly + 2, 26 * sc, CREAM, NAVY, 'left'); U.text(c, 'Best ' + (PG.save.best || 0) + ' floors', bx + b2 / 2, ly + 26 * sc, 13 * sc, CREAM, 'center', { font: 'body', shadow: false, stroke: 'rgba(29,45,68,.6)', strokeWidth: 3 });
    PG.dailyGift(c, bx, ly + 48 * sc, b2, 42 * sc, 8, { color: TEAL, size: 20 * sc });
    U.text(c, 'Audio: CC0 recordings, OpenGameArt', w / 2, h - 14 * sc, 11 * sc, 'rgba(244,233,208,.75)', 'center', { font: 'body', shadow: false });
  }
  function render(c, w, h) {
    scale = PG.clamp(Math.min(w / VW, h / 700) * 1.05, 0.7, 2.2); var t = PG.time, sk = drawSky(c, w, h, t); drawCity(c, w, h, sk);
    c.save(); if (st.shake > 0.2) c.translate((Math.random() - 0.5) * st.shake, (Math.random() - 0.5) * st.shake);
    var gp = w2s(0, 0, w, h); c.fillStyle = NAVY; c.fillRect(gp.x - 120 * scale, gp.y, 240 * scale, 12 * scale); c.fillStyle = MUST; c.fillRect(gp.x - 120 * scale, gp.y, 240 * scale, 3 * scale);
    // site hoarding, cones, brick pile and a waving site worker flank the base of the tower
    [-1, 1].forEach(function (sd) { var fx = gp.x + sd * 150 * scale; c.fillStyle = sk.night > 0.5 ? '#3c4a5e' : '#c9a15a'; for (var pn = 0; pn < 3; pn++) { var px2 = fx + sd * pn * 30 * scale - 14 * scale; c.fillRect(px2, gp.y - 20 * scale, 28 * scale, 22 * scale); c.fillStyle = 'rgba(29,45,68,.35)'; c.fillRect(px2, gp.y - 20 * scale, 3 * scale, 22 * scale); c.fillStyle = sk.night > 0.5 ? '#3c4a5e' : '#c9a15a'; }
      c.fillStyle = '#e76f51'; c.beginPath(); c.moveTo(gp.x + sd * 128 * scale, gp.y); c.lineTo(gp.x + sd * 128 * scale - 5 * scale, gp.y); c.lineTo(gp.x + sd * 128 * scale - 2 * scale, gp.y - 13 * scale); c.lineTo(gp.x + sd * 128 * scale + 1 * scale, gp.y - 13 * scale); c.lineTo(gp.x + sd * 128 * scale + 5 * scale, gp.y); c.closePath(); c.fill(); c.fillStyle = '#fff'; c.fillRect(gp.x + sd * 128 * scale - 3.4 * scale, gp.y - 8 * scale, 6.4 * scale, 2 * scale); });
    c.fillStyle = '#9c4a3a'; for (var bk = 0; bk < 6; bk++) c.fillRect(gp.x - 112 * scale + (bk % 3) * 11 * scale, gp.y - 5 * scale - Math.floor(bk / 3) * 5 * scale, 10 * scale, 4.5 * scale);
    var wx2 = gp.x + 98 * scale, wave = Math.sin(t * 6) * (st.flash > 0.1 ? 1 : 0.15); c.fillStyle = '#1d2d44'; c.fillRect(wx2 - 3 * scale, gp.y - 14 * scale, 6 * scale, 14 * scale); c.fillStyle = '#e9c46a'; c.beginPath(); c.arc(wx2, gp.y - 18 * scale, 3.4 * scale, Math.PI, 0); c.fill(); c.fillRect(wx2 - 4.2 * scale, gp.y - 18 * scale, 8.4 * scale, 1.4 * scale); c.fillStyle = '#f4a261'; c.beginPath(); c.arc(wx2, gp.y - 16.5 * scale, 2.4 * scale, 0, TAU); c.fill();
    c.strokeStyle = '#1d2d44'; c.lineWidth = 2 * scale; c.lineCap = 'round'; c.beginPath(); c.moveTo(wx2 + 3 * scale, gp.y - 12 * scale); c.lineTo(wx2 + 8 * scale, gp.y - (18 + wave * 6) * scale); c.stroke();
    drawTower(c, w, h, sk, t); if (st.state === 'play') drawCrane(c, w, h, sk);
    st.cut.forEach(function (cp) { drawFloor(c, { x: cp.x, w: cp.w, i: cp.i }, cp.y, sk, w, h, Math.max(0, 1 - cp.t / 2.2), cp.r); });
    c.save(); c.translate(w / 2, h * 0.62 - st.camY * scale); c.scale(scale, scale); PG.drawParts(c); PG.drawPops(c); c.restore(); c.restore();
    if (st.flash > 0.02) { var fg = c.createRadialGradient(w / 2, h * 0.5, h * 0.1, w / 2, h * 0.5, h * 0.75); fg.addColorStop(0, 'rgba(255,244,214,0)'); fg.addColorStop(1, 'rgba(255,226,150,' + st.flash * 0.38 + ')'); c.fillStyle = fg; c.fillRect(0, 0, w, h); }
    if (st.state === 'play') drawBird(c, w, h, t);
    PG.grain(c, w, h, 0.07, { mode: 'multiply' });
    if (st.state === 'menu') drawMenu(c, w, h, t); else if (st.state === 'shop') drawShop(c, w, h); else { drawHUD(c, w, h); if (st.over) drawOver(c, w, h); }
  }
  PG.onDown = function (x, y) { if (st.state !== 'play') return; if (st.bird && st.birdS && Math.hypot(x - st.birdS.x, y - st.birdS.y) < 64 * scale) { st.bird = null; st.goldNext = true; banner('GOLDEN FLOOR'); PG.sfx('coin'); PG.burst(x, y, 14, { colors: ['#e9b44c', '#fff3b0'], g: 120 }); return; } drop(); };
  PG.setup(document.getElementById('c'), update, render);
  window.__sky = { st: st, start: startRun, drop: drop, update: update, gameOver: gameOver, revive: revive, swayOff: swayOff };
  PG.init({ id: 'skyline_snap', version: '1.6.0', defaults: { best: 0, coins: 0, runs: 0, up: {}, muted: false } }).then(function () {
    st.floors = [{ x: 0, w: BASE_W, i: 0 }]; PG.music('menu');
  });
})();
