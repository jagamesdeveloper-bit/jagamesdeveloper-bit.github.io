// Node dev tool: searches crank wirings for illusion-chain levels and prints the hardest ones.
// Run: node echo-spire/dev/search-chain.js [stages] [trials]
const L = require('../logic.js');
const levels = require('../levels.js');
const n = +process.argv[2] || 4, trials = +process.argv[3] || 400;
let seed = +process.argv[4] || 7;
const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const pick = a => a[Math.floor(rnd() * a.length)];

function overlaps(lv) {
  const seen = new Map([[0, L.initialState(lv)]]);
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

let best = [];
for (let t = 0; t < trials; t++) {
  const cycles = Array.from({ length: n }, () => pick([2, 3, 3]));
  const C = n - 1 + Math.floor(rnd() * 3);
  const cranks = [];
  for (let j = 0; j < C; j++) {
    const sz = 1 + Math.floor(rnd() * 3), set = new Set();
    while (set.size < Math.min(sz, n)) set.add(Math.floor(rnd() * n));
    cranks.push([...set].sort());
  }
  if (new Set(cranks.flat()).size < n) continue;
  const def = levels.chain({ name: 'x', hint: '', sky: ['#fff', '#000'], cycles, cranks });
  const lv = L.prepare(def);
  if (overlaps(lv)) continue;
  const sol = L.solve(lv, L.initialState(lv), lv.start, 16);
  if (!sol) continue;
  best.push({ taps: sol.taps, cycles, cranks, uniq: sol.seq.length });
}
best.sort((a, b) => b.taps - a.taps);
console.log(`stages=${n} candidates=${best.length}`);
best.slice(0, 5).forEach(b => console.log(JSON.stringify({ taps: b.taps, cycles: b.cycles, cranks: b.cranks })));
