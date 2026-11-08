# Building the JS game (how Claude Code makes Playgama games)

Scaffold: `scripts/new-game.py <dir> "<Title>"` -> `templates/js-game/`. No bundler, ES modules, serve the folder as-is. Zip = the folder contents.

## What each file owns
| File | Owns | Requirement it keeps you honest on |
|---|---|---|
| `index.html` | Bridge `<script>` first in `<head>` (not async/defer), viewport meta, loading screen | SDK step 2, 1.6.1 |
| `playgama-bridge-config.json` | interstitial/rewarded placements (edit ids when you rename placements) | SDK step 1 |
| `src/platform.js` | the only Bridge caller: init, `language`, batched `storage`, `gate` (silent/pause reasons), ads, `ready()`, `track()`; memory/no-ads fallback when Bridge is absent | SDK 2-7, 2.1.6, 2.2.5, 3.2 |
| `src/main.js` | boot order, DOM UI, state machine, loop, debug hooks | SDK 6 (`game_ready` after first drawn frame), 3.3.3 |
| `src/audio.js` | mp3 buffers, master gain from `gate`, unlock on first gesture, suspend when silent | 3.3.x, 2.1.6 |
| `src/i18n.js` | EN default + ru es de fr pt tr; language only from `platform.language` | 3.4.x |
| `src/input.js` | keys + pointer + touch joystick; no Esc; no selection/context menu | 1.4.x, 1.5.x |
| `src/scale.js` | "expand" scaling, dpr cap 2, resize in place | 1.6.x |
| `src/perf.js` | `performance_sample` every ~30 s active gameplay via `bridge.analytics.send` | telemetry guide |
| `src/config.js` | all tunables + `version` | - |
| `src/game.js` | the actual game (placeholder "catch dots") | 3.1.x |

## Rules of thumb that came from rejections
- **game_ready only after the first meaningful frame is on screen and the loading screen is hidden.** (Elska rejected; builds on old Bridge got `GAME_NOT_READY`.)
- One gate decides silence/pause from: player mute, platform audio, platform pause, ad open, page hidden. Never mute/unmute from elsewhere.
- Interstitial at every natural pause (game over, level end, back to menu) - no own timers; Bridge decides. Rewarded: opt-in button naming the ad and reward; grant only on `rewarded`; recovery rewards once per attempt.
- Hide what the platform lacks: rewarded button if `caps.rewarded` false, shop/leaderboard/sign-in/links likewise.
- Saves: one `storage.get` at start, batched `storage.set` on meaningful change, versioned object (`{v:1,...}`); never localStorage/IndexedDB/cookies.
- No page scroll anywhere, including menu and win screens (Tangle Tails was flagged): `overflow:hidden` is in `style.css`; keep panels `max-height` + inner scroll only if needed.
- Touch AND keyboard both complete the game; if only one works, restrict `supportedDevices` on the form.
- UI text lives in `i18n.js` for every declared language - all keys, all languages (3.4.3). The form's `supportedLanguages` must match.
- Easy to change: levels/waves as data, tunables in `config.js`, debug hooks on `window.__game` (start, skip, stats, perfFlush) so a headless run can drive and measure.
- Keep the first download small (guide: ~5 MB, first playable < 5 s); load music after `game_ready`; ship mp3 (not wav), compress images; one script to batch-optimize assets.
- Distinct look: cohesive palette, real art, designed UI. Generic generated template UI and emoji icons are rejected (4.3.2); AI-assisted is fine, 100% AI visuals without human polish is not (4.3.1).

## Bridge script source
Template uses the wiki-recommended CDN `https://bridge.playgama.com/v2/stable/playgama-bridge.js`. If the build check or a platform complains about it, use the self-contained option from `get_bridge_sdk_docs(page:"setup", engine:"Plain JS")` (npm `@playgama/bridge` + copy `dist/playgama-bridge.js` next to `index.html`). Not wired in the template: `device.safeArea` (CSS `env(safe-area-inset-*)` is used instead) - read `api/device` if a notch problem is reported.

## Testing loop
1. `node scripts/qa-matrix.js <dir> <out> [--quick] [--lang xx] [--muted]` (stubbed Bridge; also `--muted` proves silent start, `--lang` checks other languages).
2. View the PNGs. 3. `preflight.py`. 4. Real Bridge: QA Tool link, then the archive QA link after upload. 5. Real phones when possible (iOS audio unlock and touch behave differently from emulation).
