/* POTION POUR - sort bubbling potions until every flask holds a single colour. Later levels hide the lower layers.
   Art direction: candlelit alchemist's study. Stone wall, glowing glass vials, alchemical sigils, brass and parchment UI. */
(function () {
  'use strict';
  var U = PG.ui, TAU = 6.2832, CAP = 4;
  var COLORS = ['#e0294f', '#f08a24', '#f5c84c', '#8fd14f', '#22b8a5', '#4fb3f0', '#4a5fe0', '#9b4fd9', '#f27bbd', '#9a6a3c', '#e8e2d0'];
  var LIGHT = { 2: 1, 10: 1 };
  var INK = '#2b1a10', PARCH = '#eedfba', GOLD = '#d9a94a', WINE = '#6d1f3a', DEEP = '#140b1f';
  var st = { state: 'menu', level: 1, tubes: [], sel: -1, anim: null, hist: [], moves: 0, won: false, winT: 0, extraUsed: false, hidden: false, layout: null, shake: 0, sealAt: {} };
  var motes = []; for (var i = 0; i < 26; i++) motes.push({ x: Math.random(), y: Math.random(), p: Math.random() * 9, s: 0.3 + Math.random() });

  /* ---------- level generation ---------- */
  function levelSpec(n) { var colors = Math.min(3 + Math.floor((n - 1) / 2), 11); return { colors: colors, tubes: colors + 2, hidden: n >= 6 && n % 3 === 0 }; }
  function cloneT(t) { return t.map(function (x) { return x.map(function (s) { return { c: s.c, hid: s.hid }; }); }); }
  function done(x) { return x.length === CAP && x.every(function (s) { return s.c === x[0].c; }); }
  function solved(t) { return t.every(function (x) { return x.length === 0 || done(x); }); }
  function key(t) { return t.map(function (x) { return x.map(function (s) { return s.c; }).join(''); }).sort().join('|'); }
  function topRun(x) { if (!x.length) return 0; var c = x[x.length - 1].c, n = 0; for (var i = x.length - 1; i >= 0 && x[i].c === c; i--) n++; return n; }
  // players may pour anywhere legal; the solver skips pointless moves (a single-colour flask into an empty one)
  function canPour(a, b, solver) { if (!a.length || a === b || b.length >= CAP) return false; if (b.length === 0) return !solver || !a.every(function (s) { return s.c === a[0].c; }); return b[b.length - 1].c === a[a.length - 1].c; }
  function solvable(t0) { // depth-first with a node cap; true when a solution is found
    var seen = {}, nodes = 0, stack = [t0];
    while (stack.length && nodes < 25000) {
      var t = stack.pop(), k = key(t); if (seen[k]) continue; seen[k] = 1; nodes++; if (solved(t)) return true;
      var moves = [];
      for (var i = 0; i < t.length; i++) for (var j = 0; j < t.length; j++) if (i !== j && canPour(t[i], t[j], true)) {
        var n = Math.min(topRun(t[i]), CAP - t[j].length), gain = (t[j].length ? 2 : 0) + n + (t[i].length === n ? 1 : 0); moves.push([gain, i, j, n]);
      }
      moves.sort(function (a, b) { return a[0] - b[0]; });
      moves.forEach(function (m) { var nt = cloneT(t); for (var q = 0; q < m[3]; q++) nt[m[2]].push(nt[m[1]].pop()); stack.push(nt); });
    }
    return nodes >= 25000; // unknown: assume solvable (an extra flask is always on offer)
  }
  function buildLevel(n) {
    var sp = levelSpec(n), tries = 0, rnd = PG.mulberry(n * 977 + 13), tubes;
    do {
      var segs = []; for (var c = 0; c < sp.colors; c++) for (var k = 0; k < CAP; k++) segs.push(c);
      for (var i = segs.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var tmp = segs[i]; segs[i] = segs[j]; segs[j] = tmp; }
      tubes = []; for (i = 0; i < sp.colors; i++) tubes.push(segs.slice(i * CAP, (i + 1) * CAP).map(function (v) { return { c: v, hid: false }; }));
      for (i = 0; i < 2; i++) tubes.push([]);
      if (sp.hidden) tubes.forEach(function (t) { for (var q = 0; q < t.length - 1; q++) t[q].hid = true; });
      tries++;
    } while ((solved(tubes) || !solvable(cloneT(tubes))) && tries < 12);
    return { tubes: tubes, hidden: sp.hidden };
  }
  function startLevel(n) {
    st.level = n; var L = buildLevel(n); st.tubes = L.tubes; st.hidden = L.hidden; st.sel = -1; st.anim = null; st.hist = []; st.moves = 0; st.won = false; st.winT = 0; st.extraUsed = false; st.state = 'play'; PG.playing = true; st.sealAt = {}; computeLayout(PG.w, PG.h);
    PG.parts = []; PG.pops = [];
    PG.msg('level_started', { level: String(n) }); PG.track('progression_started', { step_id: 'level', step_index: Math.min(n, 80), hidden: st.hidden });
  }

  /* ---------- layout ---------- */
  function computeLayout(w, h) {
    var sc = PG.scale(), n = st.tubes.length, best = null, availW = w * 0.94, availTop = Math.max(h * 0.14, 78 * sc), availH = h - availTop - 96 * sc;
    for (var rows = 1; rows <= 3; rows++) {
      var cols = Math.ceil(n / rows), cellW = availW / cols, cellH = availH / rows, tw = Math.min(cellW * 0.6, 78), th = Math.min(cellH * 0.8, tw * 3.7);
      if (!best || th * tw > best.th * best.tw * 1.05) best = { rows: rows, cols: cols, cellW: cellW, cellH: cellH, tw: tw, th: th };
    }
    var per = Math.ceil(n / best.rows); best.x0 = (w - best.cellW * Math.min(per, n)) / 2; best.y0 = availTop + (availH - best.cellH * best.rows) / 2; best.per = per; st.layout = best;
  }
  function tubePos(i) { // mouth-center pivot
    var L = st.layout, row = Math.floor(i / L.per), col = i % L.per, inRow = Math.min(L.per, st.tubes.length - row * L.per);
    var rowOffset = (L.per - inRow) * L.cellW / 2;
    return { x: L.x0 + rowOffset + col * L.cellW + L.cellW / 2, y: L.y0 + row * L.cellH + (L.cellH - L.th) / 2 + L.th * 0.12 };
  }

  /* ---------- actions ---------- */
  function tapTube(i) {
    if (st.state !== 'play' || st.anim || st.won) return;
    var T = st.tubes;
    if (st.sel === -1) { if (T[i].length && !done(T[i])) { st.sel = i; PG.sfx('pick', 1.1); } else if (T[i].length) PG.sfx('pick', 0.7); return; }
    if (st.sel === i) { st.sel = -1; PG.sfx('pick', 0.8); return; }
    if (canPour(T[st.sel], T[i])) {
      var n = Math.min(topRun(T[st.sel]), CAP - T[i].length); st.hist.push(cloneT(T)); if (st.hist.length > 60) st.hist.shift();
      st.anim = { from: st.sel, to: i, n: n, t: 0, color: T[st.sel][T[st.sel].length - 1].c }; st.sel = -1; st.moves++; PG.sfx('pour');
    } else { if (T[i].length && !done(T[i])) { st.sel = i; PG.sfx('pick', 1.1); } else st.sel = -1; PG.sfx('err'); st.shake = 6; }
  }
  function finishPour() {
    var a = st.anim, T = st.tubes;
    for (var q = 0; q < a.n; q++) T[a.to].push(T[a.from].pop());
    var src = T[a.from]; if (src.length) src[src.length - 1].hid = false;
    st.anim = null; PG.sfx('bell', 0.8 + a.n * 0.08);
    var tb = T[a.to];
    if (done(tb)) { var p = tubePos(a.to); st.sealAt[a.to] = PG.time; PG.burst(p.x, p.y + st.layout.th * 0.3, 24, { colors: [COLORS[tb[0].c], '#fff6d8', GOLD], up: 90, g: 160, shape: sparkle, s0: 2, s1: 5, life: 1.1 }); PG.sfx('seal'); PG.vibrate(20); }
    if (solved(T)) win();
  }
  function win() {
    st.won = true; st.winT = 0; PG.playing = false; PG.sfx('win'); PG.save.level = Math.max(PG.save.level || 1, st.level + 1); PG.save.best = Math.max(PG.save.best || 0, st.level);
    PG.commit(true); PG.track('progression_completed', { step_id: 'level', step_index: Math.min(st.level, 80), moves: st.moves, hidden: st.hidden }); PG.msg('level_completed', { level: String(st.level) });
    for (var i = 0; i < 4; i++) PG.burst(PG.w * (0.2 + 0.2 * i), PG.h * 0.42, 26, { colors: COLORS.concat([GOLD, '#fff6d8']), up: 280, g: 300, life: 1.7, s0: 2, s1: 6, shape: sparkle });
  }
  function undo() { if (st.anim || st.won || !st.hist.length) return; st.tubes = st.hist.pop(); st.moves = Math.max(0, st.moves - 1); st.sel = -1; PG.sfx('page'); }
  function addFlask() { if (st.extraUsed || st.anim) return; st.tubes.push([]); st.extraUsed = true; computeLayout(PG.w, PG.h); PG.sfx('upgrade'); PG.track('rewarded_extra_flask', { step_index: st.level }); }
  function layoutBtn(i, n, w, h) { var sc = PG.scale(), bw = Math.min(112 * sc, (w - 40 * sc) / n - 8 * sc), bh = Math.max(40, 46 * sc), total = n * bw + (n - 1) * 10 * sc; return { x: w / 2 - total / 2 + i * (bw + 10 * sc), y: h - bh - 20 * sc, w: bw, h: bh }; }
  function sparkle(c, p, k) { var s = p.size * (0.5 + 0.5 * k); c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.beginPath(); c.moveTo(0, -s * 1.6); c.quadraticCurveTo(0, 0, s * 1.6, 0); c.quadraticCurveTo(0, 0, 0, s * 1.6); c.quadraticCurveTo(0, 0, -s * 1.6, 0); c.quadraticCurveTo(0, 0, 0, -s * 1.6); c.fill(); c.restore(); }

  /* ---------- painted backdrop (cached) ---------- */
  var cache = {};
  function off(key, w, h, paint) {
    if (cache[key]) return cache[key];
    var d = PG.dpr || 1, cv = document.createElement('canvas'); cv.width = Math.ceil(w * d); cv.height = Math.ceil(h * d);
    var c = cv.getContext('2d'); c.scale(d, d); paint(c, w, h); cv.lw = w; cv.lh = h; cache[key] = cv; return cv;
  }
  function sconces(w, h) { var sc = PG.scale(); return [{ x: Math.max(26 * sc, w * 0.06), y: h * 0.36 }, { x: w - Math.max(26 * sc, w * 0.06), y: h * 0.36 }]; }
  function wallBG(w, h) {
    return off('wall' + w + 'x' + h, w, h, function (c) {
      var rnd = PG.mulberry(42), sc = PG.scale();
      c.fillStyle = '#211a2b'; c.fillRect(0, 0, w, h);
      var rowH = 34 * sc, y = -rnd() * rowH;
      for (var row = 0; y < h; row++, y += rowH) {
        var x = -rnd() * 60 * sc;
        while (x < w) {
          var bw = (52 + rnd() * 60) * sc, sh = rnd() * 14 - 7, base = [44 + sh, 36 + sh, 56 + sh];
          c.fillStyle = 'rgb(' + (base[0] | 0) + ',' + (base[1] | 0) + ',' + (base[2] | 0) + ')'; U.rr(c, x + 2, y + 2, bw - 4, rowH - 4, 4 * sc); c.fill();
          c.fillStyle = 'rgba(255,230,200,.05)'; c.fillRect(x + 4, y + 3, bw - 8, 2);
          c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(x + 4, y + rowH - 6, bw - 8, 2);
          for (var s = 0; s < 4; s++) { c.fillStyle = 'rgba(' + (rnd() < 0.5 ? '0,0,0' : '255,240,220') + ',' + (0.03 + rnd() * 0.04) + ')'; c.beginPath(); c.arc(x + rnd() * bw, y + rnd() * rowH, (2 + rnd() * 7) * sc, 0, TAU); c.fill(); }
          if (rnd() < 0.08) { c.strokeStyle = 'rgba(0,0,0,.3)'; c.lineWidth = 1; c.beginPath(); var cx = x + rnd() * bw, cy = y + 4; c.moveTo(cx, cy); for (var q = 0; q < 4; q++) { cx += (rnd() - 0.5) * 10 * sc; cy += rowH / 5; c.lineTo(cx, cy); } c.stroke(); }
          x += bw;
        }
      }
      // arched window with moonlit night
      var ww = Math.min(w * 0.3, 130 * sc), wcx = w > h ? w * 0.8 : w / 2, wx = wcx - ww / 2, wy = h * 0.03, wh = ww * 1.25;
      c.fillStyle = '#3b3249'; arch(c, wx - 9 * sc, wy - 9 * sc, ww + 18 * sc, wh + 18 * sc); c.fill();
      var sky = c.createLinearGradient(0, wy, 0, wy + wh); sky.addColorStop(0, '#1b2350'); sky.addColorStop(1, '#3a3f7a'); c.fillStyle = sky; arch(c, wx, wy, ww, wh); c.fill();
      c.save(); arch(c, wx, wy, ww, wh); c.clip();
      for (var k = 0; k < 18; k++) { c.fillStyle = 'rgba(255,255,240,' + (0.4 + rnd() * 0.5) + ')'; c.beginPath(); c.arc(wx + rnd() * ww, wy + rnd() * wh * 0.8, rnd() * 1.3 + 0.4, 0, TAU); c.fill(); }
      var mx = wx + ww * 0.66, my = wy + wh * 0.32, mr = ww * 0.15, mg = c.createRadialGradient(mx, my, 0, mx, my, mr * 4); mg.addColorStop(0, 'rgba(230,230,255,.45)'); mg.addColorStop(1, 'rgba(230,230,255,0)'); c.fillStyle = mg; c.fillRect(wx, wy, ww, wh);
      c.fillStyle = '#f2efdc'; c.beginPath(); c.arc(mx, my, mr, 0, TAU); c.fill(); c.fillStyle = '#2b3466'; c.beginPath(); c.arc(mx + mr * 0.45, my - mr * 0.2, mr * 0.9, 0, TAU); c.fill();
      c.fillStyle = '#0f0c18'; c.beginPath(); c.moveTo(wx, wy + wh); for (var px = 0; px <= ww; px += 6) c.lineTo(wx + px, wy + wh * 0.82 - Math.abs(Math.sin(px * 0.09)) * wh * 0.08 - (px > ww * 0.2 && px < ww * 0.35 ? wh * 0.12 : 0)); c.lineTo(wx + ww, wy + wh); c.fill();
      c.restore();
      c.strokeStyle = '#1a1422'; c.lineWidth = 4 * sc; c.beginPath(); c.moveTo(wcx, wy + ww * 0.15); c.lineTo(wcx, wy + wh); c.moveTo(wx, wy + wh * 0.58); c.lineTo(wx + ww, wy + wh * 0.58); c.stroke();
      c.fillStyle = '#4a3f5a'; c.fillRect(wx - 14 * sc, wy + wh, ww + 28 * sc, 8 * sc); c.fillStyle = '#2a2233'; c.fillRect(wx - 14 * sc, wy + wh + 8 * sc, ww + 28 * sc, 3 * sc);
      // sconces with candles
      sconces(w, h).forEach(function (s) {
        c.fillStyle = '#1a120b'; c.beginPath(); c.moveTo(s.x - 4 * sc, s.y + 40 * sc); c.quadraticCurveTo(s.x - 16 * sc, s.y + 22 * sc, s.x - 14 * sc, s.y + 6 * sc); c.lineTo(s.x + 14 * sc, s.y + 6 * sc); c.quadraticCurveTo(s.x + 16 * sc, s.y + 22 * sc, s.x + 4 * sc, s.y + 40 * sc); c.fill();
        var bg = c.createLinearGradient(s.x - 16 * sc, 0, s.x + 16 * sc, 0); bg.addColorStop(0, '#7a5524'); bg.addColorStop(0.45, '#e2b867'); bg.addColorStop(1, '#6a4418'); c.fillStyle = bg; U.rr(c, s.x - 16 * sc, s.y + 2 * sc, 32 * sc, 7 * sc, 3 * sc); c.fill();
        var cg = c.createLinearGradient(s.x - 7 * sc, 0, s.x + 7 * sc, 0); cg.addColorStop(0, '#d9c9a6'); cg.addColorStop(0.4, '#fff4dc'); cg.addColorStop(1, '#bfae8a'); c.fillStyle = cg; c.fillRect(s.x - 7 * sc, s.y - 30 * sc, 14 * sc, 33 * sc);
        c.fillStyle = '#f6ead0'; c.beginPath(); c.moveTo(s.x - 7 * sc, s.y - 30 * sc); c.quadraticCurveTo(s.x - 3 * sc, s.y - 24 * sc, s.x - 5 * sc, s.y - 14 * sc); c.lineTo(s.x - 2 * sc, s.y - 14 * sc); c.lineTo(s.x - 1 * sc, s.y - 30 * sc); c.fill();
        c.strokeStyle = '#2b1a10'; c.lineWidth = 1.5; c.beginPath(); c.moveTo(s.x, s.y - 30 * sc); c.lineTo(s.x, s.y - 35 * sc); c.stroke();
      });
      // workbench
      var ty = h - 82 * sc; c.fillStyle = '#2b1a12'; c.fillRect(0, ty, w, h - ty);
      var tg = c.createLinearGradient(0, ty, 0, ty + 14 * sc); tg.addColorStop(0, '#7a4e2c'); tg.addColorStop(1, '#4a2e1a'); c.fillStyle = tg; c.fillRect(0, ty, w, 14 * sc);
      c.fillStyle = 'rgba(255,220,170,.18)'; c.fillRect(0, ty, w, 2);
      c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1; for (var g = 0; g < 7; g++) { c.beginPath(); var gy = ty + 20 * sc + g * 9 * sc; c.moveTo(0, gy); for (var gx = 0; gx <= w; gx += 30) c.lineTo(gx, gy + Math.sin(gx * 0.02 + g) * 2); c.stroke(); }
    });
  }
  function arch(c, x, y, w, h) { var r = w / 2; c.beginPath(); c.moveTo(x, y + h); c.lineTo(x, y + r); c.arc(x + r, y + r, r, Math.PI, 0); c.lineTo(x + w, y + h); c.closePath(); }
  function flame(c, x, y, s, t, ph) {
    var f = 1 + 0.12 * Math.sin(t * 13 + ph) + 0.08 * Math.sin(t * 7.3 + ph * 2), sway = Math.sin(t * 3 + ph) * 1.5 * s;
    var g = c.createRadialGradient(x, y, 0, x, y, 120 * s * f); g.addColorStop(0, 'rgba(255,180,80,.28)'); g.addColorStop(0.4, 'rgba(255,150,60,.1)'); g.addColorStop(1, 'rgba(255,150,60,0)');
    c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = g; c.fillRect(x - 130 * s, y - 130 * s, 260 * s, 260 * s); c.restore();
    c.fillStyle = '#ffb648'; c.beginPath(); c.moveTo(x, y + 4 * s); c.quadraticCurveTo(x - 6 * s, y - 2 * s, x + sway, y - 14 * s * f); c.quadraticCurveTo(x + 6 * s, y - 2 * s, x, y + 4 * s); c.fill();
    c.fillStyle = '#fff3c8'; c.beginPath(); c.moveTo(x, y + 3 * s); c.quadraticCurveTo(x - 3 * s, y - 1 * s, x + sway * 0.6, y - 8 * s * f); c.quadraticCurveTo(x + 3 * s, y - 1 * s, x, y + 3 * s); c.fill();
  }
  function drawBG(c, w, h, t) {
    var wall = wallBG(w, h); c.drawImage(wall, 0, 0, w, h);
    var sc = PG.scale(); sconces(w, h).forEach(function (s, i) { flame(c, s.x, s.y - 36 * sc, sc, t, i * 2.1); });
    motes.forEach(function (m) { var x = ((m.x + Math.sin(t * 0.25 + m.p) * 0.03) % 1) * w, y = (1 - ((m.y + t * 0.012 * m.s) % 1)) * h; c.fillStyle = 'rgba(255,220,160,' + 0.25 * (0.5 + 0.5 * Math.sin(t * 2 + m.p)) + ')'; c.beginPath(); c.arc(x, y, 0.8 + m.s * 1.2, 0, TAU); c.fill(); });
  }

  /* ---------- flasks ---------- */
  function tubePath(c, tw, th) { var r = tw / 2; c.beginPath(); c.moveTo(-tw / 2, 0); c.lineTo(-tw / 2, th - r); c.arc(0, th - r, r, Math.PI, 0, true); c.lineTo(tw / 2, 0); }
  function sigil(c, k, x, y, r) { // alchemical symbols, one per potion: readable without colour
    c.beginPath(); var s = r * 0.62;
    switch (k % 11) {
      case 0: c.moveTo(x, y - s); c.lineTo(x + s * 0.9, y + s * 0.6); c.lineTo(x - s * 0.9, y + s * 0.6); c.closePath(); break; // fire
      case 1: c.moveTo(x, y - s); c.lineTo(x + s * 0.7, y + s * 0.15); c.lineTo(x - s * 0.7, y + s * 0.15); c.closePath(); c.moveTo(x, y + s * 0.15); c.lineTo(x, y + s * 0.95); c.moveTo(x - s * 0.4, y + s * 0.55); c.lineTo(x + s * 0.4, y + s * 0.55); break; // sulfur
      case 2: c.arc(x, y, s * 0.8, 0, TAU); c.moveTo(x + s * 0.18, y); c.arc(x, y, s * 0.18, 0, TAU); break; // sun
      case 3: c.moveTo(x, y + s); c.lineTo(x + s * 0.9, y - s * 0.6); c.lineTo(x - s * 0.9, y - s * 0.6); c.closePath(); c.moveTo(x - s * 0.62, y - s * 0.1); c.lineTo(x + s * 0.62, y - s * 0.1); break; // earth
      case 4: c.moveTo(x, y + s); c.lineTo(x + s * 0.9, y - s * 0.6); c.lineTo(x - s * 0.9, y - s * 0.6); c.closePath(); break; // water
      case 5: c.moveTo(x, y - s); c.lineTo(x + s * 0.9, y + s * 0.6); c.lineTo(x - s * 0.9, y + s * 0.6); c.closePath(); c.moveTo(x - s * 0.62, y + s * 0.1); c.lineTo(x + s * 0.62, y + s * 0.1); break; // air
      case 6: c.arc(x, y, s * 0.8, 0.9, TAU - 0.9); c.arc(x + s * 0.38, y, s * 0.62, TAU - 1.2, 1.2, true); break; // moon
      case 7: c.arc(x, y - s * 0.05, s * 0.4, 0, TAU); c.moveTo(x - s * 0.45, y - s * 0.95); c.quadraticCurveTo(x, y - s * 0.35, x + s * 0.45, y - s * 0.95); c.moveTo(x, y + s * 0.35); c.lineTo(x, y + s); c.moveTo(x - s * 0.3, y + s * 0.68); c.lineTo(x + s * 0.3, y + s * 0.68); break; // mercury
      case 8: c.arc(x, y - s * 0.3, s * 0.45, 0, TAU); c.moveTo(x, y + s * 0.15); c.lineTo(x, y + s); c.moveTo(x - s * 0.35, y + s * 0.58); c.lineTo(x + s * 0.35, y + s * 0.58); break; // venus
      case 9: c.arc(x, y, s * 0.75, 0, TAU); c.moveTo(x - s * 0.75, y); c.lineTo(x + s * 0.75, y); break; // salt
      default: c.moveTo(x, y - s); c.lineTo(x + s * 0.85, y + s * 0.5); c.lineTo(x - s * 0.85, y + s * 0.5); c.closePath(); c.moveTo(x, y + s); c.lineTo(x + s * 0.85, y - s * 0.5); c.lineTo(x - s * 0.85, y - s * 0.5); c.closePath(); // star
    }
    c.stroke();
  }
  var glassShade = null, glassShadeW = 0;
  function glassGrad(c, tw) {
    if (glassShade && glassShadeW === tw) return glassShade; glassShadeW = tw;
    var g = c.createLinearGradient(-tw / 2, 0, tw / 2, 0); g.addColorStop(0, 'rgba(0,0,0,.42)'); g.addColorStop(0.22, 'rgba(0,0,0,0)'); g.addColorStop(0.42, 'rgba(255,255,255,.1)'); g.addColorStop(0.7, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.5)');
    return (glassShade = g);
  }
  function cork(c, tw, drop) {
    c.save(); c.translate(0, -drop);
    var g = c.createLinearGradient(-tw * 0.3, 0, tw * 0.3, 0); g.addColorStop(0, '#7a4f2a'); g.addColorStop(0.45, '#c99a62'); g.addColorStop(1, '#6b4222'); c.fillStyle = g;
    c.beginPath(); c.moveTo(-tw * 0.32, tw * 0.1); c.lineTo(tw * 0.32, tw * 0.1); c.lineTo(tw * 0.36, -tw * 0.32); c.lineTo(-tw * 0.36, -tw * 0.32); c.closePath(); c.fill();
    c.fillStyle = 'rgba(40,20,8,.35)'; for (var i = 0; i < 5; i++) { c.beginPath(); c.arc(-tw * 0.2 + i * tw * 0.1, -tw * 0.1 + (i % 2) * tw * 0.1, tw * 0.025, 0, TAU); c.fill(); }
    c.fillStyle = '#9c1c2c'; c.beginPath(); c.arc(0, -tw * 0.34, tw * 0.17, 0, TAU); c.fill(); c.fillStyle = '#c4303f'; c.beginPath(); c.arc(-tw * 0.03, -tw * 0.37, tw * 0.11, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(255,220,200,.6)'; c.lineWidth = 1; sigil(c, 10, 0, -tw * 0.35, tw * 0.12);
    c.restore();
  }
  function drawShelves(c) {
    var L = st.layout, sc = PG.scale();
    for (var r = 0; r < L.rows; r++) {
      var first = r * L.per, inRow = Math.min(L.per, st.tubes.length - first); if (inRow <= 0) continue;
      var p0 = tubePos(first), p1 = tubePos(first + inRow - 1), y = p0.y + L.th + 2, x0 = p0.x - L.cellW * 0.5, x1 = p1.x + L.cellW * 0.5, hh = 9 * sc;
      c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(x0 + 4, y + hh, x1 - x0 - 8, 7 * sc);
      var g = c.createLinearGradient(0, y, 0, y + hh); g.addColorStop(0, '#8a5a33'); g.addColorStop(1, '#4e301b'); c.fillStyle = g; c.fillRect(x0, y, x1 - x0, hh);
      c.fillStyle = 'rgba(255,220,170,.25)'; c.fillRect(x0, y, x1 - x0, 1.5);
      [x0 + 14 * sc, x1 - 14 * sc].forEach(function (bx) { c.fillStyle = '#2b1a10'; c.beginPath(); c.moveTo(bx - 4 * sc, y + hh); c.lineTo(bx + 4 * sc, y + hh); c.lineTo(bx + 1, y + hh + 16 * sc); c.lineTo(bx - 1, y + hh + 16 * sc); c.fill(); });
    }
  }
  function drawTube(c, i, t) {
    var L = st.layout, T = st.tubes[i], P = tubePos(i), tw = L.tw, th = L.th, sh = (th - tw * 0.18) / CAP, a = st.anim;
    var lift = 0, tilt = 0, px = P.x, py = P.y, drawn = T.length, ghost = 0, ghostC = 0, pour = 0;
    if (st.sel === i) lift = -th * 0.16 + Math.sin(t * 5) * 2;
    if (a && a.from === i) { var tt = a.t, e = tt < 0.25 ? PG.ease.io(tt / 0.25) : tt > 0.8 ? PG.ease.io(1 - (tt - 0.8) / 0.2) : 1, tp = tubePos(a.to), dir = tp.x >= P.x ? 1 : -1; if (Math.abs(tp.x - P.x) < 2) dir = (P.x > PG.w / 2 ? -1 : 1);
      px = PG.lerp(P.x, tp.x - dir * tw * 0.75, e); py = PG.lerp(P.y, tp.y - th * 0.45, e); tilt = dir * e * (0.9 + a.n * 0.12);
      pour = tt > 0.2 && tt < 0.85 ? PG.clamp((tt - 0.2) / 0.65, 0, 1) : (tt >= 0.85 ? 1 : 0); drawn = T.length - a.n * pour; }
    if (a && a.to === i) { var pr = a.t > 0.2 && a.t < 0.85 ? PG.clamp((a.t - 0.2) / 0.65, 0, 1) : (a.t >= 0.85 ? 1 : 0); ghost = a.n * pr; ghostC = a.color; }
    var isDone = done(T) && !(a && (a.from === i || a.to === i)), topC = T.length ? T[T.length - 1].c : -1;
    // inner glow of the potion
    if (topC >= 0 && !(T[T.length - 1].hid)) { var gx = px, gy = py + lift + th * 0.62, gl = c.createRadialGradient(gx, gy, 0, gx, gy, th * 0.75); gl.addColorStop(0, hexA(COLORS[topC], isDone ? 0.32 + 0.08 * Math.sin(t * 3 + i) : 0.16)); gl.addColorStop(1, hexA(COLORS[topC], 0)); c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = gl; c.fillRect(gx - th, gy - th, th * 2, th * 2); c.restore(); }
    c.save(); c.translate(px, py + lift); c.rotate(tilt);
    c.save(); tubePath(c, tw, th); c.clip();
    c.fillStyle = 'rgba(190,210,255,.07)'; c.fillRect(-tw, 0, tw * 2, th);
    c.save(); c.rotate(-tilt); // liquid stays level in world space
    var cosT = Math.cos(tilt), sinT = Math.abs(Math.sin(tilt)), baseY = th * cosT + tw / 2 * sinT - tw * 0.04, wob = (a && (a.from === i || a.to === i)) ? 2.2 : 1.1;
    var total = drawn + ghost, nTop = Math.ceil(total - 0.001);
    for (var k = 0; k < nTop; k++) {
      var seg = k < T.length ? T[k] : null, colIdx = k < T.length ? T[k].c : ghostC; if (k >= T.length && !ghost) break;
      var frac = Math.min(1, total - k), y1 = baseY - k * sh, y0 = y1 - sh * frac, hid = seg && seg.hid && k < T.length - 1 && !(a && a.from === i), isTop = k === nTop - 1;
      var col = hid ? '#2a2236' : COLORS[colIdx];
      c.fillStyle = col; c.beginPath(); c.moveTo(-tw, y1 + 1); c.lineTo(-tw, y0);
      if (isTop) { for (var xx = -tw; xx <= tw; xx += 3) c.lineTo(xx, y0 + Math.sin(t * 3.2 + xx * 0.18 + i) * wob); } else c.lineTo(tw, y0 - 0.5);
      c.lineTo(tw, y1 + 1); c.closePath(); c.fill();
      if (hid) { var sm = c.createLinearGradient(0, y0, 0, y1); sm.addColorStop(0, 'rgba(120,100,150,.25)'); sm.addColorStop(1, 'rgba(0,0,0,.2)'); c.fillStyle = sm; c.fillRect(-tw, y0, tw * 2, y1 - y0); U.text(c, '?', 0, (y0 + y1) / 2, sh * 0.55, 'rgba(230,215,255,.45)', 'center', { shadow: false }); }
      else {
        c.fillStyle = 'rgba(0,0,0,.18)'; c.fillRect(-tw, y1 - 2, tw * 2, 2);
        c.strokeStyle = LIGHT[colIdx] ? 'rgba(70,40,10,.5)' : 'rgba(255,250,235,.55)'; c.lineWidth = Math.max(1.4, tw * 0.045); c.lineJoin = 'round'; c.lineCap = 'round'; sigil(c, colIdx, 0, (y0 + y1) / 2 + 1, Math.min(tw * 0.42, sh * 0.42));
      }
      if (isTop && !hid) { // meniscus highlight and rising bubbles
        c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 1.5; c.beginPath(); for (xx = -tw * 0.45; xx <= tw * 0.45; xx += 3) c.lineTo(xx, y0 + 1.5 + Math.sin(t * 3.2 + xx * 0.18 + i) * wob); c.stroke();
        for (var b = 0; b < 3; b++) { var bt = (t * 0.55 + b * 0.33 + i * 0.17) % 1; c.strokeStyle = 'rgba(255,255,255,' + 0.6 * (1 - bt) + ')'; c.lineWidth = 1; c.beginPath(); c.arc(Math.sin(b * 5 + i) * tw * 0.22, y1 - bt * (y1 - y0 - 3), 1.3 + b * 0.5, 0, TAU); c.stroke(); }
      }
    }
    c.restore();
    c.fillStyle = glassGrad(c, tw); c.fillRect(-tw / 2, 0, tw, th);
    c.restore();
    // glass: rim flare, outline, reflections
    var gw = Math.max(1.6, tw * 0.045);
    c.save(); tubePath(c, tw, th); c.lineWidth = gw; c.strokeStyle = 'rgba(205,220,245,.7)'; c.stroke(); c.restore();
    c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = tw * 0.07; c.lineCap = 'round'; c.beginPath(); c.moveTo(-tw * 0.28, tw * 0.3); c.lineTo(-tw * 0.28, th - tw * 0.75); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.3)'; c.lineWidth = tw * 0.035; c.beginPath(); c.moveTo(-tw * 0.16, th * 0.2); c.lineTo(-tw * 0.16, th * 0.36); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.25)'; c.lineWidth = tw * 0.04; c.beginPath(); c.arc(0, th - tw / 2, tw * 0.32, 0.4, 1.4); c.stroke();
    c.fillStyle = 'rgba(205,220,245,.85)'; c.beginPath(); c.ellipse(0, 0, tw / 2 + gw * 1.6, gw * 1.5, 0, 0, TAU); c.fill(); c.fillStyle = 'rgba(30,20,40,.55)'; c.beginPath(); c.ellipse(0, 0, tw / 2 - gw * 0.3, gw * 0.7, 0, 0, TAU); c.fill();
    if (isDone) { var age = PG.time - (st.sealAt[i] === undefined ? -9 : st.sealAt[i]), dk = age < 0.45 ? 1 - PG.ease.back(age / 0.45) : 0; c.globalAlpha = Math.min(1, age * 5 + 0.2); cork(c, tw, dk * th * 0.4); c.globalAlpha = 1; }
    if (st.sel === i) { c.strokeStyle = 'rgba(242,214,140,' + (0.55 + 0.3 * Math.sin(t * 6)) + ')'; c.lineWidth = 2; c.setLineDash([4, 4]); c.lineDashOffset = -t * 20; tubePath(c, tw + 10, th + 6); c.stroke(); c.setLineDash([]); }
    c.restore();
    if (a && a.from === i && a.t > 0.2 && a.t < 0.85) { // stream from the lip to the target surface
      var lip = { x: px + Math.cos(tilt) * (tilt > 0 ? tw / 2 : -tw / 2), y: py + Math.sin(tilt) * (tilt > 0 ? tw / 2 : -tw / 2) }, tp2 = tubePos(a.to);
      var tgtLevel = tp2.y + (st.layout.th - tw * 0.04) - (st.tubes[a.to].length + a.n * pour) * sh;
      c.lineCap = 'round'; c.beginPath(); c.moveTo(lip.x, lip.y); c.quadraticCurveTo(lip.x + (tp2.x - lip.x) * 0.35 + Math.sin(PG.time * 30) * 1.2, lip.y + (tgtLevel - lip.y) * 0.1, tp2.x + Math.sin(PG.time * 25) * 1.5, tgtLevel);
      c.strokeStyle = COLORS[a.color]; c.lineWidth = tw * 0.16; c.stroke(); c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = tw * 0.05; c.stroke();
      if (Math.random() < 0.5) PG.parts.push({ x: tp2.x + PG.rand(-tw * 0.2, tw * 0.2), y: tgtLevel, vx: PG.rand(-40, 40), vy: PG.rand(-90, -30), life: 0.4, t: 0, size: 2.2, color: COLORS[a.color], g: 300, shape: 'c' });
    }
  }
  function hexA(hex, a) { var n = parseInt(hex.slice(1), 16); return 'rgba(' + (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')'; }

  /* ---------- theme: enamel and gold buttons, parchment in gilded frames ---------- */
  function goldGrad(c, y, h) { var g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#f7e2a4'); g.addColorStop(0.45, '#d9a94a'); g.addColorStop(0.55, '#b9852f'); g.addColorStop(1, '#7c5418'); return g; }
  function diamond(c, x, y, s) { c.beginPath(); c.moveTo(x, y - s); c.lineTo(x + s * 0.7, y); c.lineTo(x, y + s); c.lineTo(x - s * 0.7, y); c.closePath(); c.fill(); }
  PG.theme.font = 'Cinzel'; PG.theme.body = 'Alegreya Sans'; PG.theme.weight = '700'; PG.theme.bodyWeight = '700'; PG.theme.text = PARCH; PG.theme.textShadow = 'rgba(0,0,0,.5)'; PG.theme.pageColor = DEEP;
  PG.theme.popStyle = { stroke: 'rgba(30,15,10,.85)' };
  PG.theme.button = function (c, x, y, w, h, label, o, s) {
    var col = o.disabled ? '#4b4452' : o.color || '#2d6d6a', r = Math.min(h * 0.32, 14), off = s.press ? 2 : 0;
    c.fillStyle = 'rgba(0,0,0,.45)'; U.rr(c, x + 1, y + 5, w, h, r); c.fill();
    c.fillStyle = goldGrad(c, y + off, h); U.rr(c, x, y + off, w, h, r); c.fill();
    var e = c.createLinearGradient(0, y + off, 0, y + off + h); e.addColorStop(0, U.shade(col, s.hover ? 0.25 : 0.12)); e.addColorStop(1, U.shade(col, -0.35));
    c.fillStyle = e; U.rr(c, x + 3, y + off + 3, w - 6, h - 6, r - 2); c.fill();
    c.strokeStyle = 'rgba(255,240,200,.25)'; c.lineWidth = 1; U.rr(c, x + 5.5, y + off + 5.5, w - 11, h - 11, r - 4); c.stroke();
    c.fillStyle = GOLD; diamond(c, x + 11, y + off + h / 2, 3.5); diamond(c, x + w - 11, y + off + h / 2, 3.5);
    var fs = U.fit(c, label, o.size || Math.min(h * 0.4, 22), w - 34);
    U.text(c, label, x + w / 2, y + off + h / 2 + 1, fs, '#fbf0d4', 'center', { shadow: false, stroke: 'rgba(20,8,4,.55)', strokeWidth: 3 });
  };
  PG.theme.panel = function (c, x, y, w, h) {
    c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(x + 4, y + 8, w, h);
    c.fillStyle = goldGrad(c, y, h); U.rr(c, x, y, w, h, 10); c.fill();
    var pg = c.createRadialGradient(x + w / 2, y + h * 0.4, 0, x + w / 2, y + h * 0.4, Math.max(w, h) * 0.75); pg.addColorStop(0, '#f6ebcd'); pg.addColorStop(1, '#d9bf8a');
    c.fillStyle = pg; c.fillRect(x + 6, y + 6, w - 12, h - 12);
    c.strokeStyle = '#8a6224'; c.lineWidth = 1.5; c.strokeRect(x + 11, y + 11, w - 22, h - 22);
    c.strokeStyle = '#8a6224'; c.lineWidth = 1.5; [[x + 11, y + 11, 1, 1], [x + w - 11, y + 11, -1, 1], [x + 11, y + h - 11, 1, -1], [x + w - 11, y + h - 11, -1, -1]].forEach(function (q) { c.beginPath(); c.arc(q[0] + q[2] * 10, q[1] + q[3] * 10, 6, 0, TAU); c.stroke(); c.beginPath(); c.moveTo(q[0] + q[2] * 16, q[1]); c.quadraticCurveTo(q[0] + q[2] * 22, q[1] + q[3] * 6, q[0] + q[2] * 30, q[1] + q[3] * 2); c.moveTo(q[0], q[1] + q[3] * 16); c.quadraticCurveTo(q[0] + q[2] * 6, q[1] + q[3] * 22, q[0] + q[2] * 2, q[1] + q[3] * 30); c.stroke(); });
  };
  PG.theme.hudButton = function (c, x, y, r, kind) { c.fillStyle = 'rgba(0,0,0,.45)'; c.beginPath(); c.arc(x, y + 3, r, 0, TAU); c.fill(); c.fillStyle = goldGrad(c, y - r, r * 2); c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.fillStyle = '#3a1830'; c.beginPath(); c.arc(x, y, r - 3, 0, TAU); c.fill(); PG.hudIcon(c, x, y, r * 0.9, kind, PARCH); };
  PG.theme.transition = { time: 0.45, draw: function (c, w, h, k) { // potion smoke blooms over the screen
    var R = Math.hypot(w, h); c.fillStyle = DEEP;
    for (var i = 0; i < 9; i++) { var hx = PG.hash(i * 3.1), hy = PG.hash(i * 7.7), rr = R * (0.32 + PG.hash(i * 1.3) * 0.25) * PG.clamp(k * 1.5 - i * 0.04, 0, 1.4); c.beginPath(); c.arc(hx * w, hy * h, rr, 0, TAU); c.fill(); }
    if (k > 0.9) { c.globalAlpha = (k - 0.9) * 10; c.fillRect(0, 0, w, h); c.globalAlpha = 1; }
  } };
  PG.theme.loading = function (c, w, h, t) {
    c.fillStyle = DEEP; c.fillRect(0, 0, w, h); c.save(); c.translate(w / 2, h / 2); c.strokeStyle = GOLD; c.lineWidth = 2;
    c.rotate(t * 0.8); c.beginPath(); c.arc(0, 0, 34, 0, TAU); c.stroke(); c.beginPath(); for (var i = 0; i < 3; i++) c.lineTo(Math.cos(i * TAU / 3 - 1.57) * 34, Math.sin(i * TAU / 3 - 1.57) * 34); c.closePath(); c.stroke();
    c.rotate(-t * 1.6); c.strokeRect(-12, -12, 24, 24); c.restore();
  };

  /* ---------- screens ---------- */
  function title(c, s, x, y, size, col) {
    c.save(); c.font = '700 ' + size + 'px "Cinzel Decorative","Cinzel",serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.shadowColor = 'rgba(255,190,90,.45)'; c.shadowBlur = 18; c.lineWidth = size * 0.1; c.strokeStyle = '#2a1206'; c.strokeText(s, x, y); c.shadowBlur = 0;
    var g = c.createLinearGradient(0, y - size * 0.5, 0, y + size * 0.5); g.addColorStop(0, '#fff3c4'); g.addColorStop(0.5, col || '#e8b85a'); g.addColorStop(1, '#a8701e'); c.fillStyle = g; c.fillText(s, x, y); c.restore();
  }
  function drawPlay(c, w, h, t) {
    var sc = PG.scale(); computeLayout(w, h);
    drawShelves(c);
    for (var i = 0; i < st.tubes.length; i++) if (!st.anim || st.anim.from !== i) drawTube(c, i, t);
    if (st.anim) drawTube(c, st.anim.from, t);
    PG.drawParts(c); PG.drawPops(c);
    U.text(c, 'Level ' + st.level, 18 * sc, 32 * sc, 28 * sc, PARCH, 'left', { shadow: false, stroke: 'rgba(10,4,2,.7)', strokeWidth: 4 });
    U.text(c, st.moves + (st.moves === 1 ? ' move' : ' moves'), 19 * sc, 58 * sc, 15 * sc, '#cdb98f', 'left', { font: 'body', shadow: false, stroke: 'rgba(10,4,2,.6)', strokeWidth: 3 });
    if (st.hidden) U.text(c, 'Mystery layers', 19 * sc, 78 * sc, 14 * sc, '#c9a8ff', 'left', { font: 'body', shadow: false, stroke: 'rgba(10,4,2,.6)', strokeWidth: 3 });
    var btns = [['Undo', '#3a5a7a', undo], ['Restart', WINE, function () { PG.track('level_restarted', { step_index: Math.min(st.level, 80) }); PG.go(function () { startLevel(st.level); }); }]];
    var canAd = !st.extraUsed && PG.rewardedSupported(); if (canAd) btns.push(['+ Flask (ad)', '#5b2f86', function () { PG.rewarded('bonus').then(function (ok) { if (ok) addFlask(); }); }]);
    btns.forEach(function (b, k) { var r = layoutBtn(k, btns.length, w, h); if (!st.won && U.button(c, r.x, r.y, r.w, r.h, b[0], { color: b[1], size: Math.min(r.h * 0.4, 17 * sc), disabled: k === 0 && !st.hist.length })) b[2](); });
    if (st.won) {
      var k2 = PG.ease.out(Math.min(1, Math.max(0, st.winT - 0.4) * 2)); if (k2 <= 0) return; c.fillStyle = 'rgba(10,4,20,' + 0.55 * k2 + ')'; c.fillRect(0, 0, w, h);
      var pw = Math.min(w * 0.86, 360 * sc), ph = 250 * sc, px = w / 2 - pw / 2, py = h * 0.44 - ph / 2 + (1 - k2) * 50; U.panel(c, px, py, pw, ph);
      c.save(); c.font = '700 ' + 38 * sc + 'px "Cinzel Decorative","Cinzel",serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = WINE; c.fillText('Brewed!', w / 2, py + 52 * sc); c.restore();
      U.text(c, 'Level ' + st.level + '  ·  ' + st.moves + ' moves', w / 2, py + 98 * sc, 18 * sc, INK, 'center', { font: 'body', shadow: false });
      c.strokeStyle = 'rgba(138,98,36,.6)'; c.lineWidth = 1; c.beginPath(); c.moveTo(w / 2 - 70 * sc, py + 120 * sc); c.lineTo(w / 2 + 70 * sc, py + 120 * sc); c.stroke(); c.fillStyle = '#8a6224'; diamond(c, w / 2, py + 120 * sc, 4);
      if (U.button(c, w / 2 - 100 * sc, py + 146 * sc, 200 * sc, 56 * sc, 'Next level', { color: '#2d6d6a' })) { PG.interstitial('level_end').then(function () { PG.go(function () { startLevel(st.level + 1); }); }); }
    }
  }
  function drawMenu(c, w, h, t) {
    var sc = PG.scale(), land = w > h, ty = land ? h * 0.2 : Math.max(h * 0.3, 160 * sc), sz = Math.min(54 * sc, w * 0.14);
    title(c, 'Potion', w / 2, ty, sz); title(c, 'Pour', w / 2, ty + sz * 1.05, sz * 1.15, '#e59a6a');
    U.text(c, 'an alchemist’s sorting puzzle', w / 2, ty + sz * 1.9, 15 * sc, '#cdb98f', 'center', { font: 'body', shadow: false });
    var cols = [0, 4, 2, 7], fw = 38 * sc, fh = 112 * sc, by = ty + sz * 2.4;
    for (var i = 0; i < 4; i++) { // display flasks on a little shelf
      var fx = w / 2 + (i - 1.5) * 64 * sc, fy = by + Math.sin(t * 1.3 + i) * 2, lv = fh * (0.45 + 0.18 * Math.sin(t * 0.8 + i)), gl = c.createRadialGradient(fx, fy + fh * 0.7, 0, fx, fy + fh * 0.7, fh * 0.6);
      gl.addColorStop(0, hexA(COLORS[cols[i]], 0.3)); gl.addColorStop(1, hexA(COLORS[cols[i]], 0)); c.save(); c.globalCompositeOperation = 'lighter'; c.fillStyle = gl; c.fillRect(fx - fh, fy, fh * 2, fh * 1.4); c.restore();
      c.save(); c.translate(fx, fy); tubePath(c, fw, fh); c.save(); c.clip(); c.fillStyle = COLORS[cols[i]]; c.beginPath(); c.moveTo(-fw, fh); c.lineTo(-fw, fh - lv); for (var x = -fw; x <= fw; x += 3) c.lineTo(x, fh - lv + Math.sin(t * 3 + x * 0.2 + i) * 1.5); c.lineTo(fw, fh); c.fill();
      c.strokeStyle = LIGHT[cols[i]] ? 'rgba(70,40,10,.5)' : 'rgba(255,250,235,.55)'; c.lineWidth = 1.6; sigil(c, cols[i], 0, fh - lv * 0.45, fw * 0.4); c.fillStyle = glassGrad(c, fw); c.fillRect(-fw / 2, 0, fw, fh); glassShade = null; c.restore();
      tubePath(c, fw, fh); c.strokeStyle = 'rgba(205,220,245,.75)'; c.lineWidth = 2; c.stroke(); c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = fw * 0.08; c.lineCap = 'round'; c.beginPath(); c.moveTo(-fw * 0.26, fw * 0.3); c.lineTo(-fw * 0.26, fh - fw * 0.8); c.stroke(); cork(c, fw, 0); c.restore();
    }
    var shy = by + fh + 3, g = c.createLinearGradient(0, shy, 0, shy + 9 * sc); g.addColorStop(0, '#8a5a33'); g.addColorStop(1, '#4e301b'); c.fillStyle = g; c.fillRect(w / 2 - 146 * sc, shy, 292 * sc, 9 * sc);
    var bw = Math.min(250 * sc, w * 0.72), bh = 58 * sc, y0 = Math.max(shy + 30 * sc, h - 82 * sc - bh * 1.9 - 24 * sc), lvl = PG.save.level || 1;
    if (U.button(c, w / 2 - bw / 2, y0, bw, bh, lvl > 1 ? 'Continue  ·  Lv ' + lvl : 'Begin', { color: '#2d6d6a', size: 22 * sc })) PG.go(function () { startLevel(lvl); });
    if (lvl > 1 && U.button(c, w / 2 - bw / 2, y0 + bh + 12 * sc, bw, bh * 0.76, 'Start over at level 1', { color: WINE, size: 15 * sc })) PG.go(function () { PG.save.level = 1; startLevel(1); });
    U.text(c, PG.save.best ? 'Highest brewed: level ' + PG.save.best : 'Music: mintodog   Sounds: Kenney', w / 2, h - 30 * sc, 13 * sc, '#bfa77c', 'center', { font: 'body', shadow: false });
  }
  function update(dt) {
    PG.updateParts(dt); PG.updatePops(dt); st.shake = Math.max(0, st.shake - dt * 30); if (st.won) st.winT += dt;
    if (st.anim) { st.anim.t += dt / (0.95 + st.anim.n * 0.08); if (st.anim.t >= 1) finishPour(); }
  }
  function render(c, w, h) {
    var t = PG.time; c.save(); if (st.shake > 0.2) c.translate((Math.random() - 0.5) * st.shake, 0);
    drawBG(c, w, h, t);
    if (st.state === 'menu') drawMenu(c, w, h, t); else drawPlay(c, w, h, t);
    c.restore();
    PG.vignette(c, w, h, 0.55); PG.grain(c, w, h, 0.05, { mode: 'overlay' });
  }
  PG.onUp = function (x, y) {
    if (st.state !== 'play' || st.won || PG.userPaused) return; var sc = PG.scale();
    if (y > PG.h - Math.max(40, 46 * sc) - 26 * sc) return;
    var L = st.layout; if (!L) return; for (var i = 0; i < st.tubes.length; i++) { var P = tubePos(i); if (Math.abs(x - P.x) < L.cellW * 0.5 && y > P.y - L.th * 0.3 && y < P.y + L.th * 1.1) { tapTube(i); return; } }
    if (st.sel !== -1) st.sel = -1;
  };
  PG.setup(document.getElementById('c'), update, render);
  window.__potion = { st: st, tap: tapTube, start: startLevel, solved: solved, canPour: canPour, topRun: topRun, update: update, done: done };
  PG.init({ id: 'potion_pour', version: '1.1.0', defaults: { level: 1, best: 0, muted: false } }).then(function () {
    PG.music(); st.tubes = [];
  });
})();
