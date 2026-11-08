---
name: playgama-game
description: End-to-end workflow for building, checking, packaging, uploading and updating games on Playgama (Unity WebGL first, plain JS second) through the Playgama MCP tools. Use for any Playgama task - new game, new build, Bridge SDK integration, archive upload, covers, form, sandbox publish, moderation feedback, catalog update, telemetry. Encodes past rejections so they are not repeated.
---

# Playgama game workflow

Owner context: Unity developer, 2D games (flagship: Elska). Default engine = `unity`. Use `js` only when the game is not Unity.
The Playgama wiki is the source of truth and changes. **Never copy rules from memory or from this skill's files - re-read them live** with the tools below. This skill holds the *order of work*, the *tool sequence* and the *lessons learned*.

## 0. Orient (always, ~3 calls)
1. `list_applications` - find the game by title (titles are not unique; never `create_application` without checking first).
2. `get_launch_steps(applicationId)` - the authoritative "what is next". Re-read after every step. `UNKNOWN` = call again, not done. `CABINET` = a human step in the console.
3. Read `references/lessons.md` - the rejections already paid for.

## 1. Pick the mode
| Request | Mode |
|---|---|
| New game | A. Create + build |
| New version of existing game | B. Update |
| Moderation / platform feedback | C. Fix from feedback |
| "How is it doing?" | D. Telemetry |

## A. Create + build
1. Plan first (this is a big feature): core loop, devices (desktop / mobile), orientation, languages, monetization (interstitial always; rewarded/IAP optional), saves, multiplayer yes/no.
2. `get_game_checklist` (no page) - read all requirement pages. `get_bridge_sdk_docs(page: "api", engine: "Unity")` - **Required steps** are mandatory. Read per-module pages only for modules used (`api/storage`, `api/platform`, `api/advertisement/*`...).
3. `get_game_guides` - read only the pages matching the work: `game-development/first-session`, `responsive-layout`, `controls`, `sound`, `saving-progress`; for Unity also `performance-and-optimization/unity`.
4. `create_application(title, engine, agent: "claude-code", model, modelId)`. Title: English, Latin only, must equal the in-game title (3.5.1).
5. Build the game. Unity specifics -> `references/unity-webgl.md`.
6. Instrument telemetry -> `references/telemetry.md` (guidance, never a gate).
7. Go to **Ship**.

## B. Update existing game
1. `get_application` - note `activeArchives`, last archive `state`, `archiveData.bridgeVersion`.
2. Bump the build version (the zip name carries it, e.g. `elska-1.4.2`).
3. If Bridge is older than the current one, upgrade first (old 1.33.0 builds of Elska failed with `GAME_NOT_READY`).
4. Re-run the requirement check for anything touched, then **Ship**.
5. If the game is live in the Playgama catalog: `get_submission_state(reviewType: AUTO)`, then **ask the developer**, naming game + archive and that the live catalog is updated for all players **without moderation**; only on an explicit yes call `send_playgama_catalog_update`; follow `get_publications` until it leaves `IN_PROGRESS`.

## Ship (every build, in this order)
1. **Preflight the build folder**: `python3 -I .claude/skills/playgama-game/scripts/preflight.py <build_dir> --zip <out_dir>/<name>-<version>.zip` (checks structure, config, Latin names, size, external URLs, storage misuse; then zips with `index.html` at root). Fix every FAIL; report every WARN.
2. Re-read `get_game_checklist` and tick **each numbered item** (1.x technical, 2.x ads/payments, 3.x UX, 4.x content, 5.x engine). Tell the developer which numbers you could not verify yourself (usually 1.7.x stability, 1.6.x layout matrix, 3.3.x audio). Never say "checked" if the checklist could not be read.
3. Optional local play test: serve the build and `get_local_game_qa_tool_link(url)`.
4. Upload (3 steps): `start_archive_upload(applicationId, name, contentSize = exact bytes from wc -c)` -> `curl -T <zip> -H "<headers from result>" "<uploadUrl>"` within 1 hour -> `confirm_archive_upload`.
5. Poll `get_archive_status` until not `CHECKING`. `PASSED` -> continue. `PROBLEM` / `NOT_CHECKED` -> give the developer `state.message` **word for word**; for `bridgeSdk: NOT_FOUND` or init failures open `get_archive_qa_tool_link(mode: "certification")`. Bridge must be >= 2.2.0 for sandbox.
6. Form: `get_game_categories` first (never guess category), then `update_application_form` (see `references/pipeline.md` for the field template). `story` is required before first sandbox publish.
7. Covers: square 800x800, portrait 1080x1920, landscape 1920x1080, PNG/JPEG <= 10 MB: `start_cover_upload` -> PUT -> `confirm_cover_upload` (each slot). Agents cannot make screenshots/trailers upload - say what is missing.
8. Sandbox (public link, no moderation): `get_sandbox_state(applicationId, archiveId)` -> **ask developer** -> `publish_sandbox` (+ `updateNote` when replacing a live archive) -> follow `get_publications` until `PUBLISHED` -> give the URL. Rate limit 15/hour.
9. Moderation submit is a **human** action in the console. Run `get_submission_state(applicationId, archiveId)` and report the first blocker (`FORM_INCOMPLETE.details`, `COVERS_INCOMPLETE.emptySlots`, `MODERATION_UNAVAILABLE` -> sandbox only).

## C. Fix from feedback
1. `list_moderation_comments` (all platforms: PLAYGAMA, Y8, XIAOMI, LAGGED...). Platform tasks can arrive weeks apart and contradict each other.
2. Map each complaint to a requirement number and to `references/lessons.md`; reproduce before changing code.
3. Fix -> new version -> **Ship**. Append the new lesson (symptom, root cause, fix, requirement #) to `references/lessons.md` in the same change.

## D. Telemetry
`get_game_telemetry_guide` then the drill-down order in `references/telemetry.md`. Statistics request alone does not authorize changing the game.

## Hard rules
- Ask before: `publish_sandbox`, `send_playgama_catalog_update`, anything public or irreversible. Approval for one build does not cover the next.
- No tool exists for submitting to moderation, uploading screenshots/trailers, or rollback - those are the developer's console steps; say so plainly.
- Archive name always carries the version. Never overwrite - the form keeps every archive.
- Don't invent form content: `story`, `description`, `howToPlayText` come from the real game. `story` and `updateNote` follow the voice rules in the tool descriptions (English, plain text, no links, no AI tells).
- Never put secrets in the repo or in files this skill writes.
- Keep context small: fetch wiki pages only for modules in use; don't re-read the full checklist more than once per build unless it failed to load.
