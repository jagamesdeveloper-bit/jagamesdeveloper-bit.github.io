# Lane Clash

Real-time 2D lane battler (HTML5 canvas, vanilla JS, no build step, no dependencies).
Portrait first, works with touch and mouse.

## Run

```
cd game && python3 -m http.server 8000   # then open http://localhost:8000
```
ES modules need http(s); opening `index.html` via `file://` will not work.

## Layout

| File | Role |
|---|---|
| `js/data.js` | All balance numbers: cards, towers, match timings, arena geometry |
| `js/sim.js` | Pure simulation (no DOM): elixir, decks, units, towers, projectiles, spells, win rules. Fixed 30 Hz tick |
| `js/bot.js` | Opponent AI (counter-picks threats, otherwise pushes a lane) |
| `js/render.js` | Canvas drawing + HUD layout |
| `js/main.js` | Input (drag / tap-to-place), game loop, screens, pause on focus loss |
| `js/audio.js` | WebAudio blips, unlocked on first input |
| `js/platform.js` | Seam for the hosting platform: ads, save, language, focus. **Playgama SDK not wired yet** |

## Rules implemented

3:00 match, then 1:00 overtime (2x elixir), then sudden death (first crown wins, 1:00 cap then draw).
King tower = 3 crowns and ends the match instantly. King wakes when hit or when a princess falls.

## Publishing on Playgama (TODO)

Zip the contents of `game/` with `index.html` at the zip root. Fill in `platform.js` from the
Playgama developer console docs (SDK init, interstitial/rewarded ads, cloud save, language).
