/* DINO DIG - dig down through ancient layers, unearth fossil bones, build skeletons for your museum. */
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
    if (tap) { st.swing = 1; PG.sfx('hit', 0.9 + Math.random() * 0.4); var p = blockPos(r, c); PG.burst(p.x, p.y, 3, { colors: [layerOf(st.row0 + r).s, '#fff'], g: 500, min: 30, max: 120, life: 0.4 }); }
    if (b.hp <= 0) breakBlock(r, c);
  }
  function breakBlock(r, c) {
    var b = st.rows[r][c]; b.dead = true; var rowIdx = st.row0 + r, p = blockPos(r, c), cash = blockCash(rowIdx) * cashMul(); st.cash += cash; PG.save.total = (PG.save.total || 0) + cash;
    PG.burst(p.x, p.y, 10, { colors: [layerOf(rowIdx).a, layerOf(rowIdx).s, '#fff'], g: 600, min: 40, max: 200, life: 0.7, s0: 2, s1: 5, shape: 's' }); PG.sfx('pop', 0.6 + Math.random() * 0.3); PG.popText(p.x, p.y - 8, '+' + PG.fmt(cash), '#ffe066', 15);
    if (b.f >= 0 && b.part >= 0) { var sp = SP[b.f]; if (!complete(sp) && got(sp).indexOf(b.part) < 0) { st.flying.push({ x: p.x, y: p.y, t: 0, sp: b.f, part: b.part }); PG.sfx('bell'); PG.burst(p.x, p.y, 16, { colors: ['#fff', '#ffe9a8'], g: 0, min: 40, max: 160, life: 0.8 }); } else st.cash += cash * 2; }
    if (st.rows[0].every(function (x) { return x.dead; })) advance();
  }
  function advance() {
    st.rows.shift(); st.row0++; st.scroll = 1; fillRows(); var dm = st.row0; if (dm > (PG.save.depth || 0)) { PG.save.depth = dm; if (dm % 10 === 0) { PG.track('depth_milestone', { depth: dm }); PG.msg('player_got_achievement'); } if (dm % 20 === 0) { st.layerBanner = { n: layerOf(dm).n, t: 0 }; PG.sfx('win'); } } PG.commit();
  }
  function collect(f) {
    var sp = SP[f.sp]; var arr = PG.save.f[sp.id] = PG.save.f[sp.id] || []; if (arr.indexOf(f.part) < 0) arr.push(f.part); st.fossilsFound++; PG.commit(true); PG.sfx('upgrade');
    if (arr.length >= sp.parts) { st.popup = { sp: sp, t: 0 }; PG.sfx('win'); PG.track('species_completed', { species: sp.id, depth: Math.min(st.row0, 300) }); PG.msg('player_got_achievement'); st.rows.forEach(function (row) { row.forEach(function (b) { if (b.f === SP.indexOf(sp)) { b.f = -1; b.part = -1; } }); }); }
  }
  function buy(u) { var c0 = cost(u), L = lv(u.id); if (u.max && L >= u.max) return; if (st.cash < c0) { PG.sfx('err'); return; } st.cash -= c0; PG.save.u = PG.save.u || {}; PG.save.u[u.id] = L + 1; PG.sfx('upgrade'); PG.commit(); PG.track('upgrade_purchased', { upgrade_id: u.id, level: L + 1 }); }
  function boom() { if (st.tntCd > 0) return; st.tntCd = tntCool(); st.tntFx = 1; st.shake = 14; PG.sfx('boom'); PG.vibrate(30); var power = tapDmg() * (6 + lv('tnt')); for (var r = 0; r < 3 && r < st.rows.length; r++) for (var c = 0; c < COLS; c++) hitBlock(r, c, power * (r === 0 ? 1 : 0.6), false); for (var i = 0; i < 24; i++) { var p = blockPos(PG.ri(0, 2), PG.ri(0, COLS - 1)); PG.burst(p.x, p.y, 3, { colors: ['#ffb703', '#ff6b6b', '#fff'], g: 300, min: 80, max: 320, life: 0.7 }); } }
  function boostAd() { if (st.boost > 0 || st.boostUsed >= 4) return; PG.rewarded('bonus').then(function (ok) { if (ok) { st.boost = 120; st.boostUsed++; PG.track('rewarded_cash_boost', {}); PG.popText(PG.w / 2, geo.top + 40, 'x2 cash for 2 min!', '#9be564', 24); } }); }

  /* ---------- layout ---------- */
  function layout(w, h) {
    var sc = PG.scale(); geo.hud = 58 * sc; geo.panelH = Math.min(h * 0.34, 214 * sc); geo.cavity = 64 * sc; geo.top = geo.hud + geo.cavity;
    var availH = h - geo.top - geo.panelH, availW = Math.min(w, 560 * sc); geo.bs = Math.min(availW / COLS, availH / VROWS); geo.gx = (w - geo.bs * COLS) / 2; geo.gy = geo.top; geo.panelY = h - geo.panelH; geo.sc = sc;
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

  /* ---------- drawing ---------- */
  function drawBone(c, x1, y1, x2, y2, w) { c.strokeStyle = '#f4ead2'; c.lineWidth = w; c.lineCap = 'round'; c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.fillStyle = '#f4ead2'; c.beginPath(); c.arc(x1, y1, w * 0.85, 0, TAU); c.arc(x2, y2, w * 0.85, 0, TAU); c.fill(); }
  // procedural skeleton, draws pieces up to `n` of sp.parts
  function drawSkeleton(c, sp, x, y, s, n, t, col) {
    c.save(); c.translate(x, y); c.scale(s, s); var full = n >= sp.parts; var show = function (p) { return n >= sp.parts || p < n; }; c.globalAlpha = 1; var K = sp.parts, w = 3.4;
    var bone = function (a, b, c2, d, ww) { drawBone(c, a, b, c2, d, ww || w); };
    if (sp.kind === 'shell') { var rings = sp.parts + 2; c.strokeStyle = '#f4ead2'; c.lineCap = 'round'; for (var i = 0; i < rings; i++) { if (!show(Math.min(i, sp.parts - 1)) && !full) continue; var a = i * 0.7 - 1.2, rr = 6 + i * 4.5; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, rr, sp.id === 'ammo' ? a : -2.2, sp.id === 'ammo' ? a + 4.2 : 2.2 - 0.0 * i); c.stroke(); } if (sp.id === 'trilo') { for (i = -3; i <= 3; i++) { if (!full && n < 2) break; bone(i * 6 - 2, -14 + Math.abs(i), i * 6 - 2, 14 - Math.abs(i), 2.4); } bone(-24, 0, 24, 0, 2.6); c.fillStyle = '#f4ead2'; c.beginPath(); c.ellipse(-26, 0, 6, 10, 0, 0, TAU); c.fill(); } }
    else if (sp.kind === 'plant') { for (var f = -3; f <= 3; f++) { if (!full && Math.abs(f) > n) continue; var ang = -1.57 + f * 0.32; for (var j = 1; j < 7; j++) { var px = Math.cos(ang) * j * 6 + f * 1.5, py = -2 + Math.sin(ang) * j * 6 + 20; bone(px, py, px + Math.cos(ang + 1) * 7, py + Math.sin(ang + 1) * 7, 1.6); bone(px, py, px + Math.cos(ang - 1) * 7, py + Math.sin(ang - 1) * 7, 1.6); } } bone(0, 20, 0, 36, 3); }
    else if (sp.kind === 'wing') { var drag = !!sp.dragon; if (show(0)) { bone(-8, 0, 14, -3, 4); } if (show(1)) { c.fillStyle = '#f4ead2'; c.beginPath(); c.ellipse(24, -4, 10, 5, -0.2, 0, TAU); c.fill(); bone(32, -4, 46 + (drag ? 6 : 14), -2, 2); } if (show(2)) { bone(0, 0, -38, -26, 3); bone(-38, -26, -64, -4, 3); } if (show(3)) { bone(0, 0, 38, -26 + 0, 3); bone(38, -26, 62, -2, 3); } if (show(4)) { for (var q = 0; q < 5; q++) { bone(-38 + q * 6, -26 + q * 5, -40 + q * 14, 4 + q * 3, 1.4); } } if (show(0)) bone(-8, 0, -30, 14, 2.4); if (drag) { for (q = 5; q < sp.parts; q++) if (show(q)) bone(-4 + q * 3, 4, -20 + q * 5, 20, 2.2); } }
    else { // biped / quad
      var spine = sp.kind === 'biped' ? 60 : 78, lx = -spine / 2, hx = spine / 2, hy = 0; var neckUp = sp.neck ? -46 : (sp.kind === 'biped' ? -16 : -4); var P = 0;
      var vis = function (k) { return full || k < n; };
      if (vis(0)) { bone(lx, 0, hx, hy, 4.6); for (var rb = 0; rb < 5; rb++) bone(lx + 14 + rb * 9, 0, lx + 12 + rb * 9, 12 + Math.sin(rb / 4 * 3) * 4, 2.2); } // spine + ribs
      if (vis(1)) { var hs = (sp.head || 1) * 11; bone(hx, hy, hx + 8, hy + neckUp, 4); c.fillStyle = '#f4ead2'; c.beginPath(); c.ellipse(hx + 12 + hs * 0.3, hy + neckUp - 2, hs, hs * 0.62, -0.1, 0, TAU); c.fill(); c.fillStyle = '#1b1b2b'; c.beginPath(); c.arc(hx + 9 + hs * 0.3, hy + neckUp - 4, 1.9, 0, TAU); c.fill(); if (sp.horns) { bone(hx + 20, hy + neckUp - 8, hx + 38, hy + neckUp - 22, 2.6); bone(hx + 14, hy + neckUp - 8, hx + 24, hy + neckUp - 26, 2.6); } if (sp.tusks) { bone(hx + 30, hy + neckUp + 2, hx + 46, hy + neckUp + 18, 2.6); } if (sp.fangs) { bone(hx + 22, hy + neckUp + 4, hx + 23, hy + neckUp + 14, 2); } }
      if (vis(2) && sp.tail !== undefined || vis(2)) { var tl = (sp.tail || 0.5) * 38; bone(lx, 0, lx - tl * 0.6, 8, 3.6); bone(lx - tl * 0.6, 8, lx - tl, 6, 2.6); }
      var legs = sp.kind === 'biped' ? [[-4]] : [[-spine / 2 + 8], [spine / 2 - 12]]; if (vis(3)) { var l0 = sp.kind === 'biped' ? [lx + 26] : [lx + 8, lx + 18]; l0.forEach(function (lx0) { bone(lx0, 4, lx0 + 2, 24, 3.6); bone(lx0 + 2, 24, lx0 - 4, 40, 3); bone(lx0 - 4, 40, lx0 + 6, 42, 2.4); }); }
      if (vis(4)) { var l1 = sp.kind === 'biped' ? [lx + 40] : [hx - 18, hx - 8]; l1.forEach(function (lx1) { bone(lx1, 4, lx1 - 1, 24, 3.6); bone(lx1 - 1, 24, lx1 + 3, 40, 3); bone(lx1 + 3, 40, lx1 + 12, 42, 2.4); }); }
      if (vis(5) && sp.plates) { for (var pl = 0; pl < 6; pl++) { c.fillStyle = '#f4ead2'; c.beginPath(); c.moveTo(lx + 8 + pl * 12, -6); c.lineTo(lx + 14 + pl * 12, -22 - (pl % 3) * 3); c.lineTo(lx + 20 + pl * 12, -6); c.fill(); } }
      if (vis(5) && sp.kind === 'biped') { bone(hx - 8, 6, hx + 6, 16, 2.2); }
      if (vis(6)) { bone(hx - 14, hy, hx - 14, hy - 12, 2); bone(lx + 12, 0, lx + 12, -12, 2); }
      if (vis(7)) { for (var k2 = 0; k2 < 4; k2++) bone(lx + 6 + k2 * 5, -2, lx + 4 + k2 * 5, -10 - k2, 1.6); }
    }
    c.restore();
  }
  function drawBlock(c, b, r, cI) {
    var rowIdx = st.row0 + r, L = layerOf(rowIdx), p = blockPos(r, cI), bs = geo.bs, x = p.x - bs / 2, y = p.y - bs / 2;
    if (b.dead) { c.fillStyle = 'rgba(8,6,16,.55)'; c.fillRect(x, y, bs + 0.5, bs + 0.5); return; }
    var o = b.sh * 2 * Math.sin(PG.time * 60); c.save(); c.translate(o, 0);
    c.fillStyle = L.b; c.fillRect(x + 1, y + 1, bs - 2, bs - 2); c.fillStyle = (rowIdx + cI) % 2 ? L.a : L.b; c.fillRect(x + 2, y + 2, bs - 4, bs - 7); c.fillStyle = 'rgba(255,255,255,.1)'; c.fillRect(x + 2, y + 2, bs - 4, 3); c.fillStyle = 'rgba(0,0,0,.2)'; c.fillRect(x + 2, y + bs - 6, bs - 4, 4);
    c.fillStyle = L.s; for (var i = 0; i < 6; i++) { var sx = x + ((b.sp * 97 + i * 31) % (bs - 10)) + 4, sy = y + ((b.sp * 53 + i * 47) % (bs - 14)) + 4; c.globalAlpha = 0.5; c.fillRect(sx, sy, 2.4, 2.4); } c.globalAlpha = 1;
    if (b.f >= 0 && b.part >= 0) { var sp = SP[b.f]; var gl = 0.5 + 0.5 * Math.sin(PG.time * 3 + b.sp * 9); c.globalAlpha = 0.35 + gl * 0.3; drawBone(c, p.x - bs * 0.2, p.y + bs * 0.05, p.x + bs * 0.2, p.y - bs * 0.05, 3); drawBone(c, p.x - bs * 0.22, p.y - bs * 0.1, p.x - bs * 0.2, p.y + bs * 0.05, 2.2); c.globalAlpha = 1; }
    var dmg = 1 - Math.max(0, b.hp) / b.mhp; if (dmg > 0.05) { c.strokeStyle = 'rgba(0,0,0,' + (0.25 + dmg * 0.5) + ')'; c.lineWidth = 1.6; c.beginPath(); c.moveTo(x + bs * 0.5, y + 3); c.lineTo(x + bs * (0.4 - dmg * 0.1), y + bs * 0.4); c.lineTo(x + bs * 0.6, y + bs * 0.55); c.lineTo(x + bs * 0.45, y + bs * (0.6 + dmg * 0.3)); if (dmg > 0.5) { c.moveTo(x + bs * 0.4, y + bs * 0.4); c.lineTo(x + 4, y + bs * 0.6); c.moveTo(x + bs * 0.6, y + bs * 0.55); c.lineTo(x + bs - 4, y + bs * 0.4); } c.stroke(); }
    if (b.flash > 0) { c.fillStyle = 'rgba(255,255,255,' + b.flash * 4 + ')'; c.fillRect(x + 2, y + 2, bs - 4, bs - 4); }
    c.restore();
  }
  function drawCavity(c, w, h, t) {
    var sc = geo.sc, y0 = geo.hud, ch = geo.cavity; var g = c.createLinearGradient(0, y0, 0, y0 + ch); g.addColorStop(0, '#2a1d3a'); g.addColorStop(1, '#120c1c'); c.fillStyle = g; c.fillRect(0, y0, w, ch);
    c.fillStyle = 'rgba(0,0,0,.25)'; for (var i = 0; i < 8; i++) c.fillRect(geo.gx + i * 90 * sc, y0 + 6, 3, ch - 6);
    // lantern
    var lx = w * 0.08, fl = 0.85 + Math.sin(t * 9) * 0.1; c.strokeStyle = '#5b4a3a'; c.lineWidth = 2; c.beginPath(); c.moveTo(lx, y0); c.lineTo(lx, y0 + 14 * sc); c.stroke(); var lg = c.createRadialGradient(lx, y0 + 22 * sc, 0, lx, y0 + 22 * sc, 60 * sc); lg.addColorStop(0, 'rgba(255,200,100,' + 0.55 * fl + ')'); lg.addColorStop(1, 'rgba(255,200,100,0)'); c.fillStyle = lg; c.fillRect(lx - 70 * sc, y0, 140 * sc, ch); c.fillStyle = '#ffd166'; c.fillRect(lx - 5 * sc, y0 + 14 * sc, 10 * sc, 14 * sc);
    // miners: hero + crew
    var n = Math.min(lv('crew'), 7), total = n + 1; for (var k = 0; k < total; k++) { var hx = geo.gx + (k + 0.5) / total * geo.bs * COLS, hero = k === Math.floor(total / 2); var ph = hero ? st.swing : (Math.sin(t * 5 + k * 1.7) * 0.5 + 0.5); drawMiner(c, hx, y0 + ch - 2, sc * (hero ? 1.05 : 0.8), ph, hero, k); }
    // layer title
    var L = layerOf(st.row0); U.text(c, L.n + '  ' + st.row0 + ' m', w / 2, y0 + 10 * sc, 13 * sc, '#cdbde8', 'center', { shadow: false });
  }
  function drawMiner(c, x, y, s, swing, hero, i) {
    c.save(); c.translate(x, y); c.scale(s, s); var bob = Math.sin(PG.time * 6 + i) * 1; c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(0, 0, 11, 3, 0, 0, TAU); c.fill();
    c.fillStyle = hero ? '#3a86ff' : ['#e07a5f', '#81b29a', '#f2cc8f', '#a98467'][i % 4]; c.fillRect(-6, -22 + bob, 12, 16); c.fillStyle = '#f2c9a0'; c.beginPath(); c.arc(0, -28 + bob, 7, 0, TAU); c.fill(); c.fillStyle = hero ? '#ffd23f' : '#ffb703'; c.beginPath(); c.arc(0, -30 + bob, 7.4, Math.PI, TAU); c.fill(); c.fillRect(-8, -31 + bob, 16, 3); c.fillStyle = '#222'; c.fillRect(-3, -28 + bob, 1.6, 2); c.fillRect(2, -28 + bob, 1.6, 2);
    c.fillStyle = '#4a3a2a'; c.fillRect(-5, -6, 4, 6); c.fillRect(1, -6, 4, 6);
    c.save(); c.translate(6, -18 + bob); c.rotate(-1.2 + swing * 1.9); c.fillStyle = '#7a5a3a'; c.fillRect(0, -2, 22, 3); c.fillStyle = '#b0b8c4'; c.fillRect(18, -8, 4, 14); c.restore(); c.restore();
  }
  function drawHUD(c, w, h, sc) {
    var g = c.createLinearGradient(0, 0, 0, geo.hud); g.addColorStop(0, '#2b1d1a'); g.addColorStop(1, '#3a2822'); c.fillStyle = g; c.fillRect(0, 0, w, geo.hud);
    U.coin(c, 22 * sc, 20 * sc, 10 * sc); U.text(c, PG.fmt(st.cash), 38 * sc, 21 * sc, 22 * sc, '#ffe066', 'left', { stroke: 'rgba(0,0,0,.4)' });
    var inc = st.dps * 0 + museumIncome() * cashMul() * 0.35 + 0; U.text(c, (st.dps > 0 ? PG.fmt(st.dps * (st.rows[0] ? blockCash(st.row0) / blockHp(st.row0) : 1) * cashMul() + inc) + '/s' : (inc > 0 ? PG.fmt(inc) + '/s' : 'tap to dig!')), 16 * sc, 44 * sc, 13 * sc, '#c9b8a4', 'left', { shadow: false });
    if (st.boost > 0) U.text(c, 'x2  ' + Math.ceil(st.boost) + 's', w * 0.5, 22 * sc, 15 * sc, '#9be564', 'center', { shadow: false });
    var bw = 100 * sc, bh = 38 * sc, bx = w - 150 * sc - bw * 0.0; if (U.button(c, w - 134 * sc - bw, 10 * sc, bw, bh, 'Museum', { color: '#8338ec', size: 15 * sc })) { st.state = 'museum'; PG.track('museum_opened', { species: done() }); }
  }
  function drawPanel(c, w, h, sc) {
    var y0 = geo.panelY, ph = geo.panelH; var g = c.createLinearGradient(0, y0, 0, h); g.addColorStop(0, '#3e2a22'); g.addColorStop(1, '#25170f'); c.fillStyle = g; c.fillRect(0, y0, w, ph); c.fillStyle = 'rgba(255,255,255,.12)'; c.fillRect(0, y0, w, 2);
    var cols = w > 700 * sc ? 3 : 2, rows = Math.ceil(UPG.length / cols), pad = 8 * sc, bw = (Math.min(w, 620 * sc) - pad * (cols + 1)) / cols, bh = (ph - 56 * sc - pad * (rows)) / rows; bh = Math.min(bh, 50 * sc); var x0 = (w - Math.min(w, 620 * sc)) / 2 + pad;
    UPG.forEach(function (u, i) { var cx = x0 + (i % cols) * (bw + pad), cy = y0 + pad + Math.floor(i / cols) * (bh + pad), c0 = cost(u), L = lv(u.id), maxed = u.max && L >= u.max, can = st.cash >= c0 && !maxed;
      if (U.button(c, cx, cy, bw, bh, '', { color: can ? '#2ec4b6' : maxed ? '#6c8d5a' : '#6b6560' })) buy(u);
      U.text(c, u.n + ' ' + L, cx + 10 * sc, cy + bh * 0.3, Math.min(14 * sc, bh * 0.3), '#fff', 'left', { shadow: false }); U.text(c, maxed ? 'MAX' : PG.fmt(c0), cx + bw - 10 * sc, cy + bh * 0.3, Math.min(14 * sc, bh * 0.3), can ? '#fff59d' : '#ddd', 'right', { shadow: false }); U.text(c, u.d, cx + 10 * sc, cy + bh * 0.72, Math.min(11 * sc, bh * 0.24), 'rgba(255,255,255,.85)', 'left', { shadow: false }); });
    // boom + ad boost
    var by = y0 + ph - 46 * sc, bh2 = 38 * sc, bwid = Math.min(150 * sc, w * 0.4); var ready = st.tntCd <= 0;
    if (U.button(c, w / 2 - bwid - 6 * sc, by, bwid, bh2, ready ? 'BOOM!' : Math.ceil(st.tntCd) + 's', { color: ready ? '#e63946' : '#7a7f88', size: 18 * sc })) boom();
    if (!st.boost && st.boostUsed < 4 && PG.rewardedSupported()) { if (U.button(c, w / 2 + 6 * sc, by, bwid, bh2, 'x2 cash (ad)', { color: '#8338ec', size: 14 * sc })) boostAd(); } else U.text(c, 'Fossils: ' + done() + '/' + SP.length, w / 2 + 6 * sc + bwid / 2, by + bh2 / 2, 14 * sc, '#c9b8a4', 'center', { shadow: false });
  }
  function drawDig(c, w, h, sc) {
    layout(w, h); drawCavity(c, w, h, PG.time);
    c.save(); c.beginPath(); c.rect(0, geo.top, w, geo.panelY - geo.top); c.clip(); if (st.shake > 0.3) c.translate((Math.random() - 0.5) * st.shake, (Math.random() - 0.5) * st.shake);
    c.fillStyle = '#120c1c'; c.fillRect(0, geo.top, w, geo.panelY - geo.top);
    for (var r = 0; r < st.rows.length; r++) for (var cc = 0; cc < COLS; cc++) { var p = blockPos(r, cc); if (p.y - geo.bs > geo.panelY) continue; drawBlock(c, st.rows[r][cc], r, cc); }
    // TNT flash
    if (st.tntFx > 0) { c.fillStyle = 'rgba(255,210,120,' + st.tntFx * 0.5 + ')'; c.fillRect(0, geo.top, w, geo.panelY - geo.top); }
    PG.drawParts(c); PG.drawPops(c);
    st.flying.forEach(function (f) { var tx = w - 134 * sc - 50 * sc, ty = 28 * sc, e = f.t * f.t; var x = PG.lerp(f.x, tx, e), y = PG.lerp(f.y, ty, e) - Math.sin(f.t * 3.14) * 60; c.save(); c.translate(x, y); c.rotate(f.t * 12); drawBone(c, -8, 0, 8, 0, 3.4); c.restore(); });
    c.restore();
    drawHUD(c, w, h, sc); drawPanel(c, w, h, sc);
    if (st.layerBanner) { var k = Math.min(1, st.layerBanner.t * 3) * Math.min(1, (2.4 - st.layerBanner.t) * 3); c.globalAlpha = k; U.text(c, 'Entering: ' + st.layerBanner.n, w / 2, geo.top + 60 * sc, 28 * sc, '#ffd23f', 'center', { stroke: 'rgba(0,0,0,.6)' }); c.globalAlpha = 1; }
    if (!PG.save.depth && st.row0 < 2 && st.cash < 5) U.text(c, 'Tap or drag across the blocks!', w / 2, geo.top + geo.bs * 3, 20 * sc, '#fff', 'center', { stroke: 'rgba(0,0,0,.7)' });
  }
  function drawMuseum(c, w, h, sc) {
    var g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2d2150'); g.addColorStop(1, '#171030'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    U.text(c, 'Fossil Museum', w / 2, 30 * sc, 28 * sc, '#ffd23f', 'center', { stroke: 'rgba(0,0,0,.4)' });
    U.text(c, done() + '/' + SP.length + ' species  -  ' + PG.fmt(museumIncome() * cashMul() * 0.35) + ' cash/s from visitors', w / 2, 58 * sc, 14 * sc, '#cdbde8', 'center', { shadow: false });
    var cols = w > h ? 4 : 3, rows = Math.ceil(SP.length / cols), padT = 80 * sc, availH = h - padT - 70 * sc, cw = Math.min(w / cols - 12 * sc, 210 * sc), ch = Math.min(availH / rows - 10 * sc, cw * 1.05), gx0 = (w - cols * (cw + 10 * sc) + 10 * sc) / 2;
    SP.forEach(function (sp, i) { var x = gx0 + (i % cols) * (cw + 10 * sc), y = padT + Math.floor(i / cols) * (ch + 10 * sc), n = got(sp).length, cm = n >= sp.parts;
      U.panel(c, x, y, cw, ch, { fill: cm ? 'rgba(60,40,110,.9)' : 'rgba(20,14,40,.85)', stroke: cm ? '#ffd23f' : 'rgba(255,255,255,.18)' });
      c.save(); c.beginPath(); c.rect(x + 4, y + 4, cw - 8, ch - 30 * sc); c.clip(); c.globalAlpha = cm ? 1 : 0.9; var skS = Math.min(cw, ch) / 120 * sp.size * 1.15; drawSkeleton(c, sp, x + cw / 2, y + (ch - 30 * sc) / 2 + 4, skS, n, PG.time); c.restore();
      if (!cm && n === 0) { c.fillStyle = 'rgba(20,14,40,.75)'; U.rr(c, x + 4, y + 4, cw - 8, ch - 30 * sc, 14); c.fill(); U.text(c, '?', x + cw / 2, y + (ch - 30 * sc) / 2, 30 * sc, 'rgba(255,255,255,.4)', 'center', { shadow: false }); }
      U.text(c, cm ? sp.n : (n ? sp.n : 'Depth ' + sp.min + 'm'), x + cw / 2, y + ch - 20 * sc, Math.min(14 * sc, cw * 0.1), cm ? '#ffd23f' : '#cdbde8', 'center', { shadow: false });
      for (var p = 0; p < sp.parts; p++) { c.fillStyle = p < n ? '#9be564' : 'rgba(255,255,255,.2)'; c.beginPath(); c.arc(x + cw / 2 + (p - (sp.parts - 1) / 2) * 9 * sc, y + ch - 7 * sc, 3 * sc, 0, TAU); c.fill(); } });
    if (U.button(c, w / 2 - 90 * sc, h - 56 * sc, 180 * sc, 44 * sc, 'Back to dig', { color: '#ff9f1c', size: 18 * sc })) { st.state = 'play'; PG.interstitial('level_end'); }
  }
  function drawPopup(c, w, h, sc) {
    var p = st.popup, k = PG.ease.out(Math.min(1, p.t * 2.5)); c.fillStyle = 'rgba(8,4,20,' + 0.7 * k + ')'; c.fillRect(0, 0, w, h);
    var pw = Math.min(w * 0.88, 380 * sc), ph = 340 * sc, px = w / 2 - pw / 2, py = h * 0.47 - ph / 2 + (1 - k) * 50; U.panel(c, px, py, pw, ph, { fill: 'rgba(30,18,70,.96)', stroke: '#ffd23f' });
    U.text(c, 'NEW FOSSIL COMPLETE!', w / 2, py + 34 * sc, 22 * sc, '#ffd23f', 'center'); c.save(); c.beginPath(); c.rect(px + 10, py + 52 * sc, pw - 20, 150 * sc); c.clip(); drawSkeleton(c, p.sp, w / 2, py + 130 * sc, 1.7 * sc * p.sp.size, p.sp.parts, PG.time); c.restore();
    U.text(c, p.sp.n, w / 2, py + 214 * sc, 26 * sc, '#fff', 'center'); U.text(c, '+' + PG.fmt(p.sp.v * 0.35) + ' cash/s  -  +10% income', w / 2, py + 244 * sc, 15 * sc, '#9be564', 'center', { shadow: false });
    if (U.button(c, w / 2 - 90 * sc, py + 266 * sc, 180 * sc, 50 * sc, 'Awesome!', { color: '#2ec4b6' })) { st.popup = null; }
  }
  function drawWelcome(c, w, h, sc) {
    c.fillStyle = 'rgba(8,4,20,.7)'; c.fillRect(0, 0, w, h); var pw = Math.min(w * 0.86, 360 * sc), ph = 270 * sc, px = w / 2 - pw / 2, py = h * 0.45 - ph / 2; U.panel(c, px, py, pw, ph);
    U.text(c, 'Welcome back!', w / 2, py + 38 * sc, 28 * sc, '#ffd23f', 'center'); U.text(c, 'Your crew and visitors earned', w / 2, py + 76 * sc, 16 * sc, '#cdbde8', 'center'); U.coin(c, w / 2 - 54 * sc, py + 114 * sc, 13 * sc); U.text(c, PG.fmt(st.welcome.amt), w / 2 - 34 * sc, py + 115 * sc, 32 * sc, '#ffe066', 'left');
    var bw = pw * 0.84, bh = 48 * sc; if (PG.rewardedSupported() && !st.welcome.dbl) { if (U.button(c, w / 2 - bw / 2, py + 144 * sc, bw, bh, 'Watch ad: x2', { color: '#8338ec', size: 18 * sc })) PG.rewarded('bonus').then(function (ok) { if (ok) { st.cash += st.welcome.amt; st.welcome.amt *= 2; st.welcome.dbl = true; PG.track('rewarded_offline_double', {}); } }); }
    if (U.button(c, w / 2 - bw / 2, py + 200 * sc, bw, bh, 'Collect', { color: '#2ec4b6', size: 20 * sc })) st.welcome = null;
  }
  function render(c, w, h) {
    var sc = PG.scale(); layout(w, h); c.fillStyle = '#120c1c'; c.fillRect(0, 0, w, h);
    if (st.state === 'museum') drawMuseum(c, w, h, sc); else drawDig(c, w, h, sc);
    if (st.popup) drawPopup(c, w, h, sc); else if (st.welcome) drawWelcome(c, w, h, sc);
  }
  var lastCell = null;
  function hitAt(x, y, tap) {
    if (st.state !== 'play' || st.popup || st.welcome || PG.userPaused) return; if (y < geo.top || y > geo.panelY) return;
    var c = Math.floor((x - geo.gx) / geo.bs), r = Math.floor((y - geo.gy) / geo.bs - st.scroll); if (c < 0 || c >= COLS || r < 0 || r >= st.rows.length) return;
    var key = r + ',' + c; if (tap || key !== lastCell) { lastCell = key; hitBlock(r, c, tapDmg(), true); }
  }
  PG.onDown = function (x, y) { lastCell = null; hitAt(x, y, true); };
  PG.onMove = function (x, y) { if (PG.input.down) hitAt(x, y, false); };
  PG.setup(document.getElementById('c'), update, render);
  window.__dino = { st: st, update: update, hit: hitBlock, buy: buy, UPG: UPG, SP: SP, tapDmg: tapDmg };
  PG.init({ id: 'dino_dig', version: '1.0.0', defaults: { cash: 0, u: {}, f: {}, depth: 0, total: 0, t: 0, muted: false } }).then(function () {
    st.cash = PG.save.cash || 0; st.row0 = PG.save.depth || 0; resetRows();
    var away = PG.save.t ? (Date.now() - PG.save.t) / 1000 : 0; if (away > 60) { var cap = Math.min(away, 3 * 3600) * 0.5; var perSec = crewDps() * blockCash(Math.max(2, PG.save.depth || 0)) / blockHp(Math.max(2, PG.save.depth || 0)) * cashMul() + museumIncome() * cashMul() * 0.35; var amt = perSec * cap; if (amt >= 1) { st.cash += amt; st.welcome = { amt: amt, dbl: false }; } }
    PG.playing = true; PG.music({ scale: [0, 2, 3, 7, 8], root: 196, bpm: 88, wave: 'triangle', vol: 0.06, bass: 0.1 });
  });
})();
