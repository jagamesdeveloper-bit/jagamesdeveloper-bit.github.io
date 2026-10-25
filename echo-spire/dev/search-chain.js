// Node dev tool: searches crank wirings for illusion-chain levels and prints the hardest ones.
// Run: node echo-spire/dev/search-chain.js [stages] [trials] [seed]
const L = require('../logic.js');
const levels = require('../levels.js');
const n = +process.argv[2] || 5, trials = +process.argv[3] || 200;
let seed = +process.argv[4] || 7;
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
    const visual = rnd() < 0.55 ? 1 : 0;
    return [visual ? pick([3, 4, 4]) : pick([2, 3, 3]), side, visual];
  });
  const C = n - 1 + Math.floor(rnd() * 3), cranks = [];
  for (let j = 0; j < C; j++) {
    const sz = 1 + Math.floor(rnd() * 3), set = new Set();
    while (set.size < Math.min(sz, n)) set.add(Math.floor(rnd() * n));
    cranks.push([[...set].sort(), rnd() < 0.3 ? -1 : 1]);
  }
  if (new Set(cranks.flatMap(c => c[0])).size < n) continue;
  const lv = L.prepare(levels.chain({ name: 'x', hint: '', sky: ['#fff', '#000'], stages, cranks }));
  if (overlaps(lv)) continue;
  const sol = L.solve(lv, L.initialState(lv), lv.start, 20);
  if (sol) best.push({ taps: sol.taps, stages, cranks });
}
best.sort((a, b) => b.taps - a.taps);
console.log(`stages=${n} candidates=${best.length}`);
best.slice(0, 4).forEach(b => console.log(JSON.stringify({ taps: b.taps, stages: b.stages, cranks: b.cranks })));
