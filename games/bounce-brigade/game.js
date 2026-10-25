/* BOUNCE BRIGADE - steer an unstoppable bouncing ball through swarms. Survive 10 minutes. Permanent coin upgrades. */
(function () {
  'use strict';
  var U = PG.ui, TAU = 6.2832, ARENA = 760, WIN_T = 600;
  var META = [
    { id: 'hp', n: 'Tough Shell', d: '+12 starting health', max: 10, base: 25, grow: 1.4 },
    { id: 'dmg', n: 'Spiked Armor', d: '+10% ram damage', max: 10, base: 30, grow: 1.45 },
    { id: 'xp', n: 'Quick Learner', d: '+10% experience', max: 8, base: 35, grow: 1.5 },
    { id: 'coin', n: 'Loot Bag', d: '+12% coins', max: 8, base: 40, grow: 1.5 },
    { id: 'rev', n: 'Second Wind', d: 'Revive once per run', max: 2, base: 220, grow: 2.6 }
  ];
  var PERKS = [
    { id: 'ram', n: 'Spiked Ball', d: '+30% ram damage', col: '#ff6b6b', max: 6 },
    { id: 'size', n: 'Heavy Ball', d: 'Bigger, harder knockback', col: '#ffa94d', max: 5 },
    { id: 'blade', n: 'Orbit Blades', d: 'Spinning blades guard you', col: '#74c0fc', max: 6 },
    { id: 'shock', n: 'Wall Shock', d: 'Shockwave when you bounce off walls', col: '#da77f2', max: 5 },
    { id: 'speed', n: 'Rocket Boots', d: '+10% move speed', col: '#69db7c', max: 5 },
    { id: 'magnet', n: 'Gem Magnet', d: 'Bigger pickup radius', col: '#4dabf7', max: 5 },
    { id: 'regen', n: 'Field Medic', d: 'Regenerate health', col: '#ff8787', max: 5 },
    { id: 'buddy', n: 'Brigade Buddy', d: 'A mini bouncer joins you', col: '#ffd43b', max: 5 },
    { id: 'zap', n: 'Chain Zap', d: 'Lightning strikes nearby foes', col: '#fff3bf', max: 6 }
  ];
  var ET = {
    blob: { hp: 7, sp: 66, r: 12, dmg: 6, col: '#e8590c', xp: 1 },
    bat: { hp: 3, sp: 128, r: 9, dmg: 4, col: '#9775fa', xp: 1 },
    brute: { hp: 42, sp: 46, r: 19, dmg: 11, col: '#c2255c', xp: 5 },
    charger: { hp: 16, sp: 58, r: 13, dmg: 9, col: '#2f9e44', xp: 3 },
    boss: { hp: 700, sp: 52, r: 44, dmg: 24, col: '#d9480f', xp: 60 }
  };
  var st = { state: 'menu', t: 0, p: null, en: [], gems: [], coins: [], perks: {}, xp: 0, lvl: 1, need: 6, kills: 0, coinsRun: 0, spawnAcc: 0, shock: [], zaps: [], blades: 0, buddies: [], choices: null, joy: null, shake: 0, dmgNums: [], revived: false, deadT: 0, bossAt: {}, runIdx: 0, doubled: false, won: false, flash: 0, hitStop: 0, banner: null };
  var cam = { x: 0, y: 0 }, scale = 1, stars = []; for (var i = 0; i < 50; i++) stars.push({ x: Math.random(), y: Math.random(), p: Math.random() * 9 });

  function mlv(id) { return PG.upLevel(id); }
  function pk(id) { return st.perks[id] || 0; }
  function maxHp() { return 130 + 12 * mlv('hp'); }
  function newPlayer() { return { x: 0, y: 0, vx: 0, vy: 0, hp: maxHp(), inv: 0, r: 14, face: 0, wob: 0, trail: [], hurt: 0 }; }
  function startRun() {
    st.state = 'play'; st.t = 0; st.p = newPlayer(); st.en = []; st.gems = []; st.coins = []; st.perks = {}; st.xp = 0; st.lvl = 1; st.need = 6; st.kills = 0; st.coinsRun = 0; st.spawnAcc = 0; st.shock = []; st.zaps = []; st.buddies = []; st.dmgNums = []; st.revived = false; st.bossAt = {}; st.doubled = false; st.won = false; st.joy = null; st.banner = null;
    st.runIdx++; PG.playing = true; PG.parts = []; PG.pops = []; cam.x = 0; cam.y = 0; st.zapT = 1;
    PG.track('progression_started', { step_id: 'run', step_index: Math.min(st.runIdx, 50) }); PG.msg('level_started', { level: String(st.runIdx) });
  }
  function pRam() { return 8 * (1 + 0.3 * pk('ram')) * (1 + 0.1 * mlv('dmg')); }
  function pSpeed() { return 250 * (1 + 0.1 * pk('speed')); }
  function pRad() { return 14 * (1 + 0.14 * pk('size')); }

  /* ---------- spawning ---------- */
  function spawnEnemy(type, x, y, hpm) { var d = ET[type]; var e = { t: type, x: x, y: y, vx: 0, vy: 0, hp: d.hp * hpm, mhp: d.hp * hpm, r: d.r, hit: 0, cool: 0, ph: Math.random() * 6, state: 0, st: 0, dead: false, kx: 0, ky: 0 }; st.en.push(e); return e; }
  function edgePoint() { var a = Math.random() * TAU, d = Math.max(PG.w, PG.h) / scale * 0.62 + 40; var x = st.p.x + Math.cos(a) * d, y = st.p.y + Math.sin(a) * d; return { x: PG.clamp(x, -ARENA + 30, ARENA - 30), y: PG.clamp(y, -ARENA + 30, ARENA - 30) }; }
  function director(dt) {
    var m = st.t / 60, hpm = 1 + st.t / 150 + Math.max(0, m - 5) * 0.18;
    st.spawnAcc += dt * (1.6 + st.t / 28 + Math.max(0, m - 6) * 0.8); var cap = 70 + Math.floor(st.t / 5);
    while (st.spawnAcc >= 1 && st.en.length < Math.min(cap, 190)) {
      st.spawnAcc -= 1; var pt = edgePoint(), r = Math.random(), type = 'blob';
      if (m > 0.6 && r < 0.3) type = 'bat'; if (m > 1.5 && r > 0.86) type = 'brute'; if (m > 2.5 && r > 0.72 && r <= 0.86) type = 'charger'; if (m > 6 && r > 0.93) type = 'brute';
      spawnEnemy(type, pt.x, pt.y, hpm);
    }
    st.spawnAcc = Math.min(st.spawnAcc, 12);
    // timed events
    if (m >= 1 && !st.bossAt.ring1) { st.bossAt.ring1 = 1; ring('bat', 22, hpm); banner('Bat swarm!'); }
    if (m >= 3 && !st.bossAt.boss1) { st.bossAt.boss1 = 1; var q = edgePoint(); var b = spawnEnemy('boss', q.x, q.y, hpm * 0.6); b.elite = 1; banner('MINI BOSS'); PG.sfx('boom'); }
    if (m >= 4.5 && !st.bossAt.ring2) { st.bossAt.ring2 = 1; ring('blob', 28, hpm); banner('Surrounded!'); }
    if (m >= 6 && !st.bossAt.boss2) { st.bossAt.boss2 = 1; q = edgePoint(); b = spawnEnemy('boss', q.x, q.y, hpm * 0.9); banner('BOSS'); PG.sfx('boom'); }
    if (m >= 8 && !st.bossAt.ring3) { st.bossAt.ring3 = 1; ring('brute', 14, hpm); banner('Brute ring!'); }
    if (m >= 9 && !st.bossAt.boss3) { st.bossAt.boss3 = 1; q = edgePoint(); b = spawnEnemy('boss', q.x, q.y, hpm * 1.3); banner('FINAL BOSS'); PG.sfx('boom'); }
  }
  function ring(type, n, hpm) { for (var i = 0; i < n; i++) { var a = i / n * TAU, d = Math.max(PG.w, PG.h) / scale * 0.5 + 20; spawnEnemy(type, PG.clamp(st.p.x + Math.cos(a) * d, -ARENA + 25, ARENA - 25), PG.clamp(st.p.y + Math.sin(a) * d, -ARENA + 25, ARENA - 25), hpm); } }
  function banner(s) { st.banner = { s: s, t: 0 }; }

  /* ---------- combat ---------- */
  function hurtEnemy(e, n, kx, ky, kb, crit) {
    if (e.dead) return; e.hp -= n; e.hit = 0.1; e.kx += kx * kb; e.ky += ky * kb; st.dmgNums.push({ x: e.x, y: e.y - e.r, v: Math.round(n), t: 0 });
    if (e.hp <= 0) { e.dead = true; st.kills++; var d = ET[e.t]; var gx = e.x, gy = e.y; for (var i = 0; i < (e.t === 'boss' ? 14 : 1); i++) st.gems.push({ x: gx + PG.rand(-12, 12), y: gy + PG.rand(-12, 12), v: d.xp / (e.t === 'boss' ? 14 : 1) * (1 + 0.1 * mlv('xp')), ph: Math.random() * 6, t: 0 }); if (Math.random() < (e.t === 'boss' ? 1 : 0.07)) st.coins.push({ x: gx, y: gy, v: e.t === 'boss' ? 12 : 1, ph: 0 }); PG.burst(e.x, e.y, e.t === 'boss' ? 30 : 6, { colors: [d.col, '#fff'], g: 0, min: 40, max: 200, life: 0.5, s0: 2, s1: 5 }); PG.sfx('pop', 0.8 + Math.random() * 0.5); if (e.t === 'boss') { st.shake = 14; st.flash = 0.3; PG.sfx('boom'); } }
  }
  function gainXP(v) { st.xp += v; while (st.xp >= st.need) { st.xp -= st.need; st.lvl++; st.need = Math.round(5 + st.lvl * 4.2); openLevelUp(); } }
  function openLevelUp() {
    var pool = PERKS.filter(function (p) { return pk(p.id) < p.max; }); var ch = []; while (ch.length < 3 && pool.length) { var i = Math.floor(Math.random() * pool.length); ch.push(pool.splice(i, 1)[0]); }
    if (!ch.length) { st.p.hp = Math.min(maxHp(), st.p.hp + 20); return; } st.choices = ch; st.state = 'levelup'; st.luT = 0; PG.sfx('upgrade');
  }
  function pick(p) {
    st.perks[p.id] = pk(p.id) + 1; PG.track('perk_picked', { perk_id: p.id, level: st.perks[p.id], player_level: Math.min(st.lvl, 40) });
    if (p.id === 'blade') st.blades = st.perks.blade + 1; if (p.id === 'buddy') { var a = Math.random() * TAU; st.buddies.push({ x: st.p.x, y: st.p.y, vx: Math.cos(a) * 240, vy: Math.sin(a) * 240, cd: {} }); }
    if (p.id === 'size') st.p.r = pRad(); st.state = 'play'; st.choices = null; PG.sfx('win', 1.3);
  }
  function damagePlayer(n) {
    var p = st.p; if (p.inv > 0) return; p.hp -= n; p.inv = 0.5; p.hurt = 0.25; st.shake = 8; PG.sfx('hit', 0.7); PG.vibrate(25); PG.popText(p.x, p.y - 22, '-' + Math.round(n), '#ff6b6b', 20); st.flash = 0.18;
    if (p.hp <= 0) die();
  }
  function die() {
    if (!st.revived && mlv('rev') > 0) { st.revived = true; st.p.hp = maxHp() * (0.4 + 0.15 * mlv('rev')); st.p.inv = 2; st.en.forEach(function (e) { if (e.t !== 'boss') { var dx = e.x - st.p.x, dy = e.y - st.p.y, d = Math.hypot(dx, dy) || 1; if (d < 300) { e.kx += dx / d * 700; e.ky += dy / d * 700; } } }); PG.sfx('upgrade'); PG.popText(st.p.x, st.p.y - 30, 'Second Wind!', '#9be564', 24); return; }
    finish(false);
  }
  function finish(won) {
    st.state = 'dead'; st.won = won; st.deadT = 0; PG.playing = false; var mins = Math.floor(st.t / 60);
    var bonus = Math.round((st.t / 6 + st.kills / 40) * (1 + 0.12 * mlv('coin'))) + (won ? 120 : 0); st.bonus = bonus; st.coinsRun += bonus; PG.save.coins = (PG.save.coins || 0) + st.coinsRun - 0; PG.save.runs = (PG.save.runs || 0) + 1; PG.save.bestT = Math.max(PG.save.bestT || 0, Math.floor(st.t)); PG.save.kills = (PG.save.kills || 0) + st.kills; PG.commit(true);
    PG.sfx(won ? 'win' : 'lose'); PG.track(won ? 'progression_completed' : 'progression_failed', { step_id: 'run', step_index: Math.min(st.runIdx, 50), minute: mins, level: Math.min(st.lvl, 40), kills: st.kills }); PG.msg(won ? 'level_completed' : 'level_failed', { level: String(st.runIdx) });
  }

  /* ---------- update ---------- */
  function update(dt0) {
    PG.updateParts(dt0); PG.updatePops(dt0); st.shake = Math.max(0, st.shake - dt0 * 30); st.flash = Math.max(0, st.flash - dt0); if (st.banner) { st.banner.t += dt0; if (st.banner.t > 2.4) st.banner = null; }
    if (st.state === 'levelup') { st.luT += dt0; return; }
    if (st.state !== 'play') { if (st.state === 'dead') st.deadT += dt0; return; }
    if (st.hitStop > 0) { st.hitStop -= dt0; return; }
    var dt = dt0, p = st.p; st.t += dt;
    if (st.t >= WIN_T) { finish(true); return; }
    // input
    var ax = 0, ay = 0; if (st.joy) { var dx = PG.input.x - st.joy.x, dy = PG.input.y - st.joy.y, d = Math.hypot(dx, dy); if (d > 8) { var k = Math.min(1, d / 70); ax = dx / d * k; ay = dy / d * k; } }
    if (PG.key('a') || PG.key('arrowleft')) ax -= 1; if (PG.key('d') || PG.key('arrowright')) ax += 1; if (PG.key('w') || PG.key('arrowup')) ay -= 1; if (PG.key('s') || PG.key('arrowdown')) ay += 1;
    var am = Math.hypot(ax, ay); if (am > 1) { ax /= am; ay /= am; }
    p.vx += ax * 1100 * dt; p.vy += ay * 1100 * dt; var sp = Math.hypot(p.vx, p.vy), maxS = pSpeed(); var drag = am > 0.05 ? 0.9 : 0.25; p.vx *= (1 - drag * dt); p.vy *= (1 - drag * dt); sp = Math.hypot(p.vx, p.vy);
    if (sp > maxS) { p.vx *= maxS / sp; p.vy *= maxS / sp; sp = maxS; } if (sp < 100) { var a0 = Math.atan2(p.vy, p.vx); if (sp < 1) a0 = p.face; p.vx = Math.cos(a0) * 100; p.vy = Math.sin(a0) * 100; sp = 100; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.r = pRad(); p.inv = Math.max(0, p.inv - dt); p.hurt = Math.max(0, p.hurt - dt); p.wob += dt * sp * 0.03; p.face = Math.atan2(p.vy, p.vx);
    var bounced = false; if (p.x < -ARENA + p.r) { p.x = -ARENA + p.r; p.vx = Math.abs(p.vx) * 0.97; bounced = true; } if (p.x > ARENA - p.r) { p.x = ARENA - p.r; p.vx = -Math.abs(p.vx) * 0.97; bounced = true; } if (p.y < -ARENA + p.r) { p.y = -ARENA + p.r; p.vy = Math.abs(p.vy) * 0.97; bounced = true; } if (p.y > ARENA - p.r) { p.y = ARENA - p.r; p.vy = -Math.abs(p.vy) * 0.97; bounced = true; }
    if (bounced) { PG.sfx('land', 1.3); p.sq = 1; if (pk('shock') > 0) { st.shock.push({ x: p.x, y: p.y, t: 0, r: 80 + 24 * pk('shock'), dmg: 14 * pk('shock') }); PG.sfx('boom', 1.5); st.shake = Math.max(st.shake, 5); } }
    p.sq = Math.max(0, (p.sq || 0) - dt * 4); p.trail.unshift({ x: p.x, y: p.y }); if (p.trail.length > 14) p.trail.pop();
    p.hp = Math.min(maxHp(), p.hp + (0.5 + 0.7 * pk('regen')) * dt);
    director(dt);
    // enemies
    var ramD = pRam() * Math.max(0.5, sp / 250);
    st.en.forEach(function (e) {
      if (e.dead) return; var d = ET[e.t], dx = p.x - e.x, dy = p.y - e.y, dist = Math.hypot(dx, dy) || 1, nx = dx / dist, ny = dy / dist; e.ph += dt * 6; e.hit = Math.max(0, e.hit - dt); e.cool = Math.max(0, e.cool - dt); e.atk = Math.max(0, (e.atk || 0) - dt);
      var spd = d.sp * (e.t === 'boss' ? 1 : 1 + st.t / 900);
      if (e.t === 'bat') { var w = Math.sin(e.ph * 0.7) * 0.6; e.vx = (nx * Math.cos(w) - ny * Math.sin(w)) * spd; e.vy = (nx * Math.sin(w) + ny * Math.cos(w)) * spd; }
      else if (e.t === 'charger') { e.st += dt; if (e.state === 0 && e.st > 2.2 && dist < 380) { e.state = 1; e.st = 0; e.cx = nx; e.cy = ny; } if (e.state === 1) { e.vx = 0; e.vy = 0; if (e.st > 0.55) { e.state = 2; e.st = 0; } } else if (e.state === 2) { e.vx = e.cx * 360; e.vy = e.cy * 360; if (e.st > 0.7) { e.state = 0; e.st = 0; } } else { e.vx = nx * spd; e.vy = ny * spd; } }
      else { e.vx = nx * spd; e.vy = ny * spd; }
      e.x += (e.vx + e.kx) * dt; e.y += (e.vy + e.ky) * dt; e.kx *= (1 - 7 * dt); e.ky *= (1 - 7 * dt); e.x = PG.clamp(e.x, -ARENA + e.r, ARENA - e.r); e.y = PG.clamp(e.y, -ARENA + e.r, ARENA - e.r);
      if (dist < e.r + p.r) { // ram
        if (e.cool <= 0) { e.cool = 0.16; var kb = 260 * (1 + 0.2 * pk('size')) * (e.t === 'boss' ? 0.25 : e.t === 'brute' ? 0.6 : 1); hurtEnemy(e, ramD, -nx, -ny, kb); PG.sfx('hit', 0.9 + Math.random() * 0.4); st.hitStop = Math.min(0.05, ramD > 20 ? 0.04 : 0.015); p.sq = 0.7;
          var vn = p.vx * nx + p.vy * ny; if (vn > 0) { var rest = e.t === 'boss' || e.t === 'brute' ? 1.5 : 1.0; p.vx -= vn * nx * rest; p.vy -= vn * ny * rest; p.vx -= nx * 40; p.vy -= ny * 40; } p.x -= nx * 2; p.y -= ny * 2; }
        if (!e.dead && e.atk <= 0 && p.inv <= 0 && (e.t !== 'charger' || e.state === 2 || dist < e.r + p.r - 4)) { e.atk = 0.9; damagePlayer(d.dmg * (1 + st.t / 400) * (sp > 170 ? 0.55 : 1)); }
      }
    });
    // separation between enemies (cheap spatial hash)
    var grid = {}; st.en.forEach(function (e) { var k = Math.floor(e.x / 40) + ',' + Math.floor(e.y / 40); (grid[k] = grid[k] || []).push(e); });
    st.en.forEach(function (e) { var cx = Math.floor(e.x / 40), cy = Math.floor(e.y / 40); for (var ox = -1; ox <= 1; ox++) for (var oy = -1; oy <= 1; oy++) { var cell = grid[(cx + ox) + ',' + (cy + oy)]; if (!cell) continue; cell.forEach(function (o) { if (o === e) return; var dx = e.x - o.x, dy = e.y - o.y, d = Math.hypot(dx, dy), md = (e.r + o.r) * 0.8; if (d < md && d > 0.01) { var push = (md - d) * 0.5; e.x += dx / d * push * 0.5; e.y += dy / d * push * 0.5; } }); } });
    // blades
    var nb = st.blades; if (nb > 0) { var brad = 54 + 6 * pk('blade'), ang = st.t * 3.4; for (var i = 0; i < nb; i++) { var a = ang + i / nb * TAU, bx = p.x + Math.cos(a) * brad, by = p.y + Math.sin(a) * brad; st.en.forEach(function (e) { if (e.dead || e.bc > st.t) return; if (Math.hypot(e.x - bx, e.y - by) < e.r + 11) { e.bc = st.t + 0.35; hurtEnemy(e, 6 * (1 + 0.25 * pk('blade')) * (1 + 0.1 * mlv('dmg')), Math.cos(a), Math.sin(a), 120); PG.sfx('hit', 1.5); } }); } }
    // buddies
    st.buddies.forEach(function (b) { b.x += b.vx * dt; b.y += b.vy * dt; if (Math.abs(b.x) > ARENA - 10) { b.vx *= -1; b.x = PG.clamp(b.x, -ARENA + 10, ARENA - 10); } if (Math.abs(b.y) > ARENA - 10) { b.vy *= -1; b.y = PG.clamp(b.y, -ARENA + 10, ARENA - 10); } st.en.forEach(function (e) { if (e.dead || (b.cd[e.ph] || 0) > st.t) return; if (Math.hypot(e.x - b.x, e.y - b.y) < e.r + 9) { b.cd[e.ph] = st.t + 0.3; var dx = e.x - b.x, dy = e.y - b.y, d = Math.hypot(dx, dy) || 1; hurtEnemy(e, 5 * (1 + 0.15 * pk('buddy')) * (1 + 0.1 * mlv('dmg')), dx / d, dy / d, 200); } }); });
    // shockwaves
    for (var s = st.shock.length - 1; s >= 0; s--) { var sw = st.shock[s]; var prev = sw.t; sw.t += dt * 2.6; var rr = sw.r * sw.t; if (!sw.hit) { sw.hit = true; st.en.forEach(function (e) { var d = Math.hypot(e.x - sw.x, e.y - sw.y); if (d < sw.r) { var dx = e.x - sw.x, dy = e.y - sw.y, dd = d || 1; hurtEnemy(e, sw.dmg, dx / dd, dy / dd, 360); } }); } if (sw.t > 1) st.shock.splice(s, 1); }
    // zaps
    if (pk('zap') > 0) { st.zapT -= dt; if (st.zapT <= 0) { st.zapT = Math.max(0.7, 2.4 - 0.25 * pk('zap')); var tg = null, bd = 380; st.en.forEach(function (e) { if (e.dead) return; var d = Math.hypot(e.x - p.x, e.y - p.y); if (d < bd) { bd = d; tg = e; } }); var chain = 2 + pk('zap'), cur = tg, from = { x: p.x, y: p.y }, hitSet = []; while (cur && chain-- > 0) { hurtEnemy(cur, 16 * (1 + 0.2 * pk('zap')) * (1 + 0.1 * mlv('dmg')), 0, 0, 0); st.zaps.push({ x0: from.x, y0: from.y, x1: cur.x, y1: cur.y, t: 0 }); hitSet.push(cur); from = { x: cur.x, y: cur.y }; var nxt = null, nd = 160; st.en.forEach(function (e) { if (e.dead || hitSet.indexOf(e) >= 0) return; var d = Math.hypot(e.x - from.x, e.y - from.y); if (d < nd) { nd = d; nxt = e; } }); cur = nxt; } if (tg) PG.sfx('shoot', 1.6); } }
    st.zaps.forEach(function (z) { z.t += dt; }); st.zaps = st.zaps.filter(function (z) { return z.t < 0.18; });
    // gems & coins
    var mr = 60 + 34 * pk('magnet') + p.r;
    for (var g = st.gems.length - 1; g >= 0; g--) { var gm = st.gems[g]; gm.t += dt; var dx2 = p.x - gm.x, dy2 = p.y - gm.y, d2 = Math.hypot(dx2, dy2); if (d2 < mr) { var pull = 380 + (mr - d2) * 3; gm.x += dx2 / d2 * pull * dt; gm.y += dy2 / d2 * pull * dt; } if (d2 < p.r + 8) { st.gems.splice(g, 1); p.hp = Math.min(maxHp(), p.hp + 0.7); gainXP(gm.v); PG.sfx('coin', 0.7 + Math.min(st.xp / st.need, 1) * 0.8); if (st.state !== 'play') return; } }
    for (g = st.coins.length - 1; g >= 0; g--) { var cn = st.coins[g]; cn.ph += dt; var dx3 = p.x - cn.x, dy3 = p.y - cn.y, d3 = Math.hypot(dx3, dy3); if (d3 < mr * 0.8) { cn.x += dx3 / d3 * 380 * dt; cn.y += dy3 / d3 * 380 * dt; } if (d3 < p.r + 10) { st.coins.splice(g, 1); var v = Math.round(cn.v * (1 + 0.12 * mlv('coin'))); st.coinsRun += v; PG.sfx('coin', 1.3); PG.popText(p.x, p.y - 20, '+' + v, '#ffd23f', 18); } }
    st.en = st.en.filter(function (e) { return !e.dead; }); st.dmgNums.forEach(function (n) { n.t += dt; }); st.dmgNums = st.dmgNums.filter(function (n) { return n.t < 0.7; });
    cam.x += (p.x - cam.x) * Math.min(1, dt * 6); cam.y += (p.y - cam.y) * Math.min(1, dt * 6);
  }

  /* ---------- drawing ---------- */
  function w2s(x, y, w, h) { return { x: (x - cam.x) * scale + w / 2, y: (y - cam.y) * scale + h / 2 }; }
  function drawFloor(c, w, h, t) {
    c.fillStyle = '#0d1530'; c.fillRect(0, 0, w, h);
    var gs = 100 * scale, ox = ((-cam.x * scale + w / 2) % gs + gs) % gs, oy = ((-cam.y * scale + h / 2) % gs + gs) % gs;
    c.strokeStyle = 'rgba(80,120,255,.14)'; c.lineWidth = 1; c.beginPath(); for (var x = ox - gs; x < w + gs; x += gs) { c.moveTo(x, 0); c.lineTo(x, h); } for (var y = oy - gs; y < h + gs; y += gs) { c.moveTo(0, y); c.lineTo(w, y); } c.stroke();
    // outside darkness + arena border
    var tl = w2s(-ARENA, -ARENA, w, h), br = w2s(ARENA, ARENA, w, h);
    c.fillStyle = '#05081a'; c.fillRect(0, 0, w, Math.max(0, tl.y)); c.fillRect(0, Math.min(h, br.y), w, h); c.fillRect(0, 0, Math.max(0, tl.x), h); c.fillRect(Math.min(w, br.x), 0, w, h);
    c.shadowColor = '#4dabf7'; c.shadowBlur = 18; c.strokeStyle = '#74c0fc'; c.lineWidth = 5 * scale; c.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y); c.shadowBlur = 0;
    var vg = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,10,.5)'); c.fillStyle = vg; c.fillRect(0, 0, w, h);
  }
  function drawBall(c, x, y, r, face, o) {
    o = o || {}; c.save(); c.translate(x, y); var sq = o.sq || 0; c.rotate(face); c.scale(1 + sq * 0.2, 1 - sq * 0.2); c.rotate(-face);
    c.fillStyle = 'rgba(0,0,0,.35)'; c.beginPath(); c.ellipse(2, r * 0.7, r, r * 0.5, 0, 0, TAU); c.fill();
    var g = c.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.1, 0, 0, r); g.addColorStop(0, o.c1 || '#8ecbff'); g.addColorStop(1, o.c2 || '#2f6bd1'); c.fillStyle = o.flash ? '#fff' : g; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, r - 1, 0, TAU); c.stroke();
    if (!o.small) { // helmet + eyes look toward movement
      c.fillStyle = '#1c3d7a'; c.beginPath(); c.arc(0, -r * 0.1, r * 0.98, Math.PI * 1.05, Math.PI * 1.95); c.lineTo(r * 0.95, -r * 0.2); c.closePath(); c.fill(); c.fillStyle = '#ffd43b'; c.fillRect(-r * 0.12, -r * 1.0, r * 0.24, r * 0.35);
      var lx = Math.cos(face) * r * 0.2, ly = Math.sin(face) * r * 0.2; [-1, 1].forEach(function (d) { c.fillStyle = '#fff'; c.beginPath(); c.ellipse(d * r * 0.35, r * 0.1, r * 0.22, r * 0.28, 0, 0, TAU); c.fill(); c.fillStyle = '#111'; c.beginPath(); c.arc(d * r * 0.35 + lx * 0.5, r * 0.1 + ly * 0.5, r * 0.11, 0, TAU); c.fill(); });
      c.strokeStyle = '#102a54'; c.lineWidth = 1.8; c.beginPath(); c.arc(0, r * 0.38, r * 0.25, 0.2, 2.9); c.stroke();
    }
    c.restore();
  }
  function drawEnemy(c, e, w, h, t) {
    var s = w2s(e.x, e.y, w, h); if (s.x < -80 || s.x > w + 80 || s.y < -80 || s.y > h + 80) return; var d = ET[e.t], r = e.r * scale; c.save(); c.translate(s.x, s.y);
    c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(1, r * 0.7, r, r * 0.45, 0, 0, TAU); c.fill(); var col = e.hit > 0 ? '#fff' : d.col;
    var sq = 1 + Math.sin(e.ph) * 0.08; c.scale(sq, 2 - sq);
    if (e.t === 'bat') { var fl = Math.sin(e.ph * 3) * 0.6; c.fillStyle = col; [-1, 1].forEach(function (k) { c.save(); c.rotate(k * (0.6 + fl)); c.beginPath(); c.ellipse(k * r * 0.9, 0, r * 0.9, r * 0.4, 0, 0, TAU); c.fill(); c.restore(); }); c.beginPath(); c.arc(0, 0, r * 0.65, 0, TAU); c.fill(); }
    else if (e.t === 'brute') { c.fillStyle = col; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.arc(0, r * 0.2, r * 0.75, 0, Math.PI); c.fill(); c.fillStyle = '#ffe3e3'; c.fillRect(-r * 0.5, r * 0.3, r * 0.2, r * 0.25); c.fillRect(r * 0.3, r * 0.3, r * 0.2, r * 0.25); }
    else if (e.t === 'charger') { c.fillStyle = e.state === 1 ? '#ff6b6b' : col; c.beginPath(); for (var i = 0; i < 3; i++) { var a = i / 3 * TAU - 1.57; c.lineTo(Math.cos(a) * r * 1.2, Math.sin(a) * r * 1.2); } c.closePath(); c.fill(); if (e.state === 1) { c.strokeStyle = 'rgba(255,100,100,.6)'; c.lineWidth = 2; c.setLineDash([6, 6]); c.beginPath(); c.moveTo(0, 0); c.lineTo(e.cx * 250 * scale, e.cy * 250 * scale); c.stroke(); c.setLineDash([]); } }
    else if (e.t === 'boss') { c.fillStyle = col; c.beginPath(); for (i = 0; i < 12; i++) { var a2 = i / 12 * TAU, rr = r * (i % 2 ? 1 : 1.12); c.lineTo(Math.cos(a2) * rr, Math.sin(a2) * rr); } c.closePath(); c.fill(); c.fillStyle = '#ffd43b'; c.beginPath(); c.moveTo(-r * 0.5, -r * 0.85); c.lineTo(-r * 0.3, -r * 1.3); c.lineTo(0, -r * 0.95); c.lineTo(r * 0.3, -r * 1.3); c.lineTo(r * 0.5, -r * 0.85); c.closePath(); c.fill(); }
    else { c.fillStyle = col; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill(); c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.arc(-r * 0.3, -r * 0.35, r * 0.35, 0, TAU); c.fill(); }
    var ex = Math.cos(Math.atan2(st.p.y - e.y, st.p.x - e.x)) * r * 0.12, ey = Math.sin(Math.atan2(st.p.y - e.y, st.p.x - e.x)) * r * 0.12;
    [-1, 1].forEach(function (k) { c.fillStyle = '#fff'; c.beginPath(); c.arc(k * r * 0.34, -r * 0.1, r * 0.22, 0, TAU); c.fill(); c.fillStyle = '#111'; c.beginPath(); c.arc(k * r * 0.34 + ex, -r * 0.1 + ey, r * 0.1, 0, TAU); c.fill(); });
    c.restore();
    if (e.t === 'boss' || e.hp < e.mhp * 0.99 && e.t === 'brute') { var bw = Math.max(26, r * 2); c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(s.x - bw / 2, s.y - r - 12, bw, 5); c.fillStyle = '#ff6b6b'; c.fillRect(s.x - bw / 2, s.y - r - 12, bw * Math.max(0, e.hp / e.mhp), 5); }
  }
  function drawWorld(c, w, h, t) {
    scale = PG.clamp(Math.min(w, h) / 380, 0.7, 2.6);
    c.save(); if (st.shake > 0.2) c.translate((Math.random() - 0.5) * st.shake, (Math.random() - 0.5) * st.shake);
    drawFloor(c, w, h, t);
    st.gems.forEach(function (g) { var s = w2s(g.x, g.y, w, h); if (s.x < -20 || s.x > w + 20 || s.y < -20 || s.y > h + 20) return; var bob = Math.sin(t * 5 + g.ph) * 2; c.fillStyle = '#4dffd2'; c.shadowColor = '#4dffd2'; c.shadowBlur = 8; c.beginPath(); c.moveTo(s.x, s.y - 7 * scale + bob); c.lineTo(s.x + 5 * scale, s.y + bob); c.lineTo(s.x, s.y + 7 * scale + bob); c.lineTo(s.x - 5 * scale, s.y + bob); c.closePath(); c.fill(); c.shadowBlur = 0; });
    st.coins.forEach(function (g) { var s = w2s(g.x, g.y, w, h); U.coin(c, s.x, s.y + Math.sin(t * 5 + g.ph) * 2, 8 * scale); });
    st.en.forEach(function (e) { drawEnemy(c, e, w, h, t); });
    st.shock.forEach(function (sw) { var s = w2s(sw.x, sw.y, w, h); c.strokeStyle = 'rgba(218,119,242,' + (1 - sw.t) + ')'; c.lineWidth = 8 * scale * (1 - sw.t); c.beginPath(); c.arc(s.x, s.y, sw.r * sw.t * scale, 0, TAU); c.stroke(); });
    st.zaps.forEach(function (z) { var a = w2s(z.x0, z.y0, w, h), b = w2s(z.x1, z.y1, w, h); c.strokeStyle = '#fff3bf'; c.shadowColor = '#ffe066'; c.shadowBlur = 12; c.lineWidth = 3; c.beginPath(); c.moveTo(a.x, a.y); for (var i = 1; i < 5; i++) { var k = i / 5; c.lineTo(a.x + (b.x - a.x) * k + (Math.random() - 0.5) * 18, a.y + (b.y - a.y) * k + (Math.random() - 0.5) * 18); } c.lineTo(b.x, b.y); c.stroke(); c.shadowBlur = 0; });
    st.buddies.forEach(function (b) { var s = w2s(b.x, b.y, w, h); drawBall(c, s.x, s.y, 9 * scale, Math.atan2(b.vy, b.vx), { c1: '#ffe066', c2: '#e67700', small: true }); });
    var p = st.p; if (p) {
      var ps = w2s(p.x, p.y, w, h); for (var i = p.trail.length - 1; i >= 1; i -= 2) { var q = w2s(p.trail[i].x, p.trail[i].y, w, h); c.fillStyle = 'rgba(120,190,255,' + (0.28 - i * 0.018) + ')'; c.beginPath(); c.arc(q.x, q.y, p.r * scale * (1 - i / 18), 0, TAU); c.fill(); }
      if (st.blades > 0) { var brad = 54 + 6 * pk('blade'), ang = st.t * 3.4; for (i = 0; i < st.blades; i++) { var a = ang + i / st.blades * TAU, bs = w2s(p.x + Math.cos(a) * brad, p.y + Math.sin(a) * brad, w, h); c.save(); c.translate(bs.x, bs.y); c.rotate(a + t * 8); c.fillStyle = '#e7f5ff'; c.shadowColor = '#74c0fc'; c.shadowBlur = 10; c.beginPath(); c.moveTo(0, -12 * scale); c.lineTo(5 * scale, 0); c.lineTo(0, 12 * scale); c.lineTo(-5 * scale, 0); c.closePath(); c.fill(); c.restore(); } c.shadowBlur = 0; }
      var blink = p.inv > 0 && Math.floor(t * 20) % 2 === 0; if (!blink || p.hp <= 0) drawBall(c, ps.x, ps.y, p.r * scale, p.face, { sq: p.sq, flash: p.hurt > 0.15 });
    }
    PG.drawParts && (function () { c.save(); c.translate(w / 2 - cam.x * scale, h / 2 - cam.y * scale); c.scale(scale, scale); PG.drawParts(c); PG.drawPops(c); c.restore(); })();
    st.dmgNums.forEach(function (n) { var s = w2s(n.x, n.y, w, h); c.globalAlpha = 1 - n.t / 0.7; U.text(c, '' + n.v, s.x, s.y - n.t * 30, 13 * scale + 4, '#fff', 'center', { stroke: 'rgba(0,0,0,.6)', shadow: false }); c.globalAlpha = 1; });
    c.restore();
    if (st.flash > 0) { c.fillStyle = 'rgba(255,60,60,' + st.flash * 0.45 + ')'; c.fillRect(0, 0, w, h); }
  }
  function fmtT(s) { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function drawHUD(c, w, h) {
    var sc = PG.scale(), p = st.p; var bw = Math.min(220 * sc, w * 0.4), bx = 12 * sc, by = 12 * sc;
    c.fillStyle = 'rgba(0,0,0,.5)'; U.rr(c, bx, by, bw, 16 * sc, 8 * sc); c.fill(); c.fillStyle = p.hp / maxHp() > 0.3 ? '#51cf66' : '#ff6b6b'; U.rr(c, bx + 2, by + 2, Math.max(4, (bw - 4) * Math.max(0, p.hp / maxHp())), 12 * sc, 6 * sc); c.fill();
    U.text(c, Math.ceil(p.hp) + '/' + maxHp(), bx + bw / 2, by + 9 * sc, 11 * sc, '#fff', 'center', { shadow: false });
    c.fillStyle = 'rgba(0,0,0,.5)'; U.rr(c, bx, by + 22 * sc, bw, 10 * sc, 5 * sc); c.fill(); c.fillStyle = '#4dffd2'; U.rr(c, bx + 2, by + 24 * sc, Math.max(4, (bw - 4) * st.xp / st.need), 6 * sc, 3 * sc); c.fill();
    U.text(c, 'Lv ' + st.lvl, bx, by + 48 * sc, 16 * sc, '#4dffd2', 'left', { stroke: 'rgba(0,0,0,.5)' }); U.coin(c, bx + 78 * sc, by + 48 * sc, 8 * sc); U.text(c, '' + st.coinsRun, bx + 90 * sc, by + 49 * sc, 15 * sc, '#ffe066', 'left', { stroke: 'rgba(0,0,0,.5)' });
    U.text(c, fmtT(WIN_T - st.t), w * 0.6, 26 * sc, 26 * sc, '#fff', 'center', { stroke: 'rgba(0,0,0,.5)' }); c.save(); c.translate(0, 0); c.restore();
    U.text(c, 'Survive!', w * 0.6, 48 * sc, 12 * sc, '#bcd', 'center', { shadow: false });
    if (st.joy && PG.input.down) { c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 3; c.beginPath(); c.arc(st.joy.x, st.joy.y, 50 * sc, 0, TAU); c.stroke(); var dx = PG.input.x - st.joy.x, dy = PG.input.y - st.joy.y, d = Math.min(Math.hypot(dx, dy), 50 * sc), a = Math.atan2(dy, dx); c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(st.joy.x + Math.cos(a) * d, st.joy.y + Math.sin(a) * d, 20 * sc, 0, TAU); c.fill(); }
    if (st.banner) { var k = Math.min(1, st.banner.t * 4) * Math.min(1, (2.4 - st.banner.t) * 3); c.globalAlpha = k; U.text(c, st.banner.s, w / 2, h * 0.28, 40 * sc, st.banner.s.indexOf('BOSS') >= 0 ? '#ff6b6b' : '#ffd43b', 'center', { stroke: 'rgba(0,0,0,.6)' }); c.globalAlpha = 1; }
    if (st.t < 6 && !PG.save.runs) U.text(c, 'Drag anywhere to steer. Ram the swarm!', w / 2, h * 0.78, 18 * sc, '#fff', 'center', { stroke: 'rgba(0,0,0,.6)' });
  }
  function drawLevelUp(c, w, h) {
    var sc = PG.scale(), k = PG.ease.out(Math.min(1, st.luT * 4)); c.fillStyle = 'rgba(0,5,20,' + 0.65 * k + ')'; c.fillRect(0, 0, w, h);
    U.text(c, 'LEVEL UP!', w / 2, h * 0.2, 42 * sc, '#4dffd2', 'center', { stroke: 'rgba(0,0,0,.5)' }); U.text(c, 'Pick one', w / 2, h * 0.2 + 34 * sc, 16 * sc, '#cde', 'center');
    var n = st.choices.length, portrait = h > w * 0.9, cw = portrait ? Math.min(w * 0.88, 340 * sc) : Math.min(w / n - 20 * sc, 230 * sc), ch = portrait ? 92 * sc : 150 * sc;
    st.choices.forEach(function (p, i) {
      var x = portrait ? w / 2 - cw / 2 : w / 2 - (n * cw + (n - 1) * 14 * sc) / 2 + i * (cw + 14 * sc), y = portrait ? h * 0.34 + i * (ch + 12 * sc) : h * 0.38; var sl = (1 - k) * 40 * (i + 1);
      U.panel(c, x, y + sl, cw, ch, { fill: 'rgba(16,24,52,.95)', stroke: p.col }); c.fillStyle = p.col; c.beginPath(); c.arc(x + 34 * sc, y + sl + ch / 2 - (portrait ? 0 : 20 * sc), 20 * sc, 0, TAU); c.fill(); U.text(c, '' + (pk(p.id) + 1), x + 34 * sc, y + sl + ch / 2 - (portrait ? 0 : 20 * sc), 18 * sc, '#10162f', 'center', { shadow: false });
      if (portrait) { U.text(c, p.n, x + 70 * sc, y + sl + 30 * sc, 20 * sc, '#fff', 'left'); U.text(c, p.d, x + 70 * sc, y + sl + 58 * sc, 14 * sc, '#bcd', 'left', { shadow: false }); } else { U.text(c, p.n, x + cw / 2, y + sl + 80 * sc, 18 * sc, '#fff', 'center'); U.text(c, p.d, x + cw / 2, y + sl + 106 * sc, 13 * sc, '#bcd', 'center', { shadow: false }); }
      var I = PG.input; if (st.luT > 0.3 && I.released && PG.inRect(x, y + sl, cw, ch) && PG.inRect(x, y + sl, cw, ch, I.px, I.py)) { I.released = false; PG.sfx('tap'); pick(p); }
    });
  }
  function drawMenu(c, w, h, t) {
    var sc = PG.scale(); c.fillStyle = 'rgba(0,5,20,.35)'; c.fillRect(0, 0, w, h);
    U.text(c, 'BOUNCE', w / 2, h * 0.13, Math.min(64 * sc, w * 0.17), '#74c0fc', 'center', { stroke: '#102a54' }); U.text(c, 'BRIGADE', w / 2, h * 0.13 + 58 * sc, Math.min(64 * sc, w * 0.17), '#ffd43b', 'center', { stroke: '#7a4a00' });
    c.save(); c.translate(w / 2, h * 0.43 + Math.sin(t * 3) * 8); drawBall(c, 0, 0, 38 * sc, Math.sin(t) * 0.5, { sq: (Math.sin(t * 6) + 1) * 0.12 }); c.restore();
    var bw = 230 * sc, bh = 62 * sc, y0 = h * 0.6; if (U.button(c, w / 2 - bw / 2, y0, bw, bh, 'Deploy', { color: '#e8590c', size: 26 * sc })) startRun();
    if (U.button(c, w / 2 - bw / 2, y0 + bh + 12 * sc, bw, bh * 0.8, 'Upgrades', { color: '#2f9e44', size: 20 * sc })) { st.state = 'shop'; PG.track('shop_opened', { source: 'menu' }); }
    U.coin(c, w / 2 - 38 * sc, h - 56 * sc, 11 * sc); U.text(c, PG.fmt(PG.save.coins || 0), w / 2 - 22 * sc, h - 55 * sc, 20 * sc, '#ffe066', 'left'); U.text(c, 'Best ' + fmtT(PG.save.bestT || 0) + ' / 10:00', w / 2, h - 26 * sc, 15 * sc, '#bcd', 'center');
  }
  function drawShop(c, w, h) {
    var sc = PG.scale(); c.fillStyle = 'rgba(0,5,20,.8)'; c.fillRect(0, 0, w, h);
    var pw = Math.min(w * 0.94, 440 * sc), px = w / 2 - pw / 2, py = 24 * sc, rowH = 66 * sc, ph = 70 * sc + META.length * rowH + 76 * sc; U.panel(c, px, py, pw, ph);
    U.text(c, 'Upgrades', w / 2, py + 34 * sc, 30 * sc, '#ffd23f', 'center'); U.coin(c, px + pw - 84 * sc, py + 34 * sc, 11 * sc); U.text(c, PG.fmt(PG.save.coins || 0), px + pw - 68 * sc, py + 35 * sc, 20 * sc, '#ffe066', 'left');
    META.forEach(function (u, i) { var y = py + 62 * sc + i * rowH, L = PG.upLevel(u.id), cost = PG.upCost(u.base, u.grow, L), maxed = L >= u.max; U.text(c, u.n, px + 18 * sc, y + 18 * sc, 18 * sc, '#fff', 'left'); U.text(c, u.d, px + 18 * sc, y + 38 * sc, 13 * sc, '#cbd5e1', 'left', { shadow: false });
      for (var k = 0; k < u.max; k++) { c.fillStyle = k < L ? '#9be564' : 'rgba(255,255,255,.2)'; c.beginPath(); c.arc(px + 22 * sc + k * 11 * sc, y + 54 * sc, 4 * sc, 0, TAU); c.fill(); }
      var bw = 104 * sc, bh = 44 * sc, bx = px + pw - bw - 14 * sc; if (maxed) U.text(c, 'MAX', bx + bw / 2, y + 28 * sc, 18 * sc, '#9be564', 'center'); else if (U.button(c, bx, y + 8 * sc, bw, bh, cost + '', { color: PG.save.coins >= cost ? '#2ec4b6' : '#8a8f98', size: 20 * sc })) PG.buyUp(u.id, cost, u.max); });
    if (U.button(c, w / 2 - 90 * sc, py + ph - 62 * sc, 180 * sc, 48 * sc, 'Back', { color: '#ff9f1c' })) st.state = 'menu';
  }
  function drawDead(c, w, h) {
    var sc = PG.scale(), k = PG.ease.out(Math.min(1, st.deadT * 2)); c.fillStyle = 'rgba(0,5,20,' + 0.65 * k + ')'; c.fillRect(0, 0, w, h);
    var pw = Math.min(w * 0.88, 380 * sc), ph = 390 * sc, px = w / 2 - pw / 2, py = h * 0.5 - ph / 2 + (1 - k) * 60; U.panel(c, px, py, pw, ph);
    U.text(c, st.won ? 'BRIGADE VICTORY!' : 'Brigade down!', w / 2, py + 38 * sc, 28 * sc, st.won ? '#9be564' : '#ff8787', 'center'); U.text(c, fmtT(st.t), w / 2, py + 90 * sc, 54 * sc, '#fff', 'center');
    U.text(c, 'Level ' + st.lvl + '  -  ' + st.kills + ' defeated', w / 2, py + 130 * sc, 16 * sc, '#cbd5e1', 'center'); U.coin(c, w / 2 - 54 * sc, py + 166 * sc, 12 * sc); U.text(c, '+' + st.coinsRun + (st.doubled ? ' (x2)' : ''), w / 2 - 36 * sc, py + 167 * sc, 26 * sc, '#ffe066', 'left');
    var bw = pw * 0.84, bh = 50 * sc, yy = py + 198 * sc;
    if (!st.doubled && st.coinsRun >= 5 && PG.rewardedSupported()) { if (U.button(c, w / 2 - bw / 2, yy, bw, bh, 'Watch ad: double coins', { color: '#8338ec', size: 17 * sc })) { var earned = st.coinsRun; PG.rewarded('bonus').then(function (ok) { if (ok) { PG.save.coins += earned; st.coinsRun += earned; st.doubled = true; PG.commit(true); PG.track('rewarded_double_coins', {}); } }); } yy += bh + 10 * sc; }
    if (U.button(c, w / 2 - bw / 2, yy, bw, bh, 'Deploy again', { color: '#e8590c' })) PG.interstitial('game_over').then(function () { startRun(); });
    if (U.button(c, w / 2 - bw / 2, yy + bh + 10 * sc, bw / 2 - 5 * sc, bh * 0.85, 'Upgrades', { color: '#2f9e44', size: 16 * sc })) { st.state = 'shop'; PG.track('shop_opened', { source: 'game_over' }); }
    if (U.button(c, w / 2 + 5 * sc, yy + bh + 10 * sc, bw / 2 - 5 * sc, bh * 0.85, 'Menu', { color: '#5c6bc0', size: 16 * sc })) st.state = 'menu';
  }
  function render(c, w, h) {
    var t = PG.time;
    if (st.state === 'menu' || st.state === 'shop') { if (!st.p) st.p = newPlayer(); scale = 1; drawFloor(c, w, h, t); if (st.state === 'menu') drawMenu(c, w, h, t); else drawShop(c, w, h); return; }
    drawWorld(c, w, h, t); if (st.state === 'play' || st.state === 'levelup') drawHUD(c, w, h); if (st.state === 'levelup') drawLevelUp(c, w, h); if (st.state === 'dead') { drawHUD(c, w, h); drawDead(c, w, h); }
  }
  PG.onDown = function (x, y) { if (st.state === 'play' && !(x > PG.w - 130 * PG.scale() && y < 70 * PG.scale())) st.joy = { x: x, y: y }; };
  PG.onUp = function () { st.joy = null; };
  PG.setup(document.getElementById('c'), update, render);
  window.__bb = { st: st, start: startRun, update: update, pick: pick, pk: pk };
  PG.init({ id: 'bounce_brigade', version: '1.0.0', defaults: { coins: 0, runs: 0, bestT: 0, kills: 0, up: {}, muted: false } }).then(function () {
    PG.music({ scale: [0, 3, 5, 7, 10], root: 165, bpm: 124, wave: 'sawtooth', vol: 0.025, bass: 0.1 });
  });
})();
