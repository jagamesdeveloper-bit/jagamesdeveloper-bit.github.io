// Node dev tool: proves every level is solvable, reports the shortest crank sequence,
// and fails on overlapping blocks. Run: node echo-spire/dev/verify-levels.js
const L = require('../logic.js');
const defs = require('../levels.js');
let bad = 0;

defs.forEach((def, n) => {
  const lv = L.prepare(def);
  const init = L.initialState(lv);

  const seen = new Map([[L.stateKey(init), init]]);
  const q = [init];
  for (let h = 0; h < q.length; h++) {
    for (let hi = 0; hi < lv.handles.length; hi++) {
      const nx = L.tap(lv, q[h], hi);
      if (!seen.has(L.stateKey(nx))) { seen.set(L.stateKey(nx), nx); q.push(nx); }
    }
  }
  let overlaps = 0;
  for (const st of seen.values()) {
    const m = new Set();
    L.cells(lv, st).forEach(t => {
      const k = t.x + ',' + t.y + ',' + t.z;
      if (m.has(k)) { overlaps++; if (overlaps < 4) console.log(`  overlap @${k} in pose ${L.stateKey(st)}`); }
      m.add(k);
    });
  }

  const t0 = Date.now();
  const sol = L.solve(lv, init, lv.start);
  const ms = Date.now() - t0;
  const ok = sol && sol.taps > 0 && overlaps === 0;
  if (!ok) bad++;
  const seq = sol ? sol.seq.map(s => `${s.hi}@${s.at}`).join(' ') : '';
  console.log(`${ok ? 'OK ' : 'BAD'} ${n + 1} ${def.name}: ${sol ? sol.taps + ' taps [' + seq + ']' : 'UNSOLVABLE'}, poses=${seen.size}, overlaps=${overlaps}, ${ms}ms`);
});
process.exit(bad ? 1 : 0);
