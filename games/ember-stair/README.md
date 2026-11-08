# Ember Stair (prototype)

One-button 2D climber for Playgama. Plain HTML5 canvas + JavaScript, no build step.

- **Tap / click / Space / Up**: jump. **Tap in the air**: turn around (once per jump).
- Rising lava forces you up the tower. Height in metres is the score; best score is saved.
- Platforms: normal, crumbling (from ~30 m), moving (from ~70 m). Difficulty ramps with height.
- **Rewarded ad**: one optional "Watch ad to continue" revive per run (only after 25 m).
- **Interstitial**: requested on the game-over screen; Bridge decides whether it actually shows.

## Run locally

```bash
cd games/ember-stair
python3 -m http.server 8000   # open http://localhost:8000
```

Bridge loads `playgama-bridge-config.json` over HTTP, so opening `index.html` from `file://` will not work.
Locally Bridge runs on its mock platform (no ads, in-memory storage).

## Archive for Playgama

Zip the **contents** of this folder so `index.html` and `playgama-bridge-config.json` are at the archive root:
`index.html`, `game.js`, `playgama-bridge.js`, `playgama-bridge-config.json`, `audio/`.
`README.md` does not need to be included.

## Before submitting

- [ ] **Audio (blocker, 3.3.1-3.3.3)**: add recorded/produced ogg or mp3 files to `audio/`
      (`music`, `jump`, `turn`, `land`, `crumble`, `die`, `click`), then set `HAS_AUDIO_FILES = true` in `game.js`.
      Sound synthesized in code is rejected. Mute button, platform audio state and pause handling are already wired.
- [ ] Replace the placeholder title if you rename the game; it must match the title in the publication request (3.5.1).
- [ ] Tutorial hints, controls and layout were checked at phone, desktop, square and landscape sizes; test on a real device.
- [ ] Translations (en, ru, es, de, fr, pt, tr) are first-pass; have them reviewed for the languages you declare.
- [ ] Art is code-drawn placeholder shapes; replace with designed sprites to satisfy 4.3 (no default generated look).
- [ ] Re-check every item in the Playgama Game Requirements before the archive upload.

## Bridge integration summary

Config shipped; Bridge script first in `<head>` (local copy of `@playgama/bridge` 2.4.1) and initialized before the game;
language from `platform.language`; progress only via `bridge.storage` (batched `get` at start, `set` on change);
audio/pause state handled; `game_ready` sent on the first interactive frame; `level_started/failed/paused/resumed` messages;
rewarded reward granted only in the `rewarded` state; unsupported features hidden; custom analytics events:
`revive_offered`, `revive_taken`, `run_ended`, `tutorial_completed`.
