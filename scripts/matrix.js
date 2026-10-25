// usage: node matrix.js [slug...]  -> screenshots at the standard size matrix + bridge flow check
const { chromium } = require('playwright'); const path = require('path'); const fs = require('fs');
const root = path.resolve(__dirname, '..'); const out = '/tmp/matrix'; fs.mkdirSync(out, { recursive: true });
const mock = fs.readFileSync(path.join(__dirname, 'mock-bridge.js'), 'utf8');
const sizes = [[360, 640], [390, 844], [915, 412], [1280, 720], [2560, 1440]];
(async () => {
  const slugs = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(path.join(root, 'games')).filter(d => fs.existsSync(path.join(root, 'games', d, 'meta.py')));
  const b = await chromium.launch(); const problems = [];
  for (const slug of slugs) {
    for (const [w, h] of sizes) {
      const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 500 || h < 500, isMobile: w < 500 || h < 500 });
      const page = await ctx.newPage(); const errs = [];
      page.on('console', m => { if (m.type() === 'error' && !/ERR_FAILED/.test(m.text())) errs.push(m.text()); }); page.on('pageerror', e => errs.push('PAGEERROR ' + e.message));
      await page.route('**/bridge.playgama.com/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: mock }));
      await page.goto('file://' + root + '/games/' + slug + '/index.html'); await page.waitForTimeout(1200);
      const dims = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, sh: document.documentElement.scrollHeight, iw: innerWidth, ih: innerHeight, log: window.__bridgeLog.slice(0, 8) }));
      if (dims.sw > dims.iw + 1 || dims.sh > dims.ih + 1) errs.push('page scroll ' + JSON.stringify(dims));
      if (!dims.log.includes('msg:game_ready')) errs.push('no game_ready: ' + dims.log.join(','));
      await page.screenshot({ path: `${out}/${slug}-${w}x${h}.png` });
      // rotate/resize
      await page.setViewportSize({ width: h, height: w }); await page.waitForTimeout(400);
      if (w === 390) await page.screenshot({ path: `${out}/${slug}-${h}x${w}-rot.png` });
      if (errs.length) problems.push(slug + ' ' + w + 'x' + h + ': ' + errs.join(' | '));
      await ctx.close();
    }
  }
  console.log(problems.length ? 'PROBLEMS:\n' + problems.join('\n') : 'matrix clean'); await b.close();
})();
