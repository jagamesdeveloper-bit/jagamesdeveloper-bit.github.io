---
name: playgama-game
description: Build, check, package, upload and iterate Playgama web games (plain JS made by Claude Code via the Playgama MCP) end to end - scaffold, Bridge SDK required steps, QA at the size matrix, preflight, archive upload, covers, form, sandbox, moderation fixes, telemetry. Use for any Playgama task - new game, new version, upload, moderation feedback, "finish this draft". Encodes the developer's past rejections so they are not repeated.
---

# Playgama game workflow (JS games built by Claude Code)

Default = **plain JavaScript, no build step, engine `js`, created through the MCP** (`create_application`, `agent: "claude-code"`). Unity is only the legacy path (Elska) -> `references/legacy-unity.md`.
The Playgama wiki is the source of truth and changes: **re-read rules live with the tools; never copy them from memory or from this skill.** This skill holds the *order of work*, the *tool sequence*, working *scripts* and *lessons from real rejections*.

## 0. Orient (every task, ~3 calls)
1. `list_applications` - match by title (titles are not unique; never `create_application` before checking).
2. `get_launch_steps(applicationId)` - authoritative next step. Re-read after each step. `UNKNOWN` = call again. `CABINET` = human step in the console.
3. Read `references/lessons.md` (rejections already paid for) and, for a known game, `references/game-registry.md`.

| Request | Mode |
|---|---|
| New game | A |
| New version / "update" | B |
| Moderation or platform feedback | C |
| "How is it doing?" | D (`references/telemetry.md`) |

## A. New game
1. **Plan first** (big feature): core loop, session length, progression and modes (moderators flagged "little gameplay / no progression"), controls for desktop AND touch, orientation(s), languages, ads (interstitial always; rewarded optional), saves, leaderboard yes/no. Aim for >= 10 min of distinct play (guide: first-session).
2. **Assets first.** Audio must be real recorded/produced files (3.3.2 rejects code-synthesized sound - Tangle Tails was told its sounds were "standard JS/AI-generated"). If the developer supplied no audio, ask for it or fetch CC0 packs (kenney.nl, opengameart CC0) if the network allows; keep `assets/CREDITS.txt`. Do not start the game's audio by synthesizing placeholders. Graphics: one cohesive style, designed UI, **no emoji as icons** (4.3.2).
3. Read live: `get_game_checklist` (all pages), `get_bridge_sdk_docs(page:"api", engine:"Plain JS")` Required steps, plus module pages you use, and guides `game-development/{first-session,responsive-layout,controls,sound,saving-progress}` + `building-with-ai-agents`.
4. `create_application(title, engine:"js", agent:"claude-code", model, modelId)` (title = in-game title, Latin only).
5. **Scaffold**: `python3 -I .claude/skills/playgama-game/scripts/new-game.py <dir> "<Title>"`. It gives a working Bridge-ready skeleton (boot order, language, storage, one volume/pause gate, ads, game_ready after first frame, perf telemetry, i18n for 7 languages, keyboard+touch input, expand scaling, debug hooks). Replace `src/game.js` with the real game; keep `main.js`/`platform.js` flow. Details: `references/js-game-build.md`.
6. Build iteratively with `window.__game` debug hooks and `scripts/qa-matrix.js`; keep tunables in `config.js`, levels as data.
7. Go to **Ship**.

## B. New version of an existing game
1. `get_application`: `activeArchives`, last archive `state`, `archiveData.bridgeVersion`, languages/devices on the form.
2. Bump `CONFIG.version` and name the archive `<slug>-<same version>`; semver, one upload per build (Tangle Tails shipped ~30 builds this way). Never overwrite.
3. Re-check only what changed against the checklist numbers, then **Ship**.
4. If the game is live in the Playgama catalog: `get_submission_state(reviewType:"AUTO")`, then **ask the developer** (game, archive, "live catalog updated for all players without moderation"); only on an explicit yes `send_playgama_catalog_update`; follow `get_publications` until not `IN_PROGRESS`.

## Ship (every build, in order)
1. `node scripts/qa-matrix.js <dir> <out>` - 15 sizes + play/pause/game-over/ad/revive flow with a Bridge stub. **Open the screenshots and look** (at least phone portrait, phone landscape, square, ultrawide, plus each distinct screen of the game). Passing numbers is not seeing screens.
2. `python3 -I scripts/preflight.py <dir> --zip <out>/<slug>-<version>.zip` - structure, config, Bridge-first, required API calls present, audio present, no synth/emoji/Esc/localStorage/external URLs. Fix every FAIL, report every WARN.
3. `get_game_checklist` again: tick **every numbered item**; tell the developer which you could not verify (typically 1.7.x stability on real iOS/Android, 3.3.x by ear, 4.x content/rights). If it could not be read, say so; never write "checked".
4. Optional: `get_local_game_qa_tool_link(url)` for the Bridge harness (stub != real SDK).
5. Upload: `start_archive_upload(applicationId, name, contentSize = exact bytes)` -> `curl -T <zip> -H "<headers>" "<uploadUrl>"` within 1 h -> `confirm_archive_upload` -> poll `get_archive_status` until not `CHECKING`. `PASSED` continue; `PROBLEM`/`NOT_CHECKED`: give `state.message` **verbatim**; `bridgeSdk: NOT_FOUND` -> `get_archive_qa_tool_link(mode:"certification")`.
6. Form (first time or when changed): `get_game_categories` first, then `update_application_form` using the house style in `references/pipeline.md`. `story` is required before the first sandbox publish.
7. Covers (first time): render with `node scripts/cover-shot.js <cover.html> <dir>` (800x800 / 1080x1920 / 1920x1080), then per slot `start_cover_upload` -> PUT -> `confirm_cover_upload`.
8. Sandbox (public link, no moderation): `get_sandbox_state(applicationId, archiveId)` -> **ask the developer** -> `publish_sandbox` (+ `updateNote` when replacing a live build) -> follow `get_publications` to `PUBLISHED` -> hand over the URL. Limit 15 publishes/hour.
9. `get_submission_state(applicationId, archiveId)`; report the first blocker. Submitting to moderation is a **human** console action.

## C. Feedback
1. `list_moderation_comments` for **all** task types (PLAYGAMA, Y8, XIAOMI, LAGGED, ...): platforms re-moderate weeks apart and can contradict.
2. Map each complaint to a requirement number and to `references/lessons.md`; reproduce (qa-matrix + the failing device size/input) before changing code.
3. Fix -> bump version -> **Ship**. Append the lesson (symptom, cause, fix, requirement #) to `references/lessons.md` in the same change.

## Hard rules
- Ask before `publish_sandbox`, `send_playgama_catalog_update`, anything public/irreversible; approval for one build does not cover the next.
- No tool for: moderation submit, screenshots/trailer upload, rollback. Say so plainly and name what the developer must do in the console.
- Don't invent form content or backstory; `story`/`updateNote` follow the voice rules in their tool descriptions (English, plain text, no links, no AI tells).
- No secrets in the repo. No external analytics (1.2.4), nothing loaded from outside the archive except the Bridge script (1.2.5).
- Keep context small: fetch only the wiki pages for modules in use; re-read the full checklist once per build.
