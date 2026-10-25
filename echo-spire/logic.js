/* Echo Spire - puzzle logic (no rendering). Shared by the game and the level verifier. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.EchoLogic = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Directions as quarter turns counter-clockwise: 0:+x 1:+y 2:-x 3:-y
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const mod = (n, m) => ((n % m) + m) % m;

  function rotPoint(px, py, x, y, k) {
    let dx = x - px, dy = y - py;
    for (let i = mod(k, 4); i > 0; i--) { const t = dx; dx = -dy; dy = t; }
    return [px + dx, py + dy];
  }

  // Turns raw level data into the structure used at runtime.
  function prepare(def) {
    const pieces = def.pieces.map((p, id) => ({
      id,
      color: p.color,
      pivot: p.pivot || [0, 0],
      rot: p.rot ? { cycle: p.rot.cycle || 4, step: p.rot.step || 1 } : null,
      slide: p.slide || null,
      blocks: p.blocks.map(b => ({
        x: b[0], y: b[1], z: b[2], kind: b[3] || 'b', dir: b[4] || 0, color: b[5] || null,
      })),
    }));
    const offsets = [];
    const flat = [];
    pieces.forEach(p => {
      offsets.push(flat.length);
      p.blocks.forEach((b, bi) => flat.push({ pi: p.id, bi, b }));
    });
    const find = cell => {
      const i = flat.findIndex(f => f.b.x === cell[0] && f.b.y === cell[1] && f.b.z === cell[2] && f.b.kind !== 'd');
      if (i < 0) throw new Error('No walkable block at ' + cell + ' in ' + def.name);
      return i;
    };
    const handles = (def.handles || []).map(h => ({
      type: h.type,
      targets: Array.isArray(h.piece) ? h.piece : [h.piece],
      host: h.on === undefined ? (Array.isArray(h.piece) ? h.piece[0] : h.piece) : h.on,
      at: h.at,
    }));
    return {
      name: def.name, hint: def.hint, sky: def.sky, illusion: !!def.illusion,
      pieces, flat, offsets, handles,
      start: find(def.start), goal: find(def.goal),
    };
  }

  function initialState(level) {
    return level.pieces.map(() => ({ r: 0, s: 0 }));
  }

  // Quarter turns applied to a piece for rotation state r.
  function rotK(piece, r) {
    return piece.rot ? mod(r * piece.rot.step, 4) : 0;
  }

  // Every block's current grid cell for a given state.
  function cells(level, state) {
    const out = new Array(level.flat.length);
    level.flat.forEach((f, i) => {
      const p = level.pieces[f.pi], st = state[f.pi], b = f.b;
      const k = rotK(p, st.r);
      const c = rotPoint(p.pivot[0], p.pivot[1], b.x + 0.5, b.y + 0.5, k);
      let x = Math.floor(c[0]), y = Math.floor(c[1]), z = b.z;
      if (st.s && p.slide) { x += p.slide[0]; y += p.slide[1]; z += p.slide[2]; }
      out[i] = { pi: f.pi, bi: f.bi, x, y, z, kind: b.kind, dir: mod(b.dir + k, 4), walk: b.kind !== 'd' };
    });
    return out;
  }

  // Cells a walkable tile can step into. A connection needs both sides to agree.
  function ports(t) {
    const out = [];
    if (t.kind === 'b') {
      for (const d of DIRS) {
        out.push([t.x + d[0], t.y + d[1], t.z]);
        out.push([t.x + d[0], t.y + d[1], t.z + 1]);
      }
    } else {
      const d = DIRS[t.dir];
      out.push([t.x - d[0], t.y - d[1], t.z - 1]);
      out.push([t.x + d[0], t.y + d[1], t.z]);
      out.push([t.x + d[0], t.y + d[1], t.z + 1]);
    }
    return out;
  }

  // Tiles that look touching on screen, even if they are far apart in 3D.
  function visuallyLinked(a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    if (Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) < 2) return false;
    // Same spot on screen: the Penrose staircase closing on itself.
    if (dx === dy && dy === dz) return true;
    return Math.abs(dx - dy) === 1 && Math.abs(Math.abs((dx + dy) / 2 - dz) - 0.5) < 1e-9;
  }

  function buildGraph(level, all) {
    const adj = all.map(() => []);
    const at = new Map();
    all.forEach((t, i) => at.set(t.x + ',' + t.y + ',' + t.z, i));
    const pt = all.map(t => (t.walk ? ports(t) : null));
    all.forEach((t, i) => {
      if (!t.walk) return;
      for (const p of pt[i]) {
        const j = at.get(p[0] + ',' + p[1] + ',' + p[2]);
        if (j === undefined || j === i || !all[j].walk) continue;
        if (pt[j].some(q => q[0] === t.x && q[1] === t.y && q[2] === t.z)) adj[i].push(j);
      }
    });
    adj.ill = new Set();
    if (level.illusion) {
      for (let i = 0; i < all.length; i++) {
        if (!all[i].walk || all[i].kind !== 'b') continue;
        for (let j = i + 1; j < all.length; j++) {
          if (!all[j].walk || all[j].kind !== 'b') continue;
          if (visuallyLinked(all[i], all[j]) && !adj[i].includes(j)) { adj[i].push(j); adj[j].push(i); adj.ill.add(i + ',' + j); }
        }
      }
    }
    return adj;
  }

  function findPath(adj, a, b) {
    if (a === b) return [a];
    const prev = new Map([[a, -1]]);
    const q = [a];
    for (let h = 0; h < q.length; h++) {
      for (const n of adj[q[h]]) {
        if (prev.has(n)) continue;
        prev.set(n, q[h]);
        if (n === b) {
          const path = [b];
          for (let c = q[h]; c !== -1; c = prev.get(c)) path.push(c);
          return path.reverse();
        }
        q.push(n);
      }
    }
    return null;
  }

  // New state after pressing handle hi.
  function tap(level, state, hi) {
    const h = level.handles[hi];
    const next = state.map(s => ({ r: s.r, s: s.s }));
    for (const pi of h.targets) {
      if (h.type === 'rot') next[pi].r = (next[pi].r + 1) % level.pieces[pi].rot.cycle;
      else next[pi].s = 1 - next[pi].s;
    }
    return next;
  }

  const stateKey = st => st.map(p => p.r + '.' + p.s).join('|');

  // Shortest list of crank taps that gets the player to the goal. Walking is free, so only taps cost.
  // Returns { taps, seq: [{ hi, at }] } where `at` is the tile the player must stand on when tapping
  // (that matters when a piece carries the player), or null if unsolvable.
  function solve(level, state, startIdx, maxTaps) {
    maxTaps = maxTaps || 12;
    const nk = (st, idx) => stateKey(st) + '#' + idx;
    const parent = new Map([[nk(state, startIdx), null]]);
    const graphs = new Map();
    let layer = [{ st: state, idx: startIdx }];
    for (let taps = 0; layer.length && taps <= maxTaps; taps++) {
      const reach = [];
      let found = null;
      for (const nd of layer) {
        const sk = stateKey(nd.st);
        let adj = graphs.get(sk);
        if (!adj) { adj = buildGraph(level, cells(level, nd.st)); graphs.set(sk, adj); }
        const seen = new Set([nd.idx]);
        const stack = [nd.idx];
        while (stack.length) {
          const c = stack.pop();
          reach.push({ st: nd.st, idx: c });
          const k = nk(nd.st, c);
          if (!parent.has(k)) parent.set(k, { from: nk(nd.st, nd.idx), act: null, at: null });
          if (c === level.goal && !found) found = k;
          for (const n of adj[c]) if (!seen.has(n)) { seen.add(n); stack.push(n); }
        }
      }
      if (found) {
        const seq = [];
        for (let k = found, p = parent.get(k); p; k = p.from, p = parent.get(k)) {
          if (p.act !== null) seq.unshift({ hi: p.act, at: p.at });
        }
        return { taps, seq };
      }
      const next = [];
      for (const nd of reach) {
        for (let hi = 0; hi < level.handles.length; hi++) {
          const st2 = tap(level, nd.st, hi);
          const k2 = nk(st2, nd.idx);
          if (parent.has(k2)) continue;
          parent.set(k2, { from: nk(nd.st, nd.idx), act: hi, at: nd.idx });
          next.push({ st: st2, idx: nd.idx });
        }
      }
      layer = next;
    }
    return null;
  }

  return { DIRS, mod, rotPoint, prepare, initialState, rotK, cells, buildGraph, findPath, tap, stateKey, solve };
});
