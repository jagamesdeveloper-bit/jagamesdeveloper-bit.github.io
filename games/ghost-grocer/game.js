/* GHOST GROCER - a cosy night shift. Serve ghost customers before they lose patience, and hide from the poltergeist. */
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
  var st = { state: 'menu', night: 1, t: 0, dur: 75, ghosts: [], bag: [], stock: [], restock: [], hearts: 3, coinsNight: 0, served: 0, spawnT: 1, poltT: 18, polt: null, hiding: false, garlic: 2, garlicT: 0, over: false, win: false, endT: 0, flicker: 0, cat: { ear: 0, hiss: 0, tail: 0 }, view: { s: 1, ox: 0, oy: 0 }, revUsed: false, doubled: false, shake: 0, msg: null, runIdx: 0, tut: true, drops: [] };
  var dust = []; for (var i = 0; i < 26; i++) dust.push({ x: Math.random() * VW, y: Math.random() * VH, p: Math.random() * 9, s: 0.3 + Math.random() });
  var stars = []; for (i = 0; i < 40; i++) stars.push({ x: Math.random(), y: Math.random(), p: Math.random() * 9, r: Math.random() * 1.4 + 0.4 });

  function up(id) { return PG.upLevel(id); }
  function nTypes() { return Math.min(3 + Math.floor((st.night - 1) / 2), ITEMS.length); }
  function bagMax() { return 3 + up('hands'); }
  function stockMax() { return 5 + 2 * up('stock'); }
  function garlicMax() { return 2 + up('garlic'); }
  function startNight(n) {
    st.night = n; st.state = 'play'; st.t = 0; st.dur = 70 + Math.min(40, n * 3); st.ghosts = []; st.bag = []; st.hearts = 3; st.coinsNight = 0; st.served = 0; st.spawnT = 1.2; st.polt = null; st.poltT = n >= 2 ? 22 : 999; st.hiding = false; st.garlic = garlicMax(); st.garlicT = 0; st.over = false; st.win = false; st.revUsed = false; st.doubled = false; st.msg = null; st.drops = [];
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
    if (!g.want.length) { var tip = Math.round((g.got.length * 4 + g.pat / g.mpat * 6) * (1 + 0.15 * up('tip'))); st.coinsNight += tip; st.served++; g.leaving = 1; g.happy = 1; PG.popText(g.x, g.y - 70, '+' + tip, '#ffe066', 26); PG.sfx('win', 1.1); PG.burst(g.x, g.y - 30, 14, { colors: ['#ffe066', '#fff', '#ff9ecb'], g: 100, up: 80, life: 1.0 }); }
  }
  function startPolt() { st.polt = { t: 0, warn: 2.2, active: 0, x: -80, y: 300, dead: false, hit: 0, left: false }; st.flicker = 2.2; PG.sfx('ghost', 0.5); st.msg = { s: 'The lights flicker...', t: 0 }; }
  function endNight(win) {
    st.over = true; st.win = win; st.endT = 0; PG.playing = false; var bonus = win ? Math.round((8 + st.night * 3) * (1 + 0.15 * up('tip'))) : 0; st.bonus = bonus; var total = st.coinsNight + bonus; st.total = total; PG.save.coins = (PG.save.coins || 0) + (win ? total : Math.floor(total * 0.5)); PG.save.runs = (PG.save.runs || 0) + 1;
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
        if (p.x > VW + 90 || p.x < -90 || p.active <= 0) { if (st.hiding && !p.dead) { st.coinsNight += 3; PG.popText(PG.w / 2, PG.h * 0.5, 'Safe! +3', '#9be564', 26); } st.polt = null; } }
    }
    st.cat.ear = Math.max(0, st.cat.ear - dt);
  }

  /* ---------- drawing ---------- */
  function sx(x) { return st.view.ox + x * st.view.s; } function sy(y) { return st.view.oy + y * st.view.s; }
  function drawItem(c, i, x, y, s) {
    c.save(); c.translate(x, y); c.scale(s, s); var col = ITEMS[i].c;
    switch (i) {
      case 0: c.fillStyle = col; c.beginPath(); c.moveTo(-14, 6); c.quadraticCurveTo(-12, -16, 12, -14); c.quadraticCurveTo(2, -4, 4, 12); c.quadraticCurveTo(-8, 14, -14, 6); c.fill(); c.fillStyle = '#7a5b00'; c.fillRect(8, -17, 5, 5); c.fillStyle = 'rgba(255,255,255,.5)'; c.fillRect(-8, -4, 3, 8); break;
      case 1: c.fillStyle = col; c.beginPath(); c.moveTo(-16, 10); c.lineTo(14, 10); c.lineTo(14, -2); c.lineTo(-4, -14); c.closePath(); c.fill(); c.fillStyle = '#5f9a2c'; [[-4, 2], [6, 5], [0, -4]].forEach(function (h) { c.beginPath(); c.arc(h[0], h[1], 2.6, 0, TAU); c.fill(); }); break;
      case 2: c.fillStyle = col; c.fillRect(-9, -9, 18, 22); c.fillStyle = '#7b8bb8'; c.fillRect(-9, -3, 18, 8); c.fillStyle = col; c.beginPath(); c.moveTo(-9, -9); c.lineTo(0, -16); c.lineTo(9, -9); c.fill(); c.fillStyle = '#556'; c.beginPath(); c.arc(0, 1, 3.5, 0, TAU); c.fill(); break;
      case 3: c.fillStyle = col; c.beginPath(); c.arc(0, 0, 13, 0, TAU); c.fill(); c.fillStyle = '#3b2412'; [[-5, -4], [5, -2], [0, 5], [-6, 5]].forEach(function (h) { c.beginPath(); c.arc(h[0], h[1], 2.2, 0, TAU); c.fill(); }); break;
      case 4: c.fillStyle = col; c.beginPath(); c.ellipse(0, 2, 15, 12, 0, 0, TAU); c.fill(); c.fillStyle = '#2b8a3e'; c.fillRect(-2, -14, 4, 7); c.fillStyle = '#7a3b00'; c.beginPath(); c.moveTo(-6, 0); c.lineTo(-2, 3); c.lineTo(-6, 5); c.fill(); c.beginPath(); c.moveTo(6, 0); c.lineTo(2, 3); c.lineTo(6, 5); c.fill(); break;
      case 5: c.fillStyle = col; c.beginPath(); c.arc(0, 1, 12, 0, TAU); c.fill(); c.fillStyle = '#3a8a3a'; c.beginPath(); c.ellipse(5, -12, 6, 3, 0.6, 0, TAU); c.fill(); c.strokeStyle = '#5a3a1a'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, -10); c.lineTo(1, -16); c.stroke(); c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(-4, -3, 3, 0, TAU); c.fill(); break;
      case 6: c.fillStyle = col; c.beginPath(); c.moveTo(0, 8); c.lineTo(-16, -8); c.quadraticCurveTo(-10, -2, -6, -8); c.quadraticCurveTo(-3, 0, 0, -8); c.quadraticCurveTo(3, 0, 6, -8); c.quadraticCurveTo(10, -2, 16, -8); c.closePath(); c.fill(); break;
      default: c.fillStyle = col; c.beginPath(); for (var k = 0; k < 10; k++) { var a = k * 0.628 - 1.57, r = k % 2 ? 6 : 14; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); } c.closePath(); c.fill(); c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.arc(-3, -3, 2, 0, TAU); c.fill();
    }
    c.restore();
  }
  function drawGhost(c, g, t) {
    var x = g.x, y = g.y, bob = Math.sin(g.ph) * 6, sc = 1; var mood = g.mood; c.save(); c.translate(x + Math.sin(t * 40) * (g.scare > 0 ? 3 : 0), y + bob); c.globalAlpha = g.leaving ? Math.max(0, 1 - (g.leaving - 1) * 0.8) : Math.min(1, g.t * 1.5) * 0.92;
    var kinds = [['#e8f1ff', '#bcd0f5'], ['#d9f7e6', '#9fdcb8'], ['#ffe6f0', '#f5b0cc'], ['#ece0ff', '#c4aef5']][g.kind], tint = mood > 0.7 ? '#ffb4b4' : kinds[0]; var w = 38, hgt = 52;
    c.fillStyle = 'rgba(0,0,0,.18)'; c.beginPath(); c.ellipse(0, 52 - bob, 26, 6, 0, 0, TAU); c.fill();
    var gr = c.createLinearGradient(0, -hgt, 0, hgt * 0.8); gr.addColorStop(0, tint); gr.addColorStop(1, kinds[1]); c.fillStyle = gr; c.beginPath(); c.moveTo(-w, 34); c.quadraticCurveTo(-w - 4, -hgt, 0, -hgt); c.quadraticCurveTo(w + 4, -hgt, w, 34);
    for (var i = 0; i < 4; i++) { var bx = w - i * (w * 2 / 4) - w / 4; c.quadraticCurveTo(bx + 4, 50 + Math.sin(g.ph * 2 + i) * 4, bx - w / 4, 36); } c.closePath(); c.fill();
    // arms
    c.fillStyle = kinds[0]; [-1, 1].forEach(function (d) { c.beginPath(); c.ellipse(d * (w + 4), 10 + Math.sin(g.ph * 1.5 + d) * 3, 9, 5, d * 0.6, 0, TAU); c.fill(); });
    // face
    var worry = mood > 0.45; [-1, 1].forEach(function (d) { c.fillStyle = '#1b1b2f'; c.beginPath(); c.ellipse(d * 12, -14, 4.5, g.leaving && g.happy > 0 ? 1.6 : 6, 0, 0, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(d * 12 + 1, -16, 1.6, 0, TAU); c.fill(); if (worry) { c.strokeStyle = '#1b1b2f'; c.lineWidth = 2; c.beginPath(); c.moveTo(d * 12 - 6, -26 + (mood > 0.7 ? d * 2 : -d * 2)); c.lineTo(d * 12 + 6, -22 + (mood > 0.7 ? -d * 2 : d * 2)); c.stroke(); } });
    c.strokeStyle = '#1b1b2f'; c.lineWidth = 2.4; c.lineCap = 'round'; c.beginPath(); if (g.happy > 0 || mood < 0.4) c.arc(0, -3, 8, 0.2, 2.9); else if (mood > 0.7) c.arc(0, 9, 8, 3.4, 6.0); else c.moveTo(-6, 4), c.lineTo(6, 4); c.stroke();
    if (g.kind === 2 && g.hat === 0) { c.fillStyle = '#6741d9'; c.beginPath(); c.moveTo(-18, -hgt + 12); c.lineTo(0, -hgt - 30); c.lineTo(18, -hgt + 12); c.closePath(); c.fill(); c.fillRect(-26, -hgt + 10, 52, 5); } else if (g.hat === 1) { c.fillStyle = '#e03131'; c.beginPath(); c.arc(0, -hgt + 10, 18, Math.PI, TAU); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.arc(-7, -hgt + 2, 3, 0, TAU); c.arc(7, -hgt + 4, 2.5, 0, TAU); c.fill(); } else if (g.hat === 2) { c.fillStyle = '#ffd43b'; c.beginPath(); c.moveTo(-12, -hgt + 12); c.lineTo(-12, -hgt - 4); c.lineTo(-5, -hgt + 4); c.lineTo(0, -hgt - 8); c.lineTo(5, -hgt + 4); c.lineTo(12, -hgt - 4); c.lineTo(12, -hgt + 12); c.closePath(); c.fill(); }
    c.restore();
    // thought bubble with order
    if (!g.leaving) { var n = g.want.length, bw = 36 + n * 34, bx = x - bw / 2, by = y - 150; c.save(); c.fillStyle = 'rgba(255,255,255,.95)'; U.rr(c, bx, by, bw, 46, 18); c.fill(); c.beginPath(); c.arc(x - 8, by + 52, 5, 0, TAU); c.arc(x - 3, by + 62, 3, 0, TAU); c.fill(); g.want.forEach(function (it, k) { drawItem(c, it, bx + 24 + k * 34, by + 24, 0.95); }); g.got.forEach(function (it, k) { c.globalAlpha = 0.6; }); c.restore();
      var pw = 60, ph = 7, px = x - pw / 2, py = y - 160 + 56 + 14 + 0; c.fillStyle = 'rgba(0,0,0,.45)'; U.rr(c, px, by - 12, pw, ph, 3); c.fill(); var f = Math.max(0, g.pat / g.mpat); c.fillStyle = f > 0.5 ? '#69db7c' : f > 0.25 ? '#ffd43b' : '#ff6b6b'; U.rr(c, px, by - 12, pw * f, ph, 3); c.fill(); }
  }
  function drawPolt(c, p, t) {
    if (p.warn > 0) { var pl = 0.5 + 0.5 * Math.sin(t * 20); c.fillStyle = 'rgba(130,80,220,' + 0.12 * pl + ')'; c.fillRect(0, 0, VW, VH); return; }
    c.save(); c.translate(p.x, p.y); c.globalAlpha = 0.85 + Math.sin(t * 30) * 0.1; var s = 1.3; c.scale(s, s);
    var gl = c.createRadialGradient(0, 0, 0, 0, 0, 90); gl.addColorStop(0, 'rgba(140,60,230,.55)'); gl.addColorStop(1, 'rgba(140,60,230,0)'); c.fillStyle = gl; c.fillRect(-90, -90, 180, 180);
    c.fillStyle = '#2a1442'; c.beginPath(); c.moveTo(-34, 30); c.quadraticCurveTo(-40, -44, 0, -44); c.quadraticCurveTo(40, -44, 34, 30); for (var i = 0; i < 5; i++) c.lineTo(34 - (i + 0.5) * 13.6, 44 + (i % 2 ? 8 : -2) + Math.sin(t * 9 + i) * 3); c.closePath(); c.fill();
    c.fillStyle = '#ff2d55'; [-1, 1].forEach(function (d) { c.beginPath(); c.moveTo(d * 8, -16); c.lineTo(d * 20, -22); c.lineTo(d * 18, -10); c.closePath(); c.fill(); }); c.strokeStyle = '#ff2d55'; c.lineWidth = 3; c.beginPath(); c.moveTo(-10, 6); c.quadraticCurveTo(0, 14, 10, 6); c.stroke(); c.restore();
    U.text(c, 'TAP with garlic!', p.x, p.y + 64, 13, '#e9d5ff', 'center', { shadow: false });
  }
  function drawCat(c, t) {
    var x = VW * 0.82, y = 596; c.save(); c.translate(x, y); var tail = Math.sin(st.cat.tail * 2.2) * 0.4, hiss = st.cat.hiss > 0;
    c.fillStyle = '#16141f'; c.beginPath(); c.ellipse(0, 0, 36, 20, 0, 0, TAU); c.fill(); c.strokeStyle = '#16141f'; c.lineWidth = 7; c.lineCap = 'round'; c.beginPath(); c.moveTo(-32, -2); c.quadraticCurveTo(-52, -10 + tail * 30, -50, -30 + tail * 20); c.stroke();
    c.save(); c.translate(26, -14); if (hiss) c.rotate(Math.sin(t * 30) * 0.05); c.fillStyle = '#16141f'; c.beginPath(); c.arc(0, 0, 15, 0, TAU); c.fill(); [-1, 1].forEach(function (d) { c.beginPath(); c.moveTo(d * 4, -10); c.lineTo(d * 12, -22 - (hiss ? 3 : 0)); c.lineTo(d * 13, -6); c.closePath(); c.fill(); });
    c.fillStyle = hiss ? '#ffd43b' : '#a6e22e'; [-1, 1].forEach(function (d) { c.beginPath(); c.ellipse(d * 6, -2, 3, hiss ? 4 : (Math.sin(t * 0.8) > 0.95 ? 0.5 : 3.4), 0, 0, TAU); c.fill(); }); c.fillStyle = '#111'; [-1, 1].forEach(function (d) { c.fillRect(d * 6 - 0.6, -4, 1.2, 4); }); if (hiss) { c.fillStyle = '#ff6b6b'; c.beginPath(); c.arc(0, 7, 3, 0, TAU); c.fill(); }
    c.restore(); c.restore();
  }
  function drawScene(c, t) {
    var lit = st.flicker > 0 ? (Math.sin(t * 40) > 0 ? 0.35 : 1) : 1;
    // wall
    var wg = c.createLinearGradient(0, 0, 0, 560); wg.addColorStop(0, '#2a2147'); wg.addColorStop(1, '#3b2c63'); c.fillStyle = wg; c.fillRect(0, 0, VW, 560);
    c.fillStyle = 'rgba(255,255,255,.04)'; for (var x = 0; x < VW; x += 40) c.fillRect(x, 0, 2, 560);
    // window with moon
    c.fillStyle = '#101a3d'; c.fillRect(190, 26, 100, 70); stars.forEach(function (s) { c.fillStyle = 'rgba(255,255,255,' + (0.4 + 0.5 * Math.sin(t * 2 + s.p)) + ')'; c.fillRect(190 + s.x * 100, 26 + s.y * 70, s.r, s.r); }); c.fillStyle = '#f4f1de'; c.beginPath(); c.arc(262, 52, 12, 0, TAU); c.fill(); c.strokeStyle = '#6b4f3a'; c.lineWidth = 6; c.strokeRect(190, 26, 100, 70); c.beginPath(); c.moveTo(240, 26); c.lineTo(240, 96); c.moveTo(190, 61); c.lineTo(290, 61); c.stroke();
    // OPEN sign
    c.save(); var flick = st.flicker > 0 ? (Math.sin(t * 50) > 0 ? 1 : 0.2) : 1; c.fillStyle = 'rgba(255,80,120,' + 0.9 * flick + ')'; c.font = '800 20px ' + PG.font; c.textAlign = 'center'; c.shadowColor = '#ff4d79'; c.shadowBlur = 14 * flick; c.fillText('OPEN', 66, 56); c.shadowBlur = 0; c.restore();
    // shelves
    var types = nTypes(); for (var r = 0; r < 2; r++) { var sy0 = 150 + r * 105; c.fillStyle = '#5a3d2b'; c.fillRect(24, sy0 + 38, VW - 48, 8); c.fillStyle = '#3b2719'; c.fillRect(24, sy0 + 46, VW - 48, 4); c.fillRect(24, sy0 - 32, 6, 78); c.fillRect(VW - 30, sy0 - 32, 6, 78); }
    for (var i = 0; i < ITEMS.length; i++) { var col = i % 4, row = Math.floor(i / 4), ix = VW * (0.15 + 0.23 * col), iy = 150 + row * 105; var avail = i < types;
      c.globalAlpha = avail ? 1 : 0.18; var cnt = st.stock[i] === undefined ? 0 : st.stock[i]; var per = Math.min(cnt, 6); for (var k = 0; k < per; k++) drawItem(c, i, ix - 28 + (k % 3) * 28, iy + 22 - Math.floor(k / 3) * 28 - 4, 0.8); c.globalAlpha = 1;
      if (avail) { c.fillStyle = 'rgba(0,0,0,.4)'; U.rr(c, ix - 36, iy + 52, 72, 18, 6); c.fill(); U.text(c, ITEMS[i].n, ix, iy + 61, 11, '#f1e9ff', 'center', { shadow: false }); if (st.restock[i] > 0) { U.text(c, 'restocking', ix, iy - 4, 12, '#ffd43b', 'center', { shadow: false }); c.fillStyle = '#ffd43b'; c.fillRect(ix - 28, iy + 16, 56 * (1 - st.restock[i] / 5), 4); } } }
    // floor + counter
    var fg = c.createLinearGradient(0, 480, 0, VH); fg.addColorStop(0, '#2c2038'); fg.addColorStop(1, '#1b1226'); c.fillStyle = fg; c.fillRect(0, 480, VW, VH - 480); c.fillStyle = 'rgba(255,255,255,.05)'; for (var tx = 0; tx < VW; tx += 60) c.fillRect(tx, 480, 2, VH);
    c.fillStyle = '#7a5236'; c.fillRect(0, 572, VW, 20); c.fillStyle = '#9a6b48'; c.fillRect(0, 572, VW, 5); c.fillStyle = '#4a2f1d'; c.fillRect(0, 592, VW, 228); c.fillStyle = 'rgba(0,0,0,.2)'; for (tx = 0; tx < VW; tx += 80) c.fillRect(tx + 2, 600, 4, 220);
    // register
    c.fillStyle = '#c9c0b5'; c.fillRect(30, 538, 70, 36); c.fillStyle = '#7e8a92'; c.fillRect(36, 520, 58, 20); c.fillStyle = '#9be564'; c.fillRect(42, 524, 46, 8);
    drawCat(c, t);
    // warm lamp lighting overlay for ambiance
    var lamp = c.createRadialGradient(VW / 2, 120, 20, VW / 2, 200, 460); lamp.addColorStop(0, 'rgba(255,214,140,' + 0.25 * lit + ')'); lamp.addColorStop(1, 'rgba(255,214,140,0)'); c.fillStyle = lamp; c.fillRect(0, 0, VW, 700);
    dust.forEach(function (d) { c.fillStyle = 'rgba(255,240,200,' + 0.25 * (0.5 + 0.5 * Math.sin(t + d.p)) + ')'; c.beginPath(); c.arc((d.x + Math.sin(t * 0.3 + d.p) * 12) % VW, ((d.y + t * 5 * d.s) % VH), 1.4, 0, TAU); c.fill(); });
    if (lit < 1) { c.fillStyle = 'rgba(5,0,20,' + (1 - lit) * 0.6 + ')'; c.fillRect(0, 0, VW, VH); }
  }
  function drawBag(c, t) {
    var bm = bagMax(), bw = 48, x0 = VW / 2 - bm * bw / 2, y = 700; c.fillStyle = 'rgba(0,0,0,.35)'; U.rr(c, x0 - 8, y - 30, bm * bw + 16, 60, 16); c.fill(); c.strokeStyle = 'rgba(255,255,255,.2)'; c.lineWidth = 2; c.stroke();
    for (var i = 0; i < bm; i++) { c.fillStyle = 'rgba(255,255,255,.08)'; U.rr(c, x0 + i * bw + 2, y - 24, bw - 4, 48, 10); c.fill(); if (st.bag[i] !== undefined) drawItem(c, st.bag[i], x0 + i * bw + bw / 2, y, 1.0); }
    U.text(c, 'BAG', VW / 2, y - 40, 11, '#cbbcf0', 'center', { shadow: false });
  }
  function drawHUD(c, w, h) {
    var sc = PG.scale(); U.text(c, 'Night ' + st.night, 14 * sc, 24 * sc, 24 * sc, '#fff', 'left', { stroke: 'rgba(0,0,0,.45)' });
    var th = 20 + Math.min(1, st.t / st.dur) * 10, h24 = Math.floor(th) % 24, mm = Math.floor((th % 1) * 6) * 10; U.text(c, (h24 % 12 || 12) + ':' + ('0' + mm).slice(-2) + (h24 >= 12 ? ' PM' : ' AM'), 14 * sc, 50 * sc, 15 * sc, '#cbbcf0', 'left', { shadow: false });
    for (var i = 0; i < 3; i++) { c.fillStyle = i < st.hearts ? '#ff5d73' : 'rgba(255,255,255,.2)'; c.save(); c.translate(24 * sc + i * 24 * sc, 76 * sc); c.scale(sc * 0.9, sc * 0.9); c.beginPath(); c.moveTo(0, 6); c.bezierCurveTo(-14, -4, -8, -14, 0, -6); c.bezierCurveTo(8, -14, 14, -4, 0, 6); c.fill(); c.restore(); }
    U.coin(c, 100 * sc, 76 * sc, 8 * sc); U.text(c, '' + st.coinsNight, 112 * sc, 77 * sc, 16 * sc, '#ffe066', 'left', { stroke: 'rgba(0,0,0,.4)' });
    var bar = Math.min(1, st.t / st.dur); c.fillStyle = 'rgba(0,0,0,.4)'; U.rr(c, 14 * sc, 94 * sc, 120 * sc, 6 * sc, 3); c.fill(); c.fillStyle = '#ffd43b'; U.rr(c, 14 * sc, 94 * sc, 120 * sc * bar, 6 * sc, 3); c.fill();
    if (st.msg) { var k = Math.min(1, st.msg.t * 4) * Math.min(1, (2.4 - st.msg.t) * 3); c.globalAlpha = k; U.text(c, st.msg.s, w / 2, h * 0.2, 26 * sc, '#e9d5ff', 'center', { stroke: 'rgba(0,0,0,.6)' }); c.globalAlpha = 1; }
  }
  function drawControls(c, w, h) {
    var s = st.view.s, hide = { x: sx(14), y: sy(742), w: 120 * s, h: 56 * s }, trash = { x: sx(VW - 14 - 70), y: sy(742), w: 70 * s, h: 56 * s }; st.hideBtn = hide;
    var press = st.hiding; c.save(); U.rr(c, hide.x, hide.y + (press ? 3 : 0), hide.w, hide.h, 14); c.fillStyle = press ? '#5b3fb5' : '#7c5cdb'; c.fill(); c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = 2; c.stroke(); c.restore(); U.text(c, press ? 'HIDING' : 'HOLD: Hide', hide.x + hide.w / 2, hide.y + hide.h / 2 + 1, 15 * s, '#fff', 'center', { shadow: false });
    if (U.button(c, trash.x, trash.y, trash.w, trash.h, 'Clear', { color: '#6b6b80', size: 14 * s })) { st.bag = []; }
    // garlic
    var gx = sx(VW / 2 - 60), gy = sy(742), gw = 120 * s; for (var i = 0; i < garlicMax(); i++) { var gxx = gx + i * 26 * s + 10 * s; c.fillStyle = i < st.garlic ? '#f1f3f5' : 'rgba(255,255,255,.15)'; c.beginPath(); c.moveTo(gxx, gy + 14 * s); c.quadraticCurveTo(gxx - 14 * s, gy + 36 * s, gxx, gy + 46 * s); c.quadraticCurveTo(gxx + 14 * s, gy + 36 * s, gxx, gy + 14 * s); c.fill(); }
    U.text(c, 'Garlic', gx + gw / 2 - 10 * s, gy + 6 * s, 11 * s, '#cbbcf0', 'center', { shadow: false });
    if (st.hiding) { c.fillStyle = 'rgba(0,0,0,.55)'; c.fillRect(0, 0, w, h); U.text(c, 'Hiding under the counter...', w / 2, h * 0.45, 24 * PG.scale(), '#e9d5ff', 'center'); }
  }
  function drawOver(c, w, h) {
    var sc = PG.scale(), k = PG.ease.out(Math.min(1, st.endT * 2)); c.fillStyle = 'rgba(10,5,30,' + 0.6 * k + ')'; c.fillRect(0, 0, w, h);
    var pw = Math.min(w * 0.88, 380 * sc), ph = 380 * sc, px = w / 2 - pw / 2, py = h * 0.5 - ph / 2 + (1 - k) * 60; U.panel(c, px, py, pw, ph);
    U.text(c, st.win ? 'Dawn breaks!' : 'Shop haunted out', w / 2, py + 40 * sc, 30 * sc, st.win ? '#ffd23f' : '#ff8a8a', 'center'); U.text(c, 'Night ' + st.night + '  -  ' + st.served + ' ghosts served', w / 2, py + 76 * sc, 16 * sc, '#cbd5e1', 'center', { shadow: false });
    U.coin(c, w / 2 - 66 * sc, py + 120 * sc, 13 * sc); U.text(c, '+' + (st.win ? st.total : Math.floor(st.total * 0.5)) + (st.doubled ? ' (x2)' : ''), w / 2 - 46 * sc, py + 121 * sc, 32 * sc, '#ffe066', 'left'); if (st.win && st.bonus) U.text(c, 'includes dawn bonus +' + st.bonus, w / 2, py + 154 * sc, 13 * sc, '#9be564', 'center', { shadow: false });
    var bw = pw * 0.84, bh = 48 * sc, yy = py + 176 * sc;
    if (!st.win && !st.revUsed && PG.rewardedSupported()) { if (U.button(c, w / 2 - bw / 2, yy, bw, bh, 'Watch ad: +2 hearts, keep going', { color: '#8338ec', size: 16 * sc })) PG.rewarded('continue').then(function (ok) { if (ok) { PG.save.coins -= Math.floor(st.total * 0.5); st.revUsed = true; st.over = false; st.hearts = 2; PG.playing = true; PG.track('rewarded_continue', { night: st.night }); } }); yy += bh + 8 * sc; }
    else if (st.win && !st.doubled && PG.rewardedSupported()) { if (U.button(c, w / 2 - bw / 2, yy, bw, bh, 'Watch ad: double coins', { color: '#8338ec', size: 17 * sc })) { var e = st.total; PG.rewarded('bonus').then(function (ok) { if (ok) { PG.save.coins += e; st.total += e; st.doubled = true; PG.commit(true); } }); } yy += bh + 8 * sc; }
    if (U.button(c, w / 2 - bw / 2, yy, bw, bh, st.win ? 'Next night' : 'Try again', { color: '#7c5cdb' })) PG.interstitial('level_end').then(function () { startNight(st.win ? st.night + 1 : st.night); });
    if (U.button(c, w / 2 - bw / 2, yy + bh + 8 * sc, bw / 2 - 5 * sc, bh * 0.8, 'Upgrades', { color: '#ff9f1c', size: 15 * sc })) { st.state = 'shop'; PG.track('shop_opened', { source: 'night_end' }); }
    if (U.button(c, w / 2 + 5 * sc, yy + bh + 8 * sc, bw / 2 - 5 * sc, bh * 0.8, 'Menu', { color: '#5c6bc0', size: 15 * sc })) st.state = 'menu';
  }
  function drawShop(c, w, h) {
    var sc = PG.scale(); c.fillStyle = 'rgba(10,5,30,.8)'; c.fillRect(0, 0, w, h); var pw = Math.min(w * 0.94, 440 * sc), px = w / 2 - pw / 2, py = 20 * sc, rowH = 64 * sc, ph = 68 * sc + UPS.length * rowH + 76 * sc; U.panel(c, px, py, pw, ph);
    U.text(c, 'Shop Upgrades', w / 2, py + 34 * sc, 28 * sc, '#ffd23f', 'center'); U.coin(c, px + pw - 84 * sc, py + 34 * sc, 11 * sc); U.text(c, PG.fmt(PG.save.coins || 0), px + pw - 68 * sc, py + 35 * sc, 20 * sc, '#ffe066', 'left');
    UPS.forEach(function (u, i) { var y = py + 62 * sc + i * rowH, L = PG.upLevel(u.id), cost = PG.upCost(u.base, u.grow, L), maxed = L >= u.max; U.text(c, u.n, px + 18 * sc, y + 17 * sc, 18 * sc, '#fff', 'left'); U.text(c, u.d, px + 18 * sc, y + 37 * sc, 13 * sc, '#cbd5e1', 'left', { shadow: false }); for (var k = 0; k < u.max; k++) { c.fillStyle = k < L ? '#9be564' : 'rgba(255,255,255,.2)'; c.beginPath(); c.arc(px + 22 * sc + k * 11 * sc, y + 53 * sc, 4 * sc, 0, TAU); c.fill(); }
      var bw = 104 * sc, bh = 44 * sc, bx = px + pw - bw - 14 * sc; if (maxed) U.text(c, 'MAX', bx + bw / 2, y + 28 * sc, 18 * sc, '#9be564', 'center'); else if (U.button(c, bx, y + 7 * sc, bw, bh, cost + '', { color: PG.save.coins >= cost ? '#2ec4b6' : '#8a8f98', size: 20 * sc })) PG.buyUp(u.id, cost, u.max); });
    if (U.button(c, w / 2 - 90 * sc, py + ph - 62 * sc, 180 * sc, 46 * sc, 'Back', { color: '#ff9f1c' })) st.state = st.over ? 'menu' : 'menu';
  }
  function drawMenu(c, w, h, t) {
    var sc = PG.scale(); c.fillStyle = 'rgba(10,5,30,.35)'; c.fillRect(0, 0, w, h); U.text(c, 'GHOST', w / 2, h * 0.12, Math.min(62 * sc, w * 0.17), '#e9d5ff', 'center', { stroke: '#3b2c63' }); U.text(c, 'GROCER', w / 2, h * 0.12 + 56 * sc, Math.min(66 * sc, w * 0.18), '#ffd43b', 'center', { stroke: '#6b3d00' });
    var g = { x: w / 2, y: h * 0.42, ph: t * 2, t: 5, kind: 0, mood: 0, happy: 1, want: [0, 1], got: [], pat: 10, mpat: 10, leaving: 0, scare: 0, hat: 0 }; c.save(); c.translate(w / 2, h * 0.5); c.scale(sc * 1.25, sc * 1.25); g.x = 0; g.y = 0; drawGhost(c, g, t); c.restore();
    var bw = 230 * sc, bh = 62 * sc, y0 = h * 0.62, next = Math.max(1, PG.save.next || 1); if (U.button(c, w / 2 - bw / 2, y0, bw, bh, 'Open shop  (Night ' + next + ')', { color: '#7c5cdb', size: 19 * sc })) startNight(next);
    if (U.button(c, w / 2 - bw / 2, y0 + bh + 12 * sc, bw, bh * 0.8, 'Upgrades', { color: '#ff9f1c', size: 20 * sc })) { st.state = 'shop'; PG.track('shop_opened', { source: 'menu' }); }
    U.coin(c, w / 2 - 34 * sc, h - 50 * sc, 11 * sc); U.text(c, PG.fmt(PG.save.coins || 0), w / 2 - 18 * sc, h - 49 * sc, 20 * sc, '#ffe066', 'left'); U.text(c, 'Nights survived: ' + (PG.save.nights || 0), w / 2, h - 22 * sc, 15 * sc, '#cbbcf0', 'center', { shadow: false });
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
    if (st.state === 'menu') drawMenu(c, w, h, t); else if (st.state === 'shop') drawShop(c, w, h); else { drawControls(c, w, h); drawHUD(c, w, h); if (st.tut && st.t < 12) U.text(c, 'Tap a shelf to grab, tap the ghost to serve', w / 2, sy(540), 15 * PG.scale(), '#fff', 'center', { stroke: 'rgba(0,0,0,.6)' }); if (st.over) drawOver(c, w, h); }
  }
  PG.onUp = function (x, y) {
    if (st.state !== 'play' || st.over || PG.userPaused) return; var s = st.view.s, bx = (x - st.view.ox) / s, by = (y - st.view.oy) / s; if (bx < 0 || bx > VW || by < 0 || by > VH) return; if (x > PG.w - 130 * PG.scale() && y < 70 * PG.scale()) return;
    // poltergeist (garlic)
    var p = st.polt; if (p && p.active > 0 && !p.dead && Math.hypot(bx - p.x, by - p.y) < 80) { if (st.garlic > 0) { st.garlic--; p.dead = true; p.active = 0; st.coinsNight += 5; PG.popText(p.x, p.y, 'BEGONE! +5', '#9be564', 26); PG.sfx('boom', 1.4); PG.burst(p.x, p.y, 30, { colors: ['#c084fc', '#fff', '#2a1442'], g: 100, life: 1 }); st.polt = null; } else { PG.sfx('err'); PG.popText(p.x, p.y + 60, 'No garlic!', '#ff6b6b', 18); } return; }
    // ghosts first
    for (var i = 0; i < st.ghosts.length; i++) { var g = st.ghosts[i]; if (!g.leaving && Math.abs(bx - g.x) < 52 && by > g.y - 130 && by < g.y + 70) { serve(g); return; } }
    // shelves
    for (var k = 0; k < nTypes(); k++) { var col = k % 4, row = Math.floor(k / 4), ix = VW * (0.15 + 0.23 * col), iy = 150 + row * 105; if (Math.abs(bx - ix) < 52 && by > iy - 40 && by < iy + 76) { takeItem(k); return; } }
    // tap bag item to discard
    var bm = bagMax(), bw = 48, x0 = VW / 2 - bm * bw / 2; if (by > 672 && by < 730) { var bi = Math.floor((bx - x0) / bw); if (bi >= 0 && bi < st.bag.length) st.bag.splice(bi, 1); }
  };
  PG.setup(document.getElementById('c'), update, render);
  window.__gg = { st: st, start: startNight, update: update, take: takeItem, serve: serve, spawn: spawnGhost };
  PG.init({ id: 'ghost_grocer', version: '1.0.0', defaults: { next: 1, nights: 0, coins: 0, runs: 0, up: {}, muted: false } }).then(function () {
    PG.music({ scale: [0, 2, 3, 7, 8], root: 185, bpm: 76, wave: 'sine', vol: 0.07, bass: 0.1 });
  });
})();
