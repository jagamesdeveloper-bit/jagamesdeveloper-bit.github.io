#!/usr/bin/env python3
"""Sync shared files into each game folder and zip archives for Playgama.
usage: build.py [slug ...]   (default: all games)"""
import os, sys, shutil, zipfile
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
G = os.path.join(ROOT, 'games'); D = os.path.join(ROOT, 'dist')
os.makedirs(D, exist_ok=True)
CONFIG = '''{
  "advertisement": {
    "minimumDelayBetweenInterstitial": 60,
    "initialInterstitialDelay": 25,
    "interstitial": { "placementFallback": "game_over", "placements": [ { "id": "game_over" }, { "id": "level_end" } ] },
    "rewarded": { "placementFallback": "bonus", "placements": [ { "id": "bonus" }, { "id": "continue" } ] }
  }
}
'''
INDEX = '''<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">
<meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-capable" content="yes">
<title>%(title)s</title>
<script src="https://bridge.playgama.com/v2/stable/playgama-bridge.js"></script>
</head><body><canvas id="c" tabindex="0"></canvas>
<script src="pg.js"></script><script src="game.js"></script></body></html>
'''
slugs = sys.argv[1:] or sorted(d for d in os.listdir(G) if os.path.isdir(os.path.join(G, d)))
for s in slugs:
    p = os.path.join(G, s)
    meta = {}
    exec(open(os.path.join(p, 'meta.py')).read(), meta)
    shutil.copy(os.path.join(ROOT, 'shared', 'pg.js'), os.path.join(p, 'pg.js'))
    open(os.path.join(p, 'playgama-bridge-config.json'), 'w').write(CONFIG)
    open(os.path.join(p, 'index.html'), 'w').write(INDEX % meta)
    out = os.path.join(D, '%s-%s.zip' % (s, meta['version']))
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        for f in ['index.html', 'pg.js', 'game.js', 'playgama-bridge-config.json']:
            z.write(os.path.join(p, f), f)
    print(s, meta['version'], os.path.getsize(out), 'bytes')
