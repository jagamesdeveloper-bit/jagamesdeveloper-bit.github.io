// usage: node covers.js [slug...]  -> /tmp/covers/<slug>-{square,portrait,landscape}.png  (800x800, 1080x1920, 1920x1080)
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const root = path.resolve(__dirname, '..'); const out = '/tmp/covers'; fs.mkdirSync(out, { recursive: true });
const SHOTS = [['square', 800, 800], ['portrait', 1080, 1920], ['landscape', 1920, 1080]];
// per-game setup: runs in page after load to reach an attractive state
const SETUP = {
  'hex-harvest': async p => { await p.evaluate(() => { const D = window.__pg_debug; }); },
  'sloth-sprint': async p => { await p.evaluate(() => { const s = window.__sloth; s.start(); for (let i = 0; i < 60; i++) {} }); },
};
const FNS = {
  'hex-harvest': () => { /* click Play via debug is hard; emulate: handled by menu click below */ },
};
(async () => {
  const slugs = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(path.join(root, 'games')).filter(d => fs.existsSync(path.join(root, 'games', d, 'meta.py')));
  const b = await chromium.launch();
  for (const slug of slugs) {
    for (const [name, w, h] of SHOTS) {
      const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 }); const page = await ctx.newPage();
      await page.route('**/bridge.playgama.com/**', r => r.abort());
      await page.goto('file://' + root + '/games/' + slug + '/index.html'); await page.waitForTimeout(1200);
      await page.evaluate(() => { window.__pg_debug.hud = function () { }; window.__pg_debug.save.muted = true; });
      const setup = require('./cover-setup.js')[slug]; if (setup) await setup(page, w, h);
      await page.waitForTimeout(900);
      await page.screenshot({ path: `${out}/${slug}-${name}.png` }); await ctx.close();
    }
  }
  await b.close(); console.log('covers done');
})();
