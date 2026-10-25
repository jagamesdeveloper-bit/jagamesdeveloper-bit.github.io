/* GHOST GROCER - a cosy night shift. Serve ghost customers before they lose patience, and hide from the poltergeist.
   Art direction: hand-inked cartoon. Wobbly ink outlines that boil every few frames, flat washes, price-tag UI. */
(function () {
  'use strict';
  var U = PG.ui, TAU = 6.2832, VW = 480, VH = 820;
  var ITEMS = [
    { n: 'Boo-nanas', c: '#ffe066' }, { n: 'Ecto-cheese', c: '#b8f27c' }, { n: 'Moon Milk', c: '#e8f1ff' }, { n: 'Grave Cookies', c: '#a0673a' },
    { n: 'Pumpkin', c: '#ff922b' }, { n: 'Witch Apple', c: '#c0394d' }, { n: 'Bat Wings', c: '#9775fa' }, { n: 'Star Jelly', c: '#63e6be' }
  ];
  var UPS = [
    { id: 'hands', n: 'Quick Hands', d: 'Bag holds one more item', max: 3, base: 40, grow: 2.0 },
    { id: 'candle', n: 'Patience Candle', d: 'Ghosts wait 8% longer', max: 6, base: 30, grow: 1.5 },
    { id: 'garlic', n: 'Garlic Charm', d: '+1 garlic, faster recharge', max: 4, base: 50, grow: 1.7 },
    { id: 'tip', n: 'Tip Jar', d: '+15% coins', max: 8, base: 30, grow: 1.5 },
    { id: 'stock', n: 'Big Shelves', d: 'Shelves hold more stock', max: 4, base: 45, grow: 1.7 }
  ];
  var st = { state: 'menu', night: 1, t: 0, dur: 75, ghosts: [], bag: [], stock: [], restock: [], hearts: 3, coinsNight: 0, served: 0, spawnT: 1, poltT: 18, polt: null, hiding: false, garlic: 2, garlicT: 0, over: false, win: false, endT: 0, flicker: 0, cat: { ear: 0, hiss: 0, tail: 0 }, view: { s: 1, ox: 0, oy: 0 }, revUsed: false, doubled: false, shake: 0, msg: null, runIdx: 0, tut: true, drops: [], paid: 0, payout: 0 };
  var dust = []; for (var i = 0; i < 26; i++) dust.push({ x: Math.random() * VW, y: Math.random() * VH, p: Math.random() * 9, s: 0.3 + Math.random() });
  var stars = []; for (i = 0; i < 40; i++) stars.push({ x: Math.random(), y: Math.random(), p: Math.random() * 9, r: Math.random() * 1.4 + 0.4 });

  function up(id) { return PG.upLevel(id); }
  function nTypes() { return Math.min(3 + Math.floor((st.night - 1) / 2), ITEMS.length); }
  function bagMax() { return 3 + up('hands'); }
  function stockMax() { return 5 + 2 * up('stock'); }
  function garlicMax() { return 2 + up('garlic'); }
  function startNight(n) {
    st.night = n; st.state = 'play'; st.t = 0; st.dur = 70 + Math.min(40, n * 3); st.ghosts = []; st.bag = []; st.hearts = 3; st.coinsNight = 0; st.served = 0; st.spawnT = 1.2; st.polt = null; st.poltT = n >= 2 ? 22 : 999; st.hiding = false; st.garlic = garlicMax(); st.garlicT = 0; st.over = false; st.win = false; st.revUsed = false; st.doubled = false; st.msg = null; st.drops = []; st.paid = 0; st.payout = 0;
    st.stock = []; for (var i = 0; i < ITEMS.length; i++) st.stock.push(stockMax()); st.restock = []; for (i = 0; i < ITEMS.length; i++) st.restock.push(0); st.runIdx++; PG.playing = true; PG.parts = []; PG.pops = []; st.tut = !PG.save.nights;
    PG.track('progression_started', { step_id: 'night', step_index: Math.min(n, 40) }); PG.msg('level_started', { level: String(n) });
  }
  function slotX(i) { return VW * (0.2 + i * 0.3); }
  function spawnGhost() {
    var used = st.ghosts.map(function (g) { return g.slot; }); var free = [0, 1, 2].filter(function (s) { return used.indexOf(s) < 0; }); if (!free.length) return;
    var n = st.night, cnt = 1 + (n >= 3 && Math.random() < 0.5 ? 1 : 0) + (n >= 6 && Math.random() < 0.45 ? 1 : 0) + (n >= 11 && Math.random() < 0.4 ? 1 : 0), want = [], types = nTypes(); for (var i = 0; i < cnt; i++) want.push(Math.floor(Math.random() * types));
    var pat = Math.max(10, 28 - n * 1.3) * (1 + 0.08 * up('candle')) * (0.8 + cnt * 0.2);
    st.ghosts.push({ slot: PG.pick(free), want: want, got: [], pat: pat, mpat: pat, x: -60, y: 500, tx: 0, t: 0, kind: Math.floor(Math.random() * 4), leaving: 0, mood: 0, happy: 0, ph: Math.random() * 6, scare: 0, dead: false, hat: Math.floor(Math.random() * 3) });
    st.ghosts[st.ghosts.length - 1].tx = slotX(st.ghosts[st.ghosts.length - 1].slot); PG.sfx('ghost', 0.9 + Math.random() * 0.4);
  }
  function takeItem(i) {
    if (st.state !== 'play' || st.over || st.hiding) return; if (st.bag.length >= bagMax()) { PG.sfx('err'); st.msg = { s: 'Bag full!', t: 0 }; return; } if (st.stock[i] <= 0) { PG.sfx('err'); return; }
    st.stock[i]--; st.bag.push(i); PG.sfx('pop', 0.9 + i * 0.05); if (st.stock[i] <= 0) st.restock[i] = 4.5; st.tut = false;
  }
  function serve(g) {
    if (st.over || st.hiding || g.leaving) return; var given = false;
    for (var k = st.bag.length - 1; k >= 0; k--) { var it = st.bag[k], wi = g.want.indexOf(it); if (wi >= 0) { g.want.splice(wi, 1); g.got.push(it); st.bag.splice(k, 1); given = true; PG.sfx('coin', 1 + g.got.length * 0.08); var gx = g.x, gy = g.y; st.drops.push({ x: PG.w / 2, y: 0, tx: gx, ty: gy, t: 0, c: ITEMS[it].c, i: it }); } }
    if (!given) { PG.sfx('err'); g.scare = 0.4; return; }
    if (!g.want.length) { var tip = Math.round((g.got.length * 4 + g.pat / g.mpat * 6) * (1 + 0.15 * up('tip'))); st.coinsNight += tip; st.served++; g.leaving = 1; g.happy = 1; PG.popText(g.x, g.y - 70, '+' + tip, '#ffd84d', 28); PG.sfx('win', 1.1); PG.burst(g.x, g.y - 30, 14, { colors: ['#ffe066', '#fff', '#ff9ecb'], g: 100, up: 80, life: 1.0, shape: inkStar }); }
  }
  function startPolt() { st.polt = { t: 0, warn: 2.2, active: 0, x: -80, y: 300, dead: false, hit: 0, left: false }; st.flicker = 2.2; PG.sfx('ghost', 0.5); st.msg = { s: 'The lights flicker...', t: 0 }; }
  function endNight(win) {
    st.over = true; st.win = win; st.endT = 0; PG.playing = false; var bonus = win ? Math.round((8 + st.night * 3) * (1 + 0.15 * up('tip'))) : 0; st.bonus = bonus; var total = st.coinsNight + bonus; st.total = total; st.payout = win ? total : Math.floor(total * 0.5); var owed = st.payout - st.paid; if (owed > 0) { PG.save.coins = (PG.save.coins || 0) + owed; st.paid = st.payout; } PG.save.runs = (PG.save.runs || 0) + 1; // a continue never pays twice
    if (win) { PG.save.nights = Math.max(PG.save.nights || 0, st.night); PG.save.next = Math.max(PG.save.next || 1, st.night + 1); PG.sfx('win'); PG.track('progression_completed', { step_id: 'night', step_index: Math.min(st.night, 40), served: st.served, hearts: st.hearts }); PG.msg('level_completed', { level: String(st.night) }); } else { PG.sfx('lose'); PG.track('progression_failed', { step_id: 'night', step_index: Math.min(st.night, 40), served: st.served }); PG.msg('level_failed', { level: String(st.night) }); }
    PG.commit(true);
  }
  function loseHeart(g) { st.hearts--; st.shake = 8; PG.sfx('hit'); PG.vibrate(30); if (st.hearts <= 0) endNight(false); }

  function update(dt) {
    PG.updateParts(dt); PG.updatePops(dt); st.shake = Math.max(0, st.shake - dt * 30); st.cat.tail += dt; st.flicker = Math.max(0, st.flicker - dt); if (st.msg) { st.msg.t += dt; if (st.msg.t > 2.4) st.msg = null; }
    st.drops.forEach(function (d) { d.t += dt * 3; }); st.drops = st.drops.filter(function (d) { return d.t < 1; }); st.cat.hiss = Math.max(0, st.cat.hiss - dt);
    if (st.state !== 'play' || st.over) { if (st.over) st.endT += dt; return; }
    st.t += dt; if (st.t >= st.dur) { if (st.ghosts.every(function (g) { return g.leaving; }) || st.t > st.dur + 8) { endNight(true); return; } }
    st.hiding = PG.key('s') || PG.key('arrowdown') || (st.hideBtn && PG.input.down && PG.inRect(st.hideBtn.x, st.hideBtn.y, st.hideBtn.w, st.hideBtn.h));
    // spawn
    if (st.t < st.dur - 10) { st.spawnT -= dt; if (st.spawnT <= 0) { spawnGhost(); st.spawnT = Math.max(1.5, 7 - st.night * 0.6) * PG.rand(0.7, 1.3); } }
    // restock
    for (var i = 0; i < st.restock.length; i++) if (st.restock[i] > 0) { st.restock[i] -= dt; if (st.restock[i] <= 0) { st.stock[i] = stockMax(); PG.sfx('merge', 1.2); } }
    st.garlicT += dt; if (st.garlic < garlicMax() && st.garlicT > Math.max(7, 16 - up('garlic') * 2.5)) { st.garlic++; st.garlicT = 0; PG.sfx('bell', 1.3); }
    // ghosts
    st.ghosts.forEach(function (g) {
      g.ph += dt * 2; g.t += dt; g.scare = Math.max(0, g.scare - dt); if (g.leaving) { g.leaving += dt * 1.2; g.y -= dt * 90 * g.leaving; g.x += Math.sin(g.ph) * dt * 20; if (g.leaving > 2.4) g.dead = true; return; }
      g.x += (g.tx - g.x) * Math.min(1, dt * 2.2); g.y += ((500 + Math.sin(g.ph) * 8) - g.y) * Math.min(1, dt * 2.2);
      if (Math.abs(g.x - g.tx) < 4) { g.pat -= dt * (st.t > st.dur - 0 ? 1 : 1); } g.mood = 1 - g.pat / g.mpat;
      if (g.pat <= 0) { g.leaving = 1; g.happy = -1; loseHeart(g); PG.popText(g.x, g.y - 70, 'Grr!', '#ff6b6b', 26); }
    }); st.ghosts = st.ghosts.filter(function (g) { return !g.dead; });
    // poltergeist
    st.poltT -= dt; if (!st.polt && st.poltT <= 0 && st.t < st.dur - 14 && st.night >= 2) { startPolt(); st.poltT = PG.rand(20, 30) - Math.min(8, st.night); }
    var p = st.polt; if (p) {
      p.t += dt; if (p.warn > 0) { p.warn -= dt; if (p.warn <= 0) { p.active = 4.2; PG.sfx('boom', 0.5); st.cat.hiss = 2; } }
      else if (p.active > 0) { p.active -= dt; p.x += (VW + 160) / 4.2 * dt * (p.left ? -1 : 1) + 0; p.y = 280 + Math.sin(p.t * 3) * 90; p.hit -= dt;
        if (!p.dead && p.hit <= 0 && !st.hiding) { p.hit = 1.1; var tg = st.ghosts.filter(function (g) { return !g.leaving; }); if (tg.length) { var gg = PG.pick(tg); gg.pat = Math.max(0.5, gg.pat - gg.mpat * 0.3); gg.scare = 1; PG.sfx('hit'); PG.popText(gg.x, gg.y - 70, 'Boo!', '#c8a2ff', 22); } var s = Math.floor(Math.random() * nTypes()); if (st.stock[s] > 0 && p.x > 40 && p.x < VW - 40) { st.stock[s] = 0; st.restock[s] = 5; st.bag = st.bag.filter(function (b) { return true; }); PG.sfx('hit', 0.6); PG.burst(VW * (0.15 + 0.23 * (s % 4)), 120 + Math.floor(s / 4) * 105, 8, { colors: ITEMS[s].c ? [ITEMS[s].c, '#fff'] : ['#fff'], g: 400 }); st.shake = 6; } }
        if (st.hiding && p.hit <= 0) { p.hit = 99; st.hiddenBonus = true; }
        if (p.x > VW + 90 || p.x < -90 || p.active <= 0) { if (st.hiding && !p.dead) { st.coinsNight += 3; PG.popText(VW / 2, VH * 0.45, 'Safe! +3', '#9be564', 26); } st.polt = null; } }
    }
    st.cat.ear = Math.max(0, st.cat.ear - dt);
  }

  /* ---------- hand-inked drawing helpers ---------- */
  var INK = '#1b1630', PAPER = '#f3e7cf', NIGHT = '#2b2350';
  function boil() { return Math.floor(PG.time / 0.12) % 3; }
  function jit(seed, i, amp, f) { return (PG.hash(seed * 13.7 + i * 7.31 + (f === undefined ? boil() : f) * 31.1) - 0.5) * 2 * amp; }
  function inkPts(c, pts, closed, amp, seed, f) { c.beginPath(); for (var i = 0; i < pts.length; i++) { var x = pts[i][0] + jit(seed, i, amp, f), y = pts[i][1] + jit(seed + 5.5, i, amp, f); if (i) c.lineTo(x, y); else c.moveTo(x, y); } if (closed) c.closePath(); }
  function circlePts(x, y, rx, ry, n) { var p = []; for (var i = 0; i < n; i++) { var a = i / n * TAU; p.push([x + Math.cos(a) * rx, y + Math.sin(a) * (ry || rx)]); } return p; }
  function rectPts(x, y, w, h, step) { var p = [], i; step = step || 14; for (i = 0; i < w; i += step) p.push([x + i, y]); for (i = 0; i < h; i += step) p.push([x + w, y + i]); for (i = w; i > 0; i -= step) p.push([x + i, y + h]); for (i = h; i > 0; i -= step) p.push([x, y + i]); return p; }
  function inkShape(c, pts, fill, lw, amp, seed, f) { // flat wash slightly off-register, then the wobbly ink line
    if (fill) { c.save(); c.translate(1.2, 1.4); inkPts(c, pts, true, amp * 0.5, seed + 2, f); c.fillStyle = fill; c.fill(); c.restore(); }
    inkPts(c, pts, true, amp, seed, f); c.lineWidth = lw || 2.6; c.strokeStyle = INK; c.lineJoin = 'round'; c.lineCap = 'round'; c.stroke();
  }
  function inkLine(c, x1, y1, x2, y2, lw, amp, seed, f) { var n = Math.max(2, Math.round(Math.hypot(x2 - x1, y2 - y1) / 16)), pts = []; for (var i = 0; i <= n; i++) pts.push([x1 + (x2 - x1) * i / n, y1 + (y2 - y1) * i / n]); inkPts(c, pts, false, amp, seed, f); c.lineWidth = lw; c.strokeStyle = INK; c.lineCap = 'round'; c.stroke(); }
  function wob(c, id, amt) { amt = amt || 1; c.translate(jit(id, 1, 0.7 * amt), jit(id, 2, 0.7 * amt)); c.rotate(jit(id, 3, 0.018 * amt)); }
  function inkStar(c, p, k) { var s = p.size * (0.5 + 0.5 * k); c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.beginPath(); for (var i = 0; i < 10; i++) { var a = i * Math.PI / 5, r = i % 2 ? s * 0.45 : s; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill(); c.lineWidth = 1.2; c.strokeStyle = INK; c.stroke(); c.restore(); }
  function sx(x) { return st.view.ox + x * st.view.s; } function sy(y) { return st.view.oy + y * st.view.s; }

  /* ---------- groceries ---------- */
  function drawItem(c, i, x, y, s, id) {
    c.save(); c.translate(x, y); if (id !== undefined) wob(c, id, 0.8); c.scale(s, s); var col = ITEMS[i].c; c.lineWidth = 2; c.strokeStyle = INK; c.lineJoin = 'round'; c.lineCap = 'round';
    function fs() { c.fillStyle = col; c.fill(); c.stroke(); }
    switch (i) {
      case 0: c.beginPath(); c.moveTo(-14, 6); c.quadraticCurveTo(-12, -16, 12, -14); c.quadraticCurveTo(2, -4, 4, 12); c.quadraticCurveTo(-8, 14, -14, 6); fs(); c.fillStyle = '#7a5b00'; c.fillRect(8, -17, 5, 5); c.beginPath(); c.moveTo(-8, -4); c.quadraticCurveTo(-6, 4, -2, 8); c.stroke(); break;
      case 1: c.beginPath(); c.moveTo(-16, 10); c.lineTo(14, 10); c.lineTo(14, -2); c.lineTo(-4, -14); c.closePath(); fs(); c.fillStyle = '#5f9a2c'; [[-4, 2], [6, 5], [0, -4]].forEach(function (h) { c.beginPath(); c.arc(h[0], h[1], 2.6, 0, TAU); c.fill(); }); break;
      case 2: c.beginPath(); c.moveTo(-9, 13); c.lineTo(-9, -9); c.lineTo(0, -16); c.lineTo(9, -9); c.lineTo(9, 13); c.closePath(); fs(); c.fillStyle = '#7b8bb8'; c.fillRect(-9, -3, 18, 8); c.strokeRect(-9, -3, 18, 8); c.fillStyle = INK; c.beginPath(); c.arc(0, 1, 2.5, 0, TAU); c.fill(); break;
      case 3: c.beginPath(); c.arc(0, 0, 13, 0, TAU); fs(); c.fillStyle = '#3b2412'; [[-5, -4], [5, -2], [0, 5], [-6, 5]].forEach(function (h) { c.beginPath(); c.arc(h[0], h[1], 2.2, 0, TAU); c.fill(); }); break;
      case 4: c.beginPath(); c.ellipse(0, 2, 15, 12, 0, 0, TAU); fs(); c.beginPath(); c.moveTo(-5, -9); c.quadraticCurveTo(-8, 2, -5, 13); c.moveTo(5, -9); c.quadraticCurveTo(8, 2, 5, 13); c.stroke(); c.fillStyle = '#2b8a3e'; c.fillRect(-2, -15, 4, 7); c.strokeRect(-2, -15, 4, 7); c.fillStyle = INK; c.beginPath(); c.moveTo(-7, 0); c.lineTo(-3, 3); c.lineTo(-7, 5); c.fill(); c.beginPath(); c.moveTo(7, 0); c.lineTo(3, 3); c.lineTo(7, 5); c.fill(); break;
      case 5: c.beginPath(); c.arc(0, 1, 12, 0, TAU); fs(); c.fillStyle = '#3a8a3a'; c.beginPath(); c.ellipse(5, -12, 6, 3, 0.6, 0, TAU); c.fill(); c.stroke(); c.beginPath(); c.moveTo(0, -10); c.lineTo(1, -16); c.stroke(); c.fillStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.arc(-4, -3, 3, 0, TAU); c.fill(); break;
      case 6: c.beginPath(); c.moveTo(0, 8); c.lineTo(-16, -8); c.quadraticCurveTo(-10, -2, -6, -8); c.quadraticCurveTo(-3, 0, 0, -8); c.quadraticCurveTo(3, 0, 6, -8); c.quadraticCurveTo(10, -2, 16, -8); c.closePath(); fs(); break;
      default: c.beginPath(); for (var k = 0; k < 10; k++) { var a = k * 0.628 - 1.57, r = k % 2 ? 6 : 14; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); fs(); c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.arc(-3, -3, 2, 0, TAU); c.fill();
    }
    c.restore();
  }

  /* ---------- the shop (three hand-drawn frames that boil) ---------- */
  var sceneCache = { key: '', frames: [] };
  function paintScene(c, f) {
    c.fillStyle = NIGHT; c.fillRect(0, 0, VW, 560); var rnd = PG.mulberry(7);
    for (var x = 20; x < VW; x += 40) { c.globalAlpha = 0.18; inkLine(c, x, 0, x, 560, 1.5, 1.6, x, f); c.globalAlpha = 1; }
    for (var i = 0; i < 60; i++) { c.fillStyle = 'rgba(243,231,207,.05)'; c.beginPath(); c.arc(rnd() * VW, rnd() * 560, 6 + rnd() * 16, 0, TAU); c.fill(); }
    c.fillStyle = '#101a3d'; inkShape(c, rectPts(190, 26, 100, 70, 12), '#101a3d', 3, 1.4, 11, f);
    for (i = 0; i < 16; i++) { c.fillStyle = 'rgba(243,231,207,' + (0.4 + rnd() * 0.5) + ')'; c.fillRect(195 + rnd() * 90, 30 + rnd() * 60, 1.6, 1.6); }
    inkShape(c, circlePts(262, 50, 12, 12, 14), PAPER, 2, 0.8, 13, f); c.fillStyle = '#101a3d'; c.beginPath(); c.arc(268, 47, 10, 0, TAU); c.fill();
    c.fillStyle = '#6b4f3a'; inkLine(c, 240, 26, 240, 96, 5, 1, 15, f); inkLine(c, 190, 61, 290, 61, 5, 1, 16, f); inkShape(c, rectPts(184, 20, 112, 82, 14), null, 5, 1.6, 17, f);
    inkShape(c, rectPts(178, 100, 124, 10, 16), '#6b4f3a', 2.4, 1, 19, f);
    // cobwebs in the corners
    [[0, 0, 1], [VW, 0, -1]].forEach(function (cw, k) { c.globalAlpha = 0.55; for (var r = 18; r < 70; r += 16) { var pts = []; for (var a = 0; a <= 6; a++) { var an = a / 6 * Math.PI / 2, rr = r + (a % 2 ? -3 : 0); pts.push([cw[0] + cw[2] * Math.cos(an) * rr, cw[1] + Math.sin(an) * rr]); } inkPts(c, pts, false, 0.8, 21 + r + k * 50, f); c.lineWidth = 1.2; c.strokeStyle = PAPER; c.stroke(); } for (var a2 = 0; a2 <= 4; a2++) { var an2 = a2 / 4 * Math.PI / 2; inkLine(c, cw[0], cw[1], cw[0] + cw[2] * Math.cos(an2) * 74, Math.sin(an2) * 74, 1, 0.6, 31 + a2 + k * 9, f); } c.globalAlpha = 1; });
    // shelves
    for (var r2 = 0; r2 < 2; r2++) { var sy0 = 150 + r2 * 105; inkShape(c, rectPts(24, sy0 + 38, VW - 48, 10, 20), '#7a5236', 2.6, 1.2, 40 + r2, f); inkShape(c, rectPts(26, sy0 - 32, 7, 72, 14), '#5a3d2b', 2.2, 0.8, 44 + r2, f); inkShape(c, rectPts(VW - 33, sy0 - 32, 7, 72, 14), '#5a3d2b', 2.2, 0.8, 48 + r2, f); }
    // floor, counter, register
    c.fillStyle = '#231a33'; c.fillRect(0, 480, VW, VH - 480); for (var tx = 0; tx < VW; tx += 60) { c.globalAlpha = 0.25; inkLine(c, tx, 480, tx - 30, 572, 1.5, 1.2, 60 + tx, f); c.globalAlpha = 1; }
    inkShape(c, rectPts(-6, 568, VW + 12, 26, 24), '#9a6b48', 3, 1.4, 70, f); inkShape(c, rectPts(-6, 594, VW + 12, 240, 30), '#5a3a26', 3, 1.4, 71, f);
    for (tx = 40; tx < VW; tx += 80) { c.globalAlpha = 0.5; inkLine(c, tx, 600, tx + 2, 800, 2, 1.2, 80 + tx, f); c.globalAlpha = 1; }
    inkShape(c, rectPts(30, 538, 70, 34, 12), '#c9c0b5', 2.6, 1, 90, f); inkShape(c, rectPts(38, 516, 54, 24, 12), '#8d97a0', 2.4, 1, 91, f); c.fillStyle = '#9be564'; c.fillRect(44, 521, 42, 9); for (var b = 0; b < 3; b++) inkShape(c, rectPts(40 + b * 20, 546, 12, 8, 6), PAPER, 1.4, 0.6, 92 + b, f);
    // hanging lamp
    inkLine(c, VW / 2, 0, VW / 2, 52, 2, 0.8, 99, f); inkShape(c, [[VW / 2 - 34, 82], [VW / 2 - 14, 52], [VW / 2 + 14, 52], [VW / 2 + 34, 82]], '#e9b44c', 2.6, 1, 100, f);
  }
  function sceneFrame() {
    var d = PG.dpr || 1, s = st.view.s, key = Math.round(s * d * 100) + ''; if (sceneCache.key !== key) { sceneCache = { key: key, frames: [] }; }
    var f = boil(); if (!sceneCache.frames[f]) { var cv = document.createElement('canvas'); cv.width = Math.ceil(VW * s * d); cv.height = Math.ceil(VH * s * d); var c = cv.getContext('2d'); c.scale(s * d, s * d); paintScene(c, f); sceneCache.frames[f] = cv; }
    return sceneCache.frames[f];
  }
  function drawScene(c, t) {
    var lit = st.flicker > 0 ? (Math.sin(t * 40) > 0 ? 0.35 : 1) : 1;
    c.drawImage(sceneFrame(), 0, 0, VW, VH);
    c.save(); var flick = st.flicker > 0 ? (Math.sin(t * 50) > 0 ? 1 : 0.2) : 1; c.translate(66, 54); wob(c, 5); c.rotate(-0.06); c.shadowColor = '#ff4d79'; c.shadowBlur = 14 * flick; U.text(c, 'OPEN', 0, 0, 30, 'rgba(255,90,130,' + 0.95 * flick + ')', 'center', { shadow: false }); c.restore();
    var types = nTypes();
    for (var i = 0; i < ITEMS.length; i++) { var col = i % 4, row = Math.floor(i / 4), ix = VW * (0.15 + 0.23 * col), iy = 150 + row * 105, avail = i < types;
      c.globalAlpha = avail ? 1 : 0.2; var cnt = st.stock[i] === undefined ? 0 : st.stock[i], per = Math.min(cnt, 6); for (var k = 0; k < per; k++) drawItem(c, i, ix - 28 + (k % 3) * 28, iy + 22 - Math.floor(k / 3) * 28 - 4, 0.8, i * 10 + k); c.globalAlpha = 1;
      if (avail) { c.save(); c.translate(ix, iy + 61); wob(c, 200 + i); c.fillStyle = PAPER; c.beginPath(); c.moveTo(-34, -8); c.lineTo(28, -8); c.lineTo(36, 0); c.lineTo(28, 8); c.lineTo(-34, 8); c.closePath(); c.fill(); c.strokeStyle = INK; c.lineWidth = 1.5; c.stroke(); c.fillStyle = INK; c.beginPath(); c.arc(26, 0, 2, 0, TAU); c.fill(); U.text(c, ITEMS[i].n, -4, 1, 13, INK, 'center', { font: 'body', shadow: false }); c.restore();
        if (st.restock[i] > 0) { U.text(c, 'restocking...', ix, iy - 6, 15, '#ffd84d', 'center', { font: 'body', shadow: false }); c.fillStyle = '#ffd84d'; c.fillRect(ix - 28, iy + 14, 56 * (1 - st.restock[i] / 5), 4); } } }
    drawCat(c, t);
    var lamp = c.createRadialGradient(VW / 2, 90, 20, VW / 2, 200, 460); lamp.addColorStop(0, 'rgba(255,214,140,' + 0.28 * lit + ')'); lamp.addColorStop(1, 'rgba(255,214,140,0)'); c.fillStyle = lamp; c.fillRect(0, 0, VW, 700);
    dust.forEach(function (d) { c.fillStyle = 'rgba(255,240,200,' + 0.25 * (0.5 + 0.5 * Math.sin(t + d.p)) + ')'; c.beginPath(); c.arc((d.x + Math.sin(t * 0.3 + d.p) * 12) % VW, ((d.y + t * 5 * d.s) % VH), 1.4, 0, TAU); c.fill(); });
    if (lit < 1) { c.fillStyle = 'rgba(5,0,20,' + (1 - lit) * 0.6 + ')'; c.fillRect(0, 0, VW, VH); }
  }
  function drawCat(c, t) {
    var x = VW * 0.82, y = 556, tail = Math.sin(st.cat.tail * 2.2) * 0.4, hiss = st.cat.hiss > 0; c.save(); c.translate(x, y); wob(c, 300, hiss ? 2 : 1);
    var tp = []; for (var k = 0; k <= 8; k++) { var u = k / 8; tp.push([-30 - u * 20, -2 - u * 26 + Math.sin(u * 3) * tail * 26]); } inkPts(c, tp, false, 0.6, 301); c.lineWidth = 8; c.strokeStyle = INK; c.lineCap = 'round'; c.stroke();
    inkShape(c, circlePts(0, 0, 34, 18, 18), '#16141f', 2.4, 1, 302);
    c.save(); c.translate(26, -14); if (hiss) c.rotate(Math.sin(t * 30) * 0.05); var head = circlePts(0, 0, 15, 14, 14); head.splice(3, 0, [12, -22 - (hiss ? 3 : 0)]); head.splice(head.length - 2, 0, [-12, -22 - (hiss ? 3 : 0)]); inkShape(c, head, '#16141f', 2.2, 0.8, 303);
    c.fillStyle = hiss ? '#ffd84d' : '#a6e22e'; [-1, 1].forEach(function (d) { c.beginPath(); c.ellipse(d * 6, -2, 3.2, hiss ? 4.4 : (Math.sin(t * 0.8) > 0.95 ? 0.5 : 3.6), 0, 0, TAU); c.fill(); }); c.fillStyle = '#111'; [-1, 1].forEach(function (d) { c.fillRect(d * 6 - 0.6, -4.5, 1.2, 5); });
    c.strokeStyle = PAPER; c.lineWidth = 0.9; [-1, 1].forEach(function (d) { c.beginPath(); c.moveTo(d * 9, 4); c.lineTo(d * 20, 2); c.moveTo(d * 9, 6); c.lineTo(d * 20, 8); c.stroke(); });
    if (hiss) { c.fillStyle = '#ff6b6b'; c.beginPath(); c.arc(0, 7, 3, 0, TAU); c.fill(); } c.restore(); c.restore();
  }

  /* ---------- characters ---------- */
  function ghostPts(w, hgt, ph) { var p = []; for (var i = 0; i <= 10; i++) { var a = Math.PI + i / 10 * Math.PI; p.push([Math.cos(a) * (w + 2), -hgt * 0.32 + Math.sin(a) * hgt * 0.68]); } p.push([w + 2, 10]); p.push([w, 34]); for (i = 0; i < 4; i++) { var bx = w - (i + 0.5) * (w * 2 / 4); p.push([bx, 46 + Math.sin(ph * 2 + i) * 4]); p.push([bx - w / 4, 34]); } p.push([-w - 2, 10]); return p; }
  function drawGhost(c, g, t) {
    var x = g.x, y = g.y, bob = Math.sin(g.ph) * 6, mood = g.mood, id = (g.kind + 1) * 17 + g.slot * 3; c.save(); c.translate(x + Math.sin(t * 40) * (g.scare > 0 ? 3 : 0), y + bob); wob(c, id);
    c.globalAlpha = g.leaving ? Math.max(0, 1 - (g.leaving - 1) * 0.8) : Math.min(1, g.t * 1.5);
    var kinds = ['#eef3ff', '#ddf7e8', '#ffe8f1', '#efe4ff'][g.kind], tint = mood > 0.7 ? '#ffc9c9' : kinds, w = 38, hgt = 52;
    c.fillStyle = 'rgba(0,0,0,.2)'; c.beginPath(); c.ellipse(0, 54 - bob, 26, 6, 0, 0, TAU); c.fill();
    [-1, 1].forEach(function (d) { inkShape(c, circlePts(d * (w + 5), 10 + Math.sin(g.ph * 1.5 + d) * 3, 9, 5.5, 10), kinds, 2, 0.6, id + d * 4); });
    inkShape(c, ghostPts(w, hgt, g.ph), tint, 2.8, 1.1, id);
    c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(-16, -30, 6, 10, -0.4, 0, TAU); c.fill();
    var worry = mood > 0.45; [-1, 1].forEach(function (d) { c.fillStyle = INK; c.beginPath(); c.ellipse(d * 12, -14, 4.6, g.leaving && g.happy > 0 ? 1.6 : 6.4, 0, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(d * 12 + 1.2, -16.5, 1.7, 0, TAU); c.fill(); if (worry) inkLine(c, d * 12 - 7, -27 + (mood > 0.7 ? d * 3 : -d * 3), d * 12 + 7, -23 + (mood > 0.7 ? -d * 3 : d * 3), 2.4, 0.5, id + d * 9); });
    c.fillStyle = 'rgba(255,120,150,.35)'; c.beginPath(); c.ellipse(-22, -2, 5, 3, 0, 0, TAU); c.ellipse(22, -2, 5, 3, 0, 0, TAU); c.fill();
    c.strokeStyle = INK; c.lineWidth = 2.6; c.lineCap = 'round'; c.beginPath(); if (g.happy > 0 || mood < 0.4) c.arc(0, -3, 8, 0.2, 2.9); else if (mood > 0.7) c.arc(0, 9, 8, 3.4, 6.0); else { c.moveTo(-6, 4); c.quadraticCurveTo(0, 2, 6, 5); } c.stroke();
    if (g.kind === 2 && g.hat === 0) inkShape(c, [[-20, -hgt + 12], [0, -hgt - 30], [20, -hgt + 12], [28, -hgt + 15], [-28, -hgt + 15]], '#6741d9', 2.2, 0.8, id + 50);
    else if (g.hat === 1) { inkShape(c, circlePts(0, -hgt + 8, 18, 10, 14).filter(function (p) { return p[1] <= -hgt + 9; }).concat([[18, -hgt + 10], [-18, -hgt + 10]]), '#e03131', 2.2, 0.8, id + 51); c.fillStyle = '#fff'; c.beginPath(); c.arc(-7, -hgt + 2, 3, 0, TAU); c.arc(7, -hgt + 4, 2.5, 0, TAU); c.fill(); }
    else if (g.hat === 2) inkShape(c, [[-12, -hgt + 12], [-12, -hgt - 4], [-5, -hgt + 4], [0, -hgt - 8], [5, -hgt + 4], [12, -hgt - 4], [12, -hgt + 12]], '#ffd84d', 2.2, 0.6, id + 52);
    c.restore();
    if (!g.leaving) {
      var n = g.want.length, bw = 40 + n * 34, by = y - 150; c.save(); c.translate(x, by + 23); wob(c, id + 70);
      var bub = []; for (var i = 0; i < 18; i++) { var a = i / 18 * TAU, r = 1 + 0.08 * Math.sin(i * 2.7); bub.push([Math.cos(a) * bw / 2 * r, Math.sin(a) * 26 * r]); } inkShape(c, bub, '#fffaf0', 2.2, 1, id + 71);
      inkShape(c, circlePts(-10, 34, 5, 5, 8), '#fffaf0', 1.6, 0.4, id + 72); inkShape(c, circlePts(-4, 44, 3, 3, 6), '#fffaf0', 1.4, 0.3, id + 73);
      g.want.forEach(function (it, k) { drawItem(c, it, -bw / 2 + 24 + k * 34, 0, 0.95); }); c.restore();
      var pw = 64, ph = 8, px = x - pw / 2, f2 = Math.max(0, g.pat / g.mpat); c.fillStyle = f2 > 0.5 ? '#7ed957' : f2 > 0.25 ? '#ffd84d' : '#ff6b6b'; c.fillRect(px, by - 16, pw * f2, ph); inkShape(c, rectPts(px, by - 16, pw, ph, 16), null, 1.8, 0.6, id + 80);
    }
  }
  function drawPolt(c, p, t) {
    if (p.warn > 0) { var pl = 0.5 + 0.5 * Math.sin(t * 20); c.fillStyle = 'rgba(130,80,220,' + 0.14 * pl + ')'; c.fillRect(0, 0, VW, VH); return; }
    c.save(); c.translate(p.x, p.y); wob(c, 400, 2.2); c.scale(1.3, 1.3);
    var gl = c.createRadialGradient(0, 0, 0, 0, 0, 90); gl.addColorStop(0, 'rgba(140,60,230,.5)'); gl.addColorStop(1, 'rgba(140,60,230,0)'); c.fillStyle = gl; c.fillRect(-90, -90, 180, 180);
    var pts = []; for (var i = 0; i <= 10; i++) { var a = Math.PI + i / 10 * Math.PI; pts.push([Math.cos(a) * 36, -14 + Math.sin(a) * 32]); } pts.push([34, 30]); for (i = 0; i < 5; i++) pts.push([34 - (i + 0.5) * 13.6, 44 + (i % 2 ? 8 : -2) + Math.sin(t * 9 + i) * 3]); pts.push([-34, 30]);
    inkShape(c, pts, '#2a1442', 3, 2, 401); c.fillStyle = '#ff2d55'; [-1, 1].forEach(function (d) { c.beginPath(); c.moveTo(d * 8, -16); c.lineTo(d * 20, -23); c.lineTo(d * 18, -10); c.closePath(); c.fill(); }); c.strokeStyle = '#ff2d55'; c.lineWidth = 3; c.beginPath(); c.moveTo(-12, 6); for (var z = 0; z < 6; z++) c.lineTo(-12 + z * 4.8, 6 + (z % 2 ? 5 : 0)); c.stroke(); c.restore();
    U.text(c, 'tap with garlic!', p.x, p.y + 66, 17, '#e9d5ff', 'center', { font: 'body', shadow: false, stroke: INK, strokeWidth: 3 });
  }
  function drawBag(c, t) {
    var bm = bagMax(), bw = 48, x0 = VW / 2 - bm * bw / 2, y = 700; c.save(); wob(c, 500, 0.6);
    inkShape(c, rectPts(x0 - 10, y - 30, bm * bw + 20, 60, 18), '#c9a26b', 2.6, 1.2, 501); c.fillStyle = 'rgba(0,0,0,.12)'; c.fillRect(x0 - 8, y + 14, bm * bw + 16, 14);
    for (var i = 0; i < bm; i++) { inkShape(c, rectPts(x0 + i * bw + 4, y - 22, bw - 8, 44, 11), 'rgba(255,240,210,.35)', 1.4, 0.6, 510 + i); if (st.bag[i] !== undefined) drawItem(c, st.bag[i], x0 + i * bw + bw / 2, y, 1.0, 520 + i); }
    c.restore(); U.text(c, 'BAG', VW / 2, y - 42, 16, PAPER, 'center', { font: 'body', shadow: false });
  }

  /* ---------- theme: price tags and taped notes ---------- */
  function tag(c, x, y, w, h, col, seed, press) {
    var off = press ? 2 : 0, pts = [[x, y + off], [x + w - h * 0.35, y + off], [x + w, y + off + h / 2], [x + w - h * 0.35, y + off + h], [x, y + off + h]];
    c.save(); c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); pts.forEach(function (p, i) { if (i) c.lineTo(p[0] + 3, p[1] + 4); else c.moveTo(p[0] + 3, p[1] + 4); }); c.closePath(); c.fill(); c.restore();
    inkShape(c, pts, col, 2.2, 0.9, seed); c.fillStyle = INK; c.beginPath(); c.arc(x + w - h * 0.42, y + off + h / 2, Math.min(4, h * 0.09), 0, TAU); c.fill();
    c.strokeStyle = 'rgba(27,22,48,.5)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x + w - h * 0.42, y + off + h / 2); c.quadraticCurveTo(x + w + 6, y + off - 6, x + w + 12, y + off + 2); c.stroke();
  }
  function hashStr(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 997; return h; }
  PG.theme.font = 'Creepster'; PG.theme.body = 'Patrick Hand'; PG.theme.weight = '400'; PG.theme.bodyWeight = '400'; PG.theme.text = PAPER; PG.theme.textShadow = false; PG.theme.pageColor = '#0d0818';
  PG.theme.popStyle = { stroke: INK };
  PG.theme.button = function (c, x, y, w, h, label, o, s) {
    var col = o.disabled ? '#a59e94' : o.color || '#ffd84d'; tag(c, x, y, w, h, s.hover ? U.shade(col, 0.12) : col, hashStr(label || 'x'), s.press);
    if (label) U.text(c, label, x + (w - h * 0.35) / 2, y + h / 2 + (s.press ? 2 : 0) + 1, U.fit(c, label, o.size || Math.min(h * 0.5, 26), w - h * 0.5 - 10, { font: 'body' }), INK, 'center', { font: 'body', shadow: false });
  };
  PG.theme.panel = function (c, x, y, w, h) {
    var pts = []; for (var i = 0; i <= 12; i++) pts.push([x + w * i / 12, y + (i % 2 ? 3 : -2)]); for (i = 1; i <= 8; i++) pts.push([x + w + (i % 2 ? 2 : -2), y + h * i / 8]); for (i = 11; i >= 0; i--) pts.push([x + w * i / 12, y + h + (i % 2 ? -3 : 2)]); for (i = 7; i >= 1; i--) pts.push([x + (i % 2 ? -2 : 2), y + h * i / 8]);
    c.save(); c.fillStyle = 'rgba(0,0,0,.35)'; c.translate(5, 7); inkPts(c, pts, true, 0, 0); c.fill(); c.restore(); inkShape(c, pts, PAPER, 2.6, 1, 601);
    [[x + 24, y - 6, -0.3], [x + w - 24, y - 6, 0.3]].forEach(function (tp) { c.save(); c.translate(tp[0], tp[1]); c.rotate(tp[2]); c.fillStyle = 'rgba(230,220,190,.85)'; c.fillRect(-22, -8, 44, 16); c.restore(); });
  };
  PG.theme.hudButton = function (c, x, y, r, kind) { inkShape(c, circlePts(x, y, r, r, 14), PAPER, 2.2, 0.8, 700 + (kind === 'pause' ? 1 : 0)); PG.hudIcon(c, x, y, r * 0.95, kind, INK); };
  PG.theme.transition = { time: 0.42, draw: function (c, w, h, k) { // an ink blot spreads across the page
    c.fillStyle = INK; c.beginPath(); var R = Math.hypot(w, h) * 0.62 * k, n = 28; for (var i = 0; i <= n; i++) { var a = i / n * TAU, r = R * (1 + 0.12 * Math.sin(i * 3.7 + k * 4) + 0.06 * Math.sin(i * 9.1)); c.lineTo(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r); } c.fill();
    for (i = 0; i < 10; i++) { var a2 = PG.hash(i) * TAU, d = R * (1.1 + PG.hash(i * 3) * 0.3); c.beginPath(); c.arc(w / 2 + Math.cos(a2) * d, h / 2 + Math.sin(a2) * d, R * 0.06 * PG.hash(i * 7), 0, TAU); c.fill(); }
  } };
  PG.theme.loading = function (c, w, h, t) { c.fillStyle = '#0d0818'; c.fillRect(0, 0, w, h); c.save(); c.translate(w / 2, h / 2 + Math.sin(t * 3) * 8); c.scale(0.8, 0.8); inkShape(c, ghostPts(30, 42, t * 2), '#eef3ff', 2.6, 1.2, 1); c.fillStyle = INK; c.beginPath(); c.ellipse(-9, -10, 3.4, 5, 0, 0, TAU); c.ellipse(9, -10, 3.4, 5, 0, 0, TAU); c.fill(); c.restore(); };

  /* ---------- screens ---------- */
  function heartInk(c, x, y, s, on, seed) { var pts = []; for (var i = 0; i <= 16; i++) { var a = i / 16 * TAU; pts.push([x + 16 * Math.pow(Math.sin(a), 3) * s / 16, y - (13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a)) * s / 16]); } inkShape(c, pts, on ? '#ff5d73' : 'rgba(243,231,207,.15)', 1.8, 0.5, seed); }
  function coinInk(c, x, y, r) { inkShape(c, circlePts(x, y, r, r, 12), '#ffd84d', 1.8, 0.5, 800); c.strokeStyle = INK; c.lineWidth = 1.4; c.beginPath(); c.arc(x, y, r * 0.55, 0, TAU); c.stroke(); }
  function drawHUD(c, w, h) {
    var sc = PG.scale(); U.text(c, 'Night ' + st.night, 16 * sc, 26 * sc, 30 * sc, '#c9b6ff', 'left', { shadow: false, stroke: INK, strokeWidth: 4 });
    var th = 20 + Math.min(1, st.t / st.dur) * 10, h24 = Math.floor(th) % 24, mm = Math.floor((th % 1) * 6) * 10; U.text(c, (h24 % 12 || 12) + ':' + ('0' + mm).slice(-2) + (h24 >= 12 ? ' PM' : ' AM'), 16 * sc, 54 * sc, 18 * sc, PAPER, 'left', { font: 'body', shadow: false, stroke: INK, strokeWidth: 3 });
    for (var i = 0; i < 3; i++) heartInk(c, 26 * sc + i * 26 * sc, 78 * sc, 11 * sc, i < st.hearts, 810 + i);
    coinInk(c, 106 * sc, 78 * sc, 9 * sc); U.text(c, '' + st.coinsNight, 120 * sc, 79 * sc, 20 * sc, '#ffd84d', 'left', { font: 'body', shadow: false, stroke: INK, strokeWidth: 3 });
    var bar = Math.min(1, st.t / st.dur); c.fillStyle = '#ffd84d'; c.fillRect(16 * sc, 96 * sc, 120 * sc * bar, 7 * sc); inkShape(c, rectPts(16 * sc, 96 * sc, 120 * sc, 7 * sc, 20), null, 1.6, 0.5, 820);
    if (st.msg) { var k = Math.min(1, st.msg.t * 4) * Math.min(1, (2.4 - st.msg.t) * 3); c.globalAlpha = Math.max(0, k); U.text(c, st.msg.s, w / 2, h * 0.2, 30 * sc, '#e9d5ff', 'center', { font: 'body', shadow: false, stroke: INK, strokeWidth: 5 }); c.globalAlpha = 1; }
  }
  function drawControls(c, w, h) {
    var s = st.view.s, hide = { x: sx(14), y: sy(742), w: 136 * s, h: 56 * s }, trash = { x: sx(VW - 14 - 84), y: sy(742), w: 84 * s, h: 56 * s }; st.hideBtn = hide;
    tag(c, hide.x, hide.y, hide.w, hide.h, st.hiding ? '#9f86e8' : '#c9b6ff', 901, st.hiding); U.text(c, st.hiding ? 'hiding...' : 'HOLD: hide', hide.x + (hide.w - hide.h * 0.35) / 2, hide.y + hide.h / 2 + (st.hiding ? 2 : 0) + 1, 19 * s, INK, 'center', { font: 'body', shadow: false });
    if (U.button(c, trash.x, trash.y, trash.w, trash.h, 'Clear', { color: '#d9d2c3', size: 18 * s })) st.bag = [];
    var gx = sx(VW / 2 - 60), gy = sy(742);
    for (var i = 0; i < garlicMax(); i++) { var gxx = gx + i * 28 * s + 12 * s; c.save(); c.translate(gxx, gy + 30 * s); c.scale(s, s); inkShape(c, [[0, -16], [8, -4], [10, 8], [0, 14], [-10, 8], [-8, -4]], i < st.garlic ? '#f6f1e6' : 'rgba(243,231,207,.12)', 1.8, 0.5, 910 + i); if (i < st.garlic) { c.strokeStyle = INK; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -12); c.quadraticCurveTo(-3, 0, 0, 13); c.stroke(); } c.restore(); }
    U.text(c, 'garlic', gx + 50 * s, gy + 2 * s, 15 * s, PAPER, 'center', { font: 'body', shadow: false });
    if (st.hiding) { c.fillStyle = 'rgba(0,0,0,.6)'; c.fillRect(0, 0, w, h); U.text(c, 'Hiding under the counter...', w / 2, h * 0.45, 28 * PG.scale(), '#e9d5ff', 'center', { font: 'body', shadow: false, stroke: INK, strokeWidth: 4 }); }
  }
  function drawOver(c, w, h) {
    var sc = PG.scale(), k = PG.ease.out(Math.min(1, Math.max(0, st.endT - 0.3) * 2)); if (k <= 0) return; c.fillStyle = 'rgba(10,5,30,' + 0.6 * k + ')'; c.fillRect(0, 0, w, h);
    var canRev = !st.win && !st.revUsed && PG.rewardedSupported(), canDbl = st.win && !st.doubled && PG.rewardedSupported(), pw = Math.min(w * 0.88, 370 * sc), ph = ((canRev || canDbl) ? 370 : 310) * sc, px = w / 2 - pw / 2, py = Math.max(12 * sc, h * 0.5 - ph / 2) + (1 - k) * 60; U.panel(c, px, py, pw, ph);
    U.text(c, st.win ? 'Dawn breaks!' : 'Haunted out!', w / 2, py + 46 * sc, 36 * sc, st.win ? '#d98a00' : '#b0233a', 'center', { shadow: false });
    U.text(c, 'Night ' + st.night + '  ·  ' + st.served + ' ghosts served', w / 2, py + 84 * sc, 19 * sc, INK, 'center', { font: 'body', shadow: false });
    coinInk(c, w / 2 - 58 * sc, py + 122 * sc, 13 * sc); U.text(c, '+' + st.payout + (st.doubled ? ' (x2)' : ''), w / 2 - 38 * sc, py + 124 * sc, 34 * sc, INK, 'left', { font: 'body', shadow: false });
    if (st.win && st.bonus) U.text(c, 'includes dawn bonus +' + st.bonus, w / 2, py + 156 * sc, 16 * sc, '#2f7d32', 'center', { font: 'body', shadow: false }); else if (!st.win) U.text(c, 'half pay for a haunted night', w / 2, py + 156 * sc, 16 * sc, '#7a5b6a', 'center', { font: 'body', shadow: false });
    var bw = pw * 0.8, bh = 48 * sc, yy = py + 178 * sc;
    if (canRev) { if (U.button(c, w / 2 - bw / 2, yy, bw, bh, 'Ad: +2 hearts, keep going', { color: '#c9b6ff', size: 18 * sc })) PG.rewarded('continue').then(function (ok) { if (ok) { st.revUsed = true; st.over = false; st.hearts = 2; PG.playing = true; PG.track('rewarded_continue', { night: st.night }); } }); yy += bh + 10 * sc; }
    else if (canDbl) { if (U.button(c, w / 2 - bw / 2, yy, bw, bh, 'Ad: double coins', { color: '#c9b6ff', size: 18 * sc })) { var e = st.payout; PG.rewarded('bonus').then(function (ok) { if (ok) { PG.save.coins += e; st.payout += e; st.paid = st.payout; st.doubled = true; PG.commit(true); } }); } yy += bh + 10 * sc; }
    if (U.button(c, w / 2 - bw / 2, yy, bw, bh, st.win ? 'Next night' : 'Try again', { color: '#ffd84d', size: 22 * sc })) { var nn = st.win ? st.night + 1 : st.night; PG.interstitial('level_end').then(function () { PG.go(function () { startNight(nn); }); }); }
    if (U.button(c, w / 2 - bw / 2, yy + bh + 10 * sc, bw / 2 - 5 * sc, bh * 0.82, 'Upgrades', { color: '#ffb36b', size: 17 * sc })) PG.go(function () { st.state = 'shop'; PG.track('shop_opened', { source: 'night_end' }); });
    if (U.button(c, w / 2 + 5 * sc, yy + bh + 10 * sc, bw / 2 - 5 * sc, bh * 0.82, 'Menu', { color: '#d9d2c3', size: 17 * sc })) PG.go(function () { st.state = 'menu'; });
  }
  function drawShop(c, w, h) {
    var sc = PG.scale(); c.fillStyle = 'rgba(10,5,30,.7)'; c.fillRect(0, 0, w, h); var pw = Math.min(w * 0.94, 440 * sc), rowH = 64 * sc, ph = 72 * sc + UPS.length * rowH + 72 * sc, px = w / 2 - pw / 2, py = Math.max(14 * sc, (h - ph) / 2); U.panel(c, px, py, pw, ph);
    U.text(c, 'Shop upgrades', px + 24 * sc, py + 40 * sc, 30 * sc, '#6741d9', 'left', { shadow: false }); coinInk(c, px + pw - 90 * sc, py + 38 * sc, 10 * sc); U.text(c, PG.fmt(PG.save.coins || 0), px + pw - 74 * sc, py + 40 * sc, 24 * sc, INK, 'left', { font: 'body', shadow: false });
    UPS.forEach(function (u, i) { var y = py + 66 * sc + i * rowH, L = PG.upLevel(u.id), cost = PG.upCost(u.base, u.grow, L), maxed = L >= u.max;
      U.text(c, u.n, px + 24 * sc, y + 16 * sc, 22 * sc, INK, 'left', { font: 'body', shadow: false }); U.text(c, u.d, px + 24 * sc, y + 37 * sc, 16 * sc, '#6b5a6e', 'left', { font: 'body', shadow: false });
      for (var k = 0; k < u.max; k++) { c.fillStyle = k < L ? '#7ed957' : 'rgba(27,22,48,.15)'; c.beginPath(); c.arc(px + 28 * sc + k * 13 * sc, y + 53 * sc, 4.5 * sc, 0, TAU); c.fill(); c.strokeStyle = INK; c.lineWidth = 1; c.stroke(); }
      var bw = 104 * sc, bh = 42 * sc, bx = px + pw - bw - 24 * sc; if (maxed) U.text(c, 'MAX', bx + bw / 2, y + 28 * sc, 22 * sc, '#2f7d32', 'center', { font: 'body', shadow: false }); else if (U.button(c, bx, y + 8 * sc, bw, bh, '' + cost, { color: (PG.save.coins || 0) >= cost ? '#ffd84d' : '#a59e94', size: 22 * sc })) PG.buyUp(u.id, cost, u.max); });
    if (U.button(c, w / 2 - 80 * sc, py + ph - 58 * sc, 160 * sc, 44 * sc, 'Back', { color: '#ffb36b', size: 20 * sc })) PG.go(function () { st.state = 'menu'; });
  }
  function drawMenu(c, w, h, t) {
    var sc = PG.scale(), land = w > h, cx = land ? w * 0.3 : w / 2; c.fillStyle = 'rgba(10,5,30,.4)'; c.fillRect(0, 0, w, h);
    var ty = land ? h * 0.18 : h * 0.12, sz = Math.min(70 * sc, (land ? w * 0.5 : w) * 0.18);
    c.save(); c.translate(cx, ty); wob(c, 950, 1.5); U.text(c, 'GHOST', 3, 4, sz, INK, 'center', { shadow: false }); U.text(c, 'GHOST', 0, 0, sz, '#e9d5ff', 'center', { shadow: false }); c.restore();
    c.save(); c.translate(cx, ty + sz * 0.95); wob(c, 951, 1.5); U.text(c, 'GROCER', 3, 4, sz * 1.05, INK, 'center', { shadow: false }); U.text(c, 'GROCER', 0, 0, sz * 1.05, '#ffd84d', 'center', { shadow: false }); c.restore();
    var g = { x: 0, y: 0, ph: t * 2, t: 5, kind: 0, mood: 0, happy: 1, want: [0, 1], got: [], pat: 10, mpat: 10, leaving: 0, scare: 0, hat: 1, slot: 0 }; c.save(); c.translate(cx, land ? h * 0.66 : h * 0.47); c.scale(sc * 1.15, sc * 1.15); drawGhost(c, g, t); c.restore();
    var bw = Math.min(250 * sc, w * 0.7), bh = 60 * sc, bx = land ? w * 0.72 - bw / 2 : w / 2 - bw / 2, y0 = land ? h * 0.3 : h * 0.66, next = Math.max(1, PG.save.next || 1);
    if (U.button(c, bx, y0, bw, bh, 'Open shop  (night ' + next + ')', { color: '#ffd84d', size: 22 * sc })) PG.go(function () { startNight(next); });
    if (U.button(c, bx, y0 + bh + 14 * sc, bw, bh * 0.82, 'Upgrades', { color: '#c9b6ff', size: 20 * sc })) PG.go(function () { st.state = 'shop'; PG.track('shop_opened', { source: 'menu' }); });
    var ly = y0 + bh * 1.82 + 36 * sc; coinInk(c, bx + bw / 2 - 40 * sc, ly, 10 * sc); U.text(c, PG.fmt(PG.save.coins || 0), bx + bw / 2 - 24 * sc, ly + 2, 24 * sc, '#ffd84d', 'left', { font: 'body', shadow: false, stroke: INK, strokeWidth: 3 }); U.text(c, 'Nights survived: ' + (PG.save.nights || 0), bx + bw / 2, ly + 28 * sc, 17 * sc, PAPER, 'center', { font: 'body', shadow: false, stroke: INK, strokeWidth: 3 });
    U.text(c, 'Music: starlightfrost   Sounds: Kenney', w / 2, h - 14 * sc, 14 * sc, 'rgba(243,231,207,.7)', 'center', { font: 'body', shadow: false });
  }
  function render(c, w, h) {
    var t = PG.time, sc0 = Math.min(w / VW, h / VH); st.view.s = sc0; st.view.ox = (w - VW * sc0) / 2; st.view.oy = (h - VH * sc0) / 2;
    c.fillStyle = '#0d0818'; c.fillRect(0, 0, w, h);
    c.save(); if (st.shake > 0.3) c.translate((Math.random() - 0.5) * st.shake, (Math.random() - 0.5) * st.shake); c.translate(st.view.ox, st.view.oy); c.scale(sc0, sc0); c.beginPath(); c.rect(0, 0, VW, VH); c.clip();
    drawScene(c, t);
    if (st.state === 'play') {
      st.ghosts.forEach(function (g) { drawGhost(c, g, t); }); if (st.polt) drawPolt(c, st.polt, t); drawBag(c, t);
      st.drops.forEach(function (d) { var e = PG.ease.out(d.t); drawItem(c, d.i, PG.lerp(VW / 2, d.tx, e), PG.lerp(700, d.ty, e) - Math.sin(d.t * 3.14) * 60, 0.9 * (1 - d.t * 0.4)); });
      PG.drawParts(c); PG.drawPops(c);
    }
    c.restore();
    PG.grain(c, w, h, 0.06, { mode: 'overlay', animate: true });
    if (st.state === 'menu') drawMenu(c, w, h, t); else if (st.state === 'shop') drawShop(c, w, h);
    else { drawControls(c, w, h); drawHUD(c, w, h); if (st.tut && st.t < 12) U.text(c, 'Tap a shelf to grab, tap a ghost to serve', w / 2, sy(536), 19 * PG.scale(), PAPER, 'center', { font: 'body', shadow: false, stroke: INK, strokeWidth: 4 }); if (st.over) drawOver(c, w, h); }
  }
  PG.onUp = function (x, y) {
    if (st.state !== 'play' || st.over || PG.userPaused) return; var s = st.view.s, bx = (x - st.view.ox) / s, by = (y - st.view.oy) / s; if (bx < 0 || bx > VW || by < 0 || by > VH) return;
    var p = st.polt; if (p && p.active > 0 && !p.dead && Math.hypot(bx - p.x, by - p.y) < 80) { if (st.garlic > 0) { st.garlic--; p.dead = true; p.active = 0; st.coinsNight += 5; PG.popText(p.x, p.y, 'BEGONE! +5', '#9be564', 26); PG.sfx('boom', 1.4); PG.burst(p.x, p.y, 30, { colors: ['#c084fc', '#fff', '#2a1442'], g: 100, life: 1, shape: inkStar }); st.polt = null; } else { PG.sfx('err'); PG.popText(p.x, p.y + 60, 'No garlic!', '#ff6b6b', 18); } return; }
    for (var i = 0; i < st.ghosts.length; i++) { var g = st.ghosts[i]; if (!g.leaving && Math.abs(bx - g.x) < 52 && by > g.y - 130 && by < g.y + 70) { serve(g); return; } }
    for (var k = 0; k < nTypes(); k++) { var col = k % 4, row = Math.floor(k / 4), ix = VW * (0.15 + 0.23 * col), iy = 150 + row * 105; if (Math.abs(bx - ix) < 52 && by > iy - 40 && by < iy + 76) { takeItem(k); return; } }
    var bm = bagMax(), bw = 48, x0 = VW / 2 - bm * bw / 2; if (by > 672 && by < 730) { var bi = Math.floor((bx - x0) / bw); if (bi >= 0 && bi < st.bag.length) st.bag.splice(bi, 1); }
  };
  PG.setup(document.getElementById('c'), update, render);
  window.__gg = { st: st, start: startNight, update: update, take: takeItem, serve: serve, spawn: spawnGhost, endNight: endNight, startPolt: startPolt };
  PG.init({ id: 'ghost_grocer', version: '1.1.0', defaults: { next: 1, nights: 0, coins: 0, runs: 0, up: {}, muted: false } }).then(function () {
    PG.music();
  });
})();
