/* ONE MORE THING — a tiny burglar, a sleeping giant, and a haul that really is attached to you. */
(function () {
  'use strict';
  const { Engine, Bodies, Body, Composite, Constraint, Events } = Matter;
  const Art = window.Art, Snd = window.Snd;

  /* ============================================================ constants */
  const W = 2500, H = 1000, FLOOR = 900;
  const STEP = 1 / 60, DT = 1000 / 60, DT2 = DT * DT;
  const PAD = { x: 70, y: 790, w: 270, h: 110 };
  const HOLE = { x: 30, y: 862 };
  const GOAL = 700, STARS = [700, 1100, 1450];
  const REACH = 205, MAX_ARM = 345, PR = 22, ESCAPE_TIME = 11;
  const REEL = 135;
  const OUT = Art.INK;
  const TAU = Math.PI * 2;
  const CAT_WORLD = 1, CAT_PLAYER = 2, CAT_LOOT = 4;

  // [x, y, w, h]   thin platforms you can jump / climb up through
  const ONEWAY = [
    [380, 840, 100, 16], [560, 770, 320, 20],
    [920, 750, 80, 18], [1000, 800, 260, 22], [1260, 750, 80, 18], [930, 690, 400, 16],
    [1010, 470, 280, 16], [1480, 700, 320, 24],
    [1984, 760, 372, 14], [1984, 610, 372, 14], [1984, 460, 372, 14], [1984, 310, 372, 14], [1950, 200, 440, 16]
  ];

  const MATS = {
    gold:    { mul: 0.45, snd: 'tink',    words: ['tink', 'ting', 'clink'] },
    metal:   { mul: 2.4,  snd: 'clang',   words: ['CLANG!', 'DONG!', 'CLANG!'] },
    ceramic: { mul: 1.6,  snd: 'ceramic', words: ['clink', 'SMASH!', 'CRASH!'] },
    plastic: { mul: 1.1,  snd: 'thud',    words: ['thunk', 'THUD', 'KA-BOOM'] },
    rubber:  { mul: 0.7,  snd: 'boing',   words: ['boing', 'bonk', 'BOING!'] },
    me:      { mul: 0.3,  snd: 'thud',    words: ['oof', 'oof!', 'OOF!'] }
  };

  // ------------------------------------------------------------ loot
  // x,y are the centre of the item when it is created resting on its furniture.
  const DEFS = [
    { id: 'necklace', name: 'Necklace', value: 60, x: 430, y: 829, mat: 'gold', hitR: 22, rest: 78, stiff: 0.035, damp: 0.0, attach: { x: 0, y: -4 },
      tip: 'Light, but it SWINGS.',
      build: (x, y) => Bodies.circle(x, y, 9, { density: 0.0006, restitution: 0.25, friction: 0.2, frictionAir: 0.004 }) },
    { id: 'watch', name: 'Pocket watch', value: 70, x: 700, y: 759, mat: 'gold', hitR: 20, rest: 48, stiff: 0.12, damp: 0.02, attach: { x: 0, y: -6 },
      build: (x, y) => Bodies.circle(x, y, 10, { density: 0.0016, restitution: 0.2, friction: 0.3, frictionAir: 0.004 }) },
    { id: 'ball', name: 'Bouncy ball', value: 40, x: 560, y: 880, mat: 'rubber', hitR: 24, rest: 56, stiff: 0.09, damp: 0.01, attach: { x: 0, y: 0 },
      build: (x, y) => Bodies.circle(x, y, 19, { density: 0.0009, restitution: 0.86, friction: 0.04, frictionAir: 0.001 }) },
    { id: 'teapot', name: 'Teapot', value: 110, x: 1130, y: 782, mat: 'ceramic', hitR: 30, rest: 54, stiff: 0.14, damp: 0.03, attach: { x: 0, y: -15 },
      build: (x, y) => Bodies.rectangle(x, y, 44, 32, { chamfer: { radius: 10 }, density: 0.0018, restitution: 0.1, friction: 0.5, frictionAir: 0.004 }) },
    { id: 'candle', name: 'Candlestick', value: 90, x: 1240, y: 440, mat: 'metal', nm: 1.3, hitR: 32, rest: 56, stiff: 0.13, damp: 0.03, attach: { x: 0, y: -28 },
      build: (x, y) => Bodies.rectangle(x, y, 16, 58, { chamfer: { radius: 4 }, density: 0.0022, restitution: 0.1, friction: 0.4, frictionAir: 0.004 }) },
    { id: 'pan', name: 'Frying pan', value: 150, x: 1085, y: 444, mat: 'metal', nm: 1.0, hitR: 34, rest: 66, stiff: 0.15, damp: 0.03, attach: { x: 56, y: 0 }, tip: 'Valuable. LOUD.',
      build: (x, y) => {
        const d = Bodies.circle(x, y, 25, { density: 0.0018 }), h = Bodies.rectangle(x + 43, y, 46, 8, { density: 0.0018 });
        return Body.create({ parts: [d, h], restitution: 0.1, friction: 0.4, frictionAir: 0.004 });
      } },
    { id: 'tv', name: 'Television', value: 300, x: 1640, y: 659, mat: 'plastic', nm: 1.2, hitR: 62, rest: 76, stiff: 0.2, damp: 0.04, attach: { x: 0, y: -40 }, tip: 'Heavy. Very heavy.',
      build: (x, y) => Bodies.rectangle(x, y, 118, 80, { chamfer: { radius: 8 }, density: 0.0008, restitution: 0.05, friction: 0.3, frictionAir: 0.004 }) },
    { id: 'vacuum', name: 'Vacuum cleaner', value: 200, x: 1850, y: 875, mat: 'plastic', nm: 1.0, hitR: 52, rest: 74, stiff: 0.17, damp: 0.04, attach: { x: 0, y: -23 }, tip: 'It has opinions.',
      build: (x, y) => Bodies.rectangle(x, y, 92, 46, { chamfer: { radius: 12 }, density: 0.0012, restitution: 0.05, friction: 0.3, frictionAir: 0.004 }) },
    { id: 'trophy', name: 'Trophy', value: 180, x: 2200, y: 440, mat: 'metal', nm: 1.2, hitR: 32, rest: 62, stiff: 0.14, damp: 0.03, attach: { x: 0, y: -22 },
      build: (x, y) => {
        const cup = Bodies.rectangle(x, y - 8, 36, 30, { density: 0.002 }), base = Bodies.rectangle(x, y + 13, 30, 12, { density: 0.002 });
        return Body.create({ parts: [cup, base], restitution: 0.1, friction: 0.4, frictionAir: 0.004 });
      } },
    { id: 'ring', name: 'Diamond ring', value: 250, x: 2170, y: 188, mat: 'gold', nm: 0.8, hitR: 22, rest: 50, stiff: 0.08, damp: 0.02, attach: { x: 0, y: -6 },
      build: (x, y) => Bodies.circle(x, y, 11, { density: 0.0014, restitution: 0.3, friction: 0.3, frictionAir: 0.004 }) }
  ];
  const TOTAL_VALUE = DEFS.reduce((s, d) => s + d.value, 0);

  const QUIPS_ESCAPE = ['Back in the hole. The giant will blame the cat.', 'Smooth. Mostly. A little bit smooth.', 'Tiny thief, giant haul.'];
  const QUIPS_CAUGHT = ['Flat as a pancake. A very small pancake.', 'He never even noticed. That is the worst part.', 'You could have dropped the TV.'];

  /* ============================================================ canvas / sizing */
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d', { alpha: false });
  const lightCv = document.createElement('canvas');
  const lctx = lightCv.getContext('2d');
  let cw = 800, ch = 450, dpr = 1;
  function resize() {
    const iw = window.innerWidth || 800, ih = window.innerHeight || 450;
    let w = iw, h = ih;
    if (w / h > 2) w = h * 2; // never wider than 2:1
    cw = Math.max(200, Math.floor(w)); ch = Math.max(200, Math.floor(h));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(cw * dpr); canvas.height = Math.floor(ch * dpr);
    canvas.style.width = cw + 'px'; canvas.style.height = ch + 'px';
    lightCv.width = canvas.width; lightCv.height = canvas.height;
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));
  resize();

  /* ============================================================ platform (Bridge) */
  const P = { bridge: false, audioOn: true, paused: false, hidden: false, best: 0, runs: 0, userMute: false, ready: false };
  function hasBridge() { return typeof window.bridge !== 'undefined' && window.bridge && P.bridge; }
  function syncAudio() {
    Snd.setMuted(P.userMute || !P.audioOn || P.hidden);
  }
  function platformInit() {
    return new Promise(resolve => {
      let done = false;
      const fin = () => { if (!done) { done = true; resolve(); } };
      setTimeout(fin, 2500); // never block the game on the SDK
      if (typeof window.bridge === 'undefined') { fin(); return; }
      try {
        window.bridge.initialize().then(() => {
          P.bridge = true;
          try { P.audioOn = window.bridge.platform.isAudioEnabled !== false; } catch (e) {}
          try {
            window.bridge.platform.on(window.bridge.EVENT_NAME.AUDIO_STATE_CHANGED, on => { P.audioOn = !!on; syncAudio(); });
            window.bridge.platform.on(window.bridge.EVENT_NAME.PAUSE_STATE_CHANGED, p => { P.paused = !!p; Snd.suspend(P.paused); });
          } catch (e) {}
          try { window.bridge.advertisement.setMinimumDelayBetweenInterstitial(60); } catch (e) {}
          return window.bridge.storage.get(['omt_best', 'omt_runs']).then(d => {
            P.best = parseInt(d && d[0], 10) || 0; P.runs = parseInt(d && d[1], 10) || 0;
          }).catch(() => {});
        }).catch(() => {}).then(fin);
      } catch (e) { fin(); }
    });
  }
  function saveProgress() {
    try { if (hasBridge()) window.bridge.storage.set(['omt_best', 'omt_runs'], [String(P.best), String(P.runs)]).catch(() => {}); } catch (e) {}
  }
  function platMsg(m, data) { try { if (hasBridge()) window.bridge.platform.sendMessage(m, data); } catch (e) {} }
  const GAME_VERSION = '1.4.0';
  const Tele = {
    send(name, data) { try { if (hasBridge() && window.bridge.analytics) window.bridge.analytics.send(name, data); } catch (e) {} },
    frames: [], windowStart: 0, active: 0, jsErr: 0,
    reset() { this.frames = []; this.windowStart = performance.now(); this.active = 0; this.jsErr = 0; },
    frame(ms, now) {
      if (!this.windowStart) this.windowStart = now;
      this.frames.push(ms); this.active += ms;
      if (now - this.windowStart >= 30000 && this.frames.length > 30) this.flush(now);
    },
    flush(now) {
      const f = this.frames.slice().sort((a, b) => a - b), n = f.length;
      const q = (p) => f[Math.min(n - 1, Math.floor(p * n))];
      const over = (t) => { let c = 0; for (let i = 0; i < n; i++) if (f[i] > t) c++; return c; };
      const sum = f.reduce((a, b) => a + b, 0);
      const r1 = (v) => Math.round(v * 10) / 10;
      this.send('performance_sample', {
        target_fps: 60, window_ms: Math.round(now - this.windowStart), active_ms: Math.round(this.active), frame_count: n,
        fps_avg: r1(1000 / (sum / n)), fps_p10: r1(1000 / q(0.9)), frame_time_p50_ms: r1(q(0.5)), frame_time_p95_ms: r1(q(0.95)),
        frame_time_p99_ms: r1(q(0.99)), frame_time_max_ms: r1(f[n - 1]), frames_over_50ms: over(50), frames_over_100ms: over(100),
        frames_over_250ms: over(250), frames_over_500ms: over(500), frames_over_1000ms: over(1000),
        game_version: GAME_VERSION, js_error_count: this.jsErr
      });
      this.frames = []; this.active = 0; this.windowStart = now; this.jsErr = 0;
    }
  };
  window.addEventListener('error', () => { Tele.jsErr++; });
  function showInterstitial() {
    try { if (hasBridge() && window.bridge.advertisement.isInterstitialSupported) window.bridge.advertisement.showInterstitial('run_finished'); } catch (e) {}
  }
  document.addEventListener('visibilitychange', () => { P.hidden = document.hidden; Snd.suspend(P.hidden); syncAudio(); if (P.hidden) clearInput(); });
  window.addEventListener('blur', clearInput);

  /* ============================================================ helpers */
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const rand = (a, b) => a + Math.random() * (b - a);
  function localToWorld(b, p) { const c = Math.cos(b.angle), s = Math.sin(b.angle); return { x: b.position.x + p.x * c - p.y * s, y: b.position.y + p.x * s + p.y * c }; }
  function worldToLocal(b, p) { const dx = p.x - b.position.x, dy = p.y - b.position.y, c = Math.cos(-b.angle), s = Math.sin(-b.angle); return { x: dx * c - dy * s, y: dx * s + dy * c }; }
  function nearestOnRect(r, x, y) { return { x: clamp(x, r.min.x, r.max.x), y: clamp(y, r.min.y, r.max.y) }; }
  function inPad(p) { return p.x >= PAD.x && p.x <= PAD.x + PAD.w && p.y >= PAD.y && p.y <= FLOOR + 6; }
  function setMask(body, mask) { for (const p of body.parts) p.collisionFilter.mask = mask; }
  function setCat(body, cat) { for (const p of body.parts) p.collisionFilter.category = cat; }

  /* ============================================================ game state */
  let engine, player, items, owBodies, grabbables, hauled, banking;
  let G, hands, popups, parts, toastQ;
  const cam = { x: 250, y: 700, s: 1 };
  const input = { left: false, right: false };
  const mouse = { sx: 400, sy: 200, has: false };
  let touchMode = false;

  function newRun() {
    if (items) for (const it of items) if (it.vac && it.vac.snd) Snd.whirrStop(it.vac.snd);
    engine = Engine.create({ positionIterations: 8, velocityIterations: 6, constraintIterations: 4, enableSleeping: false });
    engine.gravity.y = 1;
    owBodies = []; grabbables = []; items = []; hauled = []; banking = []; popups = []; parts = []; toastQ = [];
    G = {
      t: 0, time: 0, state: 'play', noise: 0, noiseDisp: 0, stage: 0, banked: 0, bankedCount: 0, over: null, overT: 0,
      escapeLeft: ESCAPE_TIME, leaving: false, leaveT: 0, groundT: 0, jumpBuf: 0, landSq: 0, grin: 0, shake: 0, wasGround: false,
      sqS: 0, saS: 0, blink: 3, walk: 0, caughtT: 0, flags: {}, hint: 14, toast: null, stepT: 0, hbT: 0, flash: 0, goalHit: false,
      lastGreed: '', carriedPeak: 0, giant: null, crushed: false, rumble: 0, punch: 0, cracks: [], rings: [], hitstop: 0, slowT: 0, lampDip: 0, bankBump: 0, bankDisp: 0, stepPh: 0
    };
    Art.cracksList = G.cracks; Art.rumble = 0; Snd.rumble(false);
    buildWorld();
    hands = [mkHand(), mkHand()];
    toast('Steal what you can carry. Don\'t wake the giant.', 5);
    platMsg('level_started');
  }
  function mkHand() { return { on: false, pid: null, sx: 0, sy: 0, con: null, kind: null, it: null, anchor: null, held: 0, miss: false, side: 1, flash: 0 }; }

  function buildWorld() {
    const world = engine.world;
    const add = (b) => Composite.add(world, b);
    const stat = (x, y, w, h, cat, label) => {
      const b = Bodies.rectangle(x + w / 2, y + h / 2, w, h, { isStatic: true, friction: 0.4, label: label || 'static', collisionFilter: { category: cat, mask: 0xFFFFFFFF } });
      add(b); return b;
    };
    stat(-300, FLOOR, W + 600, 300, CAT_WORLD, 'floor');
    stat(-300, -400, W + 600, 400, CAT_WORLD, 'ceiling');
    grabbables.push(stat(-300, -400, 300, H + 800, CAT_WORLD, 'wall'));
    grabbables.push(stat(W, -400, 300, H + 800, CAT_WORLD, 'wall'));
    ONEWAY.forEach((r, i) => {
      const b = stat(r[0], r[1], r[2], r[3], 1 << (3 + i), 'oneway');
      b.owCat = 1 << (3 + i); owBodies.push(b); grabbables.push(b);
    });

    player = Bodies.circle(250, FLOOR - PR - 1, PR, {
      density: 0.002, friction: 0, frictionStatic: 0, frictionAir: 0.012, restitution: 0.05, label: 'player',
      collisionFilter: { category: CAT_PLAYER, mask: 0xFFFFFFFF }
    });
    Body.setInertia(player, Infinity);
    add(player);

    DEFS.forEach((d, i) => {
      const body = d.build(d.x, d.y);
      const art = { x: d.x - body.position.x, y: d.y - body.position.y };
      setCat(body, CAT_LOOT);
      body.label = 'loot';
      const it = {
        def: d, id: d.id, name: d.name, value: d.value, body, art, seed: i * 7.31,
        attach: { x: art.x + d.attach.x, y: art.y + d.attach.y }, hitR: d.hitR, rest: d.rest, stiff: d.stiff, damp: d.damp,
        state: 'loose', con: null, padT: 0, spawn: { x: d.x, y: d.y }, hauledAt: 0, vac: d.id === 'vacuum' ? { timer: 2, on: false, warn: 0, left: 0, dir: 1, snd: null } : null
      };
      body.item = it;
      items.push(it); add(body);
    });
    Events.on(engine, 'collisionStart', e => { for (const pr of e.pairs) { onContact(pr); onImpact(pr); } });
    Events.on(engine, 'collisionActive', e => { for (const pr of e.pairs) onContact(pr); });
    refreshMasks();
  }

  /* ============================================================ contacts / noise */
  function onContact(pair) {
    const a = pair.bodyA, b = pair.bodyB;
    if (a.parent !== player && b.parent !== player) return;
    const sup = pair.collision.supports;
    for (let i = 0; i < sup.length; i++) { const s = sup[i]; if (s && s.y > player.position.y + 8) { G.groundT = 0.1; return; } }
  }

  const pairCool = new Map();
  function onImpact(pair) {
    if (G.state === 'over' || G.over) return;
    const a = pair.bodyA.parent, b = pair.bodyB.parent;
    if (a.isStatic && b.isStatic) return;
    const ia = a.item, ib = b.item;
    if ((ia && ia.state !== 'loose' && ia.state !== 'hauled') || (ib && ib.state !== 'loose' && ib.state !== 'hauled')) return;
    const key = a.id < b.id ? a.id + '_' + b.id : b.id + '_' + a.id;
    const last = pairCool.get(key); if (last !== undefined && G.time - last < 0.14) return;
    pairCool.set(key, G.time);
    const rv = Math.hypot(a.velocity.x - b.velocity.x, a.velocity.y - b.velocity.y) * 60;
    let m = a.isStatic ? b.mass : b.isStatic ? a.mass : (a.mass * b.mass) / (a.mass + b.mass);
    let mat = null;
    for (const it of [ia, ib]) if (it) { const mt = MATS[it.def.mat]; const mm = mt.mul * (it.def.nm || 1); if (!mat || mm > mat.m) mat = { m: mm, name: it.def.mat }; }
    if (!mat) mat = { m: MATS.me.mul, name: 'me' };
    const sup = pair.collision.supports[0];
    const pos = sup ? { x: sup.x, y: sup.y } : { x: (a.position.x + b.position.x) / 2, y: (a.position.y + b.position.y) / 2 };
    const raw = Math.max(0, rv - 120) * Math.sqrt(m) * mat.m * 0.01;
    // a quiet tick for tiny bumps so the world still feels tactile
    if (raw <= 0) { if (rv > 150) Snd.impact(MATS[mat.name].snd, 0.12); return; }
    let n = Math.min(24, raw);
    if (inPad(pos)) n *= 0.25; // the doormat muffles things
    const mt = MATS[mat.name];
    Snd.impact(mt.snd, n / 9);
    if (n >= 1.1) {
      popWord(pos.x, pos.y - 14, mt.words[n > 9 ? 2 : n > 4 ? 1 : 0], n > 9 ? 1.5 : n > 4 ? 1.15 : 0.85);
      sparks(pos.x, pos.y, Math.min(10, 2 + n | 0), mat.name === 'metal' ? '#ffe9a0' : '#fff');
    }
    if (G.state === 'play' && G.time > 1.2) addNoise(n);
    G.shake = Math.max(G.shake, Math.min(10, n * 0.7));
  }
  function addNoise(n) {
    G.noise = Math.min(100, G.noise + n);
    if (G.noise >= 100 && G.state === 'play') wakeGiant();
  }
  function wakeGiant() {
    G.state = 'awake'; G.escapeLeft = ESCAPE_TIME; G.shake = 14; G.flash = 1; G.rumble = 1; G.hbT = 0;
    initGiant(); Snd.rumble(true);
    Snd.wake(); G.stepT = 0.2;
    Tele.send('giant_woke', { banked: G.banked, carrying: haulValue(), items_hauled: hauled.length, time_sec: Math.round(G.time) });
    toast('HE\'S UP! Run home. Dodge the feet, and drop loot to run faster!', 6, 'alarm');
    for (const it of items) if (it.vac && it.vac.on) stopVac(it);
  }

  /* ============================================================ loot handling */
  function attach(it) {
    if (it.state !== 'loose') return;
    it.state = 'hauled'; it.hauledAt = G.time;
    const con = Constraint.create({ bodyA: player, pointA: { x: 0, y: 8 }, bodyB: it.body, pointB: it.attach, length: it.rest, stiffness: it.stiff, damping: it.damp });
    it.con = con; Composite.add(engine.world, con); hauled.push(it);
    // kill any hand holding it
    for (const h of hands) if (h.on && h.it === it) endHand(h, true);
    Snd.snap();
    const p = it.body.position;
    sparks(p.x, p.y, 8, '#c9a2ff');
    popWord(p.x, p.y - 24, '+$' + it.value, 0.9, '#ffe27a');
    G.grin = 1.2;
    if (!G.flags.firstStash) { G.flags.firstStash = 1; toast('Stuck on you! Walk it home to the mat on the left to bank it.', 5); }
    else if (hauled.length === 3 && !G.flags.greedy) { G.flags.greedy = 1; toast('Three things already... Greedy, aren\'t we?', 3.5); }
    else if (hauled.length >= 5 && !G.flags.five) { G.flags.five = 1; toast('You\'re basically a walking yard sale.', 3.5); }
    G.carriedPeak = Math.max(G.carriedPeak, hauled.length);
  }
  function dropItem(it) {
    if (it.state !== 'hauled') return;
    it.state = 'loose'; it.padT = 0;
    if (it.con) Composite.remove(engine.world, it.con);
    it.con = null;
    hauled.splice(hauled.indexOf(it), 1);
    if (it.vac && it.vac.on) stopVac(it);
    Snd.drop();
    popWord(it.body.position.x, it.body.position.y - 24, 'drop', 0.7, '#ffd0d0');
  }
  function dropNearest(wx, wy) {
    if (!hauled.length) return;
    let best = null, bd = 1e9;
    if (wx !== undefined) for (const it of hauled) { const d = dist(it.body.position, { x: wx, y: wy }) - it.hitR; if (d < bd) { bd = d; best = it; } }
    if (!best || bd > 90) best = hauled[hauled.length - 1];
    dropItem(best);
  }
  function haulMass() { let m = 0; for (const it of hauled) m += it.body.mass; return m / player.mass; }
  function haulValue() { let v = 0; for (const it of hauled) v += it.value; return v; }

  function bankItem(it) {
    if (it.state === 'banking' || it.state === 'banked') return;
    if (it.state === 'hauled') { if (it.con) Composite.remove(engine.world, it.con); it.con = null; hauled.splice(hauled.indexOf(it), 1); }
    for (const h of hands) if (h.on && h.it === it) endHand(h, true);
    if (it.vac && it.vac.on) stopVac(it);
    it.state = 'banking';
    Composite.remove(engine.world, it.body);
    banking.push({ it, t: 0, from: { x: it.body.position.x, y: it.body.position.y }, ang: it.body.angle, art: it.art });
  }
  function finishBank(bk) {
    const it = bk.it; it.state = 'banked';
    G.banked += it.value; G.bankedCount++; G.bankBump = 1;
    Tele.send('item_banked', { item_id: it.id, value: it.value, banked_total: G.banked });
    Snd.coin(G.bankedCount % 5);
    for (let i = 0; i < 12; i++) parts.push({ x: HOLE.x + 10, y: HOLE.y - 10, vx: rand(20, 160), vy: rand(-220, -40), life: rand(0.5, 1), t: 0, col: i % 2 ? '#ffe27a' : '#fff6c4', size: rand(2, 4.5), g: 500 });
    popWord(HOLE.x + 70, HOLE.y - 50, '+$' + it.value, 1.25, '#ffe27a');
    if (!G.goalHit && G.banked >= GOAL) { G.goalHit = true; toast('Rent paid! Leave now... or grab ONE MORE THING?', 5, 'good'); }
    if (G.bankedCount >= items.length) endRun('clean');
  }

  /* ============================================================ vacuum personality */
  function startVac(it) { it.vac.on = true; it.vac.left = 1.8; it.vac.snd = Snd.whirrStart(); }
  function stopVac(it) { it.vac.on = false; it.vac.warn = 0; it.vac.timer = rand(3.4, 6); if (it.vac.snd) { Snd.whirrStop(it.vac.snd); it.vac.snd = null; } }
  function vacuumUpdate(dt) {
    for (const it of items) {
      const v = it.vac; if (!v) continue;
      const active = it.state === 'hauled' || isHeld(it);
      if (!active || G.over) { if (v.on || v.warn > 0) stopVac(it); continue; }
      if (!v.on && v.warn <= 0) { v.timer -= dt; if (v.timer <= 0) { v.warn = 0.65; v.dir = Math.random() < 0.5 ? -1 : 1; popWord(it.body.position.x, it.body.position.y - 44, 'rrr…?', 0.8, '#ffb0b0'); } }
      if (v.warn > 0) { v.warn -= dt; Body.applyForce(it.body, it.body.position, { x: (Math.random() - 0.5) * it.body.mass * 0.0007, y: 0 }); if (v.warn <= 0) startVac(it); }
      if (v.on) {
        Body.applyForce(it.body, it.body.position, { x: v.dir * it.body.mass * 0.0017, y: 0 });
        if (G.state === 'play') addNoise(3.4 * dt);
        v.left -= dt;
        if (Math.random() < 0.3) parts.push({ x: it.body.position.x - v.dir * 40, y: it.body.position.y + 20, vx: -v.dir * rand(40, 120), vy: rand(-60, -10), life: 0.5, t: 0, col: 'rgba(230,220,200,0.7)', size: rand(3, 7), g: -40 });
        if (v.left <= 0) stopVac(it);
      }
    }
  }
  function isHeld(it) { for (const h of hands) if (h.on && h.it === it) return true; return false; }

  /* ============================================================ hands (stretchy arms) */
  function toWorld(sx, sy) { return { x: (sx - cw / 2) / cam.s + cam.x, y: (sy - ch / 2) / cam.s + cam.y }; }

  function findTarget(wx, wy, tol) {
    let best = null;
    for (const it of items) {
      if (it.state !== 'loose') continue;
      const d = dist(it.body.position, { x: wx, y: wy }) - it.hitR;
      if (d < tol && (!best || d < best.d)) best = { kind: 'loot', it, d };
    }
    if (best) {
      best.p = { x: wx, y: wy };
      const dd = dist(player.position, best.it.body.position) - best.it.hitR * 0.7;
      best.inReach = dd <= REACH; return best;
    }
    for (const s of grabbables) {
      const q = nearestOnRect(s.bounds, wx, wy);
      const d = Math.hypot(q.x - wx, q.y - wy);
      if (d < tol && (!best || d < best.d)) best = { kind: 'static', s, q, d, p: q };
    }
    if (best) best.inReach = dist(player.position, best.q) <= REACH;
    return best;
  }

  function startGrab(hi, sx, sy, pid) {
    const h = hands[hi]; if (h.on) endHand(h, true);
    if (G.over || G.state === 'leaving') return;
    h.on = true; h.pid = pid; h.sx = sx; h.sy = sy; h.held = 0; h.miss = false; h.con = null; h.kind = null; h.it = null; h.flash = 0;
    tryLatch(h);
    if (!h.con) { h.miss = true; Snd.miss(); }
  }
  function tryLatch(h) {
    const w = toWorld(h.sx, h.sy);
    const t = findTarget(w.x, w.y, touchMode ? 46 : 30);
    if (!t || !t.inReach) return;
    h.miss = false;
    if (t.kind === 'loot') {
      const b = t.it.body, rel = { x: clamp(w.x - b.position.x, -t.it.hitR * 0.6, t.it.hitR * 0.6), y: clamp(w.y - b.position.y, -t.it.hitR * 0.6, t.it.hitR * 0.6) };
      const local = worldToLocal(b, { x: b.position.x + rel.x, y: b.position.y + rel.y });
      const d = dist(player.position, { x: b.position.x + rel.x, y: b.position.y + rel.y });
      h.con = Constraint.create({ bodyA: player, pointA: { x: 0, y: -4 }, bodyB: b, pointB: local, length: d, stiffness: 0.3, damping: 0.12 });
      h.kind = 'loot'; h.it = t.it; h.minLen = 28 + t.it.hitR * 0.5;
    } else {
      const d = dist(player.position, t.q);
      h.con = Constraint.create({ bodyA: player, pointA: { x: 0, y: -4 }, pointB: { x: t.q.x, y: t.q.y }, length: d, stiffness: 0.22, damping: 0.1 });
      h.kind = 'static'; h.anchor = { x: t.q.x, y: t.q.y }; h.minLen = 30; h.platform = t.s.owCat ? t.s : null;
    }
    Composite.add(engine.world, h.con);
    h.side = (h.kind === 'loot' ? h.it.body.position.x : h.anchor.x) < player.position.x ? -1 : 1;
    h.flash = 1; Snd.grab();
    const gp = handPoint(h); sparks(gp.x, gp.y, 5, '#fff');
  }
  function handPoint(h) {
    if (!h.con) return null;
    return h.kind === 'loot' ? localToWorld(h.it.body, h.con.pointB) : h.anchor;
  }
  function endHand(h, silent, reason) {
    if (h.con && h.kind) { const gp = handPoint(h); if (gp) h.ghost = { x: gp.x, y: gp.y, t: 0 }; }
    if (h.con) Composite.remove(engine.world, h.con);
    const it = h.it, kind = h.kind, held = h.held;
    h.con = null; h.on = false; h.kind = null; h.it = null; h.anchor = null; h.miss = false;
    if (kind === 'loot' && it && it.state === 'loose' && reason !== 'tear') {
      const near = dist(player.position, it.body.position) < 100 + it.hitR * 0.3;
      if (held < 0.28 || near) attach(it); else if (!silent) Snd.release();
    } else if (!silent && kind) Snd.release();
  }
  function releaseHandsByPid(pid, hi) {
    for (let i = 0; i < hands.length; i++) { const h = hands[i]; if (h.on && (h.pid === pid) && (hi === undefined || hi === i)) endHand(h, false); }
  }
  function handsUpdate(dt) {
    for (const h of hands) {
      if (!h.on) continue;
      h.held += dt; h.flash = Math.max(0, h.flash - dt * 4);
      if (!h.con) {
        // reaching for something out of range: latch as soon as it is in reach
        if (h.miss) tryLatch(h);
        continue;
      }
      const hp = handPoint(h), pp = player.position, d = dist(pp, hp);
      if (d > MAX_ARM || (h.kind === 'loot' && h.it.state !== 'loose')) { Snd.tear(); popWord(pp.x, pp.y - 36, 'pop!', 0.8, '#ffd0d0'); endHand(h, true, 'tear'); continue; }
      if (h.platform && d < 66 && G.time - (G.lastMantle || -9) > 0.5) {
        const pb = h.platform.bounds;
        if (pp.y > pb.min.y - 2 && pp.x > pb.min.x - 26 && pp.x < pb.max.x + 26 && player.velocity.y > -3) {
          // reeled up to a ledge: haul yourself over it
          const cx = (pb.min.x + pb.max.x) / 2, dir = Math.abs(cx - pp.x) < 14 ? 0 : Math.sign(cx - pp.x);
          Body.setVelocity(player, { x: dir * 2.0 + player.velocity.x * 0.3, y: -8.4 / (1 + 0.04 * haulMass()) });
          G.lastMantle = G.time; Snd.hop(); popWord(pp.x, pp.y - 34, 'hup!', 0.8, '#d9c8ff');
          sparks(pp.x, pp.y, 5, '#d9c8ff'); endHand(h, true, 'mantle'); continue;
        }
      }
      let len = Math.min(h.con.length, d);
      len = Math.max(h.minLen, len - REEL * dt);
      h.con.length = len;
      h.strain = clamp((d - len) / 70, 0, 1);
    }
  }
  function anyStaticHand() { for (const h of hands) if (h.on && h.con && h.kind === 'static') return true; return false; }

  /* ============================================================ one-way platforms */
  function refreshMasks() {
    const allOW = owBodies.reduce((m, b) => m | b.owCat, 0);
    for (const b of [player, ...items.map(i => i.body)]) {
      if (b === player || b.item.state === 'loose' || b.item.state === 'hauled') {
        const rising = b.velocity.y < -0.35;
        let mask = CAT_WORLD | (b === player ? 0 : CAT_LOOT);
        if (!rising) {
          const bb = b.bounds;
          for (const s of owBodies) {
            const sb = s.bounds;
            const inside = bb.max.x > sb.min.x && bb.min.x < sb.max.x && bb.max.y > sb.min.y + 12 && bb.min.y < sb.max.y - 2;
            if (!inside) mask |= s.owCat;
          }
        }
        setMask(b, mask);
      }
    }
    void allOW;
  }

  /* ============================================================ movement */
  function movement(dt) {
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const hm = haulMass();
    const grounded = G.groundT > 0;
    const sMul = 1 / (1 + 0.075 * hm), aMul = 1 / (1 + 0.035 * hm);
    const target = dir * 3.9 * sMul;
    const vx = player.velocity.x;
    let acc = (grounded ? 0.55 : 0.22) * aMul;
    if (dir === 0) acc = grounded && !anyStaticHand() ? 0.34 : 0;
    const dv = clamp(target - vx, -acc, acc);
    // the little guy is stronger than he looks: effort grows with the haul, but speed still suffers
    if (dv !== 0) Body.applyForce(player, player.position, { x: player.mass * (1 + 0.7 * hm) * dv / DT2, y: 0 });
    G.jumpBuf = Math.max(0, G.jumpBuf - dt);
    if (G.jumpBuf > 0 && G.groundT > 0) {
      const jv = 8.7 / (1 + 0.035 * hm);
      Body.setVelocity(player, { x: player.velocity.x, y: -jv });
      G.groundT = 0; G.jumpBuf = 0; Snd.hop(); G.landSq = -0.18;
    }
    const sp = Math.hypot(player.velocity.x, player.velocity.y);
    if (sp > 13) Body.setVelocity(player, { x: player.velocity.x * 13 / sp, y: player.velocity.y * 13 / sp });
    if (grounded && Math.abs(player.velocity.x) > 0.5) G.walk += Math.abs(player.velocity.x) * 0.13;
  }

  /* ============================================================ the giant */
  const GY = 915, STRIDE_MAX = 640, STRIDE_MIN = 220;
  function initGiant() {
    const hx = 2790;
    G.giant = { feet: [{ x: hx - 150, lift: 0, from: 0, to: 0, t: 1, tilt: 0 }, { x: hx + 150, lift: 0, from: 0, to: 0, t: 1, tilt: 0 }], hip: hx, mover: -1, idle: 1.2, dur: 1.0, steps: 0, target: undefined, closeness: 0 };
  }
  function giantStep(g) {
    const aim = player.position.x + player.velocity.x * 12;
    const dir = aim < g.hip ? -1 : 1;
    const mi = dir < 0 ? (g.feet[0].x > g.feet[1].x ? 0 : 1) : (g.feet[0].x < g.feet[1].x ? 0 : 1);
    const f = g.feet[mi], other = g.feet[1 - mi];
    let to = f.x + dir * clamp(Math.abs(aim - f.x), STRIDE_MIN, STRIDE_MAX);
    if (Math.abs(to - other.x) < 150) to = other.x + dir * 150;
    f.from = f.x; f.to = to; f.t = 0; g.mover = mi; g.target = to;
    g.dur = Math.max(0.68, 0.9 - g.steps * 0.02);
    Snd.whoosh();
  }
  function giantLand(g, f) {
    const d = Math.abs(player.position.x - f.x), near = clamp(1 - d / 900, 0, 1);
    Snd.stomp(0.45 + 0.55 * near);
    G.shake = Math.max(G.shake, 8 + 16 * near); G.rumble = 1; G.punch = 1;
    G.hitstop = Math.max(G.hitstop, 0.03 + 0.07 * near);
    G.rings.push({ x: f.x - 57, t: 0 });
    G.cracks.push({ x: f.x - 57, seed: G.cracks.length * 13 + 5 + (G.t * 100 | 0) % 7 }); if (G.cracks.length > 10) G.cracks.shift();
    G.lampDip = 1; G.flash = Math.max(G.flash, 0.22 * near);
    for (let i = 0; i < 16; i++) puff(f.x - 57 + rand(-160, 160), GY - 6, rand(16, 32), rand(0.9, 1.7), rand(-130, 130), rand(-95, -20));
    chips(f.x - 57, GY - 10, 16, 110);
    const top = cam.y - ch / (2 * cam.s), half = cw / (2 * cam.s);
    for (let i = 0; i < 40; i++) parts.push({ x: cam.x + rand(-half, half), y: top + rand(0, 80), vx: rand(-10, 10), vy: rand(20, 90), life: rand(1, 2), t: 0, col: 'rgba(205,192,170,0.55)', size: rand(1.4, 3.4), g: 30 });
    // the whole room jumps
    for (const it of items) if (it.state === 'loose' || it.state === 'hauled') {
      const dd = Math.abs(it.body.position.x - f.x);
      if (dd < 520) { const k = 1 - dd / 520; Body.setVelocity(it.body, { x: it.body.velocity.x + rand(-1, 1) * k * 2, y: it.body.velocity.y - 5 * k - 1 }); }
    }
    const dd = Math.abs(player.position.x - f.x);
    if (dd < 460) {
      const k = 1 - dd / 460;
      if (G.groundT > 0) Body.setVelocity(player, { x: player.velocity.x, y: player.velocity.y - 4.5 * k });
      if (dd < 320) for (const h of hands) if (h.on && h.con) { Snd.tear(); endHand(h, true, 'tear'); }
    }
    popWord(f.x - 50, GY - 70, 'BOOM', 2, '#ffd1a0');
  }
  function crushed() {
    G.state = 'caught'; G.caughtT = 0; G.crushed = true;
    for (const h of hands) if (h.on) endHand(h, true, 'tear');
    for (const it of items) if (it.vac && (it.vac.on || it.vac.snd)) stopVac(it);
    Body.setVelocity(player, { x: 0, y: 0 }); Body.setStatic(player, true);
    Snd.stomp(1); G.shake = 26; G.punch = 1.4; G.flash = 0.8; G.slowT = 0.9; G.hitstop = 0.18; G.lampDip = 1;
    for (let i = 0; i < 18; i++) puff(player.position.x + rand(-90, 90), GY - 8, rand(14, 30), rand(0.9, 1.6), rand(-160, 160), rand(-100, -20));
    chips(player.position.x, GY - 10, 18, 80); Snd.rumble(false);
    popWord(player.position.x, player.position.y - 50, 'SPLAT!', 1.8, '#ffd1a0');
  }
  function giantHit(g) {
    const px = player.position.x, py = player.position.y, top = py - 42, bot = py + PR, cy = py - 9;
    for (const f of g.feet) {
      const ay = 853 - f.lift;
      if (px > f.x - 170 && px < f.x + 60 && top < ay + 66 && bot > ay - 104) return crushed();
      const topX = g.hip + (f.x - g.hip) * 0.55, sct = clamp((cy + 900) / (ay + 900), 0, 1), cx = topX + (f.x - topX) * sct, hw = 84 - 44 * sct;
      if (cy < ay + 30 && Math.abs(px - cx) < hw + 10) return crushed();
    }
  }
  function updateGiant(dt) {
    const g = G.giant; if (!g || G.state !== 'awake') return;
    if (g.mover < 0) { g.idle -= dt; if (g.idle <= 0) giantStep(g); }
    else {
      const f = g.feet[g.mover]; f.t += dt / g.dur; const k = Math.min(1, f.t), e = k * k * (3 - 2 * k);
      f.x = lerp(f.from, f.to, e); f.lift = 340 * Math.pow(Math.sin(Math.PI * k), 0.7);
      f.tilt = -0.3 * Math.sin(Math.PI * k) + (k > 0.8 ? (k - 0.8) * 0.5 : 0);
      if (k >= 1) { f.lift = 0; f.tilt = 0; g.mover = -1; g.idle = 0.1; g.steps++; g.target = undefined; giantLand(g, f); }
    }
    g.hip = (g.feet[0].x + g.feet[1].x) / 2;
    const px = player.position.x; let dmin = 1e9;
    for (const f of g.feet) dmin = Math.min(dmin, Math.max(0, Math.abs(px - (f.x - 57)) - 100));
    g.closeness = clamp(1 - dmin / 1300, 0, 1);
    G.hbT -= dt; if (G.hbT <= 0) { G.hbT = lerp(0.9, 0.34, g.closeness); Snd.heartbeat(); }
    G.shake = Math.max(G.shake, 2.2);
    if (G.state === 'awake' && !inPad(player.position)) giantHit(g);
  }

  /* ============================================================ simulation step */
  function stepSim() {
    const dt = STEP;
    G.t += dt;
    G.groundT = Math.max(0, G.groundT - dt);
    if (!G.over) {
      G.time += dt;
      if (G.state !== 'caught') { movement(dt); handsUpdate(dt); vacuumUpdate(dt); }
    }
    refreshMasks();
    Engine.update(engine, DT);
    postStep(dt);
  }

  function postStep(dt) {
    // landing squash
    const grounded = G.groundT > 0;
    if (grounded && !G.wasGround && G.lastVy > 3.5) { G.landSq = Math.min(0.35, G.lastVy * 0.04); Snd.land(Math.min(1, G.lastVy / 9)); for (let i = 0; i < 3; i++) puff(player.position.x + rand(-14, 14), player.position.y + PR - 3, rand(6, 10), 0.5, rand(-50, 50), rand(-30, -8)); }
    const stepPh = Math.floor(G.walk / Math.PI);
    if (grounded && Math.abs(player.velocity.x) > 1.2 && stepPh !== G.stepPh) { G.stepPh = stepPh; puff(player.position.x - Math.sign(player.velocity.x) * 9, player.position.y + PR - 2, rand(5, 8), 0.45, -player.velocity.x * 6, rand(-26, -8)); }
    G.wasGround = grounded; G.lastVy = player.velocity.y;
    G.landSq *= 0.86;

    for (const it of items) {
      if (it.state !== 'loose' && it.state !== 'hauled') continue;
      const b = it.body, sp = Math.hypot(b.velocity.x, b.velocity.y);
      if (sp > 16) Body.setVelocity(b, { x: b.velocity.x * 16 / sp, y: b.velocity.y * 16 / sp });
      if (b.position.y > H + 150 || b.position.x < -150 || b.position.x > W + 150) {
        if (it.state === 'hauled') dropItem(it);
        Body.setPosition(b, { x: it.spawn.x, y: it.spawn.y }); Body.setVelocity(b, { x: 0, y: 0 }); Body.setAngle(b, 0);
      }
      if (it.state === 'hauled' && b.position.y < -60) Body.setPosition(b, { x: b.position.x, y: 20 });
      // banking dwell
      if (inPad(b.position) && !(G.state === 'over')) {
        it.padT += dt;
        const need = G.state === 'awake' ? 0.2 : 0.55;
        if (it.padT >= need) bankItem(it);
      } else it.padT = Math.max(0, it.padT - dt * 2);
    }
    if (player.position.y > H + 150) { Body.setPosition(player, { x: 250, y: FLOOR - PR - 1 }); Body.setVelocity(player, { x: 0, y: 0 }); }

    // banking animations
    for (let i = banking.length - 1; i >= 0; i--) {
      const bk = banking[i]; bk.t += dt / 0.55;
      if (bk.t >= 1) { banking.splice(i, 1); finishBank(bk); }
    }

    if (G.over) { G.overT += dt; return; }

    // giant / noise
    if (G.state === 'play') {
      G.noise = Math.max(0, G.noise - 2.4 * dt);
      const stage = G.noise >= 70 ? 2 : G.noise >= 35 ? 1 : 0;
      if (stage > G.stage) { Snd.groan(stage); if (stage === 1) toast('The giant is stirring…', 2.5, 'warn'); else toast('Something is wrong. He\'s about to wake!', 2.5, 'alarm'); }
      G.stage = stage;
      if (stage === 2) { G.hbT -= dt; if (G.hbT <= 0) { G.hbT = 0.7; Snd.heartbeat(); } }
      Snd.snore(1 - G.noise / 140, G.t);
    } else if (G.state === 'awake') {
      updateGiant(dt);
    }
    G.rumble = Math.max(G.state === 'awake' || G.state === 'leaving' ? 0.4 : 0, G.rumble * 0.96);
    Art.rumble = G.rumble;
    G.noiseDisp = lerp(G.noiseDisp, G.noise, 0.15);

    // leaving / escaping
    const inHome = inPad(player.position);
    if (G.state === 'awake') {
      if (inHome) { G.state = 'leaving'; G.leaveT = 0; }
    }
    if (G.state === 'leaving') {
      G.leaveT -= dt;
      if (G.leaveT <= 0) {
        G.leaveT = 0.16;
        let next = null, bd = 1e9;
        for (const it of items) if ((it.state === 'hauled' || it.state === 'loose') && dist(it.body.position, HOLE) < 360) { const d = dist(it.body.position, HOLE); if (d < bd) { bd = d; next = it; } }
        if (next) bankItem(next);
        else if (banking.length === 0) endRun(G.noise >= 100 ? 'escaped' : 'sneaked');
      }
    }
    if (G.state === 'caught') {
      G.caughtT += dt;
      if (G.caughtT > 1.5) endRun('caught');
    }
    G.shake *= 0.9;
    G.grin = Math.max(0, G.grin - dt);
    for (const h of hands) if (h.on) { /* keep alive */ }
    G.hint = Math.max(0, G.hint - dt);
  }

  function endRun(kind) {
    if (G.over) return;
    Snd.rumble(false);
    G.over = { kind, banked: G.banked, stars: STARS.filter(s => G.banked >= s).length, quip: (kind === 'caught' ? QUIPS_CAUGHT : QUIPS_ESCAPE)[Math.floor(Math.random() * 3)] };
    G.overT = 0;
    for (const it of items) if (it.vac && (it.vac.on || it.vac.snd)) stopVac(it);
    for (const h of hands) if (h.on) endHand(h, true, 'tear');
    const newBest = G.banked > P.best;
    if (newBest) P.best = G.banked;
    G.over.newBest = newBest && G.banked > 0;
    P.runs++; saveProgress();
    Tele.send('run_result', { outcome: kind, banked: G.banked, stars: G.over.stars, items_banked: G.bankedCount, peak_haul: G.carriedPeak, duration_sec: Math.round(G.time), goal_reached: G.goalHit });
    if (kind === 'caught') { Snd.lose(); platMsg('level_failed'); } else { Snd.win(); platMsg('level_completed'); }
  }
  function restart(fromOver) {
    if (fromOver) showInterstitial();
    newRun();
  }

  /* ============================================================ effects */
  let lastWordT = -1;
  function popWord(x, y, text, scale, color) {
    if (popups.length > 9 || (G.t - lastWordT < 0.12 && text.indexOf('$') < 0)) return;
    lastWordT = G.t;
    popups.push({ x, y, text, t: 0, life: 0.9 + scale * 0.35, scale: scale || 1, color: color || '#fff', rot: rand(-0.25, 0.25) }); }
  function puff(x, y, size, life, vx, vy) { parts.push({ type: 'puff', x, y, vx: vx || 0, vy: vy || 0, life: life || 0.6, t: 0, size, g: -12 }); }
  function chips(x, y, n, spread) { for (let i = 0; i < n; i++) parts.push({ type: 'chip', x: x + rand(-spread, spread), y, vx: rand(-220, 220), vy: rand(-440, -150), life: rand(0.7, 1.2), t: 0, g: 900, size: rand(3, 7), rot: rand(0, 6), vr: rand(-12, 12), col: i % 2 ? '#74482a' : '#a56a3a' }); }
  function sparks(x, y, n, col) { for (let i = 0; i < n; i++) { const a = rand(0, TAU), s = rand(40, 190); parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 40, life: rand(0.25, 0.55), t: 0, col, size: rand(1.6, 3.2), g: 400 }); } }
  function toast(text, secs, kind) { G.toast = { text, t: 0, life: secs, kind: kind || '' }; }
  function updateFx(dt) {
    for (let i = popups.length - 1; i >= 0; i--) { const p = popups[i]; p.t += dt; p.y -= 26 * dt; if (p.t > p.life) popups.splice(i, 1); }
    for (let i = parts.length - 1; i >= 0; i--) { const p = parts[i]; p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; if (p.t > p.life) parts.splice(i, 1); }
    if (G.toast) { G.toast.t += dt; if (G.toast.t > G.toast.life && G.toast.kind !== 'alarm') G.toast = null; else if (G.toast && G.toast.kind === 'alarm' && G.state !== 'awake' && G.state !== 'leaving' && G.toast.t > 1) G.toast = null; }
    G.flash = Math.max(0, G.flash - dt * 1.4);
    for (let i = G.rings.length - 1; i >= 0; i--) { G.rings[i].t += dt * 1.5; if (G.rings[i].t > 1) G.rings.splice(i, 1); }
    G.lampDip = Math.max(0, G.lampDip - dt * 2.2); G.bankBump = Math.max(0, G.bankBump - dt * 2.4);
    G.bankDisp += (G.banked - G.bankDisp) * Math.min(1, dt * 7); if (Math.abs(G.banked - G.bankDisp) < 0.6) G.bankDisp = G.banked;
  }

  /* ============================================================ input */
  const uiButtons = [];
  const downUI = {}; // pointerId -> button id
  function clearInput() { input.left = input.right = false; for (const k in downUI) delete downUI[k]; if (hands) for (const h of hands) if (h.on) endHand(h, true); }

  window.addEventListener('keydown', e => {
    Snd.resume();
    const c = e.code;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(c)) e.preventDefault();
    if (c === 'KeyA' || c === 'ArrowLeft') input.left = true;
    else if (c === 'KeyD' || c === 'ArrowRight') input.right = true;
    else if ((c === 'KeyW' || c === 'ArrowUp' || c === 'Space') && !e.repeat) { if (G.over) { if (G.overT > 0.6) restart(true); } else G.jumpBuf = 0.12; }
    else if (c === 'KeyQ' && !e.repeat) { if (!G.over) { const w = toWorld(mouse.sx, mouse.sy); dropNearest(w.x, w.y); } }
    else if (c === 'KeyE' && !e.repeat) { if (!G.over) stashNearCursor(); }
    else if (c === 'KeyR' && !e.repeat) restart(!!G.over);
    else if (c === 'KeyM' && !e.repeat) toggleMute();
    else if (c === 'Enter' && !e.repeat) { if (G.over) { if (G.overT > 0.6) restart(true); } else leaveAction(); }
  });
  window.addEventListener('keyup', e => {
    const c = e.code;
    if (c === 'KeyA' || c === 'ArrowLeft') input.left = false;
    else if (c === 'KeyD' || c === 'ArrowRight') input.right = false;
  });
  function toggleMute() { P.userMute = !P.userMute; syncAudio(); }
  function stashNearCursor() {
    const w = toWorld(mouse.sx, mouse.sy);
    const t = findTarget(w.x, w.y, 60);
    if (t && t.kind === 'loot' && t.inReach) attach(t.it);
  }
  function leaveAction() {
    if (G.state !== 'play' || !inPad(player.position) || G.banked + haulValue() <= 0) return;
    G.state = 'leaving'; G.leaveT = 0;
  }
  function canLeave() { return G.state === 'play' && inPad(player.position) && (G.banked + haulValue()) > 0 && !G.over; }

  function canvasPoint(e) { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * (cw / r.width), y: (e.clientY - r.top) * (ch / r.height) }; }
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('pointerdown', e => {
    e.preventDefault(); Snd.resume(); try { canvas.focus(); } catch (er) {}
    const p = canvasPoint(e);
    if (e.pointerType !== 'mouse') touchMode = true;
    mouse.sx = p.x; mouse.sy = p.y; mouse.has = true;
    for (let i = uiButtons.length - 1; i >= 0; i--) {
      const b = uiButtons[i];
      if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) { pressUI(b, e.pointerId); try { canvas.setPointerCapture(e.pointerId); } catch (er) {} return; }
    }
    if (G.over) return;
    try { canvas.setPointerCapture(e.pointerId); } catch (er) {}
    let hi = e.pointerType === 'mouse' ? (e.button === 2 ? 1 : 0) : (hands[0].on ? 1 : 0);
    if (e.pointerType === 'mouse' && e.button > 2) return;
    startGrab(hi, p.x, p.y, e.pointerType === 'mouse' ? 'mouse' + hi : e.pointerId);
  });
  canvas.addEventListener('pointermove', e => {
    const p = canvasPoint(e);
    if (e.pointerType === 'mouse') { mouse.sx = p.x; mouse.sy = p.y; mouse.has = true; for (const h of hands) if (h.on && String(h.pid).indexOf('mouse') === 0) { h.sx = p.x; h.sy = p.y; } }
    else { mouse.sx = p.x; mouse.sy = p.y; for (const h of hands) if (h.on && h.pid === e.pointerId) { h.sx = p.x; h.sy = p.y; } }
  });
  function pointerEnd(e) {
    if (e.pointerType === 'mouse') { releaseHandsByPid('mouse' + (e.button === 2 ? 1 : 0)); }
    else releaseHandsByPid(e.pointerId);
    const id = downUI[e.pointerId];
    if (id) { delete downUI[e.pointerId]; if (id === 'left') input.left = false; if (id === 'right') input.right = false; }
  }
  canvas.addEventListener('pointerup', pointerEnd);
  canvas.addEventListener('pointercancel', pointerEnd);
  canvas.addEventListener('lostpointercapture', e => { if (e.pointerType !== 'mouse') pointerEnd(e); });
  function pressUI(b, pid) {
    switch (b.id) {
      case 'left': input.left = true; downUI[pid] = 'left'; break;
      case 'right': input.right = true; downUI[pid] = 'right'; break;
      case 'jump': G.jumpBuf = 0.14; downUI[pid] = 'jump'; break;
      case 'drop': dropNearest(); downUI[pid] = 'drop'; break;
      case 'mute': toggleMute(); break;
      case 'restart': restart(!!G.over); break;
      case 'again': if (G.over && G.overT > 0.4) restart(true); break;
      case 'leave': leaveAction(); break;
    }
  }

  /* ============================================================ rendering */
  function updateCam(dt) {
    let s = clamp(Math.min(cw / 900, ch / 560), 0.25, 3);
    if (cw / ch < 0.9) s = Math.max(s, cw / 480); // portrait: zoom in so the burglar is readable
    s *= 1 + 0.035 * (G.punch || 0); G.punch = (G.punch || 0) * 0.9;
    cam.s = s;
    const hw = cw / (2 * s), hh = ch / (2 * s);
    // on touch screens leave room under the floor for the thumb buttons
    const bottomPad = touchMode && !G.over ? Math.max(90, 0.19 * ch) / s : 0;
    let tx = player.position.x + (mouse.has ? (mouse.sx - cw / 2) / s * 0.12 : 0), ty = player.position.y - 40 + (mouse.has ? (mouse.sy - ch / 2) / s * 0.1 : 0);
    tx = W > hw * 2 ? clamp(tx, hw, W - hw) : W / 2;
    ty = H + bottomPad > hh * 2 ? clamp(ty, hh, H - hh + bottomPad) : H / 2 + bottomPad / 2;
    const k = 1 - Math.pow(0.001, dt);
    cam.x = lerp(cam.x, tx, k); cam.y = lerp(cam.y, ty, k);
  }

  function txt(c, str, x, y, size, color, align, weight) {
    c.font = (weight || 800) + ' ' + size + 'px ' + Art.SERIF;
    c.textAlign = align || 'left'; c.textBaseline = 'alphabetic';
    c.lineJoin = 'round'; c.lineWidth = Math.max(2.4, size * 0.22); c.strokeStyle = 'rgba(32,16,36,0.95)';
    c.strokeText(str, x, y); c.fillStyle = color || '#fff3d6'; c.fillText(str, x, y);
  }
  function inkText(c, str, x, y, size, color, align, font) {
    c.font = '800 ' + size + 'px ' + (font || Art.SERIF); c.textAlign = align || 'left'; c.textBaseline = 'alphabetic';
    c.fillStyle = color || '#2a1a2e'; c.fillText(str, x, y);
  }
  // nearest surface under the burglar, for his shadow
  function groundYAt(x, y) {
    let gy = FLOOR;
    for (const b of owBodies) { const bb = b.bounds; if (x > bb.min.x - 8 && x < bb.max.x + 8 && bb.min.y >= y - 6 && bb.min.y < gy) gy = bb.min.y; }
    return gy;
  }

  function drawTether(c, it) {
    const ap = localToWorld(it.body, it.attach);
    const hp = G.pose ? Art.hip(G.pose) : { x: player.position.x, y: player.position.y + 6 };
    Art.rope(c, hp.x, hp.y, ap.x, ap.y, it.rest, it.id === 'necklace' || it.id === 'watch');
  }

  function drawItem(c, it, t) {
    const b = it.body;
    c.save(); c.translate(b.position.x, b.position.y); c.rotate(b.angle); c.translate(it.art.x, it.art.y);
    it.hauled = it.state === 'hauled';
    Art.LOOT[it.id](c, it, t);
    c.restore();
  }

  function drawWorld(c, t) {
    const s = cam.s;
    const sh = G.shake > 0.3 ? { x: (Math.sin(t * 61) * 0.6 + Math.sin(t * 37) * 0.4) * G.shake * 0.8, y: (Math.sin(t * 53 + 1) * 0.7 + Math.sin(t * 29) * 0.3) * G.shake } : { x: 0, y: 0 };
    c.setTransform(s * dpr, 0, 0, s * dpr, (cw / 2 - cam.x * s + sh.x) * dpr, (ch / 2 - cam.y * s + sh.y) * dpr);
    const v = { x0: cam.x - cw / (2 * s) - 30, x1: cam.x + cw / (2 * s) + 30, y0: cam.y - ch / (2 * s) - 30, y1: cam.y + ch / (2 * s) + 30 };
    const stateName = G.state === 'awake' || G.state === 'leaving' || G.state === 'caught' ? 'awake' : G.stage >= 1 ? 'stir' : 'calm';
    Art.room(c, v, t, stateName, hauled.length, G);

    for (const r of G.rings) { const e = 1 - Math.pow(1 - r.t, 2), rx = 40 + e * 560; c.beginPath(); c.ellipse(r.x, 912, rx, rx * 0.075, 0, 0, TAU); c.lineWidth = 7 * (1 - r.t) + 1; c.strokeStyle = 'rgba(230,214,190,' + 0.55 * (1 - r.t) + ')'; c.stroke(); }

    // loose + hauled loot behind the burglar
    for (const it of items) if (it.state === 'loose') drawItem(c, it, t);
    for (const it of hauled) { drawTether(c, it); }
    for (const it of hauled) drawItem(c, it, t);

    // banking animation
    for (const bk of banking) {
      const k = bk.t, e = k * k * (3 - 2 * k), sc = Math.max(0.04, 1 - e * 0.96);
      const px = lerp(bk.from.x, HOLE.x, e), py = lerp(bk.from.y, HOLE.y, e) - Math.sin(k * Math.PI) * 50;
      c.save(); c.translate(px, py); c.rotate(bk.ang + k * 6); c.scale(sc * (1 + Math.sin(k * 20) * 0.08 * (1 - k)), sc * (1 - Math.sin(k * 20) * 0.08 * (1 - k))); c.translate(bk.art.x, bk.art.y);
      Art.LOOT[bk.it.id](c, bk.it, t); c.restore();
    }

    // highlights (desktop hover / touch latched)
    drawReach(c, t);

    // arms + creature
    drawCreature(c, t);

    // pad dwell rings
    for (const it of items) if ((it.state === 'loose' || it.state === 'hauled') && it.padT > 0.02) {
      const need = G.state === 'awake' ? 0.2 : 0.55, k = Math.min(1, it.padT / need);
      c.beginPath(); c.arc(it.body.position.x, it.body.position.y - it.hitR - 12, 9, -Math.PI / 2, -Math.PI / 2 + k * TAU);
      c.lineWidth = 4; c.strokeStyle = '#ffe27a'; c.stroke();
    }
    // hauled value tags
    for (const it of hauled) txt(c, '$' + it.value, it.body.position.x, it.body.position.y - it.hitR - 4, 13, '#ffe27a', 'center', 800);

    // vacuum warning arrows
    for (const it of items) if (it.vac && (it.vac.warn > 0 || it.vac.on)) {
      const x = it.body.position.x + it.vac.dir * 62, y = it.body.position.y - 14, a = 0.6 + 0.4 * Math.sin(t * 30);
      c.save(); c.translate(x, y); c.scale(it.vac.dir, 1); c.globalAlpha = a; c.fillStyle = '#ff6b6b'; c.strokeStyle = OUT; c.lineWidth = 2;
      c.beginPath(); c.moveTo(-10, -7); c.lineTo(4, -7); c.lineTo(4, -13); c.lineTo(16, 0); c.lineTo(4, 13); c.lineTo(4, 7); c.lineTo(-10, 7); c.closePath(); c.fill(); c.stroke(); c.restore();
    }

    // particles + word pops
    for (const p of parts) {
      const k = p.t / p.life;
      if (p.type === 'puff') { const r = p.size * (1 + k * 1.9), g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, r); g.addColorStop(0, 'rgba(226,212,190,' + 0.55 * (1 - k) + ')'); g.addColorStop(1, 'rgba(226,212,190,0)'); c.fillStyle = g; c.fillRect(p.x - r, p.y - r, r * 2, r * 2); continue; }
      c.globalAlpha = clamp(1 - k, 0, 1); c.fillStyle = p.col;
      if (p.type === 'chip') { c.save(); c.translate(p.x, p.y); c.rotate(p.rot + p.vr * p.t); c.fillRect(-p.size, -p.size * 0.4, p.size * 2, p.size * 0.8); c.restore(); }
      else { c.beginPath(); c.arc(p.x, p.y, p.size, 0, TAU); c.fill(); }
    }
    c.globalAlpha = 1;
    for (const p of popups) {
      const k = p.t / p.life, pop = k < 0.15 ? k / 0.15 : 1, a = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.globalAlpha = a; const sc = (0.6 + 0.4 * pop) * p.scale;
      txt(c, p.text, 0, 0, 26 * sc, p.color, 'center', 900); c.restore();
    }
    // the giant himself
    if (G.giant && (G.state === 'awake' || G.state === 'leaving' || G.state === 'caught' || G.over)) Art.giant(c, G.giant, t);
  }

  function drawReach(c, t) {
    // reach ring is faint, targets are bright
    const pp = player.position;
    const act = hands.some(h => h.on);
    c.save();
    if (!touchMode || act) {
      const w = toWorld(mouse.sx, mouse.sy);
      const tgt = mouse.has && !G.over ? findTarget(w.x, w.y, touchMode ? 46 : 30) : null;
      if (act || tgt) { c.beginPath(); c.arc(pp.x, pp.y, REACH, 0, TAU); c.setLineDash([6, 10]); c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,0.16)'; c.stroke(); c.setLineDash([]); }
      if (tgt) {
        const ok = tgt.inReach, col = ok ? '#9dff8a' : 'rgba(255,255,255,0.45)';
        const pulse = 1 + Math.sin(t * 8) * 0.07;
        if (tgt.kind === 'loot') {
          const p = tgt.it.body.position;
          c.beginPath(); c.arc(p.x, p.y, (tgt.it.hitR + 6) * pulse, 0, TAU); c.lineWidth = 3; c.strokeStyle = col; c.setLineDash(ok ? [] : [5, 6]); c.stroke(); c.setLineDash([]);
          txt(c, tgt.it.name + '  $' + tgt.it.value, p.x, p.y - tgt.it.hitR - 14, 14, ok ? '#fff' : 'rgba(255,255,255,0.7)', 'center', 800);
          if (tgt.it.def.tip && ok) txt(c, tgt.it.def.tip, p.x, p.y - tgt.it.hitR - 30, 11, '#ffd9a0', 'center', 700);
        } else {
          c.beginPath(); c.arc(tgt.q.x, tgt.q.y, 9 * pulse, 0, TAU); c.lineWidth = 3; c.strokeStyle = col; c.stroke();
          c.beginPath(); c.arc(tgt.q.x, tgt.q.y, 3, 0, TAU); c.fillStyle = col; c.fill();
        }
        if (ok && !act) { c.setLineDash([3, 7]); c.lineWidth = 2; c.strokeStyle = 'rgba(157,255,138,0.45)'; c.beginPath(); c.moveTo(pp.x, pp.y); c.lineTo(tgt.p.x, tgt.p.y); c.stroke(); c.setLineDash([]); }
      }
    }
    c.restore();
  }

  function drawCreature(c, t) {
    const pp = player.position, vx = player.velocity.x, vy = player.velocity.y;
    // what is he looking at?
    let look = null, greedy = false;
    const hh = hands.find(h => h.on && h.con);
    if (hh) look = handPoint(hh);
    else {
      let bd = 520;
      for (const it of items) if (it.state === 'loose') { const d = dist(pp, it.body.position); if (d < bd) { bd = d; look = it.body.position; greedy = it.value >= 150; } }
      if (!look && mouse.has) look = toWorld(mouse.sx, mouse.sy);
    }
    let lx = 0, ly = 0;
    if (look) { const dx = look.x - pp.x, dy = look.y - pp.y, d = Math.hypot(dx, dy) || 1; lx = dx / d * Math.min(1, d / 60); ly = dy / d * Math.min(1, d / 60); }
    G.lx = lerp(G.lx || 0, lx, 0.25); G.ly = lerp(G.ly || 0, ly, 0.25);
    G.blink -= 1 / 60; if (G.blink < -0.12) G.blink = rand(2, 5);
    if (Math.abs(vx) > 0.5) G.faceDir = vx > 0 ? 1 : -1; else if (look && Math.abs(look.x - pp.x) > 24) G.faceDir = look.x > pp.x ? 1 : -1;
    // strain from arms and haul
    let strain = 0, pull = null;
    for (const h of hands) if (h.on && h.con) { const st = h.strain || 0; if (st > strain) strain = st; if (!pull) pull = handPoint(h); }
    let haulStrain = 0;
    const hpPrev = G.pose ? Art.hip(G.pose) : { x: pp.x, y: pp.y + 6 };
    for (const it of hauled) { const ap = localToWorld(it.body, it.attach); haulStrain += Math.max(0, dist(hpPrev, ap) - it.rest) / (it.rest * 1.4); }
    haulStrain = clamp(haulStrain * 0.6 + clamp(haulMass() / 14, 0, 0.5), 0, 1);
    strain = Math.max(strain, haulStrain * 0.8);
    G.strain = lerp(G.strain || 0, strain, 0.2);
    // squash, stretch and lean
    const grounded = G.groundT > 0;
    const sqT = -Math.min(Math.abs(vy), 10) * 0.012 + G.landSq;
    G.sqS = lerp(G.sqS, sqT, 0.3);
    let leanT = clamp(vx * 0.018, -0.12, 0.12);
    if (pull) leanT += clamp((pull.x - pp.x) / 180, -1, 1) * (0.1 + 0.28 * G.strain) * (grounded ? 0.7 : 1);
    G.saS = lerp(G.saS, clamp(leanT, -0.5, 0.5), 0.2);

    const scared = G.stage >= 2 || G.state === 'awake' || G.state === 'leaving' || G.state === 'caught';
    let mouth = 'smirk';
    if (!grounded && vy > 2.5) mouth = 'o';
    else if (G.giant && G.state === 'awake' && G.giant.closeness > 0.62) mouth = 'o';
    else if (G.strain > 0.5) mouth = 'strain';
    else if (scared || G.stage === 1) mouth = 'gulp';
    else if (G.grin > 0 || hauled.length >= 2) mouth = 'grin';

    const pose = {
      x: pp.x, y: pp.y, r: PR, sq: G.sqS, lean: G.saS, lookX: G.lx, lookY: G.ly, blink: G.blink < 0 ? 1 : 0,
      strain: G.strain, scared, greedy, mouth, walk: G.walk, moving: grounded && Math.abs(vx) > 0.5, grounded, vy, t, face: G.faceDir === undefined ? 1 : G.faceDir
    };
    // shadow on whatever is below him
    const gy = groundYAt(pp.x, pp.y + PR - 4), air = clamp((gy - (pp.y + PR)) / 220, 0, 1);
    c.save(); c.translate(pp.x, gy + 2); c.scale(1, 0.22); c.beginPath(); c.arc(0, 0, 22 * (1 - air * 0.5), 0, TAU); c.fillStyle = 'rgba(10,0,20,' + (0.4 * (1 - air * 0.7)) + ')'; c.fill(); c.restore();

    if (G.crushed) {
      c.save(); c.translate(pp.x, pp.y + PR); c.scale(1.5, 0.15); c.translate(-pp.x, -(pp.y + PR)); Art.thief(c, pose); c.restore();
      G.pose = pose;
      for (let i = 0; i < 3; i++) { const an = t * 5 + i * 2.1; star(c, pp.x + Math.cos(an) * 30, pp.y - 6 + Math.sin(an) * 6, 7, true); }
      return;
    }
    Art.thief(c, pose);
    G.pose = pose;

    // stretchy arms, drawn in front of the body
    for (let i = 0; i < 2; i++) {
      const h = hands[i];
      const sd = h.on ? h.side : (i === 0 ? -1 : 1);
      const sh = Art.shoulder(pose, sd);
      if (h.on && h.con) {
        const hp = handPoint(h);
        Art.arm(c, sh.x, sh.y, hp.x, hp.y, h.con.length, h.strain || 0, t, true);
      } else if (h.on && h.miss) {
        const w = toWorld(h.sx, h.sy), dx = w.x - sh.x, dy = w.y - sh.y, d = Math.hypot(dx, dy) || 1, r = Math.min(d, REACH * 0.92);
        Art.arm(c, sh.x, sh.y, sh.x + dx / d * r, sh.y + dy / d * r, r, 0.1, t, false);
        c.beginPath(); c.arc(w.x, w.y, 8, 0, TAU); c.lineWidth = 2; c.strokeStyle = 'rgba(255,120,120,0.85)'; c.stroke();
      } else {
        let tx = sd * 9 + sd * 5, ty = 17 + Math.sin(t * 2 + i) * 1.2 + (grounded && Math.abs(vx) > 0.5 ? Math.sin(G.walk + i * 3.14) * 4 : 0);
        if (mouse.has && !touchMode) {
          const w = toWorld(mouse.sx, mouse.sy), dx = w.x - sh.x, dy = w.y - sh.y, d = Math.hypot(dx, dy) || 1;
          if (d < 360) { const k = Math.min(1, 28 / d); tx = lerp(tx, dx * k, 0.55); ty = lerp(ty, dy * k, 0.55); }
        }
        if (h.ghost) {
          h.ghost.t += 1 / 60 / 0.2;
          if (h.ghost.t >= 1) h.ghost = null;
          else { const u = h.ghost.t - 1, e = 1 + 2.70158 * u * u * u + 1.70158 * u * u, hx = lerp(h.ghost.x, sh.x + tx, e), hy = lerp(h.ghost.y, sh.y + ty, e); Art.arm(c, sh.x, sh.y, hx, hy, Math.hypot(hx - sh.x, hy - sh.y) * 0.95, 0.6 * (1 - h.ghost.t), t, false); continue; }
        }
        Art.arm(c, sh.x, sh.y, sh.x + tx, sh.y + ty, 24, 0, t, false);
      }
    }
  }

  function drawLighting(c, t) {
    const s = cam.s, awake = G.state === 'awake' || G.state === 'leaving' || G.state === 'caught';
    const L = lctx; L.setTransform(1, 0, 0, 1, 0, 0);
    L.globalCompositeOperation = 'source-over';
    const dark = awake ? 0.06 : G.stage >= 1 ? 0.3 : 0.36;
    L.fillStyle = `rgba(10,6,30,${dark})`; L.fillRect(0, 0, lightCv.width, lightCv.height);
    L.globalCompositeOperation = 'destination-out';
    const W2S = (x, y) => ({ x: (cw / 2 + (x - cam.x) * s) * dpr, y: (ch / 2 + (y - cam.y) * s) * dpr });
    const light = (x, y, r, a) => {
      const p = W2S(x, y), rr = r * s * dpr, g = L.createRadialGradient(p.x, p.y, rr * 0.05, p.x, p.y, rr);
      g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.55, `rgba(0,0,0,${a * 0.45})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      L.fillStyle = g; L.fillRect(p.x - rr, p.y - rr, rr * 2, rr * 2);
    };
    const flick = (G.stage >= 1 && !awake ? (Math.sin(t * 37) > 0.75 ? 0.6 : 1) : 1) * (1 - 0.75 * (G.lampDip || 0));
    light(1520, 660, 420 * flick, 0.95);
    light(1250, 150, 460 * flick, 0.7);
    light(670, 300, 520, 0.55);
    light(40, 860, 380, 0.9);
    light(player.position.x, player.position.y, 330, 0.62);
    light(cam.x, cam.y, 700, 0.35);
    for (const it of items) if (it.id === 'tv' && it.state !== 'banking') light(it.body.position.x, it.body.position.y, 150, 0.5);
    for (const it of items) if (it.id === 'candle' && it.state !== 'banking') light(it.body.position.x, it.body.position.y - 20, 110, 0.35);
    L.globalCompositeOperation = 'source-over';
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.drawImage(lightCv, 0, 0);
    // warm glows
    c.globalCompositeOperation = 'lighter';
    const glow = (x, y, r, col) => { const p = W2S(x, y), rr = r * s * dpr, g = c.createRadialGradient(p.x, p.y, 0, p.x, p.y, rr); g.addColorStop(0, col); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(p.x - rr, p.y - rr, rr * 2, rr * 2); };
    if (!awake) { glow(1520, 650, 260 * flick, 'rgba(255,170,70,0.20)'); glow(1250, 150, 280 * flick, 'rgba(255,190,90,0.16)'); glow(40, 870, 190, 'rgba(255,170,70,0.2)'); glow(670, 300, 330, 'rgba(110,140,255,0.10)'); }
    c.globalCompositeOperation = 'source-over';
    // danger tint
    if (awake) {
      const a = 0.10 + 0.07 * Math.sin(t * 8);
      c.fillStyle = `rgba(255,30,40,${a})`; c.fillRect(0, 0, canvas.width, canvas.height);
    } else if (G.stage >= 1) {
      const k = (G.noiseDisp - 35) / 65, a = clamp(k, 0, 1) * 0.35;
      const g = c.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.height * 0.35, canvas.width / 2, canvas.height / 2, canvas.height * 0.95);
      g.addColorStop(0, 'rgba(255,0,0,0)'); g.addColorStop(1, `rgba(255,30,30,${a + (G.stage >= 2 ? 0.1 * Math.sin(t * 9) : 0)})`);
      c.fillStyle = g; c.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (G.flash > 0) { c.fillStyle = `rgba(255,255,255,${G.flash * 0.5})`; c.fillRect(0, 0, canvas.width, canvas.height); }
  }

  /* ------------------------------------------------------------ HUD (paper cards, ink, brass) */
  const PAPER = '#f1e5c6', INKC = '#2a1a2e', RUST = '#8a4a2a';
  function btn(id, x, y, w, h, extra) { const b = Object.assign({ id, x, y, w, h }, extra || {}); uiButtons.push(b); return b; }
  function card(c, x, y, w, h, fill, r) {
    r = r || 9; x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    c.save(); c.translate(3, 4); Art.rr(c, x, y, w, h, r); c.fillStyle = 'rgba(10,0,20,0.42)'; c.fill(); c.restore();
    Art.rr(c, x, y, w, h, r); c.fillStyle = fill || PAPER; c.fill();
    c.save(); c.clip();
    c.strokeStyle = 'rgba(120,85,40,0.11)'; c.lineWidth = 1;
    for (let yy = y + 6; yy < y + h; yy += 6) { c.beginPath(); c.moveTo(x, yy); c.lineTo(x + w, yy + (Art.hash(x, yy) - 0.5) * 2.4); c.stroke(); }
    const g = c.createLinearGradient(x, y, x, y + h); g.addColorStop(0, 'rgba(255,255,255,0.28)'); g.addColorStop(1, 'rgba(90,50,20,0.12)');
    c.fillStyle = g; c.fillRect(x, y, w, h); c.restore();
    Art.rr(c, x, y, w, h, r); Art.inkStroke(c, 2.4);
    Art.rr(c, x + 4, y + 4, w - 8, h - 8, Math.max(2, r - 3)); c.setLineDash([4, 3]); c.strokeStyle = 'rgba(42,26,46,0.32)'; c.lineWidth = 1; c.stroke(); c.setLineDash([]);
  }
  function tape(c, x, y, a) { c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = 'rgba(235,225,170,0.78)'; c.fillRect(-14, -5, 28, 10); c.strokeStyle = 'rgba(80,60,30,0.3)'; c.lineWidth = 1; c.strokeRect(-14, -5, 28, 10); c.restore(); }
  function gauge(c, x, y, w, h, k, fill, ticks) {
    c.fillStyle = '#d9c799'; Art.rr(c, x, y, w, h, h / 2); c.fill();
    if (k > 0.005) {
      c.save(); Art.rr(c, x, y, w, h, h / 2); c.clip();
      c.fillStyle = typeof fill === 'function' ? fill(c, x, w) : fill; c.fillRect(x, y, Math.max(h, w * k), h);
      c.strokeStyle = 'rgba(30,10,30,0.22)'; c.lineWidth = 1; for (let d = x - h; d < x + w * k; d += 5) { c.beginPath(); c.moveTo(d, y + h); c.lineTo(d + h, y); c.stroke(); }
      c.fillStyle = 'rgba(255,255,255,0.3)'; c.fillRect(x, y, w, h * 0.35); c.restore();
    }
    Art.rr(c, x, y, w, h, h / 2); Art.inkStroke(c, 2);
    c.strokeStyle = INKC; c.lineWidth = 1.6; for (const t of (ticks || [])) { c.beginPath(); c.moveTo(x + w * t, y + h - 1); c.lineTo(x + w * t, y + h + 4); c.stroke(); }
  }

  function giantFace(c, x, y, r, t) {
    const awake = G.state === 'awake' || G.state === 'leaving' || G.state === 'caught';
    const sk = awake ? '#eba07a' : '#e9b68c';
    c.beginPath(); c.arc(x, y, r + 4, 0, TAU); c.fillStyle = awake ? '#e8847a' : '#d9c799'; c.fill(); Art.inkStroke(c, 2);
    Art.blob(c, x, y, r, r * 1.04, 3); Art.fillStroke(c, sk, 2.2);
    c.fillStyle = '#4a2c1f'; c.beginPath(); c.arc(x, y - r * 0.2, r * 1.04, Math.PI * 1.02, Math.PI * 1.98); c.closePath(); Art.fillStroke(c, '#4a2c1f', 2);
    c.fillStyle = '#e09a70'; c.beginPath(); c.ellipse(x, y + r * 0.15, r * 0.16, r * 0.22, 0, 0, TAU); c.fill();
    c.strokeStyle = INKC; c.lineWidth = 2; c.lineCap = 'round';
    const ey = y - r * 0.1;
    if (awake) {
      for (const s of [-1, 1]) {
        c.fillStyle = '#fff'; c.beginPath(); c.ellipse(x + s * r * 0.38, ey, r * 0.2, r * 0.25, 0, 0, TAU); c.fill(); c.stroke();
        c.fillStyle = '#c4241f'; c.beginPath(); c.arc(x + s * r * 0.38, ey, r * 0.08, 0, TAU); c.fill();
        c.beginPath(); c.moveTo(x + s * r * 0.66, ey - r * 0.42); c.lineTo(x + s * r * 0.14, ey - r * 0.2); c.stroke();
      }
      c.beginPath(); c.ellipse(x, y + r * 0.56, r * 0.26, r * 0.18, 0, 0, TAU); c.fillStyle = '#4a1218'; c.fill(); c.stroke();
    } else if (G.stage >= 1) {
      const open = G.stage >= 2 ? 0.55 : 0.28;
      c.beginPath(); c.arc(x - r * 0.38, ey, r * 0.2, 0.2, Math.PI - 0.2); c.stroke();
      c.fillStyle = '#fff'; c.beginPath(); c.ellipse(x + r * 0.38, ey, r * 0.2, r * 0.2 * open + 1, 0, 0, TAU); c.fill(); c.stroke();
      if (open > 0.3) { c.fillStyle = '#c4241f'; c.beginPath(); c.arc(x + r * 0.38, ey, r * 0.07, 0, TAU); c.fill(); }
      c.beginPath(); c.moveTo(x - r * 0.2, y + r * 0.56); c.quadraticCurveTo(x, y + r * 0.46, x + r * 0.2, y + r * 0.56); c.stroke();
    } else {
      for (const s of [-1, 1]) { c.beginPath(); c.arc(x + s * r * 0.38, ey, r * 0.2, 0.2, Math.PI - 0.2); c.stroke(); }
      c.beginPath(); c.ellipse(x, y + r * 0.56, r * 0.16, r * 0.1 + Math.sin(t * 1.8) * r * 0.04, 0, 0, TAU); c.fillStyle = '#7a3a38'; c.fill(); c.stroke();
    }
    c.lineCap = 'butt';
    if (!awake) { txt(c, G.stage >= 1 ? '?' : 'z', x + r * 1.15, y - r * 0.5 - Math.sin(t * 2) * 2, r * 0.8, '#cfe8ff', 'left', 900); if (G.stage === 0) txt(c, 'Z', x + r * 1.7, y - r * 1.0 - Math.sin(t * 2 + 1) * 2, r * 0.55, '#cfe8ff', 'left', 900); }
  }

  function iconBtn(c, b, kind) {
    card(c, b.x, b.y, b.w, b.h, PAPER, b.w * 0.22);
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2, r = b.w * 0.25;
    c.strokeStyle = INKC; c.fillStyle = INKC; c.lineWidth = 2.6; c.lineCap = 'round'; c.lineJoin = 'round';
    if (kind === 'sound') {
      c.beginPath(); c.moveTo(cx - r, cy - r * 0.45); c.lineTo(cx - r * 0.3, cy - r * 0.45); c.lineTo(cx + r * 0.3, cy - r); c.lineTo(cx + r * 0.3, cy + r); c.lineTo(cx - r * 0.3, cy + r * 0.45); c.lineTo(cx - r, cy + r * 0.45); c.closePath(); c.fill();
      if (P.userMute || !P.audioOn) { c.strokeStyle = '#b3261e'; c.beginPath(); c.moveTo(cx + r * 0.6, cy - r * 0.6); c.lineTo(cx + r * 1.4, cy + r * 0.6); c.moveTo(cx + r * 1.4, cy - r * 0.6); c.lineTo(cx + r * 0.6, cy + r * 0.6); c.stroke(); }
      else { c.beginPath(); c.arc(cx + r * 0.3, cy, r * 0.8, -0.8, 0.8); c.stroke(); c.beginPath(); c.arc(cx + r * 0.3, cy, r * 1.4, -0.8, 0.8); c.stroke(); }
    } else {
      c.beginPath(); c.arc(cx, cy, r, -0.4, TAU - 1.0); c.stroke();
      c.beginPath(); c.moveTo(cx + r * 1.15, cy - r * 0.9); c.lineTo(cx + r * 0.45, cy - r * 0.55); c.lineTo(cx + r * 1.3, cy - r * 0.05); c.closePath(); c.fill();
    }
    c.lineCap = 'butt';
  }

  function star(c, sx, sy, R, on) {
    c.beginPath(); for (let j = 0; j < 10; j++) { const a = -Math.PI / 2 + j * Math.PI / 5, r = j % 2 ? R * 0.42 : R; c.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r); } c.closePath();
    if (on) { Art.fillStroke(c, '#f0c040', 3); c.save(); c.clip(); const g = c.createLinearGradient(sx - R, sy - R, sx + R, sy + R); g.addColorStop(0, 'rgba(255,255,220,0.6)'); g.addColorStop(1, 'rgba(150,80,0,0.35)'); c.fillStyle = g; c.fillRect(sx - R, sy - R, R * 2, R * 2); c.restore(); }
    else { c.fillStyle = 'rgba(42,26,46,0.12)'; c.fill(); c.setLineDash([4, 4]); c.strokeStyle = 'rgba(42,26,46,0.5)'; c.lineWidth = 2; c.stroke(); c.setLineDash([]); }
  }

  function drawHUD(c, t) {
    uiButtons.length = 0;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const U = clamp(Math.min(cw / 780, ch / 520), 0.78, 2.2);
    const pad = 10 * U, fs = (n) => Math.max(11, n * U);
    const narrow = cw < 640;

    // banked / carrying card
    const lw = Math.min(238 * U, cw * (narrow ? 0.58 : 0.34)), lh = 84 * U;
    card(c, pad, pad, lw, lh);
    tape(c, pad + lw * 0.2, pad + 1, -0.08);
    inkText(c, 'BANKED', pad + 14 * U, pad + 22 * U, fs(11), RUST, 'left', Art.SANS);
    c.save(); c.translate(pad + 14 * U, pad + 49 * U); const bsc = 1 + 0.24 * G.bankBump; c.scale(bsc, bsc); inkText(c, '$' + Math.round(G.bankDisp), 0, 0, fs(28), G.bankBump > 0.08 ? '#2d7a3a' : INKC, 'left'); c.restore();
    inkText(c, 'GOAL $' + GOAL, pad + lw - 14 * U, pad + 22 * U, fs(11), G.banked >= GOAL ? '#2d7a3a' : RUST, 'right', Art.SANS);
    gauge(c, pad + 14 * U, pad + 55 * U, lw - 28 * U, 8 * U, clamp(G.banked / GOAL, 0, 1), G.banked >= GOAL ? '#7bbf6a' : '#e2b13a', [0.25, 0.5, 0.75]);
    const hv = haulValue();
    inkText(c, hv > 0 ? 'carrying $' + hv + '  (' + hauled.length + ' item' + (hauled.length > 1 ? 's' : '') + ')' : 'carrying nothing…', pad + 14 * U, pad + 76 * U, fs(11.5), hv > 0 ? '#b3541e' : 'rgba(42,26,46,0.5)', 'left', Art.SANS);

    // buttons (top-right)
    const bs = Math.max(38, 40 * U);
    btn('restart', cw - pad - bs, pad, bs, bs); iconBtn(c, uiButtons[uiButtons.length - 1], 'restart');
    btn('mute', cw - pad - bs * 2 - 8 * U, pad, bs, bs); iconBtn(c, uiButtons[uiButtons.length - 1], 'sound');

    // giant / noise card
    let nx = pad + lw + pad + 4 * U, ny = pad, nw = cw - nx - (bs * 2 + 8 * U) - pad * 2, nh = 62 * U;
    if (nw < 190 * U) { nx = pad; ny = pad + lh + 10 * U; nw = cw - pad * 2; }
    const alarm = G.stage >= 2 || G.state === 'awake';
    card(c, nx, ny, nw, nh, alarm ? '#ecb09f' : PAPER);
    giantFace(c, nx + 31 * U, ny + nh / 2 + 1 * U, 17 * U, t);
    const bx = nx + 64 * U, bw = nw - 78 * U, by = ny + 33 * U, bh = 14 * U;
    const label = G.state === 'awake' ? 'HE\'S AWAKE!' : G.state === 'leaving' || G.state === 'caught' ? '' : G.stage >= 2 ? 'ABOUT TO WAKE!' : G.stage === 1 ? 'stirring…' : 'sound asleep';
    inkText(c, 'THE GIANT\'S SLEEP', bx, ny + 23 * U, fs(11), RUST, 'left', Art.SANS);
    inkText(c, label, bx + bw, ny + 23 * U, fs(12), alarm ? '#a3201a' : '#2c5a82', 'right');
    gauge(c, bx, by, bw, bh, clamp(G.noiseDisp / 100, 0, 1), (cc, x, w) => { const g = cc.createLinearGradient(x, 0, x + w, 0); g.addColorStop(0, '#6fb36a'); g.addColorStop(0.5, '#e8b33a'); g.addColorStop(1, '#d0382e'); return g; }, [0.35, 0.7]);

    // how close the giant is
    if (G.state === 'awake') {
      const ew = Math.min(cw * 0.7, 520 * U), ex = (cw - ew) / 2, ey = ny + nh + 16 * U + (ny > pad ? 0 : Math.max(0, lh - nh));
      const k = G.giant ? G.giant.closeness : 0;
      card(c, ex, ey, ew, 46 * U, '#ea8f7e');
      inkText(c, k > 0.7 ? 'HE\'S RIGHT BEHIND YOU!' : 'THE GIANT IS COMING. RUN HOME!', cw / 2, ey + 22 * U, fs(17), INKC, 'center');
      gauge(c, ex + 14 * U, ey + 30 * U, ew - 28 * U, 8 * U, Math.max(0.04, k), k > 0.6 ? '#d0382e' : '#e8b33a', []);
    }

    // where is he? an arrow at the screen edge when the giant is out of view
    if (G.state === 'awake' && G.giant) {
      const px = player.position.x; let nf = G.giant.feet[0];
      for (const f of G.giant.feet) if (Math.abs(f.x - px) < Math.abs(nf.x - px)) nf = f;
      const sx = (nf.x - 57 - cam.x) * cam.s + cw / 2;
      if (sx > cw + 20 || sx < -20) {
        const right = sx > 0, ax = right ? cw - 30 * U : 30 * U, ay = ch * 0.5, pulse = 1 + 0.18 * Math.sin(t * 12), d = right ? 1 : -1;
        c.save(); c.translate(ax, ay); c.scale(pulse, pulse);
        c.beginPath(); c.moveTo(d * 16 * U, 0); c.lineTo(-d * 12 * U, -18 * U); c.lineTo(-d * 12 * U, 18 * U); c.closePath(); Art.fillStroke(c, '#d0382e', 3);
        c.restore(); inkText(c, 'GIANT', ax, ay + 34 * U, fs(11), '#fff3d6', 'center', Art.SANS);
      }
    }

    // toast
    if (G.toast && G.state !== 'awake' && !G.over) {
      const tk = G.toast.t / G.toast.life, a = tk < 0.08 ? tk / 0.08 : tk > 0.88 ? (1 - tk) / 0.12 : 1;
      const ty = ch - (touchMode ? 120 : 54) * U;
      c.globalAlpha = clamp(a, 0, 1);
      c.font = '800 ' + fs(15) + 'px ' + Art.SERIF;
      const tw = Math.min(cw - 24, c.measureText(G.toast.text).width + 40 * U);
      card(c, (cw - tw) / 2, ty - 24 * U, tw, 38 * U, G.toast.kind === 'warn' ? '#f0cb86' : G.toast.kind === 'alarm' ? '#ea8f7e' : G.toast.kind === 'good' ? '#b5dba5' : PAPER, 8);
      inkText(c, G.toast.text, cw / 2, ty + 1 * U, fs(15), INKC, 'center');
      c.globalAlpha = 1;
    }
    if (!touchMode && G.hint > 0 && !G.over) {
      c.globalAlpha = clamp(G.hint, 0, 1) * 0.95;
      txt(c, 'A/D move   W hop   HOLD mouse: grab + reel   CLICK loot: stash   Q: drop   R: restart', cw / 2, ch - 14 * U, fs(13), '#f1e5c6', 'center', 700);
      c.globalAlpha = 1;
    }
    if (canLeave()) {
      const lbw = Math.min(300 * U, cw - 24), lbh = 44 * U, lx = (cw - lbw) / 2, ly = ch - (touchMode ? 190 : 110) * U;
      btn('leave', lx, ly, lbw, lbh);
      card(c, lx, ly, lbw, lbh, '#b4d9a0', 10);
      inkText(c, G.banked >= GOAL ? 'Call it a night  (Enter)' : 'Sneak out now  (Enter)', cw / 2, ly + 28 * U, fs(16), INKC, 'center');
    }

    // touch controls
    if (touchMode && !G.over) {
      const sz = Math.max(60, 66 * U), gap = 14 * U, by2 = ch - sz - 14 * U;
      const tb = (id, x, y, label, col) => {
        btn(id, x, y, sz, sz); const dn = Object.values(downUI).indexOf(id) >= 0;
        card(c, x, y, sz, sz, dn ? '#d9c28a' : PAPER, sz * 0.24);
        inkText(c, label, x + sz / 2, y + sz / 2 + fs(label.length > 2 ? 5 : 9), fs(label.length > 2 ? 14 : 26), col || INKC, 'center');
      };
      tb('left', 14 * U, by2, '◀'); tb('right', 14 * U + sz + gap, by2, '▶');
      tb('jump', cw - sz - 14 * U, by2, 'HOP'); tb('drop', cw - sz * 2 - gap - 14 * U, by2, 'DROP', '#a3201a');
    }

    // result overlay
    if (G.over && G.overT > 0.5) {
      const o = G.over, k = clamp((G.overT - 0.5) / 0.35, 0, 1);
      c.fillStyle = 'rgba(14,6,22,' + 0.66 * k + ')'; c.fillRect(0, 0, cw, ch);
      const pw = Math.min(cw - 24, 470 * U), ph = Math.min(ch - 24, 340 * U), px = (cw - pw) / 2, py = Math.round((ch - ph) / 2 - (1 - k) * 20);
      c.globalAlpha = k;
      card(c, px, py, pw, ph, '#f0e2bd', 12);
      tape(c, px + pw * 0.15, py + 2, -0.1); tape(c, px + pw * 0.85, py + 2, 0.12);
      const caught = o.kind === 'caught';
      const title = caught ? 'SQUASHED!' : o.kind === 'clean' ? 'CLEAN SWEEP!' : o.kind === 'escaped' ? 'ESCAPED!' : 'SNEAKED OUT!';
      c.save(); c.translate(cw / 2, py + 62 * U); c.rotate(-0.06);
      c.font = '900 ' + fs(38) + 'px ' + Art.SERIF; const tw2 = c.measureText(title).width + 36 * U;
      Art.rr(c, -tw2 / 2, -38 * U, tw2, 54 * U, 6); c.lineWidth = 4; c.strokeStyle = caught ? '#a3201a' : '#2d6a3a'; c.stroke();
      Art.rr(c, -tw2 / 2 + 5, -33 * U, tw2 - 10, 44 * U, 4); c.lineWidth = 1.5; c.stroke();
      inkText(c, title, 0, 0, fs(38), caught ? '#a3201a' : '#2d6a3a', 'center');
      c.restore();
      inkText(c, 'Banked  $' + o.banked + (caught && hauledLost() > 0 ? '    (dropped $' + hauledLost() + ')' : ''), cw / 2, py + 112 * U, fs(22), INKC, 'center');
      for (let i = 0; i < 3; i++) star(c, cw / 2 + (i - 1) * 56 * U, py + 158 * U, 21 * U, i < o.stars);
      inkText(c, o.quip, cw / 2, py + 206 * U, fs(14), '#5a3a52', 'center');
      inkText(c, (o.newBest ? 'NEW BEST  $' : 'Best  $') + P.best + '   ·   goal $' + GOAL + '   ·   all loot $' + TOTAL_VALUE, cw / 2, py + 230 * U, fs(13), o.newBest ? '#2d7a3a' : RUST, 'center', Art.SANS);
      const bw = Math.min(270 * U, pw - 40), bh = 50 * U, bx = (cw - bw) / 2, by = py + ph - bh - 22 * U;
      btn('again', bx, by, bw, bh);
      card(c, bx, by, bw, bh, '#e5a24e', 12);
      inkText(c, 'One more try  (R)', cw / 2, by + 33 * U, fs(20), INKC, 'center');
      c.globalAlpha = 1;
    }
    if (P.paused) { c.fillStyle = 'rgba(0,0,0,0.45)'; c.fillRect(0, 0, cw, ch); txt(c, 'PAUSED', cw / 2, ch / 2, fs(34), '#fff3d6', 'center', 900); }
  }
  function hauledLost() { let v = 0; for (const it of items) if (it.state === 'hauled' || (it.state === 'loose' && false)) v += it.value; return v; }

  /* ============================================================ main loop */
  let last = 0, acc = 0, perfPrev = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000 || 0.016); last = now;
    if (!P.paused && !P.hidden) {
      const frozen = G.hitstop > 0;
      if (frozen) G.hitstop -= dt; else acc += dt * (G.slowT > 0 ? 0.28 : 1);
      G.slowT = Math.max(0, G.slowT - dt);
      let n = 0;
      while (acc >= STEP && n < 4) { stepSim(); acc -= STEP; n++; }
      if (n === 4) acc = 0;
      updateFx(frozen ? 0 : dt * (G.slowT > 0 ? 0.5 : 1));
      if (!G.over && perfPrev) Tele.frame(now - perfPrev, now);
      perfPrev = now;
    } else perfPrev = 0;
    if (G.over) perfPrev = 0;
    render(now / 1000);
    if (!P.ready && window.__omtLoaded) { P.ready = true; platMsg('game_ready'); }
  }
  function render(t) {
    updateCam(1 / 60);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#1a1026'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    drawWorld(ctx, t);
    drawLighting(ctx, t);
    Art.postfx(ctx, canvas.width, canvas.height, t, dpr);
    drawHUD(ctx, t);
  }

  /* ============================================================ boot */
  newRun();
  window.__omt = {
    get G() { return G; }, get player() { return player; }, get items() { return items; }, get hauled() { return hauled; }, get hands() { return hands; }, get cam() { return cam; },
    stepN(n) { for (let i = 0; i < n; i++) stepSim(); }, input, mouse, toWorld, startGrab, endHand, attach, dropItem, dropNearest, endRun, addNoise, restart, P,
    get parts() { return parts; }, setTouch(v) { touchMode = v; }, findTarget, bankItem, jump() { G.jumpBuf = 0.15; }
  };
  platformInit().then(() => {
    syncAudio();
    window.__omtLoaded = true;
    requestAnimationFrame(frame);
  });
})();
