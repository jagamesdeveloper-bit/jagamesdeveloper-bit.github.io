# Pipeline reference: tools, order, house style

## Tool map
| Stage | Tool | Notes |
|---|---|---|
| Find / state | `list_applications`, `get_application`, `get_launch_steps` | launch steps = next action |
| Rules | `get_game_checklist`, `get_bridge_sdk_docs`, `get_game_guides` | live wiki; re-read per build |
| Create | `create_application` | check list first; Latin title; `engine:"js"`, `agent:"claude-code"` |
| Form | `update_application_form`, `get_game_categories` | partial save; enum arrays replaced whole |
| Build upload | `start_archive_upload` -> PUT -> `confirm_archive_upload` -> `get_archive_status` | zip <= 300 MB, exact byte size |
| Covers | `start_cover_upload` -> PUT -> `confirm_cover_upload` | 800x800 / 1080x1920 / 1920x1080, png/jpeg <= 10 MB |
| QA | `get_local_game_qa_tool_link`, `get_archive_qa_tool_link` | `mode:certification` for init failures |
| Sandbox | `get_sandbox_state`, `publish_sandbox`, `get_publications`, `get_sandbox_share`, `get_sandbox_traffic`, `start_sandbox_traffic` | public link, no moderation; ask first |
| Submit | `get_submission_state` | submission itself = human in console |
| Live update | `send_playgama_catalog_update` | no moderation; explicit yes required |
| Monetization setup | `list_in_app_products`, `replace_in_app_products`, `list_leaderboards`, `create_leaderboard`, `update_leaderboard` | only if integrated in the game |
| Feedback | `list_moderation_comments` | all platform tasks |
| Analytics | `get_game_telemetry_*` | see telemetry.md |

## House style (observed on Bloomfall and Tangle Tails, the agent-built games)
```
engine: js            agent: claude-code   model: claude-opus | claude-sonnet   modelId: exact id from the runtime
supportedLanguages: EN RU ES DE FR PT_BR TR (+PT_PT)  - only languages with every string translated (3.4.3)
supportedDevices: DESKTOP ANDROID IOS     isHorizontal + isVertical true (game must really handle both)
distributeEverywhere: true (Tangle Tails)  leaderboards: true only if integrated   multiplayer: false for sandbox
category: from get_game_categories by core mechanic (Bloomfall = tetris, Tangle Tails = action)
description: what the game is + concrete content numbers (levels, maps, bosses, modes). >= 100 chars.
howToPlayText: goal first, then "Desktop: ..." and "Mobile: ..." control lines. >= 100 chars.
story: 150-900 chars, English, developer first person, 1-2 real things from making it, ends with a question a player can answer.
covers: names cover-square / cover-portrait / cover-landscape.
archive name: <slug>-<semver>   (one per build; zips are tiny: ~0.1-3 MB)
```
Language code mapping from `bridge.platform.language` (ISO 639-1) to form enums: en EN, ru RU, es ES, de DE, fr FR, pt PT_BR or PT_PT, tr TR, uk UA, ja JA, ko KO, zh ZH, ar AR, id ID, it IT, pl PL, nl NL, hi HI, th TH, vi VI, kk KK, az AZ, uz UZ.

## Archive naming / versions
Bump `CONFIG.version` (src/config.js) and the zip name together; preflight warns on mismatch. Same version must never be uploaded twice with different content.

## Submission blockers (get_submission_state)
`ARCHIVE_PENDING/FAILED/CHECKING`, `ARCHIVE_NOT_BUILDABLE` (no Bridge/config), `FORM_INCOMPLETE` (details lists fields), `COVERS_INCOMPLETE` (emptySlots), `MODERATION_UNAVAILABLE` (use the sandbox; main-catalog moderation opens once sandbox targets are met - `catalogAvailable:false` until then), cooldown after a failed moderation.

## Sandbox gate
Needs: build check PASSED, Bridge >= 2.2.0, all 3 covers, complete form (incl. `story`), not multiplayer. Refusals: `RATE_LIMITED` (15/h), `ORG_QUOTA` (wait for `resetsAt`), `BLOCKED`, `PUBLISHED_ON_PLAYGAMA`.
Observed path: AI-built game -> sandbox archive (`PLAYGAMA_SANDBOX`) -> real-player data -> catalog (`PLAYGAMA`) -> partner platforms re-moderate (Y8, Xiaomi, Lagged...).
