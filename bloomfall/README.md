# Bloomfall

A falling-block garden puzzle for Playgama. Plain JavaScript + Canvas 2D, no engine.

Each level starts with rows of soil hiding **seeds**. Clear a row that holds a seed and it blooms;
bloom every seed to finish the level. From level 8, weeds push a new row up from the bottom every
few blocks. 40 levels with 1–3 stars each, plus an Endless mode with a saved best score.

## Layout

```
game/                       <- this folder is the Playgama archive root
  index.html                Bridge script is the first script in <head>
  playgama-bridge.js        Playgama Bridge SDK 2.4.1 (shipped locally, no CDN)
  playgama-bridge-config.json
  js/i18n.js                EN (default/fallback), RU, ES, DE, FR, PT, TR
  js/game.js                the whole game
  audio/*.ogg|mp3           music loop + 15 sound effects (ogg preferred, mp3 fallback)
store/                      cover-square 800x800, cover-portrait 1080x1920, cover-landscape 1920x1080
tools/
  build.sh [version]        -> dist/bloomfall-<version>.zip
  gen_audio.py <dir>        renders the placeholder audio (numpy + ffmpeg)
  cover.html?kind=...       renders a store cover at the window size
```

Run locally: `python3 -m http.server` in `bloomfall/` and open `/game/index.html`
(add `?bftest` to expose `window.__bf` for automated tests).

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | ← → / A D (hold to repeat) | drag left / right |
| Rotate | ↑ / X / W, Z or Ctrl turns back | tap |
| Soft drop | ↓ / S | drag down |
| Hard drop | Space | flick down |
| Hold | C / Shift, or click the Hold box | flick up, or tap the Hold box |
| Pause | P or the pause button (Esc is not used) | pause button |
| Mute | M or the speaker button | speaker button |

## Playgama integration

- `bridge.initialize()` finishes before any asset loads; `game_ready` is sent on the first menu frame.
- Language from `bridge.platform.language`; English fallback.
- Progress (`unlocked`, `stars`, `best`, `muted`, `tut`) is one JSON value under the storage key
  `bloomfall_save`, read once at startup and written only on level complete, new best, mute toggle
  and tutorial completion.
- `isAudioEnabled` is applied at startup; `AUDIO_STATE_CHANGED`, `PAUSE_STATE_CHANGED` and
  `visibilitychange` mute the game and open the pause menu.
- Interstitials: `level_completed`, `game_over`, `menu` (returning to menu from pause).
  Bridge decides the timing.
- Rewarded `revive` (clears the top rows, once per attempt) is shown only when
  `isRewardedSupported`, and granted only on the `rewarded` state.

## Audio note

The sounds in `game/audio/` are rendered offline by `tools/gen_audio.py`. Playgama rule 3.3.2
rejects sound "synthesized in code", so replace them with recorded or licensed sounds before
submitting to moderation. Keep the same file names (both `.ogg` and `.mp3`) and no code changes are
needed.
