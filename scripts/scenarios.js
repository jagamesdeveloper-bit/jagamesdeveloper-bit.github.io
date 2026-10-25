// per-game screenshot scenarios for look.js
const tap = async (page, x, y) => { await page.mouse.click(x, y); await page.waitForTimeout(120); };
module.exports = {
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
