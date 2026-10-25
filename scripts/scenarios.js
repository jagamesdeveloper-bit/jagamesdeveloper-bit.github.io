// per-game screenshot scenarios for look.js
const tap = async (page, x, y) => { await page.mouse.click(x, y); await page.waitForTimeout(120); };
module.exports = {
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
