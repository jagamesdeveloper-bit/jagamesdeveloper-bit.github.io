# Publishing In Pieces on Playgama

The game is `index.html` + `three.min.js`. The Playgama package adds the Bridge SDK and strips the debug hooks.

## Build the package
```
python3 build_playgama.py
```
Upload `dist/in-pieces-playgama.zip` (also copied to `store/`). `index.html` sits at the zip root, as Playgama requires.

## What the Bridge integration does
- `bridge.initialize()`, then sends `game_ready`.
- Sends `gameplay_started` / `gameplay_stopped` as you play, pick upgrades, or an ad shows.
- Pauses and mutes when the platform pauses, the tab is hidden, or an ad is open.
- Interstitial ad after a death (on Try Again) and after each boss floor. The SDK enforces the minimum delay.
- Rewarded ad on the death screen to revive once per run.
- Saves the best floor through `bridge.storage` (falls back to localStorage).
- Without the SDK (the GitHub Pages / preview copy) all of this is a silent no-op.

## Store assets (placeholders generated from the game)
`store/icon-512.png`, `store/cover-1280x720.png`, `store/screenshot-*.png` (portrait).
Check the sizes against the current Playgama listing requirements and swap them if needed.

## Test before uploading
```
cd dist/playgama && python3 -m http.server 8000
```
and open http://localhost:8000
