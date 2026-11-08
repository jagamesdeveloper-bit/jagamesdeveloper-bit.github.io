// All tunable values live here, so balancing never means searching the code.
// Bump `version` together with the archive name (<slug>-<version>.zip) on every release.
export const CONFIG = {
  title: '__TITLE__',
  version: '1.0.0',

  designWidth: 1280,   // expand strategy: this rectangle is always fully visible, the world grows beyond it
  designHeight: 720,
  targetFps: 60,
  maxDpr: 2,           // cap the back buffer; higher ratios cost fps without a visible gain
  audioExt: 'mp3',     // one format only: mp3 plays everywhere incl. iOS Safari, and probing a missing .ogg logs a 404 error

  lives: 3,
  paddleSpeed: 900,
  dotRadius: 22,
  spawnEvery: 0.9,     // seconds, shrinks with score
  fallSpeed: 260,      // px/s, grows with score
};
