Put REAL recorded / produced audio here (requirement 3.3.1-3.3.2).

- Music: at least a menu track and a gameplay track (ogg or mp3, looped without a gap).
- SFX: one short sound per action + UI click.
- Ship .mp3 only (plays everywhere, incl. iOS Safari; CONFIG.audioExt). Never ship .wav.
  Do not add "fallback" probing for other formats: a missing file logs a 404 console error (1.7.1).
- Sources: CC0 packs (kenney.nl, opengameart.org CC0 only) or a composer / audio generation tool.
- NEVER synthesize sound in code (Web Audio oscillators, procedural tones) - moderation rejects it.
- Record every source + licence in assets/CREDITS.txt (CC0 needs no attribution, but keep the record).

Expected names used by src/main.js (rename in both places if you change them):
  click, catch, miss, over   (sfx)
  music_menu, music_game     (music)

preflight.py fails the build while this folder has no audio files.
