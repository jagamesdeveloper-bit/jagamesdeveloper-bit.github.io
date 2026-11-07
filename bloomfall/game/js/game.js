/* Bloomfall - a falling-block garden puzzle.
 * Plain JS + Canvas 2D. Playgama Bridge handles storage, ads, language,
 * pause and audio state. */
(() => {
  'use strict';

  const COVER = window.BLOOMFALL_COVER || null;
  const HAS_BRIDGE = !COVER && typeof window.bridge !== 'undefined';
  const STRINGS = window.BLOOMFALL_STRINGS;
  let S = STRINGS.en;

  function t(key, ...args) {
    let s = (S && S[key]) || STRINGS.en[key] || key;
    for (let i = 0; i < args.length; i++) s = s.split('{' + i + '}').join(String(args[i]));
    return s;
  }

  // ------------------------------------------------------------ constants
  const COLS = 10;
  const ROWS = 22;
  const HIDDEN = 2;
  const VISIBLE = ROWS - HIDDEN;
  const LEVEL_COUNT = 40;
  const LOCK_DELAY = 500;
  const MAX_LOCK_RESETS = 15;
  const DAS = 150;
  const ARR = 45;
  const SOFT_MS = 32;
  const CLEAR_MS = 280;
  const SAVE_KEY = 'bloomfall_save';
  const TITLE = 'Bloomfall';

  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, k) => a + (b - a) * k;
  const easeOutBack = (x) => 1 + 2.4 * Math.pow(x - 1, 3) + 1.4 * Math.pow(x - 1, 2);
  const fmt = (n) => String(Math.floor(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

  function mulberry32(a) {
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let r = Math.imul(a ^ (a >>> 15), 1 | a);
      r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ------------------------------------------------------------ pieces
  const TYPES = ['I', 'J', 'L', 'O', 'S', 'T', 'Z'];
  const TYPE_ID = { I: 1, J: 2, L: 3, O: 4, S: 5, T: 6, Z: 7 };
  const GARBAGE = 8;
  const SEED = 9;
  const WEED = 10;
  const BASE = {
    I: [[0, 0, 0, 0], [1, 1, 1, 1], [0, 0, 0, 0], [0, 0, 0, 0]],
    J: [[1, 0, 0], [1, 1, 1], [0, 0, 0]],
    L: [[0, 0, 1], [1, 1, 1], [0, 0, 0]],
    O: [[1, 1], [1, 1]],
    S: [[0, 1, 1], [1, 1, 0], [0, 0, 0]],
    T: [[0, 1, 0], [1, 1, 1], [0, 0, 0]],
    Z: [[1, 1, 0], [0, 1, 1], [0, 0, 0]]
  };
  function rotCW(m) {
    const n = m.length;
    const r = [];
    for (let y = 0; y < n; y++) {
      r.push([]);
      for (let x = 0; x < n; x++) r[y].push(m[n - 1 - x][y]);
    }
    return r;
  }
  const SHAPES = {};
  for (const k of TYPES) {
    let m = BASE[k];
    SHAPES[k] = [];
    for (let r = 0; r < 4; r++) {
      const cells = [];
      m.forEach((row, y) => row.forEach((v, x) => { if (v) cells.push([x, y]); }));
      SHAPES[k].push(cells);
      m = rotCW(m);
    }
  }
  // Wall kicks (x right, y up), keyed "from>to".
  const KICKS = {
    '0>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '1>0': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '1>2': [[0, 0], [1, 0], [1, -1], [0, 2], [1, 2]],
    '2>1': [[0, 0], [-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '2>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]],
    '3>2': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '3>0': [[0, 0], [-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '0>3': [[0, 0], [1, 0], [1, 1], [0, -2], [1, -2]]
  };
  const KICKS_I = {
    '0>1': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    '1>0': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    '1>2': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]],
    '2>1': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    '2>3': [[0, 0], [2, 0], [-1, 0], [2, 1], [-1, -2]],
    '3>2': [[0, 0], [-2, 0], [1, 0], [-2, -1], [1, 2]],
    '3>0': [[0, 0], [1, 0], [-2, 0], [1, -2], [-2, 1]],
    '0>3': [[0, 0], [-1, 0], [2, 0], [-1, 2], [2, -1]]
  };

  const COLORS = {
    1: '#56c7e8', 2: '#8170f0', 3: '#f7a23e', 4: '#f3cf45', 5: '#6fcf6b', 6: '#ee72b6', 7: '#ef6060',
    8: '#8f6040', 9: '#8f6040', 10: '#55874a'
  };
  const PETALS = ['#ff9ec7', '#ffd36e', '#c9a7ff', '#ffffff', '#ff8f8f', '#9fe3ff'];

  function hexToRgb(h) {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function shade(hex, amt) {
    const [r, g, b] = hexToRgb(hex);
    const f = (c) => Math.round(amt >= 0 ? c + (255 - c) * amt : c * (1 + amt));
    return `rgb(${f(r)},${f(g)},${f(b)})`;
  }
  function rgba(hex, a) {
    const [r, g, b] = hexToRgb(hex);
    return `rgba(${r},${g},${b},${a})`;
  }

  // ------------------------------------------------------------ canvas
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  let VW = 1;
  let VH = 1;
  let DPR = 1;
  const cellCache = new Map();
  let bgCanvas = null;

  function resize() {
    VW = Math.max(1, Math.floor(window.innerWidth));
    VH = Math.max(1, Math.floor(window.innerHeight));
    DPR = COVER ? 1 : Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(VW * DPR);
    canvas.height = Math.round(VH * DPR);
    canvas.style.width = VW + 'px';
    canvas.style.height = VH + 'px';
    cellCache.clear();
    bgCanvas = null;
    computeLayout();
  }

  function rr(g, x, y, w, h, r) {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    g.beginPath();
    g.moveTo(x + r, y);
    g.lineTo(x + w - r, y);
    g.arcTo(x + w, y, x + w, y + r, r);
    g.lineTo(x + w, y + h - r);
    g.arcTo(x + w, y + h, x + w - r, y + h, r);
    g.lineTo(x + r, y + h);
    g.arcTo(x, y + h, x, y + h - r, r);
    g.lineTo(x, y + r);
    g.arcTo(x, y, x + r, y, r);
    g.closePath();
  }

  const FONT_STACK = '"Trebuchet MS", "Segoe UI", system-ui, -apple-system, Roboto, "Helvetica Neue", Arial, sans-serif';
  function font(px, weight) {
    return `${weight || 800} ${Math.max(1, Math.round(px))}px ${FONT_STACK}`;
  }
  function fitFont(text, px, maxW, weight) {
    ctx.font = font(px, weight);
    const w = ctx.measureText(text).width;
    if (w > maxW && w > 0) px = Math.max(10, px * (maxW / w));
    ctx.font = font(px, weight);
    return px;
  }
  function wrapLines(text, maxW) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) {
        lines.push(line);
        line = w;
      } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  // ------------------------------------------------------------ cell art
  function cellSprite(id, size) {
    const key = id + '_' + size;
    let c = cellCache.get(key);
    if (c) return c;
    const px = Math.max(2, Math.round(size * DPR));
    c = document.createElement('canvas');
    c.width = c.height = px;
    drawCellArt(c.getContext('2d'), id, px);
    cellCache.set(key, c);
    return c;
  }

  function drawCellArt(g, id, s) {
    const base = COLORS[id];
    const ins = s * 0.045;
    if (id <= 7) {
      const grd = g.createLinearGradient(0, 0, 0, s);
      grd.addColorStop(0, shade(base, 0.3));
      grd.addColorStop(0.55, base);
      grd.addColorStop(1, shade(base, -0.25));
      rr(g, ins, ins, s - 2 * ins, s - 2 * ins, s * 0.22);
      g.fillStyle = grd;
      g.fill();
      g.lineWidth = Math.max(1, s * 0.055);
      g.strokeStyle = shade(base, -0.38);
      g.stroke();
      rr(g, s * 0.17, s * 0.12, s * 0.66, s * 0.24, s * 0.12);
      g.fillStyle = 'rgba(255,255,255,0.32)';
      g.fill();
      // a little four-petal mark in the middle
      g.save();
      g.translate(s * 0.5, s * 0.6);
      g.fillStyle = shade(base, 0.5);
      g.globalAlpha = 0.5;
      for (let i = 0; i < 4; i++) {
        g.rotate(Math.PI / 2);
        g.beginPath();
        g.ellipse(0, -s * 0.08, s * 0.05, s * 0.085, 0, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    } else if (id === GARBAGE || id === SEED) {
      const grd = g.createLinearGradient(0, 0, 0, s);
      grd.addColorStop(0, '#9c6c47');
      grd.addColorStop(1, '#674229');
      rr(g, ins, ins, s - 2 * ins, s - 2 * ins, s * 0.16);
      g.fillStyle = grd;
      g.fill();
      g.lineWidth = Math.max(1, s * 0.05);
      g.strokeStyle = '#4a2e1a';
      g.stroke();
      const rnd = mulberry32(id * 31 + 5);
      g.fillStyle = 'rgba(40,22,10,0.35)';
      for (let i = 0; i < 6; i++) {
        g.beginPath();
        g.arc(s * (0.18 + rnd() * 0.64), s * (0.2 + rnd() * 0.62), s * (0.03 + rnd() * 0.035), 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = 'rgba(255,220,180,0.18)';
      rr(g, s * 0.16, s * 0.12, s * 0.68, s * 0.16, s * 0.08);
      g.fill();
      if (id === SEED) {
        // seed
        g.beginPath();
        g.ellipse(s * 0.5, s * 0.66, s * 0.17, s * 0.15, 0, 0, Math.PI * 2);
        g.fillStyle = '#f4dc9e';
        g.fill();
        g.lineWidth = Math.max(1, s * 0.04);
        g.strokeStyle = '#a77e45';
        g.stroke();
        // sprout
        g.strokeStyle = '#6fcf5a';
        g.lineWidth = Math.max(1, s * 0.065);
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(s * 0.5, s * 0.55);
        g.quadraticCurveTo(s * 0.47, s * 0.4, s * 0.52, s * 0.28);
        g.stroke();
        g.fillStyle = '#8fe070';
        g.beginPath();
        g.ellipse(s * 0.38, s * 0.27, s * 0.13, s * 0.065, -0.5, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.ellipse(s * 0.65, s * 0.24, s * 0.13, s * 0.065, 0.5, 0, Math.PI * 2);
        g.fill();
      }
    } else if (id === WEED) {
      const grd = g.createLinearGradient(0, 0, 0, s);
      grd.addColorStop(0, '#6aa25a');
      grd.addColorStop(1, '#3b6332');
      rr(g, ins, ins, s - 2 * ins, s - 2 * ins, s * 0.16);
      g.fillStyle = grd;
      g.fill();
      g.lineWidth = Math.max(1, s * 0.05);
      g.strokeStyle = '#2a4523';
      g.stroke();
      g.strokeStyle = '#9fd685';
      g.lineWidth = Math.max(1, s * 0.05);
      g.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        const x = s * (0.28 + i * 0.22);
        g.beginPath();
        g.moveTo(x, s * 0.82);
        g.quadraticCurveTo(x + s * (i - 1) * 0.08, s * 0.5, x + s * (i - 1) * 0.12, s * 0.25);
        g.stroke();
      }
    }
  }

  function drawCell(id, x, y, size, alpha) {
    if (alpha !== undefined && alpha < 1) ctx.globalAlpha = alpha;
    ctx.drawImage(cellSprite(id, size), x, y, size, size);
    if (alpha !== undefined && alpha < 1) ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------ audio
  const SOUND_NAMES = ['music', 'move', 'rotate', 'lock', 'drop', 'clear1', 'clear2', 'clear3', 'clear4', 'bloom', 'hold', 'win', 'lose', 'click', 'rise', 'levelup'];
  const Sound = {
    ctx: null,
    master: null,
    musicGain: null,
    sfxGain: null,
    raw: {},
    buffers: {},
    musicSrc: null,
    userMuted: false,
    platformOn: true,
    paused: false,
    hidden: false,
    unlocked: false,
    ext: 'mp3',
    init() {
      const a = document.createElement('audio');
      this.ext = a.canPlayType && a.canPlayType('audio/ogg; codecs="vorbis"') ? 'ogg' : 'mp3';
    },
    // Fetch the files now; decoding needs an AudioContext, which browsers
    // only let us start from a player gesture (see unlock).
    load() {
      const one = (n, ext) => fetch('audio/' + n + '.' + ext).then((r) => {
        if (!r.ok) throw new Error('http ' + r.status);
        return r.arrayBuffer();
      }).then((ab) => { this.raw[n] = { ab, ext }; });
      return Promise.all(SOUND_NAMES.map((n) => one(n, this.ext)
        .catch(() => one(n, this.ext === 'ogg' ? 'mp3' : 'ogg'))
        .catch(() => {})));
    },
    createContext() {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      try {
        this.ctx = new AC();
      } catch (e) {
        this.ctx = null;
        return false;
      }
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.42;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.8;
      this.sfxGain.connect(this.master);
      const decode = (ab) => new Promise((res, rej) => {
        const p = this.ctx.decodeAudioData(ab, res, rej);
        if (p && p.then) p.then(res, rej);
      });
      for (const n of SOUND_NAMES) {
        const r = this.raw[n];
        if (!r) continue;
        decode(r.ab.slice(0)).then((b) => {
          this.buffers[n] = b;
          if (n === 'music') this.startMusic();
        }).catch(() => {});
      }
      return true;
    },
    get silent() {
      return this.userMuted || !this.platformOn || this.paused || this.hidden;
    },
    apply() {
      if (!this.ctx) return;
      const silent = this.silent;
      try {
        this.master.gain.cancelScheduledValues(this.ctx.currentTime);
        this.master.gain.setValueAtTime(silent ? 0 : 1, this.ctx.currentTime);
      } catch (e) {
        this.master.gain.value = silent ? 0 : 1;
      }
      if (silent) {
        if (this.ctx.state === 'running') this.ctx.suspend().catch(() => {});
      } else if (this.unlocked && this.ctx.state !== 'running') {
        this.ctx.resume().catch(() => {});
      }
    },
    unlock() {
      if (!this.ctx && !this.createContext()) return;
      this.unlocked = true;
      this.apply();
      this.startMusic();
    },
    startMusic() {
      if (!this.ctx || this.musicSrc || !this.buffers.music || !this.unlocked) return;
      const src = this.ctx.createBufferSource();
      src.buffer = this.buffers.music;
      src.loop = true;
      src.connect(this.musicGain);
      src.start(0);
      this.musicSrc = src;
    },
    play(name, vol, rate) {
      if (!this.ctx || this.silent || !this.unlocked) return;
      const b = this.buffers[name];
      if (!b) return;
      const src = this.ctx.createBufferSource();
      src.buffer = b;
      if (rate) src.playbackRate.value = rate;
      let node = src;
      if (vol !== undefined && vol !== 1) {
        const g = this.ctx.createGain();
        g.gain.value = vol;
        src.connect(g);
        node = g;
      }
      node.connect(this.sfxGain);
      src.start(0);
    },
    setUserMuted(m) { this.userMuted = m; this.apply(); },
    setPlatform(on) { this.platformOn = on; this.apply(); },
    setPaused(p) { this.paused = p; this.apply(); },
    setHidden(h) { this.hidden = h; this.apply(); }
  };

  // ------------------------------------------------------------ save
  const save = { unlocked: 1, stars: {}, best: 0, muted: false, tut: false };

  function loadSave() {
    if (!HAS_BRIDGE) return Promise.resolve();
    return bridge.storage.get([SAVE_KEY]).then((data) => {
      let v = Array.isArray(data) ? data[0] : data && typeof data === 'object' && SAVE_KEY in data ? data[SAVE_KEY] : data;
      if (typeof v === 'string') {
        try { v = JSON.parse(v); } catch (e) { v = null; }
      }
      if (v && typeof v === 'object') {
        if (Number.isFinite(v.unlocked)) save.unlocked = clamp(Math.floor(v.unlocked), 1, LEVEL_COUNT);
        if (v.stars && typeof v.stars === 'object') save.stars = v.stars;
        if (Number.isFinite(v.best)) save.best = v.best;
        save.muted = !!v.muted;
        save.tut = !!v.tut;
      }
    }).catch(() => {});
  }

  function writeSave() {
    if (!HAS_BRIDGE) return;
    try {
      bridge.storage.set([SAVE_KEY], [JSON.stringify(save)]).catch(() => {});
    } catch (e) { /* storage unavailable: keep playing */ }
  }

  function totalStars() {
    let s = 0;
    for (const k in save.stars) s += save.stars[k] | 0;
    return s;
  }

  // ------------------------------------------------------------ levels
  function levelDef(n) {
    const rng = mulberry32(n * 7919 + 13);
    const rows = clamp(2 + Math.floor((n - 1) * 0.3), 2, 12);
    const seedCount = clamp(1 + Math.floor((n - 1) * 0.4), 1, 14);
    const shiftChance = n <= 2 ? 0 : clamp(0.12 + n * 0.025, 0, 0.85);
    const doubleHole = n >= 14 ? clamp((n - 14) * 0.025, 0, 0.3) : 0;
    const gravity = Math.max(120, Math.round(1000 * Math.pow(0.945, n - 1)));
    const riseEvery = n >= 8 ? Math.max(6, 15 - Math.floor((n - 8) / 3)) : 0;
    const garbage = [];
    let hole = Math.floor(rng() * COLS);
    for (let r = 0; r < rows; r++) {
      if (r > 0 && rng() < shiftChance) hole = (hole + 1 + Math.floor(rng() * (COLS - 1))) % COLS;
      const row = new Array(COLS).fill(GARBAGE);
      row[hole] = 0;
      if (rng() < doubleHole) {
        let h2 = (hole + 2 + Math.floor(rng() * (COLS - 3))) % COLS;
        row[h2] = 0;
      }
      garbage.push(row); // garbage[0] is the bottom row
    }
    const bias = clamp(n / 30, 0, 0.9);
    const cand = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < COLS; c++) if (garbage[r][c]) cand.push({ r, c, k: rng() + bias * (r / rows) });
    }
    cand.sort((a, b) => a.k - b.k);
    const perRow = {};
    let placed = 0;
    for (const p of cand) {
      if (placed >= seedCount) break;
      if ((perRow[p.r] || 0) >= 3) continue;
      garbage[p.r][p.c] = SEED;
      perRow[p.r] = (perRow[p.r] || 0) + 1;
      placed++;
    }
    let lowest = rows;
    for (let r = 0; r < rows; r++) if (garbage[r].includes(SEED)) { lowest = r; break; }
    const depth = rows - lowest; // rows from the top of the soil down to the deepest seed row
    const par = Math.ceil(depth * 1.9) + 3 + Math.floor(n / 6);
    return { n, garbage, seeds: placed, gravity, riseEvery, par };
  }

  // ------------------------------------------------------------ game state
  let G = null;

  function emptyGrid() {
    return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
  }

  function newGame(mode, level) {
    const g = {
      mode,
      level: level || 0,
      grid: emptyGrid(),
      bag: [],
      queue: [],
      hold: null,
      holdUsed: false,
      piece: null,
      score: 0,
      lines: 0,
      pieces: 0,
      seedsTotal: 0,
      seedsLeft: 0,
      gravity: 1000,
      riseEvery: 0,
      riseCount: 0,
      dropT: 0,
      lockT: 0,
      lockResets: 0,
      lowestY: 0,
      combo: -1,
      clearing: null,
      over: false,
      won: false,
      endT: 0,
      revived: false,
      started: false,
      speed: 1,
      shake: 0,
      flash: 0,
      par: 0,
      starsEarned: 0,
      newBest: false
    };
    if (mode === 'level') {
      const def = levelDef(level);
      for (let r = 0; r < def.garbage.length; r++) g.grid[ROWS - 1 - r] = def.garbage[r].slice();
      g.seedsTotal = g.seedsLeft = def.seeds;
      g.gravity = def.gravity;
      g.riseEvery = def.riseEvery;
      g.par = def.par;
    } else {
      g.gravity = 1000;
    }
    refill(g);
    return g;
  }

  function refill(g) {
    while (g.queue.length < 5) {
      if (!g.bag.length) {
        g.bag = TYPES.slice();
        for (let i = g.bag.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [g.bag[i], g.bag[j]] = [g.bag[j], g.bag[i]];
        }
      }
      g.queue.push(g.bag.pop());
    }
  }

  function fits(type, rot, x, y) {
    for (const [cx, cy] of SHAPES[type][rot]) {
      const gx = x + cx;
      const gy = y + cy;
      if (gx < 0 || gx >= COLS || gy >= ROWS) return false;
      if (gy >= 0 && G.grid[gy][gx]) return false;
    }
    return true;
  }

  function spawn(forced) {
    const type = forced || G.queue.shift();
    refill(G);
    const p = { type, rot: 0, x: type === 'O' ? 4 : 3, y: 0 };
    if (!fits(p.type, p.rot, p.x, p.y)) {
      G.piece = null;
      gameOver();
      return;
    }
    if (fits(p.type, p.rot, p.x, p.y + 1)) p.y++;
    G.piece = p;
    G.lockT = 0;
    G.lockResets = 0;
    G.lowestY = p.y;
    G.dropT = 0;
  }

  function grounded() {
    const p = G.piece;
    return p && !fits(p.type, p.rot, p.x, p.y + 1);
  }

  function onPieceAdjusted() {
    if (grounded() && G.lockResets < MAX_LOCK_RESETS) {
      G.lockT = 0;
      G.lockResets++;
    }
  }

  function canAct() {
    return screen === 'play' && G && !overlay && G.piece && !G.over && !G.clearing && !extPaused;
  }

  function actMove(dx, repeat) {
    if (!canAct()) return false;
    const p = G.piece;
    if (!fits(p.type, p.rot, p.x + dx, p.y)) return false;
    p.x += dx;
    onPieceAdjusted();
    if (!repeat || Math.random() < 0.5) Sound.play('move', 0.55);
    tutorialDid('move');
    return true;
  }

  function actRotate(dir) {
    if (!canAct()) return false;
    const p = G.piece;
    if (p.type === 'O') {
      Sound.play('rotate', 0.6);
      tutorialDid('rotate');
      return true;
    }
    const to = (p.rot + dir + 4) % 4;
    const table = p.type === 'I' ? KICKS_I : KICKS;
    const kicks = table[p.rot + '>' + to];
    for (const [kx, ky] of kicks) {
      if (fits(p.type, to, p.x + kx, p.y - ky)) {
        p.x += kx;
        p.y -= ky;
        p.rot = to;
        if (p.y > G.lowestY) { G.lowestY = p.y; G.lockResets = 0; }
        onPieceAdjusted();
        Sound.play('rotate', 0.7);
        tutorialDid('rotate');
        return true;
      }
    }
    return false;
  }

  function actSoftStep() {
    if (!canAct()) return false;
    const p = G.piece;
    if (!fits(p.type, p.rot, p.x, p.y + 1)) return false;
    p.y++;
    G.score += 1;
    G.dropT = 0;
    if (p.y > G.lowestY) { G.lowestY = p.y; G.lockResets = 0; G.lockT = 0; }
    return true;
  }

  function actHardDrop() {
    if (!canAct()) return;
    const p = G.piece;
    let d = 0;
    const startY = p.y;
    while (fits(p.type, p.rot, p.x, p.y + 1)) { p.y++; d++; }
    G.score += d * 2;
    // falling streaks
    if (d > 0) {
      for (const [cx, cy] of SHAPES[p.type][p.rot]) {
        const x = LY.bx + (p.x + cx + 0.5) * LY.cell;
        const y0 = LY.by + (startY + cy - HIDDEN) * LY.cell;
        const y1 = LY.by + (p.y + cy - HIDDEN) * LY.cell;
        streaks.push({ x, y0: Math.max(LY.by, y0), y1, life: 220, max: 220, color: COLORS[TYPE_ID[p.type]] });
      }
    }
    G.shake = Math.max(G.shake, 2.5);
    Sound.play('drop', 0.9);
    tutorialDid('drop');
    lockPiece();
  }

  function actHold() {
    if (!canAct() || G.holdUsed) return;
    const cur = G.piece.type;
    const h = G.hold;
    G.hold = cur;
    G.holdUsed = true;
    G.piece = null;
    Sound.play('hold', 0.8);
    tutorialDid('hold');
    spawn(h || undefined);
    G.holdUsed = true;
  }

  function lockPiece() {
    const p = G.piece;
    if (!p) return;
    let allHidden = true;
    let above = false;
    for (const [cx, cy] of SHAPES[p.type][p.rot]) {
      const x = p.x + cx;
      const y = p.y + cy;
      if (y < 0) { above = true; continue; }
      G.grid[y][x] = TYPE_ID[p.type];
      if (y >= HIDDEN) allHidden = false;
    }
    G.piece = null;
    G.pieces++;
    G.holdUsed = false;
    Sound.play('lock', 0.7);
    if (allHidden || above) {
      gameOver();
      return;
    }
    const full = [];
    for (let r = 0; r < ROWS; r++) if (G.grid[r].every((v) => v)) full.push(r);
    if (full.length) {
      let seeds = 0;
      for (const r of full) {
        for (let c = 0; c < COLS; c++) {
          if (G.grid[r][c] === SEED) {
            seeds++;
            spawnBloom(LY.bx + (c + 0.5) * LY.cell, LY.by + (r - HIDDEN + 0.5) * LY.cell, LY.cell);
          }
        }
      }
      G.seedsLeft = Math.max(0, G.seedsLeft - seeds);
      G.clearing = { rows: full, t: 0, seeds };
      Sound.play('clear' + Math.min(4, full.length), 0.85);
      if (seeds) Sound.play('bloom', 0.9);
      if (full.length >= 4) G.shake = Math.max(G.shake, 6);
    } else {
      G.combo = -1;
      afterLock();
    }
  }

  function finishClear() {
    const { rows, seeds } = G.clearing;
    G.clearing = null;
    const set = new Set(rows);
    G.grid = G.grid.filter((_, i) => !set.has(i));
    while (G.grid.length < ROWS) G.grid.unshift(new Array(COLS).fill(0));
    const n = rows.length;
    G.lines += n;
    G.combo++;
    const mult = G.mode === 'endless' ? G.speed : 1;
    let gained = [0, 100, 300, 500, 800][Math.min(4, n)] * mult;
    if (G.combo > 0) gained += 50 * G.combo * mult;
    gained += seeds * 250;
    G.score += gained;
    const midRow = rows.reduce((a, b) => a + b, 0) / rows.length;
    floaters.push({
      text: '+' + fmt(gained) + (G.combo > 0 ? '  x' + (G.combo + 1) : ''),
      x: LY.bx + LY.cell * 5,
      y: LY.by + (midRow - HIDDEN + 0.5) * LY.cell,
      life: 1100,
      max: 1100,
      size: LY.cell * (n >= 4 ? 1.0 : 0.75)
    });
    if (G.mode === 'endless') {
      const sp = 1 + Math.floor(G.lines / 10);
      if (sp > G.speed) {
        G.speed = sp;
        G.gravity = Math.max(70, Math.round(1000 * Math.pow(0.85, sp - 1)));
        Sound.play('levelup', 0.8);
        G.flash = 1;
      }
    }
    if (G.mode === 'level' && G.seedsLeft <= 0) {
      G.won = true;
      G.over = true;
      G.endT = 1300;
      for (let i = 0; i < 40; i++) spawnPetal(LY.bx + Math.random() * LY.cell * 10, LY.by + Math.random() * LY.cell * 20, true);
      return;
    }
    afterLock();
  }

  function afterLock() {
    if (G.riseEvery) {
      G.riseCount++;
      if (G.riseCount >= G.riseEvery) {
        G.riseCount = 0;
        if (!riseWeeds()) return;
      }
    }
    spawn();
  }

  function riseWeeds() {
    if (G.grid[0].some((v) => v)) {
      gameOver();
      return false;
    }
    const row = new Array(COLS).fill(WEED);
    row[Math.floor(Math.random() * COLS)] = 0;
    G.grid.shift();
    G.grid.push(row);
    G.shake = Math.max(G.shake, 4);
    Sound.play('rise', 0.9);
    for (let c = 0; c < COLS; c++) {
      if (Math.random() < 0.5) {
        sparks.push({
          x: LY.bx + (c + 0.5) * LY.cell, y: LY.by + LY.cell * 20, vx: (Math.random() - 0.5) * 0.05,
          vy: -0.08 - Math.random() * 0.08, life: 600, max: 600, color: '#9fd685', size: LY.cell * 0.12
        });
      }
    }
    return true;
  }

  function gameOver() {
    if (G.over) return;
    G.over = true;
    G.won = false;
    G.piece = null;
    G.endT = 800;
    G.shake = Math.max(G.shake, 5);
  }

  function update(dt) {
    if (!G) return;
    if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 0.02);
    if (G.flash > 0) G.flash = Math.max(0, G.flash - dt * 0.0015);
    if (overlay || !G.started) return;
    if (G.endT > 0) {
      G.endT -= dt;
      if (G.endT <= 0) {
        if (G.won) showWin();
        else showLose();
      }
      return;
    }
    if (G.clearing) {
      G.clearing.t += dt;
      if (G.clearing.t >= CLEAR_MS) finishClear();
      return;
    }
    if (!G.piece) return;
    // auto-repeat for held left/right keys
    if (dasDir !== 0) {
      const held = dasDir < 0 ? keys.has('ArrowLeft') || keys.has('KeyA') : keys.has('ArrowRight') || keys.has('KeyD');
      if (!held) dasDir = 0;
      else {
        dasT += dt;
        if (dasT >= DAS) {
          arrT += dt;
          while (arrT >= ARR) {
            arrT -= ARR;
            if (!actMove(dasDir, true)) { arrT = 0; break; }
          }
        }
      }
    }
    if (!G.piece) return;
    const p = G.piece;
    const soft = softKey;
    const interval = soft ? Math.min(G.gravity, SOFT_MS) : G.gravity;
    G.dropT += dt;
    while (G.dropT >= interval) {
      G.dropT -= interval;
      if (fits(p.type, p.rot, p.x, p.y + 1)) {
        p.y++;
        if (soft) G.score += 1;
        if (p.y > G.lowestY) { G.lowestY = p.y; G.lockResets = 0; G.lockT = 0; }
      } else {
        G.dropT = 0;
        break;
      }
    }
    if (grounded()) {
      G.lockT += dt;
      if (G.lockT >= LOCK_DELAY) lockPiece();
    } else G.lockT = 0;
  }

  function ghostY() {
    const p = G.piece;
    let y = p.y;
    while (fits(p.type, p.rot, p.x, y + 1)) y++;
    return y;
  }

  // ------------------------------------------------------------ tutorial
  const TUT_STEPS = ['move', 'rotate', 'drop', 'hold'];
  let tutStep = -1;
  let tutFade = 0;

  function tutorialDid(action) {
    if (tutStep < 0 || tutStep >= TUT_STEPS.length) return;
    if (TUT_STEPS[tutStep] === action) {
      tutStep++;
      tutFade = 0;
      if (tutStep >= TUT_STEPS.length) {
        tutStep = -1;
        save.tut = true;
        writeSave();
      }
    }
  }

  // ------------------------------------------------------------ effects
  const particles = [];
  const sparks = [];
  const streaks = [];
  const floaters = [];
  const ambient = [];

  function spawnBloom(x, y, cell) {
    const color = PETALS[Math.floor(Math.random() * PETALS.length)];
    particles.push({ kind: 'flower', x, y, vx: (Math.random() - 0.5) * 0.02, vy: -0.05, life: 1500, max: 1500, size: cell * 1.1, color, rot: Math.random() * 6 });
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 0.08 + Math.random() * 0.18;
      particles.push({
        kind: 'petal', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 0.08, life: 900 + Math.random() * 500, max: 1400,
        size: cell * (0.18 + Math.random() * 0.14), color: PETALS[Math.floor(Math.random() * PETALS.length)], rot: a, vr: (Math.random() - 0.5) * 0.01, grav: 0.00018
      });
    }
  }

  function spawnPetal(x, y, burst) {
    particles.push({
      kind: 'petal', x, y, vx: (Math.random() - 0.5) * (burst ? 0.25 : 0.04), vy: burst ? -0.1 - Math.random() * 0.2 : 0.02,
      life: 1400 + Math.random() * 800, max: 2200, size: (LY.cell || 20) * (0.2 + Math.random() * 0.2),
      color: PETALS[Math.floor(Math.random() * PETALS.length)], rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.01, grav: 0.00012
    });
  }

  function initAmbient() {
    ambient.length = 0;
    for (let i = 0; i < 26; i++) {
      ambient.push({
        kind: i < 14 ? 'fly' : 'petal', x: Math.random(), y: Math.random(), ph: Math.random() * 6.28,
        sp: 0.3 + Math.random() * 0.7, size: 0.6 + Math.random() * 0.8, color: PETALS[i % PETALS.length]
      });
    }
  }

  function updateEffects(dt) {
    for (const arr of [particles, sparks, streaks, floaters]) {
      for (let i = arr.length - 1; i >= 0; i--) {
        const p = arr[i];
        p.life -= dt;
        if (p.life <= 0) { arr.splice(i, 1); continue; }
        if (p.vx !== undefined) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          if (p.grav) p.vy += p.grav * dt;
          if (p.vr) p.rot += p.vr * dt;
        }
      }
    }
    for (const a of ambient) {
      if (a.kind === 'fly') {
        a.ph += dt * 0.001 * a.sp;
        a.x += Math.cos(a.ph * 0.7) * 0.00002 * dt;
        a.y += Math.sin(a.ph) * 0.000015 * dt;
      } else {
        a.y += 0.00003 * dt * a.sp;
        a.x += Math.sin(a.ph + a.y * 6) * 0.00002 * dt;
        a.ph += dt * 0.0012;
        if (a.y > 1.05) { a.y = -0.05; a.x = Math.random(); }
      }
      if (a.x < -0.05) a.x = 1.05;
      if (a.x > 1.05) a.x = -0.05;
      if (a.y < -0.05) a.y = 1.05;
    }
  }

  function drawFlower(x, y, size, color, rot, open) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    const r = size * 0.5 * open;
    ctx.fillStyle = color;
    for (let i = 0; i < 5; i++) {
      ctx.rotate((Math.PI * 2) / 5);
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.55, r * 0.32, r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 5; i++) {
      ctx.rotate((Math.PI * 2) / 5);
      ctx.beginPath();
      ctx.ellipse(0, -r * 0.6, r * 0.12, r * 0.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.28, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd34d';
    ctx.fill();
    ctx.lineWidth = Math.max(1, r * 0.06);
    ctx.strokeStyle = '#d48a1e';
    ctx.stroke();
    ctx.restore();
  }

  function drawPetal(x, y, size, color, rot, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, size * 0.35, size * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawEffects() {
    for (const s of streaks) {
      const k = s.life / s.max;
      const grd = ctx.createLinearGradient(0, s.y0, 0, s.y1);
      grd.addColorStop(0, rgba(s.color, 0));
      grd.addColorStop(1, rgba(s.color, 0.45 * k));
      ctx.fillStyle = grd;
      ctx.fillRect(s.x - LY.cell * 0.4, s.y0, LY.cell * 0.8, s.y1 - s.y0);
    }
    for (const p of particles) {
      const k = p.life / p.max;
      if (p.kind === 'flower') {
        const age = 1 - k;
        const open = easeOutBack(clamp(age * 3, 0, 1));
        ctx.globalAlpha = clamp(k * 2.5, 0, 1);
        drawFlower(p.x, p.y, p.size, p.color, p.rot + age * 0.8, open);
        ctx.globalAlpha = 1;
      } else {
        drawPetal(p.x, p.y, p.size, p.color, p.rot, clamp(k * 1.5, 0, 1));
      }
    }
    for (const s of sparks) {
      ctx.globalAlpha = s.life / s.max;
      ctx.fillStyle = s.color;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const f of floaters) {
      const k = f.life / f.max;
      const age = 1 - k;
      ctx.globalAlpha = clamp(k * 2, 0, 1);
      ctx.font = font(f.size * (0.8 + 0.2 * easeOutBack(clamp(age * 4, 0, 1))));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = Math.max(2, f.size * 0.14);
      ctx.strokeStyle = 'rgba(40,20,50,0.85)';
      const y = f.y - age * LY.cell * 1.6;
      ctx.strokeText(f.text, f.x, y);
      ctx.fillStyle = '#fff3c4';
      ctx.fillText(f.text, f.x, y);
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------ layout
  let LY = { cell: 20, bx: 0, by: 0, mode: 'land' };

  function computeLayout() {
    const W = VW;
    const H = VH;
    const pad = Math.round(clamp(Math.min(W, H) * 0.025, 6, 24));
    const side = 5.4;
    const gap = 0.45;
    const cA = Math.min((H - pad * 2) / 20.4, (W - pad * 2) / (10 + 2 * (side + gap) + 0.4));
    const hud = 4.7;
    const cB = Math.min((H - pad * 2) / (20.4 + hud), (W - pad * 2) / 10.4);
    if (cA >= cB) {
      const c = Math.max(6, Math.floor(cA));
      const bw = c * 10;
      const bh = c * 20;
      const bx = Math.round((W - bw) / 2);
      const by = Math.round((H - bh) / 2);
      const pw = side * c;
      const lx = bx - gap * c - pw;
      const rx = bx + bw + gap * c;
      LY = {
        mode: 'land', cell: c, bx, by, pad,
        hold: { x: lx, y: by, w: pw, h: 4.2 * c },
        stats: { x: lx, y: by + 4.7 * c, w: pw, h: 9.2 * c },
        next: { x: rx, y: by, w: pw, h: 12.2 * c },
        pauseBtn: { x: rx, y: by + bh - 2 * c, w: 2.4 * c, h: 2 * c },
        muteBtn: { x: rx + pw - 2.4 * c, y: by + bh - 2 * c, w: 2.4 * c, h: 2 * c }
      };
    } else {
      const c = Math.max(6, Math.floor(cB));
      const bw = c * 10;
      const bh = c * 20;
      const total = (hud + 20.4) * c;
      const top = Math.round((H - total) / 2);
      const bx = Math.round((W - bw) / 2);
      const by = Math.round(top + hud * c + 0.4 * c);
      const rowY = top + 1.7 * c;
      const rowH = 2.85 * c;
      LY = {
        mode: 'port', cell: c, bx, by, pad,
        pauseBtn: { x: bx, y: top, w: 1.9 * c, h: 1.45 * c },
        muteBtn: { x: bx + bw - 1.9 * c, y: top, w: 1.9 * c, h: 1.45 * c },
        title: { x: bx + 2.1 * c, y: top, w: bw - 4.2 * c, h: 1.45 * c },
        hold: { x: bx, y: rowY, w: 2.9 * c, h: rowH },
        next: { x: bx + bw - 4.1 * c, y: rowY, w: 4.1 * c, h: rowH },
        stats: { x: bx + 3.1 * c, y: rowY, w: bw - 7.4 * c, h: rowH }
      };
    }
  }

  // ------------------------------------------------------------ background
  function buildBackground() {
    bgCanvas = document.createElement('canvas');
    bgCanvas.width = canvas.width;
    bgCanvas.height = canvas.height;
    const g = bgCanvas.getContext('2d');
    const W = bgCanvas.width;
    const H = bgCanvas.height;
    const sky = g.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#1e2448');
    sky.addColorStop(0.45, '#3d3a6e');
    sky.addColorStop(0.78, '#8a5d82');
    sky.addColorStop(1, '#c98c7c');
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);
    const rnd = mulberry32(99);
    for (let i = 0; i < 90; i++) {
      g.globalAlpha = 0.25 + rnd() * 0.6;
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(rnd() * W, rnd() * H * 0.55, (0.5 + rnd() * 1.2) * DPR, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
    // moon
    const mx = W * 0.82;
    const my = H * 0.16;
    const mr = Math.min(W, H) * 0.06;
    const glow = g.createRadialGradient(mx, my, mr * 0.5, mx, my, mr * 4);
    glow.addColorStop(0, 'rgba(255,240,210,0.35)');
    glow.addColorStop(1, 'rgba(255,240,210,0)');
    g.fillStyle = glow;
    g.fillRect(mx - mr * 4, my - mr * 4, mr * 8, mr * 8);
    g.fillStyle = '#fff1d6';
    g.beginPath();
    g.arc(mx, my, mr, 0, Math.PI * 2);
    g.fill();
    // hills
    const hills = [
      { y: 0.72, amp: 0.05, col: '#4a3d6a', f: 1.3, p: 0.4 },
      { y: 0.8, amp: 0.045, col: '#2f3a55', f: 2.1, p: 1.7 },
      { y: 0.88, amp: 0.035, col: '#1d2a3a', f: 3.2, p: 3.1 }
    ];
    for (const h of hills) {
      g.fillStyle = h.col;
      g.beginPath();
      g.moveTo(0, H);
      for (let x = 0; x <= W; x += 4 * DPR) {
        const k = x / W;
        g.lineTo(x, H * (h.y + Math.sin(k * Math.PI * h.f + h.p) * h.amp + Math.sin(k * 17 + h.p) * h.amp * 0.15));
      }
      g.lineTo(W, H);
      g.closePath();
      g.fill();
    }
    // flower silhouettes on the front hill
    for (let i = 0; i < 40; i++) {
      const x = rnd() * W;
      const k = x / W;
      const baseY = H * (0.88 + Math.sin(k * Math.PI * 3.2 + 3.1) * 0.035 + Math.sin(k * 17 + 3.1) * 0.035 * 0.15);
      const hgt = (10 + rnd() * 26) * DPR * Math.min(1.6, Math.max(0.7, H / (800 * DPR)));
      g.strokeStyle = '#16212e';
      g.lineWidth = 1.5 * DPR;
      g.beginPath();
      g.moveTo(x, baseY + 4 * DPR);
      g.quadraticCurveTo(x + (rnd() - 0.5) * 8 * DPR, baseY - hgt * 0.5, x, baseY - hgt);
      g.stroke();
      g.fillStyle = PETALS[i % PETALS.length];
      g.globalAlpha = 0.55;
      g.beginPath();
      g.arc(x, baseY - hgt, (2 + rnd() * 2.5) * DPR, 0, Math.PI * 2);
      g.fill();
      g.globalAlpha = 1;
    }
  }

  function drawBackground() {
    if (!bgCanvas) buildBackground();
    ctx.drawImage(bgCanvas, 0, 0, VW, VH);
    const m = Math.min(VW, VH);
    for (const a of ambient) {
      const x = a.x * VW;
      const y = a.y * VH;
      if (a.kind === 'fly') {
        const glow = 0.5 + 0.5 * Math.sin(a.ph * 3);
        const r = m * 0.006 * a.size;
        ctx.fillStyle = `rgba(255,236,140,${0.12 * glow})`;
        ctx.beginPath();
        ctx.arc(x, y, r * 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `rgba(255,244,190,${0.5 + 0.5 * glow})`;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      } else {
        drawPetal(x, y, m * 0.018 * a.size, a.color, a.ph, 0.5);
      }
    }
  }

  // ------------------------------------------------------------ icons
  function iconPause(x, y, s, col) {
    ctx.fillStyle = col;
    rr(ctx, x - s * 0.32, y - s * 0.38, s * 0.22, s * 0.76, s * 0.06);
    ctx.fill();
    rr(ctx, x + s * 0.1, y - s * 0.38, s * 0.22, s * 0.76, s * 0.06);
    ctx.fill();
  }
  function iconPlay(x, y, s, col) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.28, y - s * 0.4);
    ctx.lineTo(x + s * 0.42, y);
    ctx.lineTo(x - s * 0.28, y + s * 0.4);
    ctx.closePath();
    ctx.fill();
  }
  function iconSound(x, y, s, on, col) {
    ctx.fillStyle = col;
    ctx.strokeStyle = col;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.45, y - s * 0.16);
    ctx.lineTo(x - s * 0.22, y - s * 0.16);
    ctx.lineTo(x + s * 0.05, y - s * 0.4);
    ctx.lineTo(x + s * 0.05, y + s * 0.4);
    ctx.lineTo(x - s * 0.22, y + s * 0.16);
    ctx.lineTo(x - s * 0.45, y + s * 0.16);
    ctx.closePath();
    ctx.fill();
    ctx.lineWidth = Math.max(1.5, s * 0.09);
    ctx.lineCap = 'round';
    if (on) {
      ctx.beginPath();
      ctx.arc(x + s * 0.08, y, s * 0.2, -0.9, 0.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x + s * 0.08, y, s * 0.38, -0.9, 0.9);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(x + s * 0.18, y - s * 0.18);
      ctx.lineTo(x + s * 0.46, y + s * 0.18);
      ctx.moveTo(x + s * 0.46, y - s * 0.18);
      ctx.lineTo(x + s * 0.18, y + s * 0.18);
      ctx.stroke();
    }
  }
  function iconBack(x, y, s, col) {
    ctx.strokeStyle = col;
    ctx.lineWidth = Math.max(2, s * 0.12);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x + s * 0.3, y);
    ctx.lineTo(x - s * 0.3, y);
    ctx.moveTo(x - s * 0.05, y - s * 0.28);
    ctx.lineTo(x - s * 0.32, y);
    ctx.lineTo(x - s * 0.05, y + s * 0.28);
    ctx.stroke();
  }
  function iconLock(x, y, s, col) {
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = Math.max(1.5, s * 0.1);
    ctx.beginPath();
    ctx.arc(x, y - s * 0.08, s * 0.2, Math.PI, 0);
    ctx.stroke();
    rr(ctx, x - s * 0.3, y - s * 0.08, s * 0.6, s * 0.44, s * 0.08);
    ctx.fill();
  }
  function star(x, y, r, filled) {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rad = i % 2 === 0 ? r : r * 0.45;
      ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
    }
    ctx.closePath();
    if (filled) {
      const grd = ctx.createLinearGradient(x, y - r, x, y + r);
      grd.addColorStop(0, '#fff09a');
      grd.addColorStop(1, '#f3a531');
      ctx.fillStyle = grd;
      ctx.fill();
      ctx.lineWidth = Math.max(1, r * 0.12);
      ctx.strokeStyle = '#a8621b';
      ctx.stroke();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fill();
      ctx.lineWidth = Math.max(1, r * 0.1);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.stroke();
    }
  }

  // ------------------------------------------------------------ buttons
  let buttons = [];
  let pressedId = null;
  let focusIdx = 0;
  let inputMode = 'key';

  function addButton(b) {
    buttons.push(b);
    return b;
  }

  function hit(b, x, y) {
    return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  }

  function drawButton(b) {
    const pressed = pressedId === b.id;
    const focusable = buttons.filter((q) => q.focus);
    const focused = inputMode === 'key' && b.focus && focusable[focusIdx % Math.max(1, focusable.length)] === b;
    ctx.save();
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const sc = pressed ? 0.95 : 1;
    ctx.translate(cx, cy);
    ctx.scale(sc, sc);
    ctx.translate(-cx, -cy);
    const r = Math.min(b.h * 0.5, b.r || b.h * 0.3);
    if (b.style === 'icon') {
      rr(ctx, b.x, b.y, b.w, b.h, r);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.stroke();
    } else {
      ctx.shadowColor = 'rgba(10,5,30,0.45)';
      ctx.shadowBlur = b.h * 0.25;
      ctx.shadowOffsetY = b.h * 0.08;
      rr(ctx, b.x, b.y, b.w, b.h, r);
      let grd;
      if (b.style === 'primary') {
        grd = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
        grd.addColorStop(0, '#ff9fc0');
        grd.addColorStop(1, '#f2785b');
      } else if (b.style === 'ad') {
        grd = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
        grd.addColorStop(0, '#6fe0b0');
        grd.addColorStop(1, '#2f9fb8');
      } else {
        grd = 'rgba(255,255,255,0.16)';
      }
      ctx.fillStyle = grd;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.lineWidth = Math.max(1.5, b.h * 0.04);
      ctx.strokeStyle = b.style === 'secondary' ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.45)';
      ctx.stroke();
      if (b.style !== 'secondary') {
        rr(ctx, b.x + b.h * 0.15, b.y + b.h * 0.08, b.w - b.h * 0.3, b.h * 0.3, b.h * 0.15);
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fill();
      }
    }
    if (focused) {
      rr(ctx, b.x - 4, b.y - 4, b.w + 8, b.h + 8, r + 4);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#fff3a8';
      ctx.stroke();
    }
    if (b.icon) b.icon(cx, cy, Math.min(b.w, b.h) * 0.6);
    if (b.label) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const hasSub = !!b.sub;
      fitFont(b.label, b.h * (hasSub ? 0.36 : 0.4), b.w * 0.86);
      ctx.fillStyle = b.style === 'secondary' ? '#ffffff' : '#3a1530';
      ctx.fillText(b.label, cx, cy - (hasSub ? b.h * 0.12 : 0));
      if (hasSub) {
        fitFont(b.sub, b.h * 0.22, b.w * 0.86, 700);
        ctx.fillStyle = b.style === 'secondary' ? 'rgba(255,255,255,0.75)' : 'rgba(58,21,48,0.75)';
        ctx.fillText(b.sub, cx, cy + b.h * 0.24);
      }
    }
    ctx.restore();
  }

  function muteButton(x, y, w, h) {
    addButton({
      id: 'mute', x, y, w, h, style: 'icon', r: h * 0.3,
      icon: (cx, cy, s) => iconSound(cx, cy, s * 0.9, !save.muted, '#fff'),
      action: toggleMute
    });
  }

  function toggleMute() {
    save.muted = !save.muted;
    Sound.setUserMuted(save.muted);
    if (!save.muted) Sound.unlock();
    writeSave();
  }

  // ------------------------------------------------------------ screens
  let screen = 'loading';
  let overlay = null;
  let overlayT = 0;
  let extPaused = false;
  let toast = null;
  let menuPieces = [];
  let now = 0;

  function showToast(text) {
    toast = { text, life: 2600 };
  }

  function goMenu(withAd) {
    screen = 'menu';
    overlay = null;
    G = null;
    tutStep = -1;
    focusIdx = 0;
    if (withAd) showInterstitial('menu');
  }

  function goLevels() {
    screen = 'levels';
    overlay = null;
    focusIdx = Math.max(0, save.unlocked - 1);
  }

  function startLevel(n) {
    G = newGame('level', n);
    screen = 'play';
    overlay = 'intro';
    overlayT = 0;
    focusIdx = 0;
    particles.length = sparks.length = streaks.length = floaters.length = 0;
  }

  function startEndless() {
    G = newGame('endless');
    screen = 'play';
    overlay = 'intro';
    overlayT = 0;
    focusIdx = 0;
    particles.length = sparks.length = streaks.length = floaters.length = 0;
  }

  function beginPlay() {
    overlay = null;
    if (!G.started) {
      G.started = true;
      spawn();
      tutStep = save.tut ? -1 : 0;
      tutFade = 0;
      sendMessage('level_started', G.mode === 'level' ? { world: 'garden', level: String(G.level) } : { world: 'endless' });
    }
  }

  function pauseGame() {
    if (screen !== 'play' || !G || overlay || G.over || !G.started) return;
    overlay = 'pause';
    overlayT = 0;
    focusIdx = 0;
    softKey = false;
    dasDir = 0;
    gesture = null;
    sendMessage('level_paused');
  }

  function resumeGame() {
    if (overlay !== 'pause') return;
    overlay = null;
    sendMessage('level_resumed');
  }

  function showWin() {
    overlay = 'win';
    overlayT = 0;
    focusIdx = 0;
    const n = G.level;
    let stars = 1;
    if (G.pieces <= G.par) stars = 3;
    else if (G.pieces <= Math.ceil(G.par * 1.7)) stars = 2;
    G.starsEarned = stars;
    save.stars[n] = Math.max(save.stars[n] | 0, stars);
    save.unlocked = Math.max(save.unlocked, Math.min(LEVEL_COUNT, n + 1));
    writeSave();
    Sound.play('win', 0.9);
    sendMessage('level_completed', { world: 'garden', level: String(n) });
    showInterstitial('level_completed');
  }

  function showLose() {
    overlay = 'lose';
    overlayT = 0;
    focusIdx = 0;
    if (G.mode === 'endless' && G.score > save.best) {
      save.best = G.score;
      G.newBest = true;
      writeSave();
    }
    Sound.play('lose', 0.9);
    sendMessage('level_failed', G.mode === 'level' ? { world: 'garden', level: String(G.level) } : { world: 'endless' });
    showInterstitial('game_over');
  }

  function retry() {
    if (G.mode === 'level') startLevel(G.level);
    else startEndless();
  }

  // ------------------------------------------------------------ rewarded revive
  let rewardPending = false;
  let rewardGranted = false;

  function canRevive() {
    return HAS_BRIDGE && G && !G.revived && !G.won && bridge.advertisement.isRewardedSupported;
  }

  function requestRevive() {
    if (!canRevive() || rewardPending) return;
    rewardPending = true;
    rewardGranted = false;
    try {
      bridge.advertisement.showRewarded('revive');
    } catch (e) {
      rewardPending = false;
      showToast(t('ad_failed'));
    }
  }

  function onRewardedState(state) {
    if (!rewardPending) return;
    if (state === 'rewarded') rewardGranted = true;
    if (state === 'closed' || state === 'failed') {
      rewardPending = false;
      if (rewardGranted) doRevive();
      else if (state === 'failed') showToast(t('ad_failed'));
      rewardGranted = false;
    }
  }

  function doRevive() {
    if (!G || G.revived || overlay !== 'lose') return;
    G.revived = true;
    for (let r = 0; r < HIDDEN + 9; r++) {
      for (let c = 0; c < COLS; c++) if (G.grid[r][c] !== SEED) G.grid[r][c] = 0;
    }
    G.over = false;
    G.endT = 0;
    G.riseCount = 0;
    overlay = null;
    for (let i = 0; i < 30; i++) spawnPetal(LY.bx + Math.random() * LY.cell * 10, LY.by + Math.random() * LY.cell * 9, true);
    Sound.play('bloom', 0.9);
    spawn();
  }

  // ------------------------------------------------------------ bridge helpers
  function sendMessage(msg, data) {
    if (!HAS_BRIDGE) return;
    try {
      const r = data ? bridge.platform.sendMessage(msg, data) : bridge.platform.sendMessage(msg);
      if (r && r.catch) r.catch(() => {});
    } catch (e) { /* not supported here */ }
  }

  function showInterstitial(placement) {
    if (!HAS_BRIDGE) return;
    try {
      if (bridge.advertisement.isInterstitialSupported) bridge.advertisement.showInterstitial(placement);
    } catch (e) { /* ad failed: the game simply continues */ }
  }

  // ------------------------------------------------------------ drawing: panels
  function panel(x, y, w, h, label) {
    rr(ctx, x, y, w, h, LY.cell * 0.4);
    ctx.fillStyle = 'rgba(24,20,52,0.86)';
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.stroke();
    if (label) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      fitFont(label.toUpperCase(), Math.max(11, LY.cell * 0.55), w * 0.9, 800);
      ctx.fillStyle = 'rgba(255,236,250,0.75)';
      ctx.fillText(label.toUpperCase(), x + w / 2, y + LY.cell * 0.3);
    }
  }

  function drawMini(type, cx, cy, size, alpha) {
    const cells = SHAPES[type][0];
    let minX = 9, maxX = -9, minY = 9, maxY = -9;
    for (const [x, y] of cells) {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    }
    const w = (maxX - minX + 1) * size;
    const h = (maxY - minY + 1) * size;
    const s = Math.round(size);
    for (const [x, y] of cells) {
      drawCell(TYPE_ID[type], Math.round(cx - w / 2 + (x - minX) * size), Math.round(cy - h / 2 + (y - minY) * size), s, alpha);
    }
  }

  function drawBoard() {
    const c = LY.cell;
    const bx = LY.bx;
    const by = LY.by;
    const bw = c * 10;
    const bh = c * 20;
    // planter frame
    const fr = c * 0.32;
    rr(ctx, bx - fr, by - fr, bw + fr * 2, bh + fr * 2, c * 0.45);
    const wood = ctx.createLinearGradient(bx - fr, 0, bx + bw + fr, 0);
    wood.addColorStop(0, '#5a3b27');
    wood.addColorStop(0.5, '#7b5236');
    wood.addColorStop(1, '#5a3b27');
    ctx.fillStyle = wood;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#3a2414';
    ctx.stroke();
    rr(ctx, bx, by, bw, bh, c * 0.2);
    const well = ctx.createLinearGradient(0, by, 0, by + bh);
    well.addColorStop(0, 'rgba(18,20,42,0.92)');
    well.addColorStop(1, 'rgba(30,24,40,0.95)');
    ctx.fillStyle = well;
    ctx.fill();
    ctx.save();
    rr(ctx, bx, by, bw, bh, c * 0.2);
    ctx.clip();
    // column stripes
    for (let x = 0; x < COLS; x += 2) {
      ctx.fillStyle = 'rgba(255,255,255,0.025)';
      ctx.fillRect(bx + x * c, by, c, bh);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let y = 1; y < VISIBLE; y++) {
      ctx.moveTo(bx, by + y * c + 0.5);
      ctx.lineTo(bx + bw, by + y * c + 0.5);
    }
    ctx.stroke();
    // danger glow
    let danger = false;
    for (let r = HIDDEN; r < HIDDEN + 4; r++) if (G.grid[r].some((v) => v)) danger = true;
    if (danger && !G.won) {
      const a = 0.18 + 0.12 * Math.sin(now * 0.008);
      const grd = ctx.createLinearGradient(0, by, 0, by + c * 6);
      grd.addColorStop(0, `rgba(255,80,90,${a})`);
      grd.addColorStop(1, 'rgba(255,80,90,0)');
      ctx.fillStyle = grd;
      ctx.fillRect(bx, by, bw, c * 6);
    }
    if (G.flash > 0) {
      ctx.fillStyle = `rgba(255,240,200,${G.flash * 0.25})`;
      ctx.fillRect(bx, by, bw, bh);
    }
    // settled cells
    const clearing = G.clearing;
    const clearSet = clearing ? new Set(clearing.rows) : null;
    const ck = clearing ? clearing.t / CLEAR_MS : 0;
    for (let r = HIDDEN; r < ROWS; r++) {
      const y = by + (r - HIDDEN) * c;
      const inClear = clearSet && clearSet.has(r);
      for (let x = 0; x < COLS; x++) {
        const v = G.grid[r][x];
        if (!v) continue;
        if (inClear) {
          const shrink = clamp(ck * 1.3 - Math.abs(x - 4.5) * 0.04, 0, 1);
          const s = c * (1 - shrink);
          if (s > 1) drawCell(v, bx + x * c + (c - s) / 2, y + (c - s) / 2, Math.round(s));
        } else {
          drawCell(v, bx + x * c, y, c);
          if (v === SEED) {
            const pulse = 0.5 + 0.5 * Math.sin(now * 0.004 + x + r);
            ctx.fillStyle = `rgba(190,255,150,${0.08 + 0.1 * pulse})`;
            ctx.beginPath();
            ctx.arc(bx + x * c + c / 2, y + c * 0.35, c * 0.42, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      }
      if (inClear) {
        ctx.fillStyle = `rgba(255,250,230,${0.55 * (1 - ck)})`;
        ctx.fillRect(bx, y, bw, c);
      }
    }
    // ghost and active piece
    if (G.piece && !overlay) {
      const p = G.piece;
      const gy = ghostY();
      const col = COLORS[TYPE_ID[p.type]];
      if (gy !== p.y) {
        for (const [cx, cy] of SHAPES[p.type][p.rot]) {
          const yy = gy + cy;
          if (yy < HIDDEN) continue;
          const x = bx + (p.x + cx) * c;
          const y = by + (yy - HIDDEN) * c;
          rr(ctx, x + c * 0.08, y + c * 0.08, c * 0.84, c * 0.84, c * 0.2);
          ctx.fillStyle = rgba(col, 0.14);
          ctx.fill();
          ctx.lineWidth = Math.max(1, c * 0.07);
          ctx.strokeStyle = rgba(col, 0.55);
          ctx.stroke();
        }
      }
      const lockGlow = G.lockT > 0 ? 0.25 * (G.lockT / LOCK_DELAY) : 0;
      for (const [cx, cy] of SHAPES[p.type][p.rot]) {
        const yy = p.y + cy;
        if (yy < HIDDEN) continue;
        const x = bx + (p.x + cx) * c;
        const y = by + (yy - HIDDEN) * c;
        drawCell(TYPE_ID[p.type], x, y, c);
        if (lockGlow > 0) {
          ctx.fillStyle = `rgba(255,255,255,${lockGlow})`;
          rr(ctx, x + c * 0.05, y + c * 0.05, c * 0.9, c * 0.9, c * 0.2);
          ctx.fill();
        }
      }
    } else if (G.piece && overlay === 'pause') {
      // keep the block visible but dim under the pause card
      const p = G.piece;
      for (const [cx, cy] of SHAPES[p.type][p.rot]) {
        const yy = p.y + cy;
        if (yy < HIDDEN) continue;
        drawCell(TYPE_ID[p.type], bx + (p.x + cx) * c, by + (yy - HIDDEN) * c, c, 0.6);
      }
    }
    ctx.restore();
  }

  function tutorialActive() {
    return tutStep >= 0 && !overlay && G && G.started && !G.over;
  }

  // The hint sits outside the well: in the free right column in landscape,
  // in the title bar in portrait, so it never covers blocks.
  function drawTutorialHint() {
    if (!tutorialActive()) return;
    const step = TUT_STEPS[tutStep];
    const text = t('tut_' + step + (inputMode === 'touch' ? '_t' : '_k'));
    const c = LY.cell;
    let box;
    if (LY.mode === 'land') {
      const top = LY.next.y + LY.next.h + c * 0.4;
      box = { x: LY.next.x, y: top, w: LY.next.w, h: LY.pauseBtn.y - c * 0.4 - top };
    } else {
      box = LY.title;
    }
    tutFade = Math.min(1, tutFade + 0.05);
    const pulse = 0.5 + 0.5 * Math.sin(now * 0.006);
    ctx.globalAlpha = tutFade;
    rr(ctx, box.x, box.y, box.w, box.h, Math.min(c * 0.4, box.h * 0.3));
    ctx.fillStyle = 'rgba(255,245,252,0.95)';
    ctx.fill();
    ctx.lineWidth = 2 + pulse;
    ctx.strokeStyle = `rgba(255,159,192,${0.5 + 0.5 * pulse})`;
    ctx.stroke();
    const dotsH = LY.mode === 'land' ? c * 0.7 : 0;
    const padX = Math.max(6, c * 0.3);
    const padY = Math.max(4, c * 0.2);
    const availH = box.h - padY * 2 - dotsH;
    let px = LY.mode === 'land' ? Math.max(12, c * 0.6) : Math.max(12, c * 0.5);
    let lines;
    let lh;
    for (;;) {
      ctx.font = font(px, 800);
      lines = wrapLines(text, box.w - padX * 2);
      lh = px * 1.18;
      const widest = Math.max(...lines.map((l) => ctx.measureText(l).width));
      if ((lines.length * lh <= availH && widest <= box.w - padX * 2) || px <= 9) break;
      px -= 0.5;
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#4a1f45';
    const y0 = box.y + padY + (availH - lines.length * lh) / 2;
    lines.forEach((ln, i) => ctx.fillText(ln, box.x + box.w / 2, y0 + lh * (i + 0.5)));
    if (dotsH) {
      for (let i = 0; i < TUT_STEPS.length; i++) {
        ctx.beginPath();
        ctx.arc(box.x + box.w / 2 + (i - 1.5) * c * 0.5, box.y + box.h - dotsH * 0.55, c * 0.11, 0, Math.PI * 2);
        ctx.fillStyle = i <= tutStep ? '#ff7fac' : 'rgba(74,31,69,0.25)';
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawHoldPanel() {
    const b = LY.hold;
    panel(b.x, b.y, b.w, b.h, t('hold'));
    const c = LY.cell;
    if (G.hold) {
      const size = LY.mode === 'land' ? c * 0.85 : c * 0.55;
      drawMini(G.hold, b.x + b.w / 2, b.y + b.h * 0.6, size, G.holdUsed ? 0.4 : 1);
    }
    if (screen === 'play' && !overlay) {
      addButton({ id: 'hold', x: b.x, y: b.y, w: b.w, h: b.h, invisible: true, action: actHold });
    }
  }

  function drawNextPanel() {
    const b = LY.next;
    panel(b.x, b.y, b.w, b.h, t('next'));
    const c = LY.cell;
    if (LY.mode === 'land') {
      let y = b.y + c * 2.6;
      for (let i = 0; i < 4; i++) {
        const size = i === 0 ? c * 0.85 : c * 0.62;
        drawMini(G.queue[i], b.x + b.w / 2, y, size, i === 0 ? 1 : 0.8);
        y += i === 0 ? c * 2.9 : c * 2.3;
      }
    } else {
      const y = b.y + b.h * 0.62;
      drawMini(G.queue[0], b.x + b.w * 0.36, y, c * 0.5, 1);
      drawMini(G.queue[1], b.x + b.w * 0.8, y, c * 0.3, 0.75);
    }
  }

  function statLine(label, value, x, y, w, sizeL, sizeV) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    fitFont(label.toUpperCase(), sizeL, w, 800);
    ctx.fillStyle = 'rgba(255,236,250,0.65)';
    ctx.fillText(label.toUpperCase(), x, y);
    fitFont(value, sizeV, w, 800);
    ctx.fillStyle = '#fff';
    ctx.fillText(value, x, y + sizeV * 1.05);
  }

  function seedsText() {
    return (G.seedsTotal - G.seedsLeft) + ' / ' + G.seedsTotal;
  }

  function drawStatsPanel() {
    const b = LY.stats;
    const c = LY.cell;
    if (LY.mode === 'land') {
      panel(b.x, b.y, b.w, b.h, null);
      const x = b.x + c * 0.5;
      const w = b.w - c;
      const sl = Math.max(11, c * 0.5);
      const sv = Math.max(14, c * 0.85);
      const title = G.mode === 'level' ? t('level', G.level) : t('endless');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      fitFont(title, Math.max(13, c * 0.72), w, 800);
      ctx.fillStyle = '#ffd6e8';
      ctx.fillText(title, b.x + b.w / 2, b.y + c * 0.4);
      let y = b.y + c * 2.1;
      statLine(t('score'), fmt(G.score), x, y, w, sl, sv);
      y += c * 2.15;
      if (G.mode === 'level') {
        statLine(t('seeds'), seedsText(), x, y, w, sl, sv);
        y += c * 2.15;
        if (G.riseEvery) statLine(t('weeds_in', ''), String(G.riseEvery - G.riseCount), x, y, w, sl, sv);
      } else {
        statLine(t('lines'), fmt(G.lines), x, y, w, sl, sv);
        y += c * 2.15;
        statLine(t('speed'), String(G.speed), x, y, w, sl, sv);
      }
    } else {
      panel(b.x, b.y, b.w, b.h, null);
      const cx = b.x + b.w / 2;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitFont(fmt(G.score), Math.max(14, c * 0.9), b.w * 0.9, 800);
      ctx.fillStyle = '#fff';
      ctx.fillText(fmt(G.score), cx, b.y + b.h * 0.3);
      let sub;
      if (G.mode === 'level') {
        sub = t('seeds') + ' ' + seedsText();
        if (G.riseEvery) sub += '   ' + t('weeds_in', G.riseEvery - G.riseCount);
      } else sub = t('lines') + ' ' + G.lines + '   ' + t('speed') + ' ' + G.speed;
      fitFont(sub, Math.max(11, c * 0.5), b.w * 0.92, 700);
      ctx.fillStyle = 'rgba(255,236,250,0.8)';
      ctx.fillText(sub, cx, b.y + b.h * 0.72);
    }
  }

  function drawPlay() {
    const c = LY.cell;
    ctx.save();
    if (G.shake > 0) ctx.translate((Math.random() - 0.5) * G.shake, (Math.random() - 0.5) * G.shake);
    drawBoard();
    drawEffects();
    ctx.restore();
    drawHoldPanel();
    drawNextPanel();
    drawStatsPanel();
    drawTutorialHint();
    if (LY.mode === 'port' && !tutorialActive()) {
      const tb = LY.title;
      const title = G.mode === 'level' ? t('level', G.level) : t('endless');
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      fitFont(title, Math.max(13, c * 0.75), tb.w, 800);
      ctx.fillStyle = '#ffd6e8';
      ctx.fillText(title, tb.x + tb.w / 2, tb.y + tb.h / 2);
    }
    const pb = LY.pauseBtn;
    if (!overlay) addButton({
      id: 'pause', x: pb.x, y: pb.y, w: pb.w, h: pb.h, style: 'icon', r: pb.h * 0.3,
      icon: (x, y, s) => iconPause(x, y, s * 0.8, '#fff'),
      action: pauseGame
    });
    const mb = LY.muteBtn;
    muteButton(mb.x, mb.y, mb.w, mb.h);
    if (overlay) drawOverlay();
  }

  // ------------------------------------------------------------ overlays
  function card(w, h) {
    ctx.fillStyle = 'rgba(12,10,30,0.62)';
    ctx.fillRect(0, 0, VW, VH);
    const x = (VW - w) / 2;
    const y = (VH - h) / 2;
    ctx.save();
    ctx.globalAlpha = clamp(overlayT / 150, 0, 1);
    rr(ctx, x, y, w, h, Math.min(28, w * 0.06));
    const grd = ctx.createLinearGradient(0, y, 0, y + h);
    grd.addColorStop(0, '#3b2f6a');
    grd.addColorStop(1, '#2a2350');
    ctx.fillStyle = grd;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,200,230,0.35)';
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
    return { x, y, w, h };
  }

  function cardMetrics() {
    const w = Math.min(VW - 32, 440, Math.max(260, VH * 0.75));
    const u = clamp(Math.min(w / 12, VH / 22), 14, 34);
    return { w, u };
  }

  function drawOverlay() {
    const { w, u } = cardMetrics();
    const bh = u * 2.3;
    const bw = w - u * 2.4;
    const items = [];
    let title = '';
    let titleColor = '#fff';
    const body = [];
    let starsRow = 0;
    if (overlay === 'intro') {
      if (G.mode === 'level') {
        title = t('level', G.level);
        body.push({ text: G.seedsTotal === 1 ? t('goal_level_one') : t('goal_level', G.seedsTotal), size: 0.85, color: '#ffe9a8' });
        if (G.level <= 3 || !save.tut) body.push({ text: t('goal_hint'), size: 0.7, color: 'rgba(255,255,255,0.85)', seedIcon: true });
        if (G.riseEvery) body.push({ text: t('weeds_rule', G.riseEvery), size: 0.7, color: '#b9f0a0' });
      } else {
        title = t('endless');
        body.push({ text: t('endless_goal'), size: 0.75, color: 'rgba(255,255,255,0.9)' });
        if (save.best > 0) body.push({ text: t('best', fmt(save.best)), size: 0.8, color: '#ffe9a8' });
      }
      items.push({ label: t('tap_start'), style: 'primary', action: beginPlay, icon: null });
    } else if (overlay === 'pause') {
      title = t('paused');
      items.push({ label: t('resume'), style: 'primary', action: resumeGame });
      items.push({ label: t('restart'), style: 'secondary', action: retry });
      items.push({ label: t('menu'), style: 'secondary', action: () => goMenu(true) });
    } else if (overlay === 'win') {
      title = t('win_title');
      titleColor = '#ffe08a';
      starsRow = G.starsEarned;
      body.push({ text: t('score') + ' ' + fmt(G.score), size: 0.85, color: '#fff' });
      if (G.level >= LEVEL_COUNT) body.push({ text: t('all_done'), size: 0.75, color: '#b9f0a0' });
      if (G.level < LEVEL_COUNT) items.push({ label: t('next_level'), style: 'primary', action: () => startLevel(G.level + 1) });
      items.push({ label: t('retry'), style: 'secondary', action: retry });
      items.push({ label: t('menu'), style: 'secondary', action: () => goMenu(false) });
    } else if (overlay === 'lose') {
      title = G.mode === 'level' ? t('lose_title') : t('endless_over');
      titleColor = '#ffb0b0';
      body.push({ text: t('score') + ' ' + fmt(G.score), size: 0.85, color: '#fff' });
      if (G.mode === 'endless') body.push({ text: G.newBest ? t('new_best') : t('best', fmt(save.best)), size: 0.75, color: '#ffe9a8' });
      else body.push({ text: t('seeds') + ' ' + seedsText(), size: 0.75, color: '#ffe9a8' });
      if (canRevive()) items.push({ label: t('revive'), style: 'ad', action: requestRevive, adIcon: true });
      items.push({ label: t('retry'), style: canRevive() ? 'secondary' : 'primary', action: retry });
      items.push({ label: t('menu'), style: 'secondary', action: () => goMenu(false) });
    }
    // measure
    ctx.font = font(u * 1.25);
    const titleH = u * 2.2;
    const bodyLayout = body.map((b) => {
      ctx.font = font(u * b.size, 700);
      const lines = wrapLines(b.text, w - u * 2.4);
      return { ...b, lines, lh: u * b.size * 1.3 };
    });
    let h = u * 1.2 + titleH;
    if (starsRow) h += u * 3;
    for (const b of bodyLayout) h += b.lines.length * b.lh + u * 0.5;
    h += u * 0.4 + items.length * (bh + u * 0.6) + u * 0.6;
    h = Math.min(h, VH - 16);
    const cd = card(w, h);
    if (overlayT < 150) ctx.globalAlpha = overlayT / 150;
    let y = cd.y + u * 1.2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitFont(title, u * 1.35, w - u * 2);
    ctx.fillStyle = titleColor;
    ctx.fillText(title, VW / 2, y + titleH * 0.4);
    y += titleH;
    if (starsRow) {
      for (let i = 0; i < 3; i++) {
        const k = easeOutBack(clamp((overlayT - 250 - i * 180) / 300, 0, 1));
        const r = u * (i === 1 ? 1.25 : 1.0) * Math.max(0.01, k);
        star(VW / 2 + (i - 1) * u * 2.6, y + u * 1.3 - (i === 1 ? u * 0.3 : 0), r, i < starsRow);
      }
      y += u * 3;
    }
    for (const b of bodyLayout) {
      ctx.font = font(u * b.size, 700);
      ctx.fillStyle = b.color;
      for (const ln of b.lines) {
        ctx.fillText(ln, VW / 2, y + b.lh / 2);
        y += b.lh;
      }
      y += u * 0.5;
    }
    y += u * 0.4;
    ctx.globalAlpha = 1;
    const bx = (VW - bw) / 2;
    items.forEach((it, i) => {
      addButton({
        id: 'ov' + i, x: bx, y, w: bw, h: bh, style: it.style, label: it.label, action: it.action, focus: true, r: bh * 0.5
      });
      y += bh + u * 0.6;
    });
  }

  // ------------------------------------------------------------ menu
  function initMenuPieces() {
    menuPieces = [];
    for (let i = 0; i < 9; i++) {
      menuPieces.push({ type: TYPES[i % 7], x: Math.random(), y: Math.random() * 1.2 - 0.2, sp: 0.02 + Math.random() * 0.03, rot: Math.floor(Math.random() * 4), s: 0.7 + Math.random() * 0.6 });
    }
  }

  function drawMenuPieces(dt) {
    const m = Math.min(VW, VH);
    const size = Math.round(m * 0.045);
    for (const p of menuPieces) {
      p.y += p.sp * dt * 0.001;
      if (p.y > 1.15) { p.y = -0.15; p.x = Math.random(); p.type = TYPES[Math.floor(Math.random() * 7)]; }
      const s = Math.round(size * p.s);
      for (const [cx, cy] of SHAPES[p.type][p.rot]) drawCell(TYPE_ID[p.type], p.x * VW + cx * s, p.y * VH + cy * s, s, 0.35);
    }
  }

  function drawTitle(cx, cy, size) {
    // flower crest
    drawFlower(cx - size * 2.35, cy - size * 0.05, size * 0.95, '#ff9ec7', now * 0.0004, 1);
    drawFlower(cx + size * 2.35, cy - size * 0.05, size * 0.75, '#ffd36e', -now * 0.0005, 1);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = font(size, 900);
    const grd = ctx.createLinearGradient(0, cy - size / 2, 0, cy + size / 2);
    grd.addColorStop(0, '#fff3c9');
    grd.addColorStop(0.5, '#ffb3d1');
    grd.addColorStop(1, '#f07fa8');
    ctx.lineJoin = 'round';
    ctx.lineWidth = size * 0.16;
    ctx.strokeStyle = '#3a1940';
    ctx.strokeText(TITLE, cx, cy);
    ctx.fillStyle = grd;
    ctx.fillText(TITLE, cx, cy);
  }

  function drawMenu(dt) {
    drawMenuPieces(dt);
    const m = Math.min(VW, VH);
    const portrait = VH > VW;
    const tsize = Math.min(VW * 0.13, VH * 0.12, 120);
    const ty = VH * (portrait ? 0.27 : 0.25);
    drawTitle(VW / 2, ty, tsize);
    ctx.font = font(Math.max(13, tsize * 0.26), 700);
    ctx.fillStyle = 'rgba(255,240,250,0.85)';
    ctx.textAlign = 'center';
    fitFont(t('tagline'), Math.max(13, tsize * 0.26), VW - 40, 700);
    ctx.fillText(t('tagline'), VW / 2, ty + tsize * 0.85);
    const bw = Math.min(VW * 0.72, 360);
    const bh = clamp(m * 0.13, 52, 82);
    let y = Math.max(ty + tsize * 1.35, VH * 0.5);
    addButton({
      id: 'play', x: (VW - bw) / 2, y, w: bw, h: bh, style: 'primary', label: t('play'), sub: t('continue_level', save.unlocked),
      action: goLevels, focus: true, r: bh * 0.5
    });
    y += bh + bh * 0.3;
    addButton({
      id: 'endless', x: (VW - bw) / 2, y, w: bw, h: bh, style: 'secondary', label: t('endless'), sub: save.best ? t('best', fmt(save.best)) : '',
      action: startEndless, focus: true, r: bh * 0.5
    });
    y += bh + bh * 0.35;
    // stars total
    const st = totalStars();
    if (st > 0) {
      const sy = y + bh * 0.2;
      ctx.font = font(Math.max(13, bh * 0.28), 800);
      const txt = t('stars', st, LEVEL_COUNT * 3);
      const tw = ctx.measureText(txt).width;
      star(VW / 2 - tw / 2 - bh * 0.25, sy, bh * 0.18, true);
      ctx.fillStyle = '#ffe9a8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(txt, VW / 2 + bh * 0.1, sy);
    }
    const ib = clamp(m * 0.1, 44, 64);
    muteButton(VW - ib - 14, 14, ib, ib);
  }

  function drawLevels() {
    const m = Math.min(VW, VH);
    const ib = clamp(m * 0.1, 44, 64);
    addButton({
      id: 'back', x: 14, y: 14, w: ib, h: ib, style: 'icon', r: ib * 0.3,
      icon: (x, y, s) => iconBack(x, y, s * 0.9, '#fff'), action: () => goMenu(false)
    });
    muteButton(VW - ib - 14, 14, ib, ib);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitFont(t('levels'), Math.max(16, ib * 0.5), VW - ib * 2 - 60, 900);
    ctx.fillStyle = '#ffe3f0';
    ctx.fillText(t('levels'), VW / 2, 14 + ib / 2);
    const cols = VW > VH * 1.15 ? 8 : 5;
    const rows = Math.ceil(LEVEL_COUNT / cols);
    const top = 14 + ib + 16;
    const availW = VW - 28;
    const availH = VH - top - 14;
    const sz = Math.min(availW / cols, availH / rows, 110);
    const gw = sz * cols;
    const gx = (VW - gw) / 2;
    const gy = top + (availH - sz * rows) / 2;
    for (let i = 0; i < LEVEL_COUNT; i++) {
      const n = i + 1;
      const c = i % cols;
      const r = Math.floor(i / cols);
      const b = sz * 0.86;
      const x = gx + c * sz + (sz - b) / 2;
      const y = gy + r * sz + (sz - b) / 2;
      const unlocked = n <= save.unlocked;
      const st = save.stars[n] | 0;
      const btn = addButton({ id: 'lv' + n, x, y, w: b, h: b, invisible: true, focus: true, action: unlocked ? () => startLevel(n) : () => Sound.play('lock', 0.6) });
      const pressed = pressedId === btn.id;
      ctx.save();
      if (pressed) {
        ctx.translate(x + b / 2, y + b / 2);
        ctx.scale(0.94, 0.94);
        ctx.translate(-(x + b / 2), -(y + b / 2));
      }
      rr(ctx, x, y, b, b, b * 0.22);
      if (unlocked) {
        const grd = ctx.createLinearGradient(0, y, 0, y + b);
        if (st > 0) {
          grd.addColorStop(0, '#8fe08a');
          grd.addColorStop(1, '#3f9b62');
        } else {
          grd.addColorStop(0, '#ffa9c8');
          grd.addColorStop(1, '#e86e93');
        }
        ctx.fillStyle = grd;
      } else ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = unlocked ? 'rgba(255,255,255,0.5)' : 'rgba(255,255,255,0.15)';
      ctx.stroke();
      if (n === save.unlocked && !st) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = `rgba(255,243,168,${0.5 + 0.5 * Math.sin(now * 0.006)})`;
        rr(ctx, x - 3, y - 3, b + 6, b + 6, b * 0.25);
        ctx.stroke();
      }
      if (inputMode === 'key' && focusIdx === i) {
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#fff3a8';
        rr(ctx, x - 5, y - 5, b + 10, b + 10, b * 0.27);
        ctx.stroke();
      }
      if (unlocked) {
        ctx.font = font(b * 0.38, 900);
        ctx.fillStyle = '#3a1530';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(n), x + b / 2, y + b * (st ? 0.42 : 0.5));
        if (st) for (let s = 0; s < 3; s++) star(x + b / 2 + (s - 1) * b * 0.24, y + b * 0.76, b * 0.1, s < st);
      } else iconLock(x + b / 2, y + b / 2, b * 0.5, 'rgba(255,255,255,0.45)');
      ctx.restore();
    }
  }

  function drawLoading() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const size = Math.min(VW * 0.13, VH * 0.12, 120);
    drawTitle(VW / 2, VH * 0.42, size);
    const w = Math.min(VW * 0.5, 260);
    const h = 8;
    rr(ctx, (VW - w) / 2, VH * 0.6, w, h, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fill();
    rr(ctx, (VW - w) / 2, VH * 0.6, w * loadProgress, h, 4);
    ctx.fillStyle = '#ff9fc0';
    ctx.fill();
  }

  function drawToast(dt) {
    if (!toast) return;
    toast.life -= dt;
    if (toast.life <= 0) { toast = null; return; }
    const a = clamp(toast.life / 300, 0, 1);
    ctx.globalAlpha = a;
    const size = clamp(Math.min(VW, VH) * 0.04, 13, 20);
    ctx.font = font(size, 800);
    const w = Math.min(VW - 32, ctx.measureText(toast.text).width + size * 2);
    const h = size * 2.4;
    const x = (VW - w) / 2;
    const y = VH - h - Math.max(16, VH * 0.06);
    rr(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = 'rgba(255,245,252,0.95)';
    ctx.fill();
    ctx.fillStyle = '#4a1f45';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    fitFont(toast.text, size, w - size, 800);
    ctx.fillText(toast.text, VW / 2, y + h / 2);
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------ main loop
  let last = 0;
  let loadProgress = 0;
  let readySent = false;

  function frame(ts) {
    const dt = last ? clamp(ts - last, 0, 50) : 16;
    last = ts;
    if (!extPaused) {
      now += dt;
      update(dt);
      updateEffects(dt);
      if (overlay) overlayT += dt;
    }
    render(extPaused ? 0 : dt);
    if (!readySent && screen === 'menu') {
      readySent = true;
      sendMessage('game_ready');
    }
    requestAnimationFrame(frame);
  }

  function render(dt) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    buttons = [];
    drawBackground();
    if (screen === 'loading') drawLoading();
    else if (screen === 'menu') drawMenu(dt);
    else if (screen === 'levels') drawLevels();
    else if (screen === 'play' && G) drawPlay();
    for (const b of buttons) if (!b.invisible) drawButton(b);
    drawToast(dt);
  }

  // ------------------------------------------------------------ input
  const keys = new Set();
  let dasDir = 0;
  let dasT = 0;
  let arrT = 0;
  let softKey = false;
  let gesture = null;

  function focusMove(d) {
    const f = buttons.filter((b) => b.focus);
    if (!f.length) return;
    focusIdx = (focusIdx + d + f.length * 10) % f.length;
  }

  function activateFocused() {
    const f = buttons.filter((b) => b.focus);
    if (!f.length) return;
    const b = f[focusIdx % f.length];
    Sound.play('click', 0.7);
    b.action();
  }

  function onKeyDown(e) {
    const k = e.code;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(k)) e.preventDefault();
    inputMode = 'key';
    Sound.unlock();
    if (e.repeat) return;
    keys.add(k);
    if (k === 'KeyM') { toggleMute(); return; }
    if (screen === 'play' && G && !overlay && G.started) {
      if (k === 'KeyP') { pauseGame(); return; }
      if (!G.piece) return;
      if (k === 'ArrowLeft' || k === 'KeyA') { actMove(-1); dasDir = -1; dasT = 0; arrT = 0; }
      else if (k === 'ArrowRight' || k === 'KeyD') { actMove(1); dasDir = 1; dasT = 0; arrT = 0; }
      else if (k === 'ArrowDown' || k === 'KeyS') { softKey = true; }
      else if (k === 'ArrowUp' || k === 'KeyX' || k === 'KeyW') actRotate(1);
      else if (k === 'KeyZ' || k === 'ControlLeft' || k === 'ControlRight') actRotate(-1);
      else if (k === 'Space') actHardDrop();
      else if (k === 'KeyC' || k === 'ShiftLeft' || k === 'ShiftRight') actHold();
      return;
    }
    if (screen === 'play' && overlay === 'pause' && k === 'KeyP') { resumeGame(); return; }
    if (screen === 'loading') return;
    if (screen === 'levels') {
      if (k === 'ArrowLeft') focusMove(-1);
      else if (k === 'ArrowRight') focusMove(1);
      else if (k === 'ArrowUp' || k === 'ArrowDown') {
        const cols = VW > VH * 1.15 ? 8 : 5;
        const f = buttons.filter((b) => b.focus);
        const ni = focusIdx + (k === 'ArrowUp' ? -cols : cols);
        if (ni >= 0 && ni < f.length) focusIdx = ni;
      } else if (k === 'Enter' || k === 'Space') activateFocused();
      else if (k === 'Backspace') goMenu(false);
      return;
    }
    if (k === 'ArrowUp' || k === 'ArrowLeft') focusMove(-1);
    else if (k === 'ArrowDown' || k === 'ArrowRight') focusMove(1);
    else if (k === 'Enter' || k === 'Space') activateFocused();
  }

  function onKeyUp(e) {
    const k = e.code;
    keys.delete(k);
    if (k === 'ArrowDown' || k === 'KeyS') softKey = keys.has('ArrowDown') || keys.has('KeyS');
    if ((k === 'ArrowLeft' || k === 'KeyA') && dasDir < 0) {
      dasDir = keys.has('ArrowRight') || keys.has('KeyD') ? 1 : 0;
      dasT = 0;
    }
    if ((k === 'ArrowRight' || k === 'KeyD') && dasDir > 0) {
      dasDir = keys.has('ArrowLeft') || keys.has('KeyA') ? -1 : 0;
      dasT = 0;
    }
  }

  function pos(e) {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function findButton(x, y) {
    for (let i = buttons.length - 1; i >= 0; i--) if (hit(buttons[i], x, y)) return buttons[i];
    return null;
  }

  function onPointerDown(e) {
    e.preventDefault();
    Sound.unlock();
    inputMode = e.pointerType === 'mouse' ? 'key' : 'touch';
    const { x, y } = pos(e);
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    const b = findButton(x, y);
    if (b && b.id !== 'hold') {
      pressedId = b.id;
      gesture = null;
      return;
    }
    if (screen === 'play' && G && !overlay && G.started) {
      gesture = {
        id: e.pointerId, x0: x, y0: y, ax: x, ay: y, t0: performance.now(), axis: null, moved: false,
        samples: [{ x, y, t: performance.now() }], holdBtn: b
      };
    } else if (b) {
      pressedId = b.id;
    }
  }

  function onPointerMove(e) {
    if (!gesture || e.pointerId !== gesture.id) return;
    e.preventDefault();
    const { x, y } = pos(e);
    const tnow = performance.now();
    gesture.samples.push({ x, y, t: tnow });
    while (gesture.samples.length > 2 && tnow - gesture.samples[0].t > 120) gesture.samples.shift();
    const dx = x - gesture.x0;
    const dy = y - gesture.y0;
    const step = Math.max(14, LY.cell * 0.9);
    if (!gesture.axis && Math.hypot(dx, dy) > Math.max(10, LY.cell * 0.4)) {
      gesture.axis = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
    }
    if (gesture.axis === 'h') {
      while (x - gesture.ax >= step) { gesture.ax += step; actMove(1); gesture.moved = true; }
      while (gesture.ax - x >= step) { gesture.ax -= step; actMove(-1); gesture.moved = true; }
    } else if (gesture.axis === 'v') {
      while (y - gesture.ay >= step) { gesture.ay += step; actSoftStep(); gesture.moved = true; }
    }
  }

  function onPointerUp(e) {
    const { x, y } = pos(e);
    if (pressedId) {
      const b = buttons.find((q) => q.id === pressedId);
      pressedId = null;
      if (b && hit(b, x, y)) {
        Sound.play('click', 0.7);
        b.action();
      }
      return;
    }
    if (!gesture || e.pointerId !== gesture.id) return;
    const g = gesture;
    gesture = null;
    const tnow = performance.now();
    const dur = tnow - g.t0;
    const dx = x - g.x0;
    const dy = y - g.y0;
    const s0 = g.samples[0];
    const s1 = g.samples[g.samples.length - 1];
    const vy = (s1.y - s0.y) / Math.max(1, s1.t - s0.t);
    const fresh = tnow - s1.t < 150; // released while still moving
    const flick = Math.max(LY.cell * 1.2, 24);
    if (Math.hypot(dx, dy) < Math.max(12, LY.cell * 0.5) && dur < 350) {
      if (g.holdBtn) actHold();
      else actRotate(1);
    } else if (g.axis === 'v' && fresh && vy > 0.5 && dy > flick) {
      actHardDrop();
    } else if (g.axis === 'v' && fresh && vy < -0.4 && -dy > flick) {
      actHold();
    }
  }

  function onPointerCancel() {
    gesture = null;
    pressedId = null;
  }

  // ------------------------------------------------------------ platform events
  function autoPause() {
    if (screen === 'play' && G && !overlay && !G.over && G.started) pauseGame();
  }

  function setupBridgeEvents() {
    if (!HAS_BRIDGE) return;
    const E = bridge.EVENT_NAME;
    try {
      bridge.platform.on(E.PAUSE_STATE_CHANGED, (p) => {
        extPaused = !!p;
        Sound.setPaused(!!p);
        keys.clear();
        softKey = false;
        dasDir = 0;
        if (p) autoPause();
      });
    } catch (e) { /* event not available */ }
    try {
      bridge.platform.on(E.AUDIO_STATE_CHANGED, (on) => Sound.setPlatform(!!on));
    } catch (e) { /* event not available */ }
    try {
      bridge.advertisement.on(E.REWARDED_STATE_CHANGED, onRewardedState);
    } catch (e) { /* rewarded not available */ }
  }

  function setupInput() {
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', () => { keys.clear(); softKey = false; dasDir = 0; });
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerCancel);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('gesturestart', (e) => e.preventDefault());
    document.addEventListener('visibilitychange', () => {
      Sound.setHidden(document.hidden);
      if (document.hidden) {
        keys.clear();
        softKey = false;
        dasDir = 0;
        autoPause();
      }
    });
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', () => setTimeout(resize, 120));
  }

  // ------------------------------------------------------------ boot
  function pickLanguage() {
    let lang = 'en';
    if (HAS_BRIDGE) {
      try { lang = String(bridge.platform.language || 'en').toLowerCase().slice(0, 2); } catch (e) { lang = 'en'; }
    }
    S = STRINGS[lang] || STRINGS.en;
    document.documentElement.lang = STRINGS[lang] ? lang : 'en';
  }

  async function boot() {
    resize();
    initAmbient();
    initMenuPieces();
    requestAnimationFrame(frame);
    if (HAS_BRIDGE) {
      try { await bridge.initialize(); } catch (e) { /* continue with defaults */ }
    }
    loadProgress = 0.3;
    pickLanguage();
    try {
      if (HAS_BRIDGE && bridge.device && (bridge.device.type === 'mobile' || bridge.device.type === 'tablet')) inputMode = 'touch';
    } catch (e) { /* ignore */ }
    if (HAS_BRIDGE) {
      try { Sound.platformOn = bridge.platform.isAudioEnabled !== false; } catch (e) { Sound.platformOn = true; }
    }
    Sound.hidden = document.hidden;
    Sound.init();
    setupBridgeEvents();
    setupInput();
    await loadSave();
    Sound.userMuted = save.muted;
    Sound.apply();
    loadProgress = 0.55;
    await Promise.race([Sound.load(), new Promise((r) => setTimeout(r, 6000))]);
    loadProgress = 1;
    screen = 'menu';
  }

  // ------------------------------------------------------------ store covers
  function coverScene(kind) {
    G = newGame('level', 12);
    const grid = G.grid;
    // a garden mid-game: soil, seeds, a few blocks already placed
    const rows = [
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [6, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [6, 6, 0, 0, 0, 0, 0, 0, 3, 0],
      [6, 4, 4, 0, 0, 0, 3, 3, 3, 7],
      [2, 4, 4, 5, 0, 0, 1, 1, 7, 7],
      [2, 2, 2, 5, 5, 0, 1, 1, 7, 1],
      [8, 9, 8, 8, 5, 0, 8, 8, 9, 1],
      [8, 8, 8, 9, 8, 0, 8, 8, 8, 1],
      [8, 9, 8, 8, 8, 0, 8, 9, 8, 8],
      [8, 8, 8, 8, 8, 0, 8, 8, 8, 9]
    ];
    for (let r = 0; r < ROWS; r++) grid[r] = rows[r].slice();
    G.piece = { type: 'I', rot: 1, x: 3, y: 9 };
    G.started = true;
    G.hold = 'T';
    G.queue = ['S', 'L', 'O', 'J', 'Z'];
    G.score = 12850;
    G.seedsTotal = 9;
    G.seedsLeft = 6;
    G.riseEvery = 0;
    G.level = 12;
    now = 2000;
    void kind;
  }

  function drawCover(kind) {
    resize();
    initAmbient();
    const rnd = mulberry32(5);
    for (const a of ambient) { a.x = rnd(); a.y = rnd(); }
    coverScene(kind);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    buttons = [];
    drawBackground();
    const W = VW;
    const H = VH;
    let c;
    let titleX;
    let titleY;
    let tsize;
    if (kind === 'landscape') {
      c = 46;
      LY = { mode: 'cover', cell: c, bx: W - 10 * c - 230, by: (H - 20 * c) / 2 };
      titleX = W * 0.32;
      titleY = H * 0.42;
      tsize = 150;
    } else if (kind === 'portrait') {
      c = 62;
      LY = { mode: 'cover', cell: c, bx: (W - 10 * c) / 2, by: H - 20 * c - 110 };
      titleX = W / 2;
      titleY = 290;
      tsize = 160;
    } else {
      c = 27;
      LY = { mode: 'cover', cell: c, bx: (W - 10 * c) / 2, by: H - 20 * c - 40 };
      titleX = W / 2;
      titleY = 120;
      tsize = 104;
    }
    drawBoard();
    // blooms frozen mid-air
    const flowers = [[1.5, 18.5], [8.5, 18.5], [3.5, 19.5], [7.5, 20.5], [1.5, 20.5], [9.5, 21.5]];
    flowers.forEach(([fx, fy], i) => {
      if (i > 2) return;
      const x = LY.bx + fx * c;
      const y = LY.by + (fy - HIDDEN - 2.5 - i) * c;
      drawFlower(x, y, c * 1.5, PETALS[i % PETALS.length], i, 1);
    });
    for (let i = 0; i < 26; i++) drawPetal(LY.bx + rnd() * c * 10, LY.by + c * (8 + rnd() * 9), c * (0.3 + rnd() * 0.3), PETALS[i % PETALS.length], rnd() * 6, 0.9);
    drawTitle(titleX, titleY, tsize);
    if (kind === 'landscape') {
      // falling blocks around the title
      const list = [['T', 0.08, 0.68, 1], ['L', 0.38, 0.7, 0], ['O', 0.2, 0.12, 0], ['S', 0.48, 0.12, 1]];
      for (const [tp, px, py, rot] of list) {
        for (const [cx, cy] of SHAPES[tp][rot]) drawCell(TYPE_ID[tp], W * px + cx * 52, H * py + cy * 52, 52, 0.95);
      }
    }
    window.__coverReady = true;
  }

  // Automated test hook, only present with ?bftest in the URL.
  if (/[?&]bftest\b/.test(location.search)) {
    window.__bf = {
      get G() { return G; },
      get screen() { return screen; },
      get overlay() { return overlay; },
      get tutStep() { return tutStep; },
      get save() { return save; },
      get LY() { return LY; },
      startLevel, startEndless, beginPlay, actMove, actRotate, actHardDrop, actHold, levelDef, onRewardedState, requestRevive, doRevive
    };
  }

  if (COVER) {
    window.addEventListener('load', () => drawCover(COVER));
  } else {
    boot();
  }
})();
