/* Echo Spire - level data.
 *
 * Block:  [x, y, z, kind, dir, colorOverride]
 *   kind 'b' walkable block, 'd' decoration (solid, not walkable), 's' stair (dir 0..3 = +x,+y,-x,-y, the way it climbs)
 * Piece 0 is the static world. Other pieces turn (rot) and/or slide.
 *   rot:   { cycle, step }   a tap advances the piece one quarter turn (step = +1 / -1); cycle is how many poses it has
 *   slide: [dx, dy, dz]      where the piece moves when toggled
 * Handles are the cranks: { type, piece (id or ids), on (piece id carrying the crank), at: [x,y,z] block it stands on }
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EchoLevels = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const line = (x, y, z, dx, dy, n, kind) =>
    Array.from({ length: n }, (_, i) => [x + dx * i, y + dy * i, z, kind || 'b']);
  const col = (x, y, z, h) => Array.from({ length: h }, (_, i) => [x, y, z + i, 'd']);
  const under = (blocks) => blocks.map(b => [b[0], b[1], b[2] - 1, 'd']);

  const CREAM = '#f4d9c4';
  const CORAL = '#e8806c';
  const TEAL = '#5fb3ad';
  const VIOLET = '#8e7fe0';
  const AMBER = '#f0b05a';

  // Deco columns from the ground up to just under each given tile.
  const solid = tiles => tiles.filter(t => t[2] > 0).flatMap(t => col(t[0], t[1], 0, t[2]));

  // A run of "impossible bridges". Stage k has a rotating piece whose arm only lines up on screen with the
  // previous platform in one pose: the arm sits one block higher and two cells over, so it looks attached.
  // Stages alternate between the two diagonals (side 'R' or 'L') so the tower zigzags. A stage that joins the
  // next platform by illusion too ('visual') leaves room for a four-pose piece. Cranks are shared between
  // pieces and may turn them backwards, so the puzzle is to find taps that put every piece in its pose.
  //   o.stages[k] = [poses, side, visualJoin]      o.cranks[j] = [[stages it turns], direction +1 / -1]
  function chain(o) {
    const n = o.stages.length;
    const pal = [VIOLET, CORAL, TEAL, AMBER, '#d97bb0', '#6f9be0', '#7cc07a'];
    const mir = (side, d) => (side === 'L' ? [d[1], d[0], d[2]] : d);
    const add = (p, d) => [p[0] + d[0], p[1] + d[1], p[2] + d[2]];
    const firstSide = o.stages[0][1];
    const stat = firstSide === 'L' ? line(0, -2, 0, 0, 1, 3) : line(-2, 0, 0, 1, 0, 3);
    const pieces = [{ color: CREAM, blocks: stat }];
    const A = [];
    let a = [0, 0, 0];
    o.stages.forEach(([cycle, side, visual], k) => {
      A.push(a);
      const u = add(a, mir(side, [3, 1, 1])), t0 = add(a, mir(side, [3, 2, 1]));
      pieces.push({
        color: pal[k % pal.length], pivot: [u[0] + 0.5, u[1] + 0.5], rot: { cycle, step: side === 'L' ? -1 : 1 },
        blocks: [[u[0], u[1], u[2]], [t0[0], t0[1], t0[2]], [u[0], u[1], u[2] - 1, 'd'], [t0[0], t0[1], t0[2] - 1, 'd']],
      });
      a = add(u, mir(side, visual ? [2, 1, 1] : [1, 0, 0]));
      // One tile only: a second tile beside it would look attached to the pivot tile and skip the puzzle.
      const land = k === n - 1 ? [a, add(a, mir(side, [1, 0, 0]))] : [a];
      stat.push(...land, ...land.flatMap(t => col(t[0], t[1], t[2] - 2, 2)));
    });
    const spots = [[1, 4, 0], [-2, 3, 0], [4, -2, 0]];
    const handles = o.cranks.map(([targets, dir], j) => {
      const s = j % n, side = o.stages[s][1];
      const ped = add(A[s], mir(side, spots[Math.floor(j / n) % spots.length]));
      stat.push([ped[0], ped[1], ped[2], 'd']);
      return { type: 'rot', piece: targets.map(t => t + 1), on: 0, at: ped, dir };
    });
    stat.push(...(firstSide === 'L' ? col(-3, -1, 0, 4) : col(-1, -3, 0, 4)));
    const last = o.stages[n - 1][1];
    return {
      name: o.name, hint: o.hint, sky: o.sky, illusion: true, par: o.par, pieces, handles,
      start: firstSide === 'L' ? [0, -2, 0] : [-2, 0, 0], goal: add(a, mir(last, [1, 0, 0])),
    };
  }

  // A staircase that climbs two blocks and still closes on itself on screen: the last tile of the loop sits
  // exactly where the first one is drawn. A rotating bridge guards the way out.
  const RING_LO = '#f3dcc6', RING_MID = '#f0bf9e', RING_HI = '#e79aa0';
  const ringTiles = [
    [1, 0, 0, 'b', 0, RING_LO], [2, 0, 0, 'b', 0, RING_LO], [3, 0, 0, 'b', 0, RING_LO], [4, 0, 0, 'b', 0, RING_LO],
    [5, 0, 1, 's', 0, RING_MID], [6, 0, 1, 'b', 0, RING_MID],
    [6, 1, 1, 'b', 0, RING_MID], [6, 2, 1, 'b', 0, RING_MID], [6, 3, 1, 'b', 0, RING_MID], [6, 4, 1, 'b', 0, RING_MID],
    [6, 5, 2, 's', 1, RING_HI], [6, 6, 2, 'b', 0, RING_HI],
    [5, 6, 2, 'b', 0, RING_HI], [4, 6, 2, 'b', 0, RING_HI], [3, 6, 2, 'b', 0, RING_HI], [2, 6, 2, 'b', 0, RING_HI],
    [2, 5, 2, 'b', 0, RING_HI], [2, 4, 2, 'b', 0, RING_HI], [2, 3, 2, 'b', 0, RING_HI], [2, 2, 2, 'b', 0, RING_HI],
  ];
  const ENDLESS = {
    name: 'The Endless Stair',
    hint: 'Climb the stairs. They end exactly where they began.',
    sky: ['#fbe3d0', '#6e5fc8'],
    illusion: true,
    pieces: [
      {
        color: CREAM,
        blocks: [
          ...line(-2, 0, 0, 1, 0, 3), ...ringTiles,
          ...line(10, 6, 2, 1, 0, 2), ...col(10, 6, 0, 2), ...col(11, 6, 0, 2),
          [8, 9, 0, 'd'],
          ...col(0, -3, 0, 4), ...col(1, -3, 0, 2), ...col(9, 0, 0, 4), ...col(10, 0, 0, 2),
        ],
      },
      { color: CORAL, pivot: [8.5, 6.5], rot: { cycle: 4, step: 1 }, blocks: line(8, 5, 2, 0, 1, 3) },
    ],
    handles: [{ type: 'rot', piece: 1, on: 0, at: [8, 9, 0] }],
    start: [-2, 0, 0], goal: [11, 6, 2],
  };

  const ALL = [
    // 1 ---------------------------------------------------------------
    {
      name: 'The First Door',
      hint: 'Tap the ground to walk. Tap the golden crank to turn the world.',
      sky: ['#ffd9c7', '#a99be8'],
      pieces: [
        {
          color: CREAM,
          blocks: [
            ...line(0, 0, 0, 1, 0, 3),
            ...line(6, 0, 0, 1, 0, 3),
            [4, 2, 0, 'd'],
            ...col(-1, -3, 0, 4), ...col(0, -3, 0, 2), ...col(3, -4, 0, 5), ...col(4, -4, 0, 3), ...col(9, -2, 0, 3),
          ],
        },
        { color: CORAL, pivot: [4.5, 0.5], rot: { cycle: 4, step: 1 }, blocks: [[4, -1, 0], [4, 0, 0], [4, 1, 0]] },
      ],
      handles: [{ type: 'rot', piece: 1, on: 0, at: [4, 2, 0] }],
      start: [0, 0, 0], goal: [8, 0, 0],
    },

    // 2 ---------------------------------------------------------------
    {
      name: 'Climbing Ground',
      hint: 'Some paths only exist from the right angle.',
      sky: ['#cdeee8', '#8fa6e8'],
      pieces: [
        {
          color: CREAM,
          blocks: [
            ...line(0, 0, 0, 1, 0, 4),
            ...line(6, 0, 1, 1, 0, 2), [7, 1, 1],
            ...under(line(6, 0, 1, 1, 0, 2)), ...under([[7, 1, 1]]),
            [2, 3, 0, 'd'],
            ...col(-1, -3, 0, 3), ...col(2, -4, 0, 5), ...col(3, -4, 0, 4), ...col(8, -3, 0, 4),
          ],
        },
        {
          color: TEAL, pivot: [4.5, 0.5], rot: { cycle: 2, step: -1 },
          blocks: [[4, 0, 0], [4, 1, 0, 'd'], [4, 1, 1, 's', 1]],
        },
      ],
      handles: [{ type: 'rot', piece: 1, on: 0, at: [2, 3, 0] }],
      start: [0, 0, 0], goal: [7, 1, 1],
    },

    // 3 ---------------------------------------------------------------
    {
      name: 'Two Ways to Move',
      hint: 'Teal cranks slide. Gold cranks turn.',
      sky: ['#ffe7b8', '#f19db0'],
      pieces: [
        {
          color: CREAM,
          blocks: [
            ...line(0, 0, 0, 1, 0, 3),
            [3, 3, 0, 'd'], [7, 6, 0, 'd'],
            ...col(-1, -3, 0, 3), ...col(1, -4, 0, 5), ...col(2, -4, 0, 2), ...col(9, -3, 0, 4), ...col(10, -3, 0, 2),
          ],
        },
        { color: CORAL, pivot: [4.5, 0.5], rot: { cycle: 4, step: 1 }, blocks: [[4, -1, 0], [4, 0, 0], [4, 1, 0]] },
        { color: TEAL, slide: [0, -3, 0], blocks: line(6, 3, 0, 1, 0, 3) },
      ],
      handles: [
        { type: 'rot', piece: 1, on: 0, at: [3, 3, 0] },
        { type: 'slide', piece: 2, on: 0, at: [7, 6, 0] },
      ],
      start: [0, 0, 0], goal: [8, 3, 0],
    },

    // 4 ---------------------------------------------------------------
    {
      name: 'Impossible Stairs',
      hint: 'If two paths look like they touch, they do. A violet glow marks the join.',
      sky: ['#d9e4ff', '#b48fe0'],
      illusion: true,
      pieces: [
        {
          color: CREAM,
          blocks: [
            ...line(-2, 0, 0, 1, 0, 3),
            ...line(4, 1, 1, 1, 0, 2), ...under(line(4, 1, 1, 1, 0, 2)),
            [1, 3, 0, 'd'],
            ...col(-2, -3, 0, 4), ...col(0, -3, 0, 2), ...col(3, -2, 0, 3), ...col(6, -1, 0, 4), ...col(7, -1, 0, 2),
          ],
        },
        {
          color: VIOLET, pivot: [3.5, 1.5], rot: { cycle: 2, step: 1 },
          blocks: [[3, 1, 1], [3, 2, 1], [3, 1, 0, 'd'], [3, 2, 0, 'd']],
        },
      ],
      handles: [{ type: 'rot', piece: 1, on: 0, at: [1, 3, 0] }],
      start: [-2, 0, 0], goal: [5, 1, 1],
    },

    // 5 ---------------------------------------------------------------
    {
      name: 'Linked Cranks',
      hint: 'One crank can move two bridges at once.',
      sky: ['#c6f0e0', '#e29ac8'],
      pieces: [
        {
          color: CREAM,
          blocks: [
            // island A with a stair up
            ...line(0, 0, 0, 1, 0, 2), [2, 0, 0, 'd'], [2, 0, 1, 's', 0], [3, 0, 0, 'd'], [3, 0, 1],
            // island B
            ...line(7, 0, 1, 0, 1, 3), ...under(line(7, 0, 1, 0, 1, 3)),
            // island C with a stair up
            [7, 6, 0, 'd'], [7, 6, 1], [7, 7, 1, 'd'], [7, 7, 2, 's', 1],
            [7, 8, 1, 'd'], [7, 8, 2], [8, 8, 1, 'd'], [8, 8, 2],
            // island D
            ...line(12, 8, 2, 1, 0, 2), ...under(line(12, 8, 2, 1, 0, 2)),
            // crank pedestals
            [2, 3, 0, 'd'], [9, 5, 0, 'd'], [9, 5, 1, 'd'],
            ...col(-1, -3, 0, 3), ...col(2, -3, 0, 5), ...col(3, -3, 0, 3), ...col(5, -4, 0, 4), ...col(10, 1, 0, 3), ...col(11, 1, 0, 2),
          ],
        },
        { color: CORAL, pivot: [5.5, 0.5], rot: { cycle: 4, step: 1 }, blocks: line(5, -1, 1, 0, 1, 3) },
        { color: TEAL, pivot: [7.5, 4.5], rot: { cycle: 4, step: 1 }, blocks: line(7, 3, 1, 0, 1, 3) },
        { color: AMBER, pivot: [10.5, 8.5], rot: { cycle: 4, step: 1 }, blocks: line(10, 7, 2, 0, 1, 3) },
      ],
      handles: [
        { type: 'rot', piece: [1, 2], on: 0, at: [2, 3, 0] },
        { type: 'rot', piece: [2, 3], on: 0, at: [9, 5, 1] },
      ],
      start: [0, 0, 0], goal: [13, 8, 2],
    },

    // 6 ---------------------------------------------------------------
    {
      name: 'Echo Spire',
      hint: 'Turn it, slide it, then look again.',
      sky: ['#ffdcb0', '#7f6fd0'],
      illusion: true,
      pieces: [
        {
          color: CREAM,
          blocks: [
            ...line(-2, 0, 0, 1, 0, 3),
            ...line(4, 1, 1, 1, 0, 2), ...under(line(4, 1, 1, 1, 0, 2)),
            ...line(9, 1, 1, 1, 0, 2), ...under(line(9, 1, 1, 1, 0, 2)),
            [1, 3, 0, 'd'], [8, 4, 1, 'd'], [8, 4, 0, 'd'],
            ...col(-2, -3, 0, 4), ...col(0, -3, 0, 2), ...col(3, -2, 0, 3), ...col(7, -3, 0, 5), ...col(8, -3, 0, 3), ...col(12, 0, 0, 4),
          ],
        },
        {
          color: VIOLET, pivot: [3.5, 1.5], rot: { cycle: 2, step: 1 },
          blocks: [[3, 1, 1], [3, 2, 1], [3, 1, 0, 'd'], [3, 2, 0, 'd']],
        },
        { color: CORAL, pivot: [7.5, 1.5], rot: { cycle: 4, step: 1 }, blocks: line(6, 1, 1, 1, 0, 3) },
      ],
      handles: [
        { type: 'rot', piece: [1, 2], on: 0, at: [1, 3, 0] },
        { type: 'rot', piece: 2, on: 0, at: [8, 4, 1] },
      ],
      start: [-2, 0, 0], goal: [10, 1, 1],
    },

    // 7 ---------------------------------------------------------------
    {
      name: 'Chain Reaction',
      hint: 'Every crank turns two bridges. Work out which ones to touch.',
      sky: ['#fff0c9', '#e3a0a0'],
      pieces: [
        {
          color: CREAM,
          blocks: [
            ...line(-1, 0, 0, 1, 0, 2), [4, 0, 0], [4, 4, 0], [8, 4, 0], [8, 8, 0],
            [1, 3, 0, 'd'], [6, 1, 0, 'd'], [10, 6, 0, 'd'],
            ...col(-1, -3, 0, 3), ...col(0, -3, 0, 2), ...col(5, -2, 0, 3), ...col(6, -2, 0, 2), ...col(11, 3, 0, 3), ...col(12, 3, 0, 2),
          ],
        },
        { color: CORAL, pivot: [2.5, 0.5], rot: { cycle: 4, step: 1 }, blocks: line(2, -1, 0, 0, 1, 3) },
        { color: TEAL, pivot: [4.5, 2.5], rot: { cycle: 4, step: 1 }, blocks: line(4, 1, 0, 0, 1, 3) },
        { color: AMBER, pivot: [6.5, 4.5], rot: { cycle: 4, step: 1 }, blocks: line(5, 4, 0, 1, 0, 3) },
        { color: VIOLET, pivot: [8.5, 6.5], rot: { cycle: 4, step: 1 }, blocks: line(7, 6, 0, 1, 0, 3) },
      ],
      handles: [
        { type: 'rot', piece: [1, 2], on: 0, at: [1, 3, 0] },
        { type: 'rot', piece: [2, 3], on: 0, at: [6, 1, 0] },
        { type: 'rot', piece: [3, 4], on: 0, at: [10, 6, 0] },
      ],
      start: [-1, 0, 0], goal: [8, 8, 0],
    },

    // 8 ---------------------------------------------------------------
    {
      name: 'Passenger',
      hint: 'Parts of the world will carry you. Stand on one, then turn.',
      sky: ['#d6f3ff', '#9a8fe8'],
      pieces: [
        {
          color: CREAM,
          blocks: [
            ...line(4, -4, 0, 0, 1, 3), ...line(6, 0, 0, 1, 0, 3), ...line(10, 2, 0, 1, 0, 2),
            [2, 2, 0, 'd'], [6, 4, 0, 'd'],
            ...col(1, -6, 0, 4), ...col(2, -6, 0, 2), ...col(7, -4, 0, 4), ...col(8, -4, 0, 2), ...col(13, 0, 0, 3),
          ],
        },
        { color: CORAL, pivot: [4.5, 0.5], rot: { cycle: 4, step: 1 }, blocks: line(4, -1, 0, 0, 1, 3) },
        { color: TEAL, pivot: [8.5, 2.5], rot: { cycle: 4, step: 1 }, blocks: line(8, 1, 0, 0, 1, 3) },
      ],
      handles: [
        { type: 'rot', piece: 1, on: 0, at: [2, 2, 0] },
        { type: 'rot', piece: 2, on: 0, at: [6, 4, 0] },
      ],
      start: [4, -4, 0], goal: [11, 2, 0],
    },

    // 9 ---------------------------------------------------------------
    {
      name: 'The Lift',
      hint: 'Teal lifts carry you up. Ride one, then step off.',
      sky: ['#ffe2e8', '#8fb4ee'],
      pieces: [
        {
          color: CREAM,
          blocks: [
            ...line(0, 0, 0, 1, 0, 3),
            ...line(4, 0, 2, 1, 0, 2), ...col(4, 0, 0, 2), ...col(5, 0, 0, 2),
            ...line(9, 0, 2, 1, 0, 2), ...col(9, 0, 0, 2), ...col(10, 0, 0, 2),
            [1, 3, 0, 'd'], ...col(7, 3, 0, 2),
            ...col(0, -3, 0, 4), ...col(1, -3, 0, 2), ...col(6, -4, 0, 5), ...col(12, -2, 0, 4),
          ],
        },
        { color: TEAL, slide: [0, 0, 2], blocks: [[3, 0, 0], [3, 0, -1, 'd'], [3, 0, -2, 'd']] },
        { color: CORAL, pivot: [7.5, 0.5], rot: { cycle: 4, step: 1 }, blocks: line(7, -1, 2, 0, 1, 3) },
      ],
      handles: [
        { type: 'slide', piece: 1, on: 0, at: [1, 3, 0] },
        { type: 'rot', piece: 2, on: 0, at: [7, 3, 1] },
      ],
      start: [0, 0, 0], goal: [10, 0, 2],
    },

    // 10 --------------------------------------------------------------
    {
      name: 'Phantom Steps',
      hint: 'Rise on the teal step. From here, it looks like the next one is right beside you.',
      sky: ['#e9dcff', '#f4a6a0'],
      illusion: true,
      pieces: [
        {
          color: CREAM,
          blocks: [
            ...line(-2, 0, 0, 1, 0, 3),
            ...line(5, 2, 2, 1, 0, 2), ...col(5, 2, 0, 2), ...col(6, 2, 0, 2),
            ...line(11, 4, 4, 1, 0, 2), ...col(11, 4, 0, 4), ...col(12, 4, 0, 4),
            [-1, 3, 0, 'd'], ...col(7, 5, 0, 2),
            ...col(-2, -3, 0, 4), ...col(0, -3, 0, 2), ...col(3, -3, 0, 6),
          ],
        },
        { color: TEAL, slide: [2, 1, 1], blocks: [[1, 0, 0], [1, 0, -1, 'd'], [1, 0, -2, 'd']] },
        { color: VIOLET, slide: [2, 1, 1], blocks: [[7, 2, 2], [7, 2, 1, 'd'], [7, 2, 0, 'd']] },
      ],
      handles: [
        { type: 'slide', piece: 1, on: 0, at: [-1, 3, 0] },
        { type: 'slide', piece: 2, on: 0, at: [7, 5, 1] },
      ],
      start: [-2, 0, 0], goal: [12, 4, 4],
    },

    // 11 --------------------------------------------------------------
    {
      name: 'Spire Ascent',
      hint: 'Ramp, lift, bridge. The order is yours.',
      sky: ['#c9f2dd', '#7f9ae0'],
      pieces: [
        {
          color: CREAM,
          blocks: [
            ...line(0, 0, 0, 1, 0, 4),
            ...line(6, 0, 1, 1, 0, 2), ...col(6, 0, 0, 1), ...col(7, 0, 0, 1),
            [9, 0, 2], [10, 0, 2], [10, 1, 2], ...col(9, 0, 0, 2), ...col(10, 0, 0, 2), ...col(10, 1, 0, 2),
            ...line(10, 5, 2, 0, 1, 2), ...col(10, 5, 0, 2), ...col(10, 6, 0, 2),
            [2, 3, 0, 'd'], [5, 3, 0, 'd'], ...col(12, 3, 0, 2),
            ...col(0, -3, 0, 3), ...col(1, -3, 0, 2), ...col(6, -4, 0, 5), ...col(13, 0, 0, 4),
          ],
        },
        {
          color: TEAL, pivot: [4.5, 0.5], rot: { cycle: 2, step: -1 },
          blocks: [[4, 0, 0], [4, 1, 0, 'd'], [4, 1, 1, 's', 1]],
        },
        { color: AMBER, slide: [0, 0, 1], blocks: [[8, 0, 1], [8, 0, 0, 'd'], [8, 0, -1, 'd']] },
        { color: CORAL, pivot: [10.5, 3.5], rot: { cycle: 4, step: 1 }, blocks: line(9, 3, 2, 1, 0, 3) },
      ],
      handles: [
        { type: 'rot', piece: 1, on: 0, at: [2, 3, 0] },
        { type: 'slide', piece: 2, on: 0, at: [5, 3, 0] },
        { type: 'rot', piece: 3, on: 0, at: [12, 3, 1] },
      ],
      start: [0, 0, 0], goal: [10, 6, 2],
    },

    // 12 --------------------------------------------------------------
    {
      name: 'The Summit',
      hint: 'Everything you have learned, once more.',
      sky: ['#ffd0a8', '#5d4fc0'],
      illusion: true,
      pieces: [
        {
          color: CREAM,
          blocks: [
            ...line(-2, 0, 0, 1, 0, 3),
            ...line(4, 1, 1, 1, 0, 2), ...under(line(4, 1, 1, 1, 0, 2)),
            [9, 1, 1], [9, 2, 1], [9, 1, 0, 'd'], [9, 2, 0, 'd'],
            [9, 6, 1], [9, 6, 0, 'd'],
            ...line(7, 6, 2, -1, 0, 2), ...col(7, 6, 0, 2), ...col(6, 6, 0, 2),
            [1, 3, 0, 'd'], [12, 3, 0, 'd'], [11, 6, 0, 'd'],
            ...col(-2, -3, 0, 4), ...col(0, -3, 0, 2), ...col(3, -2, 0, 3), ...col(7, -3, 0, 5), ...col(8, -3, 0, 3), ...col(12, 0, 0, 4), ...col(13, 8, 0, 3), ...col(4, 7, 0, 3),
          ],
        },
        {
          color: VIOLET, pivot: [3.5, 1.5], rot: { cycle: 2, step: 1 },
          blocks: [[3, 1, 1], [3, 2, 1], [3, 1, 0, 'd'], [3, 2, 0, 'd']],
        },
        { color: CORAL, pivot: [7.5, 1.5], rot: { cycle: 4, step: 1 }, blocks: line(6, 1, 1, 1, 0, 3) },
        { color: TEAL, pivot: [9.5, 4.5], rot: { cycle: 4, step: 1 }, blocks: line(8, 4, 1, 1, 0, 3) },
        { color: AMBER, slide: [0, 0, 1], blocks: [[8, 6, 1], [8, 6, 0, 'd'], [8, 6, -1, 'd']] },
      ],
      handles: [
        { type: 'rot', piece: [1, 2], on: 0, at: [1, 3, 0] },
        { type: 'rot', piece: [2, 3], on: 0, at: [12, 3, 0] },
        { type: 'slide', piece: 4, on: 0, at: [11, 6, 0] },
      ],
      start: [-2, 0, 0], goal: [6, 6, 2],
    },
  ];

  const HINT = 'Each turning piece links up in only one pose. Some cranks turn pieces backwards.';
  const LEVELS = [
    ALL[0], ALL[1], ALL[2], ALL[3], ENDLESS, ALL[9], ALL[6], ALL[7],
    chain({
      name: 'Whispering Steps', hint: HINT, sky: ['#e4f0ff', '#9a86e0'],
      stages: [[3, 'R', 1], [4, 'R', 1], [4, 'R', 1], [3, 'L', 0]],
      cranks: [[[1, 3], -1], [[0], -1], [[0, 2], -1]], par: 8,
    }),
    chain({
      name: 'Mirage Stair', hint: HINT, sky: ['#ffe6d2', '#d68cb4'],
      stages: [[3, 'R', 0], [4, 'R', 1], [3, 'L', 0], [4, 'R', 1], [4, 'L', 1]],
      cranks: [[[1], -1], [[3], -1], [[0, 4], 1], [[0, 2], -1]], par: 9,
    }),
    chain({
      name: 'Falling Upward', hint: HINT, sky: ['#d3f5ea', '#6f86d8'],
      stages: [[4, 'L', 1], [3, 'R', 1], [4, 'L', 1], [4, 'L', 1], [3, 'L', 0], [3, 'R', 1]],
      cranks: [[[1, 3], 1], [[5], 1], [[2, 3], -1], [[0, 4], -1], [[4], 1]], par: 10,
    }),
    chain({
      name: 'The Long Way Round', hint: HINT, sky: ['#ffe0b8', '#8c6fd0'],
      stages: [[4, 'R', 1], [3, 'L', 1], [4, 'L', 1], [3, 'R', 1], [4, 'L', 1], [4, 'R', 1], [4, 'L', 1]],
      cranks: [[[6], -1], [[2, 3, 4], -1], [[3, 5], 1], [[0, 3], -1], [[0], -1], [[0, 1, 5], -1]], par: 11,
    }),
    chain({
      name: 'The Summit', hint: 'Everything you have learned. Take your time, and use the hint if you need it.',
      sky: ['#ffd2a6', '#4f3fb4'],
      stages: [[4, 'L', 1], [4, 'R', 1], [4, 'L', 1], [4, 'R', 1], [3, 'L', 0], [4, 'R', 1], [4, 'L', 1]],
      cranks: [[[0, 4], 1], [[5], -1], [[6], 1], [[0], -1], [[3], -1], [[0, 2, 4], 1], [[2], 1], [[0, 1, 4], -1]], par: 11,
    }),
  ];
  LEVELS.chain = chain;
  return LEVELS;
});
