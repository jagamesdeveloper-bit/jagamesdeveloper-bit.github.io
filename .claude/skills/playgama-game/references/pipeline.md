# Pipeline reference: tools, order, form template

## Tool map
| Stage | Tool | Notes |
|---|---|---|
| Find / state | `list_applications`, `get_application`, `get_launch_steps` | launch steps = next action |
| Rules | `get_game_checklist`, `get_bridge_sdk_docs`, `get_game_guides` | live wiki; re-read per build |
| Create | `create_application` | check list first; Latin title |
| Form | `update_application_form`, `get_game_categories` | partial save; enum arrays replaced whole |
| Build upload | `start_archive_upload` -> PUT -> `confirm_archive_upload` -> `get_archive_status` | zip <= 300 MB, exact byte size |
| Covers | `start_cover_upload` -> PUT -> `confirm_cover_upload` | 800x800 / 1080x1920 / 1920x1080 |
| QA | `get_local_game_qa_tool_link`, `get_archive_qa_tool_link` | `mode: certification` for init failures |
| Sandbox | `get_sandbox_state`, `publish_sandbox`, `get_publications`, `get_sandbox_share`, `get_sandbox_traffic`, `start_sandbox_traffic` | public link, no moderation; ask first |
| Submit | `get_submission_state` | submission itself = human in console |
| Live update | `send_playgama_catalog_update` | no moderation; explicit yes required |
| Monetization setup | `list_in_app_products`, `replace_in_app_products`, `list_leaderboards`, `create_leaderboard`, `update_leaderboard` | only if the game uses them |
| Feedback | `list_moderation_comments` | all platform tasks |
| Analytics | `get_game_telemetry_*` | see telemetry.md |

## Form template (adapt, don't blindly copy)
Previously used on Elska (the developer's reference game):
```
engine: unity
category: from get_game_categories (Elska = action)
distributeEverywhere: true
excludedPlatforms: []            # set only on request
supportedLanguages: ["EN"]       # add only languages the game really ships (3.4.3)
supportedDevices: only devices with working controls (touch controls needed for IOS/ANDROID)
isHorizontal / isVertical: match the real orientation
multiplayer: true only if sandbox is not the only target (sandbox refuses MULTIPLAYER)
leaderboards / social / hasInGamePurchases: only if the Bridge modules are actually integrated
agent: "claude-code", model: "claude-sonnet", modelId: <exact id from runtime>
description >= 100 chars   howToPlayText >= 100 chars (objective + primary controls)
story: 150-900 chars, English, first person developer voice, ends with a question
```
Elska's `howToPlayText` style: short lines - movement keys, weapon-switch keys, shoot/aim, class abilities.

## Archive naming
`<game-slug>-<semver>[-<tag>]`, e.g. `tangle-tails-1.2.0`. The console keeps every archive; the name is how humans tell them apart.

## Submission blockers (from get_submission_state)
`ARCHIVE_PENDING/FAILED/CHECKING`, `ARCHIVE_NOT_BUILDABLE` (no Bridge/config), `FORM_INCOMPLETE` (details lists fields), `COVERS_INCOMPLETE` (emptySlots), `MODERATION_UNAVAILABLE` (use sandbox; opens after sandbox targets are met), cooldown after failed moderation.

## Sandbox publish gate
Needs: build check PASSED, Bridge >= 2.2.0, all 3 covers, complete form (incl. `story`), not multiplayer. Refusals: `RATE_LIMITED` (15/h), `ORG_QUOTA` (wait for `resetsAt`), `BLOCKED`, `PUBLISHED_ON_PLAYGAMA`.
