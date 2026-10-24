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

## Leaderboard and saved progress

- The game submits the run score with `bridge.leaderboards.setScore('high_score', score)` when you die.
- Create a leaderboard with the id `high_score` in the Playgama console (and, for other platforms, map it in `playgama-bridge-config.json`).
- The Leaderboard button adapts to `bridge.leaderboards.type`: `in_game` shows a list in the game, `native` / `native_popup` opens the platform's own board, and anything else shows the player's local top 10.
- Skin unlocks and lifetime stats are saved to localStorage and `bridge.storage` under `inpieces_meta`.

## Ads

The SDK gives no price/eCPM for a queued ad (the platform auction decides), so the game optimises *timing* instead (`AD` in `index.html`, tunables in `AD_CFG`):

- An interstitial and a rewarded ad are **preloaded** at the start of every run and after every ad, so one is always ready.
- **Interstitials** only show at natural breaks (Try Again, plus a stairwell after a boss floor in runs over 6 minutes), never mid-fight, and only when ALL hold: 75 s session grace, 150 s cooldown, the last run lasted 40 s+, no personal best was just set, no rewarded ad in the last 200 s, at most one per two finished runs, and the player's "patience" budget is healthy. Quick deaths drain patience, long runs restore it, and each ad costs some.
- **Rewarded ads** are always optional: Revive (only once there is progress to save), and Reroll on card choices (after the first minute of a run).
- Tuning for typical play (simulated): casual players about 10 interstitials per hour, engaged about 7, frustrated players none.
- Placement names `revive` and `reroll` are passed to `showRewarded` so the dashboard can split revenue per placement.
