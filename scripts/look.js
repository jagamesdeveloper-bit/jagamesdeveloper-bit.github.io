// usage: node look.js <slug> [scenario] [sizes]  -> /tmp/look/<slug>-<scenario>-<w>x<h>.png, prints console errors
// scenarios live in scripts/scenarios.js: { slug: { name: async (page, w, h) => {} } }
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
const BASE = process.env.BASE || 'http://127.0.0.1:8765';
const mock = fs.readFileSync(path.join(__dirname, 'mock-bridge.js'), 'utf8');
(async () => {
  const slug = process.argv[2], which = process.argv[3] || 'all';
  const sizes = (process.argv[4] || '390x844,915x412,1280x720').split(',').map(s => s.split('x').map(Number));
  delete require.cache[require.resolve('./scenarios.js')];
  const sc = (require('./scenarios.js')[slug]) || {}; const names = which === 'all' ? Object.keys(sc) : which.split(',');
  if (!names.length) names.push('menu');
  fs.mkdirSync('/tmp/look', { recursive: true }); const b = await chromium.launch(); const errs = [];
  for (const [w, h] of sizes) for (const n of names) {
    const mobile = w < 600 || h < 500; const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: mobile, isMobile: mobile, deviceScaleFactor: 1 });
    const page = await ctx.newPage(); page.on('console', m => { if (m.type() === 'error') errs.push(`${n} ${w}x${h}: ${m.text()}`); }); page.on('pageerror', e => errs.push(`${n} ${w}x${h} PAGEERROR: ${e.message}`));
    await page.route('**/bridge.playgama.com/**', r => r.fulfill({ status: 200, contentType: 'application/javascript', body: mock }));
    await page.goto(`${BASE}/games/${slug}/index.html`); await page.waitForFunction(() => window.__pg_debug && window.__pg_debug._inited, null, { timeout: 8000 }).catch(() => errs.push('init timeout'));
    await page.waitForTimeout(500);
    if (sc[n]) await sc[n](page, w, h);
    await page.waitForTimeout(350);
    await page.screenshot({ path: `/tmp/look/${slug}-${n}-${w}x${h}.png` }); await ctx.close();
  }
  console.log(errs.length ? 'ERRORS:\n' + [...new Set(errs)].join('\n') : 'clean'); await b.close();
})();
