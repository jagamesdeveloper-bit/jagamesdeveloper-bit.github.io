/* Echo Spire - rendering, input and flow. Puzzle rules live in logic.js. */
(() => {
  'use strict';

  const L = window.EchoLogic;
  const LEVELS = window.EchoLevels.map(L.prepare);
  const $ = id => document.getElementById(id);
  const canvas = $('c');
  const ctx = canvas.getContext('2d');
  const TAU = Math.PI * 2;

  let W = 0, H = 0, DPR = 1;
  const cam = { s: 36, ox: 0, oy: 0, bob: 0 };
  const proj = (x, y, z) => [cam.ox + (x - y) * cam.s, cam.oy + cam.bob + ((x + y) / 2 - z) * cam.s];

  // ---------- saved progress (never trust storage to exist) ----------
  const prog = { unlocked: 1, muted: false, best: {} };
  try { Object.assign(prog, JSON.parse(localStorage.getItem('echoSpire') || '{}')); } catch (e) { /* private mode */ }
  const saveProg = () => { try { localStorage.setItem('echoSpire', JSON.stringify(prog)); } catch (e) { /* ignore */ } };

  // ---------- audio ----------
  let ac = null;
  function audio() {
    if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } }
    if (ac && ac.state === 'suspended') ac.resume();
    if (ac && !musicOn) startMusic();
    return ac;
  }

  // Soft generative pad: a slow root note plus a few random pentatonic bells per bar.
  const SCALE = [261.63, 293.66, 329.63, 392, 440, 523.25, 587.33];
  const ROOTS = [130.81, 98, 110, 87.31];
  let musicOn = false, bar = 0;
  function startMusic() {
    musicOn = true;
    const play = () => {
      if (document.hidden || prog.muted) return;
      const root = ROOTS[bar++ % ROOTS.length];
      tone(root, 5.2, 'sine', 0.035);
      tone(root * 1.5, 5.2, 'sine', 0.016, 0.1);
      for (let i = 0; i < 3; i++) {
        if (Math.random() < 0.25) continue;
        const f = SCALE[Math.floor(Math.random() * SCALE.length)] * (Math.random() < 0.3 ? 2 : 1);
        tone(f, 2.6, 'sine', 0.02, 0.5 + i * 1.2 + Math.random() * 0.4);
      }
    };
    play();
    setInterval(play, 4800);
  }
  function tone(f, d, type, vol, delay, f2) {
    if (prog.muted) return;
    const c = audio();
    if (!c) return;
    const t = c.currentTime + (delay || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.06, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + d + 0.03);
  }
  const sfx = {
    step: () => tone(380 + Math.random() * 90, 0.09, 'triangle', 0.045),
    crank: () => { tone(170, 0.6, 'sawtooth', 0.025, 0, 330); tone(660, 0.1, 'square', 0.02); },
    nope: () => tone(160, 0.2, 'square', 0.03, 0, 110),
    tap: () => tone(700, 0.07, 'sine', 0.03),
    plate: () => { tone(220, 0.25, 'triangle', 0.05, 0, 150); tone(440, 0.12, 'square', 0.015); },
    echo: () => { tone(880, 1, 'sine', 0.04, 0, 440); tone(1320, 1, 'sine', 0.02, 0.08, 660); },
    win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.55, 'sine', 0.06, i * 0.11)),
  };

  // ---------- colour ----------
  const hex = c => { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const SH = hex('#3a2f6b');
  const LV = (() => { const v = [0.32, 0.6, 0.8], n = Math.hypot(v[0], v[1], v[2]); return v.map(a => a / n); })();
  function tint(rgb, b) {
    const k = 0.52 + 0.6 * b, m = (1 - b) * 0.3;
    const f = i => Math.min(255, (rgb[i] * k * (1 - m) + SH[i] * m) | 0);
    return 'rgb(' + f(0) + ',' + f(1) + ',' + f(2) + ')';
  }

  // ---------- geometry ----------
  const FACES = [
    { n: [0, 0, 1], pts: b => [[b.x0, b.y0, b.z1], [b.x1, b.y0, b.z1], [b.x1, b.y1, b.z1], [b.x0, b.y1, b.z1]] },
    { n: [1, 0, 0], pts: b => [[b.x1, b.y0, b.z0], [b.x1, b.y1, b.z0], [b.x1, b.y1, b.z1], [b.x1, b.y0, b.z1]] },
    { n: [0, 1, 0], pts: b => [[b.x1, b.y1, b.z0], [b.x0, b.y1, b.z0], [b.x0, b.y1, b.z1], [b.x1, b.y1, b.z1]] },
    { n: [-1, 0, 0], pts: b => [[b.x0, b.y1, b.z0], [b.x0, b.y0, b.z0], [b.x0, b.y0, b.z1], [b.x0, b.y1, b.z1]] },
    { n: [0, -1, 0], pts: b => [[b.x0, b.y0, b.z0], [b.x1, b.y0, b.z0], [b.x1, b.y0, b.z1], [b.x0, b.y0, b.z1]] },
  ];

  const STAIR_STEPS = 3;
  function blockBoxes(b) {
    if (b._boxes) return b._boxes;
    if (b.kind === 's') {
      b._boxes = [];
      for (let i = 0; i < STAIR_STEPS; i++) {
        const a = L.rotPoint(0.5, 0.5, i / STAIR_STEPS, 0, b.dir);
        const c = L.rotPoint(0.5, 0.5, (i + 1) / STAIR_STEPS, 1, b.dir);
        b._boxes.push({
          x0: b.x + Math.min(a[0], c[0]), x1: b.x + Math.max(a[0], c[0]),
          y0: b.y + Math.min(a[1], c[1]), y1: b.y + Math.max(a[1], c[1]),
          z0: b.z, z1: b.z + (i + 1) / STAIR_STEPS,
        });
      }
    } else if (b.kind === 'l') {
      const bx = b.x, by = b.y, z = b.z;
      b._boxes = [
        { x0: bx + 0.40, x1: bx + 0.60, y0: by + 0.40, y1: by + 0.60, z0: z, z1: z + 1 },
        { x0: bx + 0.14, x1: bx + 0.86, y0: by + 0.45, y1: by + 0.55, z0: z + 0.16, z1: z + 0.24 },
        { x0: bx + 0.14, x1: bx + 0.86, y0: by + 0.45, y1: by + 0.55, z0: z + 0.58, z1: z + 0.66 },
      ];
    } else {
      b._boxes = [{ x0: b.x, x1: b.x + 1, y0: b.y, y1: b.y + 1, z0: b.z, z1: b.z + 1 }];
    }
    return b._boxes;
  }

  // Current pose of a piece (continuous, so it can be mid-animation).
  function tfOf(piece, v) {
    const a = v.ang * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    const px = piece.pivot[0], py = piece.pivot[1];
    const sl = piece.slide ? piece.slide : [0, 0, 0];
    const ox = sl[0] * v.sl, oy = sl[1] * v.sl, oz = sl[2] * v.sl;
    return { c, s, f: (x, y, z) => { const dx = x - px, dy = y - py; return [px + dx * c - dy * s + ox, py + dx * s + dy * c + oy, z + oz]; } };
  }

  // ---------- game state ----------
  let G = null;
  const ambient = Array.from({ length: 46 }, () => ({ x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 1.8, sp: 0.004 + Math.random() * 0.012, ph: Math.random() * TAU }));
  const clouds = Array.from({ length: 6 }, (_, i) => ({ x: Math.random(), y: 0.08 + i * 0.13 + Math.random() * 0.05, w: 0.25 + Math.random() * 0.3, sp: 0.004 + Math.random() * 0.006 }));

  // Fewest turns for a level, found once on demand (the biggest levels take a moment to search).
  function parOf(lv) {
    if (lv.par === undefined) { const r = L.solve(lv, L.initialState(lv), lv.start, 20); lv.par = r ? r.taps : 0; }
    return lv.par;
  }

  function loadLevel(i) {
    const lv = LEVELS[i];
    G = {
      i, lv,
      st: L.initialState(lv),
      vis: lv.pieces.map(() => ({ ang: 0, sl: 0 })),
      hv: lv.handles.map(() => ({ a: 0 })),
      tween: null, walk: null, tap: null,
      player: lv.start, won: false, winT: 0, active: false,
      sparks: [], puffs: [], ripples: [], ill: new Set(), illEdges: new Set(), hint: null, hintT: 0, time: 0, intro: 0, shake: 0, moves: 0, hit: [], handleHit: [], par: parOf(lv),
      all: null, adj: null,
    };
    refresh();
    computeCamera();
    $('lvnum').textContent = 'LEVEL ' + (i + 1) + ' / ' + LEVELS.length;
    $('lvname').textContent = lv.name;
    const hint = $('hint');
    hint.textContent = lv.hint;
    hint.classList.remove('dim');
  }

  // fx: announce impossible joins that did not exist before (after a turn finishes).
  function refresh(fx) {
    G.all = L.cells(G.lv, G.st);
    G.adj = L.buildGraph(G.lv, G.all);
    const tiles = new Set();
    let fresh = false;
    const tfs = G.lv.pieces.map(p => tfOf(p, G.vis[p.id]));
    G.adj.ill.forEach(e => {
      const ab = e.split(',').map(Number);
      tiles.add(ab[0]); tiles.add(ab[1]);
      if (fx && !G.lv.blind && !G.illEdges.has(e)) {
        const a = anchorOf(ab[0], tfs), b = anchorOf(ab[1], tfs);
        G.ripples.push({ x: (a.s[0] + b.s[0]) / 2, y: (a.s[1] + b.s[1]) / 2, age: 0 });
        fresh = true;
      }
    });
    if (fresh && !G.lv.blind) sfx.echo();
    G.ill = G.lv.blind ? new Set() : tiles; G.illEdges = G.adj.ill;
  }

  function computeCamera() {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const add = (x, y, z) => {
      const sx = x - y, sy = (x + y) / 2 - z;
      if (sx < x0) x0 = sx; if (sx > x1) x1 = sx; if (sy < y0) y0 = sy; if (sy > y1) y1 = sy;
    };
    G.lv.pieces.forEach(p => {
      const angles = p.rot ? Array.from({ length: 24 }, (_, i) => i * 15) : [0];
      const slides = p.slide ? [0, 1] : [0];
      angles.forEach(a => slides.forEach(s => {
        const tf = tfOf(p, { ang: a, sl: s });
        p.blocks.forEach(b => blockBoxes(b).forEach(bx => {
          for (const x of [bx.x0, bx.x1]) for (const y of [bx.y0, bx.y1]) for (const z of [bx.z0, bx.z1]) {
            const w = tf.f(x, y, z); add(w[0], w[1], w[2]);
          }
        }));
      }));
    });
    y0 -= 1.9; y1 += 0.35; x0 -= 0.6; x1 += 0.6;
    const topUI = 78, botUI = 74, padX = 14;
    const aw = Math.max(80, W - padX * 2), ah = Math.max(80, H - topUI - botUI);
    cam.s = Math.max(12, Math.min(aw / (x1 - x0), ah / (y1 - y0), 64));
    cam.ox = W / 2 - ((x0 + x1) / 2) * cam.s;
    cam.oy = topUI + ah / 2 - ((y0 + y1) / 2) * cam.s;
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    if (G) computeCamera();
  }
  window.addEventListener('resize', resize);

  // ---------- animation helpers ----------
  const ease = u => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

  function startTween(items, dur, done) {
    G.tween = { t: 0, dur, items, done };
  }

  function activate(hi) {
    const h = G.lv.handles[hi];
    const next = L.tap(G.lv, G.st, hi);
    const items = [];
    h.targets.forEach(pi => {
      const p = G.lv.pieces[pi], v = G.vis[pi];
      if (h.type === 'rot') {
        const to = p.rot.cycle === 4 ? v.ang + p.rot.step * 90 * h.dir : next[pi].r * p.rot.step * 90;
        items.push({ o: v, k: 'ang', from: v.ang, to });
      } else {
        items.push({ o: v, k: 'sl', from: v.sl, to: next[pi].s });
      }
    });
    items.push({ o: G.hv[hi], k: 'a', from: G.hv[hi].a, to: G.hv[hi].a + 180 * h.dir });
    G.st = next;
    G.moves++;
    G.hint = null;
    sfx.crank();
    startTween(items, 0.8, () => { refresh(true); checkWin(); });
    fadeHint();
  }

  function fadeHint() {
    clearTimeout(fadeHint.t);
    fadeHint.t = setTimeout(() => $('hint').classList.add('dim'), 3500);
  }

  // Stepping onto a plate works the mechanism, like tapping its crank.
  function firePlate() {
    const hi = G.lv.plateMap.get(G.player);
    if (G.won || G.tween || hi === undefined) return;
    sfx.plate();
    activate(hi);
  }

  function startWalk(path) {
    G.walk = { path, i: 0, t: 0 };
    fadeHint();
  }

  function checkWin() {
    if (G.won || G.player !== G.lv.goal) return;
    G.won = true; G.winT = 0;
    sfx.win();
    const tfs = G.lv.pieces.map(p => tfOf(p, G.vis[p.id]));
    const a = anchorOf(G.lv.goal, tfs);
    for (let i = 0; i < 70; i++) {
      const ang = Math.random() * TAU, sp = 40 + Math.random() * 160;
      G.sparks.push({ x: a.s[0], y: a.s[1] - cam.s * 0.5, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 80, life: 1 + Math.random() * 0.8, age: 0, hue: 30 + Math.random() * 40 });
    }
    if (prog.unlocked < G.i + 2) prog.unlocked = Math.min(LEVELS.length, G.i + 2);
    if (!prog.best[G.i] || G.moves < prog.best[G.i]) prog.best[G.i] = G.moves;
    saveProg();
    buildLevelGrid();
  }

  function anchorOf(idx, tfs) {
    const f = G.lv.flat[idx], b = f.b;
    const top = b.kind === 's' ? b.z + 0.62 : b.kind === 'l' ? b.z + 0.5 : b.z + 1;
    const w = tfs[f.pi].f(b.x + 0.5, b.y + 0.5, top);
    return { w, s: proj(w[0], w[1], w[2]), key: w[0] + w[1] + w[2] };
  }

  // ---------- update ----------
  function update(dt) {
    G.time += dt;
    G.intro = Math.min(1, G.intro + dt * 1.1);
    if (G.hint && (G.hintT -= dt) < 0) G.hint = null;
    G.shake = Math.max(0, G.shake - dt);
    if (G.tap) { G.tap.t += dt; if (G.tap.t > 0.7) G.tap = null; }

    if (G.tween) {
      const tw = G.tween;
      tw.t += dt;
      const u = Math.min(1, tw.t / tw.dur), e = ease(u);
      tw.items.forEach(it => { it.o[it.k] = it.from + (it.to - it.from) * e; });
      if (u >= 1) { G.tween = null; tw.done && tw.done(); }
    }

    if (G.walk) {
      const w = G.walk;
      w.t += dt / 0.3;
      while (w.t >= 1 && w.i < w.path.length - 1) {
        w.t -= 1; w.i++; G.player = w.path[w.i]; sfx.step();
        const a = anchorOf(G.player, G.lv.pieces.map(p => tfOf(p, G.vis[p.id])));
        G.puffs.push({ x: a.s[0], y: a.s[1], age: 0, life: 0.5 });
        const p0 = w.path[w.i - 1], p1 = w.path[w.i];
        if (G.adj.ill.has(Math.min(p0, p1) + ',' + Math.max(p0, p1))) { G.ripples.push({ x: a.s[0], y: a.s[1], age: 0 }); sfx.echo(); }
      }
      if (w.i >= w.path.length - 1) { G.walk = null; checkWin(); firePlate(); }
    }

    if (G.won) {
      G.winT += dt;
      if (G.winT > 1.3 && !G.winShown) showWin();
    }

    for (let i = G.ripples.length - 1; i >= 0; i--) {
      G.ripples[i].age += dt;
      if (G.ripples[i].age > 1.2) G.ripples.splice(i, 1);
    }
    for (let i = G.puffs.length - 1; i >= 0; i--) {
      G.puffs[i].age += dt;
      if (G.puffs[i].age > G.puffs[i].life) G.puffs.splice(i, 1);
    }
    for (let i = G.sparks.length - 1; i >= 0; i--) {
      const p = G.sparks[i];
      p.age += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 160 * dt;
      if (p.age > p.life) G.sparks.splice(i, 1);
    }
  }

  // ---------- rendering ----------
  function poly(pts) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
  }

  function drawBackground(time) {
    const sky = G.lv.sky;
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const R = Math.max(W, H) * 0.5;
    const rg = ctx.createRadialGradient(W * 0.78, H * 0.2, 0, W * 0.78, H * 0.2, R);
    rg.addColorStop(0, 'rgba(255,255,255,.6)'); rg.addColorStop(0.35, 'rgba(255,255,255,.14)'); rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
    clouds.forEach(c => {
      const x = ((c.x + time * c.sp) % 1.4 - 0.2) * W, w = c.w * W, y = c.y * H;
      const cg = ctx.createRadialGradient(x, y, 0, x, y, w * 0.5);
      cg.addColorStop(0, 'rgba(255,255,255,.22)'); cg.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.save(); ctx.translate(x, y); ctx.scale(1, 0.22); ctx.translate(-x, -y);
      ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(x, y, w * 0.5, 0, TAU); ctx.fill(); ctx.restore();
    });
    ambient.forEach(p => {
      const y = ((p.y - time * p.sp) % 1 + 1) % 1, x = p.x + Math.sin(time * 0.4 + p.ph) * 0.01;
      ctx.fillStyle = 'rgba(255,255,255,' + (0.25 + 0.25 * Math.sin(time * 1.3 + p.ph)) + ')';
      ctx.beginPath(); ctx.arc(x * W, y * H, p.r, 0, TAU); ctx.fill();
    });
  }

  function drawBox(bx, tf, rgb, f) {
    const walkable = G.lv.flat[f.idx].b.kind === 'b';
    for (const face of FACES) {
      const nx = face.n[0] * tf.c - face.n[1] * tf.s, ny = face.n[0] * tf.s + face.n[1] * tf.c, nz = face.n[2];
      if (nx + ny + nz < 0.02) continue;
      const lit = Math.max(0, nx * LV[0] + ny * LV[1] + nz * LV[2]);
      const pts = face.pts(bx).map(p => { const w = tf.f(p[0], p[1], p[2]); return proj(w[0], w[1], w[2]); });
      const top = nz > 0.9;
      if (top) {
        ctx.fillStyle = tint(rgb, lit);
      } else {
        let y0 = Infinity, y1 = -Infinity;
        pts.forEach(p => { if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1]; });
        const g = ctx.createLinearGradient(0, y0, 0, y1);
        g.addColorStop(0, tint(rgb, lit)); g.addColorStop(1, tint(rgb, lit * 0.62));
        ctx.fillStyle = g;
      }
      poly(pts); ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = top ? 'rgba(255,255,255,.28)' : 'rgba(58,47,107,.2)'; ctx.stroke();
      if (top && walkable) {
        // lighter inlay marks the tiles you can walk on
        const cx = (pts[0][0] + pts[2][0]) / 2, cy = (pts[0][1] + pts[2][1]) / 2;
        const inset = pts.map(p => [cx + (p[0] - cx) * 0.62, cy + (p[1] - cy) * 0.62]);
        poly(inset);
        ctx.fillStyle = G.ill.has(f.idx) ? 'rgba(206,176,255,' + (0.5 + 0.25 * Math.sin(G.time * 3 + f.idx)) + ')' : 'rgba(255,255,255,.2)';
        ctx.fill();
        if (G.lv.plateMap.has(f.idx)) {
          const pcx = (pts[0][0] + pts[2][0]) / 2, pcy = (pts[0][1] + pts[2][1]) / 2, pp = 0.5 + 0.5 * Math.sin(G.time * 3);
          const rg = ctx.createRadialGradient(pcx, pcy, 0, pcx, pcy, cam.s * 0.5);
          rg.addColorStop(0, 'rgba(255,236,170,' + (0.95) + ')'); rg.addColorStop(0.55, 'rgba(255,200,110,' + (0.55 + 0.25 * pp) + ')'); rg.addColorStop(1, 'rgba(255,190,100,0)');
          ctx.fillStyle = rg; ctx.beginPath(); ctx.ellipse(pcx, pcy, cam.s * 0.5, cam.s * 0.26, 0, 0, TAU); ctx.fill();
          ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.ellipse(pcx, pcy, cam.s * 0.24, cam.s * 0.125, 0, 0, TAU); ctx.stroke();
          if (!G.lv.blind) {
            // pips in the colour of each piece this plate turns; hollow means it turns them backwards
            const ph = G.lv.handles[G.lv.plateMap.get(f.idx)];
            ph.targets.forEach((pi, k) => {
              const a = Math.PI * 0.5 + (k - (ph.targets.length - 1) / 2) * 0.7;
              const px = pcx + Math.cos(a) * cam.s * 0.2, py = pcy + Math.sin(a) * cam.s * 0.1 + cam.s * 0.02;
              ctx.beginPath(); ctx.arc(px, py, Math.max(2.5, cam.s * 0.075), 0, TAU);
              ctx.fillStyle = G.lv.pieces[pi].color;
              if (ph.dir < 0) { ctx.lineWidth = 2; ctx.strokeStyle = G.lv.pieces[pi].color; ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fill(); ctx.stroke(); } else ctx.fill();
            });
          }
        }
      }
      G.hit.push({ pts, idx: f.idx, walk: G.lv.flat[f.idx].b.kind !== 'd' });
    }
  }

  function drawGoal(a, time) {
    const S = cam.s, p = 0.5 + 0.5 * Math.sin(time * 2.2);
    const x = a.s[0], y = a.s[1];
    const beam = ctx.createLinearGradient(0, y - S * 2.6, 0, y);
    beam.addColorStop(0, 'rgba(255,240,200,0)'); beam.addColorStop(1, 'rgba(255,240,200,' + (0.34 + 0.16 * p) + ')');
    ctx.fillStyle = beam;
    ctx.beginPath(); ctx.moveTo(x - S * 0.34, y); ctx.lineTo(x - S * 0.12, y - S * 2.6); ctx.lineTo(x + S * 0.12, y - S * 2.6); ctx.lineTo(x + S * 0.34, y); ctx.closePath(); ctx.fill();
    const rg = ctx.createRadialGradient(x, y, 0, x, y, S * 0.8);
    rg.addColorStop(0, 'rgba(255,255,255,' + (0.8 + 0.2 * p) + ')'); rg.addColorStop(0.45, 'rgba(255,214,150,.45)'); rg.addColorStop(1, 'rgba(255,200,150,0)');
    ctx.fillStyle = rg; ctx.beginPath(); ctx.ellipse(x, y, S * 0.8, S * 0.42, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.6 + 0.3 * p) + ')'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y, S * (0.42 + 0.06 * p), S * (0.22 + 0.03 * p), 0, 0, TAU); ctx.stroke();
    if (G.hint && G.hint.type === 'goal') {
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.4 + 0.5 * p) + ')'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(x, y, S * (0.7 + 0.2 * p), S * (0.37 + 0.1 * p), 0, 0, TAU); ctx.stroke();
    }
    for (let i = 0; i < 4; i++) {
      const t = ((time * 0.5 + i / 4) % 1);
      ctx.fillStyle = 'rgba(255,255,255,' + (1 - t) * 0.9 + ')';
      ctx.beginPath(); ctx.arc(x + Math.sin(i * 2.1 + time) * S * 0.25, y - t * S * 1.8, 1.6, 0, TAU); ctx.fill();
    }
  }

  function drawHandle(h, hi, a, time) {
    const S = cam.s, x = a[0], y = a[1];
    const col = h.type === 'rot' ? ['#f8d27c', '#d99a2b'] : ['#8fe3dc', '#2f9d95'];
    ctx.fillStyle = 'rgba(58,47,107,.28)';
    ctx.beginPath(); ctx.ellipse(x, y, S * 0.3, S * 0.15, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = col[1]; ctx.lineWidth = S * 0.11; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y - S * 0.02); ctx.lineTo(x, y - S * 0.46); ctx.stroke();
    const cy = y - S * 0.62, spin = G.hv[hi].a * Math.PI / 180;
    const hinted = G.hint && G.hint.hi === hi && (G.hint.type === 'crank' || G.hint.type === 'stand');
    const tutorial = G.i < 2 && !G.moves && !G.tween;
    const idle = hinted || tutorial ? 0.5 + 0.5 * Math.sin(time * 3.2) : 0;
    if (idle) {
      ctx.strokeStyle = 'rgba(255,255,255,' + (0.35 + 0.4 * idle) + ')'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, cy, S * (0.34 + 0.1 * idle), 0, TAU); ctx.stroke();
    }
    ctx.strokeStyle = col[0]; ctx.lineWidth = S * 0.08;
    if (h.type === 'rot') {
      ctx.beginPath(); ctx.arc(x, cy, S * 0.2, 0, TAU); ctx.stroke();
      ctx.lineWidth = S * 0.06;
      for (let i = 0; i < 3; i++) {
        const t = spin + i * TAU / 3;
        ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x + Math.cos(t) * S * 0.2, cy + Math.sin(t) * S * 0.2); ctx.stroke();
      }
    } else {
      const q = S * 0.19;
      ctx.beginPath(); ctx.rect(x - q, cy - q, q * 2, q * 2); ctx.stroke();
      ctx.fillStyle = col[0];
      const o = Math.sin(spin * 2) * S * 0.07;
      ctx.beginPath(); ctx.moveTo(x - q * 0.5 + o, cy); ctx.lineTo(x + o, cy - q * 0.5); ctx.lineTo(x + o, cy + q * 0.5); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x + q * 0.5 + o, cy); ctx.lineTo(x + o, cy - q * 0.5); ctx.lineTo(x + o, cy + q * 0.5); ctx.closePath(); ctx.fill();
    }
    G.handleHit.push({ hi, x, y: cy, r: Math.max(26, S * 0.62) });
  }

  function drawPlayer(x, y, time, walking, hop) {
    const S = cam.s;
    const bob = walking ? Math.abs(Math.sin(time * 14)) * 0.1 * S : Math.sin(time * 2.4) * 0.012 * S;
    const lift = bob + hop;
    const sx = G.shake > 0 ? Math.sin(G.shake * 60) * 3 : 0;
    ctx.save(); ctx.translate(x + sx, y);
    ctx.fillStyle = 'rgba(40,25,70,.3)';
    ctx.beginPath(); ctx.ellipse(0, 0, S * 0.25, S * 0.12, 0, 0, TAU); ctx.fill();
    ctx.translate(0, -lift);
    const g = ctx.createLinearGradient(0, -S * 0.7, 0, 0);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#cfc4f5');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-S * 0.27, -S * 0.03);
    ctx.quadraticCurveTo(-S * 0.2, -S * 0.5, -S * 0.07, -S * 0.66);
    ctx.lineTo(S * 0.07, -S * 0.66);
    ctx.quadraticCurveTo(S * 0.2, -S * 0.5, S * 0.27, -S * 0.03);
    ctx.quadraticCurveTo(0, S * 0.05, -S * 0.27, -S * 0.03);
    ctx.fill();
    ctx.fillStyle = '#ffe3d1';
    ctx.beginPath(); ctx.arc(0, -S * 0.76, S * 0.12, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ff7f9f';
    ctx.beginPath(); ctx.moveTo(-S * 0.17, -S * 0.8); ctx.lineTo(S * 0.17, -S * 0.8); ctx.lineTo(S * 0.05, -S * 1.2); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.ellipse(0, -S * 0.8, S * 0.22, S * 0.05, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function render(time) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    drawBackground(time);
    cam.bob = Math.sin(time * 0.9) * 2.5;
    const lv = G.lv;
    const tfs = lv.pieces.map(p => tfOf(p, G.vis[p.id]));
    G.hit = []; G.handleHit = [];
    const items = [];

    lv.flat.forEach((f, idx) => {
      const tf = tfs[f.pi], rgb = hex(f.b.color || lv.pieces[f.pi].color);
      blockBoxes(f.b).forEach(bx => {
        const c = tf.f((bx.x0 + bx.x1) / 2, (bx.y0 + bx.y1) / 2, (bx.z0 + bx.z1) / 2);
        items.push({ key: c[0] + c[1] + c[2], draw: () => drawBox(bx, tf, rgb, { idx }) });
      });
    });

    const ga = anchorOf(lv.goal, tfs);
    items.push({ key: ga.key + 0.05, draw: () => drawGoal(ga, time) });

    lv.handles.forEach((h, hi) => {
      if (h.plateOnly) return;
      const w = tfs[h.host].f(h.at[0] + 0.5, h.at[1] + 0.5, h.at[2] + 1);
      items.push({ key: w[0] + w[1] + w[2] + 0.3, draw: () => drawHandle(h, hi, proj(w[0], w[1], w[2]), time) });
    });

    // player, possibly between two tiles
    let px, py, pkey, walking = false;
    if (G.walk) {
      const w = G.walk, a = anchorOf(w.path[w.i], tfs), b = anchorOf(w.path[w.i + 1], tfs), e = w.t;
      px = a.s[0] + (b.s[0] - a.s[0]) * e; py = a.s[1] + (b.s[1] - a.s[1]) * e;
      pkey = (e < 0.5 ? a.key : b.key) + 0.1; walking = true;
    } else {
      const a = anchorOf(G.player, tfs);
      px = a.s[0]; py = a.s[1]; pkey = a.key + 0.1;
    }
    const hop = G.won ? Math.abs(Math.sin(G.winT * 6)) * 0.35 * cam.s * Math.max(0, 1 - G.winT / 1.3) : 0;
    items.push({ key: pkey, draw: () => drawPlayer(px, py, time, walking, hop) });

    if (G.hint && G.hint.type === 'stand') {
      const a = anchorOf(G.hint.idx, tfs), pulse = 0.5 + 0.5 * Math.sin(time * 4);
      items.push({ key: a.key + 0.06, draw: () => {
        ctx.strokeStyle = 'rgba(255,214,120,' + (0.6 + 0.4 * pulse) + ')'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(a.s[0], a.s[1], cam.s * (0.4 + 0.1 * pulse), cam.s * (0.21 + 0.05 * pulse), 0, 0, TAU); ctx.stroke();
      } });
    }

    items.sort((a, b) => a.key - b.key);
    // blocks rise into place, back to front
    const k0 = items[0].key, kr = Math.max(1, items[items.length - 1].key - k0);
    items.forEach(it => {
      const e = ease(Math.max(0, Math.min(1, G.intro * 1.5 - ((it.key - k0) / kr) * 0.5)));
      if (e < 1) { ctx.save(); ctx.globalAlpha = e; ctx.translate(0, (1 - e) * cam.s * 2.2); it.draw(); ctx.restore(); }
      else it.draw();
    });

    G.ripples.forEach(r => {
      const t = r.age / 1.2;
      for (let k = 0; k < 2; k++) {
        const tt = Math.max(0, t - k * 0.18);
        if (tt <= 0) continue;
        ctx.strokeStyle = 'rgba(214,190,255,' + (1 - tt) * 0.9 + ')'; ctx.lineWidth = 3 - k;
        ctx.beginPath(); ctx.ellipse(r.x, r.y, cam.s * (0.2 + tt * 1.5), cam.s * (0.1 + tt * 0.75), 0, 0, TAU); ctx.stroke();
      }
    });
    G.puffs.forEach(p => {
      const t = p.age / p.life;
      ctx.fillStyle = 'rgba(255,255,255,' + (1 - t) * 0.5 + ')';
      ctx.beginPath(); ctx.ellipse(p.x, p.y, cam.s * (0.1 + t * 0.22), cam.s * (0.05 + t * 0.11), 0, 0, TAU); ctx.fill();
    });

    if (G.tap) {
      const t = G.tap.t / 0.7;
      ctx.strokeStyle = 'rgba(255,255,255,' + (1 - t) * 0.9 + ')'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(G.tap.x, G.tap.y, cam.s * (0.15 + t * 0.5), cam.s * (0.08 + t * 0.25), 0, 0, TAU); ctx.stroke();
    }
    G.sparks.forEach(p => {
      ctx.fillStyle = 'hsla(' + p.hue + ',100%,78%,' + Math.max(0, 1 - p.age / p.life) + ')';
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.4, 0, TAU); ctx.fill();
    });
  }

  // ---------- input ----------
  function pointIn(pts, x, y) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const xi = pts[i][0], yi = pts[i][1], xj = pts[j][0], yj = pts[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  function onTap(x, y) {
    if (!G || !G.active || G.won || G.tween || G.intro < 1) return;
    const walking = !!G.walk;
    let face = null;
    for (let i = G.hit.length - 1; i >= 0; i--) {
      if (pointIn(G.hit[i].pts, x, y)) { face = G.hit[i]; break; }
    }
    if (!walking) {
      // A tap on the knob always turns the crank; in the wider ring around it a walkable tile wins.
      const near = Math.max(18, cam.s * 0.45), far = Math.max(26, cam.s * 0.62);
      let pick = null, best = Infinity;
      for (const h of G.handleHit) {
        const d = Math.hypot(x - h.x, y - h.y);
        if (d < best && (d <= near || (d <= far && !(face && face.walk)))) { best = d; pick = h; }
      }
      if (pick) { activate(pick.hi); return; }
    }
    const target = face && face.walk ? face.idx : -1;
    const origin = walking ? G.walk.path[G.walk.i + 1] : G.player;
    if (target < 0 || target === origin) return;
    const path = L.findPath(G.adj, origin, target);
    const a = anchorOf(target, G.lv.pieces.map(p => tfOf(p, G.vis[p.id])));
    G.tap = { x: a.s[0], y: a.s[1], t: 0 };
    if (!path) { G.shake = 0.3; sfx.nope(); return; }
    sfx.tap();
    G.hint = null;
    if (walking) { G.walk.path = [G.walk.path[G.walk.i]].concat(path); G.walk.i = 0; }
    else startWalk(path);
  }

  function doHint() {
    if (!G || !G.active || G.won || G.tween || G.walk) return;
    const text = $('hint');
    text.classList.remove('dim');
    clearTimeout(fadeHint.t);
    const sol = L.solve(G.lv, G.st, G.player, 20);
    if (!sol) { G.hint = null; text.textContent = 'This corner is stuck. Try restarting the level.'; return; }
    if (sol.taps === 0) {
      G.hint = { type: 'goal' }; text.textContent = 'The way is open. Walk to the glow.';
    } else {
      const s = sol.seq[0];
      if (s.plate) {
        G.hint = { type: 'stand', idx: s.at, hi: -1 };
        text.textContent = s.at === G.player ? 'Step off the glowing plate and back on.' : 'Walk onto the glowing plate.';
      } else if (s.at !== G.player && L.findPath(G.adj, G.player, s.at)) {
        G.hint = { type: 'stand', idx: s.at, hi: s.hi }; text.textContent = 'Stand on the marked tile, then use the pulsing crank.';
      } else {
        G.hint = { type: 'crank', hi: s.hi }; text.textContent = 'Try the pulsing crank.';
      }
    }
    G.hintT = 7;
    fadeHint.t = setTimeout(() => text.classList.add('dim'), 7000);
    sfx.tap();
  }

  canvas.addEventListener('pointerdown', e => {
    audio();
    onTap(e.clientX, e.clientY);
  });

  // ---------- screens ----------
  function show(id, on) { $(id).classList.toggle('show', on); }

  function buildLevelGrid() {
    const box = $('levels');
    box.innerHTML = '';
    LEVELS.forEach((lv, i) => {
      const b = document.createElement('button');
      b.textContent = i + 1;
      b.disabled = i >= prog.unlocked;
      if (prog.best[i] && prog.best[i] <= parOf(lv)) b.classList.add('star');
      b.setAttribute('aria-label', 'Level ' + (i + 1) + ': ' + lv.name);
      b.addEventListener('click', () => play(i));
      box.appendChild(b);
    });
    $('bPlay').textContent = prog.unlocked > 1 ? 'Continue' : 'Play';
  }

  function play(i) {
    audio();
    loadLevel(i);
    G.active = true;
    show('menu', false); show('win', false);
    fadeHint();
  }

  function showWin() {
    G.winShown = true;
    const last = G.i === LEVELS.length - 1;
    $('winTitle').textContent = last ? 'The spire is quiet' : 'Door opened';
    $('winText').textContent = last
      ? 'You reached the top of the Echo Spire. Thank you for wandering.'
      : 'Solved in ' + G.moves + (G.moves === 1 ? ' turn.' : ' turns.');
    $('winStar').textContent = G.moves <= G.par ? '\u2605 Perfect: the fewest turns possible' : 'Fewest possible: ' + G.par;
    $('bNext').textContent = last ? 'Back to menu' : 'Next level';
    show('win', true);
  }

  $('bPlay').addEventListener('click', () => play(Math.min(prog.unlocked, LEVELS.length) - 1));
  $('bHint').addEventListener('click', doHint);
  $('bRestart').addEventListener('click', () => { if (G && G.active) play(G.i); });
  $('bMenu').addEventListener('click', () => { if (G) G.active = false; buildLevelGrid(); show('menu', true); });
  $('bAgain').addEventListener('click', () => play(G.i));
  $('bNext').addEventListener('click', () => {
    if (G.i === LEVELS.length - 1) { G.active = false; show('win', false); show('menu', true); }
    else play(G.i + 1);
  });
  function syncSound() { $('bSound').style.opacity = prog.muted ? 0.45 : 1; }
  $('bSound').addEventListener('click', () => { prog.muted = !prog.muted; saveProg(); syncSound(); audio(); });

  window.addEventListener('keydown', e => {
    if (e.key === 'r' || e.key === 'R') { if (G && G.active) play(G.i); }
    else if (e.key === 'h' || e.key === 'H') doHint();
    else if (e.key === 'm' || e.key === 'M') $('bSound').click();
    else if (e.key === 'Escape') $('bMenu').click();
  });

  // ---------- main loop ----------
  let last = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (ts - last) / 1000 || 0);
    last = ts;
    update(dt);
    render(ts / 1000);
  }

  resize();
  syncSound();
  buildLevelGrid();
  loadLevel(Math.min(prog.unlocked, LEVELS.length) - 1);
  requestAnimationFrame(frame);

  // test hook for the screenshot/solver harness
  window.__echo = { play, get G() { return G; }, activate, onTap, doHint, LEVELS, L };
})();
