# Echo Spire

A Monument Valley-style isometric puzzle game for the browser. Plain HTML5 canvas, no dependencies, no build step.

- Play: open `echo-spire/index.html` (or `/echo-spire/` on GitHub Pages).
- Tap a tile to walk. Tap a crank to turn or slide part of the world.
- With `illusion` levels, tiles that *look* adjacent on screen are connected.
- Add levels in `levels.js`, then run `node echo-spire/dev/verify-levels.js` to prove each one is solvable and has no overlapping blocks.
