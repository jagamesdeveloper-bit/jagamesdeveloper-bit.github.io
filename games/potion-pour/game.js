/* POTION POUR - sort bubbling potions until every flask holds a single colour. Later levels hide the lower layers. */
(function () {
  'use strict';
  var U = PG.ui, TAU = 6.2832, CAP = 4;
  var COLORS = ['#ff4d6d', '#ff9f1c', '#ffe066', '#9be564', '#2ec4b6', '#4cc9f0', '#4361ee', '#9d4edd', '#ff8fd0', '#b5651d', '#f1f1f1'];
  var NAMES = ['Ruby', 'Amber', 'Sun', 'Lime', 'Teal', 'Sky', 'Indigo', 'Violet', 'Rose', 'Mud', 'Pearl'];
  var st = { state: 'menu', level: 1, tubes: [], sel: -1, anim: null, hist: [], moves: 0, won: false, winT: 0, extraUsed: false, hidden: false, layout: null, shake: 0, hint: null, runLevelStart: 0 };
  var sparks = []; for (var i = 0; i < 30; i++) sparks.push({ x: Math.random(), y: Math.random(), p: Math.random() * 9, s: 0.3 + Math.random() });

  /* ---------- level generation ---------- */
  function levelSpec(n) { var colors = Math.min(3 + Math.floor((n - 1) / 2), 11); return { colors: colors, tubes: colors + 2, hidden: n >= 6 && n % 3 === 0 }; }
  function cloneT(t) { return t.map(function (x) { return x.map(function (s) { return { c: s.c, hid: s.hid }; }); }); }
  function solved(t) { return t.every(function (x) { return x.length === 0 || (x.length === CAP && x.every(function (s) { return s.c === x[0].c; })); }); }
  function key(t) { return t.map(function (x) { return x.map(function (s) { return s.c; }).join(''); }).sort().join('|'); }
  function topRun(x) { if (!x.length) return 0; var c = x[x.length - 1].c, n = 0; for (var i = x.length - 1; i >= 0 && x[i].c === c; i--) n++; return n; }
  function canPour(a, b) { if (!a.length || a === b) return false; if (b.length >= CAP) return false; if (b.length === 0) { return !(a.every(function (s) { return s.c === a[0].c; })); } return b[b.length - 1].c === a[a.length - 1].c; }
  function solvable(t0) { // depth-first with a node cap; true when a solution is found
    var seen = {}, nodes = 0, stack = [t0];
    while (stack.length && nodes < 25000) {
      var t = stack.pop(), k = key(t); if (seen[k]) continue; seen[k] = 1; nodes++; if (solved(t)) return true;
      var moves = [];
      for (var i = 0; i < t.length; i++) for (var j = 0; j < t.length; j++) if (i !== j && canPour(t[i], t[j])) {
        var n = Math.min(topRun(t[i]), CAP - t[j].length), gain = (t[j].length ? 2 : 0) + n + (t[i].length === n ? 1 : 0); moves.push([gain, i, j, n]);
      }
      moves.sort(function (a, b) { return a[0] - b[0]; });
      moves.forEach(function (m) { var nt = cloneT(t); for (var q = 0; q < m[3]; q++) nt[m[2]].push(nt[m[1]].pop()); stack.push(nt); });
    }
    return nodes >= 25000; // unknown: assume solvable (extra flask is always available)
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
  function startLevel(n, keepProgress) {
    st.level = n; var L = buildLevel(n); st.tubes = L.tubes; st.hidden = L.hidden; st.sel = -1; st.anim = null; st.hist = []; st.moves = 0; st.won = false; st.winT = 0; st.extraUsed = false; st.state = 'play'; PG.playing = true; st.hint = null;
    PG.parts = []; PG.pops = [];
    PG.msg('level_started', { level: String(n) }); PG.track('progression_started', { step_id: 'level', step_index: Math.min(n, 80), hidden: st.hidden });
  }

  /* ---------- layout ---------- */
  function computeLayout(w, h) {
    var n = st.tubes.length, best = null, availW = w * 0.94, availTop = h * 0.14, availH = h * 0.66;
    for (var rows = 1; rows <= 3; rows++) {
      var cols = Math.ceil(n / rows), cellW = availW / cols, cellH = availH / rows, tw = Math.min(cellW * 0.62, 80), th = Math.min(cellH * 0.86, tw * 3.7);
      if (!best || th > best.th) best = { rows: rows, cols: cols, cellW: cellW, cellH: cellH, tw: tw, th: th };
    }
    var per = Math.ceil(n / best.rows); best.x0 = (w - best.cellW * Math.min(per, n)) / 2; best.y0 = availTop + (availH - best.cellH * best.rows) / 2; best.per = per; st.layout = best;
  }
  function tubePos(i) { // mouth-center pivot and bottom center
    var L = st.layout, row = Math.floor(i / L.per), col = i % L.per, inRow = Math.min(L.per, st.tubes.length - row * L.per);
    var rowOffset = (L.per - inRow) * L.cellW / 2;
    return { x: L.x0 + rowOffset + col * L.cellW + L.cellW / 2, y: L.y0 + row * L.cellH + (L.cellH - L.th) / 2 + L.th * 0.12 };
  }

  /* ---------- actions ---------- */
  function tapTube(i) {
    if (st.state !== 'play' || st.anim || st.won) return;
    var T = st.tubes;
    if (st.sel === -1) { if (T[i].length) { st.sel = i; PG.sfx('pop', 1.2); } return; }
    if (st.sel === i) { st.sel = -1; PG.sfx('pop', 0.8); return; }
    if (canPour(T[st.sel], T[i])) {
      var n = Math.min(topRun(T[st.sel]), CAP - T[i].length); st.hist.push(cloneT(T)); if (st.hist.length > 60) st.hist.shift();
      st.anim = { from: st.sel, to: i, n: n, t: 0, color: T[st.sel][T[st.sel].length - 1].c }; st.sel = -1; st.moves++; PG.sfx('whoosh');
    } else { if (T[i].length) { st.sel = i; PG.sfx('pop', 1.2); } else { st.sel = -1; } PG.sfx('err'); st.shake = 6; }
  }
  function finishPour() {
    var a = st.anim, T = st.tubes;
    for (var q = 0; q < a.n; q++) T[a.to].push(T[a.from].pop());
    var src = T[a.from]; if (src.length) src[src.length - 1].hid = false;
    st.anim = null; PG.sfx('bell', 0.7 + a.n * 0.1);
    var tb = T[a.to];
    if (tb.length === CAP && tb.every(function (s) { return s.c === tb[0].c; })) { var p = tubePos(a.to); PG.burst(p.x, p.y + st.layout.th * 0.5, 22, { colors: [COLORS[tb[0].c], '#fff'], up: 80, g: 200 }); PG.sfx('win', 1.2); PG.vibrate(20); tb.sealed = 1; }
    if (solved(T)) win();
  }
  function win() {
    st.won = true; st.winT = 0; PG.playing = false; PG.sfx('win'); PG.save.level = Math.max(PG.save.level || 1, st.level + 1); PG.save.best = Math.max(PG.save.best || 0, st.level);
    PG.commit(true); PG.track('progression_completed', { step_id: 'level', step_index: Math.min(st.level, 80), moves: st.moves, hidden: st.hidden }); PG.msg('level_completed', { level: String(st.level) });
    for (var i = 0; i < 4; i++) PG.burst(PG.w * (0.2 + 0.2 * i), PG.h * 0.4, 30, { colors: COLORS, up: 300, g: 380, life: 1.6, s0: 4, s1: 9, shape: 's' });
  }
  function undo() { if (st.anim || st.won || !st.hist.length) return; st.tubes = st.hist.pop(); st.moves = Math.max(0, st.moves - 1); st.sel = -1; PG.sfx('tap'); }
  function addFlask() { if (st.extraUsed || st.anim) return; st.tubes.push([]); st.extraUsed = true; computeLayout(PG.w, PG.h); PG.sfx('upgrade'); PG.track('rewarded_extra_flask', { step_index: st.level }); }
  function layoutBtn(i, n, w, h) { var sc = PG.scale(), bw = Math.min(104 * sc, (w - 40 * sc) / n - 8 * sc), bh = 48 * sc; var total = n * bw + (n - 1) * 10 * sc; return { x: w / 2 - total / 2 + i * (bw + 10 * sc), y: h - bh - 18 * sc, w: bw, h: bh }; }

  /* ---------- drawing ---------- */
  function drawBG(c, w, h, t) {
    var g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#2b1055'); g.addColorStop(0.55, '#4a1d6e'); g.addColorStop(1, '#1b1035'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    // arched window with moon
    var mx = w * 0.8, my = h * 0.12; var mg = c.createRadialGradient(mx, my, 0, mx, my, h * 0.18); mg.addColorStop(0, 'rgba(210,200,255,.45)'); mg.addColorStop(1, 'rgba(210,200,255,0)'); c.fillStyle = mg; c.fillRect(mx - h * 0.2, my - h * 0.2, h * 0.4, h * 0.4);
    c.fillStyle = '#e8e4ff'; c.beginPath(); c.arc(mx, my, Math.min(w, h) * 0.04, 0, TAU); c.fill();
    // shelf lines + bottles silhouettes
    c.fillStyle = 'rgba(0,0,0,.22)'; var shelfY = h * 0.9; c.fillRect(0, shelfY, w, h * 0.012);
    for (var i = 0; i < 9; i++) { var bx = (i + 0.5) / 9 * w, bh2 = 20 + (i * 37 % 25); c.fillStyle = 'rgba(255,255,255,.05)'; c.beginPath(); c.roundRect ? c.roundRect(bx - 9, shelfY - bh2, 18, bh2, 5) : c.rect(bx - 9, shelfY - bh2, 18, bh2); c.fill(); }
    // candle flicker glow
    var fl = 0.8 + 0.2 * Math.sin(t * 9) * Math.sin(t * 5.3); var cg = c.createRadialGradient(w * 0.08, h * 0.2, 0, w * 0.08, h * 0.2, h * 0.3); cg.addColorStop(0, 'rgba(255,190,90,' + 0.25 * fl + ')'); cg.addColorStop(1, 'rgba(255,190,90,0)'); c.fillStyle = cg; c.fillRect(0, 0, w * 0.5, h * 0.6);
    sparks.forEach(function (s) { var x = ((s.x + Math.sin(t * 0.3 + s.p) * 0.03) % 1) * w, y = (1 - ((s.y + t * 0.02 * s.s) % 1)) * h; c.fillStyle = 'rgba(255,230,255,' + 0.35 * (0.5 + 0.5 * Math.sin(t * 2 + s.p)) + ')'; c.beginPath(); c.arc(x, y, 1.5 + s.s * 1.5, 0, TAU); c.fill(); });
  }
  function tubePath(c, tw, th) { var r = tw / 2; c.beginPath(); c.moveTo(-tw / 2, 0); c.lineTo(-tw / 2, th - r); c.arc(0, th - r, r, Math.PI, 0, true); c.lineTo(tw / 2, 0); }
  function segShape(c, k, x, y, r) { c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); switch (k % 11) { case 0: c.arc(x, y, r * 0.5, 0, TAU); break; case 1: c.moveTo(x, y - r * 0.6); c.lineTo(x + r * 0.55, y + r * 0.4); c.lineTo(x - r * 0.55, y + r * 0.4); break; case 2: c.rect(x - r * 0.4, y - r * 0.4, r * 0.8, r * 0.8); break; case 3: for (var i = 0; i < 10; i++) { var a = i * 0.628 - 1.57, rr = i % 2 ? r * 0.25 : r * 0.6; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } break; case 4: c.moveTo(x, y - r * 0.6); c.lineTo(x + r * 0.5, y); c.lineTo(x, y + r * 0.6); c.lineTo(x - r * 0.5, y); break; case 5: c.arc(x - r * 0.22, y, r * 0.25, 0, TAU); c.moveTo(x + r * 0.5, y); c.arc(x + r * 0.22, y, r * 0.25, 0, TAU); break; case 6: c.rect(x - r * 0.55, y - r * 0.15, r * 1.1, r * 0.3); break; case 7: c.rect(x - r * 0.15, y - r * 0.55, r * 0.3, r * 1.1); break; case 8: c.moveTo(x - r * 0.5, y - r * 0.4); c.lineTo(x + r * 0.5, y - r * 0.4); c.lineTo(x, y + r * 0.5); break; case 9: c.arc(x, y, r * 0.5, 0, TAU); c.moveTo(x + r * 0.2, y); c.arc(x, y, r * 0.2, 0, TAU); break; default: c.moveTo(x - r * 0.5, y); c.quadraticCurveTo(x, y - r * 0.7, x + r * 0.5, y); } c.fill('evenodd'); }
  function drawTube(c, i, t) {
    var L = st.layout, T = st.tubes[i], P = tubePos(i), tw = L.tw, th = L.th, sh = (th - tw * 0.18) / CAP, a = st.anim;
    var lift = (st.sel === i ? -th * 0.22 * PG.ease.out(Math.min(1, (t - (st['selT' + i] || 0) + 1))) : 0), tilt = 0, px = P.x, py = P.y, drawn = T.length, ghost = 0, ghostC = 0, pour = 0;
    if (st.sel === i) lift = -th * 0.22 + Math.sin(t * 6) * 2;
    if (a && a.from === i) { var tt = a.t; var e = tt < 0.25 ? PG.ease.io(tt / 0.25) : tt > 0.8 ? PG.ease.io(1 - (tt - 0.8) / 0.2) : 1; var tp = tubePos(a.to), dir = tp.x >= P.x ? 1 : -1; if (Math.abs(tp.x - P.x) < 2) dir = (P.x > PG.w / 2 ? -1 : 1);
      px = PG.lerp(P.x, tp.x - dir * tw * 0.75, e); py = PG.lerp(P.y, tp.y - th * 0.45, e); tilt = dir * e * (0.9 + a.n * 0.12); lift = 0;
      pour = tt > 0.2 && tt < 0.85 ? PG.clamp((tt - 0.2) / 0.65, 0, 1) : (tt >= 0.85 ? 1 : 0); drawn = T.length - a.n * pour; }
    if (a && a.to === i) { var pr = a.t > 0.2 && a.t < 0.85 ? PG.clamp((a.t - 0.2) / 0.65, 0, 1) : (a.t >= 0.85 ? 1 : 0); ghost = a.n * pr; ghostC = a.color; }
    c.save(); c.translate(px, py + lift); c.rotate(tilt);
    // shadow
    if (!a || a.from !== i) { c.save(); c.rotate(-tilt); c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.ellipse(0, th + 4 - lift, tw * 0.55, tw * 0.14, 0, 0, TAU); c.fill(); c.restore(); }
    // liquid (clip to tube)
    c.save(); tubePath(c, tw, th); c.clip();
    c.fillStyle = 'rgba(255,255,255,.07)'; c.fillRect(-tw, 0, tw * 2, th);
    c.rotate(-tilt); // liquid stays level in world space
    var cosT = Math.cos(tilt), sinT = Math.abs(Math.sin(tilt)), baseY = th * cosT + tw / 2 * sinT - tw * 0.04 + (tilt ? (-lift * 0) : 0), wob = (a && (a.from === i || a.to === i)) ? 2.2 : 1.1;
    var total = drawn + ghost; var full = Math.floor(total);
    for (var k = 0; k < Math.ceil(total - 0.001); k++) {
      var seg = k < T.length ? T[k] : null, colIdx = k < T.length ? T[k].c : ghostC; if (k >= T.length && !ghost) break;
      var frac = Math.min(1, total - k), y1 = baseY - k * sh, y0 = y1 - sh * frac, hid = seg && seg.hid && k < T.length - 1 && !(a && a.from === i);
      var col = hid ? '#3b3560' : COLORS[colIdx];
      c.fillStyle = col; c.beginPath(); c.moveTo(-tw, y1 + 1); c.lineTo(-tw, y0);
      var top = frac < 1 || k === Math.ceil(total - 0.001) - 1;
      if (top) { for (var xx = -tw; xx <= tw; xx += 4) c.lineTo(xx, y0 + Math.sin(t * 3.2 + xx * 0.18 + i) * wob + (tilt ? -(xx / tw) * tilt * tw * 0.3 * 0 : 0)); } else c.lineTo(tw, y0 - 0.5);
      c.lineTo(tw, y1 + 1); c.closePath(); c.fill();
      if (!hid) { c.save(); c.globalAlpha = 0.35; segShape(c, colIdx, 0, (y0 + y1) / 2 + 1, Math.min(tw * 0.5, sh * 0.5)); c.restore(); c.fillStyle = 'rgba(255,255,255,.14)'; c.fillRect(-tw / 2 + 2, y0 + 2, tw * 0.18, Math.max(0, y1 - y0 - 4)); }
      else { c.fillStyle = 'rgba(255,255,255,.35)'; c.font = '800 ' + (sh * 0.5) + 'px ' + PG.font; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', 0, (y0 + y1) / 2); }
      // bubbles
      if (!hid && k === Math.ceil(total - 0.001) - 1) { for (var b = 0; b < 3; b++) { var bt = (t * 0.6 + b * 0.33 + i * 0.17) % 1; c.fillStyle = 'rgba(255,255,255,' + 0.5 * (1 - bt) + ')'; c.beginPath(); c.arc((Math.sin(b * 5 + i) * tw * 0.22), y1 - bt * sh, 1.4 + b * 0.5, 0, TAU); c.fill(); } }
    }
    c.restore();
    // glass
    c.save(); tubePath(c, tw, th); c.lineWidth = Math.max(2, tw * 0.05); c.strokeStyle = 'rgba(220,235,255,.75)'; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = tw * 0.05; c.beginPath(); c.moveTo(-tw * 0.3, tw * 0.15); c.lineTo(-tw * 0.3, th - tw * 0.6); c.stroke();
    // rim
    c.fillStyle = 'rgba(230,240,255,.9)'; c.beginPath(); c.ellipse(0, 0, tw / 2 + 3, 3.5, 0, 0, TAU); c.fill();
    c.restore();
    if (T.sealed && !a) { // finished flask glows and is corked
      c.fillStyle = '#c28a52'; c.beginPath(); c.moveTo(-tw * 0.3, -2); c.lineTo(tw * 0.3, -2); c.lineTo(tw * 0.25, -tw * 0.35); c.lineTo(-tw * 0.25, -tw * 0.35); c.closePath(); c.fill(); c.fillStyle = 'rgba(255,255,255,.3)'; c.fillRect(-tw * 0.2, -tw * 0.3, tw * 0.1, tw * 0.25);
      var gl = c.createRadialGradient(0, th * 0.5, 0, 0, th * 0.5, th * 0.9); gl.addColorStop(0, 'rgba(255,255,255,' + (0.18 + 0.1 * Math.sin(t * 3 + i)) + ')'); gl.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gl; c.fillRect(-th, -th * 0.2, th * 2, th * 1.4);
    }
    // stream
    if (a && a.from === i && pour > 0 && a.t < 0.85) { c.rotate(-tilt); }
    c.restore();
    if (a && a.from === i && a.t > 0.2 && a.t < 0.85) { // stream from the lip to the target surface
      var lip = { x: px + Math.cos(tilt) * (tilt > 0 ? tw / 2 : -tw / 2), y: py + Math.sin(tilt) * (tilt > 0 ? tw / 2 : -tw / 2) }; var tp2 = tubePos(a.to);
      var tgtLevel = tp2.y + (st.layout.th - tw * 0.04) - (st.tubes[a.to].length + a.n * pour) * sh;
      c.strokeStyle = COLORS[a.color]; c.lineWidth = tw * 0.16; c.lineCap = 'round'; c.beginPath(); c.moveTo(lip.x, lip.y); c.quadraticCurveTo(lip.x + (tp2.x - lip.x) * 0.35 + Math.sin(PG.time * 30) * 1.2, lip.y + (tgtLevel - lip.y) * 0.1, tp2.x + Math.sin(PG.time * 25) * 1.5, tgtLevel); c.stroke();
      if (Math.random() < 0.5) PG.parts.push({ x: tp2.x + PG.rand(-tw * 0.2, tw * 0.2), y: tgtLevel, vx: PG.rand(-40, 40), vy: PG.rand(-90, -30), life: 0.4, t: 0, size: 2.4, color: COLORS[a.color], g: 300, shape: 'c' });
    }
  }
  function hit(x, y, w, h) { var I = PG.input; if (I.released && PG.inRect(x, y, w, h) && PG.inRect(x, y, w, h, I.px, I.py)) { I.released = false; PG.sfx('tap'); return true; } return false; }
  function drawPlay(c, w, h, t) {
    var sc = PG.scale(); computeLayout(w, h);
    for (var i = 0; i < st.tubes.length; i++) drawTube(c, i, t);
    PG.drawParts(c); PG.drawPops(c);
    U.text(c, 'Level ' + st.level, 16 * sc, 30 * sc, 32 * sc, '#fff', 'left', { stroke: 'rgba(0,0,0,.35)' });
    U.text(c, 'Moves ' + st.moves + (st.hidden ? '  -  Mystery layers' : ''), 16 * sc, 58 * sc, 15 * sc, st.hidden ? '#ffd23f' : '#d8c8ff', 'left');
    var btns = [['Undo', '#4cc9f0', undo], ['Restart', '#ff9f1c', function () { PG.track('level_restarted', { step_index: Math.min(st.level, 80) }); startLevel(st.level); }]];
    var canAd = !st.extraUsed && PG.rewardedSupported(); if (canAd) btns.push(['+Flask (ad)', '#8338ec', function () { PG.rewarded('bonus').then(function (ok) { if (ok) addFlask(); }); }]);
    btns.forEach(function (b, k) { var r = layoutBtn(k, btns.length, w, h); if (!st.won && U.button(c, r.x, r.y, r.w, r.h, b[0], { color: b[1], size: Math.min(r.h * 0.42, 18 * sc) })) b[2](); });
    if (st.won) { st.winT += 0.016; var k2 = PG.ease.out(Math.min(1, st.winT * 2)); c.fillStyle = 'rgba(15,6,40,' + 0.5 * k2 + ')'; c.fillRect(0, 0, w, h);
      var pw = Math.min(w * 0.86, 360 * sc), ph = 250 * sc, px = w / 2 - pw / 2, py = h * 0.42 - ph / 2 + (1 - k2) * 50; U.panel(c, px, py, pw, ph);
      U.text(c, 'Brewed!', w / 2, py + 44 * sc, 40 * sc, '#ffd23f', 'center'); U.text(c, 'Level ' + st.level + ' in ' + st.moves + ' moves', w / 2, py + 90 * sc, 18 * sc, '#fff', 'center');
      if (U.button(c, w / 2 - 100 * sc, py + 130 * sc, 200 * sc, 58 * sc, 'Next level', { color: '#2ec4b6' })) { PG.interstitial('level_end').then(function () { startLevel(st.level + 1); }); } }
  }
  function drawMenu(c, w, h, t) {
    var sc = PG.scale(); c.fillStyle = 'rgba(10,5,30,.25)'; c.fillRect(0, 0, w, h);
    U.text(c, 'POTION', w / 2, h * 0.13, Math.min(60 * sc, w * 0.16), '#fff', 'center', { stroke: '#4a1d6e' }); U.text(c, 'POUR', w / 2, h * 0.13 + 56 * sc, Math.min(66 * sc, w * 0.18), '#ff8fd0', 'center', { stroke: '#4a1d6e' });
    // decorative flasks
    var cols = [0, 5, 3, 7]; for (var i = 0; i < 4; i++) { var fx = w / 2 + (i - 1.5) * 62 * sc, fy = h * 0.4 + Math.sin(t * 1.5 + i) * 6, tw = 40 * sc, th = 110 * sc; c.save(); c.translate(fx, fy); tubePath(c, tw, th); c.save(); c.clip(); c.fillStyle = COLORS[cols[i]]; var lv = th * (0.35 + 0.2 * Math.sin(t + i)); c.beginPath(); c.moveTo(-tw, th); c.lineTo(-tw, th - lv); for (var x = -tw; x <= tw; x += 4) c.lineTo(x, th - lv + Math.sin(t * 3 + x * 0.2 + i) * 2); c.lineTo(tw, th); c.fill(); c.restore(); tubePath(c, tw, th); c.strokeStyle = 'rgba(230,240,255,.8)'; c.lineWidth = 3; c.stroke(); c.restore(); }
    var bw = 230 * sc, bh = 62 * sc, y0 = h * 0.66, lvl = PG.save.level || 1;
    if (U.button(c, w / 2 - bw / 2, y0, bw, bh, lvl > 1 ? 'Continue  (Lv ' + lvl + ')' : 'Play', { color: '#ff8fd0', size: 24 * sc })) startLevel(lvl);
    if (lvl > 1 && U.button(c, w / 2 - bw / 2, y0 + bh + 14 * sc, bw, bh * 0.75, 'Restart from level 1', { color: '#5c6bc0', size: 16 * sc })) { PG.save.level = 1; startLevel(1); }
    if (PG.save.best) U.text(c, 'Highest cleared: ' + PG.save.best, w / 2, h - 30 * sc, 16 * sc, '#d8c8ff', 'center');
  }
  function update(dt) {
    PG.updateParts(dt); PG.updatePops(dt); st.shake = Math.max(0, st.shake - dt * 30);
    if (st.anim) { st.anim.t += dt / (0.95 + st.anim.n * 0.08); if (st.anim.t >= 1) finishPour(); }
  }
  function render(c, w, h) {
    var t = PG.time; c.save(); if (st.shake > 0.2) c.translate((Math.random() - 0.5) * st.shake, 0);
    drawBG(c, w, h, t);
    if (st.state === 'menu') drawMenu(c, w, h, t); else drawPlay(c, w, h, t);
    c.restore();
  }
  PG.onUp = function (x, y) {
    if (st.state !== 'play' || st.won || PG.userPaused) return; var sc = PG.scale(); if (x > PG.w - 130 * sc && y < 70 * sc) return;
    var btnZone = PG.h - 48 * sc - 24 * sc; if (y > btnZone) return;
    var L = st.layout; if (!L) return; for (var i = 0; i < st.tubes.length; i++) { var P = tubePos(i); if (Math.abs(x - P.x) < L.cellW * 0.5 && y > P.y - L.th * 0.3 && y < P.y + L.th * 1.1) { tapTube(i); return; } }
    if (st.sel !== -1) st.sel = -1;
  };
  PG.setup(document.getElementById('c'), update, render);
  window.__potion = { st: st, tap: tapTube, start: startLevel, solved: solved, canPour: canPour, topRun: topRun };
  PG.init({ id: 'potion_pour', version: '1.0.0', defaults: { level: 1, best: 0, muted: false } }).then(function () {
    PG.music({ scale: [0, 3, 5, 7, 10], root: 233, bpm: 80, wave: 'sine', vol: 0.07, bass: 0.1 });
    st.tubes = []; // menu has no tubes
  });
})();
