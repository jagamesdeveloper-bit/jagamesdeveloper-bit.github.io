// Node dev tool: proves every level is solvable, reports the shortest crank sequence,
// and fails on overlapping blocks. Run: node echo-spire/dev/verify-levels.js
const L = require('../logic.js');
const defs = require('../levels.js');
const key = s => s.map(p => p.r + '.' + p.s).join('|');
let bad = 0;

defs.forEach((def, n) => {
  const lv = L.prepare(def);
  const init = L.initialState(lv);

  // Overlap check over every reachable pose.
  const seenStates = new Map([[key(init), init]]);
  const q = [init];
  for (let h = 0; h < q.length; h++) {
    for (let hi = 0; hi < lv.handles.length; hi++) {
      const nx = L.tap(lv, q[h], hi);
      if (!seenStates.has(key(nx))) { seenStates.set(key(nx), nx); q.push(nx); }
    }
  }
  let overlaps = 0;
  for (const st of seenStates.values()) {
    const all = L.cells(lv, st);
    const m = new Map();
    all.forEach(t => {
      const k = t.x + ',' + t.y + ',' + t.z;
      if (m.has(k)) { overlaps++; if (overlaps < 4) console.log(`  overlap @${k} in pose ${key(st)}`); }
      m.set(k, 1);
    });
  }

  // Layered search: walking is free, each crank tap costs 1.
  const nodeKey = (st, idx) => key(st) + '#' + idx;
  const parent = new Map();
  let layer = [{ st: init, idx: lv.start }];
  parent.set(nodeKey(init, lv.start), null);
  let solved = null;
  for (let taps = 0; layer.length && !solved; taps++) {
    const reach = [];
    for (const nd of layer) {
      const all = L.cells(lv, nd.st);
      const adj = L.buildGraph(lv, all);
      const stack = [nd.idx];
      const seen = new Set([nd.idx]);
      while (stack.length) {
        const c = stack.pop();
        reach.push({ st: nd.st, idx: c });
        const kk = nodeKey(nd.st, c);
        if (!parent.has(kk)) parent.set(kk, { from: nodeKey(nd.st, nd.idx), act: null });
        if (c === lv.goal && !solved) solved = { taps, st: nd.st, idx: c };
        for (const nb of adj[c]) if (!seen.has(nb)) { seen.add(nb); stack.push(nb); }
      }
    }
    if (solved) break;
    const next = [];
    for (const nd of reach) {
      for (let hi = 0; hi < lv.handles.length; hi++) {
        const st2 = L.tap(lv, nd.st, hi);
        const k2 = nodeKey(st2, nd.idx);
        if (parent.has(k2)) continue;
        parent.set(k2, { from: nodeKey(nd.st, nd.idx), act: hi });
        next.push({ st: st2, idx: nd.idx });
      }
    }
    layer = next;
  }
  let seq = [];
  if (solved) {
    let k = nodeKey(solved.st, solved.idx);
    while (parent.get(k)) { const p = parent.get(k); if (p.act !== null) seq.unshift(p.act); k = p.from; }
  }
  const ok = solved && solved.taps > 0 && overlaps === 0;
  if (!ok) bad++;
  console.log(`${ok ? 'OK ' : 'BAD'} ${n + 1} ${def.name}: ${solved ? solved.taps + ' taps [' + seq.join(',') + ']' : 'UNSOLVABLE'}, poses=${seenStates.size}, overlaps=${overlaps}`);
});
process.exit(bad ? 1 : 0);
