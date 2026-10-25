// usage: node shot.js <slug> [script.js]  -> screenshots + console errors for a game
const { chromium } = require('playwright');
const path = require('path'); const fs = require('fs');
(async () => {
  const slug = process.argv[2]; const extra = process.argv[3];
  const root = path.resolve(__dirname, '..');
  const out = process.env.SHOTS || '/tmp/shots'; fs.mkdirSync(out, { recursive: true });
  const b = await chromium.launch();
  const sizes = [[390, 844, 'portrait'], [1280, 720, 'land']];
  const errs = [];
  for (const [w, h, name] of sizes) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 500, isMobile: w < 500 });
    const page = await ctx.newPage();
    page.on('console', m => { if (m.type() === 'error') errs.push(name + ': ' + m.text()); });
    page.on('pageerror', e => errs.push(name + ' PAGEERROR: ' + e.message));
    await page.route('**/bridge.playgama.com/**', r => r.abort());
    await page.goto('file://' + root + '/games/' + slug + '/index.html');
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `${out}/${slug}-${name}-1.png` });
    if (extra) { const fn = require(path.resolve(extra)); await fn(page, `${out}/${slug}-${name}`, w, h); }
    await ctx.close();
  }
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'no console errors');
  await b.close();
})();
