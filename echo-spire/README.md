# Echo Spire

A Monument Valley-style isometric puzzle game for the browser. Plain HTML5 canvas, no dependencies, no build step.

- Play: open `echo-spire/index.html` (or `/echo-spire/` on GitHub Pages).
- Tap a tile to walk. Tap a crank to turn or slide part of the world. Step onto a glowing plate to work a mechanism.
- Parts of the world carry you if you stand on them. Ladders climb.
- `?` (or `H`) shows a hint from the solver, `R` restarts, `M` mutes, `Esc` opens the menu.
- Finish a level in the fewest possible moves for a star.

## Impossible geometry
- Tiles that *look* adjacent on screen are connected (`illusion` levels), even when they are far apart in 3D.
- Tiles drawn on exactly the same spot are connected too: the Penrose staircase and the Penrose triangle.
- Violet glow marks illusion joins. `blind` levels hide it.

## Adding levels
Edit `levels.js`, then run `node echo-spire/dev/verify-levels.js`. It proves each level is solvable, prints the shortest solution, checks the declared `par`, and fails on overlapping blocks.
Watch for shortcuts: if a level solves in fewer moves than you designed, a tile is probably connecting where you did not intend.
`dev/search-landings.js` searches for machine-style towers (no cranks, the landings are the plates) and filters out solutions that just repeat one plate.
