#!/usr/bin/env node
// Headless QA for a plain-JS Playgama build: serves <build_dir>, swaps the Bridge CDN script for scripts/bridge-stub.js,
// opens the game at the wiki's fixed size matrix, and reports per size:
//   game_ready sent (and after initialize), no page scroll, no console/page errors, storage.get before storage.set,
//   then saves a screenshot per size so YOU can look at them (a passed number is not a seen screen).
//
// Usage: node qa-matrix.js <build_dir> <out_dir> [--lang xx] [--muted] [--quick]
// Needs the preinstalled Playwright (require('playwright') works from any directory).
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const MATRIX = [
  ['phone-portrait-360x640', 360, 640], ['phone-portrait-390x844', 390, 844], ['phone-portrait-430x932', 430, 932],
  ['phone-landscape-844x390', 844, 390], ['phone-landscape-915x412', 915, 412],
  ['tablet-768x1024', 768, 1024], ['tablet-1024x768', 1024, 768],
  ['square-640x640', 640, 640],
  ['iframe-800x450', 800, 450], ['desktop-1280x720', 1280, 720],
  ['desktop-1366x768', 1366, 768], ['desktop-1920x1080', 1920, 1080], ['desktop-2560x1440', 2560, 1440],
  ['tall-9x21-411x960', 411, 960], ['wide-21x9-1260x540', 1260, 540],
];
const QUICK = ['phone-portrait-390x844', 'phone-landscape-844x390', 'square-640x640', 'desktop-1280x720', 'wide-21x9-1260x540'];
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.woff2': 'font/woff2' };

const args = process.argv.slice(2);
const [root, out] = args.filter((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--lang');
if (!root || !out) { console.log('Usage: node qa-matrix.js <build_dir> <out_dir> [--lang xx] [--muted] [--quick]'); process.exit(2); }
const lang = args.includes('--lang') ? args[args.indexOf('--lang') + 1] : 'en';
const muted = args.includes('--muted');
const stub = fs.readFileSync(path.join(__dirname, 'bridge-stub.js'), 'utf8');

const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]).replace(/\/$/, '/index.html'));
  if (!p.startsWith(path.resolve(root)) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});

(async () => {
  fs.mkdirSync(out, { recursive: true });
  await new Promise((r) => server.listen(0, r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch();
  const results = [];
  for (const [name, w, h] of MATRIX.filter((m) => !args.includes('--quick') || QUICK.includes(m[0]))) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: w < 900, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const errors = [];
    const requests = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    page.on('request', (r) => requests.push(r.url()));
    // later routes win: block everything external first (req 1.2.5), then serve the Bridge stub
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => { errors.push('external request: ' + r.request().url().slice(0, 120)); r.abort(); });
    await page.route(/playgama-bridge\.js/, (r) => r.fulfill({ contentType: 'text/javascript', body: `window.__BRIDGE_LANG=${JSON.stringify(lang)};window.__BRIDGE_AUDIO=${!muted};\n${stub}` }));
    await page.goto(base, { waitUntil: 'load' });
    let ready = false;
    for (let i = 0; i < 60 && !ready; i++) {
      await page.waitForTimeout(250);
      ready = await page.evaluate(() => (window.__bridgeLog || []).some((l) => l[1] === 'sendMessage' && l[2] === 'game_ready'));
    }
    await page.waitForTimeout(400);
    const info = await page.evaluate(() => {
      const log = window.__bridgeLog || [];
      const idx = (pred) => log.findIndex(pred);
      const el = document.documentElement;
      return {
        scrollX: el.scrollWidth > innerWidth, scrollY: el.scrollHeight > innerHeight,
        loadingHidden: document.getElementById('loading')?.hidden !== false,
        initFirst: idx((l) => l[1] === 'initialize') === 0,
        getBeforeSet: idx((l) => l[1] === 'storage.get') >= 0 && (idx((l) => l[1] === 'storage.set') < 0 || idx((l) => l[1] === 'storage.get') < idx((l) => l[1] === 'storage.set')),
        readyAfterInit: idx((l) => l[1] === 'sendMessage' && l[2] === 'game_ready') > idx((l) => l[1] === 'initialize'),
        silentAtStart: window.__game?.stats?.().silent,
        log: log.map((l) => l.slice(1)),
      };
    });
    const bridgeIdx = requests.findIndex((u) => /playgama-bridge\.js/.test(u));
    const firstOwn = requests.findIndex((u) => u.startsWith(base) && /\.(js|mjs)(\?|$)/.test(u));
    const problems = [];
    if (!ready) problems.push('game_ready never sent');
    if (!info.loadingHidden) problems.push('loading screen still visible (game_ready must follow the first frame)');
    if (!info.initFirst) problems.push('bridge.initialize was not the first Bridge call');
    if (!info.getBeforeSet) problems.push('storage.get not called at startup before any storage.set');
    if (info.scrollX || info.scrollY) problems.push('page scrolls (1.6.3)');
    if (bridgeIdx < 0 || (firstOwn >= 0 && bridgeIdx > firstOwn)) problems.push('Bridge script not requested before the game scripts');
    if (muted && info.silentAtStart === false) problems.push('platform audio disabled but game is not silent at start (3.3.4)');
    errors.forEach((e) => problems.push('console: ' + e.slice(0, 160)));
    await page.screenshot({ path: path.join(out, `${name}.png`) });
    results.push({ name, ok: problems.length === 0, problems });
    console.log(`${problems.length ? 'FAIL' : 'ok  '} ${name}${problems.length ? '  - ' + problems.join(' | ') : ''}`);
    await ctx.close();
  }
  // ---- flow smoke test (template conventions: #b-play, #b-revive, window.__game). Skipped if the game has no #b-play.
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
    await page.route(/^https?:\/\/(?!127\.0\.0\.1)/, (r) => r.abort());
    await page.route(/playgama-bridge\.js/, (r) => r.fulfill({ contentType: 'text/javascript', body: `window.__BRIDGE_LANG=${JSON.stringify(lang)};\n${stub}` }));
    await page.goto(base, { waitUntil: 'load' });
    if (await page.waitForSelector('#b-play', { timeout: 8000 }).catch(() => null)) {
      const problems = [];
      const log = () => page.evaluate(() => window.__bridgeLog.map((l) => l.slice(1)));
      const has = async (name, arg) => (await log()).some((l) => l[0] === name && (arg === undefined || l[1] === arg));
      await page.click('#b-play');
      await page.waitForTimeout(700);
      await page.screenshot({ path: path.join(out, 'flow-1-playing.png') });
      if (!(await has('sendMessage', 'level_started'))) problems.push('level_started message not sent');
      await page.evaluate(() => window.__game.setPaused(true));
      await page.waitForTimeout(200);
      const paused = await page.evaluate(() => window.__game.stats().paused);
      if (!paused) problems.push('pause did not pause the game');
      await page.screenshot({ path: path.join(out, 'flow-2-paused.png') });
      await page.evaluate(() => window.__game.setPaused(false));
      await page.evaluate(() => window.__game.end());
      await page.waitForTimeout(900);
      await page.screenshot({ path: path.join(out, 'flow-3-gameover.png') });
      if ((await page.evaluate(() => window.__game.state)) !== 'over') problems.push('game did not reach game over');
      if (!(await has('showInterstitial'))) problems.push('no interstitial requested at game over (SDK step 7)');
      if (!(await has('sendMessage', 'level_failed'))) problems.push('level_failed message not sent');
      if (await page.$('#b-revive:not([hidden])')) {
        await page.click('#b-revive');
        await page.waitForTimeout(900);
        if (!(await has('showRewarded'))) problems.push('revive did not request a rewarded ad');
        if ((await page.evaluate(() => window.__game.state)) !== 'play') problems.push('revive after a watched rewarded ad did not resume play (2.2.5)');
        const silentAfter = await page.evaluate(() => window.__game.stats().silent);
        if (silentAfter) problems.push('game still silent after the ad closed');
      }
      await page.waitForTimeout(300);
      errors.forEach((e) => problems.push('console: ' + e.slice(0, 160)));
      results.push({ name: 'flow', ok: problems.length === 0, problems });
      console.log(`${problems.length ? 'FAIL' : 'ok  '} flow (play -> pause -> game over -> interstitial -> revive)${problems.length ? '  - ' + problems.join(' | ') : ''}`);
    } else {
      console.log('skip flow (no #b-play in this game)');
    }
    await ctx.close();
  }
  await browser.close();
  server.close();
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(results, null, 2));
  const bad = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - bad}/${results.length} sizes clean. Screenshots + report.json in ${out}. LOOK at the screenshots before calling layout checked.`);
  process.exit(bad ? 1 : 0);
})();
