/* DINO DIG - dig down through ancient layers, unearth fossil bones, build skeletons for your museum.
   Art direction: 16-bit pixel art. The dig site renders into a low-res buffer and is upscaled with hard pixels. */
(function () {
  'use strict';
  var U = PG.ui, TAU = 6.2832, COLS = 6, VROWS = 6;
  var LAYERS = [
    { n: 'Topsoil', a: '#a0724a', b: '#85603c', s: '#c19a6b' }, { n: 'Clay', a: '#c8794a', b: '#b0643a', s: '#e0a070' }, { n: 'Sandstone', a: '#d9b77e', b: '#c4a066', s: '#f0d9a8' },
    { n: 'Limestone', a: '#b9b6a8', b: '#a29f92', s: '#dad7ca' }, { n: 'Shale', a: '#6f7a86', b: '#5d6772', s: '#9aa5b0' }, { n: 'Granite', a: '#9a8c98', b: '#837686', s: '#c9bdc7' },
    { n: 'Basalt', a: '#4a4e5a', b: '#3b3f4a', s: '#7a8090' }, { n: 'Amber Vein', a: '#c98a2b', b: '#b07520', s: '#ffd36b' }, { n: 'Crystal Cave', a: '#5f6fb5', b: '#4c5aa0', s: '#a5b4ff' }, { n: 'Magma Core', a: '#8c2f2a', b: '#74241f', s: '#ff9154' }
  ];
  // kind: biped|quad|wing|shell|plant ; parts = bones needed
  var SP = [
    { id: 'trilo', n: 'Trilobite', kind: 'shell', parts: 3, min: 0, v: 2, size: 0.55 }, { id: 'fern', n: 'Fossil Fern', kind: 'plant', parts: 3, min: 0, v: 2, size: 0.7 },
    { id: 'ammo', n: 'Ammonite', kind: 'shell', parts: 4, min: 5, v: 4, size: 0.7 }, { id: 'raptor', n: 'Velociraptor', kind: 'biped', parts: 5, min: 12, v: 9, size: 0.7, head: 0.9, tail: 1.1 },
    { id: 'ptera', n: 'Pteranodon', kind: 'wing', parts: 5, min: 20, v: 16, size: 0.9 }, { id: 'stego', n: 'Stegosaurus', kind: 'quad', parts: 6, min: 30, v: 28, size: 0.85, plates: true, head: 0.6, tail: 0.9 },
    { id: 'trike', n: 'Triceratops', kind: 'quad', parts: 6, min: 40, v: 40, size: 0.85, horns: true, head: 1.0, tail: 0.5 }, { id: 'saber', n: 'Sabertooth', kind: 'quad', parts: 5, min: 50, v: 60, size: 0.7, fangs: true, head: 0.9, tail: 0.4 },
    { id: 'mammoth', n: 'Mammoth', kind: 'quad', parts: 7, min: 64, v: 90, size: 0.95, tusks: true, head: 1.0, tail: 0.3 }, { id: 'trex', n: 'T-Rex', kind: 'biped', parts: 8, min: 80, v: 150, size: 1.0, head: 1.4, tail: 1.2 },
    { id: 'brachio', n: 'Brachiosaurus', kind: 'quad', parts: 8, min: 100, v: 260, size: 1.0, neck: true, head: 0.5, tail: 0.8 }, { id: 'dragon', n: 'Ancient Dragon', kind: 'wing', parts: 9, min: 130, v: 500, size: 1.1, dragon: true }
  ];
  var UPG = [
    { id: 'pick', n: 'Pickaxe', d: 'More tap power', base: 10, grow: 1.28 }, { id: 'crew', n: 'Dig Crew', d: 'Miners dig for you', base: 25, grow: 1.25 },
    { id: 'brush', n: 'Brush', d: 'More fossils', base: 60, grow: 1.6, max: 20 }, { id: 'cash', n: 'Gold Pan', d: '+12% cash', base: 90, grow: 1.55 },
    { id: 'tnt', n: 'Dynamite', d: 'Faster Boom! recharge', base: 150, grow: 1.9, max: 12 }, { id: 'ticket', n: 'Tickets', d: '+12% museum income', base: 120, grow: 1.7 }
  ];
  var st = { state: 'play', rows: [], row0: 0, scroll: 0, cash: 0, hitCd: 0, crewAcc: 0, crewT: 0, tntCd: 0, tntFx: 0, bones: [], flying: [], boost: 0, boostUsed: 0, lastT: 0, popup: null, tab: 'dig', welcome: null, dps: 0, fossilsFound: 0, depthMax: 0, fx: [], swing: 0, hero: { t: 0 }, shake: 0 };
  var geo = {}; var sparkle = []; for (var i = 0; i < 20; i++) sparkle.push({ x: Math.random(), y: Math.random(), p: Math.random() * 9 });

  /* ---------- economy ---------- */
  function lv(id) { return (PG.save.u && PG.save.u[id]) || 0; }
  function cost(u) { var L = lv(u.id); return Math.round(u.base * Math.pow(u.grow, L)); }
  function tapDmg() { var L = lv('pick'); return (1 + 0.8 * L) * Math.pow(1.045, L) * (1 + 0.05 * done()); }
  function crewDps() { var L = lv('crew'); return L * 0.7 * Math.pow(1.05, L) * (1 + 0.04 * lv('pick')); }
  function cashMul() { return Math.pow(1.12, lv('cash')) * (1 + 0.05 * done()) * (st.boost > 0 ? 2 : 1); }
  function tntCool() { return Math.max(6, 35 - lv('tnt') * 2.5); }
  function museumIncome() { var s = 0; SP.forEach(function (sp) { if (complete(sp)) s += sp.v; }); return s * (1 + 0.12 * lv('ticket')); }
  function done() { return SP.filter(complete).length; }
  function got(sp) { return (PG.save.f && PG.save.f[sp.id]) || []; }
  function complete(sp) { return got(sp).length >= sp.parts; }
  function blockHp(r) { return 3 * Math.pow(1.12, r); }
  function blockCash(r) { return (1.5 + blockHp(r) * 0.4); }
  function layerOf(r) { return LAYERS[Math.floor(r / 20) % LAYERS.length]; }

  /* ---------- rows ---------- */
  function makeRow(r) {
    var row = []; var tier = Math.floor(r / 20), fossilChance = (0.06 + 0.012 * lv('brush')) * (r < 2 ? 0 : 1);
    for (var c = 0; c < COLS; c++) { var hp = blockHp(r) * PG.rand(0.9, 1.15), f = -1; if (Math.random() < fossilChance) { f = pickSpecies(r); } row.push({ hp: hp, mhp: hp, f: f, part: f >= 0 ? pickPart(f) : -1, dead: false, sh: 0, flash: 0, sp: Math.random() }); }
    return row;
  }
  function pickSpecies(r) { var pool = SP.map(function (s, i) { return i; }).filter(function (i) { return SP[i].min <= r && !complete(SP[i]); }); if (!pool.length) return -1; var w = pool.map(function (i) { return 1 / (1 + SP[i].parts * 0.4); }), tot = w.reduce(function (a, b) { return a + b; }, 0), x = Math.random() * tot; for (var k = 0; k < pool.length; k++) { x -= w[k]; if (x <= 0) return pool[k]; } return pool[0]; }
  function pickPart(i) { var sp = SP[i], have = got(sp), missing = []; for (var p = 0; p < sp.parts; p++) if (have.indexOf(p) < 0) missing.push(p); return missing.length ? PG.pick(missing) : -1; }
  function fillRows() { while (st.rows.length < VROWS + 2) st.rows.push(makeRow(st.row0 + st.rows.length)); }
  function resetRows() { st.rows = []; fillRows(); }

  /* ---------- actions ---------- */
  function hitBlock(r, c, dmg, tap) {
    var b = st.rows[r] && st.rows[r][c]; if (!b || b.dead) return; b.hp -= dmg; b.sh = 1; b.flash = 0.1;
    if (tap) { st.swing = 1; PG.sfx('hit', 0.9 + Math.random() * 0.4); var p = blockPos(r, c); PG.burst(p.x, p.y, 3, { colors: [layerOf(st.row0 + r).s, '#fff'], g: 500, min: 30, max: 120, life: 0.4, shape: pixShape }); }
    if (b.hp <= 0) breakBlock(r, c);
  }
  function breakBlock(r, c) {
    var b = st.rows[r][c]; b.dead = true; var rowIdx = st.row0 + r, p = blockPos(r, c), cash = blockCash(rowIdx) * cashMul(); st.cash += cash; PG.save.total = (PG.save.total || 0) + cash;
    PG.burst(p.x, p.y, 10, { colors: [layerOf(rowIdx).a, layerOf(rowIdx).s, '#fff'], g: 600, min: 40, max: 200, life: 0.7, s0: 2, s1: 5, shape: pixShape }); PG.sfx('pop', 0.6 + Math.random() * 0.3); PG.popText(p.x, p.y - 8, '+' + PG.fmt(cash), '#ffe066', 15);
    if (b.f >= 0 && b.part >= 0) { var sp = SP[b.f]; if (!complete(sp) && got(sp).indexOf(b.part) < 0) { st.flying.push({ x: p.x, y: p.y, t: 0, sp: b.f, part: b.part }); PG.sfx('bell'); PG.burst(p.x, p.y, 16, { colors: ['#fff', '#ffe9a8'], g: 0, min: 40, max: 160, life: 0.8, shape: pixShape }); } else st.cash += cash * 2; }
    while (st.rows[0].every(function (x) { return x.dead; })) advance(); // dynamite can clear several rows at once
  }
  function advance() {
    st.rows.shift(); st.row0++; st.scroll = 1; fillRows(); var dm = st.row0; if (dm > (PG.save.depth || 0)) { PG.save.depth = dm; if (dm % 10 === 0) { PG.track('depth_milestone', { depth: dm }); PG.msg('player_got_achievement'); } if (dm % 20 === 0) { st.layerBanner = { n: layerOf(dm).n, t: 0 }; PG.sfx('win'); } } PG.commit();
  }
  function collect(f) {
    var sp = SP[f.sp]; var arr = PG.save.f[sp.id] = PG.save.f[sp.id] || []; if (arr.indexOf(f.part) < 0) arr.push(f.part); st.fossilsFound++; PG.commit(true); PG.sfx('upgrade');
    if (arr.length >= sp.parts) { st.popup = { sp: sp, t: 0 }; PG.sfx('win'); PG.track('species_completed', { species: sp.id, depth: Math.min(st.row0, 300) }); PG.msg('player_got_achievement'); st.rows.forEach(function (row) { row.forEach(function (b) { if (b.f === SP.indexOf(sp)) { b.f = -1; b.part = -1; } }); }); }
  }
  function buy(u) { var c0 = cost(u), L = lv(u.id); if (u.max && L >= u.max) return; if (st.cash < c0) { PG.sfx('err'); return; } st.cash -= c0; PG.save.u = PG.save.u || {}; PG.save.u[u.id] = L + 1; PG.sfx('upgrade'); PG.commit(); PG.track('upgrade_purchased', { upgrade_id: u.id, level: L + 1 }); }
  function boom() { if (st.tntCd > 0) return; st.tntCd = tntCool(); st.tntFx = 1; st.shake = 14; PG.sfx('boom'); PG.vibrate(30); var power = tapDmg() * (6 + lv('tnt')); for (var r = 0; r < 3 && r < st.rows.length; r++) for (var c = 0; c < COLS; c++) hitBlock(r, c, power * (r === 0 ? 1 : 0.6), false); for (var i = 0; i < 24; i++) { var p = blockPos(PG.ri(0, 2), PG.ri(0, COLS - 1)); PG.burst(p.x, p.y, 3, { colors: ['#ffb703', '#ff6b6b', '#fff'], g: 300, min: 80, max: 320, life: 0.7, shape: pixShape }); } }
  function boostAd() { if (st.boost > 0 || st.boostUsed >= 4) return; PG.rewarded('bonus').then(function (ok) { if (ok) { st.boost = 120; st.boostUsed++; PG.track('rewarded_cash_boost', {}); PG.popText(geo.areaW / 2, geo.top + 40, 'x2 cash for 2 min!', '#8cff66', 24); } }); }

  /* ---------- layout ---------- */
  function layout(w, h) { // portrait: shop under the dig; landscape: shop on the right
    var sc = PG.scale(), land = w > h * 1.1; geo.land = land; geo.sc = sc; geo.hud = 58 * sc; geo.cavity = 84 * sc; geo.top = geo.hud + geo.cavity;
    if (land) { geo.pw = Math.min(w * 0.38, 330 * sc); geo.px = w - geo.pw; geo.py = geo.hud; geo.ph = h - geo.hud; geo.areaW = geo.px; geo.bottom = h; }
    else { geo.ph = Math.min(h * 0.34, 214 * sc); geo.px = 0; geo.pw = w; geo.py = h - geo.ph; geo.areaW = w; geo.bottom = geo.py; }
    var availH = geo.bottom - geo.top, availW = Math.min(geo.areaW, 560 * sc), bs = Math.min(availW / COLS, availH / VROWS), snap = bs >= 32 ? 16 : 8;
    geo.bs = Math.max(snap, Math.floor(bs / snap) * snap); geo.P = geo.bs / 16; geo.gx = Math.round((geo.areaW - geo.bs * COLS) / 2); geo.gy = Math.round(geo.top); geo.panelY = geo.py; geo.panelH = geo.ph;
  }
  function blockPos(r, c) { return { x: geo.gx + c * geo.bs + geo.bs / 2, y: geo.gy + (r + (st.scroll || 0)) * geo.bs + geo.bs / 2 }; }

  /* ---------- update ---------- */
  function update(dt) {
    PG.updateParts(dt); PG.updatePops(dt); st.hero.t += dt; st.swing = Math.max(0, st.swing - dt * 6); st.shake = Math.max(0, st.shake - dt * 30); st.tntFx = Math.max(0, st.tntFx - dt * 2); if (st.layerBanner) { st.layerBanner.t += dt; if (st.layerBanner.t > 2.4) st.layerBanner = null; }
    if (st.scroll > 0) st.scroll = Math.max(0, st.scroll - dt * 5.5);
    if (st.popup) { st.popup.t += dt; }
    if (st.state !== 'play' && st.state !== 'museum') return;
    if (st.tntCd > 0) st.tntCd -= dt; if (st.boost > 0) st.boost -= dt; st.hitCd -= dt;
    st.cash += museumIncome() * cashMul() * 0.35 * dt * (1);
    // crew
    var dps = crewDps(); st.dps = dps; if (dps > 0 && st.state === 'play') { st.crewAcc += dps * dt; st.crewT += dt; if (st.crewT >= 0.22) { st.crewT = 0; var amt = st.crewAcc; st.crewAcc = 0; for (var k = 0; k < 2; k++) { var cs = []; for (var r = 0; r < Math.min(3, st.rows.length); r++) for (var c = 0; c < COLS; c++) if (!st.rows[r][c].dead) cs.push([r, c]); if (cs.length) { var t = cs[Math.floor(Math.random() * Math.min(cs.length, 8))]; hitBlock(t[0], t[1], amt / 2, false); } } } }
    st.rows.forEach(function (row) { row.forEach(function (b) { b.sh = Math.max(0, b.sh - dt * 8); b.flash = Math.max(0, b.flash - dt); }); });
    for (var i = st.flying.length - 1; i >= 0; i--) { var f = st.flying[i]; f.t += dt * 1.4; if (f.t >= 1) { collect(f); st.flying.splice(i, 1); } }
    PG.save.t = Date.now(); st.autoSave = (st.autoSave || 0) + dt; if (st.autoSave > 8) { st.autoSave = 0; PG.save.cash = st.cash; PG.commit(); }
  }

  /* ---------- pixel sprites ---------- */
  var INK = '#1a1020', BONE = '#f4ead2';
  var PAL = { G: '#9aa3b5', g: '#5d6476', W: '#8a5a33', w: '#5e3a1e', Y: '#ffcc33', y: '#c98a1a', L: '#fff6b0', S: '#f2c9a0', s: '#c98f6a', E: '#222034', B: BONE, b: '#c9bb98', O: '#ffd700', o: '#b8860b', R: '#d63b3b', r: '#8f2424', F: '#ffb03b', T: '#ffcf5c', t: '#c99a2e', P: '#4a3a2a', K: '#2a1d14', X: '#e8d5a0' };
  var SPR = {
    pick: ['..GGGGG.', '.Gg.WW.G', 'G...WW..', '....WW..', '....WW..', '....WW..', '....ww..', '........'],
    crew: ['...YY...', '..YLLY..', '.YYYYYY.', 'YyyyyyyY', '.SSSSSS.', '.SESSES.', '..SsSS..', '........'],
    brush: ['...WW...', '...WW...', '...ww...', '..GGGG..', '.XXXXXX.', '.XXXXXX.', '.X.X.X.X', '........'],
    cash: ['........', '...OO...', '..OoOO..', 'G..OO..G', 'GG....GG', '.GGGGGG.', '..gggg..', '........'],
    tnt: ['......F.', '.....W..', '.RRRRW..', '.RrRR...', '.RLLR...', '.RRRR...', '.rrrr...', '........'],
    ticket: ['........', 'TTTTTTTT', 'T.TTTT.T', 'TTTttTTT', 'TTTttTTT', 'T.TTTT.T', 'TTTTTTTT', '........'],
    bone: ['BB.....BB', 'BBBBBBBBB', '.bBBBBBb.', 'BBBBBBBBB', 'BB.....BB'],
    coin: ['..OOO..', '.OLOOO.', 'OLOOOoO', 'OOOOOoO', 'OOOOOoO', '.OOoOo.', '..ooo..'],
    miner: ['...yYYy...', '..yYLLYy..', '.yyyyyyyy.', '...SSSS...', '...ESSE...', '...SSSS...', '....ss....', '..BBBBBB..', '.SBBBBBBS.', '.SBbBBbBS.', '..BBBBBB..', '..PPPPPP..', '..PP..PP..', '..PP..PP..', '.KKK..KKK.']
  };
  var sprCache = {};
  function sprite(name, shirt) {
    var key = name + (shirt || ''); if (sprCache[key]) return sprCache[key]; var rows = SPR[name], cv = document.createElement('canvas'); cv.width = rows[0].length; cv.height = rows.length; var c = cv.getContext('2d');
    for (var y = 0; y < rows.length; y++) for (var x = 0; x < rows[y].length; x++) { var ch = rows[y][x]; if (ch === '.') continue; c.fillStyle = shirt && ch === 'B' ? shirt[0] : shirt && ch === 'b' ? shirt[1] : PAL[ch]; c.fillRect(x, y, 1, 1); }
    return (sprCache[key] = cv);
  }
  function drawSprite(c, name, x, y, px, shirt) { var s = sprite(name, shirt); c.imageSmoothingEnabled = false; c.drawImage(s, Math.round(x), Math.round(y), s.width * px, s.height * px); }
  function pixShape(c, p, k) { var P = geo.P || 2, s = Math.max(P, Math.round(p.size * (0.4 + 0.6 * k) / P) * P); c.fillRect(Math.round(p.x / P) * P, Math.round(p.y / P) * P, s, s); }
  function shade(hex, f) { var n = parseInt(hex.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255; function m(v) { return Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f))); } return 'rgb(' + m(r) + ',' + m(g) + ',' + m(b) + ')'; }

  /* ---------- 16x16 block tiles per layer ---------- */
  var tiles = {};
  function tile(li, v) {
    var key = li + ':' + v; if (tiles[key]) return tiles[key]; var L = LAYERS[li], cv = document.createElement('canvas'); cv.width = cv.height = 16; var c = cv.getContext('2d'), rnd = PG.mulberry(li * 31 + v * 7 + 1);
    c.fillStyle = v % 2 ? L.a : L.b; c.fillRect(0, 0, 16, 16);
    for (var i = 0; i < 26; i++) { c.fillStyle = rnd() < 0.5 ? (v % 2 ? L.b : L.a) : shade(L.a, -0.25); c.fillRect(Math.floor(rnd() * 16), Math.floor(rnd() * 16), 1, 1); }
    for (i = 0; i < 2 + Math.floor(rnd() * 2); i++) { var px = 2 + Math.floor(rnd() * 11), py = 2 + Math.floor(rnd() * 11); c.fillStyle = L.s; c.fillRect(px, py, 2, 1); c.fillStyle = shade(L.b, -0.3); c.fillRect(px, py + 1, 2, 1); }
    if (li === 7) { c.fillStyle = '#ffd36b'; c.fillRect(3 + v * 3 % 8, 5, 3, 2); c.fillStyle = '#ffe9a8'; c.fillRect(4 + v * 3 % 8, 5, 1, 1); }
    if (li === 8) { c.fillStyle = '#a5b4ff'; c.fillRect(5 + v % 5, 3, 1, 4); c.fillRect(4 + v % 5, 5, 3, 1); c.fillStyle = '#e8ecff'; c.fillRect(5 + v % 5, 3, 1, 1); }
    if (li === 9) { c.fillStyle = '#ff9154'; c.fillRect(2 + v * 5 % 10, 9, 4, 1); c.fillRect(3 + v * 5 % 10, 10, 2, 1); c.fillStyle = '#ffd36b'; c.fillRect(3 + v * 5 % 10, 9, 1, 1); }
    c.fillStyle = 'rgba(255,255,255,.22)'; c.fillRect(0, 0, 16, 1); c.fillRect(0, 0, 1, 16);
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, 15, 16, 1); c.fillRect(15, 0, 1, 16);
    return (tiles[key] = cv);
  }
  var CRACKS = [[], [[8, 1], [8, 2], [7, 3], [7, 4], [8, 5], [9, 6], [9, 7]], [[8, 1], [8, 2], [7, 3], [7, 4], [8, 5], [9, 6], [9, 7], [10, 8], [9, 9], [6, 5], [5, 6], [4, 6], [3, 7], [10, 7], [11, 6], [12, 6]], [[8, 1], [8, 2], [7, 3], [7, 4], [8, 5], [9, 6], [9, 7], [10, 8], [9, 9], [9, 10], [8, 11], [8, 12], [6, 5], [5, 6], [4, 6], [3, 7], [2, 8], [10, 7], [11, 6], [12, 6], [13, 5], [7, 10], [6, 11], [5, 12], [11, 10], [12, 11]]];
  var pix = null, pc = null, cav = null, cc = null;
  function buffer(cv, w, h) { if (!cv) cv = document.createElement('canvas'); if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; } return cv; }
  function renderGrid(t) { // dig site at 16px per block, upscaled later
    var W = COLS * 16, H = (VROWS + 2) * 16; pix = buffer(pix, W, H); pc = pix.getContext('2d'); pc.imageSmoothingEnabled = false;
    pc.fillStyle = '#120c1c'; pc.fillRect(0, 0, W, H); var off = Math.round((st.scroll || 0) * 16);
    for (var r = 0; r < st.rows.length; r++) for (var c = 0; c < COLS; c++) {
      var b = st.rows[r][c], x = c * 16, y = r * 16 + off; if (y >= H) continue; var rowIdx = st.row0 + r;
      if (b.dead) { pc.fillStyle = '#1d1426'; pc.fillRect(x, y, 16, 16); pc.fillStyle = '#140d1c'; for (var d = 0; d < 16; d += 2) pc.fillRect(x + ((d / 2 + rowIdx) % 2) * 1, y + d, 16, 1); continue; }
      var sh = b.sh > 0.2 ? (Math.floor(t * 60) % 2 ? 1 : -1) : 0, li = Math.floor(rowIdx / 20) % LAYERS.length;
      pc.drawImage(tile(li, (rowIdx * 7 + c * 3) % 4), x + sh, y);
      if (b.f >= 0 && b.part >= 0) { pc.globalAlpha = 0.45 + 0.35 * Math.sin(t * 3 + b.sp * 9); pc.drawImage(sprite('bone'), x + 3 + sh, y + 6); pc.globalAlpha = 1; }
      var dmg = 1 - Math.max(0, b.hp) / b.mhp, stage = dmg > 0.7 ? 3 : dmg > 0.4 ? 2 : dmg > 0.05 ? 1 : 0;
      if (stage) { pc.fillStyle = 'rgba(10,6,16,.7)'; CRACKS[stage].forEach(function (q) { pc.fillRect(x + q[0] + sh, y + q[1], 1, 1); }); }
      if (b.flash > 0) { pc.fillStyle = 'rgba(255,255,255,' + Math.min(0.8, b.flash * 6) + ')'; pc.fillRect(x + 1 + sh, y + 1, 14, 14); }
    }
    if (st.tntFx > 0) { pc.fillStyle = 'rgba(255,200,90,' + st.tntFx * 0.45 + ')'; pc.fillRect(0, 0, W, H); }
  }
  function renderCavity(w, t) { // mine shaft above the blocks with the crew
    var P = geo.P, W = Math.ceil(geo.areaW / P), H = Math.ceil(geo.cavity / P); cav = buffer(cav, W, H); cc = cav.getContext('2d'); cc.imageSmoothingEnabled = false;
    cc.fillStyle = '#21162c'; cc.fillRect(0, 0, W, H); var rnd = PG.mulberry(3);
    for (var y = 0; y < H; y += 5) for (var x = -((y / 5) % 2) * 6; x < W; x += 12) { cc.fillStyle = (x + y) % 3 ? '#2a1c37' : '#2e2040'; cc.fillRect(x + 1, y + 1, 10, 3); }
    for (var i = 0; i < 30; i++) { cc.fillStyle = '#3a2a4a'; cc.fillRect(Math.floor(rnd() * W), Math.floor(rnd() * H), 1, 1); }
    var gx = geo.gx / P, gw = COLS * 16 * geo.bs / 16 / P;
    [gx + 2, gx + gw - 5].forEach(function (px) { cc.fillStyle = '#5e3a1e'; cc.fillRect(Math.round(px), 3, 3, H - 3); cc.fillStyle = '#8a5a33'; cc.fillRect(Math.round(px), 3, 2, H - 3); });
    cc.fillStyle = '#5e3a1e'; cc.fillRect(Math.round(gx), 2, Math.round(gw), 3); cc.fillStyle = '#8a5a33'; cc.fillRect(Math.round(gx), 2, Math.round(gw), 2);
    var lx = Math.round(gx + 10), fl = Math.floor(t * 8) % 3; cc.fillStyle = '#3a2a1a'; cc.fillRect(lx, 5, 1, 3); cc.fillStyle = 'rgba(255,200,90,.10)'; for (var r = 14 + fl; r > 4; r -= 4) { cc.beginPath(); cc.arc(lx, 11, r, 0, TAU); cc.fill(); }
    cc.fillStyle = '#5d6476'; cc.fillRect(lx - 2, 8, 5, 6); cc.fillStyle = fl ? '#ffd36b' : '#fff6b0'; cc.fillRect(lx - 1, 9, 3, 4);
    var n = Math.min(lv('crew'), 7), total = n + 1, ground = H, shirts = [['#e07a5f', '#b85a42'], ['#81b29a', '#5e8f78'], ['#f2cc8f', '#c9a66b'], ['#a98467', '#7d6049']];
    for (var k = 0; k < total; k++) {
      var hero = k === Math.floor(total / 2), mx = Math.round(gx + (k + 0.5) / total * gw) - 5, sw = hero ? st.swing : (Math.sin(t * 5 + k * 1.7) * 0.5 + 0.5), bob = Math.floor(t * 4 + k) % 2;
      drawSprite(cc, 'miner', mx, ground - 15 - bob, 1, hero ? ['#3a86ff', '#2a5fbf'] : shirts[k % 4]);
      cc.save(); cc.translate(mx + 8, ground - 8 - bob); cc.rotate(-1.4 + sw * 2.0); cc.fillStyle = '#8a5a33'; cc.fillRect(0, 0, 8, 1); cc.fillStyle = '#9aa3b5'; cc.fillRect(7, -3, 2, 7); cc.restore();
    }
  }

  /* ---------- skeletons (vector bones baked small, then shown as pixels) ---------- */
  function drawBone(c, x1, y1, x2, y2, w) { c.strokeStyle = BONE; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.fillStyle = BONE; c.beginPath(); c.arc(x1, y1, w * 0.85, 0, TAU); c.arc(x2, y2, w * 0.85, 0, TAU); c.fill(); }
  function drawSkeleton(c, sp, x, y, s, n) {
    c.save(); c.translate(x, y); c.scale(s, s); var full = n >= sp.parts, show = function (p) { return full || p < n; }, w = 3.4;
    var bone = function (a, b, c2, d, ww) { drawBone(c, a, b, c2, d, ww || w); };
    if (sp.kind === 'shell') { var rings = sp.parts + 2; c.strokeStyle = BONE; c.lineCap = 'round'; for (var i = 0; i < rings; i++) { if (!show(Math.min(i, sp.parts - 1)) && !full) continue; var a = i * 0.7 - 1.2, rr = 6 + i * 4.5; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, rr, sp.id === 'ammo' ? a : -2.2, sp.id === 'ammo' ? a + 4.2 : 2.2); c.stroke(); } if (sp.id === 'trilo') { for (i = -3; i <= 3; i++) { if (!full && n < 2) break; bone(i * 6 - 2, -14 + Math.abs(i), i * 6 - 2, 14 - Math.abs(i), 2.4); } bone(-24, 0, 24, 0, 2.6); c.fillStyle = BONE; c.beginPath(); c.ellipse(-26, 0, 6, 10, 0, 0, TAU); c.fill(); } }
    else if (sp.kind === 'plant') { for (var f = -3; f <= 3; f++) { if (!full && Math.abs(f) > n) continue; var ang = -1.57 + f * 0.32; for (var j = 1; j < 7; j++) { var px = Math.cos(ang) * j * 6 + f * 1.5, py = -2 + Math.sin(ang) * j * 6 + 20; bone(px, py, px + Math.cos(ang + 1) * 7, py + Math.sin(ang + 1) * 7, 1.6); bone(px, py, px + Math.cos(ang - 1) * 7, py + Math.sin(ang - 1) * 7, 1.6); } } bone(0, 20, 0, 36, 3); }
    else if (sp.kind === 'wing') { var drag = !!sp.dragon; if (show(0)) bone(-8, 0, 14, -3, 4); if (show(1)) { c.fillStyle = BONE; c.beginPath(); c.ellipse(24, -4, 10, 5, -0.2, 0, TAU); c.fill(); bone(32, -4, 46 + (drag ? 6 : 14), -2, 2); } if (show(2)) { bone(0, 0, -38, -26, 3); bone(-38, -26, -64, -4, 3); } if (show(3)) { bone(0, 0, 38, -26, 3); bone(38, -26, 62, -2, 3); } if (show(4)) { for (var q = 0; q < 5; q++) bone(-38 + q * 6, -26 + q * 5, -40 + q * 14, 4 + q * 3, 1.4); } if (show(0)) bone(-8, 0, -30, 14, 2.4); if (drag) { for (q = 5; q < sp.parts; q++) if (show(q)) bone(-4 + q * 3, 4, -20 + q * 5, 20, 2.2); } }
    else {
      var spine = sp.kind === 'biped' ? 60 : 78, lx = -spine / 2, hx = spine / 2, hy = 0, neckUp = sp.neck ? -46 : (sp.kind === 'biped' ? -16 : -4);
      if (show(0)) { bone(lx, 0, hx, hy, 4.6); for (var rb = 0; rb < 5; rb++) bone(lx + 14 + rb * 9, 0, lx + 12 + rb * 9, 12 + Math.sin(rb / 4 * 3) * 4, 2.2); }
      if (show(1)) { var hs = (sp.head || 1) * 11; bone(hx, hy, hx + 8, hy + neckUp, 4); c.fillStyle = BONE; c.beginPath(); c.ellipse(hx + 12 + hs * 0.3, hy + neckUp - 2, hs, hs * 0.62, -0.1, 0, TAU); c.fill(); c.fillStyle = '#1b1b2b'; c.beginPath(); c.arc(hx + 9 + hs * 0.3, hy + neckUp - 4, 1.9, 0, TAU); c.fill(); if (sp.horns) { bone(hx + 20, hy + neckUp - 8, hx + 38, hy + neckUp - 22, 2.6); bone(hx + 14, hy + neckUp - 8, hx + 24, hy + neckUp - 26, 2.6); } if (sp.tusks) bone(hx + 30, hy + neckUp + 2, hx + 46, hy + neckUp + 18, 2.6); if (sp.fangs) bone(hx + 22, hy + neckUp + 4, hx + 23, hy + neckUp + 14, 2); }
      if (show(2)) { var tl = (sp.tail || 0.5) * 38; bone(lx, 0, lx - tl * 0.6, 8, 3.6); bone(lx - tl * 0.6, 8, lx - tl, 6, 2.6); }
      if (show(3)) { (sp.kind === 'biped' ? [lx + 26] : [lx + 8, lx + 18]).forEach(function (l0) { bone(l0, 4, l0 + 2, 24, 3.6); bone(l0 + 2, 24, l0 - 4, 40, 3); bone(l0 - 4, 40, l0 + 6, 42, 2.4); }); }
      if (show(4)) { (sp.kind === 'biped' ? [lx + 40] : [hx - 18, hx - 8]).forEach(function (l1) { bone(l1, 4, l1 - 1, 24, 3.6); bone(l1 - 1, 24, l1 + 3, 40, 3); bone(l1 + 3, 40, l1 + 12, 42, 2.4); }); }
      if (show(5) && sp.plates) { for (var pl = 0; pl < 6; pl++) { c.fillStyle = BONE; c.beginPath(); c.moveTo(lx + 8 + pl * 12, -6); c.lineTo(lx + 14 + pl * 12, -22 - (pl % 3) * 3); c.lineTo(lx + 20 + pl * 12, -6); c.fill(); } }
      if (show(5) && sp.kind === 'biped') bone(hx - 8, 6, hx + 6, 16, 2.2);
      if (show(6)) { bone(hx - 14, hy, hx - 14, hy - 12, 2); bone(lx + 12, 0, lx + 12, -12, 2); }
      if (show(7)) { for (var k2 = 0; k2 < 4; k2++) bone(lx + 6 + k2 * 5, -2, lx + 4 + k2 * 5, -10 - k2, 1.6); }
    }
    c.restore();
  }
  var skelCache = {};
  function pixelSkeleton(c, sp, x, y, w, h, n) { // bake at ~1/4 size with an outline, blow it up with hard pixels
    var q = Math.max(2, Math.round(Math.min(w, h) / 40)), W = Math.max(8, Math.round(w / q)), H = Math.max(8, Math.round(h / q)), key = sp.id + n + 'x' + W + 'x' + H, cv = skelCache[key];
    if (!cv) {
      var raw = document.createElement('canvas'); raw.width = W; raw.height = H; var r = raw.getContext('2d'); r.imageSmoothingEnabled = false; drawSkeleton(r, sp, W / 2, H / 2, Math.min(W, H) / 120 * sp.size * 1.25, n);
      var id = r.getImageData(0, 0, W, H), d = id.data; for (var i = 0; i < d.length; i += 4) { if (d[i + 3] > 90) { d[i] = 244; d[i + 1] = 234; d[i + 2] = 210; d[i + 3] = 255; } else d[i + 3] = 0; }
      cv = document.createElement('canvas'); cv.width = W + 2; cv.height = H + 2; var o = cv.getContext('2d'), out = o.createImageData(W + 2, H + 2), od = out.data;
      for (var yy = 0; yy < H + 2; yy++) for (var xx = 0; xx < W + 2; xx++) { var sx = xx - 1, sy = yy - 1, at = function (a, b) { return a >= 0 && b >= 0 && a < W && b < H && d[(b * W + a) * 4 + 3] > 0; }, k = (yy * (W + 2) + xx) * 4;
        if (at(sx, sy)) { var lit = !at(sx - 1, sy - 1); od[k] = lit ? 255 : 236; od[k + 1] = lit ? 250 : 222; od[k + 2] = lit ? 235 : 190; od[k + 3] = 255; }
        else if (at(sx - 1, sy) || at(sx + 1, sy) || at(sx, sy - 1) || at(sx, sy + 1)) { od[k] = 26; od[k + 1] = 16; od[k + 2] = 32; od[k + 3] = 255; } }
      o.putImageData(out, 0, 0); skelCache[key] = cv;
    }
    c.imageSmoothingEnabled = false; c.drawImage(cv, Math.round(x - (W + 2) * q / 2), Math.round(y - (H + 2) * q / 2), (W + 2) * q, (H + 2) * q); c.imageSmoothingEnabled = true;
  }

  /* ---------- theme: chunky pixel boxes ---------- */
  function pbox(c, x, y, w, h, col, o) { // notched-corner pixel panel
    o = o || {}; var u = Math.max(2, Math.round(2 * PG.scale())); x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(x + u, y + h, w - u, u); c.fillRect(x + w, y + u, u, h - u);
    c.fillStyle = INK; c.fillRect(x + u, y, w - 2 * u, h); c.fillRect(x, y + u, w, h - 2 * u);
    c.fillStyle = col; c.fillRect(x + u, y + u, w - 2 * u, h - 2 * u);
    c.fillStyle = o.hi || shade(col, 0.28); c.fillRect(x + u, y + u, w - 2 * u, u); c.fillRect(x + u, y + u, u, h - 2 * u);
    c.fillStyle = o.lo || shade(col, -0.3); c.fillRect(x + u, y + h - 2 * u, w - 2 * u, u); c.fillRect(x + w - 2 * u, y + u, u, h - 2 * u);
  }
  PG.theme.font = 'Pixelify Sans'; PG.theme.body = 'Pixelify Sans'; PG.theme.weight = '700'; PG.theme.bodyWeight = '500'; PG.theme.text = '#fff4d6'; PG.theme.textShadow = 'rgba(0,0,0,.6)'; PG.theme.pageColor = '#0d0814';
  PG.theme.transition = { style: 'pixel', color: '#0d0814', time: 0.4 };
  PG.theme.popStyle = { stroke: INK };
  PG.theme.button = function (c, x, y, w, h, label, o, s) { var u = Math.max(2, Math.round(2 * PG.scale())), off = s.press ? u : 0, col = o.disabled ? '#6b6560' : o.color || '#3a86ff'; pbox(c, x, y + off, w, h - off, s.hover ? shade(col, 0.12) : col); if (label) U.text(c, label, x + w / 2, y + off + h / 2, U.fit(c, label, o.size || Math.min(h * 0.42, 22), w - 14), '#fff', 'center', { shadow: 'rgba(0,0,0,.55)' }); };
  PG.theme.panel = function (c, x, y, w, h, o) { pbox(c, x, y, w, h, (o && o.fill) || '#3b2a4a'); };
  PG.theme.hudButton = function (c, x, y, r, kind) { pbox(c, x - r, y - r, r * 2, r * 2, '#3b2a4a'); PG.hudIcon(c, x, y, r * 0.9, kind, '#fff4d6'); };
  PG.theme.loading = function (c, w, h, t) { c.fillStyle = '#0d0814'; c.fillRect(0, 0, w, h); for (var i = 0; i < 3; i++) { var by = Math.round(h / 2 - Math.abs(Math.sin(t * 5 + i)) * 16); c.fillStyle = ['#a0724a', '#c8794a', '#d9b77e'][i]; c.fillRect(Math.round(w / 2 - 30 + i * 22), by, 16, 16); } };

  /* ---------- screens ---------- */
  function drawHUD(c, w, h, sc) {
    c.fillStyle = '#2b1d26'; c.fillRect(0, 0, w, geo.hud); c.fillStyle = INK; c.fillRect(0, geo.hud - 3, w, 3); c.fillStyle = '#3d2a36'; c.fillRect(0, 0, w, 3);
    var px = Math.max(2, Math.round(2.6 * sc)); drawSprite(c, 'coin', 12 * sc, 10 * sc, px); U.text(c, PG.fmt(st.cash), 12 * sc + 7 * px + 8 * sc, 20 * sc, 22 * sc, '#ffd700', 'left');
    var inc = museumIncome() * cashMul() * 0.35; U.text(c, (st.dps > 0 ? PG.fmt(st.dps * (st.rows[0] ? blockCash(st.row0) / blockHp(st.row0) : 1) * cashMul() + inc) + '/s' : (inc > 0 ? PG.fmt(inc) + '/s' : 'tap to dig!')), 14 * sc, 44 * sc, 13 * sc, '#c9b8a4', 'left', { font: 'body', shadow: false });
    if (st.boost > 0) U.text(c, 'x2 ' + Math.ceil(st.boost) + 's', w * 0.5, 22 * sc, 15 * sc, '#8cff66', 'center');
    var bw = 104 * sc, bh = 38 * sc; if (U.button(c, w - 134 * sc - bw, 10 * sc, bw, bh, 'Museum', { color: '#8a4fd8', size: 16 * sc })) PG.go(function () { st.state = 'museum'; PG.track('museum_opened', { species: done() }); });
  }
  function drawPanel(c, w, h, sc) {
    var x0p = geo.px, y0 = geo.py, pw = geo.pw, ph = geo.ph; c.fillStyle = '#2b1d26'; c.fillRect(x0p, y0, pw, ph); c.fillStyle = INK; if (geo.land) c.fillRect(x0p, y0, 3, ph); else c.fillRect(x0p, y0, pw, 3);
    var cols = geo.land ? 1 : (w > 700 * sc ? 3 : 2), rows = Math.ceil(UPG.length / cols), pad = 8 * sc, inner = Math.min(pw, 620 * sc) - pad * (cols + 1), bw = inner / cols, foot = 52 * sc, bh = Math.min((ph - foot - pad * (rows + 1)) / rows, 52 * sc), x0 = x0p + (pw - Math.min(pw, 620 * sc)) / 2 + pad;
    UPG.forEach(function (u, i) { var cx = x0 + (i % cols) * (bw + pad), cy = y0 + pad + 4 + Math.floor(i / cols) * (bh + pad), c0 = cost(u), L = lv(u.id), maxed = u.max && L >= u.max, can = st.cash >= c0 && !maxed;
      if (U.button(c, cx, cy, bw, bh, '', { color: can ? '#2a9d8f' : maxed ? '#5e7d4a' : '#5a4f5e' })) buy(u);
      var ip = Math.max(2, Math.floor(bh * 0.6 / 8)); drawSprite(c, u.id, cx + 8 * sc, cy + (bh - 8 * ip) / 2 - 1, ip);
      var tx = cx + 14 * sc + 8 * ip, ts = Math.min(14 * sc, bh * 0.3);
      U.text(c, u.n + ' ' + L, tx, cy + bh * 0.32, ts, '#fff', 'left', { shadow: 'rgba(0,0,0,.5)' }); U.text(c, maxed ? 'MAX' : PG.fmt(c0), cx + bw - 10 * sc, cy + bh * 0.32, ts, can ? '#ffe066' : '#c7bfc9', 'right', { shadow: 'rgba(0,0,0,.5)' });
      U.text(c, u.d, tx, cy + bh * 0.7, Math.min(12 * sc, bh * 0.25), 'rgba(255,244,214,.85)', 'left', { font: 'body', shadow: false }); });
    var by = y0 + ph - foot + 4 * sc, bh2 = 38 * sc, bwid = Math.min(150 * sc, (pw - 30 * sc) / 2), ready = st.tntCd <= 0, cx2 = x0p + pw / 2;
    if (U.button(c, cx2 - bwid - 6 * sc, by, bwid, bh2, ready ? 'BOOM!' : Math.ceil(st.tntCd) + 's', { color: ready ? '#d63b3b' : '#5a4f5e', size: 18 * sc })) boom();
    if (!st.boost && st.boostUsed < 4 && PG.rewardedSupported()) { if (U.button(c, cx2 + 6 * sc, by, bwid, bh2, 'x2 cash (ad)', { color: '#8a4fd8', size: 14 * sc })) boostAd(); }
    else U.text(c, 'Fossils ' + done() + '/' + SP.length, cx2 + 6 * sc + bwid / 2, by + bh2 / 2, 14 * sc, '#c9b8a4', 'center', { shadow: false });
  }
  function drawDig(c, w, h, sc) {
    renderCavity(w, PG.time); c.imageSmoothingEnabled = false; c.drawImage(cav, 0, geo.hud, cav.width * geo.P, cav.height * geo.P);
    var L = layerOf(st.row0); U.text(c, L.n + '  ' + st.row0 + 'm', geo.areaW / 2, geo.hud + 12 * sc, 13 * sc, '#e8d8ff', 'center', { shadow: 'rgba(0,0,0,.8)' });
    c.save(); c.beginPath(); c.rect(0, geo.top, geo.areaW, geo.bottom - geo.top); c.clip(); c.fillStyle = '#120c1c'; c.fillRect(0, geo.top, geo.areaW, geo.bottom - geo.top);
    if (st.shake > 0.3) c.translate(Math.round((Math.random() - 0.5) * st.shake / geo.P) * geo.P, Math.round((Math.random() - 0.5) * st.shake / geo.P) * geo.P);
    renderGrid(PG.time); c.imageSmoothingEnabled = false; c.drawImage(pix, geo.gx, geo.gy, pix.width * geo.P, pix.height * geo.P); c.imageSmoothingEnabled = true;
    c.fillStyle = '#0d0814'; c.fillRect(0, geo.top, geo.gx, geo.bottom - geo.top); c.fillRect(geo.gx + COLS * geo.bs, geo.top, geo.areaW, geo.bottom - geo.top);
    for (var y = geo.top; y < geo.bottom; y += geo.P * 4) { c.fillStyle = (Math.floor(y / (geo.P * 4)) % 2) ? '#1a1224' : '#160f1f'; c.fillRect(0, y, geo.gx - geo.P, geo.P * 4); c.fillRect(geo.gx + COLS * geo.bs + geo.P, y, geo.areaW, geo.P * 4); }
    PG.drawParts(c); PG.drawPops(c);
    st.flying.forEach(function (f) { var tx = w - 134 * sc - 50 * sc, ty = 28 * sc, e = f.t * f.t, x = PG.lerp(f.x, tx, e), y = PG.lerp(f.y, ty, e) - Math.sin(f.t * 3.14) * 60; c.save(); c.translate(Math.round(x), Math.round(y)); c.rotate(Math.round(f.t * 8) * Math.PI / 4); drawSprite(c, 'bone', -4.5 * geo.P, -2.5 * geo.P, geo.P); c.restore(); });
    c.restore();
    drawHUD(c, w, h, sc); drawPanel(c, w, h, sc);
    if (st.layerBanner) { var k = Math.min(1, st.layerBanner.t * 3) * Math.min(1, (2.4 - st.layerBanner.t) * 3), bw = Math.min(geo.areaW * 0.9, 300 * sc); c.globalAlpha = Math.max(0, k); pbox(c, geo.areaW / 2 - bw / 2, geo.top + 36 * sc, bw, 50 * sc, '#3b2a4a'); U.text(c, 'Entering ' + st.layerBanner.n, geo.areaW / 2, geo.top + 61 * sc, U.fit(c, 'Entering ' + st.layerBanner.n, 22 * sc, bw - 20), '#ffd700', 'center'); c.globalAlpha = 1; }
    if (!PG.save.depth && st.row0 < 2 && st.cash < 5) { var tw = Math.min(geo.areaW * 0.86, 290 * sc); pbox(c, geo.areaW / 2 - tw / 2, geo.top + geo.bs * 2.6, tw, 40 * sc, '#3b2a4a'); U.text(c, 'Tap or drag across the blocks!', geo.areaW / 2, geo.top + geo.bs * 2.6 + 20 * sc, U.fit(c, 'Tap or drag across the blocks!', 17 * sc, tw - 16), '#fff4d6', 'center'); }
  }
  function drawMuseum(c, w, h, sc) {
    c.fillStyle = '#1c1430'; c.fillRect(0, 0, w, h); var u = Math.max(4, Math.round(6 * sc));
    for (var y = 0; y < h; y += u * 3) for (var x = ((y / (u * 3)) % 2) * u * 3; x < w; x += u * 6) { c.fillStyle = '#221939'; c.fillRect(x, y, u * 6 - 2, u * 3 - 2); }
    U.text(c, 'Fossil Museum', w / 2, 30 * sc, 28 * sc, '#ffd700', 'center');
    U.text(c, done() + '/' + SP.length + ' species  ·  ' + PG.fmt(museumIncome() * cashMul() * 0.35) + ' cash/s from visitors', w / 2, 58 * sc, 14 * sc, '#cdbde8', 'center', { font: 'body', shadow: false });
    var cols = w > h ? 4 : 3, rows = Math.ceil(SP.length / cols), padT = 80 * sc, availH = h - padT - 70 * sc, cw = Math.min(w / cols - 12 * sc, 210 * sc), ch = Math.min(availH / rows - 10 * sc, cw * 1.05), gx0 = (w - cols * (cw + 10 * sc) + 10 * sc) / 2;
    SP.forEach(function (sp, i) { var x = gx0 + (i % cols) * (cw + 10 * sc), y = padT + Math.floor(i / cols) * (ch + 10 * sc), n = got(sp).length, cm = n >= sp.parts;
      pbox(c, x, y, cw, ch, cm ? '#4a3578' : '#2a2040'); var ih = ch - 30 * sc;
      if (cm) { c.fillStyle = 'rgba(255,215,0,.08)'; c.fillRect(x + 6, y + 6, cw - 12, ih - 4); }
      if (n > 0) pixelSkeleton(c, sp, x + cw / 2, y + ih / 2 + 4, cw - 16, ih - 10, n);
      else U.text(c, '?', x + cw / 2, y + ih / 2, 30 * sc, 'rgba(255,255,255,.3)', 'center', { shadow: false });
      U.text(c, cm || n ? sp.n : 'Depth ' + sp.min + 'm', x + cw / 2, y + ch - 20 * sc, Math.min(14 * sc, U.fit(c, cm || n ? sp.n : 'Depth ' + sp.min + 'm', 14 * sc, cw - 12)), cm ? '#ffd700' : '#cdbde8', 'center', { shadow: false });
      var pu = Math.max(3, Math.round(4 * sc)); for (var p = 0; p < sp.parts; p++) { c.fillStyle = p < n ? '#8cff66' : 'rgba(255,255,255,.18)'; c.fillRect(Math.round(x + cw / 2 + (p - (sp.parts - 1) / 2) * pu * 2.2 - pu / 2), Math.round(y + ch - 9 * sc), pu, pu); } });
    if (U.button(c, w / 2 - 90 * sc, h - 56 * sc, 180 * sc, 44 * sc, 'Back to dig', { color: '#e07a2f', size: 18 * sc })) PG.interstitial('level_end').then(function () { PG.go(function () { st.state = 'play'; }); });
  }
  function drawPopup(c, w, h, sc) {
    var p = st.popup, k = PG.ease.out(Math.min(1, p.t * 2.5)); c.fillStyle = 'rgba(8,4,20,' + 0.7 * k + ')'; c.fillRect(0, 0, w, h);
    var pw = Math.min(w * 0.88, 380 * sc), ph = 340 * sc, px = w / 2 - pw / 2, py = h * 0.47 - ph / 2 + Math.round((1 - k) * 50); pbox(c, px, py, pw, ph, '#3b2a4a');
    U.text(c, 'Fossil complete!', w / 2, py + 34 * sc, 22 * sc, '#ffd700', 'center'); pbox(c, px + 14 * sc, py + 54 * sc, pw - 28 * sc, 146 * sc, '#241a33'); pixelSkeleton(c, p.sp, w / 2, py + 128 * sc, pw - 44 * sc, 134 * sc, p.sp.parts);
    U.text(c, p.sp.n, w / 2, py + 222 * sc, 26 * sc, '#fff4d6', 'center'); U.text(c, '+' + PG.fmt(p.sp.v * 0.35) + ' cash/s  ·  +5% dig & cash', w / 2, py + 250 * sc, 15 * sc, '#8cff66', 'center', { font: 'body', shadow: false });
    if (U.button(c, w / 2 - 90 * sc, py + 272 * sc, 180 * sc, 48 * sc, 'Awesome!', { color: '#2a9d8f' })) st.popup = null;
  }
  function drawWelcome(c, w, h, sc) {
    c.fillStyle = 'rgba(8,4,20,.7)'; c.fillRect(0, 0, w, h); var pw = Math.min(w * 0.86, 360 * sc), ph = 270 * sc, px = w / 2 - pw / 2, py = h * 0.45 - ph / 2; pbox(c, px, py, pw, ph, '#3b2a4a');
    U.text(c, 'Welcome back!', w / 2, py + 38 * sc, 28 * sc, '#ffd700', 'center'); U.text(c, 'Your crew and visitors earned', w / 2, py + 76 * sc, 16 * sc, '#cdbde8', 'center', { font: 'body', shadow: false });
    var cp = Math.max(2, Math.round(3.4 * sc)); drawSprite(c, 'coin', w / 2 - 66 * sc, py + 114 * sc - 3.5 * cp, cp); U.text(c, PG.fmt(st.welcome.amt), w / 2 - 34 * sc, py + 115 * sc, 32 * sc, '#ffd700', 'left');
    var bw = pw * 0.84, bh = 48 * sc; if (PG.rewardedSupported() && !st.welcome.dbl) { if (U.button(c, w / 2 - bw / 2, py + 144 * sc, bw, bh, 'Ad: double it', { color: '#8a4fd8', size: 18 * sc })) PG.rewarded('bonus').then(function (ok) { if (ok) { st.cash += st.welcome.amt; st.welcome.amt *= 2; st.welcome.dbl = true; PG.track('rewarded_offline_double', {}); } }); }
    if (U.button(c, w / 2 - bw / 2, py + 200 * sc, bw, bh, 'Collect', { color: '#2a9d8f', size: 20 * sc })) st.welcome = null;
  }
  function render(c, w, h) {
    var sc = PG.scale(); layout(w, h); c.fillStyle = '#120c1c'; c.fillRect(0, 0, w, h);
    if (st.state === 'museum') drawMuseum(c, w, h, sc); else drawDig(c, w, h, sc);
    if (st.popup) drawPopup(c, w, h, sc); else if (st.welcome) drawWelcome(c, w, h, sc);
  }
  var lastCell = null;
  function hitAt(x, y, tap) {
    if (st.state !== 'play' || st.popup || st.welcome || PG.userPaused) return; if (y < geo.top || y > geo.bottom || x > geo.areaW) return;
    var c = Math.floor((x - geo.gx) / geo.bs), r = Math.floor((y - geo.gy) / geo.bs - st.scroll); if (c < 0 || c >= COLS || r < 0 || r >= st.rows.length) return;
    var key = r + ',' + c; if (tap || key !== lastCell) { lastCell = key; hitBlock(r, c, tapDmg(), true); }
  }
  PG.onDown = function (x, y) { lastCell = null; hitAt(x, y, true); };
  PG.onMove = function (x, y) { if (PG.input.down) hitAt(x, y, false); };
  PG.setup(document.getElementById('c'), update, render);
  window.__dino = { st: st, update: update, hit: hitBlock, buy: buy, UPG: UPG, SP: SP, tapDmg: tapDmg, boom: boom, collect: collect, resetRows: resetRows };
  PG.init({ id: 'dino_dig', version: '1.1.0', defaults: { cash: 0, u: {}, f: {}, depth: 0, total: 0, t: 0, muted: false } }).then(function () {
    st.cash = PG.save.cash || 0; st.row0 = PG.save.depth || 0; resetRows();
    var away = PG.save.t ? (Date.now() - PG.save.t) / 1000 : 0; if (away > 60) { var cap = Math.min(away, 3 * 3600) * 0.5; var perSec = crewDps() * blockCash(Math.max(2, PG.save.depth || 0)) / blockHp(Math.max(2, PG.save.depth || 0)) * cashMul() + museumIncome() * cashMul() * 0.35; var amt = perSec * cap; if (amt >= 1) { st.cash += amt; st.welcome = { amt: amt, dbl: false }; } }
    PG.playing = true; PG.music();
  });
})();
