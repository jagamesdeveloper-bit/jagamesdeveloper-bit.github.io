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

  return [
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
      hint: 'If two paths look like they touch, they do.',
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
  ];
});
