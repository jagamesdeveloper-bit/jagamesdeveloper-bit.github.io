# Echo Spire

A Monument Valley-style isometric puzzle game for the browser. Plain HTML5 canvas, no dependencies, no build step.

- Play: open `echo-spire/index.html` (or `/echo-spire/` on GitHub Pages).
- Tap a tile to walk, tap a crank to turn or slide part of the world. Parts of the world carry you if you stand on them.
- `?` (or `H`) shows a hint from the solver, `R` restarts, `M` mutes, `Esc` opens the menu.
- Finish a level in the fewest possible turns for a star.
- In `illusion` levels, tiles that *look* adjacent on screen are connected.

## Adding levels
Edit `levels.js`, then run `node echo-spire/dev/verify-levels.js`. It proves each level is solvable, prints the shortest crank sequence (the par), and fails on overlapping blocks.
Watch for shortcuts: if a level solves in fewer taps than you designed, a tile is probably connecting where you did not intend.
