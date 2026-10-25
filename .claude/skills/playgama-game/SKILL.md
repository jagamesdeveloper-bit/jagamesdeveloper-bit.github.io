---
name: playgama-game
description: Build, polish and publish a browser game that is made for Playgama (playgama.ai). Use whenever the user wants a new web game, a game update, or an upload to their Playgama sandbox. Covers the single-file HTML game pattern, Playgama Bridge v2 rules (storage, ads, pause/audio, leaderboards, analytics), the compliance checklist, testing, covers and the MCP upload flow.
---

# Playgama-directed games

The user is a Unity programmer and pro gamer who works from a phone. They like short plans for big features and almost none for small script changes. Their reference game is **In Pieces** (`dungeon-chess/`), a real-time chess dungeon crawler. Copy its structure for new games. Games are plain HTML5, not Unity, so they run in the browser and upload as a zip.

## Project shape
- One game per folder, e.g. `my-game/`, with `index.html` (all game code), vendored libraries (e.g. `three.min.js`), `sfx.js` or `sfx/`, `music/`, `CREDITS.md`, `build_playgama.py`, `store/` (covers, zip) and `PLAYGAMA.md` (notes).
- Everything ships inside the build. **No external resources** except the Bridge script. No CDN fonts, libraries, analytics or social links.
- Latin-only file names. `index.html` at the zip root. Archive far below 300 MB.
- Use free CC0 assets (Kenney, OpenGameArt) and list them in `CREDITS.md`. Never synthesize sound procedurally. Ship mp3/ogg.
- Add a debug hook (`window.__cc = {...}`) so a headless browser can drive and inspect the game. The build script strips it. Keep that marker consistent with the build regex.

## Bridge SDK: use v2
- Script: `https://bridge.playgama.com/v2/stable/playgama-bridge.js`. **Not v1.** The sandbox refuses anything below 2.2.0 (`BRIDGE_VERSION_OUTDATED`). Put `<!--PLAYGAMA_SDK-->` in `index.html` and let the build script swap in the script tag.
- Put an empty `playgama-bridge-config.json` (`{}`) next to `index.html`.
- v2 removed `bridge.game`. Use `bridge.platform.isPaused`, `isAudioEnabled` and the events `bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED|AUDIO_STATE_CHANGED, ...)`. Apply the initial values at start, because events only fire on changes.
- `bridge.initialize()` first, then send `platform.sendMessage('game_ready')` once the first playable frame is up. Use string literals for messages and states (`'game_ready'`, `'level_started'`, `'level_paused'`, `'level_resumed'`, rewarded states `'rewarded'|'closed'|'failed'`). There is no `gameplay_started` message.
- **Storage:** never touch `localStorage` when Bridge is present. Load all keys in ONE call (`bridge.storage.get([keys])` returns an array), save in ONE call (`bridge.storage.set([keys],[values])`), debounce saves (~400 ms). Fall back to `localStorage` only when `bridge` is undefined or init failed. Keep a small `Store` wrapper with `get/set/flush` and a `hydrate()` that re-reads saves after the async load. Verify progress survives a reload. Endless games must save the best score.
- **Ads:** at least one of interstitial/rewarded, through Bridge only. Interstitials only at natural pauses (game over, level change), never under the player's finger. Rewarded ads are opt-in: a clear button saying what it gives, reward granted ONLY on state `'rewarded'`, a failed ad leaves the game playable. Never offer "+1 life" on every death. Pause and mute from the pause/audio events, not per ad type.
- **Leaderboard:** `bridge.leaderboards.setScore(id, score)` after a run, guarded by `type !== 'not_available'`. Create the same id with the MCP `create_leaderboard`.
- **Analytics:** `bridge.analytics.send(name, flatObject)` (Bridge 2.3+) for game-specific events like `run_started` and `run_ended`. Don't duplicate platform messages. snake_case names.
- Language: English is required and the default. If more languages are added, pick via `platform.language`.

## UI and platform rules (checklist items people forget)
- Mute control. Pause on tab hide. Sound stops in the background and during ads.
- No page scrollbar. Every popup has a close button.
- Block the long-press context menu (`contextmenu` preventDefault, `user-select:none`, `touch-action:none`).
- Desktop: stretch to the window but cap the stage at a 2:1 aspect ratio (centered `body{max-width:200vh}` with `transform:translateZ(0)` so fixed children follow; subtract the stage's left offset from pointer x).
- Both touch and keyboard controls must work.
- Test a size matrix: 360x640, 390x844, 915x412, 1280x720, 2560x1440. Add compact media queries for `max-height:700px` and short landscape. **Look at every screenshot yourself.**
- Cap the frame rate on touch devices. Don't judge performance in the first 10 s.
- No sign-in, no domain locks, no external links.

## Quality bar (what the user cares about)
- Juice, readable text, real audio, a strong first minute, fair difficulty (telegraphed hazards). When asked for "hard", add mechanics (new boss kits, hazards), not only stat bumps.
- Check design flaws: soft-locks, unreachable tiles, unfair death sources. Write a headless bot/audit script for balance, with the caveat that random bots are rough.
- When fixing a bug, reproduce it with a counted test (e.g. 400 generated rooms before and after), not by eye.

## Workflow
1. Read the checklist (`get_game_checklist`) and the telemetry guide (`get_game_telemetry_guide`) from the Playgama MCP before building or uploading. Say which items you could not check.
2. Build in the game folder. Test headless (Playwright is preinstalled: `require('playwright')`, launch Chromium with `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist` for WebGL). Test with a **mock bridge** and with the **real v2 SDK** (it runs as a mock platform on file://).
3. `python3 build_playgama.py` (template: `.claude/skills/playgama-game/build_playgama.template.py`). Bump `VERSION` each upload, archive name `<game>-<version>`.
4. Commit and push to the branch you were given. Never open a PR unless asked.
5. Playgama MCP flow: `create_application` (English title, engine `js`, agent `claude-code`) -> `update_application_form` (category by core mechanic via `get_game_categories`, description >=100 chars, how-to-play >=100 chars, devices, languages, orientations, leaderboards flag, `multiplayer:false`) -> `create_leaderboard` -> covers -> archive -> poll `get_archive_status` until `PASSED` -> `get_sandbox_state` with the archiveId -> `publish_sandbox` -> `get_publications` until `PUBLISHED`. Then open the live URL with Playwright and play a few seconds.
   - Covers need exact sizes: square 800x800, portrait 1080x1920, landscape 1920x1080 (png/jpeg). Flow: `start_cover_upload` -> `curl -X PUT -T file -H "Content-Type: image/png" <url>` -> `confirm_cover_upload`. Archive: `start_archive_upload` -> PUT zip -> `confirm_archive_upload`.
   - Covers should be designed key art (title, hero, depth), not raw screenshots. Render the art at the final size, don't upscale.
   - Wait with `Monitor` + `sleep`, never chained sleeps. The build check takes ~1 minute.
6. Report the live URL, what changed, what you verified, and what you could not (real phones, real ad networks).

## Rules about publishing
- Publishing to the sandbox is public. Do it when the user asked to update/upload. When they only ask for changes, build and offer to publish.
- **Never republish just to bump visibility or "get to the top".** It does nothing for ranking, risks a block and the 15-publishes-per-hour limit. Refuse politely and offer real options: moderation submission in the console (no tool, human only), `get_sandbox_traffic` / referral bonuses, sharing the link.
- Multiplayer games need Playgama to whitelist hosts, and the sandbox refuses `multiplayer:true`. Plan co-op as a separate build and say so up front.
- Never ask the user for tokens or auth codes. If the Playgama connector is "Needs authentication", tell them to add/reauthorize it in claude.ai connectors and start a new session.
- A human submits to moderation and uploads screenshots in the console. Say so.
- Don't put model names in commits or in anything pushed. Use the attribution lines the session gives.

## Reference
- Example game: `dungeon-chess/` (see `PLAYGAMA.md`, `build_playgama.py`, the `Store` and `PG` objects in `index.html`).
- Docs: use the MCP `get_bridge_sdk_docs` (engine "Plain JS"); pages `api/platform`, `api/advertisement`, `api/storage`, `api/leaderboards`, `api/analytics`, `changelog`.
