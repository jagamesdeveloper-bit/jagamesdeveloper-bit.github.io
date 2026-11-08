# Lessons learned (real moderation history)

Source: `list_moderation_comments` / `get_application`, read 2026-11-08. Causes marked *unrecorded* were never written down - confirm before assuming. **Append new entries at the bottom of their section; keep them short.**

## Pre-flight list distilled from rejections (JS games)
1. `game_ready` only after the first meaningful frame is visible and loading screen hidden. (Elska rejected; builds on old Bridge got `GAME_NOT_READY`.)
2. Interstitial open -> pause + mute; closed/failed -> resume + unmute. (2.1.6)
3. Tab hidden / minimized -> silence, resume on return. (3.3.5)  Platform audio state applied at start AND via events. (3.3.4)
4. **Sound must be real audio files, not code-synthesized** - Tangle Tails: "sounds are standard JS/AI-generated" (3.3.2).
5. **No scroll bars/page scroll on any screen**, incl. main menu and win screen - Tangle Tails (1.6.3).
6. Enough content: modes, progression, depth - Tangle Tails was asked for "more game modes and progression" (3.1.2); 2048 remaster rejected as AI-made (see below).
7. Desktop keys work in the real build; touch controls exist whenever mobile is declared (1.4.4, 1.5.1). Elska: dead keys, then Xiaomi "no on-screen controls". If only one input works, restrict `supportedDevices`.
8. UI never cut off at any aspect ratio incl. 1:1 (1.6.x); enemies/gameplay present in the shipped build (Y8: "no enemies").
9. No missing-image "white square" (assets referenced but not shipped / failed load).
10. No external services that can fail on the platform (Elska: Photon errors blocked loading) (1.2.5, 1.7.1).
11. Saves only via Bridge storage (3.2.1). English default + language from `platform.language` (3.4).
12. No emoji-as-icons / generic template UI (4.3.2).

## Games

### Tangle Tails (`cmuu0p2qo0c91g40hs2lhctmq`, js, live in Playgama catalog)
- ~30 archives `tangle-tails-1.0.0 .. 3.4.0` in five weeks, all PASSED on Bridge 2.3.x -> 2.4.1 (javascript), initial size ~160 KB, load ~0.3-0.5 s. Iterating semver per build works well.
- 2026-10-07 PLAYGAMA: refine sound design (standard JS/AI-generated sounds); add more modes and progression. -> req 3.3.2, 3.1.2.
- 2026-10-13 PLAYGAMA: scroll in main menu and win screen. -> req 1.6.3. Published the same day.
- Form used: 8 languages, desktop+mobile, both orientations, leaderboards on, distributeEverywhere on.

### Bloomfall (`cmw6hql3w0jrrno0h716gku7s`, js, created via MCP by claude-opus, sandbox)
- bloomfall-1.0.0: 1.6 MB zip, initial 0.77 MB, load ~0.4 s, PASSED on Bridge 2.4.1. 7 languages, keyboard + touch controls described in `howToPlayText`. No moderation feedback yet.

### 2048 +Reverb +Slowed (remastered) (`cmsq6b2f802m1o60half8on52`)
- 2026-09-15 PLAYGAMA **REJECTED**: AI-created games are not taken into the main catalog directly; Playgama points to the MCP sandbox route (get first players, performance data, best get catalog placement). -> Go straight to Ship step 8 (sandbox) for AI-built games. Also mind 4.2.2 (variants/copies of existing games) and 4.3.

### Elska - dog vs zombies! (`cmplfo3fp00xvlw0heev23n3x`, **Unity**, live: Playgama, Y8, Lagged; Xiaomi pending)
| Date | Platform | Complaint | Req |
|---|---|---|---|
| 2026-05-27 | PLAYGAMA | no pause/mute during interstitial; sound continues after minimize; white square instead of image | 2.1.6, 3.3.5 |
| 2026-06-01 | PLAYGAMA | Game Ready fired before first visible frame | SDK 6 |
| 2026-06-04 | PLAYGAMA | desktop controls dead except Space/Ctrl | 1.5.1 (cause *unrecorded*) |
| 2026-06-17 | Y8 | keyboard controls not working | 1.5.1 |
| 2026-06-23 | PLAYGAMA | massive Photon errors, doesn't load | 1.7.1, 1.2.5 |
| 2026-09-15 | Y8 | no enemies; UI cut off | 1.7.2, 1.6.2 |
| 2026-11-05 | XIAOMI | no on-screen movement controls on touch | 1.4.4 (form lists IOS+ANDROID, game is WASD+mouse) |
Build history: three Bridge 1.33.0 archives `GAME_NOT_READY`; `elskawebglnew` (Bridge 2.4.1, 166 MB, ~72 MB initial, load 4.7 s) PASSED.

## Platform quirks
- Partner platforms re-moderate after the Playgama pass and raise new issues weeks later. After any fix check `list_moderation_comments` for **all** task types; platform rules: `get_game_checklist(page:"platform-specific-requirements")`.
