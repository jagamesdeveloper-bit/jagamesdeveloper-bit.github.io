# Unity WebGL for Playgama (LEGACY - only for updating Elska-type Unity games; new games are plain JS)

Always fetch live details: `get_bridge_sdk_docs(page, engine: "Unity")`. Pages most used: `api`, `api/platform`, `api/storage`, `api/advertisement/interstitial`, `api/advertisement/rewarded`, `api/payments`, `api/device`, `api/analytics`, setup page for Unity.

## Build settings
- Platform: WebGL. **Decompression Fallback = ON** (req 5.1.1; verify `archiveData.decompressionFallback` after upload).
- Use the Playgama Bridge Unity package/template (it ships the SDK script first in `<head>` and `playgama-bridge-config.json`). Keep Bridge current (>= 2.2.0 needed for sandbox; Elska's 1.33.0 builds failed).
- Size/memory: zip <= 300 MB, startup peak < 2 GB (1.3.x). Prefer small initial download: Addressables, strip unused packages, compress textures/audio. Guides: `performance-and-optimization/unity` (+ `addressables`, `unused-packages`, build optimization tool pages).
- File names Latin only. `index.html` at archive root.

## Required behaviours (wire these in the first build, not at the end)
1. **Init before load** - template does it; don't call SDK APIs before init finishes.
2. **Language** - `platform.language` once after init -> localization source; English default/fallback (3.4).
3. **Saves** - Bridge storage only. Replace every `PlayerPrefs` use. Read all keys in one `storage.get([...])` at startup, write batched on meaningful change only (3.2).
4. **Audio + pause** - one volume controller owns mute: platform audio state, pause event, page visibility, ad open/close, user mute button (3.3.3-3.3.5). Start muted if `isAudioEnabled == false`.
5. **game_ready** - `platform.sendMessage('game_ready')` after the first interactive frame, not during the loading screen.
6. **Interstitial** - call `showInterstitial()` at natural pauses; no own timers. On `Opened`: pause + mute; on `Closed`/`Failed`: resume + restore audio.
7. **Hide unsupported features** - rewarded button if `isRewardedSupported == false`, shop if `payments.isSupported == false`, leaderboard if type `not_available`, sign-in, external links if `isExternalLinksAllowed == false`.
8. **Rewarded** (if used) - opt-in button text states ad + reward; reward only in `rewarded` state; recovery rewards once per attempt (2.2).
9. **Payments** (if used) - only Bridge payments; consume consumables; check `getPurchases()` every launch; permanent purchases restored (2.4).

## 2D-specific checks (Elska-style games)
- Orthographic camera + canvas scaler that fills any aspect, incl. 1:1 and portrait; UI anchored with safe-area insets from `api/device` (1.6).
- Pixel-art: see the `unity:2d-pixel-perfect` skill; make sure scaling doesn't clip UI.
- Input: keyboard needs WebGL canvas focus handling; avoid `Esc` (1.5.2); touch needs virtual joystick/buttons whenever mobile is declared (1.4.4); disable text selection / context menu on long press (1.4.5).
- Sprites: confirm atlases/Addressables are included in the WebGL build (white squares were reported once).
- Audio: shipped ogg/mp3 assets, no code-synthesized sound (3.3.2).
- No external analytics/services (1.2.4/1.2.5); Photon-style realtime backends failed on-platform once - prefer Bridge multiplayer when possible.

## Related skills
`unity:optimize-web`, `unity:2d-pixel-perfect`, `unity:optimize-audio`, `unity:manage-sprite-atlas`, `unity:localization`, `unity:ui`.
