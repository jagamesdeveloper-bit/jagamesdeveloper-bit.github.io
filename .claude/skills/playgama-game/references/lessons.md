# Lessons learned (real moderation history)

Source: `list_moderation_comments` / `get_application` on the developer's games, read 2026-11-08.
Root causes marked *unrecorded* were not written down at the time - confirm before assuming. **Append new entries at the bottom of each section; keep them short.**

## Pre-flight checklist distilled from rejections
Run this mentally on every Unity build before upload:
1. `game_ready` is sent only after the first meaningful frame is visible (not on scene load) - Elska rejected for this; archives on Bridge 1.33.0 got `GAME_NOT_READY`.
2. Interstitial: subscribe to the ad state - `Opened` -> pause game + mute; `Closed`/`Failed` -> resume + unmute (req 2.1.6).
3. Page hidden / tab switched / minimized -> sound stops, resumes on return (req 3.3.5). Use the Bridge visibility/pause events.
4. Platform audio state respected at startup and via events (req 3.3.4).
5. Desktop controls: every advertised key works in the WebGL build (not just in the Editor). Test with the canvas focused and unfocused (req 1.5.1).
6. **If the form says IOS/ANDROID, the game needs touch controls** (virtual joystick or equivalent, req 1.4.4). Otherwise set `supportedDevices` to `["DESKTOP"]` only.
7. UI never cut off at any aspect ratio, including 1:1 (req 1.6.x). Test the size matrix from `game-development/responsive-layout`.
8. Enemies / gameplay actually spawn in the WebGL build (Y8 reported "no enemies").
9. No white-square sprites: all sprites present in the build (atlas/Addressables/stripping suspects; cause *unrecorded*).
10. No external network dependency that can fail on the platform (Photon errors blocked loading, see below). Req 1.2.5 / prefer Bridge multiplayer.
11. Decompression Fallback enabled (req 5.1.1) - `get_archive_status.archiveData.decompressionFallback` must be `true`.
12. Saves only via Bridge storage, never `PlayerPrefs` (req 3.2.1).

## Game log

### Elska - dog vs zombies! Multiplayer co-op (`cmplfo3fp00xvlw0heev23n3x`, Unity, live on Playgama, Y8, Lagged)
| Date | Platform | Complaint | Maps to | Notes |
|---|---|---|---|---|
| 2026-05-27 | PLAYGAMA | Game and music don't pause during interstitial; sound continues after minimize; image shows as white square | 2.1.6, 3.3.5 | wiki: Unity interstitial state event + `visibilityStateChanged`; white square cause unrecorded |
| 2026-06-01 | PLAYGAMA | Game Ready fired before first visible frame | SDK required step 6 | send after first meaningful frame |
| 2026-06-04 | PLAYGAMA | Desktop controls dead except Space/Ctrl (dash) | 1.5.1 | cause unrecorded - check WebGL keyboard capture/focus |
| 2026-06-17 | Y8 | Keyboard controls not working | 1.5.1 | same symptom as above |
| 2026-06-23 | PLAYGAMA | Massive Photon errors, game doesn't load | 1.7.1, 1.2.5 | multiplayer backend; consider Bridge multiplayer (`api/multiplayer`) vs Photon |
| 2026-09-15 | Y8 | No enemies in game, UI cut off | 1.7.2, 1.6.2 | |
| 2026-11-05 | XIAOMI | No on-screen movement controls on touch devices | 1.4.4 | form lists IOS+ANDROID but game is WASD+mouse -> add virtual joystick OR drop mobile devices |

Build history: three Bridge 1.33.0 archives all `PROBLEM / GAME_NOT_READY`; `elskawebglnew` (Bridge 2.4.1, ~166 MB zip, ~72 MB initial, load ~4.7 s) `PASSED`. Large initial size - revisit with `performance-and-optimization/unity`.

### 2048 +Reverb +Slowed (remastered) (`cmsq6b2f802m1o60half8on52`)
- 2026-09-15 PLAYGAMA: **REJECTED** - AI-created games are not taken into the main catalog directly; Playgama directs them to the MCP sandbox route (publish to sandbox, collect real player data, strongest get catalog placement). Lesson: for AI-built games go straight to the sandbox path (Ship step 8) and do not expect a first-pass catalog moderation; also req 4.2.2 (copies/variants of existing games) and 4.3 (generative AI).

## Platform quirks
- Partner platforms (Y8, Xiaomi, Lagged, ...) re-moderate after the Playgama pass and can raise new issues weeks later. After any fix, check `list_moderation_comments` for **all** task types.
- Platform-specific rules: `get_game_checklist(page: "platform-specific-requirements")`.
