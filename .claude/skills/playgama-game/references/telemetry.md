# Telemetry (guidance, never a gate)

Always read `get_game_telemetry_guide` first (versioned; this file is only a pointer). Never block an upload for missing telemetry - tell the developer what is missing.

## Instrument (before finishing a build)
- One game-local adapter emits everything; use the Bridge session, never invent `session_id`.
- `progression_started` / `progression_completed` / `progression_failed` with bounded `step_id` / `level_id`, `step_index`. Never put level/score/URL in `event_name`.
- `performance_sample` every ~30 s of active visible gameplay: `target_fps, window_ms, active_ms, frame_count, fps_avg, fps_p10, frame_time_p50/p95/p99/max_ms, frames_over_50/100/250/500/1000ms, game_version`. Exclude loading, pause, hidden tab. Counts per window, not lifetime.
- No PII, no stack traces, no URLs.
- Bridge already emits session/playtime/ad/purchase signals - don't duplicate them.

## Read (after real traffic; at most once a day)
1. `get_game_telemetry_analytics` (overview) -> freshness, schema_version, warnings.
2. `get_game_telemetry_event_analytics` per relevant event (`performance_sample` for FPS).
3. `get_game_telemetry_timeseries` only for trend / release comparison (use `1d`).
4. `get_game_telemetry_session_facts` only with a filter, never on `core_ping` / `performance_sample`.
- < 30 unique sessions with samples -> say the conclusion is not reliable.
- Missing/null = unavailable, not zero.
- A stats request alone does not authorize code changes; within an authorized improvement task make the smallest safe change, bump the version, re-measure before claiming improvement.
