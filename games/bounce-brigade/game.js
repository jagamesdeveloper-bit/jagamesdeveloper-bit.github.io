/* BOUNCE BRIGADE - steer an unstoppable bouncing ball through swarms. Survive 10 minutes. Permanent coin upgrades.
   Art direction: neon synthwave. Glowing vector shapes on a dark grid, chrome titles, CRT scanlines. */
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
    { id: 'ram', n: 'Spiked Ball', d: '+30% ram damage', col: '#ff2a6d', max: 6 },
    { id: 'size', n: 'Heavy Ball', d: 'Bigger, harder knockback', col: '#ff9e3d', max: 5 },
    { id: 'blade', n: 'Orbit Blades', d: 'Spinning blades guard you', col: '#01cdfe', max: 6 },
    { id: 'shock', n: 'Wall Shock', d: 'Shockwave off every wall bounce', col: '#d16bff', max: 5 },
    { id: 'speed', n: 'Rocket Boots', d: '+10% move speed', col: '#05ffa1', max: 5 },
    { id: 'magnet', n: 'Gem Magnet', d: 'Bigger pickup radius', col: '#5ec8ff', max: 5 },
    { id: 'regen', n: 'Field Medic', d: 'Regenerate health', col: '#ff71ce', max: 5 },
    { id: 'buddy', n: 'Brigade Buddy', d: 'A mini bouncer joins you', col: '#fffb96', max: 5 },
    { id: 'zap', n: 'Chain Zap', d: 'Lightning strikes nearby foes', col: '#f6f6ff', max: 6 }
  ];
  var ET = {
    blob: { hp: 7, sp: 66, r: 12, dmg: 6, col: '#ff6b35', xp: 1 },
    bat: { hp: 3, sp: 128, r: 9, dmg: 4, col: '#b967ff', xp: 1 },
    brute: { hp: 42, sp: 46, r: 19, dmg: 11, col: '#ff2a6d', xp: 5 },
    charger: { hp: 16, sp: 58, r: 13, dmg: 9, col: '#05ffa1', xp: 3 },
    boss: { hp: 700, sp: 52, r: 44, dmg: 24, col: '#ff00e4', xp: 60 }
  };
  var st = { state: 'menu', t: 0, p: null, en: [], gems: [], coins: [], perks: {}, xp: 0, lvl: 1, need: 6, kills: 0, coinsRun: 0, spawnAcc: 0, shock: [], zaps: [], blades: 0, buddies: [], choices: null, joy: null, shake: 0, dmgNums: [], revived: false, deadT: 0, bossAt: {}, runIdx: 0, doubled: false, won: false, flash: 0, hitStop: 0, banner: null, pendingLU: 0 };
  var cam = { x: 0, y: 0 }, scale = 1;

  function mlv(id) { return PG.upLevel(id); }
  function pk(id) { return st.perks[id] || 0; }
  function maxHp() { return 130 + 12 * mlv('hp'); }
  function newPlayer() { return { x: 0, y: 0, vx: 0, vy: 0, hp: maxHp(), inv: 0, r: 14, face: 0, wob: 0, trail: [], hurt: 0 }; }
  function startRun() {
    st.state = 'play'; st.t = 0; st.p = newPlayer(); st.en = []; st.gems = []; st.coins = []; st.perks = {}; st.xp = 0; st.lvl = 1; st.need = 6; st.kills = 0; st.coinsRun = 0; st.spawnAcc = 0; st.shock = []; st.zaps = []; st.buddies = []; st.dmgNums = []; st.revived = false; st.bossAt = {}; st.doubled = false; st.won = false; st.joy = null; st.banner = null; st.pendingLU = 0; st.choices = null; st.blades = 0;
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
    if (e.hp <= 0) { e.dead = true; st.kills++; var d = ET[e.t]; var gx = e.x, gy = e.y; for (var i = 0; i < (e.t === 'boss' ? 14 : 1); i++) st.gems.push({ x: gx + PG.rand(-12, 12), y: gy + PG.rand(-12, 12), v: d.xp / (e.t === 'boss' ? 14 : 1) * (1 + 0.1 * mlv('xp')), ph: Math.random() * 6, t: 0 }); if (Math.random() < (e.t === 'boss' ? 1 : 0.07)) st.coins.push({ x: gx, y: gy, v: e.t === 'boss' ? 12 : 1, ph: 0 }); PG.burst(e.x, e.y, e.t === 'boss' ? 30 : 6, { colors: [d.col, '#fff'], g: 0, min: 40, max: 200, life: 0.5, s0: 1.5, s1: 3.5, shape: 's', drag: 3 }); PG.sfx('pop', 0.8 + Math.random() * 0.5); if (e.t === 'boss') { st.shake = 14; st.flash = 0.3; PG.sfx('boom'); } }
  }
  function gainXP(v) { st.xp += v; while (st.xp >= st.need) { st.xp -= st.need; st.lvl++; st.need = Math.round(5 + st.lvl * 4.2); if (st.state === 'levelup') st.pendingLU++; else openLevelUp(); } } // extra level-ups queue behind the open card
  function openLevelUp() {
    var pool = PERKS.filter(function (p) { return pk(p.id) < p.max; }); var ch = []; while (ch.length < 3 && pool.length) { var i = Math.floor(Math.random() * pool.length); ch.push(pool.splice(i, 1)[0]); }
    if (!ch.length) { st.p.hp = Math.min(maxHp(), st.p.hp + 20); return; } st.choices = ch; st.state = 'levelup'; st.luT = 0; PG.sfx('upgrade');
  }
  function pick(p) {
    st.perks[p.id] = pk(p.id) + 1; PG.track('perk_picked', { perk_id: p.id, level: st.perks[p.id], player_level: Math.min(st.lvl, 40) });
    if (p.id === 'blade') st.blades = st.perks.blade + 1; if (p.id === 'buddy') { var a = Math.random() * TAU; st.buddies.push({ x: st.p.x, y: st.p.y, vx: Math.cos(a) * 240, vy: Math.sin(a) * 240, cd: {} }); }
    if (p.id === 'size') st.p.r = pRad(); st.state = 'play'; st.choices = null; PG.sfx('win', 1.3); if (st.pendingLU > 0) { st.pendingLU--; openLevelUp(); }
  }
  function damagePlayer(n) {
    var p = st.p; if (p.inv > 0) return; p.hp -= n; p.inv = 0.5; p.hurt = 0.25; st.shake = 8; PG.sfx('hit', 0.7); PG.vibrate(25); PG.popText(p.x, p.y - 22, '-' + Math.round(n), '#ff2a6d', 20); st.flash = 0.18;
    if (p.hp <= 0) die();
  }
  function die() {
    if (!st.revived && mlv('rev') > 0) { st.revived = true; st.p.hp = maxHp() * (0.4 + 0.15 * mlv('rev')); st.p.inv = 2; st.en.forEach(function (e) { if (e.t !== 'boss') { var dx = e.x - st.p.x, dy = e.y - st.p.y, d = Math.hypot(dx, dy) || 1; if (d < 300) { e.kx += dx / d * 700; e.ky += dy / d * 700; } } }); PG.sfx('upgrade'); PG.popText(st.p.x, st.p.y - 30, 'Second Wind!', '#05ffa1', 24); return; }
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
    for (g = st.coins.length - 1; g >= 0; g--) { var cn = st.coins[g]; cn.ph += dt; var dx3 = p.x - cn.x, dy3 = p.y - cn.y, d3 = Math.hypot(dx3, dy3); if (d3 < mr * 0.8) { cn.x += dx3 / d3 * 380 * dt; cn.y += dy3 / d3 * 380 * dt; } if (d3 < p.r + 10) { st.coins.splice(g, 1); var v = Math.round(cn.v * (1 + 0.12 * mlv('coin'))); st.coinsRun += v; PG.sfx('coin', 1.3); PG.popText(p.x, p.y - 20, '+' + v, '#fffb96', 18); } }
    st.en = st.en.filter(function (e) { return !e.dead; }); st.dmgNums.forEach(function (n) { n.t += dt; }); st.dmgNums = st.dmgNums.filter(function (n) { return n.t < 0.7; });
    cam.x += (p.x - cam.x) * Math.min(1, dt * 6); cam.y += (p.y - cam.y) * Math.min(1, dt * 6);
  }

  /* ---------- neon sprites (glow baked once per size) ---------- */
  var CYAN = '#01cdfe', PINK = '#ff2a6d', MAG = '#ff71ce', YEL = '#fffb96', MINT = '#05ffa1', NIGHT = '#0b0221', VIO = '#b967ff';
  var glowCache = {};
  function rgba(hex, a) { var n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }
  function poly(c, n, r, rot, k) { c.beginPath(); for (var i = 0; i < n; i++) { var a = (rot || 0) + i / n * TAU, rr = k && i % 2 ? r * k : r; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); }
  var SHAPES = {
    blob: function (c, R) { poly(c, 6, R, 0); },
    bat: function (c, R) { c.beginPath(); c.moveTo(-R * 1.25, -R * 0.35); c.lineTo(-R * 0.45, -R * 0.05); c.lineTo(0, -R * 0.55); c.lineTo(R * 0.45, -R * 0.05); c.lineTo(R * 1.25, -R * 0.35); c.lineTo(R * 0.55, R * 0.55); c.lineTo(0, R * 0.25); c.lineTo(-R * 0.55, R * 0.55); c.closePath(); },
    brute: function (c, R) { poly(c, 8, R, Math.PI / 8); c.moveTo(R * 0.55, 0); poly2(c, 8, R * 0.55); },
    charger: function (c, R) { c.beginPath(); c.moveTo(R * 1.25, 0); c.lineTo(-R * 0.8, -R * 0.95); c.lineTo(-R * 0.4, 0); c.lineTo(-R * 0.8, R * 0.95); c.closePath(); },
    boss: function (c, R) { poly(c, 16, R * 1.1, 0, 0.78); c.moveTo(R * 0.45, 0); c.arc(0, 0, R * 0.45, 0, TAU); },
    gem: function (c, R) { c.beginPath(); c.moveTo(0, -R * 1.3); c.lineTo(R * 0.8, 0); c.lineTo(0, R * 1.3); c.lineTo(-R * 0.8, 0); c.closePath(); },
    coin: function (c, R) { poly(c, 6, R, Math.PI / 6); c.moveTo(R * 0.4, 0); c.arc(0, 0, R * 0.4, 0, TAU); },
    blade: function (c, R) { c.beginPath(); c.moveTo(0, -R * 1.4); c.lineTo(R * 0.4, 0); c.lineTo(0, R * 1.4); c.lineTo(-R * 0.4, 0); c.closePath(); },
    ball: function (c, R) { c.beginPath(); c.arc(0, 0, R, 0, TAU); }
  };
  function poly2(c, n, r) { for (var i = 0; i <= n; i++) { var a = Math.PI / 8 + i / n * TAU; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } }
  function glow(kind, col, R, fillA) { // returns a cached canvas with a neon outline + bloom
    var d = PG.dpr || 1, key = kind + col + Math.round(R * d * 2); if (glowCache[key]) return glowCache[key];
    var pad = R * 0.9 + 12, S = Math.ceil((R * 1.45 + pad) * 2), cv = document.createElement('canvas'); cv.width = cv.height = Math.ceil(S * d); var c = cv.getContext('2d'); c.scale(d, d); c.translate(S / 2, S / 2);
    var lw = Math.max(1.6, R * 0.16); c.lineJoin = 'round';
    SHAPES[kind](c, R); c.fillStyle = rgba(col, fillA === undefined ? 0.18 : fillA); c.fill('evenodd');
    c.shadowColor = col; c.shadowBlur = lw * 5; c.strokeStyle = col; c.lineWidth = lw; c.stroke(); c.shadowBlur = lw * 2.5; c.stroke();
    c.shadowBlur = 0; c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = lw * 0.35; c.stroke();
    cv.S = S; glowCache[key] = cv; return cv;
  }
  function blit(c, cv, x, y, rot, sx, sy) { c.save(); c.translate(x, y); if (rot) c.rotate(rot); if (sx) c.scale(sx, sy || sx); c.drawImage(cv, -cv.S / 2, -cv.S / 2, cv.S, cv.S); c.restore(); }
  var scanPat = null;
  function scanlines(c, w, h, a) { if (!scanPat) { var cv = document.createElement('canvas'); cv.width = 4; cv.height = 4; var q = cv.getContext('2d'); q.fillStyle = 'rgba(0,0,0,1)'; q.fillRect(0, 0, 4, 1); scanPat = cv; } c.save(); c.globalAlpha = a; c.fillStyle = c.createPattern(scanPat, 'repeat'); c.fillRect(0, 0, w, h); c.restore(); }

  /* ---------- arena ---------- */
  function w2s(x, y, w, h) { return { x: (x - cam.x) * scale + w / 2, y: (y - cam.y) * scale + h / 2 }; }
  function drawFloor(c, w, h, t) {
    c.fillStyle = NIGHT; c.fillRect(0, 0, w, h);
    var tl = w2s(-ARENA, -ARENA, w, h), br = w2s(ARENA, ARENA, w, h);
    var g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.7); g.addColorStop(0, '#1d0640'); g.addColorStop(1, NIGHT); c.fillStyle = g; c.fillRect(Math.max(0, tl.x), Math.max(0, tl.y), Math.min(w, br.x) - Math.max(0, tl.x), Math.min(h, br.y) - Math.max(0, tl.y));
    var gs = 80 * scale, ox = ((tl.x) % gs + gs) % gs, oy = ((tl.y) % gs + gs) % gs, x, y;
    c.save(); c.beginPath(); c.rect(tl.x, tl.y, br.x - tl.x, br.y - tl.y); c.clip();
    c.strokeStyle = 'rgba(255,42,109,.16)'; c.lineWidth = 1; c.beginPath(); for (x = ox - gs; x < w + gs; x += gs) { c.moveTo(x, 0); c.lineTo(x, h); } for (y = oy - gs; y < h + gs; y += gs) { c.moveTo(0, y); c.lineTo(w, y); } c.stroke();
    var gs4 = gs * 4, ox4 = ((tl.x) % gs4 + gs4) % gs4, oy4 = ((tl.y) % gs4 + gs4) % gs4; c.strokeStyle = 'rgba(185,103,255,.3)'; c.lineWidth = 1.5; c.beginPath(); for (x = ox4 - gs4; x < w + gs4; x += gs4) { c.moveTo(x, 0); c.lineTo(x, h); } for (y = oy4 - gs4; y < h + gs4; y += gs4) { c.moveTo(0, y); c.lineTo(w, y); } c.stroke();
    var pulse = 0.5 + 0.5 * Math.sin(t * 2); c.fillStyle = 'rgba(1,205,254,' + (0.05 + pulse * 0.05) + ')'; for (x = ox4 - gs4; x < w + gs4; x += gs4) for (y = oy4 - gs4; y < h + gs4; y += gs4) c.fillRect(x - 2, y - 2, 4, 4);
    c.restore();
    c.fillStyle = '#05010f'; c.fillRect(0, 0, w, Math.max(0, tl.y)); c.fillRect(0, Math.min(h, br.y), w, h); c.fillRect(0, 0, Math.max(0, tl.x), h); c.fillRect(Math.min(w, br.x), 0, w, h);
    c.save(); c.shadowColor = CYAN; c.shadowBlur = 16; c.strokeStyle = CYAN; c.lineWidth = 3 * scale; c.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y); c.shadowColor = PINK; c.strokeStyle = PINK; c.lineWidth = 1.5 * scale; c.strokeRect(tl.x - 7 * scale, tl.y - 7 * scale, br.x - tl.x + 14 * scale, br.y - tl.y + 14 * scale); c.restore();
  }
  function drawPlayerBall(c, x, y, r, face, o) {
    o = o || {}; var col = o.col || CYAN;
    c.save(); c.translate(x, y); var sq = o.sq || 0; c.rotate(face); c.scale(1 + sq * 0.2, 1 - sq * 0.2); c.rotate(-face);
    var gl = c.createRadialGradient(0, 0, r * 0.2, 0, 0, r * 2.2); gl.addColorStop(0, rgba(col, 0.35)); gl.addColorStop(1, rgba(col, 0)); c.fillStyle = gl; c.beginPath(); c.arc(0, 0, r * 2.2, 0, TAU); c.fill();
    c.fillStyle = o.flash ? '#fff' : '#120634'; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
    blit(c, glow('ball', col, r, 0.15), 0, 0);
    if (!o.small) {
      c.strokeStyle = rgba(col, 0.55); c.lineWidth = Math.max(1, r * 0.08); c.beginPath(); c.arc(0, 0, r * 0.68, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
      var lx = Math.cos(face) * r * 0.22, ly = Math.sin(face) * r * 0.22; c.fillStyle = '#fff'; c.shadowColor = col; c.shadowBlur = 8;
      [-1, 1].forEach(function (d) { c.beginPath(); c.ellipse(d * r * 0.3 + lx, r * 0.02 + ly, r * 0.11, r * 0.2, 0, 0, TAU); c.fill(); }); c.shadowBlur = 0;
    }
    c.restore();
  }
  function drawEnemy(c, e, w, h, t) {
    var s = w2s(e.x, e.y, w, h); if (s.x < -90 || s.x > w + 90 || s.y < -90 || s.y > h + 90) return; var d = ET[e.t], r = e.r * scale, col = d.col, rot = 0, sx = 1, sy = 1;
    if (e.t === 'charger') { rot = Math.atan2(st.p.y - e.y, st.p.x - e.x); if (e.state === 1) { col = PINK; c.strokeStyle = 'rgba(255,42,109,.6)'; c.lineWidth = 2; c.setLineDash([6, 6]); c.beginPath(); c.moveTo(s.x, s.y); c.lineTo(s.x + e.cx * 250 * scale, s.y + e.cy * 250 * scale); c.stroke(); c.setLineDash([]); } else if (e.state === 2) rot = Math.atan2(e.cy, e.cx); }
    else if (e.t === 'bat') { sx = 0.75 + 0.35 * Math.abs(Math.sin(e.ph * 2)); }
    else if (e.t === 'boss') rot = t * 0.6; else if (e.t === 'blob') { rot = e.ph * 0.15; sx = sy = 1 + Math.sin(e.ph) * 0.06; } else rot = Math.sin(e.ph * 0.4) * 0.2;
    var spr = glow(e.t === 'charger' && e.state === 1 ? 'charger' : e.t, col, r);
    blit(c, spr, s.x, s.y, rot, sx, sy);
    if (e.hit > 0) { c.save(); c.globalCompositeOperation = 'lighter'; blit(c, spr, s.x, s.y, rot, sx, sy); c.restore(); }
    if (e.t !== 'bat') { var a = Math.atan2(st.p.y - e.y, st.p.x - e.x), ex = Math.cos(a) * r * 0.18, ey = Math.sin(a) * r * 0.18, es = Math.max(1.6, r * 0.13); c.fillStyle = '#fff'; c.fillRect(s.x - r * 0.3 + ex - es / 2, s.y - r * 0.12 + ey - es / 2, es, es); c.fillRect(s.x + r * 0.3 + ex - es / 2, s.y - r * 0.12 + ey - es / 2, es, es); }
    if (e.t === 'boss' || (e.t === 'brute' && e.hp < e.mhp * 0.99)) { var bw = Math.max(26, r * 2), y = s.y - r * 1.25 - 10; c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(s.x - bw / 2, y, bw, 4); c.fillStyle = col; c.shadowColor = col; c.shadowBlur = 6; c.fillRect(s.x - bw / 2, y, bw * Math.max(0, e.hp / e.mhp), 4); c.shadowBlur = 0; }
  }
  function drawWorld(c, w, h, t) {
    scale = PG.clamp(Math.min(w, h) / 380, 0.7, 2.6);
    c.save(); if (st.shake > 0.2) c.translate((Math.random() - 0.5) * st.shake, (Math.random() - 0.5) * st.shake);
    drawFloor(c, w, h, t);
    var gemS = glow('gem', CYAN, 4.5 * scale, 0.5), coinS = glow('coin', YEL, 7 * scale, 0.35);
    st.gems.forEach(function (g) { var s = w2s(g.x, g.y, w, h); if (s.x < -20 || s.x > w + 20 || s.y < -20 || s.y > h + 20) return; blit(c, gemS, s.x, s.y + Math.sin(t * 5 + g.ph) * 2); });
    st.coins.forEach(function (g) { var s = w2s(g.x, g.y, w, h); blit(c, coinS, s.x, s.y + Math.sin(t * 5 + g.ph) * 2, t * 2); });
    st.en.forEach(function (e) { drawEnemy(c, e, w, h, t); });
    c.save(); c.globalCompositeOperation = 'lighter';
    st.shock.forEach(function (sw) { var s = w2s(sw.x, sw.y, w, h); c.strokeStyle = rgba('#d16bff', 1 - sw.t); c.lineWidth = 9 * scale * (1 - sw.t); c.beginPath(); c.arc(s.x, s.y, sw.r * sw.t * scale, 0, TAU); c.stroke(); c.strokeStyle = rgba('#ffffff', 0.6 * (1 - sw.t)); c.lineWidth = 2 * scale; c.stroke(); });
    st.zaps.forEach(function (z) { var a = w2s(z.x0, z.y0, w, h), b = w2s(z.x1, z.y1, w, h), pts = [[a.x, a.y]]; for (var i = 1; i < 6; i++) { var k = i / 6; pts.push([a.x + (b.x - a.x) * k + (Math.random() - 0.5) * 20, a.y + (b.y - a.y) * k + (Math.random() - 0.5) * 20]); } pts.push([b.x, b.y]);
      [[7, 'rgba(185,103,255,.35)'], [3, 'rgba(240,240,255,.9)']].forEach(function (q) { c.strokeStyle = q[1]; c.lineWidth = q[0]; c.beginPath(); pts.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); c.stroke(); }); });
    var p = st.p;
    if (p) { for (var i = p.trail.length - 1; i >= 1; i--) { var q = w2s(p.trail[i].x, p.trail[i].y, w, h), q0 = w2s(p.trail[i - 1].x, p.trail[i - 1].y, w, h); c.strokeStyle = rgba(i % 2 ? CYAN : MAG, 0.5 * (1 - i / p.trail.length)); c.lineWidth = p.r * scale * 1.6 * (1 - i / p.trail.length); c.lineCap = 'round'; c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(q0.x, q0.y); c.stroke(); } }
    c.restore();
    st.buddies.forEach(function (b) { var s = w2s(b.x, b.y, w, h); drawPlayerBall(c, s.x, s.y, 8 * scale, Math.atan2(b.vy, b.vx), { col: YEL, small: true }); });
    if (p) {
      var ps = w2s(p.x, p.y, w, h);
      if (st.blades > 0) { var brad = 54 + 6 * pk('blade'), ang = st.t * 3.4, bS = glow('blade', CYAN, 9 * scale, 0.4); for (i = 0; i < st.blades; i++) { var a2 = ang + i / st.blades * TAU, bs = w2s(p.x + Math.cos(a2) * brad, p.y + Math.sin(a2) * brad, w, h); blit(c, bS, bs.x, bs.y, a2 + t * 8); } }
      var blink = p.inv > 0 && Math.floor(t * 20) % 2 === 0; if (!blink || p.hp <= 0) drawPlayerBall(c, ps.x, ps.y, p.r * scale, p.face, { sq: p.sq, flash: p.hurt > 0.15 });
    }
    c.save(); c.globalCompositeOperation = 'lighter'; c.translate(w / 2 - cam.x * scale, h / 2 - cam.y * scale); c.scale(scale, scale); PG.drawParts(c); c.restore();
    c.save(); c.translate(w / 2 - cam.x * scale, h / 2 - cam.y * scale); c.scale(scale, scale); PG.drawPops(c); c.restore();
    st.dmgNums.forEach(function (n) { var s = w2s(n.x, n.y, w, h); c.globalAlpha = 1 - n.t / 0.7; U.text(c, '' + n.v, s.x, s.y - n.t * 30, 11 * scale + 4, '#fff', 'center', { font: 'body', stroke: 'rgba(40,0,60,.8)', strokeWidth: 3, shadow: false }); c.globalAlpha = 1; });
    c.restore();
    if (st.flash > 0) { c.fillStyle = 'rgba(255,42,109,' + st.flash * 0.4 + ')'; c.fillRect(0, 0, w, h); }
  }

  /* ---------- theme: neon outlines on dark glass ---------- */
  function neonText(c, s, x, y, size, col, align, o) { o = o || {}; c.save(); c.shadowColor = col; c.shadowBlur = size * 0.45; U.text(c, s, x, y, size, col, align || 'center', { shadow: false, font: o.font }); c.shadowBlur = 0; U.text(c, s, x, y, size, o.core || 'rgba(255,255,255,.85)', align || 'center', { shadow: false, font: o.font }); c.restore(); }
  function neonRect(c, x, y, w, h, r, col, lw) { c.save(); c.shadowColor = col; c.shadowBlur = 12; c.strokeStyle = col; c.lineWidth = lw || 2; U.rr(c, x, y, w, h, r); c.stroke(); c.restore(); }
  PG.theme.font = 'Orbitron'; PG.theme.body = 'Rajdhani'; PG.theme.weight = '800'; PG.theme.bodyWeight = '700'; PG.theme.text = '#f2e9ff'; PG.theme.textShadow = false; PG.theme.pageColor = '#05010f';
  PG.theme.popStyle = { stroke: 'rgba(30,0,50,.85)' };
  PG.theme.button = function (c, x, y, w, h, label, o, s) {
    var col = o.disabled ? '#5d5470' : o.color || PINK, r = Math.min(10, h * 0.25), lift = s.press ? 2 : 0;
    c.fillStyle = s.hover || s.press ? rgba(col, 0.28) : 'rgba(18,6,44,.82)'; U.rr(c, x, y + lift, w, h, r); c.fill();
    var g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, rgba(col, 0.22)); g.addColorStop(1, rgba(col, 0)); c.fillStyle = g; U.rr(c, x, y + lift, w, h, r); c.fill();
    neonRect(c, x, y + lift, w, h, r, col, 2);
    c.fillStyle = col; c.fillRect(x + 8, y + lift + h - 4, Math.max(0, w * 0.18), 2); c.fillRect(x + w - 8 - w * 0.18, y + lift + 2, w * 0.18, 2);
    if (label) { var fs = U.fit(c, label.toUpperCase(), o.size || Math.min(h * 0.36, 22), w - 22); neonText(c, label.toUpperCase(), x + w / 2, y + lift + h / 2 + 1, fs, col, 'center', { core: o.disabled ? '#8d84a0' : '#fff' }); }
  };
  PG.theme.panel = function (c, x, y, w, h, o) {
    var col = (o && o.stroke) || CYAN; c.fillStyle = 'rgba(12,4,34,.9)'; U.rr(c, x, y, w, h, 12); c.fill(); neonRect(c, x, y, w, h, 12, col, 2);
    c.strokeStyle = MAG; c.lineWidth = 3; c.shadowColor = MAG; c.shadowBlur = 8; c.beginPath(); c.moveTo(x + 14, y - 1); c.lineTo(x + 54, y - 1); c.moveTo(x + w - 54, y + h + 1); c.lineTo(x + w - 14, y + h + 1); c.stroke(); c.shadowBlur = 0;
  };
  PG.theme.hudButton = function (c, x, y, r, kind) { c.fillStyle = 'rgba(12,4,34,.85)'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.save(); c.shadowColor = CYAN; c.shadowBlur = 10; c.strokeStyle = CYAN; c.lineWidth = 2; c.stroke(); c.restore(); PG.hudIcon(c, x, y, r * 0.9, kind, CYAN); };
  PG.theme.transition = { time: 0.36, draw: function (c, w, h, k) { // glitch bars slam shut from alternating sides
    var n = 10, bh = h / n; c.fillStyle = '#05010f';
    for (var i = 0; i < n; i++) { var kk = PG.clamp(k * 1.5 - (i % 3) * 0.12, 0, 1), bw = w * kk; if (i % 2) c.fillRect(w - bw, i * bh, bw, bh + 1); else c.fillRect(0, i * bh, bw, bh + 1); if (kk > 0 && kk < 1) { c.fillStyle = i % 2 ? PINK : CYAN; c.fillRect(i % 2 ? w - bw - 3 : bw, i * bh, 3, bh); c.fillStyle = '#05010f'; } }
  } };
  PG.theme.loading = function (c, w, h, t) { c.fillStyle = NIGHT; c.fillRect(0, 0, w, h); c.save(); c.translate(w / 2, h / 2 - Math.abs(Math.sin(t * 4)) * 30); c.shadowColor = CYAN; c.shadowBlur = 14; c.strokeStyle = CYAN; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 16, 0, TAU); c.stroke(); c.restore(); c.strokeStyle = PINK; c.lineWidth = 2; c.beginPath(); c.moveTo(w / 2 - 40, h / 2 + 18); c.lineTo(w / 2 + 40, h / 2 + 18); c.stroke(); };
  function fmtT(s) { s = Math.max(0, Math.floor(s)); return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2); }
  function coinIcon(c, x, y, r) { c.save(); c.shadowColor = YEL; c.shadowBlur = 8; c.strokeStyle = YEL; c.lineWidth = 2; poly(c, 6, r, Math.PI / 6); c.stroke(); c.restore(); c.fillStyle = YEL; c.beginPath(); c.arc(x, y, r * 0.35, 0, TAU); c.fill(); c.save(); c.translate(x, y); c.restore(); }
  function drawCoinIcon(c, x, y, r) { c.save(); c.translate(x, y); coinIcon(c, 0, 0, r); c.restore(); }

  /* ---------- screens ---------- */
  function drawHUD(c, w, h) {
    var sc = PG.scale(), p = st.p, bw = Math.min(210 * sc, w * 0.42), bx = 14 * sc, by = 14 * sc, segs = 14, hpK = Math.max(0, p.hp / maxHp()), lit = Math.ceil(segs * hpK), sw = (bw - (segs - 1) * 2) / segs;
    for (var i = 0; i < segs; i++) { var on = i < lit, col = hpK > 0.3 ? MINT : PINK; c.fillStyle = on ? col : 'rgba(255,255,255,.08)'; if (on) { c.shadowColor = col; c.shadowBlur = 6; } c.fillRect(bx + i * (sw + 2), by, sw, 12 * sc); c.shadowBlur = 0; }
    U.text(c, Math.ceil(p.hp) + ' / ' + maxHp(), bx, by + 24 * sc, 12 * sc, '#cfc6e8', 'left', { font: 'body', shadow: false });
    c.fillStyle = 'rgba(255,255,255,.08)'; c.fillRect(bx, by + 34 * sc, bw, 5 * sc); c.fillStyle = CYAN; c.shadowColor = CYAN; c.shadowBlur = 8; c.fillRect(bx, by + 34 * sc, bw * Math.min(1, st.xp / st.need), 5 * sc); c.shadowBlur = 0;
    neonText(c, 'LV ' + st.lvl, bx, by + 56 * sc, 15 * sc, CYAN, 'left'); drawCoinIcon(c, bx + 78 * sc, by + 56 * sc, 7 * sc); U.text(c, '' + st.coinsRun, bx + 90 * sc, by + 57 * sc, 16 * sc, YEL, 'left', { font: 'body', shadow: false });
    var tx = Math.max(w * 0.62, bx + bw + 60 * sc); neonText(c, fmtT(WIN_T - st.t), tx, 28 * sc, 24 * sc, MAG); U.text(c, 'SURVIVE', tx, 50 * sc, 11 * sc, '#b9a6d9', 'center', { font: 'body', shadow: false });
    if (st.joy && PG.input.down) { c.save(); c.shadowColor = CYAN; c.shadowBlur = 10; c.strokeStyle = rgba(CYAN, 0.45); c.lineWidth = 2; c.beginPath(); c.arc(st.joy.x, st.joy.y, 50 * sc, 0, TAU); c.stroke(); var dx = PG.input.x - st.joy.x, dy = PG.input.y - st.joy.y, d = Math.min(Math.hypot(dx, dy), 50 * sc), a = Math.atan2(dy, dx); c.fillStyle = rgba(CYAN, 0.35); c.beginPath(); c.arc(st.joy.x + Math.cos(a) * d, st.joy.y + Math.sin(a) * d, 20 * sc, 0, TAU); c.fill(); c.restore(); }
    if (st.banner) { var k = Math.min(1, st.banner.t * 4) * Math.min(1, (2.4 - st.banner.t) * 3), boss = st.banner.s.indexOf('BOSS') >= 0, jit = st.banner.t < 0.25 ? (Math.random() - 0.5) * 8 : 0; c.globalAlpha = Math.max(0, k); neonText(c, st.banner.s.toUpperCase(), w / 2 + jit, h * 0.28, Math.min(34 * sc, w * 0.08), boss ? PINK : YEL); c.globalAlpha = 1; }
    if (st.t < 6 && !PG.save.runs) U.text(c, 'Drag anywhere to steer. Ram the swarm!', w / 2, h * 0.8, 18 * sc, '#fff', 'center', { font: 'body', stroke: 'rgba(20,0,40,.8)', strokeWidth: 4, shadow: false });
  }
  function perkGlyph(c, id, x, y, r, col) {
    c.save(); c.translate(x, y); c.shadowColor = col; c.shadowBlur = 10; c.strokeStyle = col; c.lineWidth = Math.max(1.5, r * 0.12); c.lineJoin = 'round'; c.beginPath();
    switch (id) {
      case 'ram': poly(c, 12, r, 0, 0.6); break;
      case 'size': c.arc(0, 0, r * 0.9, 0, TAU); c.moveTo(r * 0.5, 0); c.arc(0, 0, r * 0.5, 0, TAU); break;
      case 'blade': for (var i = 0; i < 3; i++) { var a = i * TAU / 3; c.moveTo(0, 0); c.lineTo(Math.cos(a) * r, Math.sin(a) * r); c.lineTo(Math.cos(a + 0.5) * r * 0.5, Math.sin(a + 0.5) * r * 0.5); } break;
      case 'shock': c.arc(0, 0, r * 0.3, 0, TAU); c.moveTo(r * 0.65, 0); c.arc(0, 0, r * 0.65, 0, TAU); c.moveTo(r, 0); c.arc(0, 0, r, 0, TAU); break;
      case 'speed': c.moveTo(-r, -r * 0.6); c.lineTo(0, 0); c.lineTo(-r, r * 0.6); c.moveTo(-r * 0.1, -r * 0.6); c.lineTo(r * 0.9, 0); c.lineTo(-r * 0.1, r * 0.6); break;
      case 'magnet': c.arc(0, -r * 0.1, r * 0.7, Math.PI, 0); c.lineTo(r * 0.7, r * 0.8); c.moveTo(-r * 0.7, -r * 0.1); c.lineTo(-r * 0.7, r * 0.8); break;
      case 'regen': c.moveTo(-r * 0.3, -r); c.lineTo(r * 0.3, -r); c.lineTo(r * 0.3, -r * 0.3); c.lineTo(r, -r * 0.3); c.lineTo(r, r * 0.3); c.lineTo(r * 0.3, r * 0.3); c.lineTo(r * 0.3, r); c.lineTo(-r * 0.3, r); c.lineTo(-r * 0.3, r * 0.3); c.lineTo(-r, r * 0.3); c.lineTo(-r, -r * 0.3); c.lineTo(-r * 0.3, -r * 0.3); c.closePath(); break;
      case 'buddy': c.arc(-r * 0.35, 0, r * 0.5, 0, TAU); c.moveTo(r * 0.95, 0); c.arc(r * 0.55, 0, r * 0.4, 0, TAU); break;
      default: c.moveTo(r * 0.2, -r); c.lineTo(-r * 0.4, r * 0.1); c.lineTo(r * 0.1, r * 0.1); c.lineTo(-r * 0.2, r); c.lineTo(r * 0.5, -r * 0.2); c.lineTo(0, -r * 0.2); c.closePath();
    }
    c.stroke(); c.restore();
  }
  function drawLevelUp(c, w, h) {
    var sc = PG.scale(), k = PG.ease.out(Math.min(1, st.luT * 4)); c.fillStyle = 'rgba(5,1,15,' + 0.72 * k + ')'; c.fillRect(0, 0, w, h);
    neonText(c, 'LEVEL UP', w / 2, h * 0.17, Math.min(40 * sc, w * 0.1), CYAN); U.text(c, st.pendingLU ? 'Pick one  (+' + st.pendingLU + ' more)' : 'Pick one', w / 2, h * 0.17 + 34 * sc, 16 * sc, '#cfc6e8', 'center', { font: 'body', shadow: false });
    var n = st.choices.length, portrait = h > w * 0.9, cw = portrait ? Math.min(w * 0.88, 340 * sc) : Math.min(w / n - 20 * sc, 230 * sc), ch = portrait ? 88 * sc : 150 * sc;
    st.choices.forEach(function (p, i) {
      var x = portrait ? w / 2 - cw / 2 : w / 2 - (n * cw + (n - 1) * 14 * sc) / 2 + i * (cw + 14 * sc), y = (portrait ? h * 0.3 + i * (ch + 14 * sc) : h * 0.36) + (1 - k) * 40 * (i + 1), hov = PG.inRect(x, y, cw, ch) && !PG.touch;
      c.fillStyle = hov ? rgba(p.col, 0.16) : 'rgba(12,4,34,.92)'; U.rr(c, x, y, cw, ch, 12); c.fill(); neonRect(c, x, y, cw, ch, 12, p.col, 2);
      var gx = portrait ? x + 40 * sc : x + cw / 2, gy = portrait ? y + ch / 2 : y + 46 * sc; perkGlyph(c, p.id, gx, gy, 18 * sc, p.col);
      for (var j = 0; j < p.max; j++) { c.fillStyle = j < pk(p.id) + 1 ? p.col : 'rgba(255,255,255,.15)'; c.fillRect((portrait ? x + 76 * sc : x + cw / 2 - p.max * 5 * sc) + j * 10 * sc, portrait ? y + ch - 18 * sc : y + ch - 20 * sc, 7 * sc, 3 * sc); }
      if (portrait) { neonText(c, p.n.toUpperCase(), x + 76 * sc, y + 28 * sc, U.fit(c, p.n.toUpperCase(), 15 * sc, cw - 90 * sc), p.col, 'left'); U.text(c, p.d, x + 76 * sc, y + 52 * sc, 15 * sc, '#d9d0f0', 'left', { font: 'body', shadow: false }); }
      else { neonText(c, p.n.toUpperCase(), x + cw / 2, y + 86 * sc, U.fit(c, p.n.toUpperCase(), 14 * sc, cw - 16 * sc), p.col); U.text(c, p.d, x + cw / 2, y + 110 * sc, U.fit(c, p.d, 14 * sc, cw - 14 * sc, { font: 'body' }), '#d9d0f0', 'center', { font: 'body', shadow: false }); }
      if (st.luT > 0.3 && U.hit(x, y, cw, ch)) pick(p);
    });
  }
  function synthwave(c, w, h, t) { // menu backdrop: sunset, mountains, rolling grid
    var hz = h * 0.56, g = c.createLinearGradient(0, 0, 0, hz); g.addColorStop(0, '#0b0221'); g.addColorStop(0.6, '#2d0b52'); g.addColorStop(1, '#ff2a6d'); c.fillStyle = g; c.fillRect(0, 0, w, hz);
    for (var i = 0; i < 40; i++) { var sx = PG.hash(i * 3.3) * w, sy = PG.hash(i * 7.1) * hz * 0.6; c.fillStyle = 'rgba(255,255,255,' + (0.3 + 0.5 * Math.abs(Math.sin(t + i))) + ')'; c.fillRect(sx, sy, 1.5, 1.5); }
    var R = Math.min(w * 0.36, h * 0.24), cx = w / 2, cy = hz - R * 0.35; c.save(); c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.clip(); var sg = c.createLinearGradient(0, cy - R, 0, cy + R); sg.addColorStop(0, '#fffb96'); sg.addColorStop(0.5, '#ff9e3d'); sg.addColorStop(1, '#ff2a6d'); c.fillStyle = sg; c.fillRect(cx - R, cy - R, R * 2, R * 2);
    for (var b = 0; b < 7; b++) { var by = cy + R * (0.05 + b * 0.14) + ((t * 6) % (R * 0.14)), bh = R * 0.02 + b * R * 0.012; c.fillStyle = '#2d0b52'; c.fillRect(cx - R, by, R * 2, bh); }
    c.restore(); c.save(); c.shadowColor = '#ff71ce'; c.shadowBlur = 40; c.fillStyle = 'rgba(255,113,206,.08)'; c.beginPath(); c.arc(cx, cy, R, 0, TAU); c.fill(); c.restore();
    c.fillStyle = '#12052b'; c.beginPath(); c.moveTo(0, hz); var mx = [[0, 0.25], [0.12, 0.5], [0.22, 0.32], [0.33, 0.62], [0.42, 0.3], [0.5, 0.15], [0.6, 0.4], [0.7, 0.22], [0.8, 0.55], [0.9, 0.3], [1, 0.45]]; mx.forEach(function (m) { c.lineTo(m[0] * w, hz - m[1] * R * 0.7); }); c.lineTo(w, hz); c.closePath(); c.fill();
    c.save(); c.shadowColor = CYAN; c.shadowBlur = 8; c.strokeStyle = rgba(CYAN, 0.7); c.lineWidth = 1.5; c.beginPath(); mx.forEach(function (m, i) { if (i) c.lineTo(m[0] * w, hz - m[1] * R * 0.7); else c.moveTo(m[0] * w, hz - m[1] * R * 0.7); }); c.stroke(); c.restore();
    c.fillStyle = '#0b0221'; c.fillRect(0, hz, w, h - hz);
    c.save(); c.shadowColor = MAG; c.shadowBlur = 6; c.strokeStyle = 'rgba(255,113,206,.75)'; c.lineWidth = 1.5; c.beginPath();
    for (i = -14; i <= 14; i++) { c.moveTo(w / 2 + i * w * 0.02, hz); c.lineTo(w / 2 + i * w * 0.2, h); }
    for (i = 0; i < 12; i++) { var k = ((i + (t * 0.8) % 1) / 12), y = hz + (h - hz) * k * k; c.moveTo(0, y); c.lineTo(w, y); }
    c.stroke(); c.restore(); c.fillStyle = '#ff71ce'; c.fillRect(0, hz - 1, w, 2);
  }
  function chrome(c, s, x, y, size) { // 80s chrome lettering
    c.save(); c.font = U.fontStr(size); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.lineWidth = size * 0.12; c.strokeStyle = '#1a0533'; c.lineJoin = 'round'; c.strokeText(s, x, y + size * 0.06); c.strokeText(s, x, y);
    var g = c.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5); g.addColorStop(0, '#e6fbff'); g.addColorStop(0.45, '#7fdcff'); g.addColorStop(0.5, '#2a1458'); g.addColorStop(0.56, '#ff8ad8'); g.addColorStop(1, '#fff1fb'); c.fillStyle = g; c.fillText(s, x, y);
    c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 1; c.strokeText(s, x, y); c.restore();
  }
  function drawMenu(c, w, h, t) {
    var sc = PG.scale(), land = w > h; synthwave(c, w, h, t);
    var tsz = Math.min(54 * sc, w * 0.13), ty = land ? h * 0.15 : h * 0.12;
    chrome(c, 'BOUNCE', w / 2, ty, tsz); c.save(); c.translate(w / 2, ty + tsz * 0.95); c.transform(1, 0, -0.18, 1, 0, 0); neonText(c, 'BRIGADE', 0, 0, tsz * 0.82, PINK, 'center', { font: 'body' }); c.restore();
    var by = (land ? h * 0.66 : h * 0.62) - Math.abs(Math.sin(t * 2.6)) * 40 * sc, bx = land ? w * 0.2 : w / 2; drawPlayerBall(c, bx, by, 26 * sc, Math.sin(t) * 0.5, { sq: Math.max(0, 1 - Math.abs(Math.sin(t * 2.6)) * 6) * 0.4 });
    var bw = Math.min(240 * sc, w * 0.66), bh = 56 * sc, bx2 = land ? w * 0.72 - bw / 2 : w / 2 - bw / 2, y0 = land ? h * 0.4 : h * 0.72;
    if (U.button(c, bx2, y0, bw, bh, 'Deploy', { color: CYAN, size: 22 * sc })) PG.go(startRun);
    if (U.button(c, bx2, y0 + bh + 12 * sc, bw, bh * 0.82, 'Upgrades', { color: MAG, size: 17 * sc })) PG.go(function () { st.state = 'shop'; PG.track('shop_opened', { source: 'menu' }); });
    var ly = y0 + bh * 1.82 + 34 * sc; drawCoinIcon(c, bx2 + bw / 2 - 44 * sc, ly, 8 * sc); U.text(c, PG.fmt(PG.save.coins || 0), bx2 + bw / 2 - 30 * sc, ly + 1, 19 * sc, YEL, 'left', { font: 'body', shadow: false });
    U.text(c, 'BEST ' + fmtT(PG.save.bestT || 0) + ' / 10:00', bx2 + bw / 2, ly + 24 * sc, 13 * sc, '#cfc6e8', 'center', { font: 'body', shadow: false });
    U.text(c, 'Music: ansimuz   Sounds: Kenney', w / 2, h - 12 * sc, 12 * sc, 'rgba(255,200,240,.6)', 'center', { font: 'body', shadow: false });
  }
  function drawShop(c, w, h) {
    var sc = PG.scale(); synthwave(c, w, h, PG.time); c.fillStyle = 'rgba(5,1,15,.55)'; c.fillRect(0, 0, w, h);
    var pw = Math.min(w * 0.94, 440 * sc), rowH = 64 * sc, ph = 72 * sc + META.length * rowH + 72 * sc, px = w / 2 - pw / 2, py = Math.max(14 * sc, (h - ph) / 2); U.panel(c, px, py, pw, ph);
    neonText(c, 'UPGRADES', px + 22 * sc, py + 34 * sc, 20 * sc, CYAN, 'left'); drawCoinIcon(c, px + pw - 84 * sc, py + 34 * sc, 8 * sc); U.text(c, PG.fmt(PG.save.coins || 0), px + pw - 70 * sc, py + 35 * sc, 19 * sc, YEL, 'left', { font: 'body', shadow: false });
    META.forEach(function (u, i) { var y = py + 62 * sc + i * rowH, L = PG.upLevel(u.id), cost = PG.upCost(u.base, u.grow, L), maxed = L >= u.max;
      U.text(c, u.n.toUpperCase(), px + 22 * sc, y + 17 * sc, 13 * sc, '#f2e9ff', 'left', { shadow: false }); U.text(c, u.d, px + 22 * sc, y + 37 * sc, 14 * sc, '#b9a6d9', 'left', { font: 'body', shadow: false });
      for (var k = 0; k < u.max; k++) { c.fillStyle = k < L ? MINT : 'rgba(255,255,255,.12)'; if (k < L) { c.shadowColor = MINT; c.shadowBlur = 5; } c.fillRect(px + 22 * sc + k * 12 * sc, y + 50 * sc, 9 * sc, 3 * sc); c.shadowBlur = 0; }
      var bw = 100 * sc, bh = 40 * sc, bx = px + pw - bw - 18 * sc; if (maxed) neonText(c, 'MAX', bx + bw / 2, y + 28 * sc, 16 * sc, MINT); else if (U.button(c, bx, y + 9 * sc, bw, bh, '' + cost, { color: (PG.save.coins || 0) >= cost ? YEL : '#5d5470', size: 17 * sc })) PG.buyUp(u.id, cost, u.max); });
    if (U.button(c, w / 2 - 85 * sc, py + ph - 58 * sc, 170 * sc, 44 * sc, 'Back', { color: MAG })) PG.go(function () { st.state = 'menu'; });
  }
  function drawDead(c, w, h) {
    var sc = PG.scale(), k = PG.ease.out(Math.min(1, Math.max(0, st.deadT - 0.3) * 2)); if (k <= 0) return; c.fillStyle = 'rgba(5,1,15,' + 0.7 * k + ')'; c.fillRect(0, 0, w, h);
    var canAd = !st.doubled && st.coinsRun >= 5 && PG.rewardedSupported(), pw = Math.min(w * 0.88, 370 * sc), ph = (canAd ? 380 : 320) * sc, px = w / 2 - pw / 2, py = Math.max(10 * sc, h * 0.5 - ph / 2) + (1 - k) * 60; U.panel(c, px, py, pw, ph, { stroke: st.won ? MINT : PINK });
    neonText(c, st.won ? 'VICTORY' : 'SIGNAL LOST', w / 2, py + 40 * sc, 24 * sc, st.won ? MINT : PINK); neonText(c, fmtT(st.t), w / 2, py + 94 * sc, 48 * sc, CYAN);
    U.text(c, 'Level ' + st.lvl + '  ·  ' + st.kills + ' defeated', w / 2, py + 134 * sc, 16 * sc, '#cfc6e8', 'center', { font: 'body', shadow: false });
    drawCoinIcon(c, w / 2 - 50 * sc, py + 168 * sc, 9 * sc); U.text(c, '+' + st.coinsRun + (st.doubled ? ' (x2)' : ''), w / 2 - 34 * sc, py + 169 * sc, 24 * sc, YEL, 'left', { font: 'body', shadow: false });
    var bw = pw * 0.82, bh = 48 * sc, yy = py + 200 * sc;
    if (canAd) { if (U.button(c, w / 2 - bw / 2, yy, bw, bh, 'Ad: double coins', { color: VIO, size: 15 * sc })) { var earned = st.coinsRun; PG.rewarded('bonus').then(function (ok) { if (ok) { PG.save.coins += earned; st.coinsRun += earned; st.doubled = true; PG.commit(true); PG.track('rewarded_double_coins', {}); } }); } yy += bh + 10 * sc; }
    if (U.button(c, w / 2 - bw / 2, yy, bw, bh, 'Deploy again', { color: CYAN })) PG.interstitial('game_over').then(function () { PG.go(startRun); });
    if (U.button(c, w / 2 - bw / 2, yy + bh + 10 * sc, bw / 2 - 5 * sc, bh * 0.85, 'Upgrades', { color: MAG, size: 13 * sc })) PG.go(function () { st.state = 'shop'; PG.track('shop_opened', { source: 'game_over' }); });
    if (U.button(c, w / 2 + 5 * sc, yy + bh + 10 * sc, bw / 2 - 5 * sc, bh * 0.85, 'Menu', { color: '#9f8fd0', size: 13 * sc })) PG.go(function () { st.state = 'menu'; });
  }
  function render(c, w, h) {
    var t = PG.time;
    if (st.state === 'menu' || st.state === 'shop') { if (st.state === 'menu') drawMenu(c, w, h, t); else drawShop(c, w, h); }
    else { drawWorld(c, w, h, t); if (st.state === 'play' || st.state === 'levelup') drawHUD(c, w, h); if (st.state === 'levelup') drawLevelUp(c, w, h); if (st.state === 'dead') { drawHUD(c, w, h); drawDead(c, w, h); } }
    scanlines(c, w, h, 0.12); PG.vignette(c, w, h, 0.45);
  }
  PG.onDown = function (x, y) { if (st.state === 'play') st.joy = { x: x, y: y }; };
  PG.onUp = function () { st.joy = null; };
  PG.setup(document.getElementById('c'), update, render);
  window.__bb = { st: st, start: startRun, update: update, pick: pick, pk: pk, gainXP: gainXP };
  PG.init({ id: 'bounce_brigade', version: '1.1.0', defaults: { coins: 0, runs: 0, bestT: 0, kills: 0, up: {}, muted: false } }).then(function () {
    PG.music();
  });
})();
