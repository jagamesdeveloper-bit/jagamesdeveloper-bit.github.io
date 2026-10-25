// per-game screenshot scenarios for look.js
const tap = async (page, x, y) => { await page.mouse.click(x, y); await page.waitForTimeout(120); };
module.exports = {
  'ghost-grocer': {
    menu: async (page) => { await page.waitForTimeout(800); },
    play: async (page) => { await page.evaluate(() => { const G = window.__gg; window.__pg_debug.save.nights = 2; G.start(4); G.spawn(); G.spawn(); G.spawn(); G.st.ghosts.forEach((g, i) => { g.x = g.tx; g.y = 500; g.t = 5; g.pat = g.mpat * [0.9, 0.5, 0.2][i]; }); G.take(0); G.take(2); G.st.coinsNight = 34; G.st.t = 30; }); await page.waitForTimeout(700); },
    polt: async (page) => { await page.evaluate(() => { const G = window.__gg; window.__pg_debug.save.nights = 3; G.start(5); G.spawn(); G.spawn(); G.st.ghosts.forEach(g => { g.x = g.tx; g.t = 5; }); G.startPolt(); G.st.polt.warn = 0.01; }); await page.waitForTimeout(1400); },
    over: async (page) => { await page.evaluate(() => { const G = window.__gg; G.start(3); G.st.coinsNight = 48; G.st.served = 11; G.endNight(true); }); await page.waitForTimeout(1300); },
    lost: async (page) => { await page.evaluate(() => { const G = window.__gg; G.start(6); G.st.coinsNight = 30; G.st.served = 7; G.st.hearts = 0; G.endNight(false); }); await page.waitForTimeout(1300); },
    shop: async (page) => { await page.evaluate(() => { window.__pg_debug.save.coins = 190; window.__gg.st.state = 'shop'; }); await page.waitForTimeout(600); },
  },
  'skyline-snap': {
    menu: async (page) => { await page.waitForTimeout(700); },
    play: async (page) => { await page.evaluate(() => { const S = window.__sky; S.start(); for (let i = 1; i < 9; i++) S.st.floors.push({ x: Math.sin(i) * 6, w: 150 - i * 3, i }); S.st.coinsRun = 4; S.st.tut = false; }); await page.waitForTimeout(1500); },
    sunset: async (page) => { await page.evaluate(() => { const S = window.__sky; S.start(); for (let i = 1; i < 24; i++) S.st.floors.push({ x: Math.sin(i) * 8, w: 140 - i, i }); S.st.tut = false; }); await page.waitForTimeout(2200); },
    night: async (page) => { await page.evaluate(() => { const S = window.__sky; S.start(); for (let i = 1; i < 56; i++) S.st.floors.push({ x: Math.sin(i * 0.7) * 10, w: 130 - i * 0.6, i }); S.st.tut = false; }); await page.waitForTimeout(2500); },
    over: async (page) => { await page.evaluate(() => { const S = window.__sky; S.start(); for (let i = 1; i < 18; i++) S.st.floors.push({ x: Math.sin(i) * 8, w: 140 - i, i }); S.st.coinsRun = 9.5; S.st.perfects = 7; S.gameOver(); }); await page.waitForTimeout(1600); },
    shop: async (page) => { await page.evaluate(() => { window.__pg_debug.save.coins = 210; window.__sky.st.state = 'shop'; }); await page.waitForTimeout(600); },
  },
  'jelly-jam': {
    menu: async (page) => { await page.waitForTimeout(700); },
    play: async (page) => { await page.evaluate(() => { const J = window.__jelly; J.start(false); const g = J.st.g; const pat = ['..1122..', '.11.2233', '44..33..', '44.5556.', '0000000.', '.66.11..', '.6..1...', '........']; pat.forEach((row, y) => row.split('').forEach((ch, x) => { if (ch !== '.') g[y][x] = { c: +ch, pid: +ch * 10 + Math.floor(y / 2), f: (x + y) % 5 === 0, wob: 0, sc: 1 }; })); J.st.score = 4820; J.st.coinsRun = 12; J.st.combo = 2; J.st.hand = [{ cells: [[0, 0]], c: 0, id: 1, used: false, pop: 1 }, { cells: [[0, 0], [1, 0], [0, 1]], c: 4, id: 2, used: false, pop: 1 }, { cells: [[0, 0], [1, 0], [2, 0], [3, 0]], c: 2, id: 3, used: false, pop: 1 }]; J.st.drag = { slot: 0, moved: true, pos: null }; });
      await page.evaluate(() => { const J = window.__jelly, P = window.__pg_debug; const d = J.st.drag; d.ox = 7; d.oy = 4; d.valid = true; d.pos = { x: 300, y: 300 }; }); await page.waitForTimeout(500); },
    over: async (page) => { await page.evaluate(() => { const J = window.__jelly; J.start(false); for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if ((x * 3 + y * 5) % 4) J.st.g[y][x] = { c: (x + y) % 7, pid: x * 9 + y, f: (x * 7 + y) % 6 === 0, wob: 0, sc: 1 }; J.st.score = 9120; J.st.lines = 14; J.st.pure = 2; J.st.coinsRun = 21; J.gameOver(); }); await page.waitForTimeout(1500); },
    shop: async (page) => { await page.evaluate(() => { window.__pg_debug.save.coins = 260; window.__jelly.st.state = 'shop'; }); await page.waitForTimeout(600); },
  },
  'dino-dig': {
    dig: async (page) => { await page.waitForTimeout(600); for (let i = 0; i < 5; i++) { await page.evaluate(() => { const D = window.__dino; D.hit(0, 2, 2, true); D.hit(1, 3, 1.4, true); }); await page.waitForTimeout(90); } },
    deep: async (page) => { await page.evaluate(() => { const P = window.__pg_debug, D = window.__dino; P.save.u = { pick: 14, crew: 6, brush: 6, cash: 3, tnt: 2, ticket: 1 }; P.save.depth = 86; D.st.row0 = 86; D.resetRows(); D.st.cash = 48200; }); await page.waitForTimeout(1500); },
    museum: async (page) => { await page.evaluate(() => { const P = window.__pg_debug, D = window.__dino; P.save.f = { trilo: [0, 1, 2], fern: [0, 1, 2], ammo: [0, 1, 2, 3], raptor: [0, 1, 2, 3, 4], ptera: [0, 1, 4], stego: [0, 1, 2, 3, 4, 5], trike: [0, 1], trex: [0, 2, 3] }; D.st.state = 'museum'; }); await page.waitForTimeout(700); },
    popup: async (page) => { await page.evaluate(() => { const P = window.__pg_debug, D = window.__dino; P.save.f = { trex: [0, 1, 2, 3, 4, 5, 6] }; D.collect({ sp: 9, part: 7 }); }); await page.waitForTimeout(900); },
    boom: async (page) => { await page.evaluate(() => { const D = window.__dino; window.__pg_debug.save.u = { pick: 30, crew: 3 }; D.st.cash = 900; D.boom(); }); await page.waitForTimeout(250); },
  },
  'bounce-brigade': {
    menu: async (page) => { await page.waitForTimeout(800); },
    play: async (page) => { await page.evaluate(() => { const B = window.__bb; window.__pg_debug.save.runs = 2; B.start(); B.st.t = 200; B.st.perks = { blade: 2, zap: 2, shock: 1, buddy: 1 }; B.st.blades = 3; B.st.buddies.push({ x: 0, y: 0, vx: 200, vy: 120, cd: {} }); B.st.lvl = 9; B.st.coinsRun = 23; B.st.need = 1e9; });
      await page.waitForTimeout(6000); },
    boss: async (page) => { await page.evaluate(() => { const B = window.__bb; window.__pg_debug.save.runs = 2; B.start(); B.st.t = 355; B.st.perks = { ram: 3, blade: 3, size: 2 }; B.st.blades = 4; B.st.p.hp = 9999; B.st.need = 1e9; }); await page.waitForTimeout(8000); },
    levelup: async (page) => { await page.evaluate(() => { const B = window.__bb; B.start(); B.st.t = 30; B.gainXP(40); }); await page.waitForTimeout(800); },
    dead: async (page) => { await page.evaluate(() => { const B = window.__bb; B.start(); B.st.t = 222; B.st.kills = 340; B.st.coinsRun = 18; B.st.p.hp = 1; B.st.p.inv = 0; }); await page.waitForTimeout(3500); },
    shop: async (page) => { await page.evaluate(() => { window.__pg_debug.save.coins = 420; window.__bb.st.state = 'shop'; }); await page.waitForTimeout(600); },
  },
  'cat-cannon-golf': {
    menu: async (page) => { await page.waitForTimeout(700); },
    play: async (page) => { await page.evaluate(() => { const G = window.__golf; G.load(2); G.st.aim = { sx: 0, sy: 0, dx: 30, dy: -120, d: 124, pow: 0.75 }; }); await page.waitForTimeout(600); },
    hard: async (page) => { await page.evaluate(() => { window.__pg_debug.save.next = 30; const G = window.__golf; G.load(26); G.st.strokes = 2; }); await page.waitForTimeout(800); },
    rolling: async (page) => { await page.evaluate(() => { const G = window.__golf; G.load(14); G.shoot(0.3, -1, 0.9); }); await page.waitForTimeout(500); },
    result: async (page) => { await page.evaluate(() => { const G = window.__golf; window.__pg_debug.save.next = 4; G.load(4); G.st.strokes = 2; G.st.sunk = 0.44; }); await page.waitForTimeout(2600); },
    select: async (page) => { await page.evaluate(() => { const P = window.__pg_debug; P.save.next = 12; P.save.stars = [3, 3, 2, 1, 3, 2, 3, 1, 2, 3, 2]; P.save.cat = 1; window.__golf.st.state = 'select'; }); await page.waitForTimeout(600); },
  },
  'tower-of-toast': {
    menu: async (page) => { await page.waitForTimeout(700); },
    play: async (page) => { await page.evaluate(() => { const T = window.__tot; T.start(0); T.st.money = 2000; const L = T.board().land, P = (x, y) => L ? [y, x] : [x, y];
        [[200, 160, 'toaster'], [200, 300, 'jam'], [360, 300, 'toaster'], [40, 300, 'toaster'], [200, 440, 'jam'], [360, 160, 'toaster']].forEach(a => { const q = P(a[0], a[1]); T.build(a[2], q[0], q[1]); });
        const b = P(310, 160); T.build('butter', b[0], b[1]); T.st.sel = null; T.st.towers[1].lv = 2; T.st.towers[4].lv = 3; T.st.towers[0].lv = 3; T.st.wave = 6; T.startWave(); });
      await page.waitForTimeout(9000); },
    boss: async (page) => { await page.evaluate(() => { const T = window.__tot; T.start(1); T.st.money = 3000; const L = T.board().land, P = (x, y) => L ? [y, x] : [x, y]; [[200, 120], [40, 200], [200, 260], [230, 390]].forEach((a, i) => { const q = P(a[0], a[1]); T.build(i % 2 ? 'jam' : 'toaster', q[0], q[1]); }); T.st.sel = null; T.st.wave = 9; T.startWave(); T.st.queue.unshift({ t: 'boss', hpm: 3 }); });
      await page.waitForTimeout(6500); },
    select: async (page) => { await page.evaluate(() => { const T = window.__tot; T.start(2); const L = T.board().land, q = L ? [200, 200] : [200, 200]; T.build('jam', q[0], q[1]); T.st.money = 300; }); await page.waitForTimeout(800); },
    place: async (page, w, h) => { await page.evaluate(() => { const T = window.__tot; T.start(0); T.st.place = 'toaster'; }); await page.mouse.move(w * 0.5, h * 0.42); await page.waitForTimeout(600); },
    lose: async (page) => { await page.evaluate(() => { const T = window.__tot; T.start(0); T.st.wave = 7; T.st.lives = 1; T.startWave(); T.st.speed = 2; }); await page.waitForTimeout(12000); },
  },
  'potion-pour': {
    menu: async (page) => { await page.evaluate(() => { window.__pg_debug.save.level = 5; }); await page.waitForTimeout(700); },
    play: async (page) => { await page.evaluate(() => { const P = window.__potion; P.start(3); }); await page.waitForTimeout(900); await page.evaluate(() => { const P = window.__potion; P.tap(0); }); await page.waitForTimeout(400); },
    pour: async (page) => { await page.evaluate(() => { const P = window.__potion; P.start(4); }); await page.waitForTimeout(800); await page.evaluate(() => { const P = window.__potion, T = P.st.tubes; for (let i = 0; i < T.length; i++) for (let j = 0; j < T.length; j++) if (i !== j && P.canPour(T[i], T[j]) && T[j].length) { P.tap(i); P.tap(j); return; } P.tap(0); P.tap(T.length - 1); }); await page.waitForTimeout(550); },
    hidden: async (page) => { await page.evaluate(() => { window.__potion.start(9); }); await page.waitForTimeout(900); },
    many: async (page) => { await page.evaluate(() => { const P = window.__potion; P.start(19); P.st.tubes[3] = [0, 0, 0, 0].map(() => ({ c: 2, hid: false })); P.st.sealAt = {}; }); await page.waitForTimeout(900); },
    win: async (page) => { await page.evaluate(() => { const P = window.__potion; P.start(2); P.st.tubes = [[0,0,0,0],[1,1,1,1],[2,2,2],[],[2]].map(t => t.map(c => ({ c, hid: false }))); }); await page.waitForTimeout(400); await page.evaluate(() => { const P = window.__potion; P.tap(4); P.tap(2); }); await page.waitForTimeout(2600); },
  },
  'pin-the-tail': {
    menu: async (page) => { await page.waitForTimeout(700); },
    play: async (page) => { await page.evaluate(() => { const P = window.__pin; P.start(); P.st.apples = [{ a: 300, c: '#2a9d8f' }]; }); await page.waitForTimeout(800); await page.evaluate(() => window.__pin.throwPin()); await page.waitForTimeout(200); await page.evaluate(() => window.__pin.throwPin()); await page.waitForTimeout(60); },
    stage4: async (page) => { await page.evaluate(() => { const P = window.__pin; P.start(); P.st.stage = 4; P.st.left = 0; P.st.state = 'play'; window.__pg_debug.save.runs = 3; }); await page.evaluate(() => { const P = window.__pin; P.st.stage = 3; P.st.state = 'clear'; P.st.clearT = 2; }); await page.waitForTimeout(900); },
    boss: async (page) => { await page.evaluate(() => { const P = window.__pin; P.start(); P.st.stage = 4; P.st.state = 'clear'; P.st.clearT = 2; }); await page.waitForTimeout(700); },
    clear: async (page) => { await page.evaluate(() => { const P = window.__pin; P.start(); P.st.left = 1; }); await page.waitForTimeout(800); await page.evaluate(() => { const P = window.__pin; P.st.pins = []; P.throwPin(); }); await page.waitForTimeout(350); },
    dead: async (page) => { await page.evaluate(() => { const P = window.__pin; P.start(); P.st.stage = 7; P.st.coinsRun = 12; P.st.lives = 0; }); await page.waitForTimeout(800); await page.evaluate(() => { const P = window.__pin; const a = ((90 - P.st.rot) % 360 + 360) % 360; P.st.pins.push({ a: a, w: 0, c: '#d64933' }); P.stick({ c: '#2a9d8f' }); }); await page.waitForTimeout(1500); },
    upgrades: async (page) => { await page.evaluate(() => { window.__pg_debug.save.coins = 180; window.__pin.st.state = 'upgrades'; }); await page.waitForTimeout(600); },
  },
  'sloth-sprint': {
    menu: async (page) => { await page.waitForTimeout(600); },
    play: async (page) => { await page.evaluate(() => window.__sloth.start()); await page.waitForTimeout(900); },
    fly: async (page) => { await page.evaluate(() => window.__sloth.start()); await page.waitForTimeout(500);
      await page.evaluate(() => new Promise(res => { const S = window.__sloth; let n = 0; const iv = setInterval(() => { if (!S.st.flying && S.predict(1.4).hit >= 0) { S.release(); n++; } if (n >= 4 && S.st.flying) { clearInterval(iv); res(); } }, 16); setTimeout(() => { clearInterval(iv); res(); }, 9000); })); await page.waitForTimeout(250); },
    sunset: async (page) => { await page.evaluate(() => { window.__sloth.start(); window.__sloth.st.cyc = 0.26; }); await page.waitForTimeout(1200); },
    night: async (page) => { await page.evaluate(() => { window.__sloth.start(); window.__sloth.st.cyc = 0.5; }); await page.waitForTimeout(1200); },
    dead: async (page) => { await page.evaluate(() => { const S = window.__sloth; S.start(); S.st.coinsRun = 7.5; S.st.dist = 412; }); await page.waitForTimeout(400); await page.evaluate(() => { window.__sloth.st.rescues = 0; window.__sloth.release(); }); await page.waitForTimeout(3500); },
    upgrades: async (page) => { await page.evaluate(() => { window.__pg_debug.save.coins = 240; window.__sloth.st.state = 'upgrades'; }); await page.waitForTimeout(500); },
  },
  'hex-harvest': {
    menu: async () => {},
    play: async (page) => { await page.evaluate(() => { window.__hex.newGame(false); }); await page.waitForTimeout(700);
      await page.evaluate(() => { const H = window.__hex; const tiers = [0,1,2,3,4,5,6,0,1,2,3,1,0,2,4,5,3,1,0,2]; H.cells.forEach((c, i) => { if (i % 3 !== 0) c.t = tiers[i % tiers.length]; }); H.st.hand = 2; H.st.next = 1; H.st.hold = 3; H.st.score = 12840; H.st.maxT = 6; }); await page.waitForTimeout(400); },
    over: async (page) => { await page.evaluate(() => { const H = window.__hex; H.newGame(false); H.cells.forEach((c, i) => { c.t = i % 4; }); H.st.score = 5230; H.st.maxT = 5; H.st.over = true; H.st.overT = 0; window.__pg_debug.playing = false; }); await page.waitForTimeout(1300); },
  },
};
