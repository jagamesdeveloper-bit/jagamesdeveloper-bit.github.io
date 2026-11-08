#!/usr/bin/env node
// Renders the three Playgama covers from ONE html page at the exact slot sizes (the upload refuses any other size).
//   square 800x800 (form slot "icon"), portrait 1080x1920 ("preview_vertical"), landscape 1920x1080 ("preview")
// Usage: node cover-shot.js <cover.html> <out_dir>
// The page gets ?w=<px>&h=<px>&slot=<square|portrait|landscape> and must lay itself out for that size
// (use the game's real art/screenshots + the title; no emoji, no placeholder text). Files: cover-<slot>.png
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const SLOTS = { square: [800, 800], portrait: [1080, 1920], landscape: [1920, 1080] };
const [html, out] = process.argv.slice(2);
if (!html || !out) { console.log('Usage: node cover-shot.js <cover.html> <out_dir>'); process.exit(2); }

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  for (const [slot, [w, h]] of Object.entries(SLOTS)) {
    const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    await page.goto(`file://${path.resolve(html)}?w=${w}&h=${h}&slot=${slot}`, { waitUntil: 'networkidle' });
    const file = path.join(out, `cover-${slot}.png`);
    await page.screenshot({ path: file });
    const size = fs.statSync(file).size;
    // PNG header: width/height are big-endian uint32 at bytes 16 and 20
    const buf = fs.readFileSync(file);
    const pw = buf.readUInt32BE(16), ph = buf.readUInt32BE(20);
    const ok = pw === w && ph === h && size <= 10 * 1024 * 1024;
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${slot} ${pw}x${ph} ${(size / 1024).toFixed(0)} KB -> ${file}`);
    await page.close();
  }
  await browser.close();
})();
