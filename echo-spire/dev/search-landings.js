// Node dev tool: impossible-bridge towers with no cranks; stepping onto a landing turns its pieces.
// Run: node echo-spire/dev/search-landings.js [stages] [trials] [seed]
const L = require('../logic.js');
const levels = require('../levels.js');
const n = +process.argv[2] || 4, trials = +process.argv[3] || 500;
let seed = +process.argv[4] || 3;
const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pick = a => a[Math.floor(rnd() * a.length)];

function overlaps(lv) {
  const q = [L.initialState(lv)], keys = new Set([L.stateKey(q[0])]);
  for (let h = 0; h < q.length; h++) for (let i = 0; i < lv.handles.length; i++) {
    const nx = L.tap(lv, q[h], i), k = L.stateKey(nx);
    if (!keys.has(k)) { keys.add(k); q.push(nx); }
  }
  for (const st of q) {
    const m = new Set();
    for (const t of L.cells(lv, st)) { const k = t.x + ',' + t.y + ',' + t.z; if (m.has(k)) return true; m.add(k); }
  }
  return false;
}

const best = [];
for (let t = 0; t < trials; t++) {
  let side = rnd() < 0.5 ? 'R' : 'L';
  const stages = Array.from({ length: n }, () => {
    if (rnd() < 0.8) side = side === 'R' ? 'L' : 'R';
    const visual = rnd() < 0.5 ? 1 : 0;
    return [visual ? pick([3, 4, 4]) : pick([2, 3, 3]), side, visual];
  });
  const landings = Array.from({ length: n }, () => {
    const sz = 1 + Math.floor(rnd() * 3), set = new Set();
    while (set.size < Math.min(sz, n)) set.add(Math.floor(rnd() * n));
    return [[...set].sort(), rnd() < 0.35 ? -1 : 1];
  });
  const lv = L.prepare(levels.chain({ name: 'x', hint: '', sky: ['#fff', '#000'], stages, landings }));
  if (overlaps(lv)) continue;
  const sol = L.solve(lv, L.initialState(lv), lv.start, 18);
  if (!sol) continue;
  // reject tedious solutions: no plate pressed more than 3 times in all, and most plates actually used
  const uses = {};
  sol.seq.forEach(x => { uses[x.hi] = (uses[x.hi] || 0) + 1; });
  const maxUse = Math.max(0, ...Object.values(uses)), distinct = Object.keys(uses).length;
  if (maxUse > 3 || distinct < Math.min(n, 3)) continue;
  best.push({ taps: sol.taps, stages, landings, distinct, maxUse });
}
best.sort((a, b) => b.taps - a.taps);
console.log(`stages=${n} solvable=${best.length}/${trials} hist=${JSON.stringify(best.reduce((h, o) => (h[o.taps] = (h[o.taps] || 0) + 1, h), {}))}`);
const seen = new Set();
best.forEach(b => { if (!seen.has(b.taps) && b.taps >= 5 && b.taps <= 13) { seen.add(b.taps); console.log(JSON.stringify({ taps: b.taps, distinct: b.distinct, maxUse: b.maxUse, stages: b.stages, landings: b.landings })); } });
